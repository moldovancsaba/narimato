import mongoose from 'mongoose';
import { Session } from './Session';
import { VOTE_FIELDS } from '../constants/fieldNames';

// Constants
const RECENT_SESSIONS_LIMIT = 500; // Increased for better ELO accuracy
const DEFAULT_ELO_RATING = 1000; // Starting ELO rating for new cards
const K_FACTOR = 32; // ELO K-factor (higher = more volatile ratings)

const GlobalRankingSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true, index: true },
  eloRating: { type: Number, default: DEFAULT_ELO_RATING, index: -1 }, // Primary ranking metric
  totalScore: { type: Number, default: 0 }, // Legacy metric (kept for compatibility)
  appearanceCount: { type: Number, default: 0 },
  averageRank: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  totalGames: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now, index: true }
});

// Define the interface for the GlobalRanking document
export interface IGlobalRanking extends mongoose.Document {
  cardId: string;
  eloRating: number;
  totalScore: number;
  appearanceCount: number;
  averageRank: number;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  lastUpdated: Date;
}

// Define the interface for the GlobalRanking model with statics
export interface IGlobalRankingModel extends mongoose.Model<IGlobalRanking> {
  calculateRankings(): Promise<void>;
}

// Helper function to calculate expected score in ELO system
function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Helper function to update ELO rating
function updateEloRating(currentRating: number, expectedScore: number, actualScore: number, kFactor: number = K_FACTOR): number {
  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
}

// Add methods for ELO-based ranking calculation
GlobalRankingSchema.statics.calculateRankings = async function() {
  console.log('Starting ELO-based global ranking calculation...');
  
  // Get completed sessions with votes
  const completedSessions = await Session.find({
    status: 'completed',
    votes: { $exists: true, $ne: [] },
    completedAt: { $exists: true }
  })
    .sort({ completedAt: -1 })
    .limit(RECENT_SESSIONS_LIMIT)
    .select('votes completedAt');

  if (completedSessions.length === 0) {
    console.log('No completed sessions with votes found for ELO calculation');
    return;
  }

  console.log(`Processing ${completedSessions.length} completed sessions for ELO calculation`);

  // Get all existing rankings to start with current ELO ratings
  const existingRankings = await this.find({});
  const eloRatings = new Map<string, number>();
  const gameStats = new Map<string, { wins: number; losses: number; totalGames: number }>();

  // Initialize with existing ratings or default
  existingRankings.forEach((ranking: IGlobalRanking) => {
    eloRatings.set(ranking.cardId, ranking.eloRating || DEFAULT_ELO_RATING);
    gameStats.set(ranking.cardId, {
      wins: ranking.wins || 0,
      losses: ranking.losses || 0,
      totalGames: ranking.totalGames || 0
    });
  });

  // Process all votes to update ELO ratings
  const allVotes: Array<{ cardA: string; cardB: string; winner: string; timestamp: Date }> = [];
  
  completedSessions.forEach(session => {
    if (session.votes && Array.isArray(session.votes)) {
      session.votes.forEach((vote: any) => {
        if (vote[VOTE_FIELDS.CARD_A] && vote[VOTE_FIELDS.CARD_B] && vote[VOTE_FIELDS.WINNER]) {
          allVotes.push({
            cardA: vote[VOTE_FIELDS.CARD_A],
            cardB: vote[VOTE_FIELDS.CARD_B],
            winner: vote[VOTE_FIELDS.WINNER],
            timestamp: vote[VOTE_FIELDS.TIMESTAMP] || session.completedAt
          });
        }
      });
    }
  });

  // Sort votes by timestamp to process them chronologically
  allVotes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`Processing ${allVotes.length} votes for ELO updates`);

  // Process each vote to update ELO ratings
  allVotes.forEach(vote => {
    const { cardA, cardB, winner } = vote;
    
    // Initialize ratings if not present
    if (!eloRatings.has(cardA)) {
      eloRatings.set(cardA, DEFAULT_ELO_RATING);
      gameStats.set(cardA, { wins: 0, losses: 0, totalGames: 0 });
    }
    if (!eloRatings.has(cardB)) {
      eloRatings.set(cardB, DEFAULT_ELO_RATING);
      gameStats.set(cardB, { wins: 0, losses: 0, totalGames: 0 });
    }

    const ratingA = eloRatings.get(cardA)!;
    const ratingB = eloRatings.get(cardB)!;
    const statsA = gameStats.get(cardA)!;
    const statsB = gameStats.get(cardB)!;

    // Calculate expected scores
    const expectedA = calculateExpectedScore(ratingA, ratingB);
    const expectedB = calculateExpectedScore(ratingB, ratingA);

    // Determine actual scores (1 for win, 0 for loss)
    let actualA: number, actualB: number;
    if (winner === cardA) {
      actualA = 1;
      actualB = 0;
      statsA.wins++;
      statsB.losses++;
    } else if (winner === cardB) {
      actualA = 0;
      actualB = 1;
      statsA.losses++;
      statsB.wins++;
    } else {
      // Handle tie case (though unlikely in this system)
      actualA = 0.5;
      actualB = 0.5;
    }

    // Update game counts
    statsA.totalGames++;
    statsB.totalGames++;

    // Update ELO ratings
    const newRatingA = updateEloRating(ratingA, expectedA, actualA);
    const newRatingB = updateEloRating(ratingB, expectedB, actualB);

    eloRatings.set(cardA, newRatingA);
    eloRatings.set(cardB, newRatingB);
  });

  // Prepare bulk operations to update all rankings
  const bulkOps = Array.from(eloRatings.entries()).map(([cardId, eloRating]) => {
    const stats = gameStats.get(cardId) || { wins: 0, losses: 0, totalGames: 0 };
    const winRate = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;
    
    return {
      updateOne: {
        filter: { cardId },
        update: {
          $set: {
            eloRating,
            wins: stats.wins,
            losses: stats.losses,
            totalGames: stats.totalGames,
            winRate: Math.round(winRate * 1000) / 1000, // Round to 3 decimal places
            lastUpdated: new Date()
          }
        },
        upsert: true
      }
    };
  });

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
    console.log(`Updated ELO ratings for ${bulkOps.length} cards based on ${allVotes.length} votes from ${completedSessions.length} sessions`);
    
    // Log some statistics
    const ratings = Array.from(eloRatings.values());
    const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    
    console.log(`ELO Statistics - Avg: ${Math.round(avgRating)}, Min: ${minRating}, Max: ${maxRating}`);
  } else {
    console.log('No cards found to update ELO ratings');
  }
};

GlobalRankingSchema.methods.compareWith = function(other: IGlobalRanking): number {
  // Primary: ELO rating (higher is better)
  if (this.eloRating !== other.eloRating) {
    return other.eloRating - this.eloRating;
  }
  
  // Secondary: Win rate (higher is better)
  if (this.winRate !== other.winRate) {
    return other.winRate - this.winRate;
  }
  
  // Tertiary: Total games played (more games = more reliable rating)
  if (this.totalGames !== other.totalGames) {
    return other.totalGames - this.totalGames;
  }
  
  // Quaternary: More recent activity
  if (this.lastUpdated.getTime() !== other.lastUpdated.getTime()) {
    return other.lastUpdated.getTime() - this.lastUpdated.getTime();
  }
  
  // Final fallback: UUID comparison for consistency
  return this.cardId.localeCompare(other.cardId);
};

// Export both the model and its interface
export const GlobalRanking = (mongoose.models.GlobalRanking || mongoose.model<IGlobalRanking, IGlobalRankingModel>('GlobalRanking', GlobalRankingSchema)) as IGlobalRankingModel;
