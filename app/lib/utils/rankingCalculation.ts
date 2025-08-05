import { Connection } from 'mongoose';
import { IGlobalRanking, GlobalRanking } from '../models/GlobalRanking';
import { Play } from '../models/Play';
import { VOTE_FIELDS } from '../constants/fieldNames';

// Helper function to calculate expected score in ELO system
const calculateExpectedScore = (ratingA: number, ratingB: number): number => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

// Helper function to update ELO ratings
const updateEloRating = (
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = 32
): number => {
  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
};

export const calculateRankingsWithConnection = async (connection: Connection) => {
  console.log('🎯 Starting ELO-based global ranking calculation with connection...');
  const startTime = Date.now();

  const PlayModel = connection.model('Play', Play.schema);
  const GlobalRankingModel = connection.model<IGlobalRanking>('GlobalRanking', GlobalRanking.schema);
  
  // Handle schema migration from cardId to cardUUID
  try {
    // First, check and drop the old cardId index if it exists
    try {
      const indexes = await GlobalRankingModel.collection.indexes();
      const hasOldCardIdIndex = indexes.some(index => 
        index.key && (index.key.cardId !== undefined || index.name === 'cardId_1')
      );
      
      if (hasOldCardIdIndex) {
        console.log('🔄 Schema migration: Dropping old cardId index...');
        await GlobalRankingModel.collection.dropIndex('cardId_1');
        console.log('✅ Old cardId index dropped successfully');
      }
    } catch (indexError) {
      console.log('ℹ️ Note: Could not drop old index (may not exist):', indexError.message);
    }
    
    // Clear any existing documents to start fresh with new schema
    const existingCount = await GlobalRankingModel.countDocuments({});
    if (existingCount > 0) {
      console.log(`🔄 Schema migration: Clearing ${existingCount} existing ranking documents to rebuild with new schema...`);
      await GlobalRankingModel.deleteMany({});
      console.log('✅ Old ranking data cleared, will rebuild from vote data');
    }
    
    // Ensure the new cardUUID index exists
    try {
      await GlobalRankingModel.collection.createIndex({ cardUUID: 1 }, { unique: true });
      console.log('✅ New cardUUID index created successfully');
    } catch (indexCreateError) {
      console.log('ℹ️ Note: cardUUID index may already exist:', indexCreateError.message);
    }
  } catch (migrationError) {
    console.log('🔄 Schema migration: Performing full collection reset due to migration issues...');
    try {
      await GlobalRankingModel.collection.drop();
      console.log('✅ Collection dropped and will be recreated with new schema');
    } catch (dropError) {
      console.warn('⚠️ Could not drop collection, continuing with fresh calculation...');
    }
  }
  
  const completedPlays = await PlayModel.find({
    status: 'completed',
    votes: { $exists: true, $ne: [] },
    completedAt: { $exists: true }
  })
    .sort({ completedAt: -1 })
    .limit(500)
    .select('votes completedAt');

  if (completedPlays.length === 0) {
    console.log('No completed plays with votes found for ELO calculation with connection');
    return;
  }

  const existingRankings = await GlobalRankingModel.find({});
  const eloRatings = new Map<string, number>();
  const gameStats = new Map<string, { wins: number; losses: number; totalGames: number }>();

  // Initialize with existing ratings or defaults
  existingRankings.forEach((ranking) => {
    eloRatings.set(ranking.cardUUID, ranking.eloRating || 1000);
    gameStats.set(ranking.cardUUID, {
      wins: ranking.wins || 0,
      losses: ranking.losses || 0,
      totalGames: ranking.totalGames || 0
    });
  });

  // Process all votes to update ELO ratings
  const allVotes: Array<{ cardA: string; cardB: string; winner: string; timestamp: Date }> = [];

  completedPlays.forEach((play) => {
    if (play.votes && Array.isArray(play.votes)) {
      play.votes.forEach((vote: any) => {
        if (vote[VOTE_FIELDS.CARD_A] && vote[VOTE_FIELDS.CARD_B] && vote[VOTE_FIELDS.WINNER]) {
          if (vote[VOTE_FIELDS.WINNER] === vote[VOTE_FIELDS.CARD_A] || vote[VOTE_FIELDS.WINNER] === vote[VOTE_FIELDS.CARD_B]) {
            allVotes.push({
              cardA: vote[VOTE_FIELDS.CARD_A],
              cardB: vote[VOTE_FIELDS.CARD_B],
              winner: vote[VOTE_FIELDS.WINNER],
              timestamp: vote[VOTE_FIELDS.TIMESTAMP] || play.completedAt
            });
          }
        }
      });
    }
  });

  allVotes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  allVotes.forEach(vote => {
    const { cardA, cardB, winner } = vote;

    if (!eloRatings.has(cardA)) {
      eloRatings.set(cardA, 1000);
      gameStats.set(cardA, { wins: 0, losses: 0, totalGames: 0 });
    }
    if (!eloRatings.has(cardB)) {
      eloRatings.set(cardB, 1000);
      gameStats.set(cardB, { wins: 0, losses: 0, totalGames: 0 });
    }

    const ratingA = eloRatings.get(cardA)!;
    const ratingB = eloRatings.get(cardB)!;
    const statsA = gameStats.get(cardA)!;
    const statsB = gameStats.get(cardB)!;

    const expectedA = calculateExpectedScore(ratingA, ratingB);
    const expectedB = calculateExpectedScore(ratingB, ratingA);

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
      actualA = 0.5;
      actualB = 0.5;
    }

    statsA.totalGames++;
    statsB.totalGames++;

    eloRatings.set(cardA, updateEloRating(ratingA, expectedA, actualA));
    eloRatings.set(cardB, updateEloRating(ratingB, expectedB, actualB));
  });

  const bulkOps = Array.from(eloRatings.entries()).map(([cardUUID, eloRating]) => {
    const stats = gameStats.get(cardUUID) || { wins: 0, losses: 0, totalGames: 0 };
    const winRate = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;

    return {
      updateOne: {
        filter: { cardUUID },
        update: {
          $set: {
            eloRating,
            wins: stats.wins,
            losses: stats.losses,
            totalGames: stats.totalGames,
            winRate: Math.round(winRate * 1000) / 1000,
            lastUpdated: new Date()
          }
        },
        upsert: true
      }
    };
  });

  if (bulkOps.length > 0) {
    await GlobalRankingModel.bulkWrite(bulkOps);
    console.log(`✅ Updated ELO ratings for ${bulkOps.length} cards based on ${allVotes.length} votes`);
  } else {
    console.log('⚠️ No cards to update ELO ratings');
  }

  console.log(`⏱️ Ranking calculation completed in ${Date.now() - startTime}ms`);
  return {
    success: true
  };
};

