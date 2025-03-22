import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  await connectDB();
  const Game = mongoose.models.Game;
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');

  try {
    if (gameId) {
      const game = await Game.findOne({ gameId });
      if (!game) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }
      const now = new Date();
      const timeLeftMs = game.cycleEndTime.getTime() - now.getTime();
      const timeLeftSeconds = Math.max(0, Math.floor(timeLeftMs / 1000));
      return NextResponse.json({
        gameId: game.gameId,
        gameName: game.gameName,
        timeLeft: timeLeftSeconds,
        cycleActive: timeLeftMs > 0,
        currentPot: game.currentPot,
        playerCount: game.playerCount,
      });
    }

    const games = await Game.find();
    const now = new Date();
    const gameStatuses = games.map(game => {
      const timeLeftMs = game.cycleEndTime.getTime() - now.getTime();
      const timeLeftSeconds = Math.max(0, Math.floor(timeLeftMs / 1000));
      return {
        gameId: game.gameId,
        gameName: game.gameName,
        timeLeft: timeLeftSeconds,
        cycleActive: timeLeftMs > 0,
        currentPot: game.currentPot,
        playerCount: game.playerCount,
      };
    });
    return NextResponse.json(gameStatuses);
  } catch (error) {
    console.error('Error fetching game status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}