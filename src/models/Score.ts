// src/models/Score.ts
import mongoose, { Schema } from 'mongoose';

const ScoreSchema = new Schema({
  gameId: { type: String, required: true },
  userId: { type: String, required: true },
  score: { type: Number, required: true },
  cycleEnd: { type: Date, default: null }, // Optional, null for active scores
});

export default mongoose.models.Score || mongoose.model('Score', ScoreSchema);