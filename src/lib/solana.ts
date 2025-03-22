import * as solanaWeb3 from '@solana/web3.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import connectDB from './mongodb';
import bs58 from 'bs58';

// Initialize connection
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');

// Load and validate TAX_COLLECTION_WALLET from .env
const developerWalletRaw = process.env.TAX_COLLECTION_WALLET;
if (!developerWalletRaw) {
  throw new Error('TAX_COLLECTION_WALLET is not defined in .env');
}

// Convert to PublicKey at startup with validation
let developerWallet: PublicKey;
try {
  developerWallet = new PublicKey(developerWalletRaw);
} catch {
  throw new Error(`Invalid TAX_COLLECTION_WALLET public key: ${developerWalletRaw}`);
}

export interface PlayerBet {
  player: PublicKey;
  amount: number;
  score: number;
}

// Define a plain version of ScoreSchema without Document
export interface PlainScore {
  gameId: string;
  userId: string;
  score: number;
  cycleEnd: Date | null;
}

export async function createBetTransaction(
  publicKey: string,
  amountSol: number,
  gameId: string
): Promise<string> {
  await connectDB();
  const Game = (await import('../models/Game')).default;

  try {
    const game = await Game.findOne({ gameId });
    if (!game) throw new Error(`Game ${gameId} not found`);

    const gamePotPubkey = new PublicKey(game.gamePotPublicKey);
    const lamports = amountSol * solanaWeb3.LAMPORTS_PER_SOL;

    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: new PublicKey(publicKey),
        toPubkey: gamePotPubkey,
        lamports,
      })
    );

    let blockhashData;
    try {
      blockhashData = await connection.getLatestBlockhash();
    } catch (blockhashError) {
      console.error('Failed to fetch blockhash:', blockhashError);
      throw new Error('Unable to fetch recent blockhash from Solana network');
    }

    transaction.recentBlockhash = blockhashData.blockhash;
    transaction.feePayer = new PublicKey(publicKey);

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
  } catch (error: unknown) {
    console.error('Error in createBetTransaction:', error);
    throw error;
  }
}

export async function confirmBet(
  publicKey: string,
  amountSol: number,
  gameId: string,
  signature: string
): Promise<void> {
  await connectDB();
  const Game = (await import('../models/Game')).default;
  const Player = (await import('../models/Player')).default;

  await connection.confirmTransaction(signature);

  const lamports = amountSol * solanaWeb3.LAMPORTS_PER_SOL;
  const userId = publicKey;
  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`Game ${gameId} not found`);

  const isNewPlayer = !game.activePlayers.some((player: { userId: string }) => player.userId === userId);

  await Game.updateOne(
    { gameId },
    {
      $inc: { 
        currentPot: lamports, 
        playerCount: isNewPlayer ? 1 : 0 
      },
      $addToSet: { 
        activePlayers: { userId }
      }
    }
  );

  await Player.updateOne(
    { userId },
    { $inc: { totalBets: lamports } },
    { upsert: true }
  );
}

export async function distributeWinnings(gameId: string): Promise<void> {
  await connectDB();
  const Game = (await import('../models/Game')).default;
  const Player = (await import('../models/Player')).default;
  const Score = (await import('../models/Score')).default;
  const Distribution = (await import('../models/Distribution')).default;

  const game = await Game.findOne({ gameId });
  if (!game || game.currentPot <= 0 || game.activePlayers.length === 0) return;

  const gamePotKeypair = Keypair.fromSecretKey(bs58.decode(game.gamePotSecretKey));
  const totalPotInDb = game.currentPot; // Source of truth
  const serviceFeePercentage = game.taxPercentage || 10;

  let actualBalance = await connection.getBalance(gamePotKeypair.publicKey);
  const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(0);
  console.log(`Initial balance for ${gameId}: ${actualBalance} lamports (DB: ${totalPotInDb}), Rent-exempt minimum: ${rentExemptMinimum}`);

  if (actualBalance <= rentExemptMinimum) {
    console.error(`Balance too low to distribute in ${gameId}. Available: ${actualBalance}, Required: ${rentExemptMinimum}`);
    return;
  }

  const excessFunds = Math.max(0, actualBalance - totalPotInDb - rentExemptMinimum);
  console.log(`Excess funds detected: ${excessFunds} lamports (retained for transaction fees)`);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const totalTxFeesEstimate = 10000; // Reserve for feeTx + winningsTx
  const totalPot = Math.max(0, totalPotInDb - totalTxFeesEstimate);
  const fee = totalPot * (serviceFeePercentage / 100);

  console.log(`Total pot (DB): ${totalPot}, Fee: ${fee}`);

  if (fee <= 0) {
    console.error(`Calculated fee (${fee}) too low for ${gameId}`);
    return;
  }

  const scores = await Score.find({ gameId, cycleEnd: null });
  if (scores.length === 0) return;

  const winner = scores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
  const winnerPubkey = new PublicKey(winner.userId);

  try {
    const feeTx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: gamePotKeypair.publicKey,
        toPubkey: developerWallet,
        lamports: Math.floor(fee),
      })
    );
    feeTx.recentBlockhash = blockhash;
    feeTx.feePayer = gamePotKeypair.publicKey;

    const feeResponse = await connection.getFeeForMessage(feeTx.compileMessage(), 'confirmed');
    const feeTxFee = feeResponse?.value ?? 5000;
    console.log(`Fee transaction fee: ${feeTxFee} lamports`);

    if (actualBalance < fee + feeTxFee + rentExemptMinimum) {
      console.error(`Insufficient balance for fee transfer in ${gameId}. Available: ${actualBalance}, Needed: ${fee + feeTxFee + rentExemptMinimum}`);
      return;
    }

    const feeSignature = await solanaWeb3.sendAndConfirmTransaction(connection, feeTx, [gamePotKeypair], {
      commitment: 'confirmed',
      maxRetries: 5,
    });
    console.log(`Fee transferred for ${gameId}. Signature: ${feeSignature}`);

    actualBalance = await connection.getBalance(gamePotKeypair.publicKey);
    console.log(`Balance after fee transfer for ${gameId}: ${actualBalance} lamports`);

    const placeholderWinningsTx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: gamePotKeypair.publicKey,
        toPubkey: winnerPubkey,
        lamports: 1,
      })
    );
    placeholderWinningsTx.recentBlockhash = blockhash;
    placeholderWinningsTx.feePayer = gamePotKeypair.publicKey;

    const winningsResponse = await connection.getFeeForMessage(placeholderWinningsTx.compileMessage(), 'confirmed');
    const winningsTxFee = winningsResponse?.value ?? 5000;
    console.log(`Winnings transaction fee: ${winningsTxFee} lamports`);

    const winnings = Math.max(0, totalPot - fee);
    console.log(`Calculated winnings: ${winnings} lamports`);

    if (actualBalance < winnings + winningsTxFee + rentExemptMinimum) {
      console.error(`Insufficient on-chain balance for winnings in ${gameId}. Available: ${actualBalance}, Needed: ${winnings + winningsTxFee + rentExemptMinimum}`);
      return;
    }

    const winningsTx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: gamePotKeypair.publicKey,
        toPubkey: winnerPubkey,
        lamports: Math.floor(winnings),
      })
    );
    winningsTx.recentBlockhash = blockhash;
    winningsTx.feePayer = gamePotKeypair.publicKey;

    const simulation = await connection.simulateTransaction(winningsTx);
    if (simulation.value.err) {
      console.error(`Winnings transaction simulation failed for ${gameId}:`, simulation.value.err, simulation.value.logs);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const winningsSignature = await solanaWeb3.sendAndConfirmTransaction(connection, winningsTx, [gamePotKeypair], {
      commitment: 'confirmed',
      maxRetries: 5,
    });
    console.log(`Winnings transferred for ${gameId}. Signature: ${winningsSignature}`);

    const finalBalance = await connection.getBalance(gamePotKeypair.publicKey);
    console.log(`Final balance for ${gameId}: ${finalBalance} lamports`);

    const currentDate = new Date();

    await Score.updateMany(
      { gameId, cycleEnd: null },
      { $set: { cycleEnd: currentDate } }
    );

    await Game.updateOne(
      { gameId },
      {
        $set: { currentPot: 0, activePlayers: [], lastDistribution: currentDate },
        $inc: { totalTaxCollected: fee },
      }
    );
    await Player.updateOne(
      { userId: winner.userId },
      { $inc: { totalWinnings: winnings } }
    );
    await Distribution.create({
      gameId,
      winnerUserId: winner.userId,
      totalPot,
      tax: fee,
      winnings,
    });
  } catch (error) {
    console.error(`Transaction failed for ${gameId}:`, error);
    throw error;
  }
}

//

export async function getGamePotAmount(gameId: string): Promise<number> {
  await connectDB();
  const Game = (await import('../models/Game')).default;
  const game = await Game.findOne({ gameId });
  return game ? game.currentPot : 0;
}

export async function updateScore(
  gameId: string,
  userId: string,
  score: number,
  fetchOnly: boolean = false
): Promise<PlainScore[] | { success: boolean; updated: boolean; previousScore: number; newScore: number }> {
  await connectDB();
  const Score = (await import('../models/Score')).default;

  if (fetchOnly) {
    const scores = await Score.find({ gameId, cycleEnd: null }).lean() as unknown as PlainScore[];
    // Optional runtime check (remove in production if confident)
    if (scores.length > 0 && (!scores[0].gameId || !scores[0].userId || typeof scores[0].score !== 'number')) {
      console.error('Fetched scores do not match PlainScore:', scores[0]);
    }
    return scores;
  }

  const existingScore = await Score.findOne({ gameId, userId, cycleEnd: null });
  const currentScore = existingScore ? existingScore.score : 0;

  if (score > currentScore) {
    await Score.updateOne(
      { gameId, userId, cycleEnd: null },
      { $set: { score } },
      { upsert: true }
    );
    return { success: true, updated: true, previousScore: currentScore, newScore: score };
  }

  return { success: true, updated: false, previousScore: currentScore, newScore: score };
}

export async function cleanDuplicatePlayers(gameId: string): Promise<void> {
  await connectDB();
  const Game = (await import('../models/Game')).default;

  try {
    const game = await Game.findOne({ gameId });
    if (!game) throw new Error(`Game ${gameId} not found`);

    const uniquePlayersMap = new Map<string, { userId: string }>();
    game.activePlayers.forEach((player: { userId: string }) => {
      uniquePlayersMap.set(player.userId, { userId: player.userId });
    });
    const uniquePlayers = Array.from(uniquePlayersMap.values());

    const result = await Game.updateOne(
      { gameId },
      {
        $set: {
          activePlayers: uniquePlayers,
          playerCount: uniquePlayers.length
        }
      }
    );

    console.log(`Cleaned duplicates for game ${gameId}. Modified: ${result.modifiedCount}`);
  } catch (error: unknown) {
    console.error(`Error cleaning duplicates for game ${gameId}:`, error);
    throw error;
  }
}

export async function sendPotToDeveloper(gameId: string): Promise<void> {
  await connectDB();
  const Game = (await import('../models/Game')).default;

  try {
    const game = await Game.findOne({ gameId });
    if (!game) throw new Error(`Game ${gameId} not found`);
    if (game.currentPot <= 0) throw new Error(`Game ${gameId} has no funds in the pot`);

    const gamePotKeypair = Keypair.fromSecretKey(bs58.decode(game.gamePotSecretKey));
    if (gamePotKeypair.publicKey.toBase58() !== game.gamePotPublicKey) {
      throw new Error(`Public key mismatch for game ${gameId}`);
    }

    const balance = await connection.getBalance(gamePotKeypair.publicKey);
    if (balance <= 0) throw new Error(`Game pot wallet has no funds`);

    const FEE_ESTIMATE = 5000;
    const transferableAmount = Math.max(0, balance - FEE_ESTIMATE);

    if (transferableAmount <= 0) {
      throw new Error(`Insufficient funds after accounting for fees: ${balance} lamports available`);
    }

    const developerPubkey = developerWallet;
    const { blockhash } = await connection.getLatestBlockhash();

    const transferTx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: gamePotKeypair.publicKey,
        toPubkey: developerPubkey,
        lamports: transferableAmount,
      })
    );

    transferTx.recentBlockhash = blockhash;
    transferTx.feePayer = gamePotKeypair.publicKey;

    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transferTx,
      [gamePotKeypair]
    );
    console.log(`Transferred ${transferableAmount} lamports from game ${gameId} to developer wallet. Signature: ${signature}`);

    await Game.updateOne(
      { gameId },
      { $set: { currentPot: 0 } }
    );

    console.log(`Game ${gameId} pot reset to 0 after transfer`);
  } catch (error: unknown) {
    console.error(`Error sending pot to developer for game ${gameId}:`, error);
    throw error;
  }
}