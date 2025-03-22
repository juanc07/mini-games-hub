import { NextRequest, NextResponse } from 'next/server';
import { confirmBet } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  try {
    const { publicKey, amountSol, gameId, signature }: { 
      publicKey?: string; 
      amountSol?: number; 
      gameId?: string; 
      signature?: string; 
    } = await req.json();

    if (!publicKey || typeof publicKey !== 'string' || 
        !amountSol || typeof amountSol !== 'number' || 
        !gameId || typeof gameId !== 'string' || 
        !signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    await confirmBet(publicKey, amountSol, gameId, signature);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to confirm bet';
    console.error('Error in place-bet-confirm API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === 'Game not found' ? 404 : 500 }
    );
  }
}