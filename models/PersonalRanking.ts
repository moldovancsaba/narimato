import mongoose, { Schema, Document } from 'mongoose';

interface IPersonalRankingEntry {
  cardId: string;
  rank: number;
  lastVotedAt: Date;
}

export interface IPersonalRanking extends Document {
  rankings: IPersonalRankingEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const PersonalRankingEntrySchema = new Schema<IPersonalRankingEntry>(
  {
    cardId: {
      type: String,
      required: true,
      ref: 'Card',
    },
    rank: {
      type: Number,
      required: true,
      default: 1500, // Start with neutral ELO ranking
    },
    lastVotedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const PersonalRankingSchema = new Schema<IPersonalRanking>(
  {
    rankings: [PersonalRankingEntrySchema],
  },
  { timestamps: true }
);

export const PersonalRanking = mongoose.models.PersonalRanking || mongoose.model<IPersonalRanking>('PersonalRanking', PersonalRankingSchema);
