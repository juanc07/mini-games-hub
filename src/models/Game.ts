import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  gameId: string;
  gameName: string;
  gamePotPublicKey: string;
  gamePotSecretKey: string;
  taxPercentage: number;
  currentPot: number;
  totalTaxCollected: number;
  playerCount: number;
  activePlayers: Array<{
    userId: string;
  }>;
  lastDistribution: Date;
  cycleEndTime: Date; // Added for cycle monitoring
}

const GameSchema = new Schema<IGame>({
  gameId: { type: String, required: true, unique: true },
  gameName: { type: String, required: true },
  gamePotPublicKey: { type: String, required: true },
  gamePotSecretKey: { type: String, required: true },
  taxPercentage: { type: Number, default: 10 },
  currentPot: { type: Number, default: 0 },
  totalTaxCollected: { type: Number, default: 0 },
  playerCount: { type: Number, default: 0 },
  activePlayers: [{
    userId: { type: String, required: true },
    _id: false // Disable auto-generated _id for subdocuments
  }],
  lastDistribution: { type: Date, default: Date.now },
  cycleEndTime: { 
    type: Date, 
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from creation
    required: true 
  },
});

const Game = mongoose.models.Game || mongoose.model<IGame>('Game', GameSchema);
export type { IGame as GameSchema };
export default Game;