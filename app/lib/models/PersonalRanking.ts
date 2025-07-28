import mongoose from 'mongoose';

const PersonalRankingSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  ranking: [{ type: String }], // Top 10 cards only for global calculation
  completedAt: { type: Date, default: Date.now, index: true },
  contributedToGlobal: { type: Boolean, default: false, index: true }
});

// Compound index for global ranking calculations
PersonalRankingSchema.index({ contributedToGlobal: 1, completedAt: -1 });

// Define the interface for the PersonalRanking document
export interface IPersonalRanking extends mongoose.Document {
  sessionId: string;
  ranking: string[];
  completedAt: Date;
  contributedToGlobal: boolean;
}

// Export both the model and its interface
export const PersonalRanking = mongoose.models.PersonalRanking || mongoose.model<IPersonalRanking>('PersonalRanking', PersonalRankingSchema);
