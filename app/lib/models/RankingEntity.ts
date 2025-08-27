import { Card } from '../types/card';

export interface Vote {
  cardA: Card;
  cardB: Card;
  winner: Card;
  timestamp: Date;
}

export class RankingEntity {
  private rankedCards: Card[] = [];
  private votes: Vote[] = [];

  // Insert first right-swiped card (automatically rank 1)
  insertFirstCard(card: Card): void {
    if (this.rankedCards.length > 0) {
      throw new Error('Cannot insert first card - ranking already has cards');
    }
    this.rankedCards.push(card);
  }

  // Get card to compare against (starts from highest rank)
  findComparisonCard(): Card | null {
    if (this.rankedCards.length === 0) {
      return null;
    }
    return this.rankedCards[0]; // Start with highest ranked card
  }

  // Record vote and determine if more comparisons needed
  recordVoteAndGetNextComparison(newCard: Card, compareAgainst: Card, winner: Card): Card | null {
    // Validate vote
    if (winner.uuid !== newCard.uuid && winner.uuid !== compareAgainst.uuid) {
      throw new Error('Winner must be one of the compared cards');
    }

    // Record vote
    this.votes.push({
      cardA: newCard,
      cardB: compareAgainst,
      winner,
      timestamp: new Date()
    });

    // If new card won, continue comparing down the ranking
    if (winner.uuid === newCard.uuid) {
      const currentPos = this.rankedCards.findIndex(c => c.uuid === compareAgainst.uuid);
      if (currentPos < this.rankedCards.length - 1) {
        // Compare with next card down
        return this.rankedCards[currentPos + 1];
      }
      // Won against last card, insert at end
      this.rankedCards.push(newCard);
      return null;
    } else {
      // Lost comparison, insert before the winning card
      const position = this.rankedCards.findIndex(c => c.uuid === compareAgainst.uuid);
      this.rankedCards.splice(position, 0, newCard);
      return null;
    }
  }

  // Get current ranking
  getCurrentRanking(): readonly Card[] {
    return [...this.rankedCards];
  }

  // Get vote history
  getVoteHistory(): readonly Vote[] {
    return [...this.votes];
  }

  // Get number of ranked cards
  getRankedCount(): number {
    return this.rankedCards.length;
  }

  // Check if card is already ranked
  isCardRanked(cardId: string): boolean {
    return this.rankedCards.some(card => card.uuid === cardId);
  }
}

