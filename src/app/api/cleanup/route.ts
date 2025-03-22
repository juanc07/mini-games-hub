// app/api/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cleanDuplicatePlayers } from '../../../lib/solana';
import { Model } from 'mongoose';
import { GameSchema } from '../../../models/Game'; // Adjust path as needed

export async function POST(req: NextRequest) {
  try {
    const { gameId } = await req.json();
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

    await cleanDuplicatePlayers(gameId);
    const Game = (await import('../../../models/Game')).default as Model<GameSchema>;
    const updatedGame = await Game.findOne({ gameId });
    return NextResponse.json({ success: true, updatedGame });
  } catch (error: unknown) {
    // Type guard to handle the error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}