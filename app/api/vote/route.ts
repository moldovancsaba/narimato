import { Card } from '@/models/Card';
import { NextResponse } from 'next/server';

const K_FACTOR = 32; // ELO rating constant

function calculateNewRatings(winnerRating: number, loserRating: number) {
  const expectedWinnerScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoserScore = 1 - expectedWinnerScore;

  const newWinnerRating = winnerRating + K_FACTOR * (1 - expectedWinnerScore);
  const newLoserRating = loserRating + K_FACTOR * (0 - expectedLoserScore);

  return {
    winner: Math.round(newWinnerRating),
    loser: Math.round(newLoserRating),
  };
}

export async function POST(request: Request) {
  try {
    const { winnerId, loserId } = await request.json();

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
    const newRatings = calculateNewRatings(winner.rank, loser.rank);

    // Update cards with new ratings and increment like/dislike counts
    await Promise.all([
      Card.findByIdAndUpdate(winnerId, {
        $set: { rank: newRatings.winner },
        $inc: { likes: 1 },
      }),
      Card.findByIdAndUpdate(loserId, {
        $set: { rank: newRatings.loser },
        $inc: { dislikes: 1 },
      }),
    ]);

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
