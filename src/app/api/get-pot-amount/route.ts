// app/api/get-pot-amount/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getGamePotAmount } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  const { gameId } = await req.json();
  if (!gameId) {
    return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  }

  try {
    const potAmount = await getGamePotAmount(gameId);
    return NextResponse.json({ potAmount });
  } catch (error: any) {
    console.error('Get pot amount error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}