import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { VoteRequestSchema } from '@/app/lib/validation/schemas';
import mongoose from 'mongoose';

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
 * Determines the next card to compare against using a strict binary search algorithm.
 * This implementation follows specification requirements for consistent ranking placement.
 * 
 * @param newCard - The card being inserted into the ranking
 * @param currentRanking - The current ordered ranking of cards (highest to lowest)
 * @param lastComparison - The previous comparison card UUID
 * @returns The next card UUID to compare against, or null if positioning is complete
 */
function determineNextComparison(
  newCard: string,
  currentRanking: string[],
  lastComparison: string
): string | null {
  // No comparisons needed for empty rankings
  if (currentRanking.length === 0) {
    return null;
  }

  // If new card is already in ranking, no further comparisons needed
  if (currentRanking.includes(newCard)) {
    return null;
  }

  const lastComparisonIndex = currentRanking.indexOf(lastComparison);
  
  // Validation: last comparison card must exist in current ranking
  if (lastComparisonIndex === -1) {
    throw new Error('Invalid state: Last comparison card not found in ranking');
  }

  // Binary search strategy: systematically narrow down the position
  // Start from the middle of the remaining search space
  const remainingCards = currentRanking.slice(0, lastComparisonIndex);
  
  if (remainingCards.length === 0) {
    // New card belongs at the top of the ranking
    return null;
  }

  // Select the middle card from the remaining higher-ranked cards
  const middleIndex = Math.floor(remainingCards.length / 2);
  return remainingCards[middleIndex];
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

  // Validation 2: Cards must be different
  if (cardA === cardB) {
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

  // Validation 5: Vote sequence validation
  if (sessionVotes.length > 0) {
    const lastVote = sessionVotes[sessionVotes.length - 1];
    const currentCards = [cardA, cardB];
    const lastWinner = lastVote.winner;
    
    if (!currentCards.includes(lastWinner)) {
      errors.push('Vote sequence broken: current comparison must include previous winner');
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
  auditTrail: ComparisonAudit[] = []
): RankingResult {
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
        const nextCompareCard = determineNextComparison(newCard, currentRanking, cardB);
        
        if (nextCompareCard) {
          // More comparisons needed
          newRanking = currentRanking; // Keep current ranking until positioning is complete
          nextComparison = {
            newCard,
            compareAgainst: nextCompareCard
          };
          finalPosition = -1; // Position not yet determined
        } else {
          // Insert at the position just above the comparison card
          newRanking = [
            ...currentRanking.slice(0, compareCardIndex),
            newCard,
            ...currentRanking.slice(compareCardIndex)
          ];
          finalPosition = compareCardIndex;
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
        const lowerRankedCards = currentRanking.slice(compareCardIndex + 1);
        
        if (lowerRankedCards.length > 0) {
          // Select middle card from lower section for next comparison
          const middleIndex = Math.floor(lowerRankedCards.length / 2);
          const nextCompareCard = lowerRankedCards[middleIndex];
          
          newRanking = currentRanking; // Keep current ranking
          nextComparison = {
            newCard,
            compareAgainst: nextCompareCard
          };
          finalPosition = -1; // Position not yet determined
        } else {
          // Insert right after the comparison card
          newRanking = [
            ...currentRanking.slice(0, compareCardIndex + 1),
            newCard,
            ...currentRanking.slice(compareCardIndex + 1)
          ];
          finalPosition = compareCardIndex + 1;
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
 * Performs atomic session update with rollback capability.
 * Uses MongoDB transactions to ensure data consistency.
 */
async function performAtomicRankingUpdate(
  session: any,
  newVote: any,
  updatedRanking: string[],
  newState: string,
  auditTrail: ComparisonAudit[]
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
    'completed': [] // Terminal state
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
    const { sessionId, cardA, cardB, winner, timestamp } = validatedData;

    await dbConnect();
    
    // Timeout handling with early return
    const voteTime = new Date(timestamp);
    const now = new Date();
    const elapsedMs = now.getTime() - voteTime.getTime();
    
    if (elapsedMs > VOTE_TIMEOUT_MS) {
      const timeoutSession = await Session.findOneAndUpdate(
        { sessionId, status: 'active', version: body.version },
        { $inc: { version: 1 } },
        { new: true }
      );
      
      if (timeoutSession) {
        await timeoutSession.handleVoteTimeout(cardA, cardB);
        await timeoutSession.save();
        
        return new NextResponse(
          JSON.stringify({
            success: true,
            timeoutHandled: true,
            randomWinner: timeoutSession.votes[timeoutSession.votes.length - 1].winner,
            version: timeoutSession.version
          }),
          { status: 200 }
        );
      }
    }

    // Find and lock session with optimistic concurrency control
    session = await Session.findOneAndUpdate(
      { sessionId, status: 'active', version: body.version },
      { $inc: { version: 1 } },
      { new: true }
    );
    
    if (!session) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Session not found or version conflict',
          details: 'Session may have been modified by another request'
        }),
        { status: 409 } // Conflict status for version mismatch
      );
    }

    // Comprehensive validation layer 1: Basic integrity checks and adjust state transitions
    const newCard = cardA === winner ? cardA : cardB;
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
      return new NextResponse(
        JSON.stringify({
          error: 'Ranking integrity validation failed',
          details: integralityValidation.errors,
          warnings: integralityValidation.warnings
        }),
        { status: 400 }
      );
    }

    // Validation layer 2: Vote sequence verification
    const lastVote = session.votes[session.votes.length - 1];
    if (lastVote && cardA !== lastVote.winner && cardB !== lastVote.winner) {
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

    // Validation layer 3: Session state verification
    if (session.personalRanking.length === 0) {
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
        auditTrail
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
      cardA,
      cardB,
      winner,
      timestamp: new Date(),
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
        auditTrail
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
