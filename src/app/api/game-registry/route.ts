import { NextRequest, NextResponse } from 'next/server';
import * as solanaWeb3 from '@solana/web3.js';
import connectDB from '../../../lib/mongodb';
import bs58 from 'bs58';
import { Model } from 'mongoose';
import { GameSchema } from '../../../models/Game'; // Adjust path as needed

// Import startServices to initialize the game cycle service
import '../../_lib/startServices/route';

type GameUpdateData = Partial<Pick<GameSchema, 'gameName' | 'taxPercentage' | 'gamePotPublicKey' | 'gamePotSecretKey' | 'cycleEndTime'>>;

export async function GET(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default as Model<GameSchema>;
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');

  if (gameId) {
    const game = await Game.findOne({ gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    return NextResponse.json(game);
  }

  const games = await Game.find();
  console.log(`Fetched ${games.length} games from registry`);
  return NextResponse.json(games);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default as Model<GameSchema>;
  const { gameId, gameName, taxPercentage, cycleDuration }: { 
    gameId?: string; 
    gameName?: string; 
    taxPercentage?: number; 
    cycleDuration?: number; 
  } = await req.json();

  if (!gameId || !gameName) {
    return NextResponse.json({ error: 'gameId and gameName are required' }, { status: 400 });
  }

  const gamePotKeypair = solanaWeb3.Keypair.generate();
  const defaultCycleDuration = 2 * 60 * 60 * 1000; // 2 hours in ms
  const cycleEndTime = cycleDuration 
    ? new Date(Date.now() + cycleDuration * 1000) // Convert seconds to ms
    : new Date(Date.now() + defaultCycleDuration);

  const newGame = await Game.create({
    gameId,
    gameName,
    gamePotPublicKey: gamePotKeypair.publicKey.toBase58(),
    gamePotSecretKey: bs58.encode(gamePotKeypair.secretKey),
    taxPercentage: taxPercentage || 10,
    currentPot: 0,
    totalTaxCollected: 0,
    playerCount: 0,
    activePlayers: [],
    lastDistribution: new Date(),
    cycleEndTime,
  });

  console.log(`Created game ${gameId} with cycle ending at ${cycleEndTime}`);
  return NextResponse.json(newGame);
}

export async function PUT(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default as Model<GameSchema>;
  const { gameId, gameName, taxPercentage, gamePotPublicKey, gamePotSecretKey, cycleDuration }: { 
    gameId?: string; 
    gameName?: string; 
    taxPercentage?: number; 
    gamePotPublicKey?: string; 
    gamePotSecretKey?: string; 
    cycleDuration?: number; 
  } = await req.json();

  if (!gameId) {
    return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
  }

  const updateData: GameUpdateData = {};
  if (gameName) updateData.gameName = gameName;
  if (taxPercentage !== undefined) updateData.taxPercentage = taxPercentage;
  if (gamePotPublicKey) updateData.gamePotPublicKey = gamePotPublicKey;
  if (gamePotSecretKey) updateData.gamePotSecretKey = gamePotSecretKey;
  if (cycleDuration !== undefined) {
    updateData.cycleEndTime = new Date(Date.now() + cycleDuration * 1000); // Convert seconds to ms
  }

  const updatedGame = await Game.findOneAndUpdate(
    { gameId },
    { $set: updateData },
    { new: true }
  );
  if (!updatedGame) {
    return NextResponse.json({ error: `Game ${gameId} not found` }, { status: 404 });
  }
  console.log(`Updated game ${gameId}. New cycle end: ${updatedGame.cycleEndTime}`);
  return NextResponse.json(updatedGame);
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default as Model<GameSchema>;
  const { gameId }: { gameId?: string } = await req.json();

  if (!gameId) {
    return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
  }

  const deletedGame = await Game.findOneAndDelete({ gameId });
  if (!deletedGame) {
    return NextResponse.json({ error: `Game ${gameId} not found` }, { status: 404 });
  }
  console.log(`Deleted game ${gameId}`);
  return NextResponse.json({ success: true });
}