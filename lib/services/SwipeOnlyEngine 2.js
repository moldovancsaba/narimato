/**
 * FUNCTIONAL: Pure Swipe-Only Ranking Engine - Built from Scratch
 * STRATEGIC: Simple, efficient algorithm focused solely on swipe-based preferences.
 * No voting complexity - ranks cards based purely on swipe order and timing.
 * 
 * Algorithm:
 * 1. Present all cards one by one for left/right swipe decisions
 * 2. Right swipes = liked cards, stored with timestamp 
 * 3. Left swipes = rejected cards, excluded from final ranking
 * 4. Final ranking = liked cards ordered by swipe timestamp (earliest = highest rank)
 */

const SwipeOnlyPlay = require('../models/SwipeOnlyPlay');
const Card = require('../models/Card');
const { v4: uuidv4 } = require('uuid');

class SwipeOnlyEngine {
  
  /**
   * FUNCTIONAL: Create new swipe-only session with shuffled cards
   * STRATEGIC: Simple session initialization focused on swipe-only workflow
   */
  static async startSession(organizationId, deckTag) {
    const engine = new SwipeOnlyEngine();
    return await engine.createSession(organizationId, deckTag);
  }
  
  /**
   * FUNCTIONAL: Create an onboarding swipe-only session (right-only)
   * STRATEGIC: Reuse swipe-only engine with server-enforced right-only swipes for onboarding flows
   */
  static async startOnboardingSession(organizationId, deckTag) {
    const engine = new SwipeOnlyEngine();
    return await engine.createSession(organizationId, deckTag, { isOnboarding: true });
  }
  
  /**
   * FUNCTIONAL: Process a swipe action and update session state
   * STRATEGIC: Core swipe processing with immediate ranking updates
   */
  static async processSwipe(playId, cardId, direction) {
    const engine = new SwipeOnlyEngine();
    return await engine.processSwipe(playId, cardId, direction);
  }
  
  /**
   * FUNCTIONAL: Get current card for swiping in active session
   * STRATEGIC: Simple state retrieval for UI to display current card
   */
  static async getCurrentCard(playId) {
    const engine = new SwipeOnlyEngine();
    return await engine.getCurrentCard(playId);
  }
  
  /**
   * FUNCTIONAL: Get final ranking and session results
   * STRATEGIC: Simple ranking based on swipe order - first liked = highest preference
   */
  static async getFinalRanking(playId) {
    const engine = new SwipeOnlyEngine();
    return await engine.getFinalRanking(playId);
  }
  
  /**
   * FUNCTIONAL: Create new swipe-only session with shuffled cards
   * STRATEGIC: Simple session initialization focused on swipe-only workflow
   * 
   * @param {string} organizationId - Organization identifier
   * @param {string} deckTag - Deck tag to create session for
   * @returns {Promise<Object>} Created session data with first card
   */
  async createSession(organizationId, deckTag, options = {}) {
    try {
      // FUNCTIONAL: Get all cards for the deck
      // STRATEGIC: Load cards once at session start for performance
      const cards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      }).sort({ globalScore: -1 });
      
      if (cards.length < 2) {
        throw new Error('Need at least 2 cards for swipe-only session');
      }
      
      let presentationCards = cards;

      if (options.isOnboarding === true) {
        // FUNCTIONAL: Deterministic ordering for onboarding (no shuffle)
        // STRATEGIC: Respect editor-defined order to craft guided intros
        presentationCards = [...cards].sort((a, b) => {
          const aIdx = Number.isFinite(a.sortIndex) ? a.sortIndex : Number.POSITIVE_INFINITY;
          const bIdx = Number.isFinite(b.sortIndex) ? b.sortIndex : Number.POSITIVE_INFINITY;
          if (aIdx !== bIdx) return aIdx - bIdx;
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime; // older first
        });
      } else {
        // FUNCTIONAL: Shuffle cards for random presentation order (non-onboarding)
        // STRATEGIC: Prevent order bias in standard swipe-only sessions
        presentationCards = [...cards].sort(() => Math.random() - 0.5);
      }

      const cardIds = presentationCards.map(card => card.uuid);
      
      // FUNCTIONAL: Create SwipeOnly session with clean state
      // STRATEGIC: Initialize all fields needed for swipe-only workflow
      const session = new SwipeOnlyPlay({
        uuid: uuidv4(),
        organizationId,
        deckTag,
        cardIds,
        swipes: [],
        likedCards: [],
        rejectedCards: [],
        status: 'active',
        isOnboarding: options.isOnboarding === true
      });
      
      await session.save();
      
      console.log(`✅ SwipeOnly session created: ${session.uuid} with ${cards.length} cards`);
      
      return {
        playId: session.uuid,
        deckTag,
        mode: options.isOnboarding ? 'onboarding' : 'swipe-only',
        totalCards: cards.length,
        cards: presentationCards.map(card => ({
          id: card.uuid,
          title: card.title,
          description: card.description,
          imageUrl: card.imageUrl
        })),
        currentCardId: cardIds[0],
        progress: {
          cardsRemaining: cardIds.length,
          cardsCompleted: 0
        }
      };
    } catch (error) {
      throw new Error(`SwipeOnly session creation failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Process a swipe action and update session state
   * STRATEGIC: Core swipe processing with immediate ranking updates
   * 
   * @param {string} playId - Session UUID
   * @param {string} cardId - Card being swiped
   * @param {'left'|'right'} direction - Swipe direction
   * @returns {Promise<Object>} Swipe result with next card or completion
   */
  async processSwipe(playId, cardId, direction) {
    try {
      const session = await SwipeOnlyPlay.findOne({ 
        uuid: playId, 
        status: 'active' 
      });
      
      if (!session) {
        throw new Error('SwipeOnly session not found or not active');
      }
      
      // FUNCTIONAL: Validate card hasn't been swiped already
      // STRATEGIC: Prevent duplicate swipes and maintain data integrity
      if (session.swipes.some(swipe => swipe.cardId === cardId)) {
        throw new Error('Card already swiped');
      }
      
      console.log(`👆 SwipeOnly: ${cardId} swiped ${direction}`);
      
      // FUNCTIONAL: Enforce right-only behavior for onboarding sessions
      // STRATEGIC: Even if a left swipe reaches the server, coerce to 'right' to keep onboarding frictionless
      if (session.isOnboarding && direction !== 'right') {
        direction = 'right';
      }
      
      // FUNCTIONAL: Record the swipe action
      // STRATEGIC: Store all swipe data for analysis and history
      session.swipes.push({
        cardId,
        direction,
        timestamp: new Date()
      });
      
      // FUNCTIONAL: Process swipe direction and update rankings
      // STRATEGIC: Different handling for like vs reject to build preference ranking
      if (direction === 'right') {
        // Right swipe = like - add to liked cards with ranking
        const rank = session.likedCards.length + 1;
        session.likedCards.push({
          cardId,
          swipedAt: new Date(),
          rank
        });
        console.log(`❤️ Card liked: ${cardId} (rank ${rank})`);
      } else {
        // Left swipe = reject - add to rejected list
        session.rejectedCards.push(cardId);
        console.log(`💔 Card rejected: ${cardId}`);
      }
      
      // FUNCTIONAL: Find next card to present
      // STRATEGIC: Simple sequential presentation of remaining cards
      const swipedCardIds = session.swipes.map(s => s.cardId);
      const remainingCards = session.cardIds.filter(id => !swipedCardIds.includes(id));
      
      let result = {
        success: true,
        completed: false,
        nextCardId: null,
        progress: {
          cardsRemaining: remainingCards.length,
          cardsCompleted: swipedCardIds.length,
          totalCards: session.cardIds.length
        }
      };
      
      if (remainingCards.length > 0) {
        // FUNCTIONAL: Return next card for swiping
        // STRATEGIC: Continue session with next unprocessed card
        result.nextCardId = remainingCards[0];
        session.lastActivity = new Date();
      } else {
        // FUNCTIONAL: All cards processed - complete session
        // STRATEGIC: Finalize session and prepare results
        result.completed = true;
        session.status = 'completed';
        session.completedAt = new Date();
        
        console.log(`🎉 SwipeOnly session completed: ${session.likedCards.length} liked, ${session.rejectedCards.length} rejected`);
      }
      
      await session.save();
      return result;
      
    } catch (error) {
      throw new Error(`SwipeOnly swipe processing failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Get current card for swiping in active session
   * STRATEGIC: Simple state retrieval for UI to display current card
   * 
   * @param {string} playId - Session UUID
   * @returns {Promise<Object>} Current card data or completion status
   */
  async getCurrentCard(playId) {
    try {
      const session = await SwipeOnlyPlay.findOne({ 
        uuid: playId, 
        status: 'active' 
      });
      
      if (!session) {
        throw new Error('SwipeOnly session not found or not active');
      }
      
      // FUNCTIONAL: Calculate remaining cards to swipe
      // STRATEGIC: Provide progress information for UI
      const swipedCardIds = session.swipes.map(s => s.cardId);
      const remainingCards = session.cardIds.filter(id => !swipedCardIds.includes(id));
      
      if (remainingCards.length === 0) {
        return {
          completed: true,
          progress: {
            cardsRemaining: 0,
            cardsCompleted: swipedCardIds.length,
            totalCards: session.cardIds.length
          }
        };
      }
      
      // FUNCTIONAL: Get card details for current card
      // STRATEGIC: Return complete card information for UI rendering
      const currentCardId = remainingCards[0];
      const cardDetails = await Card.findOne({ uuid: currentCardId });
      
      if (!cardDetails) {
        throw new Error('Current card not found');
      }
      
      return {
        playId: session.uuid,
        currentCard: {
          id: cardDetails.uuid,
          title: cardDetails.title,
          description: cardDetails.description,
          imageUrl: cardDetails.imageUrl
        },
        progress: {
          cardsRemaining: remainingCards.length,
          cardsCompleted: swipedCardIds.length,
          totalCards: session.cardIds.length
        }
      };
      
    } catch (error) {
      throw new Error(`SwipeOnly current card retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Get final ranking and session results
   * STRATEGIC: Simple ranking based on swipe order - first liked = highest preference
   * 
   * @param {string} playId - Session UUID
   * @returns {Promise<Object>} Complete session results with ranking
   */
  async getFinalRanking(playId) {
    try {
      const session = await SwipeOnlyPlay.findOne({ uuid: playId });
      
      if (!session) {
        throw new Error('SwipeOnly session not found');
      }
      
      // FUNCTIONAL: Get detailed card information for ranking
      // STRATEGIC: Return complete ranking with card details for results display
      const rankedCards = [];
      
      for (const likedCard of session.likedCards) {
        const cardDetails = await Card.findOne({ uuid: likedCard.cardId });
        if (cardDetails) {
          rankedCards.push({
            rank: likedCard.rank,
            card: {
              id: cardDetails.uuid,
              title: cardDetails.title,
              description: cardDetails.description,
              imageUrl: cardDetails.imageUrl
            },
            swipedAt: likedCard.swipedAt
          });
        }
      }
      
      // FUNCTIONAL: Sort by rank (1 = highest preference)
      // STRATEGIC: Maintain consistent ranking order based on swipe timing
      rankedCards.sort((a, b) => a.rank - b.rank);
      
      return {
        playId: session.uuid,
        mode: 'swipe-only',
        completed: session.status === 'completed',
        completedAt: session.completedAt,
        ranking: rankedCards,
        statistics: {
          totalCards: session.cardIds.length,
          likedCards: session.likedCards.length,
          rejectedCards: session.rejectedCards.length,
          totalSwipes: session.swipes.length
        },
        sessionInfo: {
          deckTag: session.deckTag,
          createdAt: session.createdAt,
          duration: session.completedAt ? 
            (session.completedAt.getTime() - session.createdAt.getTime()) : null
        }
      };
      
    } catch (error) {
      throw new Error(`SwipeOnly ranking retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Resume existing session or return current state
   * STRATEGIC: Support for session continuation after interruption
   * 
   * @param {string} playId - Session UUID
   * @returns {Promise<Object>} Current session state for resumption
   */
  async resumeSession(playId) {
    try {
      const session = await SwipeOnlyPlay.findOne({ 
        uuid: playId,
        status: { $in: ['active', 'completed'] }
      });
      
      if (!session) {
        throw new Error('SwipeOnly session not found');
      }
      
      if (session.status === 'completed') {
        return await this.getFinalRanking(playId);
      }
      
      return await this.getCurrentCard(playId);
      
    } catch (error) {
      throw new Error(`SwipeOnly session resumption failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Get session statistics and progress
   * STRATEGIC: Monitoring and analytics for swipe-only sessions
   * 
   * @param {string} playId - Session UUID
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats(playId) {
    try {
      const session = await SwipeOnlyPlay.findOne({ uuid: playId });
      
      if (!session) {
        return null;
      }
      
      const swipedCount = session.swipes.length;
      const likeRate = swipedCount > 0 ? (session.likedCards.length / swipedCount) * 100 : 0;
      
      return {
        playId: session.uuid,
        mode: 'swipe-only',
        status: session.status,
        progress: {
          totalCards: session.cardIds.length,
          swipedCards: swipedCount,
          likedCards: session.likedCards.length,
          rejectedCards: session.rejectedCards.length,
          remainingCards: session.cardIds.length - swipedCount
        },
        metrics: {
          likeRate: Math.round(likeRate),
          sessionDuration: session.completedAt ? 
            session.completedAt.getTime() - session.createdAt.getTime() : 
            Date.now() - session.createdAt.getTime()
        }
      };
      
    } catch (error) {
      console.error('SwipeOnly stats error:', error);
      return null;
    }
  }
}

module.exports = SwipeOnlyEngine;
