import mongoose from 'mongoose';
import { Session } from './Session';

// Constants
const RECENT_SESSIONS_LIMIT = 100;

const GlobalRankingSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true, index: true },
  totalScore: { type: Number, default: 0, index: -1 }, // Descending for leaderboard
  appearanceCount: { type: Number, default: 0 },
  averageRank: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now, index: true }
});

// Define the interface for the GlobalRanking document
export interface IGlobalRanking extends mongoose.Document {
  cardId: string;
  totalScore: number;
  appearanceCount: number;
  averageRank: number;
  lastUpdated: Date;
}

// Define the interface for the GlobalRanking model with statics
export interface IGlobalRankingModel extends mongoose.Model<IGlobalRanking> {
  calculateRankings(): Promise<void>;
}

// Add methods for tie-breaking and ranking calculation
GlobalRankingSchema.statics.calculateRankings = async function() {
  // Get completed sessions with personal rankings
  const completedSessions = await Session.find({
    status: 'completed',
    personalRanking: { $exists: true, $ne: [] },
    completedAt: { $exists: true }
  })
    .sort({ completedAt: -1 })
    .limit(RECENT_SESSIONS_LIMIT)
    .select('personalRanking completedAt');

  if (completedSessions.length === 0) {
    console.log('No completed sessions found for global ranking calculation');
    return;
  }

  // Calculate points based on rank (Higher rank = more points)
  // 1st place gets most points, decreasing for lower ranks
  const pointsMap = new Map();
  const appearanceMap = new Map();
  const totalRankMap = new Map();

  completedSessions.forEach(session => {
    const personalRanking = session.personalRanking;
    if (!personalRanking || personalRanking.length === 0) return;

    personalRanking.forEach((cardId: string, index: number) => {
      // Points decrease with rank position (1st = highest points)
      const rank = index + 1;
      const points = Math.max(1, personalRanking.length - index); // Decreasing points
      
      // Accumulate data
      pointsMap.set(cardId, (pointsMap.get(cardId) || 0) + points);
      appearanceMap.set(cardId, (appearanceMap.get(cardId) || 0) + 1);
      totalRankMap.set(cardId, (totalRankMap.get(cardId) || 0) + rank);
    });
  });

  // Calculate average ranks
  const avgRankMap = new Map();
  for (const [cardId, totalRank] of totalRankMap) {
    const appearances = appearanceMap.get(cardId) || 1;
    avgRankMap.set(cardId, totalRank / appearances);
  }

  // Create bulk operations to update global rankings
  const bulkOps = Array.from(pointsMap.entries()).map(([cardId, totalScore]) => ({
    updateOne: {
      filter: { cardId },
      update: {
        $set: {
          totalScore,
          appearanceCount: appearanceMap.get(cardId) || 0,
          averageRank: avgRankMap.get(cardId) || 0,
          lastUpdated: new Date()
        }
      },
      upsert: true
    }
  }));

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
    console.log(`Updated ${bulkOps.length} cards in global rankings from ${completedSessions.length} sessions`);
  }
};

GlobalRankingSchema.methods.compareWith = function(other: IGlobalRanking): number {
  // Primary: Total score
  if (this.totalScore !== other.totalScore) {
    return other.totalScore - this.totalScore;
  }
  
  // Secondary: Average rank (lower is better)
  if (this.averageRank !== other.averageRank) {
    return this.averageRank - other.averageRank;
  }
  
  // Tertiary: More recent wins
  if (this.lastUpdated.getTime() !== other.lastUpdated.getTime()) {
    return other.lastUpdated.getTime() - this.lastUpdated.getTime();
  }
  
  // Final fallback: UUID comparison
  return this.cardId.localeCompare(other.cardId);
};

// Export both the model and its interface
export const GlobalRanking = (mongoose.models.GlobalRanking || mongoose.model<IGlobalRanking, IGlobalRankingModel>('GlobalRanking', GlobalRankingSchema)) as IGlobalRankingModel;
