// app/api/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cleanDuplicatePlayers } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  try {
    const { gameId } = await req.json();
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

    await cleanDuplicatePlayers(gameId);
    const Game = (await import('../../../models/Game')).default;
    const updatedGame = await Game.findOne({ gameId });
    return NextResponse.json({ success: true, updatedGame });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}