import { Connection } from 'mongoose';
import { IGlobalRanking, GlobalRanking } from '../models/GlobalRanking';
import { Play } from '../models/Play';
import { VOTE_FIELDS, PLAY_FIELDS } from '../constants/fieldNames';

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
  
  const completedPlays = await PlayModel.find({
    [PLAY_FIELDS.STATUS]: 'completed',
    votes: { $exists: true, $ne: [] },
    [PLAY_FIELDS.COMPLETED_AT]: { $exists: true }
  })
    .sort({ [PLAY_FIELDS.COMPLETED_AT]: -1 })
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
    eloRatings.set(ranking.cardId, ranking.eloRating || 1000);
    gameStats.set(ranking.cardId, {
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

