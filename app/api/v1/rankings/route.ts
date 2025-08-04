import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { PersonalRanking } from '@/app/lib/models/PersonalRanking';
import { RankingEntity } from '@/app/lib/models/RankingEntity';
import { Card } from '@/app/lib/types/card';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

// Get personal ranking for a session (distinct from global ELO-based rankings)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionUUID = searchParams.get('sessionUUID');
  const userId = searchParams.get('userId');

  if (!sessionUUID || !userId) {
    return NextResponse.json(
      { error: 'Missing sessionUUID or userId' },
      { status: 400 }
    );
  }

  try {
    // Get organization context
    const orgContext = await getOrganizationContext(req);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Register connection-specific models
    const PersonalRankingModel = connection.model('PersonalRanking', PersonalRanking.schema);

    const ranking = await PersonalRankingModel.findOne({ [SESSION_FIELDS.UUID]: sessionUUID, userId });
    if (!ranking) {
      return NextResponse.json(
        { error: 'Ranking not found' },
        { status: 404 }
      );
    }

    // Convert to RankingDeck and get ordered cards
    const deck = ranking.toRankingDeck();
    
    return NextResponse.json({
      sessionUUID,
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

// Create or update personal ranking (individual session results, separate from global ELO system)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionUUID, userId, card, rank } = body;

    if (!sessionUUID || !userId || !card) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get organization context
    const orgContext = await getOrganizationContext(req);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Register connection-specific models
    const PersonalRankingModel = connection.model('PersonalRanking', PersonalRanking.schema);

    // Find or create ranking
    let ranking = await PersonalRankingModel.findOne({ [SESSION_FIELDS.UUID]: sessionUUID, userId });
    if (!ranking) {
      ranking = new PersonalRankingModel({
        [SESSION_FIELDS.UUID]: sessionUUID,
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
      sessionUUID,
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
