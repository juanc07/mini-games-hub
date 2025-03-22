import { NextRequest, NextResponse } from 'next/server';
import { sendPotToDeveloper } from '../../../lib/solana';

export async function POST(req: NextRequest) {
  console.log('Received request:', req.method, req.url);
  let body;
  try {
    body = await req.json();
    console.log('Request body:', body);
  } catch (parseError) {
    console.error('Failed to parse JSON:', parseError);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { gameId } = body;
  if (!gameId) {
    console.log('Missing gameId in request');
    return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  }

  try {
    console.log(`Calling sendPotToDeveloper for gameId: ${gameId}`);
    await sendPotToDeveloper(gameId);
    console.log(`Successfully sent pot for gameId: ${gameId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('sendPotToDeveloper error:', error.message, error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}