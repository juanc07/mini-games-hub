// app/api/get-pot-amount/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getGamePotAmount } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  const { gameId }: { gameId?: string } = await req.json();
  if (!gameId || typeof gameId !== 'string') {
    return NextResponse.json({ error: 'gameId must be a string' }, { status: 400 });
  }

  try {
    const potAmount = await getGamePotAmount(gameId);
    return NextResponse.json({ potAmount });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Get pot amount error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}