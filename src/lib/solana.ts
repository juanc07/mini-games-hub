// src/lib/solana.ts
import * as solanaWeb3 from '@solana/web3.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import connectDB from './mongodb';

const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');

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
    throw error; // Re-throw for API to handle
  }
}

// Rest of the file remains unchanged
// src/lib/solana.ts (partial update)
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

  // Update game: increment pot, add player only if new
  await Game.updateOne(
    { gameId },
    {
      $inc: { 
        currentPot: lamports, 
        playerCount: isNewPlayer ? 1 : 0 
      },
      $addToSet: { 
        activePlayers: { userId } // This should work with proper schema
      }
    }
  );

  // Update player total bets
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

  const gamePotKeypair = Keypair.fromSecretKey(Uint8Array.from(game.gamePotSecretKey));
  const totalPot = game.currentPot;
  const serviceFeePercentage = game.taxPercentage || 10;
  const fee = totalPot * (serviceFeePercentage / 100);
  const winnings = totalPot - fee;

  const serviceWallet = new PublicKey('HbyQrE2N1V8TPs5HJ9wGDq3M85Zm1i21RmgbLFk39xkS');
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

// src/lib/solana.ts
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

    // Deduplicate activePlayers by userId
    const uniquePlayersMap = new Map<string, { userId: string }>();
    game.activePlayers.forEach((player: { userId: string }) => {
      uniquePlayersMap.set(player.userId, { userId: player.userId });
    });
    const uniquePlayers = Array.from(uniquePlayersMap.values());

    // Update the game with deduplicated players and correct playerCount
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