// app/api/distribute-winnings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { distributeWinnings } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  const { gameId } = await req.json();
  if (!gameId) {
    return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  }

  try {
    await distributeWinnings(gameId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Distribute winnings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}