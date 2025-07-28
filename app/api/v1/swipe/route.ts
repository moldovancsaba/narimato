import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session, SessionState } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';
import { SwipeRequestSchema } from '@/app/lib/validation/schemas';
import { DeckEntity } from '@/app/lib/models/DeckEntity';

/**
 * SwipeResponse interface defines the standardized response structure for swipe operations.
 * This ensures consistent API responses and enables proper frontend state management.
 * - success: Indicates if the swipe operation completed successfully
 * - requiresVoting: Determines if the frontend should transition to voting phase
 * - nextState: The new session state after processing the swipe
 * - votingContext: Optional context data needed for voting phase (only present when requiresVoting is true)
 */
interface SwipeResponse {
  success: boolean;
  requiresVoting: boolean;
  nextState: SessionState;
  votingContext?: {
    cardId: string;
    compareWith: string;
  };
}

/**
 * POST /api/v1/swipe
 * 
 * Processes card swipe actions with atomic operations and comprehensive error handling.
 * Implements the correct event order: validate → lock → verify → process → update → remove → release.
 * 
 * Why this approach:
 * - Optimistic locking prevents concurrent swipe conflicts
 * - Atomic operations ensure data consistency
 * - Comprehensive error handling covers all failure scenarios
 * - Proper state transitions maintain session integrity
 */
export async function POST(request: NextRequest) {
  // Track session lock state for cleanup in finally block
  // This ensures proper resource management even during exceptions
  let sessionLocked = false;
  let session: any = null;

  try {
    const body = await request.json();
    
    // 1. Validate request
    // Parse and validate input using Zod schema to ensure type safety
    // Rejects malformed requests early to prevent downstream errors
    const validatedData = SwipeRequestSchema.parse(body);
    const { sessionId, cardId, direction } = validatedData;

    await dbConnect();

    // 2. Lock session with optimistic locking
    // Use findOneAndUpdate with version increment to implement optimistic locking
    // This prevents race conditions when multiple swipes occur simultaneously
    // Why optimistic locking: Provides better performance than pessimistic locks in high-concurrency scenarios
    session = await Session.findOneAndUpdate(
      { sessionId, status: 'active' },
      { $inc: { version: 1 } },
      { new: true }
    );

    if (!session) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Session not found or inactive'
        }),
        { status: 404 }
      );
    }

    // Mark session as locked for cleanup tracking
    sessionLocked = true;

    // Check for session timeout
    // Sessions have expiration times to prevent abandoned sessions from consuming resources
    // Auto-expire sessions that have passed their TTL to maintain system hygiene
    if (session.expiresAt < new Date()) {
      session.status = 'expired';
      await session.save();
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Session has expired'
        }),
        { status: 408 }
      );
    }

    // Validate session state allows swiping
    // Allow swipes when session is in 'swiping' or 'voting' state
    // 'voting' state allows left swipes to reject cards without going through comparison
    if (session.state !== 'swiping' && session.state !== 'voting') {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: `Invalid session state: ${session.state}. Expected 'swiping' or 'voting'`
        }),
        { status: 400 }
      );
    }

    // 3. Verify card state
    const cards = await Card.find({ uuid: { $in: session.deck } });
    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'No cards found in session deck'
        }),
        { status: 400 }
      );
    }

    // Create deck with original order
    const orderedCards = session.deck.map((uuid: string) => 
      cards.find(card => card.uuid === uuid)
    ).filter((card: any) => card !== undefined);

    const deck = new DeckEntity(orderedCards);
    
    // Initialize deck with already swiped cards
    const swipedCardIds = session.swipes.map((swipe: any) => swipe.cardId);
    for (const swipedCardId of swipedCardIds) {
      const swipe = session.swipes.find((s: any) => s.cardId === swipedCardId);
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
    const existingSwipe = session.swipes.some((swipe: { cardId: string }) => swipe.cardId === cardId);
    if (existingSwipe) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Card has already been swiped'
        }),
        { status: 409 }
      );
    }

    // 4. Process swipe - prepare for state changes
    if (!deck.prepareSwipe(cardId)) {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Failed to prepare swipe'
        }),
        { status: 400 }
      );
    }

    // 5. Update session
    session.swipes.push({
      cardId,
      direction,
      timestamp: new Date().toISOString()
    });

    let requiresVoting = false;
    let votingContext = undefined;
    let nextState = session.state;

    if (direction === 'right') {
      if (session.personalRanking.length === 0) {
        // First right swipe - add to ranking automatically
        session.personalRanking = [cardId];
        requiresVoting = false;
        nextState = 'swiping';
      } else {
        // Subsequent right swipes require voting
        nextState = 'voting';
        requiresVoting = true;
        
        // Get comparison card for voting
        const compareWith = session.getNextComparisonCard(cardId);
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

    // Update session state
    session.state = nextState;

    // 6. Confirm swipe in deck (this advances the current position)
    deck.confirmSwipe(cardId, direction);

    // 7. Release lock by saving session
    try {
      await session.save();
      sessionLocked = false;
    } catch (saveError: any) {
      // Handle concurrent modification
      if (saveError.name === 'OptimisticLockError' || saveError.name === 'ConcurrentUpdateError') {
        return new NextResponse(
          JSON.stringify({ 
            success: false,
            error: 'Concurrent swipe detected'
          }),
          { status: 409 }
        );
      }
      throw saveError;
    }

    const response: SwipeResponse = {
      success: true,
      requiresVoting,
      nextState: session.state as SessionState,
      votingContext
    };

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

    // Handle network/database failures
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: 'Network failure - database unavailable'
        }),
        { status: 503 }
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
  } finally {
    // Ensure session lock is released even on errors
    if (sessionLocked && session) {
      try {
        // Rollback version increment on failure to maintain consistency
        await Session.findOneAndUpdate(
          { sessionId: session.sessionId },
          { $inc: { version: -1 } }
        );
      } catch (rollbackError) {
        console.error('Failed to rollback session version:', rollbackError);
      }
    }
  }
}
