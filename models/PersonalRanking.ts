import mongoose, { Schema, Document } from 'mongoose';

interface IPersonalRankingEntry {
  cardId: string;
  rank: number;
  lastVotedAt: Date;
}

export interface IPersonalRanking extends Document {
  sessionId: string;
  projectId?: string;
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
    sessionId: {
      type: String,
      required: true,
    },
    projectId: {
      type: String,
      ref: 'Project',
    },
    rankings: [PersonalRankingEntrySchema],
  },
  { timestamps: true }
);

// Create TTL index programmatically
PersonalRankingSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

// Create compound index for efficient lookups
PersonalRankingSchema.index({ sessionId: 1, projectId: 1 });

export const PersonalRanking = mongoose.models.PersonalRanking || mongoose.model<IPersonalRanking>('PersonalRanking', PersonalRankingSchema);
