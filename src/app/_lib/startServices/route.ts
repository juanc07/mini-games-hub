import { NextResponse } from 'next/server';
import monitorGameCycles from '../../../lib/gameCycleService';

// Start the game cycle monitoring service when this file is imported
monitorGameCycles().catch(error => {
  console.error('Failed to start game cycle service:', error);
});

export async function GET() { // Removed req parameter
  // This endpoint is just a placeholder to ensure the file is imported
  return NextResponse.json({ message: 'Service initializer - not meant to be called directly' }); // Cleaned up message
}