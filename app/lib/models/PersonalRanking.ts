import mongoose from 'mongoose';
import { SESSION_FIELDS } from '../constants/fieldNames';

const PersonalRankingSchema = new mongoose.Schema({
  [SESSION_FIELDS.UUID]: { type: String, required: true, index: true },
  ranking: [{ type: String }], // Card rankings that contribute to ELO-based global calculations
  completedAt: { type: Date, default: Date.now, index: true },
  contributedToGlobal: { type: Boolean, default: false, index: true }
});

// Compound index for global ranking calculations
PersonalRankingSchema.index({ contributedToGlobal: 1, completedAt: -1 });

// Define the interface for the PersonalRanking document
export interface IPersonalRanking extends mongoose.Document {
  [SESSION_FIELDS.UUID]: string;
  ranking: string[];
  completedAt: Date;
  contributedToGlobal: boolean;
}

// Export both the model and its interface
export const PersonalRanking = mongoose.models.PersonalRanking || mongoose.model<IPersonalRanking>('PersonalRanking', PersonalRankingSchema);
