// app/api/update-score/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateScore } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  const { gameId, userId, score, fetchOnly } = await req.json();

  if (fetchOnly && !gameId) {
    return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  }
  if (!fetchOnly && (!gameId || !userId || score === undefined)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const result = await updateScore(gameId, userId || '', score, fetchOnly);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Update score error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}