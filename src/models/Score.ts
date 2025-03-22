import mongoose, { Schema, Document } from 'mongoose';

export interface IScore extends Document {
  gameId: string;
  userId: string;
  score: number;
  cycleEnd: Date | null;
}

const ScoreSchema = new Schema<IScore>({
  gameId: { type: String, required: true },
  userId: { type: String, required: true },
  score: { type: Number, required: true },
  cycleEnd: { type: Date, default: null }, // Optional, null for active scores
});

const Score = mongoose.models.Score || mongoose.model<IScore>('Score', ScoreSchema);
export type { IScore as ScoreSchema };
export default Score;