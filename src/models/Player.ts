// src/models/Player.ts
import mongoose, { Schema } from 'mongoose';

const PlayerSchema = new Schema({
  userId: { type: String, required: true, unique: true }, // Solana wallet address
  totalBets: { type: Number, default: 0 }, // Cumulative bets in lamports
  totalWinnings: { type: Number, default: 0 }, // Cumulative winnings in lamports
});

export default mongoose.models.Player || mongoose.model('Player', PlayerSchema);