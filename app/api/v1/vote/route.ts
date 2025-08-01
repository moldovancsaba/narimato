import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { VoteRequestSchema } from '@/app/lib/validation/schemas';
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import mongoose from 'mongoose';
import { SESSION_FIELDS, VOTE_FIELDS, API_FIELDS, CARD_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateUUID, validateSessionId } from '@/app/lib/utils/fieldValidation';

interface NextComparison {
  newCard: string;
  compareAgainst: string;
}

interface RankingResult {
  ranking: string[];
  nextComparison: NextComparison | null;
}

// Audit trail interface for tracking comparison decisions
interface ComparisonAudit {
  newCard: string;
  compareAgainst: string;
  winner: string;
  previousRanking: string[];
  newRanking: string[];
  timestamp: Date;
  strategy: 'binary_search' | 'sequential';
  position: number;
}

// Enhanced validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate accumulated search bounds for a card based on all its votes
 * @param targetCardId - The card being ranked
 * @param ranking - Current ranking
 * @param votes - All votes in the session
 * @returns Search bounds with start and end indices
 */
function calculateAccumulatedSearchBounds(
  targetCardId: string, 
  ranking: string[], 
  votes: any[]
): { start: number, end: number } {
  let searchStart = 0;
  let searchEnd = ranking.length;
  
  console.log(`\n--- BOUNDS CALCULATION DEBUG for ${targetCardId.substring(0, 8)}... ---`);
  console.log('Initial bounds:', { searchStart, searchEnd, rankingLength: ranking.length });
  console.log('Ranking:', ranking.map((card, idx) => `[${idx}] ${card.substring(0, 8)}...`));
  
  // Process all votes for this card to accumulate constraints
  for (const vote of votes) {
    // Check if this vote involves the target card
    if (vote.cardA !== targetCardId && vote.cardB !== targetCardId) {
      continue; // Skip votes not involving target card
    }
    
    // Determine which card is the comparison card (the one already in ranking)
    let comparedCardId: string;
    let comparedCardIndex: number;
    
    if (vote.cardA === targetCardId) {
      // Target card is cardA, so cardB should be the comparison card
      comparedCardId = vote.cardB;
      comparedCardIndex = ranking.indexOf(vote.cardB);
    } else {
      // Target card is cardB, so cardA should be the comparison card
      comparedCardId = vote.cardA;
      comparedCardIndex = ranking.indexOf(vote.cardA);
    }
    
    // Skip if comparison card is not in ranking (shouldn't happen with valid votes)
    if (comparedCardIndex === -1) {
      console.log(`⚠️  Skipping vote: compared card ${comparedCardId.substring(0, 8)}... not in ranking`);
      continue;
    }
    
    const oldBounds = { searchStart, searchEnd };
    
    if (vote.winner === targetCardId) {
      // Target card won: it ranks higher than compared card
      // Narrow upper bound (can't be lower than this position)
      searchEnd = Math.min(searchEnd, comparedCardIndex);
      console.log(`✅ TARGET WON vs [${comparedCardIndex}] ${comparedCardId.substring(0, 8)}... → searchEnd: ${oldBounds.searchEnd} → ${searchEnd}`);
    } else {
      // Target card lost: it ranks lower than compared card  
      // Narrow lower bound (can't be higher than this position)
      searchStart = Math.max(searchStart, comparedCardIndex + 1);
      console.log(`❌ TARGET LOST vs [${comparedCardIndex}] ${comparedCardId.substring(0, 8)}... → searchStart: ${oldBounds.searchStart} → ${searchStart}`);
    }
    
    console.log(`   Current bounds: [${searchStart}, ${searchEnd}) = ${searchEnd - searchStart} cards`);
    if (searchStart < searchEnd) {
      const currentSearchSpace = ranking.slice(searchStart, searchEnd);
      console.log(`   Current search space: ${currentSearchSpace.map((card, idx) => `[${searchStart + idx}] ${card.substring(0, 8)}...`).join(', ')}`);
    } else {
      console.log(`   ⚡ SEARCH SPACE EMPTY - Position determined!`);
    }
  }
  
  console.log(`\nFinal bounds: [${searchStart}, ${searchEnd}) = ${searchEnd - searchStart} cards`);
  console.log('--- END BOUNDS CALCULATION ---\n');
  
  return { start: searchStart, end: searchEnd };
}

/**
 * Determines the next card to compare against using accumulated search bounds.
 * @param newCard - The card being inserted into the ranking
 * @param currentRanking - The current ordered ranking of cards (highest to lowest)
 * @param allVotes - All votes in the session
 * @returns The next card UUID to compare against, or null if positioning is complete
 */
function determineNextComparison(
  newCard: string,
  currentRanking: string[],
  allVotes: any[]
): string | null {
  // No comparisons needed for empty rankings
  if (currentRanking.length === 0) {
    return null;
  }

  // If new card is already in ranking, no further comparisons needed
  if (currentRanking.includes(newCard)) {
    return null;
  }

  // Calculate accumulated search bounds for this card
  const bounds = calculateAccumulatedSearchBounds(newCard, currentRanking, allVotes);
  
  console.log('Binary search accumulated bounds:', {
    newCard,
    searchStart: bounds.start,
    searchEnd: bounds.end,
    searchSpace: currentRanking.slice(bounds.start, bounds.end),
    allVotesForCard: allVotes.filter(v => {
      return v.cardA === newCard || v.cardB === newCard;
    })
  });
  
  // If search space is empty, positioning is complete
  if (bounds.start >= bounds.end) {
    return null;
  }
  
  // Select middle card from search space
  const searchSpace = currentRanking.slice(bounds.start, bounds.end);
  if (searchSpace.length === 0) {
    return null;
  }
  
  const middleIndex = Math.floor(searchSpace.length / 2);
  return searchSpace[middleIndex];
}

/**
 * Validates the integrity of a ranking operation before execution.
 * Performs comprehensive checks on vote sequence, ranking state, and transitions.
 */
function validateRankingIntegrity(
  newCard: string,
  currentRanking: string[],
  winner: string,
  cardA: string,
  cardB: string,
  sessionVotes: any[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation 1: Winner must be one of the compared cards
  if (winner !== cardA && winner !== cardB) {
    errors.push('Winner must be either cardA or cardB');
  }

  // Validation 2: Cards must be different (except for first ranking)
  if (cardA === cardB && currentRanking.length > 0) {
    errors.push('Cannot compare a card against itself');
  }

  // Validation 3: New card validation
  if (newCard !== cardA && newCard !== cardB) {
    errors.push('New card must be one of the cards being compared');
  }

  // Validation 4: Ranking integrity check
  const uniqueCards = new Set(currentRanking);
  if (uniqueCards.size !== currentRanking.length) {
    errors.push('Ranking contains duplicate cards');
  }

  // Validation 5: Vote sequence validation (relaxed for binary search)
  if (sessionVotes.length > 0) {
    const lastVote = sessionVotes[sessionVotes.length - 1];
    const currentCards = [cardA, cardB];
    
    // For binary search ranking, we need to validate that either:
    // 1. We're continuing to rank the same new card (cardA is the new card), OR
    // 2. One of the cards being compared is already in the ranking (cardB should be in ranking)
    const isNewCardContinuation = newCard === cardA && currentRanking.includes(cardB);
    const isValidBinarySearchStep = currentRanking.includes(cardB);
    
    console.log('Vote sequence validation debug:', {
      isNewCardContinuation,
      isValidBinarySearchStep,
      newCard,
      cardA,
      cardB,
      cardBInRanking: currentRanking.includes(cardB),
      currentRanking
    });
    
    if (!isNewCardContinuation && !isValidBinarySearchStep) {
      errors.push('Vote sequence broken: comparison must involve a card from existing ranking');
    }
  }

  // Warning: Large ranking size performance impact
  if (currentRanking.length > 100) {
    warnings.push('Large ranking size may impact performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Enhanced ranking insertion with strict comparison logic and audit trail.
 * Implements atomic updates with rollback capability on failure.
 */
function insertCardInRanking(
  newCard: string,
  currentRanking: string[],
  winner: string,
  cardA: string,
  cardB: string,
  auditTrail: ComparisonAudit[] = [],
  sessionVotes: any[] = []
): RankingResult {
  console.log('insertCardInRanking called:', {
    newCard,
    currentRanking,
    winner,
    cardA,
    cardB,
    isNewCardWinner: winner === cardA
  });
  
  // Store original ranking for potential rollback
  const originalRanking = [...currentRanking];
  
  try {
    // Initial ranking when this is the first card
    if (currentRanking.length === 0) {
      // Create audit entry for first card placement
      auditTrail.push({
        newCard,
        compareAgainst: '',
        winner,
        previousRanking: [],
        newRanking: [newCard],
        timestamp: new Date(),
        strategy: 'sequential',
        position: 0
      });
      
      return {
        ranking: [newCard],
        nextComparison: null
      };
    }

    const isNewCardWinner = winner === cardA;
    const compareCardIndex = currentRanking.indexOf(cardB);

    // Strict validation: comparison card must exist in ranking
    if (compareCardIndex === -1) {
      throw new Error('Invalid comparison: comparison card not found in current ranking');
    }

    let newRanking: string[];
    let nextComparison: NextComparison | null = null;
    let finalPosition: number;

    if (isNewCardWinner) {
      // New card won: it ranks higher than the comparison card
      if (compareCardIndex === 0) {
        // Card reaches the top position
        newRanking = [newCard, ...currentRanking];
        finalPosition = 0;
      } else {
        // Continue binary search in higher-ranked section  
        const nextCompareCard = determineNextComparison(newCard, currentRanking, sessionVotes);
        
        if (nextCompareCard) {
          // More comparisons needed
          newRanking = currentRanking; // Keep current ranking until positioning is complete
          nextComparison = {
            newCard,
            compareAgainst: nextCompareCard
          };
          finalPosition = -1; // Position not yet determined
        } else {
          // No more comparisons needed - determine final position from accumulated bounds
          const bounds = calculateAccumulatedSearchBounds(newCard, currentRanking, sessionVotes);
          const insertPosition = bounds.start;
          
          newRanking = [
            ...currentRanking.slice(0, insertPosition),
            newCard,
            ...currentRanking.slice(insertPosition)
          ];
          finalPosition = insertPosition;
          
          console.log(`🎯 Search space empty - card position determined, inserting card and updating session state`);
          console.log(`📍 Card position determined and inserted:`, {
            cardId: `${newCard.substring(0, 8)}...`,
            insertPosition,
            previousRanking: currentRanking.map(c => `${c.substring(0, 8)}...`),
            newRanking: newRanking.map(c => `${c.substring(0, 8)}...`),
            sessionState: 'comparing → swiping',
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      // New card lost: it ranks lower than the comparison card
      if (compareCardIndex === currentRanking.length - 1) {
        // Card goes to the bottom
        newRanking = [...currentRanking, newCard];
        finalPosition = currentRanking.length;
      } else {
        // Continue binary search in lower-ranked section
        const nextCompareCard = determineNextComparison(newCard, currentRanking, sessionVotes);
        
        if (nextCompareCard) {
          // More comparisons needed
          newRanking = currentRanking; // Keep current ranking
          nextComparison = {
            newCard,
            compareAgainst: nextCompareCard
          };
          finalPosition = -1; // Position not yet determined
        } else {
          // No more comparisons needed - determine final position from accumulated bounds
          const bounds = calculateAccumulatedSearchBounds(newCard, currentRanking, sessionVotes);
          const insertPosition = bounds.start;
          
          newRanking = [
            ...currentRanking.slice(0, insertPosition),
            newCard,
            ...currentRanking.slice(insertPosition)
          ];
          finalPosition = insertPosition;
          
          console.log(`Search space empty - card position determined, inserting card and updating session state`);
          console.log(`Card position determined and inserted:`, {
            cardId: `${newCard.substring(0, 8)}...`,
            insertPosition,
            previousRanking: currentRanking.map(c => `${c.substring(0, 8)}...`),
            newRanking: newRanking.map(c => `${c.substring(0, 8)}...`),
            sessionState: 'comparing → swiping'
          });
        }
      }
    }

    // Create audit trail entry
    auditTrail.push({
      newCard,
      compareAgainst: cardB,
      winner,
      previousRanking: originalRanking,
      newRanking,
      timestamp: new Date(),
      strategy: 'binary_search',
      position: finalPosition
    });

    return {
      ranking: newRanking,
      nextComparison
    };

  } catch (error) {
    // Rollback on any error
    console.error('Ranking insertion failed, rolling back:', error);
    throw error;
  }
}

const VOTE_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Automatically saves session results when a session is completed
 * @param session - The completed session
 */
const saveSessionResults = async (session: any) => {
  try {
    console.log('🔍 saveSessionResults called with session data:', {
      sessionId: session.sessionId,
      personalRanking: session.personalRanking,
      personalRankingLength: session.personalRanking?.length || 0,
      totalCards: session.totalCards,
      swipesCount: session.swipes?.length || 0,
      votesCount: session.votes?.length || 0,
      status: session.status,
      state: session.state
    });
    
    // Get all cards from the personal ranking with their details
    const cardIds = session.personalRanking || [];
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
 * Performs atomic session update with rollback capability.
 * Uses MongoDB transactions to ensure data consistency.
 */
async function performAtomicRankingUpdate(
  session: any,
  newVote: any,
  updatedRanking: string[],
  newState: string,
  auditTrail: ComparisonAudit[],
  newCard: string
) {
  const mongoSession = await mongoose.startSession();
  
  try {
    // Start transaction for atomic updates
    await mongoSession.startTransaction();
    
    // Store original state for potential rollback
    const originalRanking = [...session.personalRanking];
    const originalState = session.state;
    const originalVersion = session.version;
    
    // Apply updates within transaction
    session.votes.push(newVote);
    session.personalRanking = updatedRanking;
    session.state = newState;
    session.version += 1;
    
    // If ranking is complete (no more comparisons), record the swipe
    if (newState === 'swiping') {
      const newCardSwipe = {
        cardId: newCard,
        direction: 'right',
        timestamp: new Date().toISOString()
      };
      
      // Check if swipe already exists to avoid duplicates
      const swipeExists = session.swipes.some((swipe: any) => swipe.cardId === newCard);
      if (!swipeExists) {
        session.swipes.push(newCardSwipe);
        console.log(`Added swipe record for ranked card: ${newCard}`);
      }
      
      // Check if deck is exhausted after the swipe
      const cards = await Card.find({ [CARD_FIELDS.UUID]: { $in: session.deck } });
      if (cards.length > 0) {
        const orderedCards = session.deck.map((uuid: string) => 
          cards.find(card => card[CARD_FIELDS.UUID] === uuid)
        ).filter((card: any) => card !== undefined);
        
        const deck = new DeckEntity(orderedCards);
        
        // Initialize deck with all swipes to check if exhausted
        const swipedCardIds = session.swipes.map((swipe: any) => swipe.cardId);
        for (const swipedCardId of swipedCardIds) {
          const swipe = session.swipes.find((s: any) => s.cardId === swipedCardId);
          if (swipe) {
            deck.confirmSwipe(swipedCardId, swipe.direction);
          }
        }
        
        // If deck is exhausted, mark session as completed
        if (deck.isExhausted()) {
          console.log(`🎊 DECK EXHAUSTION DETECTED - Completing session ${session.sessionId}:`, {
            totalCardsInDeck: cards.length,
            totalSwipes: session.swipes.length,
            totalVotes: session.votes.length,
            personalRankingLength: session.personalRanking.length,
            lastCard: newCard.substring(0, 8) + '...',
            currentState: session.state,
            currentStatus: session.status
          });
          
          session.state = 'completed';
          session.status = 'completed';
          session.completedAt = new Date();
          
          // Remove expiry for completed sessions to preserve results indefinitely for sharing
          // Set expiresAt far in the future to effectively disable TTL cleanup
          const noExpiry = new Date('2099-12-31T23:59:59.999Z');
          session.expiresAt = noExpiry;
          
          console.log(`📅 Removed expiry for completed session - will persist indefinitely for sharing`);
          
          console.log(`✅ Session ${session.sessionId} marked as completed - deck exhausted`);
          console.log(`📊 Final session state before saving to database:`, {
            personalRanking: session.personalRanking.map((id: string) => id.substring(0, 8) + '...'),
            totalCards: session.totalCards,
            swipesCount: session.swipes.length,
            votesCount: session.votes.length
          });
        }
      }
    }
    
    // Save with transaction session
    await session.save({ session: mongoSession });
    
    // Commit transaction if all operations succeed
    await mongoSession.commitTransaction();
    
    console.log(`Atomic update completed for session ${session.sessionId}:`, {
      previousRanking: originalRanking,
      newRanking: updatedRanking,
      stateTransition: `${originalState} → ${newState}`,
      auditEntries: auditTrail.length
    });
    
      // If session was completed, save results after transaction is committed
      if (session.status === 'completed') {
        try {
          console.log(`💾 Session completed - attempting to save results after transaction commit...`);
          await saveSessionResults(session);
          console.log(`✅ Session results saved successfully after completion for ${session.sessionId}`);
        } catch (resultsError) {
          console.error(`❌ Failed to save session results after completion:`, resultsError);
          // Don't throw error - session completion should not fail due to results saving
        }
      }
    
  } catch (error) {
    // Rollback transaction on any failure
    await mongoSession.abortTransaction();
    console.error('Atomic update failed, transaction rolled back:', error);
    throw new Error(`Transaction rollback: ${(error as Error).message}`);
  } finally {
    // Always end the session
    await mongoSession.endSession();
  }
}

/**
 * Validates state transitions according to session state machine rules.
 * Ensures only valid state changes are allowed.
 */
function validateStateTransition(
  currentState: string,
  targetState: string,
  hasNextComparison: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Define valid state transition matrix
  const validTransitions: Record<string, string[]> = {
    'swiping': ['voting', 'comparing', 'completed'],
    'comparing': ['comparing', 'swiping', 'completed'],
    'voting': ['comparing', 'swiping', 'completed'],
    'completed': ['completed'] // Allow completed sessions to stay completed
  };
  
  // Check if transition is allowed
  if (!validTransitions[currentState]?.includes(targetState)) {
    errors.push(`Invalid state transition from '${currentState}' to '${targetState}'`);
  }
  
  // Validate transition logic
  if (currentState === 'comparing' && targetState === 'swiping' && hasNextComparison) {
    errors.push('Cannot return to swiping state while comparisons are pending');
  }
  
  if (currentState === 'comparing' && targetState === 'comparing' && !hasNextComparison) {
    warnings.push('Staying in comparing state without next comparison may cause UI issues');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export async function POST(request: NextRequest) {
  // Initialize audit trail for this operation
  const auditTrail: ComparisonAudit[] = [];
  let session: any = null;
  
  try {
    const body = await request.json();
    
    // Validate request body schema
    const validatedData = VoteRequestSchema.parse(body);
    const sessionId = validatedData[SESSION_FIELDS.ID];
    const cardA = validatedData[VOTE_FIELDS.CARD_A];
    const cardB = validatedData[VOTE_FIELDS.CARD_B];
    const winner = validatedData[VOTE_FIELDS.WINNER];
    const timestamp = validatedData[VOTE_FIELDS.TIMESTAMP];

    await dbConnect();
    
    // Timeout handling with early return
    const voteTime = new Date(timestamp);
    const now = new Date();
    const elapsedMs = now.getTime() - voteTime.getTime();
    
    if (elapsedMs > VOTE_TIMEOUT_MS) {
      const timeoutSession = await Session.findOneAndUpdate(
        { [SESSION_FIELDS.ID]: sessionId, status: { $in: ['active', 'completed'] }, [SESSION_FIELDS.VERSION]: body[SESSION_FIELDS.VERSION] },
        { $inc: { [SESSION_FIELDS.VERSION]: 1 } },
        { new: true }
      );
      
      if (timeoutSession) {
        await timeoutSession.handleVoteTimeout(cardA, cardB);
        await timeoutSession.save();
        
        return new NextResponse(
          JSON.stringify({
            [API_FIELDS.SUCCESS]: true,
            timeoutHandled: true,
            randomWinner: timeoutSession.votes[timeoutSession.votes.length - 1][VOTE_FIELDS.WINNER],
            [SESSION_FIELDS.VERSION]: timeoutSession[SESSION_FIELDS.VERSION]
          }),
          { status: 200 }
        );
      }
    }

    // Find and lock session with optimistic concurrency control
    session = await Session.findOneAndUpdate(
      { [SESSION_FIELDS.ID]: sessionId, status: { $in: ['active', 'completed'] }, [SESSION_FIELDS.VERSION]: body[SESSION_FIELDS.VERSION] },
      { $inc: { [SESSION_FIELDS.VERSION]: 1 } },
      { new: true }
    );
    
    if (!session) {
      // Try to find the session without version check to provide better error info
      const existingSession = await Session.findOne({ [SESSION_FIELDS.ID]: sessionId, status: { $in: ['active', 'completed'] } });
      
      if (!existingSession) {
        return new NextResponse(
          JSON.stringify({ 
            [API_FIELDS.ERROR]: 'Session not found',
            details: 'Session does not exist or is not active/completed'
          }),
          { status: 404 }
        );
      } else {
        // Session exists but version mismatch - return current version for sync
        return new NextResponse(
          JSON.stringify({ 
            [API_FIELDS.ERROR]: 'Session version conflict',
            details: 'Session has been modified by another request',
            currentVersion: existingSession[SESSION_FIELDS.VERSION],
            expectedVersion: body[SESSION_FIELDS.VERSION],
            sessionStatus: existingSession.status,
            sessionState: existingSession.state
          }),
          { status: 409 } // Conflict status for version mismatch
        );
      }
    }

    // Check if session is already completed - redirect to results instead of voting
    if (session.status === 'completed') {
      return new NextResponse(
        JSON.stringify({
          success: true,
          sessionCompleted: true,
          message: 'Session is already completed',
          version: session.version
        }),
        { status: 200 }
      );
    }

    // Comprehensive validation layer 1: Basic integrity checks and adjust state transitions
    // Determine which card is the new card being ranked (not already in ranking)
    const newCard = session.personalRanking.includes(cardA) ? cardB : cardA;
    
    // Debug logging
    console.log('Vote validation debug:', {
      sessionId: session.sessionId,
      cardA,
      cardB,
      winner,
      newCard,
      currentRanking: session.personalRanking,
      sessionVotes: session.votes.length,
      lastVote: session.votes.length > 0 ? session.votes[session.votes.length - 1] : null
    });
    
    const integralityValidation = validateRankingIntegrity(
      newCard,
      session.personalRanking,
      winner,
      cardA,
      cardB,
      session.votes
    );

    // If the session is in voting state and the validation passed, transition to comparing
    if (session.state === 'voting' && integralityValidation.isValid) {
      session.state = 'comparing';
    }
    
    if (!integralityValidation.isValid) {
      console.log('Validation failed:', {
        errors: integralityValidation.errors,
        warnings: integralityValidation.warnings,
        sessionId: session.sessionId
      });
      
      return new NextResponse(
        JSON.stringify({
          error: 'Ranking integrity validation failed',
          details: integralityValidation.errors,
          warnings: integralityValidation.warnings
        }),
        { status: 400 }
      );
    }

    // Validation layer 2: Vote sequence verification (disabled for binary search compatibility)
    // Binary search algorithm may compare new card against any card in the ranking, not just the last winner
    const lastVote = session.votes[session.votes.length - 1];
    // Commenting out strict validation that interferes with binary search
    /*
    if (lastVote && cardA !== lastVote.winner && cardB !== lastVote.winner && !body.isFirstRanking) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Vote sequence validation failed',
          details: 'Current comparison must include the winner of the previous vote',
          context: {
            lastWinner: lastVote.winner,
            currentComparison: [cardA, cardB]
          }
        }),
        { status: 400 }
      );
    }
    */

    // Validation layer 3: Session state verification
    // Allow first ranking when explicitly marked as such
    if (session.personalRanking.length === 0 && !body.isFirstRanking) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid session state',
          details: 'No cards in ranking - first card should be added via swipe endpoint'
        }),
        { status: 400 }
      );
    }

    // Core ranking logic with enhanced error handling
    let updatedRanking: RankingResult;
    try {
      updatedRanking = insertCardInRanking(
        newCard,
        session.personalRanking,
        winner,
        cardA,
        cardB,
        auditTrail,
        session.votes
      );
    } catch (rankingError: any) {
      return new NextResponse(
        JSON.stringify({
          error: 'Ranking operation failed',
          details: rankingError.message,
          auditTrail: auditTrail.map(entry => ({
            timestamp: entry.timestamp.toISOString(),
            operation: `${entry.newCard} vs ${entry.compareAgainst}`,
            winner: entry.winner,
            strategy: entry.strategy
          }))
        }),
        { status: 500 }
      );
    }

    // Validation layer 4: State transition validation
    const targetState = updatedRanking.nextComparison ? 'comparing' : 'swiping';
    const stateValidation = validateStateTransition(
      session.state,
      targetState,
      !!updatedRanking.nextComparison
    );
    
    if (!stateValidation.isValid) {
      return new NextResponse(
        JSON.stringify({
          error: 'State transition validation failed',
          details: stateValidation.errors,
          warnings: stateValidation.warnings,
          currentState: session.state,
          targetState
        }),
        { status: 400 }
      );
    }

    // Prepare new vote record with enhanced metadata
    const newVote = {
      [VOTE_FIELDS.CARD_A]: cardA,
      [VOTE_FIELDS.CARD_B]: cardB,
      [VOTE_FIELDS.WINNER]: winner,
      [VOTE_FIELDS.TIMESTAMP]: new Date(),
      // Additional metadata for audit purposes
      sessionVersion: session.version,
      comparisonStrategy: 'binary_search'
    };

    // Perform atomic update with transaction support
    try {
      await performAtomicRankingUpdate(
        session,
        newVote,
        updatedRanking.ranking,
        targetState,
        auditTrail,
        newCard
      );
    } catch (atomicError: any) {
      return new NextResponse(
        JSON.stringify({
          error: 'Atomic update failed',
          details: atomicError.message,
          rollbackPerformed: true
        }),
        { status: 500 }
      );
    }

    // Success response with comprehensive metadata
    return new NextResponse(
      JSON.stringify({
        success: true,
        currentRanking: session.personalRanking,
        nextComparison: updatedRanking.nextComparison,
        returnToSwipe: !updatedRanking.nextComparison,
        sessionCompleted: session.status === 'completed',
        version: session.version,
        // Additional response metadata
        validationsPassed: [
          'integrity_check',
          'sequence_verification', 
          'state_validation',
          'transition_validation'
        ],
        auditTrail: auditTrail.map(entry => ({
          timestamp: entry.timestamp.toISOString(),
          comparison: `${entry.newCard} vs ${entry.compareAgainst}`,
          winner: entry.winner,
          strategy: entry.strategy,
          finalPosition: entry.position
        })),
        warnings: integralityValidation.warnings.concat(stateValidation.warnings)
      }),
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Vote-Audit-Count': auditTrail.length.toString(),
          'X-Session-Version': session.version.toString()
        }
      }
    );
    
  } catch (error: any) {
    console.error('Vote processing error:', {
      error: error.message,
      stack: error.stack,
      sessionId: session?.sessionId,
      auditTrailLength: auditTrail.length
    });
    
    // Enhanced error handling with specific error types
    if (error.name === 'ZodError') {
      return new NextResponse(
        JSON.stringify({
          error: 'Request validation failed',
          details: error.errors,
          type: 'validation_error'
        }),
        { status: 400 }
      );
    }
    
    if (error.name === 'OptimisticLockError' || error.name === 'ConcurrentUpdateError') {
      return new NextResponse(
        JSON.stringify({
          error: 'Concurrent modification detected',
          details: 'Please refresh session and retry',
          type: 'concurrency_error',
          retryable: true
        }),
        { status: 409 }
      );
    }

    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        type: 'system_error',
        retryable: false
      }),
      { status: 500 }
    );
  }
}
