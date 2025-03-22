import { NextRequest, NextResponse } from 'next/server';
import { confirmBet } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  try {
    const { publicKey, amountSol, gameId, signature } = await req.json();
    if (!publicKey || !amountSol || !gameId || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await confirmBet(publicKey, amountSol, gameId, signature);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in place-bet-confirm API:', error);
    return NextResponse.json({ error: error.message }, { status: error.message === 'Game not found' ? 404 : 500 });
  }
}