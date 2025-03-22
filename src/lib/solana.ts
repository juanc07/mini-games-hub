import * as solanaWeb3 from '@solana/web3.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import connectDB from './mongodb';
import bs58 from 'bs58'; // Add this dependency

const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');

// REPLACE WITH ADMIN_WALLET FROM .ENV FILE ADMIN_WALLET
const developerWallet = 'HbyQrE2N1V8TPs5HJ9wGDq3M85Zm1i21RmgbLFk39xkS';

export interface PlayerBet {
  player: PublicKey;
  amount: number;
  score: number;
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
  } catch (error: any) {
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

  const gamePotKeypair = Keypair.fromSecretKey(bs58.decode(game.gamePotSecretKey)); // Changed to decode string
  const totalPot = game.currentPot;
  const serviceFeePercentage = game.taxPercentage || 10;
  const fee = totalPot * (serviceFeePercentage / 100);
  const winnings = totalPot - fee;

  const serviceWallet = new PublicKey(developerWallet);
  const scores = await Score.find({ gameId, cycleEnd: null });
  if (scores.length === 0) return;

  const winner = scores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
  const winnerPubkey = new PublicKey(winner.userId);

  const feeTx = new solanaWeb3.Transaction().add(
    solanaWeb3.SystemProgram.transfer({
      fromPubkey: gamePotKeypair.publicKey,
      toPubkey: serviceWallet,
      lamports: Math.floor(fee),
    })
  );
  const winningsTx = new solanaWeb3.Transaction().add(
    solanaWeb3.SystemProgram.transfer({
      fromPubkey: gamePotKeypair.publicKey,
      toPubkey: winnerPubkey,
      lamports: Math.floor(winnings),
    })
  );

  const { blockhash } = await connection.getLatestBlockhash();
  feeTx.recentBlockhash = blockhash;
  feeTx.feePayer = gamePotKeypair.publicKey;
  winningsTx.recentBlockhash = blockhash;
  winningsTx.feePayer = gamePotKeypair.publicKey;

  await solanaWeb3.sendAndConfirmTransaction(connection, feeTx, [gamePotKeypair]);
  await solanaWeb3.sendAndConfirmTransaction(connection, winningsTx, [gamePotKeypair]);

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
}

export async function getGamePotAmount(gameId: string): Promise<number> {
  await connectDB();
  const Game = (await import('../models/Game')).default;
  const game = await Game.findOne({ gameId });
  return game ? game.currentPot : 0;
}

export async function updateScore(gameId: string, userId: string, score: number, fetchOnly: boolean = false): Promise<any> {
  await connectDB();
  const Score = (await import('../models/Score')).default;

  if (fetchOnly) {
    const scores = await Score.find({ gameId, cycleEnd: null }).lean();
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
  } catch (error: any) {
    console.error(`Error cleaning duplicates for game ${gameId}:`, error);
    throw error;
  }
}

export async function sendPotToDeveloper(gameId: string): Promise<void> {
  await connectDB();
  const Game = (await import('../models/Game')).default;

  try {
    // Fetch the game
    const game = await Game.findOne({ gameId });
    if (!game) throw new Error(`Game ${gameId} not found`);
    if (game.currentPot <= 0) throw new Error(`Game ${gameId} has no funds in the pot`);

    // Reconstruct the game pot keypair from the stored secret key (now a string)
    const gamePotKeypair = Keypair.fromSecretKey(bs58.decode(game.gamePotSecretKey)); // Changed to decode string

    // Verify the public key matches (for safety)
    if (gamePotKeypair.publicKey.toBase58() !== game.gamePotPublicKey) {
      throw new Error(`Public key mismatch for game ${gameId}`);
    }

    // Get the actual balance of the game pot wallet
    const balance = await connection.getBalance(gamePotKeypair.publicKey);
    if (balance <= 0) throw new Error(`Game pot wallet has no funds`);

    // Estimate the transaction fee (assume 5000 lamports for a simple transfer)
    const FEE_ESTIMATE = 5000; // Adjust based on actual fee if needed
    const transferableAmount = Math.max(0, balance - FEE_ESTIMATE);

    if (transferableAmount <= 0) {
      throw new Error(`Insufficient funds after accounting for fees: ${balance} lamports available`);
    }

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create a transaction to transfer the available amount to the developer wallet
    const developerPubkey = new PublicKey(developerWallet);
    const transferTx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: gamePotKeypair.publicKey,
        toPubkey: developerPubkey,
        lamports: transferableAmount, // Transfer only what’s available minus fee
      })
    );

    // Set the blockhash and fee payer
    transferTx.recentBlockhash = blockhash;
    transferTx.feePayer = gamePotKeypair.publicKey;

    // Sign and send the transaction
    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transferTx,
      [gamePotKeypair]
    );
    console.log(`Transferred ${transferableAmount} lamports from game ${gameId} to developer wallet. Signature: ${signature}`);

    // Update the game to reflect the pot being emptied
    await Game.updateOne(
      { gameId },
      { $set: { currentPot: 0 } }
    );

    console.log(`Game ${gameId} pot reset to 0 after transfer`);
  } catch (error: any) {
    console.error(`Error sending pot to developer for game ${gameId}:`, error);
    throw error;
  }
}