import { Card } from '../models/Card';
import { CARD_FIELDS } from '../constants/fieldNames';

/**
 * Comprehensive play completion detection utility
 * Handles all scenarios where a play should be marked as completed
 */

export interface PlayCompletionResult {
  shouldComplete: boolean;
  reason: string;
  completionType: 'deck_exhausted' | 'all_cards_processed' | 'manual_override' | 'none';
  metrics: {
    totalCards: number;
    totalSwipes: number;
    personalRankingLength: number;
    leftSwipes: number;
    rightSwipes: number;
  };
}

/**
 * Checks if a play session should be marked as completed
 * Uses multiple detection strategies for comprehensive coverage
 */
export async function checkPlayCompletion(play: any): Promise<PlayCompletionResult> {
  const metrics = {
    totalCards: play.totalCards || 0,
    totalSwipes: play.swipes?.length || 0,
    personalRankingLength: play.personalRanking?.length || 0,
    leftSwipes: play.swipes?.filter((s: any) => s.direction === 'left').length || 0,
    rightSwipes: play.swipes?.filter((s: any) => s.direction === 'right').length || 0
  };

console.log(`🔍 Checking play completion for ${play.uuid?.substring(0, 8)}...`, {
    status: play.status,
    state: play.state,
    metrics,
    lastActivity: play.lastActivity
  });

  // Strategy 1: Check if all deck cards have been swiped AND no votes are pending
  // Don't complete if the play is in voting/comparing state as votes might be pending
  // Don't complete if no swipes have been made (prevents premature completion)
  try {
    const swipedCardIds = new Set(play.swipes?.map((swipe: any) => swipe.uuid) || []);
    const deckCardIds = new Set(play.deck || []);
    
    // Check if all deck cards have been swiped
    const allCardsSwiped = [...deckCardIds].every(cardId => swipedCardIds.has(cardId));
    
    // Don't complete if we're still in voting/comparing phase - wait for votes to finish
    const hasPendingVotes = play.state === 'voting' || play.state === 'comparing';
    
    // Only complete if we have actually swiped cards AND all cards have been processed
    if (allCardsSwiped && deckCardIds.size > 0 && swipedCardIds.size > 0 && !hasPendingVotes) {
      console.log(`✅ Play completion detected: All deck cards have been swiped and no votes pending`);
      return {
        shouldComplete: true,
        reason: `All ${deckCardIds.size} deck cards have been swiped`,
        completionType: 'deck_exhausted',
        metrics
      };
    } else if (allCardsSwiped && hasPendingVotes) {
      console.log(`⏳ All cards swiped but votes are pending (state: ${play.state}) - not completing yet`);
    } else if (swipedCardIds.size === 0) {
      console.log(`⏸️ No cards swiped yet - session just started`);
    }
  } catch (error) {
    console.warn('Failed to check deck exhaustion:', error);
  }

  // Strategy 2: Mathematical verification - all cards have been swiped (left or right)
  // But don't complete if votes are still pending OR if no swipes have been made yet
  const hasPendingVotes = play.state === 'voting' || play.state === 'comparing';
  
  if (metrics.totalCards > 0 && metrics.totalSwipes >= metrics.totalCards && metrics.totalSwipes > 0 && !hasPendingVotes) {
    console.log(`✅ Play completion detected: All cards have been swiped and no votes pending`);
    return {
      shouldComplete: true,
      reason: `All ${metrics.totalCards} cards have been swiped (${metrics.totalSwipes} total swipes: ${metrics.rightSwipes} right, ${metrics.leftSwipes} left)`,
      completionType: 'all_cards_processed',
      metrics
    };
  } else if (metrics.totalCards > 0 && metrics.totalSwipes >= metrics.totalCards && hasPendingVotes) {
    console.log(`⏳ All cards swiped but votes are pending (state: ${play.state}) - not completing yet`);
  } else if (metrics.totalSwipes === 0) {
    console.log(`⏸️ No swipes yet - session just started`);
  }
  
  // Strategy 4: Cross-verification - sum of personal ranking and left swipes equals total cards
  // This is a fallback for edge cases where swipe counting might be inconsistent
  // BUT only if we have actually made some swipes (prevent premature completion)
  const processedCards = metrics.personalRankingLength + metrics.leftSwipes;
  if (metrics.totalCards > 0 && processedCards >= metrics.totalCards && metrics.totalSwipes > 0) {
    console.log(`✅ Play completion detected: All cards accounted for (ranked + discarded)`);
    return {
      shouldComplete: true,
      reason: `All cards accounted for: ${metrics.personalRankingLength} ranked + ${metrics.leftSwipes} discarded = ${processedCards}/${metrics.totalCards}`,
      completionType: 'all_cards_processed',
      metrics
    };
  }

  console.log(`❌ Play completion not detected - session still active`);
  return {
    shouldComplete: false,
    reason: 'Play session is still in progress',
    completionType: 'none',
    metrics
  };
}

/**
 * Safely marks a play as completed with proper state transitions
 * Handles all necessary updates atomically
 */
export async function markPlayAsCompleted(play: any, reason: string): Promise<void> {
  if (play.status === 'completed') {
console.log(`Play ${play.uuid} is already completed, skipping`);
    return;
  }

console.log(`🎊 Marking play ${play.uuid} as completed: ${reason}`);

  // Update play status and state
  play.state = 'completed';
  play.status = 'completed';
  play.completedAt = new Date();
  
  // Remove expiry for completed plays to preserve results indefinitely for sharing
  const noExpiry = new Date('2099-12-31T23:59:59.999Z');
  play.expiresAt = noExpiry;
  
  // Update last activity
  play.lastActivity = new Date();

console.log(`✅ Play ${play.uuid} marked as completed successfully`);
}

/**
 * Force completion check for plays that may be stuck in active state
 * This is used as a recovery mechanism for edge cases
 */
export async function forceCompletionCheckAndUpdate(play: any): Promise<boolean> {
console.log(`🔧 Force completion check for play ${play.uuid}`);
  
  const completionResult = await checkPlayCompletion(play);
  
  if (completionResult.shouldComplete) {
    await markPlayAsCompleted(play, `Force completion: ${completionResult.reason}`);
    await play.save();
    
console.log(`🚨 FORCE COMPLETED play ${play.uuid}:`, {
      reason: completionResult.reason,  
      type: completionResult.completionType,
      metrics: completionResult.metrics
    });
    
    return true;
  }
  
  return false;
}

/**
 * Validates if a play state is consistent
 * Used for debugging and recovery operations
 */
export function validatePlayState(play: any): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for inconsistent states
  if (play.status === 'completed' && play.state !== 'completed') {
    issues.push(`Status is 'completed' but state is '${play.state}'`);
  }
  
  if (play.status === 'active' && play.state === 'completed') {
    issues.push(`State is 'completed' but status is '${play.status}'`);
  }
  
  // Check for missing completion timestamp
  if (play.status === 'completed' && !play.completedAt) {
    issues.push('Play marked as completed but missing completedAt timestamp');
  }
  
  // Check for potential completion that wasn't detected
  const totalCards = play.totalCards || 0;
  const totalSwipes = play.swipes?.length || 0;
  if (totalCards > 0 && totalSwipes >= totalCards && play.status !== 'completed') {
    issues.push(`All cards processed (${totalSwipes}/${totalCards}) but play not marked as completed`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
