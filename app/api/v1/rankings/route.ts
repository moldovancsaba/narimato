import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db'
import { PersonalRanking } from '@/app/lib/models/PersonalRanking';
import { RankingEntity } from '@/app/lib/models/RankingEntity';
import { Card } from '@/app/lib/types/card';

// Get personal ranking for a session
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');

  if (!sessionId || !userId) {
    return NextResponse.json(
      { error: 'Missing sessionId or userId' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    const ranking = await PersonalRanking.findOne({ sessionId, userId });
    if (!ranking) {
      return NextResponse.json(
        { error: 'Ranking not found' },
        { status: 404 }
      );
    }

    // Convert to RankingDeck and get ordered cards
    const deck = ranking.toRankingDeck();
    
    return NextResponse.json({
      sessionId,
      userId,
      completed: ranking.completed,
      rankedCards: deck.getRankedCards(),
      votes: ranking.votes
    });

  } catch (error) {
    console.error('Failed to get ranking:', error);
    return NextResponse.json(
      { error: 'Failed to get ranking' },
      { status: 500 }
    );
  }
}

// Create or update personal ranking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, userId, card, rank } = body;

    if (!sessionId || !userId || !card) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find or create ranking
    let ranking = await PersonalRanking.findOne({ sessionId, userId });
    if (!ranking) {
      ranking = new PersonalRanking({
        sessionId,
        userId,
        rankedCards: []
      });
    }

    // Convert to deck, update, and save back
    const deck = ranking.toRankingDeck();
    
    if (typeof rank === 'number') {
      // Insert at specific rank if provided
      deck.insertAt(card, rank);
    } else {
      // Otherwise find position through comparisons
      deck.insertWithComparison(card, (a: Card, b: Card) => {
        const previousVote = ranking.votes.find((v: { cardA: string; cardB: string; winner: string }) =>
          (v.cardA === a.uuid && v.cardB === b.uuid) ||
          (v.cardA === b.uuid && v.cardB === a.uuid)
        );
        return previousVote?.winner === a.uuid || false;
      });
    }

    ranking.fromRankingDeck(deck);
    await ranking.save();

    return NextResponse.json({
      sessionId,
      userId,
      rankedCards: deck.getRankedCards()
    });

  } catch (error) {
    console.error('Failed to update ranking:', error);
    return NextResponse.json(
      { error: 'Failed to update ranking' },
      { status: 500 }
    );
  }
}
