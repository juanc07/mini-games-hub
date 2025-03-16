// src/models/Distribution.ts
import mongoose, { Schema } from 'mongoose';

const DistributionSchema = new Schema({
  gameId: { type: String, required: true },
  winnerUserId: { type: String, required: true },
  totalPot: { type: Number, required: true },
  tax: { type: Number, required: true },
  winnings: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.models.Distribution || mongoose.model('Distribution', DistributionSchema);