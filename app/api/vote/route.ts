import { Card } from '@/models/Card';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';

const K_FACTOR = 32; // ELO rating constant

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

    // Calculate new ratings
    const newRatings = calculateNewRatings(winner.globalScore, loser.globalScore);

    // Update cards with new ratings and increment like/dislike counts
    // Using save() to ensure middlewares run
    winner.globalScore = newRatings.winner;
    winner.likes += 1;
    loser.globalScore = newRatings.loser;
    loser.dislikes += 1;
    
    await Promise.all([
      winner.save(),
      loser.save()
    ]);

    // If projectId is provided, update project-specific rankings
    if (projectId) {
      await Promise.all([
        winner.updateProjectRanking(projectId, loser.projectRankings[0]?.rank || 1500, true),
        loser.updateProjectRanking(projectId, winner.projectRankings[0]?.rank || 1500, false)
      ]);
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
