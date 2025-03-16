// app/api/place-bet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createBetTransaction } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  try {
    const { publicKey, amountSol, gameId } = await req.json();
    if (!publicKey || !amountSol || !gameId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transaction = await createBetTransaction(publicKey, amountSol, gameId);
    return NextResponse.json({ transaction });
  } catch (error: any) {
    console.error('Error in place-bet API:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to create bet transaction' },
      { status: error.message === 'Game not found' ? 404 : 500 }
    );
  }
}