import { NextRequest, NextResponse } from 'next/server';
import { distributeWinnings } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  const { gameId }: { gameId?: string } = await req.json();
  if (!gameId || typeof gameId !== 'string') {
    return NextResponse.json({ error: 'gameId must be a string' }, { status: 400 });
  }

  try {
    console.log(`Starting distribution for ${gameId}`);
    await distributeWinnings(gameId);

    const now = new Date();
    const newCycleEndTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    await (await import('../../../models/Game')).default.updateOne(
      { gameId },
      { $set: { cycleEndTime: newCycleEndTime } }
    );
    console.log(`Distribution completed and new cycle started for ${gameId}. Next end: ${newCycleEndTime}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error(`Distribution failed for ${gameId}:`, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}