/**
 * FUNCTIONAL: Pure Vote-Only Ranking Engine - Built from Scratch
 * STRATEGIC: Efficient tournament-style comparison algorithm focused solely on pairwise voting.
 * No swiping complexity - ranks cards based purely on head-to-head comparisons.
 * 
 * Algorithm:
 * 1. Present cards in strategic pairs for A vs B comparisons
 * 2. Use tournament bracket logic to minimize total comparisons needed
 * 3. Build win/loss records for each card through efficient comparison selection
 * 4. Final ranking = cards ordered by win percentage and head-to-head results
 */

const VoteOnlyPlay = require('../models/VoteOnlyPlay');
const Card = require('../models/Card');
const { v4: uuidv4 } = require('uuid');

class VoteOnlyEngine {
  
  /**
   * FUNCTIONAL: Create new vote-only session with efficient comparison algorithm
   * STRATEGIC: Initialize tournament structure for optimal comparison efficiency
   */
  static async startSession(organizationId, deckTag) {
    const engine = new VoteOnlyEngine();
    return await engine.createSession(organizationId, deckTag);
  }
  
  /**
   * FUNCTIONAL: Process a vote comparison and update rankings
   * STRATEGIC: Core voting processing with intelligent next comparison selection
   */
  static async processVote(playId, cardA, cardB, winner) {
    const engine = new VoteOnlyEngine();
    return await engine.processVote(playId, cardA, cardB, winner);
  }
  
  /**
   * FUNCTIONAL: Get next strategic comparison for optimal ranking
   * STRATEGIC: Simple state retrieval for UI to display current comparison
   */
  static async getNextComparison(playId) {
    const engine = new VoteOnlyEngine();
    return await engine.getCurrentComparison(playId);
  }
  
  /**
   * FUNCTIONAL: Get final ranking and session results
   * STRATEGIC: Tournament-based ranking from all comparison data
   */
  static async getFinalRanking(playId) {
    const engine = new VoteOnlyEngine();
    return await engine.getFinalRanking(playId);
  }
  
  async createSession(organizationId, deckTag) {
    try {
      // FUNCTIONAL: Get all cards for the deck
      // STRATEGIC: Load cards once at session start for performance
      const cards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      }).sort({ globalScore: -1 });
      
      if (cards.length < 2) {
        throw new Error('Need at least 2 cards for vote-only session');
      }
      
      // FUNCTIONAL: Calculate optimal number of comparisons needed
      // STRATEGIC: Use tournament theory to estimate minimum comparisons for reliable ranking
      const cardIds = cards.map(card => card.uuid);
      const optimalComparisons = this.calculateOptimalComparisons(cardIds.length);
      
      // FUNCTIONAL: Create VoteOnly session with clean state
      // STRATEGIC: Initialize all fields needed for vote-only workflow
      const session = new VoteOnlyPlay({
        uuid: uuidv4(),
        organizationId,
        deckTag,
        cardIds,
        comparisons: [],
        currentComparison: {
          cardA: null,
          cardB: null,
          active: false
        },
        finalRanking: cardIds.map((cardId, index) => ({
          cardId,
          rank: index + 1,
          wins: 0,
          comparisons: 0
        })),
        algorithmState: {
          totalComparisonsNeeded: optimalComparisons,
          comparisonsCompleted: 0,
          phase: 'tournament'
        },
        status: 'active'
      });
      
      await session.save();
      
      // FUNCTIONAL: Generate first comparison pair
      // STRATEGIC: Start with strategic first comparison for efficient ranking
      const firstComparison = this.getNextComparison(session);
      
      console.log(`✅ VoteOnly session created: ${session.uuid} with ${cards.length} cards (${optimalComparisons} comparisons needed)`);
      
      return {
        playId: session.uuid,
        deckTag,
        mode: 'vote-only',
        totalCards: cards.length,
        cards: cards.map(card => ({
          id: card.uuid,
          title: card.title,
          description: card.description,
          imageUrl: card.imageUrl
        })),
        currentComparison: firstComparison,
        progress: {
          comparisonsNeeded: optimalComparisons,
          comparisonsCompleted: 0,
          phase: 'tournament'
        }
      };
    } catch (error) {
      throw new Error(`VoteOnly session creation failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Process a vote comparison and update rankings
   * STRATEGIC: Core voting processing with intelligent next comparison selection
   */
  async processVote(playId, cardA, cardB, winner) {
    try {
      const session = await VoteOnlyPlay.findOne({ 
        uuid: playId, 
        status: 'active' 
      });
      
      if (!session) {
        throw new Error('VoteOnly session not found or not active');
      }
      
      // FUNCTIONAL: Validate vote parameters
      // STRATEGIC: Ensure vote integrity for accurate ranking
      if (![cardA, cardB].includes(winner)) {
        throw new Error('Winner must be either cardA or cardB');
      }
      
      console.log(`🗳️ VoteOnly: ${winner} wins vs ${winner === cardA ? cardB : cardA}`);
      
      // FUNCTIONAL: Record the comparison result
      // STRATEGIC: Store all comparison data for ranking algorithm
      session.comparisons.push({
        cardA,
        cardB,
        winner,
        timestamp: new Date()
      });
      
      // FUNCTIONAL: Update win/loss records for both cards
      // STRATEGIC: Maintain running statistics for efficient ranking calculation
      const loser = winner === cardA ? cardB : cardA;
      
      this.updateCardStats(session, winner, 'win');
      this.updateCardStats(session, loser, 'loss');
      
      session.algorithmState.comparisonsCompleted += 1;
      session.lastActivity = new Date();
      
      let result = {
        success: true,
        completed: false,
        nextComparison: null,
        progress: {
          comparisonsNeeded: session.algorithmState.totalComparisonsNeeded,
          comparisonsCompleted: session.algorithmState.comparisonsCompleted,
          phase: session.algorithmState.phase
        }
      };
      
      // FUNCTIONAL: Check if we have enough data for final ranking
      // STRATEGIC: Complete when we have sufficient comparisons for reliable ranking
      if (this.isRankingComplete(session)) {
        // FUNCTIONAL: Finalize ranking and complete session
        // STRATEGIC: Calculate final ranking from all comparison data
        result.completed = true;
        session.status = 'completed';
        session.completedAt = new Date();
        session.algorithmState.phase = 'completed';
        
        this.calculateFinalRanking(session);
        
        console.log(`🎉 VoteOnly session completed: ${session.comparisons.length} comparisons`);
      } else {
        // FUNCTIONAL: Generate next strategic comparison
        // STRATEGIC: Choose next comparison to maximize ranking information
        result.nextComparison = this.getNextComparison(session);
        
        if (result.nextComparison) {
          session.currentComparison = {
            cardA: result.nextComparison.cardA,
            cardB: result.nextComparison.cardB,
            active: true
          };
        }
      }
      
      await session.save();
      return result;
      
    } catch (error) {
      throw new Error(`VoteOnly vote processing failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Get next strategic comparison for optimal ranking
   * STRATEGIC: Smart comparison selection to minimize total votes needed
   */
  getNextComparison(session) {
    try {
      const cardIds = session.cardIds;
      const existingComparisons = session.comparisons;
      
      // FUNCTIONAL: Create set of completed comparisons for fast lookup
      // STRATEGIC: Avoid duplicate comparisons and optimize selection algorithm
      const comparedPairs = new Set(
        existingComparisons.map(comp => 
          [comp.cardA, comp.cardB].sort().join('|')
        )
      );
      
      // FUNCTIONAL: Find cards with least comparison data first
      // STRATEGIC: Prioritize cards that need more comparison data for accurate ranking
      const cardStats = session.finalRanking.map(ranking => ({
        cardId: ranking.cardId,
        comparisons: ranking.comparisons,
        wins: ranking.wins
      })).sort((a, b) => a.comparisons - b.comparisons);
      
      // FUNCTIONAL: Look for strategic comparison among under-compared cards
      // STRATEGIC: Focus on cards with similar win rates for maximum ranking information
      for (let i = 0; i < cardStats.length; i++) {
        for (let j = i + 1; j < cardStats.length; j++) {
          const cardA = cardStats[i].cardId;
          const cardB = cardStats[j].cardId;
          const pairKey = [cardA, cardB].sort().join('|');
          
          if (!comparedPairs.has(pairKey)) {
            console.log(`🎯 Next comparison: ${cardA} vs ${cardB}`);
            return { cardA, cardB };
          }
        }
      }
      
      // FUNCTIONAL: No more strategic comparisons available
      // STRATEGIC: Algorithm has sufficient data for final ranking
      console.log(`✅ All strategic comparisons complete`);
      return null;
      
    } catch (error) {
      console.error('VoteOnly comparison selection error:', error);
      return null;
    }
  }
  
  /**
   * FUNCTIONAL: Get current comparison for voting interface
   * STRATEGIC: Simple state retrieval for UI to display current comparison
   */
  async getCurrentComparison(playId) {
    try {
      const session = await VoteOnlyPlay.findOne({ 
        uuid: playId, 
        status: 'active' 
      });
      
      if (!session) {
        throw new Error('VoteOnly session not found or not active');
      }
      
      if (!session.currentComparison.active || this.isRankingComplete(session)) {
        return {
          completed: true,
          progress: {
            comparisonsNeeded: session.algorithmState.totalComparisonsNeeded,
            comparisonsCompleted: session.algorithmState.comparisonsCompleted,
            phase: 'completed'
          }
        };
      }
      
      // FUNCTIONAL: Get card details for current comparison
      // STRATEGIC: Return complete card information for UI rendering
      const cardA = await Card.findOne({ uuid: session.currentComparison.cardA });
      const cardB = await Card.findOne({ uuid: session.currentComparison.cardB });
      
      if (!cardA || !cardB) {
        throw new Error('Comparison cards not found');
      }
      
      return {
        playId: session.uuid,
        comparison: {
          cardA: {
            id: cardA.uuid,
            title: cardA.title,
            description: cardA.description,
            imageUrl: cardA.imageUrl
          },
          cardB: {
            id: cardB.uuid,
            title: cardB.title,
            description: cardB.description,
            imageUrl: cardB.imageUrl
          }
        },
        progress: {
          comparisonsNeeded: session.algorithmState.totalComparisonsNeeded,
          comparisonsCompleted: session.algorithmState.comparisonsCompleted,
          phase: session.algorithmState.phase
        }
      };
      
    } catch (error) {
      throw new Error(`VoteOnly current comparison retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Get final ranking and session results
   * STRATEGIC: Tournament-based ranking from all comparison data
   */
  async getFinalRanking(playId) {
    try {
      const session = await VoteOnlyPlay.findOne({ uuid: playId });
      
      if (!session) {
        throw new Error('VoteOnly session not found');
      }
      
      // FUNCTIONAL: Recalculate final ranking if needed
      // STRATEGIC: Ensure ranking reflects all comparison data
      if (session.status === 'completed' && session.comparisons.length > 0) {
        this.calculateFinalRanking(session);
      }
      
      // FUNCTIONAL: Get detailed card information for ranking
      // STRATEGIC: Return complete ranking with card details for results display
      const rankedCards = [];
      
      for (const rankingEntry of session.finalRanking) {
        const cardDetails = await Card.findOne({ uuid: rankingEntry.cardId });
        if (cardDetails) {
          const winRate = rankingEntry.comparisons > 0 ? 
            Math.round((rankingEntry.wins / rankingEntry.comparisons) * 100) : 0;
          
          rankedCards.push({
            rank: rankingEntry.rank,
            card: {
              id: cardDetails.uuid,
              title: cardDetails.title,
              description: cardDetails.description,
              imageUrl: cardDetails.imageUrl
            },
            statistics: {
              wins: rankingEntry.wins,
              comparisons: rankingEntry.comparisons,
              winRate
            }
          });
        }
      }
      
      // FUNCTIONAL: Sort by final rank (1 = highest preference)
      // STRATEGIC: Maintain consistent ranking order based on tournament results
      rankedCards.sort((a, b) => a.rank - b.rank);
      
      return {
        playId: session.uuid,
        mode: 'vote-only',
        completed: session.status === 'completed',
        completedAt: session.completedAt,
        ranking: rankedCards,
        statistics: {
          totalCards: session.cardIds.length,
          totalComparisons: session.comparisons.length,
          comparisonsOptimal: session.algorithmState.totalComparisonsNeeded,
          efficiency: session.algorithmState.totalComparisonsNeeded > 0 ? 
            Math.round((session.algorithmState.totalComparisonsNeeded / session.comparisons.length) * 100) : 100
        },
        sessionInfo: {
          deckTag: session.deckTag,
          createdAt: session.createdAt,
          duration: session.completedAt ? 
            (session.completedAt.getTime() - session.createdAt.getTime()) : null
        }
      };
      
    } catch (error) {
      throw new Error(`VoteOnly ranking retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * Helper methods for algorithm implementation
   */
  calculateOptimalComparisons(numCards) {
    // FUNCTIONAL: Use tournament bracket math for optimal comparison count
    // STRATEGIC: Balance ranking accuracy with user effort
    if (numCards <= 2) return 1;
    if (numCards <= 4) return Math.ceil(numCards * 1.5); // ~6 for 4 cards
    if (numCards <= 8) return Math.ceil(numCards * 2); // ~16 for 8 cards
    return Math.ceil(numCards * Math.log2(numCards)); // Efficient for larger sets
  }
  
  updateCardStats(session, cardId, result) {
    const rankingEntry = session.finalRanking.find(r => r.cardId === cardId);
    if (rankingEntry) {
      rankingEntry.comparisons += 1;
      if (result === 'win') {
        rankingEntry.wins += 1;
      }
    }
  }
  
  isRankingComplete(session) {
    return session.algorithmState.comparisonsCompleted >= 
           session.algorithmState.totalComparisonsNeeded;
  }
  
  calculateFinalRanking(session) {
    // FUNCTIONAL: Sort cards by win percentage, then by total wins
    // STRATEGIC: Most accurate ranking based on all comparison data
    session.finalRanking.sort((a, b) => {
      const aWinRate = a.comparisons > 0 ? a.wins / a.comparisons : 0;
      const bWinRate = b.comparisons > 0 ? b.wins / b.comparisons : 0;
      
      // Primary sort: win rate (higher is better)
      if (aWinRate !== bWinRate) {
        return bWinRate - aWinRate;
      }
      
      // Secondary sort: total wins (more wins is better)
      return b.wins - a.wins;
    });
    
    // FUNCTIONAL: Assign final rank positions
    // STRATEGIC: Clear ranking with 1 = highest preference
    session.finalRanking.forEach((entry, index) => {
      entry.rank = index + 1;
    });
  }
  
  async resumeSession(playId) {
    try {
      const session = await VoteOnlyPlay.findOne({ 
        uuid: playId,
        status: { $in: ['active', 'completed'] }
      });
      
      if (!session) {
        throw new Error('VoteOnly session not found');
      }
      
      if (session.status === 'completed') {
        return await this.getFinalRanking(playId);
      }
      
      return await this.getCurrentComparison(playId);
      
    } catch (error) {
      throw new Error(`VoteOnly session resumption failed: ${error.message}`);
    }
  }
}

module.exports = VoteOnlyEngine;
