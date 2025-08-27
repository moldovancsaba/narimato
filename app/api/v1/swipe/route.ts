import { NextRequest, NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { SwipeRequestSchema } from '@/app/lib/validation/schemas';
import { GlobalRanking } from '@/app/lib/models/GlobalRanking';
import { savePlayResults } from '@/app/lib/utils/sessionResultsUtils';

interface SwipeResponse {
  success: boolean;
  requiresVoting: boolean;
  nextState: string;
  sessionCompleted?: boolean;
  votingContext?: {
    cardUUID: string;
    compareWith: string;
  };
}

export const POST = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    const PlayModel = connection.model('Play', Play.schema);
    const CardModel = connection.model('Card', Card.schema);
    const body = await request.json();

    const validatedData = SwipeRequestSchema.parse(body);
    const playUUID = validatedData.sessionUUID;
    const cardUUID = validatedData.cardUUID;
    const direction = validatedData.direction;

    const play = await PlayModel.findOne({ uuid: playUUID, status: 'active' });
    if (!play) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Play not found or inactive' }), { status: 404 });
    }

    if (play.expiresAt < new Date()) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Play expired' }), { status: 408 });
    }

    if (play.state !== 'swiping' && play.state !== 'voting') {
      return new NextResponse(
        JSON.stringify({ success: false, error: `Invalid play state: ${play.state}. Expected 'swiping' or 'voting'` }),
        { status: 400 }
      );
    }

    const cards = await CardModel.find({ uuid: { $in: play.deck } });
    if (cards.length === 0) {
      return new NextResponse(JSON.stringify({ success: false, error: 'No cards found in play deck' }), { status: 400 });
    }

    const cardMap = new Map();
    cards.forEach(card => {
      cardMap.set(card.uuid, card);
    });

    const orderedCards = play.deck.map((uuid: string) => cardMap.get(uuid)).filter(Boolean);
    const swipedCardIds = play.swipes.map((swipe: any) => swipe.uuid);
    const currentCard = orderedCards.find((card: any) => !swipedCardIds.includes(card.uuid));

    if (!currentCard || currentCard.uuid !== cardUUID) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Invalid card state - card is not current' }), { status: 400 });
    }

    const existingSwipe = play.swipes.some((swipe: { uuid: string }) => swipe.uuid === cardUUID);
    if (existingSwipe) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Card has already been swiped' }), { status: 409 });
    }

    let requiresVoting = false;
    let votingContext = undefined;
    let nextState = play.state;
    let newPersonalRanking = [...play.personalRanking];

    if (direction === 'right') {
      if (play.personalRanking.length === 0) {
        newPersonalRanking = [cardUUID];
        nextState = 'swiping';
      } else {
        const compareWith = play.getNextComparisonCard(cardUUID);
        if (compareWith) {
          nextState = 'voting';
          requiresVoting = true;
          votingContext = {
            cardUUID,
            compareWith
          };
        } else {
          // No comparison needed, add to ranking and continue swiping
          newPersonalRanking = [cardUUID, ...play.personalRanking];
          nextState = 'swiping';
        }
      }
    } else if (direction === 'left') {
      nextState = 'swiping';
    }

    let sessionCompleted = false;
    
    // Check if ALL cards have been swiped (not just compared to total swipes)
    const allSwipedCardIds = new Set([...play.swipes.map(s => s.uuid), cardUUID]);
    const allCardsSwiped = orderedCards.every((card: any) => allSwipedCardIds.has(card.uuid));
    
    // Only complete if all cards are swiped AND we're not transitioning to voting
    if (allCardsSwiped && !requiresVoting) {
      console.log(`🎊 All cards processed for play ${play.uuid}, completing session`);
      nextState = 'completed';
      play.status = 'completed';
      play.completedAt = new Date();
      const noExpiry = new Date('2099-12-31T23:59:59.999Z');
      play.expiresAt = noExpiry;
      sessionCompleted = true;
    }

    play.state = nextState;
    play.swipes.push({
      uuid: cardUUID,
      direction,
      timestamp: new Date()
    });
    play.personalRanking = newPersonalRanking;
    play.lastActivity = new Date();

    await play.save();

    if (sessionCompleted) {
      try {
        await savePlayResults(play, connection);
        await GlobalRanking.calculateRankings();
      } catch (error) {
        console.error(`Failed to save results after session completion:`, error);
      }
    }

    const response: SwipeResponse = {
      success: true,
      requiresVoting,
      nextState: play.state,
      sessionCompleted,
      votingContext
    };

    return new NextResponse(JSON.stringify(response), { status: 200 });
  } catch (error: any) {
    console.error('Swipe API error:', error);
    return new NextResponse(JSON.stringify({ success: false, error: 'Internal server error', details: error.message }), { status: 500 });
  }
});

