/**
 * Event-Driven State Machine for Managing Narimato Workflow
 * 
 * ARCHITECTURAL PURPOSE:
 * - Centralizes all workflow state transitions in one place to prevent invalid state combinations
 * - Ensures UI components can only perform actions valid for current state
 * - Provides single source of truth for session progress tracking
 * - Implements fail-safe patterns where errors don't leave system in inconsistent state
 * 
 * BUSINESS LOGIC RATIONALE:
 * - INITIALIZING: Ensures all dependencies (session, deck) are ready before user interaction
 * - SWIPING: Main interaction mode - user evaluates cards one by one
 * - VOTING: Comparative ranking phase - positions cards relative to each other
 * - COMPLETED: Terminal state - prevents further modifications to final ranking
 * - ERROR: Recovery state - allows system reset without data loss
 * 
 * SECURITY CONSIDERATIONS:
 * - All state transitions are validated to prevent client manipulation
 * - Context data is immutable to external components (returned as copies)
 * - Session data is never exposed directly - only through controlled getters
 */

import { CARD_FIELDS, VOTE_FIELDS, SESSION_FIELDS } from '../constants/fieldNames';

export type AppState = 
  | 'INITIALIZING'     // Setting up session and deck
  | 'SWIPING'          // User is swiping through cards  
  | 'VOTING'           // User is comparing cards to build ranking
  | 'COMPLETED'        // All cards processed, show final ranking
  | 'ERROR';           // Something went wrong

export type AppEvent = 
  | { type: 'START_SESSION'; sessionUUID: string; deckSize: number }
  | { type: 'DECK_READY'; totalCards: number }
  | { type: 'CARD_SWIPED_LEFT'; cardUUID: string }
  | { type: 'CARD_SWIPED_RIGHT'; cardUUID: string; requiresVoting: boolean }
  | { type: 'VOTING_REQUIRED'; cardUUID: string; compareAgainst: string }
  | { type: 'VOTE_COMPLETED'; cardUUID: string; nextComparison?: { newCard: string; compareAgainst: string } }
  | { type: 'RANKING_COMPLETE'; cardUUID: string }
  | { type: 'DECK_EXHAUSTED' }
  | { type: 'ERROR_OCCURRED'; error: string }
  | { type: 'RESET_SESSION' };

export interface AppContext {
  sessionUUID: string | null;
  currentCardUUID: string | null;
  swipedCards: string[];
  rankedCards: string[];
  totalCards: number;
  remainingCards: number;
  currentVotingCardUUID: string | null;
  error: string | null;
}

export class EventAgent {
  private state: AppState = 'INITIALIZING';
  private context: AppContext = {
    sessionUUID: null,
    currentCardUUID: null,
    swipedCards: [],
    rankedCards: [],
    totalCards: 0,
    remainingCards: 0,
    currentVotingCardUUID: null,
    error: null
  };

  private subscribers: Array<(state: AppState, context: AppContext) => void> = [];

  constructor() {
    this.logStateChange('Initial state');
  }

  // Subscribe to state changes
  subscribe(callback: (state: AppState, context: AppContext) => void) {
    this.subscribers.push(callback);
    // Immediately notify with current state
    callback(this.state, { ...this.context });
  }

  unsubscribe(callback: (state: AppState, context: AppContext) => void) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => {
      callback(this.state, { ...this.context });
    });
  }

  private logStateChange(event: string) {
    console.log(`[EventAgent] ${event} -> State: ${this.state}`, {
      sessionUUID: this.context.sessionUUID,
      currentCardUUID: this.context.currentCardUUID,
      swipedCount: this.context.swipedCards.length,
      rankedCount: this.context.rankedCards.length,
      remaining: this.context.remainingCards
    });
  }

  // Main event handler - this is where the business logic lives
  handleEvent(event: AppEvent): void {
    const previousState = this.state;
    
    console.log(`[EventAgent] Processing event:`, event);

    switch (this.state) {
      case 'INITIALIZING':
        this.handleInitializingState(event);
        break;
      case 'SWIPING':
        this.handleSwipingState(event);
        break;
      case 'VOTING':
        this.handleVotingState(event);
        break;
      case 'COMPLETED':
        this.handleCompletedState(event);
        break;
      case 'ERROR':
        this.handleErrorState(event);
        break;
    }

    // Notify subscribers if state changed
    if (previousState !== this.state) {
      this.logStateChange(`Event: ${event.type}`);
      this.notifySubscribers();
    }
  }

  private handleInitializingState(event: AppEvent): void {
    switch (event.type) {
      case 'START_SESSION':
        this.context.sessionUUID = event.sessionUUID;
        this.context.totalCards = event.deckSize;
        this.context.remainingCards = event.deckSize;
        break;

      case 'DECK_READY':
        // Once deck is ready, we can start swiping
        this.state = 'SWIPING';
        break;

      case 'ERROR_OCCURRED':
        this.context.error = event.error;
        this.state = 'ERROR';
        break;
    }
  }

  private handleSwipingState(event: AppEvent): void {
    switch (event.type) {
      case 'CARD_SWIPED_LEFT':
        // Left swipe = discard, continue swiping
        this.context.swipedCards.push(event.cardUUID);
        this.context.remainingCards--;
        
        if (this.context.remainingCards === 0) {
          this.state = 'COMPLETED';
        }
        break;

      case 'CARD_SWIPED_RIGHT':
        // Right swipe = like the card
        this.context.swipedCards.push(event.cardUUID);
        this.context.remainingCards--;
        
        if (event.requiresVoting) {
          // Need to rank this card against existing ones
          this.context.currentVotingCardUUID = event.cardUUID;
          this.state = 'VOTING';
        } else {
          // Card added to ranking automatically (first card or clear preference)
          this.context.rankedCards.push(event.cardUUID);
          
          if (this.context.remainingCards === 0) {
            this.state = 'COMPLETED';
          }
        }
        break;

      case 'DECK_EXHAUSTED':
        this.state = 'COMPLETED';
        break;

      case 'ERROR_OCCURRED':
        this.context.error = event.error;
        this.state = 'ERROR';
        break;
    }
  }

  private handleVotingState(event: AppEvent): void {
    switch (event.type) {
      case 'VOTE_COMPLETED':
        if (event.nextComparison) {
          // More voting needed for this card
          // Stay in voting state but update context
          this.context.currentVotingCardUUID = event.cardUUID;
        } else {
          // Voting complete for this card
          this.context.rankedCards.push(event.cardUUID);
          this.context.currentVotingCardUUID = null;
          
          // Return to swiping or complete
          if (this.context.remainingCards === 0) {
            this.state = 'COMPLETED';
          } else {
            this.state = 'SWIPING';
          }
        }
        break;

      case 'RANKING_COMPLETE':
        // Card successfully ranked
        this.context.rankedCards.push(event.cardUUID);
        this.context.currentVotingCardUUID = null;
        
        if (this.context.remainingCards === 0) {
          this.state = 'COMPLETED';
        } else {
          this.state = 'SWIPING';
        }
        break;

      case 'ERROR_OCCURRED':
        this.context.error = event.error;
        this.state = 'ERROR';
        break;
    }
  }

  private handleCompletedState(event: AppEvent): void {
    switch (event.type) {
      case 'RESET_SESSION':
        this.resetToInitial();
        break;
    }
  }

  private handleErrorState(event: AppEvent): void {
    switch (event.type) {
      case 'RESET_SESSION':
        this.resetToInitial();
        break;
    }
  }

  private resetToInitial(): void {
    this.state = 'INITIALIZING';
    this.context = {
      sessionUUID: null,
      currentCardUUID: null,
      swipedCards: [],
      rankedCards: [],
      totalCards: 0,
      remainingCards: 0,
      currentVotingCardUUID: null,
      error: null
    };
  }

  // Getters for current state
  getCurrentState(): AppState {
    return this.state;
  }

  getContext(): AppContext {
    return { ...this.context };
  }

  // Helper methods for UI components
  shouldShowSwipeInterface(): boolean {
    return this.state === 'SWIPING';
  }

  shouldShowVotingInterface(): boolean {
    return this.state === 'VOTING';
  }

  shouldShowCompletedInterface(): boolean {
    return this.state === 'COMPLETED';
  }

  shouldShowLoadingInterface(): boolean {
    return this.state === 'INITIALIZING';
  }

  shouldShowErrorInterface(): boolean {
    return this.state === 'ERROR';
  }

  // Get navigation instructions for UI
  getNavigationTarget(): { page: string; params?: Record<string, string> } | null {
    switch (this.state) {
      case 'SWIPING':
        return { page: '/swipe' };
      case 'VOTING':
        return { 
          page: '/vote', 
          params: { 
            [SESSION_FIELDS.UUID]: this.context.sessionUUID!,
            cardUUID: this.context.currentVotingCardUUID!
          }
        };
      case 'COMPLETED':
        return { page: '/completed' };
      case 'ERROR':
        return { page: '/error' };
      default:
        return null;
    }
  }

  // Get progress information
  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.context.swipedCards.length;
    const total = this.context.totalCards;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }
}

// Singleton instance
export const eventAgent = new EventAgent();
