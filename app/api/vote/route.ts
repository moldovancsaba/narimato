import { Card } from '@/models/Card';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';

const K_FACTOR = 32; // ELO rating constant

/**
 * Calculates project-specific ELO ratings for winner and loser cards
 * using the ELO rating system adapted for project rankings.
 * 
 * @param winnerRankings - Array of project rankings for the winner card
 * @param loserRankings - Array of project rankings for the loser card
 * @param projectId - ID of the project to calculate rankings for
 * @returns Object containing new ELO ratings for winner and loser
 */
function calculateProjectRatings(
  winnerRankings: Array<{ projectId: string; rank: number }>,
  loserRankings: Array<{ projectId: string; rank: number }>,
  projectId: string
) {
  // Get current project rankings or use default starting rank (1500)
  const winnerRank = winnerRankings.find(r => r.projectId === projectId)?.rank || 1500;
  const loserRank = loserRankings.find(r => r.projectId === projectId)?.rank || 1500;

  // Calculate expected win probabilities using ELO formula
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRank - winnerRank) / 400));
  const expectedLoser = 1 - expectedWinner;

  // Calculate new ratings with K-factor weight
  return {
    winner: Math.round(winnerRank + K_FACTOR * (1 - expectedWinner)),
    loser: Math.round(loserRank + K_FACTOR * (0 - expectedLoser))
  };
}

function calculateNewRatings(winnerRating: number, loserRating: number) {
  const K_FACTOR = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  return {
    winner: Math.round(winnerRating + K_FACTOR * (1 - expectedWinner)),
    loser: Math.round(loserRating + K_FACTOR * (0 - expectedLoser))
  };
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Card model is already initialized via import
    const { winnerId, loserId, projectId } = await request.json();

    if (!winnerId || !loserId) {
      return NextResponse.json(
        { error: 'Winner and loser IDs are required' },
        { status: 400 }
      );
    }

    // Validate projectId if provided
    if (projectId && !mongoose.isValidObjectId(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID format' },
        { status: 400 }
      );
    }

    // Get current ratings
    const [winner, loser] = await Promise.all([
      Card.findById(winnerId),
      Card.findById(loserId),
    ]);

    if (!winner || !loser) {
      return NextResponse.json(
        { error: 'One or both cards not found' },
        { status: 404 }
      );
    }

    // Calculate new global ratings
    const newRatings = calculateNewRatings(winner.globalScore, loser.globalScore);

    // Update cards with new global ratings and increment like/dislike counts
    // Using save() to ensure middlewares run
    winner.globalScore = newRatings.winner;
    winner.likes += 1;
    loser.globalScore = newRatings.loser;
    loser.dislikes += 1;

    await Promise.all([
      winner.save(),
      loser.save()
    ]);

    // Calculate new project-specific ratings if projectId provided
    if (projectId) {
      try {
        const projectRatings = calculateProjectRatings(
          winner.projectRankings,
          loser.projectRankings,
          projectId
        );
        // Update project rankings
        await Promise.all([
          winner.updateProjectRanking(projectId, projectRatings.winner),
          loser.updateProjectRanking(projectId, projectRatings.loser)
        ]);
      } catch (err) {
        console.error('Error updating project rankings:', err);
        return NextResponse.json(
          { error: 'Failed to update project rankings' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      message: 'Vote recorded successfully',
      newRatings,
    });
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}
