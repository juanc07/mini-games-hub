import { distributeWinnings } from './solana';
import connectDB from './mongodb';
import GameModel from '../models/Game';

let isProcessing = false; // Simple lock

async function monitorGameCycles() {
  await connectDB();
  const Game = GameModel;

  if (!Game) {
    console.error('Game model is undefined. Check model registration in src/models/Game.ts');
    throw new Error('Game model not initialized');
  }

  console.log('Game cycle monitor started successfully');

  setInterval(async () => {
    if (isProcessing) {
      console.log('Skipping cycle check due to ongoing processing');
      return;
    }

    isProcessing = true;
    try {
      const now = new Date();
      console.log('Checking for expired game cycles at:', now);
      const games = await Game.find({ cycleEndTime: { $lte: now } });

      if (games.length === 0) {
        console.log('No game cycles have ended yet');
      }

      for (const game of games) {
        console.log(`Cycle ended for game ${game.gameId}. Distributing winnings...`);
        await distributeWinnings(game.gameId);

        const newCycleEndTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        await Game.updateOne(
          { gameId: game.gameId },
          { $set: { cycleEndTime: newCycleEndTime } }
        );
        console.log(`New cycle started for ${game.gameId}. Next end: ${newCycleEndTime}`);
      }
    } catch (error) {
      console.error('Error in game cycle monitor:', error);
    } finally {
      isProcessing = false;
    }
  }, 60 * 1000);
}

monitorGameCycles().catch(error => {
  console.error('Failed to start game cycle monitor:', error);
});

export default monitorGameCycles;