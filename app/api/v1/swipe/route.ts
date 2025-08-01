import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { SwipeRequestSchema } from '@/app/lib/validation/schemas';
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import { SESSION_FIELDS, CARD_FIELDS, VOTE_FIELDS, API_FIELDS, PLAY_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId, validateUUID } from '@/app/lib/utils/fieldValidation';

/**
 * Automatically saves play results when a play is completed
 * @param play - The completed play
 */
const savePlayResults = async (play: any) => {
  try {
    const { SessionResults } = await import('@/app/lib/models/SessionResults');
    
    console.log('🔍 savePlayResults called with play data:', {
      playUuid: play.playUuid,
      personalRanking: play.personalRanking,
      personalRankingLength: play.personalRanking?.length || 0,
      totalCards: play.totalCards,
      swipesCount: play.swipes?.length || 0,
      votesCount: play.votes?.length || 0,
      status: play.status,
      state: play.state
    });
    
    // Get all cards from the personal ranking with their details
    const cardIds = play.personalRanking || [];
    const cards = await Card.find({ uuid: { $in: cardIds } });
    
    console.log('🃏 Found cards for ranking:', {
      requestedCardIds: cardIds,
      foundCards: cards.length,
      foundCardIds: cards.map(c => c.uuid)
    });
    
    // Create a map for quick card lookup
    const cardMap = new Map();
    cards.forEach(card => {
      cardMap.set(card.uuid, {
        uuid: card.uuid,
        type: card.type,
        content: card.content,
        title: card.title
      });
    });

    // Build the personal ranking with card details
    const personalRankingWithDetails = cardIds.map((cardId: string, index: number) => {
      const card = cardMap.get(cardId);
      return {
        cardId,
        card,
        rank: index + 1
      };
    }).filter((item: any) => item.card); // Filter out any cards that weren't found

    // Calculate play statistics
    const sessionStatistics = {
      totalCards: play.totalCards || 0,
      cardsRanked: play.personalRanking?.length || 0,
      cardsDiscarded: (play.totalCards || 0) - (play.personalRanking?.length || 0),
      totalSwipes: play.swipes?.length || 0,
      totalVotes: play.votes?.length || 0,
      completionRate: play.totalCards ? Math.round(((play.personalRanking?.length || 0) / play.totalCards) * 100) : 0
    };

    // Check if results already exist for this play (use playUuid as sessionId for now)
    const existingResults = await SessionResults.findOne({ sessionId: play.playUuid });
    
    if (existingResults) {
      // Update existing results
      existingResults.personalRanking = personalRankingWithDetails;
      existingResults.sessionStatistics = sessionStatistics;
      existingResults.updatedAt = new Date();
      await existingResults.save();
      console.log(`Updated existing play results for ${play.playUuid}`);
    } else {
      // Create new play results (use playUuid as sessionId for compatibility)
      const playResults = new SessionResults({
        sessionId: play.playUuid,
        personalRanking: personalRankingWithDetails,
        sessionStatistics,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await playResults.save();
      console.log(`Created new play results for ${play.playUuid}`);
    }
  } catch (error) {
    console.error(`Failed to save play results for ${play.playUuid}:`, error);
    // Don't throw error - play completion should not fail due to results saving
  }
};

interface SwipeResponse {
  [API_FIELDS.SUCCESS]: boolean;
  requiresVoting: boolean;
  nextState: string;
  sessionCompleted?: boolean;
  votingContext?: {
    [CARD_FIELDS.ID]: string;
    compareWith: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validatedData = SwipeRequestSchema.parse(body);
    const playUuid = validatedData[SESSION_FIELDS.ID]; // Frontend sends this as sessionId but it's playUuid
    const cardId = validatedData[CARD_FIELDS.ID];
    const direction = validatedData[VOTE_FIELDS.DIRECTION];

    await dbConnect();

    // Find the play
    const play = await Play.findOne({ 
      [PLAY_FIELDS.UUID]: playUuid, 
      [PLAY_FIELDS.STATUS]: 'active' 
    });
    
    if (!play) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: 'Play not found or inactive'
        }),
        { status: 404 }
      );
    }

    // Check play expiry
    if (play.expiresAt < new Date()) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: 'Play expired'
        }),
        { status: 408 }
      );
    }

    // Validate play state allows swiping
    if (play.state !== 'swiping' && play.state !== 'voting') {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: `Invalid play state: ${play.state}. Expected 'swiping' or 'voting'`
        }),
        { status: 400 }
      );
    }

    // Get cards for the deck
    const cards = await Card.find({ [CARD_FIELDS.UUID]: { $in: play.deck } });
    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: 'No cards found in play deck'
        }),
        { status: 400 }
      );
    }

    // Create deck with original order
    const orderedCards = play.deck.map((uuid: string) => 
      cards.find(card => card[CARD_FIELDS.UUID] === uuid)
    ).filter((card: any) => card !== undefined);

    const deck = new DeckEntity(orderedCards);
    
    // Initialize deck with already swiped cards
    const swipedCardIds = play.swipes.map((swipe: any) => swipe.cardId);
    for (const swipedCardId of swipedCardIds) {
      const swipe = play.swipes.find((s: any) => s.cardId === swipedCardId);
      if (swipe) {
        deck.confirmSwipe(swipedCardId, swipe.direction);
      }
    }
    
    const currentCard = deck.getCurrentCard();

    // Verify current card matches the requested card
    if (!currentCard || currentCard.uuid !== cardId) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Invalid card state - card is not current'
        }),
        { status: 400 }
      );
    }

    // Check for duplicate swipes
    const existingSwipe = play.swipes.some((swipe: { cardId: string }) => swipe.cardId === cardId);
    if (existingSwipe) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Card has already been swiped'
        }),
        { status: 409 }
      );
    }

    // Process swipe
    if (!deck.prepareSwipe(cardId)) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Failed to prepare swipe'
        }),
        { status: 400 }
      );
    }

    // Prepare state update
    let requiresVoting = false;
    let votingContext = undefined;
    let nextState = play.state;
    let newPersonalRanking = [...play.personalRanking];

    if (direction === 'right') {
      if (play.personalRanking.length === 0) {
        // First right swipe - add to ranking automatically
        newPersonalRanking = [cardId];
        requiresVoting = false;
        nextState = 'swiping';
      } else {
        // Subsequent right swipes require voting
        nextState = 'voting';
        requiresVoting = true;
        
        // Get comparison card for voting
        const compareWith = play.getNextComparisonCard(cardId);
        if (compareWith) {
          votingContext = {
            cardId,
            compareWith
          };
        }
      }
    } else if (direction === 'left') {
      // Left swipes always return to swiping state (reject card)
      nextState = 'swiping';
      requiresVoting = false;
    }

    // Confirm swipe in deck (this advances the current position)
    deck.confirmSwipe(cardId, direction);

    // Check if deck is exhausted
    let sessionCompleted = false;
    if (deck.isExhausted()) {
      console.log(`🎊 DECK EXHAUSTION DETECTED in swipe endpoint - Play ${play.playUuid}:`, {
        cardId,
        direction,
        totalCardsInDeck: orderedCards.length,
        totalSwipes: play.swipes.length + 1, // +1 for the current swipe
        personalRankingLength: newPersonalRanking.length,
        currentState: play.state,
        wasRequiringVoting: requiresVoting,
        nextState: requiresVoting ? 'voting' : 'completed'
      });
      
      // Only complete the play immediately for LEFT swipes or first RIGHT swipe
      // For RIGHT swipes that require voting, let the voting process handle completion
      if (direction === 'left' || !requiresVoting) {
        console.log(`🏁 Completing play immediately - no voting required`);
        nextState = 'completed';
        play.status = 'completed';
        play.completedAt = new Date();
        
        // Remove expiry for completed plays to preserve results indefinitely for sharing
        const noExpiry = new Date('2099-12-31T23:59:59.999Z');
        play.expiresAt = noExpiry;
        
        sessionCompleted = true;
        console.log(`✅ Play ${play.playUuid} marked as completed via swipe endpoint`);
      } else {
        console.log(`🗳️ Last card requires voting - play will complete after voting process`);
      }
    }

    // Update play state
    play.state = nextState;
    play.swipes.push({
      cardId,
      direction,
      timestamp: new Date()
    });
    play.personalRanking = newPersonalRanking;
    play.lastActivity = new Date();

    await play.save();

    // Save results if play is completed
    if (sessionCompleted) {
      await savePlayResults(play);
    }

    const response: SwipeResponse = {
      success: true,
      requiresVoting,
      nextState: play.state,
      sessionCompleted,
      votingContext
    };

    console.log(`👆 Swipe processed for ${playUuid.substring(0, 8)}...: ${direction} on ${cardId.substring(0, 8)}..., next state: ${nextState}`);

    return new NextResponse(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error: any) {
    console.error('Swipe recording error:', error);

    // Handle validation errors
    if (error.name === 'ZodError') {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Validation error', 
          details: error.errors 
        }),
        { status: 400 }
      );
    }

    // Generic error handler
    return new NextResponse(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error'
      }),
      { status: 500 }
    );
  }
}
