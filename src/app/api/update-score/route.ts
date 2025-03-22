import { NextRequest, NextResponse } from 'next/server';
import { updateScore, PlainScore } from '../../../lib/solana';

type UpdateScoreResult = 
  | PlainScore[]
  | { success: boolean; updated: boolean; previousScore: number; newScore: number };

export async function POST(req: NextRequest) {
  const { gameId, userId, score, fetchOnly }: { 
    gameId?: string; 
    userId?: string; 
    score?: number; 
    fetchOnly?: boolean; 
  } = await req.json();

  if (fetchOnly) {
    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid gameId' }, { status: 400 });
    }
    try {
      const result: UpdateScoreResult = await updateScore(gameId, '', 0, true);
      return NextResponse.json(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      console.error('Update score error:', error);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  if (!gameId || typeof gameId !== 'string' || 
      !userId || typeof userId !== 'string' || 
      score === undefined || typeof score !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
  }

  try {
    const result: UpdateScoreResult = await updateScore(gameId, userId, score, false);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Update score error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}