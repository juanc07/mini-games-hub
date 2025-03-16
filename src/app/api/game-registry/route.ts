import { NextRequest, NextResponse } from 'next/server';
import * as solanaWeb3 from '@solana/web3.js';
import connectDB from '../../../lib/mongodb';

export async function GET(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default;
  const games = await Game.find();
  return NextResponse.json(games);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default;
  const { gameId, gameName, taxPercentage } = await req.json();

  const gamePotKeypair = solanaWeb3.Keypair.generate();
  const newGame = await Game.create({
    gameId,
    gameName,
    gamePotPublicKey: gamePotKeypair.publicKey.toBase58(),
    gamePotSecretKey: Array.from(gamePotKeypair.secretKey),
    taxPercentage: taxPercentage || 10, // Default to 10%
    currentPot: 0,
    totalTaxCollected: 0,
    playerCount: 0,
    activePlayers: [],
    lastDistribution: new Date(),
  });

  return NextResponse.json(newGame);
}

export async function PUT(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default;
  const { gameId, gameName, taxPercentage, gamePotPublicKey, gamePotSecretKey } = await req.json();

  const updateData: any = {};
  if (gameName) updateData.gameName = gameName;
  if (taxPercentage !== undefined) updateData.taxPercentage = taxPercentage;
  if (gamePotPublicKey) updateData.gamePotPublicKey = gamePotPublicKey;
  if (gamePotSecretKey) updateData.gamePotSecretKey = gamePotSecretKey;

  const updatedGame = await Game.findOneAndUpdate(
    { gameId },
    { $set: updateData },
    { new: true }
  );
  if (!updatedGame) throw new Error(`Game ${gameId} not found`);
  return NextResponse.json(updatedGame);
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const Game = (await import('../../../models/Game')).default;
  const { gameId } = await req.json();

  const deletedGame = await Game.findOneAndDelete({ gameId });
  if (!deletedGame) throw new Error(`Game ${gameId} not found`);
  return NextResponse.json({ success: true });
}