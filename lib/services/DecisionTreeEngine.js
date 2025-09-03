/**
 * FUNCTIONAL: Clean Decision Tree Engine - Built from Scratch
 * STRATEGIC: Simple, working implementation of the exact workflow specified:
 * 1. Shuffle all cards (parents + non-parents mixed)
 * 2. Swipe through cards one by one
 * 3. Right swipes go into ranking via comparison votes
 * 4. When all cards processed, check for hierarchical needs
 * 5. Create child sessions for parent cards with children
 */

const Play = require('../models/Play');
const Card = require('../models/Card');
const { v4: uuidv4 } = require('uuid');

class DecisionTreeEngine {
  
  /**
   * Create a new play session
   */
  async createSession(organizationId, deckTag) {
    try {
      // Get all cards for the deck
      const cards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      });
      
      if (cards.length < 2) {
        throw new Error('Need at least 2 cards');
      }
      
      // Shuffle cards randomly
      const shuffled = cards.sort(() => Math.random() - 0.5);
      
      // Create session
      const session = new Play({
        uuid: uuidv4(),
        organizationId,
        deckTag,
        cardIds: shuffled.map(c => c.uuid),
        swipes: [],
        votes: [],
        personalRanking: [],
        status: 'active',
        state: 'swiping'
      });
      
      await session.save();
      
      console.log(`✅ New session: ${session.uuid} with ${cards.length} cards`);
      
      return {
        playId: session.uuid,
        deckTag,
        totalCards: cards.length,
        cards: shuffled.map(c => ({
          id: c.uuid,
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl
        })),
        currentCardId: shuffled[0].uuid
      };
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }
  
  /**
   * Process swipe action
   */
  async processSwipe(playId, cardId, direction) {
    try {
      const session = await Play.findOne({ uuid: playId, status: 'active' });
      if (!session) {
        throw new Error('Session not found');
      }
      
      console.log(`👆 Swipe: ${cardId} ${direction}`);
      
      // Record swipe
      session.swipes.push({
        cardId,
        direction,
        timestamp: new Date()
      });
      
      let result = {
        success: true,
        completed: false,
        requiresVoting: false,
        nextCardId: null
      };
      
      // Handle right swipe (like)
      if (direction === 'right') {
        if (session.personalRanking.length === 0) {
          // First card - direct add
          session.personalRanking.push(cardId);
          console.log(`📊 First card added: [${cardId}]`);
        } else {
          // Need to position via voting
          result.requiresVoting = true;
          result.votingContext = {
            newCard: cardId,
            compareWith: this.getComparisonCard(session.personalRanking)
          };
          
          // Set session to voting state
          session.state = 'voting';
          await session.save();
          
          console.log(`🗳️ Voting needed: ${cardId} vs ${result.votingContext.compareWith}`);
          return result;
        }
      }
      
      // Find next card
      const swipedIds = session.swipes.map(s => s.cardId);
      const remaining = session.cardIds.filter(id => !swipedIds.includes(id));
      
      if (remaining.length > 0) {
        result.nextCardId = remaining[0];
      } else {
        // All cards processed
        result.completed = true;
        session.status = 'completed';
        
        // Check for hierarchical processing
        const hierarchicalResult = await this.processHierarchical(session);
        if (hierarchicalResult) {
          result.hierarchical = hierarchicalResult;
        }
      }
      
      await session.save();
      return result;
      
    } catch (error) {
      throw new Error(`Swipe failed: ${error.message}`);
    }
  }
  
  /**
   * Process vote action
   */
  async processVote(playId, cardA, cardB, winner) {
    try {
      console.log(`🔍 Looking for session: ${playId}`);
      
      const session = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'completed', 'waiting_for_children'] }
      });
      
      if (!session) {
        console.error(`❌ Vote session lookup failed for: ${playId}`);
        
        // Try finding session with any status to debug
        const anySession = await Play.findOne({ uuid: playId });
        if (anySession) {
          console.error(`📍 Session exists but has status: ${anySession.status}, state: ${anySession.state}`);
        } else {
          console.error(`📍 Session ${playId} does not exist at all`);
        }
        
        throw new Error('Session not found');
      }
      
      console.log(`✅ Found session: ${playId} (status: ${session.status}, state: ${session.state})`);
      
      
      if (session.state !== 'voting') {
        throw new Error(`Session not in voting state (current: ${session.state})`);
      }
      
      console.log(`🗳️ Vote: ${winner} wins between ${cardA} and ${cardB}`);
      
      // Record vote
      session.votes.push({
        cardA,
        cardB,
        winner,
        timestamp: new Date()
      });
      
      // Find the new card (the one not already in ranking)
      const newCard = session.personalRanking.includes(cardA) ? cardB : cardA;
      const existingCard = session.personalRanking.includes(cardA) ? cardA : cardB;
      
      // Position the new card based on vote result
      if (winner === newCard) {
        // New card wins - insert before existing card
        const index = session.personalRanking.indexOf(existingCard);
        session.personalRanking.splice(index, 0, newCard);
      } else {
        // New card loses - insert after existing card
        const index = session.personalRanking.indexOf(existingCard);
        session.personalRanking.splice(index + 1, 0, newCard);
      }
      
      console.log(`📊 Updated ranking: [${session.personalRanking.join(', ')}]`);
      
      // Return to swiping state
      session.state = 'swiping';
      
      let result = {
        success: true,
        returnToSwipe: true,
        nextCardId: null,
        completed: false
      };
      
      // Find next card to swipe
      const swipedIds = session.swipes.map(s => s.cardId);
      const remaining = session.cardIds.filter(id => !swipedIds.includes(id));
      
      if (remaining.length > 0) {
        result.nextCardId = remaining[0];
      } else {
        // All cards processed
        result.completed = true;
        session.status = 'completed';
        
        // Check for hierarchical processing
        const hierarchicalResult = await this.processHierarchical(session);
        if (hierarchicalResult) {
          result.hierarchical = hierarchicalResult;
        }
      }
      
      await session.save();
      return result;
      
    } catch (error) {
      throw new Error(`Vote failed: ${error.message}`);
    }
  }
  
  /**
   * Get session data for resuming
   */
  async getSessionData(playId) {
    try {
      const session = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'waiting_for_children'] }
      });
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Get card details
      const cards = [];
      for (const cardId of session.cardIds) {
        const card = await Card.findOne({ uuid: cardId });
        if (card) {
          cards.push({
            id: card.uuid,
            title: card.title,
            description: card.description,
            imageUrl: card.imageUrl
          });
        }
      }
      
      let currentCardId = null;
      let votingContext = null;
      
      if (session.state === 'voting') {
        // Get voting context
        const swipedIds = session.swipes.map(s => s.cardId);
        const lastSwipe = session.swipes[session.swipes.length - 1];
        if (lastSwipe && lastSwipe.direction === 'right') {
          votingContext = {
            newCard: lastSwipe.cardId,
            compareWith: this.getComparisonCard(session.personalRanking)
          };
        }
      } else {
        // Get next card to swipe
        const swipedIds = session.swipes.map(s => s.cardId);
        const remaining = session.cardIds.filter(id => !swipedIds.includes(id));
        currentCardId = remaining.length > 0 ? remaining[0] : null;
      }
      
      return {
        playId: session.uuid,
        totalCards: session.cardIds.length,
        cards,
        currentCardId,
        votingContext,
        state: session.state,
        status: session.status
      };
      
    } catch (error) {
      throw new Error(`Failed to get session data: ${error.message}`);
    }
  }
  
  /**
   * Process hierarchical needs after completion
   */
  async processHierarchical(session) {
    try {
      // Check ranked cards for parents with children
      const parentsWithChildren = [];
      
      for (const cardId of session.personalRanking) {
        const card = await Card.findOne({ uuid: cardId });
        if (card && card.isParent) {
          // Find children
          const children = await Card.find({
            organizationId: session.organizationId,
            parentTag: card.title,
            isActive: true,
            isParent: { $ne: true }
          });
          
          if (children.length >= 2) {
            parentsWithChildren.push({
              parentId: cardId,
              parentName: card.title,
              children: children
            });
          }
        }
      }
      
      if (parentsWithChildren.length === 0) {
        return null; // No hierarchical processing needed
      }
      
      console.log(`🌳 Found ${parentsWithChildren.length} parents with children`);
      
      // Create child session for first parent
      const firstParent = parentsWithChildren[0];
      const childSession = await this.createChildSession(session, firstParent);
      
      // Update parent session
      session.status = 'waiting_for_children';
      await session.save();
      
      return {
        action: 'start_child_session',
        childSession: {
          playId: childSession.playId,
          parentName: firstParent.parentName,
          totalChildren: firstParent.children.length
        }
      };
      
    } catch (error) {
      console.error('Hierarchical processing error:', error);
      return null;
    }
  }
  
  /**
   * Create child session
   */
  async createChildSession(parentSession, parentInfo) {
    try {
      const children = parentInfo.children;
      const shuffled = children.sort(() => Math.random() - 0.5);
      
      const childSession = new Play({
        uuid: uuidv4(),
        organizationId: parentSession.organizationId,
        deckTag: 'child',
        cardIds: shuffled.map(c => c.uuid),
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
      
      console.log(`✅ Child session created: ${childSession.uuid} for ${parentInfo.parentName}`);
      
      return {
        playId: childSession.uuid,
        parentName: parentInfo.parentName,
        totalCards: children.length,
        cards: shuffled.map(c => ({
          id: c.uuid,
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl
        })),
        currentCardId: shuffled[0].uuid
      };
      
    } catch (error) {
      throw new Error(`Failed to create child session: ${error.message}`);
    }
  }
  
  /**
   * Helper: Get a card from ranking for comparison
   */
  getComparisonCard(ranking) {
    if (ranking.length === 0) return null;
    // Simple: pick random card from ranking
    const index = Math.floor(Math.random() * ranking.length);
    return ranking[index];
  }
}

module.exports = DecisionTreeEngine;
