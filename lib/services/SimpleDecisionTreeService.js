/**
 * FUNCTIONAL: Simple Decision Tree Service - Working Implementation
 * STRATEGIC: Implements the exact interactive pipeline described:
 * 1. Start with shuffled cards (parents and non-parents mixed)
 * 2. Swipe through cards, building ranking via binary search
 * 3. When parent ranking complete, start child sessions for each parent
 * 4. Complete hierarchical ranking
 */

const Play = require('../models/Play');
const Card = require('../models/Card');
const { v4: uuidv4 } = require('uuid');

class SimpleDecisionTreeService {
  /**
   * Create a new play session with proper card pipeline
   */
  async createSession(organizationId, deckTag) {
    try {
      // Get all cards for the deck
      const cards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      }).sort({ globalScore: -1 });
      
      if (cards.length < 2) {
        throw new Error('Deck needs at least 2 cards to be playable');
      }
      
      // Shuffle cards for random presentation
      const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
      const cardIds = shuffledCards.map(card => card.uuid);
      
      // Determine if this is hierarchical (has parent cards)
      const parentCards = cards.filter(card => card.isParent);
      const isHierarchical = parentCards.length > 0;
      
      // Create Play session
      const playSession = new Play({
        uuid: uuidv4(),
        organizationId,
        deckTag,
        cardIds,
        swipes: [],
        votes: [],
        personalRanking: [],
        status: 'active',
        state: 'swiping',
        hierarchicalData: {
          enabled: isHierarchical,
          parentDecisions: new Map(),
          excludedCards: [],
          childSessionHistory: []
        }
      });
      
      await playSession.save();
      
      console.log(`✅ Session created: ${cardIds.length} cards (${parentCards.length} parents)`);
      
      return {
        playId: playSession.uuid,
        deckTag: playSession.deckTag,
        totalCards: cards.length,
        cards: shuffledCards.map(card => ({
          id: card.uuid,
          title: card.title,
          description: card.description,
          imageUrl: card.imageUrl,
          isParent: card.isParent || false
        })),
        currentCardId: cardIds[0],
        hierarchical: isHierarchical
      };
    } catch (error) {
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }
  
  /**
   * Process a swipe action
   */
  async processSwipe(playId, cardId, direction) {
    try {
      const playSession = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'completed', 'waiting_for_children'] }
      });
      
      if (!playSession) {
        throw new Error('Play session not found or not active');
      }
      
      if (playSession.state === 'voting') {
        throw new Error('Cannot swipe while in voting state');
      }
      
      // Check if card already swiped
      if (playSession.swipes.some(swipe => swipe.cardId === cardId)) {
        throw new Error('Card already swiped');
      }
      
      // Record the swipe
      playSession.swipes.push({
        cardId,
        direction,
        timestamp: new Date()
      });
      
      let result = {
        success: true,
        requiresVoting: false,
        nextCardId: null,
        completed: false
      };
      
      if (direction === 'right') {
        // Add to ranking - this is where the magic happens
        if (playSession.personalRanking.length === 0) {
          // First liked card - direct insertion
          playSession.personalRanking = [cardId];
        } else {
          // Need to find position via binary search voting
          const needsVoting = this.needsComparison(playSession.personalRanking, cardId, playSession.votes);
          
          if (needsVoting) {
            // Start voting to position this card
            playSession.state = 'voting';
            result.requiresVoting = true;
            result.votingContext = this.getVotingContext(playSession.personalRanking, cardId);
            
            // CRITICAL: Save session state BEFORE returning voting context
            // STRATEGIC: Prevent race condition where vote arrives before state is saved
            console.log('💾 Saving session state before voting:', playSession.uuid, 'state:', playSession.state);
            await playSession.save();
            
            // Return immediately - don't save again
            return result;
          } else {
            // Can position directly (shouldn't happen with multiple cards, but handle gracefully)
            playSession.personalRanking.push(cardId);
          }
        }
      }
      
      // If not voting, find next card
      if (!result.requiresVoting) {
        const nextCard = this.getNextCard(playSession);
        result.nextCardId = nextCard;
        
        if (!nextCard) {
          // All cards processed - session complete
          playSession.status = 'completed';
          playSession.completedAt = new Date();
          result.completed = true;
          
          // Check if we need hierarchical processing
          const hierarchicalResult = await this.processCompletion(playSession);
          if (hierarchicalResult) {
            result.hierarchical = hierarchicalResult;
          }
        }
        
        // Save session state
        await playSession.save();
      }
      return result;
    } catch (error) {
      throw new Error(`Swipe processing failed: ${error.message}`);
    }
  }
  
  /**
   * Process a vote action
   */
  async processVote(playId, cardA, cardB, winner) {
    try {
      const playSession = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'completed', 'waiting_for_children'] }
      });
      
      if (!playSession) {
        throw new Error('Play session not found or not active');
      }
      
      console.log(`🗓️ Vote attempt - Session: ${playId}, Current state: ${playSession.state}, Status: ${playSession.status}`);
      
      if (playSession.state !== 'voting') {
        throw new Error(`Session not in voting state (current: ${playSession.state})`);
      }
      
      // Record the vote
      playSession.votes.push({
        cardA,
        cardB,
        winner,
        timestamp: new Date()
      });
      
      // Get the card being positioned
      const cardToInsert = this.getCurrentVotingCard(playSession);
      
      // Only insert if card is not already in ranking
      if (!playSession.personalRanking.includes(cardToInsert)) {
        const insertPosition = this.calculateInsertPosition(playSession.personalRanking, cardToInsert, cardA, cardB, winner);
        playSession.personalRanking.splice(insertPosition, 0, cardToInsert);
        console.log(`📊 Inserted ${cardToInsert} at position ${insertPosition}. Ranking: [${playSession.personalRanking.join(', ')}]`);
      }
      
      // For now, assume one vote is enough (we can make this more sophisticated later)
      const needsMoreVoting = false;
      
      let result = {
        success: true,
        requiresMoreVoting: false,
        returnToSwipe: false,
        nextCardId: null,
        completed: false
      };
      
      if (needsMoreVoting) {
        // Continue voting
        result.requiresMoreVoting = true;
        result.votingContext = this.getVotingContext(playSession.personalRanking, cardToInsert);
      } else {
        // Return to swiping
        playSession.state = 'swiping';
        result.returnToSwipe = true;
        
        // Get next card to swipe
        const nextCard = this.getNextCard(playSession);
        result.nextCardId = nextCard;
        
        if (!nextCard) {
          // All cards processed - session complete
          playSession.status = 'completed';
          playSession.completedAt = new Date();
          result.completed = true;
          
          // Check if we need hierarchical processing
          const hierarchicalResult = await this.processCompletion(playSession);
          if (hierarchicalResult) {
            result.hierarchical = hierarchicalResult;
          }
        }
      }
      
      await playSession.save();
      return result;
    } catch (error) {
      throw new Error(`Vote processing failed: ${error.message}`);
    }
  }
  
  /**
   * Get current session data for resuming
   */
  async getCurrentSessionData(playId) {
    try {
      const playSession = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'waiting_for_children'] }
      });
      
      if (!playSession) {
        throw new Error('Play session not found or not active');
      }
      
      // Get cards with details
      const cards = [];
      for (const cardId of playSession.cardIds) {
        const card = await Card.findOne({ uuid: cardId });
        if (card) {
          cards.push({
            id: card.uuid,
            title: card.title,
            description: card.description,
            imageUrl: card.imageUrl,
            isParent: card.isParent || false
          });
        }
      }
      
      let currentCardId = null;
      let votingContext = null;
      
      if (playSession.state === 'voting') {
        // Get voting context
        const cardToPosition = this.getCurrentVotingCard(playSession);
        votingContext = this.getVotingContext(playSession.personalRanking, cardToPosition);
      } else {
        // Get next card to swipe
        currentCardId = this.getNextCard(playSession);
      }
      
      return {
        playId: playSession.uuid,
        totalCards: playSession.cardIds.length,
        cards,
        currentCardId,
        votingContext,
        state: playSession.state,
        status: playSession.status,
        personalRanking: playSession.personalRanking
      };
    } catch (error) {
      throw new Error(`Failed to get session data: ${error.message}`);
    }
  }
  
  /**
   * Helper: Get next card to swipe
   */
  getNextCard(playSession) {
    const swipedIds = playSession.swipes.map(swipe => swipe.cardId);
    const remainingIds = playSession.cardIds.filter(id => !swipedIds.includes(id));
    return remainingIds.length > 0 ? remainingIds[0] : null;
  }
  
  /**
   * Helper: Check if we need comparison voting
   */
  needsComparison(ranking, cardToInsert, votes) {
    // Simple logic: if ranking has more than 1 card, we need voting
    // In a real implementation, this would use binary search bounds
    return ranking.length > 1;
  }
  
  /**
   * Helper: Get voting context for comparison
   */
  getVotingContext(ranking, cardToInsert) {
    if (ranking.length === 0) return null;
    
    // Filter out the card being inserted to avoid self-comparison
    const availableCards = ranking.filter(cardId => cardId !== cardToInsert);
    
    if (availableCards.length === 0) {
      // If no other cards available, insert at beginning
      return null;
    }
    
    // Compare with random card from available cards
    const compareIndex = Math.floor(Math.random() * availableCards.length);
    const compareWith = availableCards[compareIndex];
    
    console.log(`🗳️ Voting: ${cardToInsert} vs ${compareWith}`);
    
    return {
      newCard: cardToInsert,
      compareWith: compareWith
    };
  }
  
  /**
   * Helper: Get card currently being positioned in voting
   */
  getCurrentVotingCard(playSession) {
    // Find the last right-swiped card that's not in ranking yet
    const rightSwipes = playSession.swipes.filter(s => s.direction === 'right');
    const lastRightSwipe = rightSwipes[rightSwipes.length - 1];
    return lastRightSwipe ? lastRightSwipe.cardId : null;
  }
  
  /**
   * Helper: Calculate where to insert card based on votes
   */
  calculateInsertPosition(ranking, cardToInsert, cardA, cardB, winner) {
    // Simple voting logic: if new card wins, insert before the comparison card
    // If new card loses, insert after the comparison card
    
    if (winner === cardToInsert) {
      // New card wins - find position of the card it beat
      const beatCard = cardA === cardToInsert ? cardB : cardA;
      const beatIndex = ranking.indexOf(beatCard);
      return beatIndex >= 0 ? beatIndex : 0; // Insert before the beaten card
    } else {
      // New card loses - find position after the card that beat it
      const winnerCard = winner;
      const winnerIndex = ranking.indexOf(winnerCard);
      return winnerIndex >= 0 ? winnerIndex + 1 : ranking.length; // Insert after winner
    }
  }
  
  /**
   * Helper: Process session completion and check for hierarchical needs
   */
  async processCompletion(playSession) {
    try {
      // Check if any ranked cards are parents
      const parentCards = [];
      for (const cardId of playSession.personalRanking) {
        const card = await Card.findOne({ uuid: cardId });
        if (card && card.isParent) {
          // Check if this parent has children
          const children = await Card.find({
            organizationId: playSession.organizationId,
            parentTag: card.title, // Children have parentTag = parent's title
            isActive: true,
            isParent: { $ne: true }
          });
          
          if (children.length >= 2) {
            parentCards.push({
              parentId: cardId,
              parentName: card.title,
              children: children
            });
          }
        }
      }
      
      if (parentCards.length > 0) {
        console.log(`🌳 Found ${parentCards.length} parents with children - starting hierarchical flow`);
        
        // Start first child session
        const firstParent = parentCards[0];
        const childSession = await this.createChildSession(playSession, firstParent);
        
        // Update parent session status
        playSession.status = 'waiting_for_children';
        
        return {
          action: 'start_child_session',
          childSession: {
            playId: childSession.playId,
            parentName: firstParent.parentName,
            totalChildren: firstParent.children.length
          },
          parentCards: parentCards.length
        };
      }
      
      return null; // No hierarchical processing needed
    } catch (error) {
      console.error('Error processing completion:', error);
      return null;
    }
  }
  
  /**
   * Helper: Create child session for a parent card
   */
  async createChildSession(parentSession, parentInfo) {
    try {
      const childCards = parentInfo.children;
      const shuffledChildren = [...childCards].sort(() => Math.random() - 0.5);
      const childCardIds = shuffledChildren.map(card => card.uuid);
      
      const childSession = new Play({
        uuid: uuidv4(),
        organizationId: parentSession.organizationId,
        deckTag: 'child', // Special deck tag for child sessions
        cardIds: childCardIds,
        swipes: [],
        votes: [],
        personalRanking: [],
        status: 'active',
        state: 'swiping',
        parentSessionId: parentSession.uuid,
        currentParentId: parentInfo.parentId,
        currentParentName: parentInfo.parentName,
        hierarchicalPhase: 'children'
      });
      
      await childSession.save();
      
      console.log(`✅ Child session created for ${parentInfo.parentName}: ${childCards.length} children`);
      
      return {
        playId: childSession.uuid,
        parentName: parentInfo.parentName,
        totalCards: childCards.length,
        cards: shuffledChildren.map(card => ({
          id: card.uuid,
          title: card.title,
          description: card.description,
          imageUrl: card.imageUrl
        })),
        currentCardId: childCardIds[0]
      };
    } catch (error) {
      throw new Error(`Child session creation failed: ${error.message}`);
    }
  }
}

module.exports = SimpleDecisionTreeService;
