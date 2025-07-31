import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session, SessionState } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { SwipeRequestSchema } from '@/app/lib/validation/schemas';
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import { SESSION_FIELDS, CARD_FIELDS, VOTE_FIELDS, API_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId, validateUUID } from '@/app/lib/utils/fieldValidation';

/**
 * Validates session state with version check and expiry validation.
 * Implements comprehensive session validation to prevent stale state operations.
 * 
 * Why version checking:
 * - Prevents concurrent modifications from causing inconsistent state
 * - Ensures atomic operations maintain data integrity
 * - Provides clear error messaging for debugging
 * 
 * @param sessionId - Unique identifier for the session
 * @param version - Expected version number for optimistic locking
 * @returns Object with validation result and session data or error message
 */
const validateSession = async (sessionId: string, version: number) => {
  if (!validateSessionId(sessionId)) {
    return { isValid: false, error: 'Invalid session ID format' };
  }
  
  const session = await Session.findOne({ [SESSION_FIELDS.ID]: sessionId });
  
  if (!session) {
    return { isValid: false, error: 'Session not found' };
  }
  
  if (session[SESSION_FIELDS.VERSION] !== version) {
    return { isValid: false, error: 'Session version mismatch' };
  }
  
  // Check session expiry
  if (session.expiresAt < new Date()) {
    return { isValid: false, error: 'Session expired' };
  }
  
  return { isValid: true, session };
};

/**
 * Updates session state with atomic operations and optimistic locking.
 * Implements safe concurrent updates to prevent race conditions.
 * 
 * Why atomic updates:
 * - Ensures consistency across concurrent operations
 * - Prevents partial state updates during failures
 * - Provides immediate feedback on concurrent modification attempts
 * 
 * @param session - Current session object with version information
 * @param newState - New state data to be applied atomically
 * @returns Updated session object or throws error on concurrent modification
 */
const updateSessionState = async (session: any, newState: any) => {
  const result = await Session.findOneAndUpdate(
    { 
      [SESSION_FIELDS.ID]: session[SESSION_FIELDS.ID],
      [SESSION_FIELDS.VERSION]: session[SESSION_FIELDS.VERSION]
    },
    {
      $set: { ...newState },
      $inc: { [SESSION_FIELDS.VERSION]: 1 }
    },
    { new: true }
  );
  
  if (!result) {
    throw new Error('Concurrent update detected');
  }
  
  return result;
};

/**
 * Automatically saves session results when a session is completed
 * @param session - The completed session
 */
const saveSessionResults = async (session: any) => {
  try {
    // Get all cards from the personal ranking with their details
    const cardIds = session.personalRanking || [];
    const cards = await Card.find({ uuid: { $in: cardIds } });
    
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

    // Calculate session statistics
    const sessionStatistics = {
      totalCards: session.totalCards || 0,
      cardsRanked: session.personalRanking?.length || 0,
      cardsDiscarded: (session.totalCards || 0) - (session.personalRanking?.length || 0),
      totalSwipes: session.swipes?.length || 0,
      totalVotes: session.votes?.length || 0,
      completionRate: session.totalCards ? Math.round(((session.personalRanking?.length || 0) / session.totalCards) * 100) : 0
    };

    // Check if results already exist for this session
    const existingResults = await SessionResults.findOne({ sessionId: session.sessionId });
    
    if (existingResults) {
      // Update existing results
      existingResults.personalRanking = personalRankingWithDetails;
      existingResults.sessionStatistics = sessionStatistics;
      existingResults.updatedAt = new Date();
      await existingResults.save();
      console.log(`Updated existing session results for ${session.sessionId}`);
    } else {
      // Create new session results
      const sessionResults = new SessionResults({
        sessionId: session.sessionId,
        personalRanking: personalRankingWithDetails,
        sessionStatistics,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await sessionResults.save();
      console.log(`Created new session results for ${session.sessionId}`);
    }
  } catch (error) {
    console.error(`Failed to save session results for ${session.sessionId}:`, error);
    // Don't throw error - session completion should not fail due to results saving
  }
};

/**
 * SwipeResponse interface defines the standardized response structure for swipe operations.
 * This ensures consistent API responses and enables proper frontend state management.
 * - success: Indicates if the swipe operation completed successfully
 * - requiresVoting: Determines if the frontend should transition to voting phase
 * - nextState: The new session state after processing the swipe
 * - votingContext: Optional context data needed for voting phase (only present when requiresVoting is true)
 */
interface SwipeResponse {
  [API_FIELDS.SUCCESS]: boolean;
  requiresVoting: boolean;
  nextState: SessionState;
  sessionCompleted?: boolean;
  votingContext?: {
    [CARD_FIELDS.ID]: string;
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
    const sessionId = validatedData[SESSION_FIELDS.ID];
    const cardId = validatedData[CARD_FIELDS.ID];
    const direction = validatedData[VOTE_FIELDS.DIRECTION];

    await dbConnect();

    // 2. Enhanced session validation with version checking
    // First get the current session to extract version for validation
    const currentSession = await Session.findOne({ [SESSION_FIELDS.ID]: sessionId, status: 'active' });
    
    if (!currentSession) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: 'Session not found or inactive'
        }),
        { status: 404 }
      );
    }

    // Use enhanced validation with version checking and expiry validation
    const validation = await validateSession(sessionId, currentSession[SESSION_FIELDS.VERSION]);
    
    if (!validation.isValid) {
      const statusCode = validation.error === 'Session expired' ? 408 : 409;
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: validation.error
        }),
        { status: statusCode }
      );
    }

    // Lock session with optimistic locking after validation
    // Use findOneAndUpdate with version increment to implement optimistic locking
    // This prevents race conditions when multiple swipes occur simultaneously
    session = await Session.findOneAndUpdate(
      { [SESSION_FIELDS.ID]: sessionId, [SESSION_FIELDS.VERSION]: currentSession[SESSION_FIELDS.VERSION], status: 'active' },
      { $inc: { [SESSION_FIELDS.VERSION]: 1 } },
      { new: true }
    );

    if (!session) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: 'Concurrent modification detected during session lock'
        }),
        { status: 409 }
      );
    }

    // Mark session as locked for cleanup tracking
    sessionLocked = true;

    // Validate session state allows swiping
    // Allow swipes when session is in 'swiping' or 'voting' state
    // 'voting' state allows left swipes to reject cards without going through comparison
    if (session.state !== 'swiping' && session.state !== 'voting') {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: `Invalid session state: ${session.state}. Expected 'swiping' or 'voting'`
        }),
        { status: 400 }
      );
    }

    // 3. Verify card state
    const cards = await Card.find({ [CARD_FIELDS.UUID]: { $in: session.deck } });
    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.SUCCESS]: false,
          [API_FIELDS.ERROR]: 'No cards found in session deck'
        }),
        { status: 400 }
      );
    }

    // Create deck with original order
    const orderedCards = session.deck.map((uuid: string) => 
      cards.find(card => card[CARD_FIELDS.UUID] === uuid)
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

    // 5. Prepare atomic state update
    let requiresVoting = false;
    let votingContext = undefined;
    let nextState = session.state;
    let newPersonalRanking = [...session.personalRanking];

    if (direction === 'right') {
      if (session.personalRanking.length === 0) {
        // First right swipe - add to ranking automatically
        newPersonalRanking = [cardId];
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

    // 6. Confirm swipe in deck (this advances the current position)
    deck.confirmSwipe(cardId, direction);

    // 7. Check if deck is exhausted - but only complete session for LEFT swipes
    // For RIGHT swipes that require voting, let the voting process complete first
    if (deck.isExhausted()) {
      console.log(`🎊 DECK EXHAUSTION DETECTED in swipe endpoint - Session ${session.sessionId}:`, {
        cardId,
        direction,
        totalCardsInDeck: orderedCards.length,
        totalSwipes: session.swipes.length + 1, // +1 for the current swipe
        personalRankingLength: newPersonalRanking.length,
        currentState: session.state,
        wasRequiringVoting: requiresVoting,
        nextState: requiresVoting ? 'voting' : 'completed'
      });
      
      // Only complete the session immediately for LEFT swipes or first RIGHT swipe
      // For RIGHT swipes that require voting, let the voting process handle completion
      if (direction === 'left' || !requiresVoting) {
        console.log(`🏁 Completing session immediately - no voting required`);
        nextState = 'completed';
        session.status = 'completed';
        session.completedAt = new Date();
        console.log(`✅ Session ${session.sessionId} marked as completed via swipe endpoint`);
      } else {
        console.log(`🗳️ Last card requires voting - session will complete after voting process`);
        // Keep the voting requirement - session will be completed by the vote endpoint
        // when it detects deck exhaustion after the final vote
      }
    }

    // Atomic state update with optimistic locking
    const newSessionState = {
      state: nextState,
      status: session.status,
      completedAt: session.completedAt,
      swipes: [
        ...session.swipes,
        {
          cardId,
          direction,
          timestamp: new Date().toISOString()
        }
      ],
      personalRanking: newPersonalRanking,
      lastActivity: new Date()
    };

    try {
      // Use atomic update function to ensure consistency
      session = await updateSessionState(session, newSessionState);
      sessionLocked = false;
      
      // Automatically save session results if session is completed
      if (session.status === 'completed') {
        await saveSessionResults(session);
      }
    } catch (updateError: any) {
      // Handle concurrent modification during atomic update
      if (updateError.message === 'Concurrent update detected') {
        return new NextResponse(
          JSON.stringify({ 
            success: false,
            error: 'Concurrent swipe detected during state update'
          }),
          { status: 409 }
        );
      }
      throw updateError;
    }

    const response: SwipeResponse = {
      success: true,
      requiresVoting,
      nextState: session.state as SessionState,
      sessionCompleted: session.status === 'completed',
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
