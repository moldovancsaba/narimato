import { Card } from '@/models/Card';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';

const logger = createLogger('vote-service');

const K_FACTOR = 32; // ELO rating constant
const INITIAL_RATING = 1500; // Starting ELO rating for new cards/projects

interface EloRatings {
  winner: number;
  loser: number;
  winnerVotes?: number;
  loserVotes?: number;
}

/**
 * Calculates ELO ratings for both winner and loser
 * @param winnerRating Current rating of the winner
 * @param loserRating Current rating of the loser
 * @param winnerVotes Optional number of votes for winner (for K-factor adjustment)
 * @param loserVotes Optional number of votes for loser (for K-factor adjustment)
 * @returns Object containing new ELO ratings for winner and loser
 */
function calculateEloRatings(
  winnerRating: number,
  loserRating: number,
  winnerVotes?: number,
  loserVotes?: number
): EloRatings {
  // Adjust K-factor based on number of votes (more votes = lower K-factor)
  const getAdjustedK = (votes?: number) => {
    if (!votes) return K_FACTOR;
    return Math.max(K_FACTOR / (1 + Math.log(votes + 1)), K_FACTOR / 4);
  };

  const winnerK = getAdjustedK(winnerVotes);
  const loserK = getAdjustedK(loserVotes);

  // Calculate expected probabilities
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  // Calculate new ratings with adjusted K-factors
  return {
    winner: Math.round(winnerRating + winnerK * (1 - expectedWinner)),
    loser: Math.round(loserRating + loserK * (0 - expectedLoser)),
    winnerVotes,
    loserVotes
  };
}

/**
 * Calculates project-specific ELO ratings for winner and loser cards
 * @param winnerRankings Array of project rankings for the winner card
 * @param loserRankings Array of project rankings for the loser card
 * @param projectId ID of the project to calculate rankings for
 * @returns Object containing new ELO ratings for winner and loser
 */
function calculateProjectRatings(
  winnerRankings: Array<{ projectId: string; rank: number; votes?: number }>,
  loserRankings: Array<{ projectId: string; rank: number; votes?: number }>,
  projectId: string
): EloRatings {
  // Get current project rankings or use default starting rank
  const winnerRanking = winnerRankings.find(r => r.projectId === projectId);
  const loserRanking = loserRankings.find(r => r.projectId === projectId);

  return calculateEloRatings(
    winnerRanking?.rank || INITIAL_RATING,
    loserRanking?.rank || INITIAL_RATING,
    winnerRanking?.votes,
    loserRanking?.votes
  );
}

export type VoteData = {
  winnerId: string;
  loserId: string;
  projectId?: string;
};

export async function recordVoteInDb(voteData: VoteData) {
  try {
    logger.info('Database connection initiated');
    await dbConnect();
    logger.info('Database connection successful');
    
    const { winnerId, loserId, projectId } = voteData;

    // Validate projectId if provided
    if (projectId && !mongoose.isValidObjectId(projectId)) {
      throw new Error('Invalid project ID format');
    }

    // Get current ratings
    const [winner, loser] = await Promise.all([
      Card.findById(winnerId),
      Card.findById(loserId),
    ]);

    if (!winner || !loser) {
      throw new Error('One or both cards not found');
    }

    // Calculate new global ratings using total votes for K-factor adjustment
    const globalRatings = calculateEloRatings(
      winner.globalScore,
      loser.globalScore,
      winner.likes + winner.dislikes,
      loser.likes + loser.dislikes
    );

    // Update cards with new global ratings and increment like/dislike counts
    winner.globalScore = globalRatings.winner;
    winner.likes += 1;
    loser.globalScore = globalRatings.loser;
    loser.dislikes += 1;

    // Calculate new project-specific ratings if projectId provided
    if (projectId) {
      // Ensure project rankings arrays exist
      winner.projectRankings = winner.projectRankings || [];
      loser.projectRankings = loser.projectRankings || [];
      
      const projectRatings = calculateProjectRatings(
        winner.projectRankings,
        loser.projectRankings,
        projectId
      );

      // Update project rankings for both cards
      const winnerRanking = winner.projectRankings.find((r: { projectId: string }) => r.projectId === projectId);
      const loserRanking = loser.projectRankings.find((r: { projectId: string }) => r.projectId === projectId);

      if (!winnerRanking) {
        winner.projectRankings.push({
          projectId,
          rank: projectRatings.winner,
          votes: 1,
          lastVotedAt: new Date()
        });
      } else {
        winnerRanking.rank = projectRatings.winner;
        winnerRanking.votes = (winnerRanking.votes || 0) + 1;
        winnerRanking.lastVotedAt = new Date();
      }

      if (!loserRanking) {
        loser.projectRankings.push({
          projectId,
          rank: projectRatings.loser,
          votes: 1,
          lastVotedAt: new Date()
        });
      } else {
        loserRanking.rank = projectRatings.loser;
        loserRanking.votes = (loserRanking.votes || 0) + 1;
        loserRanking.lastVotedAt = new Date();
      }
    }

    // Save both cards with their updated rankings
    await Promise.all([
      winner.save(),
      loser.save()
    ]);

    logger.info('Vote recorded successfully in database', { 
      winnerId: voteData.winnerId,
      loserId: voteData.loserId,
      projectId: voteData.projectId
    });

    return {
      globalRatings: {
        winner: globalRatings.winner,
        loser: globalRatings.loser
      },
      projectRatings: projectId ? {
        winner: winner.projectRankings.find((r: { projectId: string }) => r.projectId === projectId)?.rank,
        loser: loser.projectRankings.find((r: { projectId: string }) => r.projectId === projectId)?.rank
      } : undefined
    };
  } catch (error) {
    logger.error('Vote recording failed in database', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      voteData
    });
    throw error;
  }
}
