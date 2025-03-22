import { NextRequest, NextResponse } from 'next/server';
import { sendPotToDeveloper } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  console.log('Received request:', req.method, req.url);
  let body: { gameId?: string };
  try {
    body = await req.json();
    console.log('Request body:', body);
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
    console.error('Failed to parse JSON:', errorMessage);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { gameId }: { gameId?: string } = body;
  if (!gameId || typeof gameId !== 'string') {
    console.log('Missing or invalid gameId in request');
    return NextResponse.json({ error: 'gameId must be a string' }, { status: 400 });
  }

  try {
    console.log(`Calling sendPotToDeveloper for gameId: ${gameId}`);
    await sendPotToDeveloper(gameId);
    console.log(`Successfully sent pot for gameId: ${gameId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send pot to developer';
    console.error('sendPotToDeveloper error:', errorMessage, error instanceof Error ? error.stack : undefined);
    const status = errorMessage === 'Game not found' ? 404 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}