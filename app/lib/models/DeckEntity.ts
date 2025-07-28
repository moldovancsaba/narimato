import { Card } from '../types/card';

/**
 * DeckEntity: Manages the state and operations for a card deck in the application.
 * Provides atomic operations and validation for card position tracking and swipe actions.
 * 
 * Refactored to implement corrected event order:
 * 1. Prepare swipe (validation only)
 * 2. API confirmation
 * 3. Actual card removal or rollback
 */

export class DeckEntity {
  private readonly cards: readonly Card[];
  private currentIndex: number = 0;
  private rightSwipes: Card[] = [];
  // Track cards that are prepared for swipe but not yet confirmed
  private preparedSwipes: Map<string, { cardId: string; direction: 'left' | 'right'; originalIndex: number }> = new Map();

  constructor(cards: Card[]) {
    // Validate deck has cards
    if (cards.length === 0) {
      throw new Error('Deck cannot be empty');
    }

    // Check for duplicates
    const uuids = new Set(cards.map(card => card.uuid));
    if (uuids.size !== cards.length) {
      throw new Error('Deck cannot contain duplicate cards');
    }

    // Create immutable deck
    this.cards = Object.freeze([...cards]);
  }

  // Get current card without removing
  getCurrentCard(): Card | null {
    if (this.currentIndex >= this.cards.length) {
      return null;
    }
    return this.cards[this.currentIndex];
  }

  /**
   * Prepare card for swipe but don't remove it yet.
   * This validates the swipe request before sending to API.
   * Returns true if preparation is successful, false otherwise.
   */
  prepareSwipe(cardId: string): boolean {
    const currentCard = this.getCurrentCard();
    
    // Validation: Card must exist in deck
    if (!currentCard) {
      return false;
    }
    
    // Validation: Card must match current position
    if (currentCard.uuid !== cardId) {
      return false;
    }
    
    // Validation: No duplicate swipes - check if already prepared or completed
    if (this.preparedSwipes.has(cardId)) {
      return false;
    }
    
    // Validation: Check if card was already swiped (in rightSwipes or past currentIndex)
    const alreadySwiped = this.rightSwipes.some(card => card.uuid === cardId) || 
                         this.currentIndex > this.cards.findIndex(card => card.uuid === cardId);
    if (alreadySwiped) {
      return false;
    }
    
    return true;
  }

  /**
   * Only remove card after API confirmation.
   * This method should only be called after successful API response.
   */
  confirmSwipe(cardId: string, direction: 'left' | 'right'): void {
    // For initialization: if the card is not the current card, we're replaying history
    const targetCard = this.cards.find(card => card.uuid === cardId);
    if (!targetCard) {
      throw new Error(`Cannot confirm swipe: card ${cardId} not found in deck`);
    }
    
    const targetIndex = this.cards.findIndex(card => card.uuid === cardId);
    
    // If we're replaying history (card is behind current position), just track it
    if (targetIndex < this.currentIndex) {
      if (direction === 'right') {
        // Only add if not already in rightSwipes
        if (!this.rightSwipes.some(card => card.uuid === cardId)) {
          this.rightSwipes.push(targetCard);
        }
      }
      return;
    }
    
    // For current operations: validate it's the current card
    const currentCard = this.getCurrentCard();
    if (!currentCard || currentCard.uuid !== cardId) {
      throw new Error(`Cannot confirm swipe: card ${cardId} is not the current card`);
    }
    
    // Track right swipes for ranking
    if (direction === 'right') {
      this.rightSwipes.push(currentCard);
    }
    
    // Move to next card by incrementing index
    this.currentIndex++;
    
    // Clear any prepared swipe state for this card
    this.preparedSwipes.delete(cardId);
  }

  /**
   * Rollback if API fails.
   * This removes the prepared swipe state without advancing the deck.
   */
  rollbackSwipe(cardId: string): void {
    // Simply remove from prepared swipes - no deck state changes needed
    this.preparedSwipes.delete(cardId);
  }

  /**
   * @deprecated Use prepareSwipe() and confirmSwipe() instead
   * Legacy method maintained for backward compatibility during transition
   */
  recordSwipe(direction: 'left' | 'right'): void {
    const currentCard = this.getCurrentCard();
    if (!currentCard) return;

    // Only track right swipes for ranking
    if (direction === 'right') {
      this.rightSwipes.push(currentCard);
    }

    // Always increment index to move to next card
    this.currentIndex++;
  }

  // Check if should enter vote phase (for cards after first right swipe)
  shouldEnterVotePhase(): boolean {
    return this.rightSwipes.length > 1;
  }

  // Check if this is the first right swipe
  isFirstRightSwipe(): boolean {
    return this.rightSwipes.length === 1;
  }

  // Get all right-swiped cards
  getRightSwipedCards(): readonly Card[] {
    return [...this.rightSwipes];
  }

  // Get remaining cards count
  getRemainingCount(): number {
    return this.cards.length - this.currentIndex;
  }

  // Check if deck is exhausted
  isExhausted(): boolean {
    return this.currentIndex >= this.cards.length;
  }

  // Get initial deck size
  getInitialSize(): number {
    return this.cards.length;
  }

  getTotalCount(): number {
    return this.cards.length;
  }

  // Get count of prepared but unconfirmed swipes (for debugging/monitoring)
  getPreparedSwipeCount(): number {
    return this.preparedSwipes.size;
  }

  // Serialize deck state for persistence
  serialize(): { cards: Card[]; currentIndex: number; rightSwipes: Card[] } {
    return {
      cards: [...this.cards],
      currentIndex: this.currentIndex,
      rightSwipes: [...this.rightSwipes]
    };
  }

  // Cannot modify deck after creation
  addCard(): never {
    throw new Error('Cannot modify deck after creation');
  }

  removeCard(): never {
    throw new Error('Cannot modify deck after creation');
  }
}
