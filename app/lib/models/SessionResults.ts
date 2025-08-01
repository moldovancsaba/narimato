import mongoose from 'mongoose';

const SessionResultsSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  personalRanking: [{
    cardId: { type: String, required: true },
    card: {
      uuid: { type: String, required: true },
      type: { type: String, enum: ['text', 'media'], required: true },
      content: {
        text: { type: String },
        mediaUrl: { type: String }
      },
      title: { type: String }
    },
    rank: { type: Number, required: true }
  }],
  sessionStatistics: {
    totalCards: { type: Number, default: 0 },
    cardsRanked: { type: Number, default: 0 },
    cardsDiscarded: { type: Number, default: 0 },
    totalSwipes: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Define the interface for the SessionResults document
export interface ISessionResults extends mongoose.Document {
  sessionId: string;
  personalRanking: Array<{
    cardId: string;
    card: {
      uuid: string;
      type: 'text' | 'media';
      content: {
        text?: string;
        mediaUrl?: string;
      };
      title?: string;
    };
    rank: number;
  }>;
  sessionStatistics: {
    totalCards: number;
    cardsRanked: number;
    cardsDiscarded: number;
    totalSwipes: number;
    totalVotes: number;
    completionRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Index for better query performance
SessionResultsSchema.index({ sessionId: 1, createdAt: -1 });

// Update the updatedAt field before saving
SessionResultsSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

export const SessionResults = (mongoose.models.SessionResults || 
  mongoose.model<ISessionResults>('SessionResults', SessionResultsSchema)) as mongoose.Model<ISessionResults>;
