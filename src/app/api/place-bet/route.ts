// app/api/place-bet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createBetTransaction } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  try {
    const { publicKey, amountSol, gameId }: { 
      publicKey?: string; 
      amountSol?: number; 
      gameId?: string; 
    } = await req.json();

    if (!publicKey || typeof publicKey !== 'string' || 
        !amountSol || typeof amountSol !== 'number' || 
        !gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    const transaction = await createBetTransaction(publicKey, amountSol, gameId);
    return NextResponse.json({ transaction });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create bet transaction';
    console.error('Error in place-bet API:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === 'Game not found' ? 404 : 500 }
    );
  }
}