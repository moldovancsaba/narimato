/**
 * DEPRECATED: Vote-Only engine stub
 * Vote-Only mode has been removed. Importing this module will throw.
 */

function removed() {
  throw new Error('Vote-Only mode has been removed');
}

module.exports = {
  startSession: removed,
  getNextComparison: removed,
  recordVote: removed,
  getResults: removed
};

const { v4: uuidv4 } = require('uuid');
const Card = require('../models/Card');

/**
 * FUNCTIONAL: Vote-Only Engine implementing the binary search ranking algorithm
 * STRATEGIC: Builds from scratch following the exact VOTE-ONLY specification
 * 
 * Core Concepts:
 * - UNRANKED DECK: All cards not yet introduced into play
 * - RANKED DECK: Temporary working set of cards currently being compared
 * - PERSONAL RANK LIST: Permanent record of card order
 */
class VoteOnlyEngine {
  
  /**
   * FUNCTIONAL: Initialize a new vote-only session with 2 random cards
   * STRATEGIC: Implements Step 1-3 from the specification
   */
  static async startSession(organizationId, deckTag) {
    try {
      console.log(`🗳️ Starting Vote-Only session for deck: ${deckTag}`);
      
      // Get all cards for the deck
      const cards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      });

      if (cards.length < 2) {
        throw new Error('Deck needs at least 2 cards to be playable');
      }

      // Convert cards to our internal format
      const allCards = cards.map(card => ({
        id: card.uuid,
        title: card.title,
        description: card.description,
        imageUrl: card.imageUrl
      }));

      // Create session ID
      const sessionId = uuidv4();

      // Step 1-2: Choose 2 random cards from UNRANKED DECK
      const shuffledCards = [...allCards].sort(() => Math.random() - 0.5);
      const [card1, card2] = shuffledCards.splice(0, 2);
      
      // Initialize session state
      const sessionState = {
        sessionId,
        organizationId,
        deckTag,
        
        // Core algorithm state
        unrankedDeck: shuffledCards,  // All remaining cards
        rankedDeck: [card1.id, card2.id],  // Temporary working set
        personalRankList: [],  // Permanent ranking (empty until first vote)
        
        // Metadata
        allCards,
        totalCards: allCards.length,
        votesCompleted: 0,
        currentComparison: {
          card1: card1.id,
          card2: card2.id
        },
        
        // Session management
        status: 'active',
        createdAt: new Date().toISOString()
      };

      // Store in memory (in production, this would be in database)
      global.voteOnlySessions = global.voteOnlySessions || {};
      global.voteOnlySessions[sessionId] = sessionState;

      console.log(`✅ Vote-Only session created: ${sessionId}`);
      console.log(`📋 Initial comparison: ${card1.title} vs ${card2.title}`);

      return {
        sessionId,
        comparison: {
          card1,
          card2
        },
        progress: {
          votesCompleted: 0,
          totalCards: allCards.length,
          unrankedRemaining: shuffledCards.length
        }
      };
      
    } catch (error) {
      console.error('Vote-Only session creation failed:', error);
      throw new Error(`Failed to start Vote-Only session: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Process a vote and update the ranking system
   * STRATEGIC: Implements Steps 3, 7-12 from the specification
   */
  static async processVote(sessionId, winner, loser) {
    try {
      const session = global.voteOnlySessions?.[sessionId];
      if (!session || session.status !== 'active') {
        throw new Error('Session not found or not active');
      }

      console.log(`🗳️ Processing vote - Winner: ${winner}, Loser: ${loser}`);
      
      // Find card details
      const winnerCard = session.allCards.find(c => c.id === winner);
      const loserCard = session.allCards.find(c => c.id === loser);
      
      console.log(`🏆 ${winnerCard?.title} beats ${loserCard?.title}`);

      // Step 3: If this is the first vote, initialize PERSONAL RANK LIST
      if (session.personalRankList.length === 0) {
        session.personalRankList = [winner, loser];  // Winner first, loser second
        console.log(`📋 First vote - initialized ranking: [${winnerCard?.title}, ${loserCard?.title}]`);
      } else {
        // Update ranking based on vote result
        this._updateRankingPositions(session, winner, loser);
      }

      session.votesCompleted++;
      
      // Step 4-6: Challenger Insertion Process
      const nextComparison = this._getNextComparison(session);
      
      if (nextComparison.completed) {
        // Session is complete
        session.status = 'completed';
        session.completedAt = new Date().toISOString();
        
        const finalRanking = session.personalRankList.map((cardId, index) => {
          const card = session.allCards.find(c => c.id === cardId);
          return {
            rank: index + 1,
            card
          };
        });

        console.log(`🎉 Vote-Only session completed!`);
        console.log(`🏅 Final ranking:`, finalRanking.map(r => `${r.rank}. ${r.card.title}`));

        return {
          completed: true,
          finalRanking,
          totalVotes: session.votesCompleted
        };
      } else {
        // Continue with next comparison
        session.currentComparison = nextComparison;
        
        const card1 = session.allCards.find(c => c.id === nextComparison.card1);
        const card2 = session.allCards.find(c => c.id === nextComparison.card2);
        
        console.log(`🔄 Next comparison: ${card1?.title} vs ${card2?.title}`);

        return {
          completed: false,
          comparison: {
            card1,
            card2
          },
          progress: {
            votesCompleted: session.votesCompleted,
            totalCards: session.totalCards,
            unrankedRemaining: session.unrankedDeck.length
          }
        };
      }
      
    } catch (error) {
      console.error('Vote processing failed:', error);
      throw new Error(`Failed to process vote: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Get next comparison following the challenger insertion algorithm
   * STRATEGIC: Implements Steps 4-12 from the specification
   */
  static _getNextComparison(session) {
    // Step 6: Check if UNRANKED DECK is empty
    if (session.unrankedDeck.length === 0) {
      // Step 13: All cards are ranked - END
      console.log(`🔚 No more unranked cards - session complete`);
      return { completed: true };
    }

    // Step 4: Choose a random card from UNRANKED DECK as CHALLENGER
    const challengerIndex = Math.floor(Math.random() * session.unrankedDeck.length);
    const challenger = session.unrankedDeck[challengerIndex];
    
    // Remove challenger from UNRANKED DECK
    session.unrankedDeck.splice(challengerIndex, 1);
    
    // Step 5: Place CHALLENGER at end of PERSONAL RANK LIST and into RANKED DECK
    session.personalRankList.push(challenger.id);
    session.rankedDeck.push(challenger.id);
    
    const challengerCard = session.allCards.find(c => c.id === challenger.id);
    console.log(`🎯 New challenger: ${challengerCard?.title} (added to end of ranking)`);
    console.log(`📊 Current ranking length: ${session.personalRankList.length}`);

    // Step 7-8: Compare CHALLENGER randomly against any card in RANKED DECK
    if (session.rankedDeck.length <= 1) {
      // Only challenger in ranked deck - this shouldn't happen but handle gracefully
      return this._getNextComparison(session);
    }

    // Pick random opponent from RANKED DECK (excluding challenger)
    const opponents = session.rankedDeck.filter(id => id !== challenger.id);
    if (opponents.length === 0) {
      // No valid opponents - continue to next challenger
      return this._getNextComparison(session);
    }
    
    const opponentId = opponents[Math.floor(Math.random() * opponents.length)];
    const opponentCard = session.allCards.find(c => c.id === opponentId);
    
    console.log(`⚔️ Challenger vs Opponent: ${challengerCard?.title} vs ${opponentCard?.title}`);

    return {
      card1: challenger.id,
      card2: opponentId,
      completed: false
    };
  }

  /**
   * FUNCTIONAL: Update ranking positions based on vote result
   * STRATEGIC: Implements Steps 9-11 from the specification
   */
  static _updateRankingPositions(session, winner, loser) {
    const winnerIndex = session.personalRankList.indexOf(winner);
    const loserIndex = session.personalRankList.indexOf(loser);
    
    console.log(`📊 Before update: Winner at ${winnerIndex}, Loser at ${loserIndex}`);
    
    // Find the challenger (most recently added card)
    const challenger = session.personalRankList[session.personalRankList.length - 1];
    
    if (winner === challenger) {
      // Step 10: CHALLENGER wins path
      console.log(`🏆 Challenger wins - updating positions`);
      
      // CHALLENGER takes position of the challenged card
      const challengedPosition = loserIndex;
      
      // Remove challenger from end
      session.personalRankList.pop();
      
      // Insert challenger at challenged position
      session.personalRankList.splice(challengedPosition, 0, winner);
      
      // Delete the challenged card and all worse cards from RANKED DECK
      this._deleteFromRankedDeck(session, loser, 'and_all_worse');
      
    } else {
      // Step 11: CHALLENGER loses path  
      console.log(`😞 Challenger loses - keeping current position`);
      
      // CHALLENGER keeps its current position (already at end)
      // Delete the challenged card and all better cards from RANKED DECK
      this._deleteFromRankedDeck(session, winner, 'and_all_better');
    }
    
    console.log(`📊 After update ranking:`, session.personalRankList.map((id, idx) => {
      const card = session.allCards.find(c => c.id === id);
      return `${idx + 1}. ${card?.title}`;
    }));
  }

  /**
   * FUNCTIONAL: Delete cards from RANKED DECK based on comparison result
   * STRATEGIC: Implements deletion logic from Steps 9-11
   */
  static _deleteFromRankedDeck(session, referenceCard, deleteType) {
    const referenceIndex = session.personalRankList.indexOf(referenceCard);
    
    if (deleteType === 'and_all_worse') {
      // Delete reference card and all cards worse than it (higher index)
      const toDelete = session.personalRankList.slice(referenceIndex);
      session.rankedDeck = session.rankedDeck.filter(id => !toDelete.includes(id));
      console.log(`🗑️ Deleted from RANKED DECK: ${toDelete.length} cards (worse than reference)`);
      
    } else if (deleteType === 'and_all_better') {
      // Delete reference card and all cards better than it (lower index)  
      const toDelete = session.personalRankList.slice(0, referenceIndex + 1);
      session.rankedDeck = session.rankedDeck.filter(id => !toDelete.includes(id));
      console.log(`🗑️ Deleted from RANKED DECK: ${toDelete.length} cards (better than reference)`);
    }
    
    console.log(`📦 RANKED DECK now contains: ${session.rankedDeck.length} cards`);
  }

  /**
   * FUNCTIONAL: Get final results for a completed session
   * STRATEGIC: Returns complete ranking data for results display
   */
  static async getFinalResults(sessionId) {
    try {
      const session = global.voteOnlySessions?.[sessionId];
      if (!session) {
        throw new Error('Session not found');
      }

      const finalRanking = session.personalRankList.map((cardId, index) => {
        const card = session.allCards.find(c => c.id === cardId);
        return {
          rank: index + 1,
          card
        };
      });

      return {
        sessionId,
        deckTag: session.deckTag,
        status: session.status,
        ranking: finalRanking,
        totalCards: session.totalCards,
        totalVotes: session.votesCompleted,
        completedAt: session.completedAt
      };
      
    } catch (error) {
      throw new Error(`Failed to get final results: ${error.message}`);
    }
  }
}

module.exports = VoteOnlyEngine;
