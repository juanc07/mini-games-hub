// src/models/Game.ts
import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  gameId: { type: String, required: true, unique: true },
  gameName: { type: String, required: true },
  gamePotPublicKey: { type: String, required: true },
  gamePotSecretKey: { type: [Number], required: true },
  taxPercentage: { type: Number, default: 10 },
  currentPot: { type: Number, default: 0 },
  totalTaxCollected: { type: Number, default: 0 },
  playerCount: { type: Number, default: 0 },
  activePlayers: [{
    userId: { type: String, required: true },
    _id: false // Disable auto-generated _id
  }],
  lastDistribution: { type: Date, default: Date.now },
});

export default mongoose.models.Game || mongoose.model('Game', GameSchema);