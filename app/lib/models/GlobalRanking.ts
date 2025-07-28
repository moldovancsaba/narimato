import mongoose from 'mongoose';

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

// Add methods for tie-breaking and ranking calculation
GlobalRankingSchema.statics.calculateRankings = async function() {
  // Get last 100 completed sessions
  const recentRankings = await mongoose.model('PersonalRanking')
    .find({ contributedToGlobal: false, completedAt: { $exists: true } })
    .sort({ completedAt: -1 })
    .limit(RECENT_SESSIONS_LIMIT);

  // Calculate points based on rank (10 points for 1st, 9 for 2nd, etc.)
  const pointsMap = new Map();
  const appearanceMap = new Map();
  const avgRankMap = new Map();

  recentRankings.forEach(ranking => {
ranking.ranking.forEach((cardId: string, index: number) => {
      if (index < 10) { // Only top 10 get points
        const points = 10 - index;
        pointsMap.set(cardId, (pointsMap.get(cardId) || 0) + points);
        appearanceMap.set(cardId, (appearanceMap.get(cardId) || 0) + 1);
        avgRankMap.set(cardId, (avgRankMap.get(cardId) || 0) + index + 1);
      }
    });
  });

  // Calculate average ranks
  for (const [cardId, totalRank] of avgRankMap) {
    const appearances = appearanceMap.get(cardId) || 1;
    avgRankMap.set(cardId, totalRank / appearances);
  }

  // Update all rankings
  const bulkOps = Array.from(pointsMap.entries()).map(([cardId, totalScore]) => ({
    updateOne: {
      filter: { cardId },
      update: {
        $set: {
          totalScore,
          appearanceCount: appearanceMap.get(cardId) || 0,
          averageRank: avgRankMap.get(cardId) || 0,
          lastUpdated: new Date().toISOString()
        }
      },
      upsert: true
    }
  }));

  await this.bulkWrite(bulkOps);

  // Mark processed rankings as contributed
  await mongoose.model('PersonalRanking').updateMany(
    { _id: { $in: recentRankings.map(r => r._id) } },
    { $set: { contributedToGlobal: true } }
  );
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
export const GlobalRanking = mongoose.models.GlobalRanking || mongoose.model<IGlobalRanking>('GlobalRanking', GlobalRankingSchema);
