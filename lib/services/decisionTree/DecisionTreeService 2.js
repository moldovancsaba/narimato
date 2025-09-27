/**
 * FUNCTIONAL: Main Decision Tree Service Orchestrator
 * STRATEGIC: Provides unified interface for all decision tree operations,
 * coordinating between binary search, hierarchical management, and session flow control
 */

const BinarySearchEngine = require('./BinarySearchEngine');
const HierarchicalManager = require('./HierarchicalManager');
const SessionFlowController = require('./SessionFlowController');
const Play = require('../../models/Play');
const Card = require('../../models/Card');

/**
 * FUNCTIONAL: Main service class for decision tree operations
 * STRATEGIC: Serves as the single entry point for all decision tree functionality,
 * abstracting complexity and providing a clean interface for API endpoints
 */
class DecisionTreeService {
  constructor() {
    // FUNCTIONAL: Initialize all decision tree components
    // STRATEGIC: Create coordinated system with shared state management
    this.binarySearchEngine = new BinarySearchEngine();
    this.hierarchicalManager = new HierarchicalManager();
    this.sessionFlowController = new SessionFlowController();
    
    // FUNCTIONAL: Service-level configuration
    // STRATEGIC: Centralized settings for consistent behavior across components
    this.config = {
      minChildrenForHierarchical: 2,
      maxVotesPerCard: 10, // Prevent infinite voting loops
      enablePerformanceTracking: true,
      enableHierarchicalFlow: true,
      cacheEnabled: true
    };
  }

  /**
   * FUNCTIONAL: Process swipe action with complete decision tree logic
   * STRATEGIC: Main entry point for swipe operations, handling all aspects
   * from basic ranking to hierarchical decisions and state management
   * 
   * @param {string} playId - Play session UUID
   * @param {string} cardId - Card being swiped
   * @param {'left'|'right'} direction - Swipe direction
   * @returns {Promise<Object>} Complete swipe result with next actions
   */
  async processSwipe(playId, cardId, direction) {
    try {
      // FUNCTIONAL: Validate and load play session
      // STRATEGIC: Ensure session exists and is in valid state for processing
      const playSession = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'waiting_for_children'] }
      });
      
      if (!playSession) {
        throw new Error('Play session not found or not active');
      }

      if (playSession.state === 'voting') {
        throw new Error('Cannot swipe while in voting state');
      }

      // FUNCTIONAL: Check if card is already swiped
      // STRATEGIC: Prevent duplicate swipe actions
      if (playSession.swipes.some(swipe => swipe.cardId === cardId)) {
        throw new Error('Card already swiped');
      }

      // FUNCTIONAL: Process swipe through session flow controller
      // STRATEGIC: Let flow controller manage state transitions and logic coordination
      const swipeResult = await this.sessionFlowController.processSwipe(
        playSession, 
        cardId, 
        direction
      );

      // FUNCTIONAL: Save session state changes
      // STRATEGIC: Persist all state modifications before returning results
      await playSession.save();

      // FUNCTIONAL: Handle session completion if needed
      // STRATEGIC: Process hierarchical flow initiation or standard completion
      if (swipeResult.completed) {
        const completionResult = await this.sessionFlowController.processSessionCompletion(playSession);
        swipeResult.completionResult = completionResult;
        
        // Update global rankings asynchronously if not hierarchical
        if (!completionResult.hierarchical && direction === 'right') {
          this.updateGlobalRankingsAsync(cardId, playSession.personalRanking);
        }
      }

      return {
        success: true,
        playId: playSession.uuid,
        requiresVoting: swipeResult.requiresVoting,
        votingContext: swipeResult.votingContext,
        nextCardId: swipeResult.nextCardId,
        currentRanking: playSession.personalRanking,
        completed: swipeResult.completed,
        hierarchical: swipeResult.completionResult?.hierarchical,
        stateTransition: swipeResult.stateTransition
      };
    } catch (error) {
      console.error('DecisionTreeService.processSwipe error:', error);
      throw new Error(`Swipe processing failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Process vote action with binary search optimization
   * STRATEGIC: Handles comparison voting with intelligent positioning algorithm
   * and proper state management for complex ranking scenarios
   * 
   * @param {string} playId - Play session UUID
   * @param {string} cardA - First comparison card
   * @param {string} cardB - Second comparison card
   * @param {string} winner - Winning card UUID
   * @returns {Promise<Object>} Complete vote result with next actions
   */
  async processVote(playId, cardA, cardB, winner) {
    try {
      // FUNCTIONAL: Validate and load play session
      // STRATEGIC: Ensure session is in correct state for voting
      const playSession = await Play.findOne({ 
        uuid: playId, 
        status: { $in: ['active', 'waiting_for_children'] }
      });
      
      if (!playSession) {
        throw new Error('Play session not found or not active');
      }

      if (playSession.state !== 'voting') {
        throw new Error('Session not in voting state');
      }

      // FUNCTIONAL: Validate vote parameters
      // STRATEGIC: Ensure vote integrity for accurate ranking
      if (!cardA || !cardB || !winner) {
        throw new Error('All vote parameters (cardA, cardB, winner) are required');
      }

      if (![cardA, cardB].includes(winner)) {
        throw new Error('Winner must be either cardA or cardB');
      }

      // FUNCTIONAL: Process vote through session flow controller
      // STRATEGIC: Let flow controller handle binary search and state management
      const voteResult = await this.sessionFlowController.processVote(
        playSession,
        cardA,
        cardB,
        winner
      );

      // FUNCTIONAL: Save session state changes
      // STRATEGIC: Persist ranking updates and vote history
      await playSession.save();

      // FUNCTIONAL: Handle session completion if vote completes ranking
      // STRATEGIC: Process hierarchical flow or standard completion
      if (voteResult.completed) {
        const completionResult = await this.sessionFlowController.processSessionCompletion(playSession);
        voteResult.completionResult = completionResult;
        
        // Update global rankings asynchronously
        this.updateGlobalRankingsAsync(winner, playSession.personalRanking);
      }

      return {
        success: true,
        playId: playSession.uuid,
        requiresMoreVoting: voteResult.requiresMoreVoting,
        votingContext: voteResult.votingContext,
        returnToSwipe: voteResult.returnToSwipe,
        nextCardId: voteResult.nextCardId,
        currentRanking: playSession.personalRanking,
        completed: voteResult.completed,
        hierarchical: voteResult.completionResult?.hierarchical,
        stateTransition: voteResult.stateTransition
      };
    } catch (error) {
      console.error('DecisionTreeService.processVote error:', error);
      throw new Error(`Vote processing failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Create new decision tree session with proper initialization
   * STRATEGIC: Ensures all sessions are created with decision tree capabilities
   * and hierarchical support from the start
   * 
   * @param {string} organizationId - Organization identifier
   * @param {string} deckTag - Deck tag to create session for
   * @returns {Promise<Object>} Created session data
   */
  async createSession(organizationId, deckTag) {
    try {
      // FUNCTIONAL: Validate deck exists and get cards
      // STRATEGIC: Ensure deck is playable before creating session
      const cards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      }).sort({ globalScore: -1 });
      
      if (cards.length < 2) {
        throw new Error('Deck needs at least 2 cards to be playable');
      }
      
      // FUNCTIONAL: Determine deck type and hierarchical capability
      // STRATEGIC: Set up proper session configuration based on card types
      const parentCards = cards.filter(card => card.isParent);
      const isHierarchical = parentCards.length >= 2;
      const deckType = isHierarchical ? 'hierarchical' : 'simple';
      
      console.log(`📊 Creating ${deckType} session with ${cards.length} cards (${parentCards.length} parents)`);
      
      // FUNCTIONAL: Shuffle cards for random presentation
      // STRATEGIC: Prevent predictable ordering while maintaining fairness
      const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
      const cardIds = shuffledCards.map(card => card.uuid);
      
      // FUNCTIONAL: Create Play session with decision tree initialization
      // STRATEGIC: Ensure all required fields are properly initialized
      const { v4: uuidv4 } = require('uuid');
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
          currentChildSession: {
            active: false,
            parentCardId: null,
            childCards: [],
            childRanking: [],
            childVotes: []
          },
          excludedCards: [],
          childSessionHistory: []
        }
      });
      
      await playSession.save();
      
      // FUNCTIONAL: Return structured session data for frontend
      // STRATEGIC: Provide all necessary data for UI initialization
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
        deckType,
        hierarchical: isHierarchical,
        parentCards: parentCards.length
      };
    } catch (error) {
      console.error('DecisionTreeService.createSession error:', error);
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }
  
  /**
   * FUNCTIONAL: Get current session data for resuming or status checks
   * STRATEGIC: Provides complete session state for frontend initialization
   * and proper session resumption
   * 
   * @param {string} playId - Play session UUID
   * @returns {Promise<Object>} Current session data
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
      
      // FUNCTIONAL: Get current cards with details
      // STRATEGIC: Provide complete card data for UI rendering
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
      
      // FUNCTIONAL: Determine next card or voting context
      // STRATEGIC: Provide proper state information for UI
      let currentCardId = null;
      let votingContext = null;
      
      if (playSession.state === 'voting') {
        // Get current voting context from binary search engine
        const lastVote = playSession.votes[playSession.votes.length - 1];
        if (lastVote) {
          votingContext = this.binarySearchEngine.getNextComparison(
            playSession.personalRanking,
            lastVote.cardA === lastVote.winner ? lastVote.cardB : lastVote.cardA,
            playSession.votes
          );
        }
      } else {
        // Get next card for swiping
        const swipedIds = playSession.swipes.map(swipe => swipe.cardId);
        const remainingIds = playSession.cardIds.filter(id => !swipedIds.includes(id));
        currentCardId = remainingIds.length > 0 ? remainingIds[0] : null;
      }
      
      return {
        playId: playSession.uuid,
        totalCards: playSession.cardIds.length,
        cards,
        currentCardId,
        votingContext,
        state: playSession.state,
        status: playSession.status,
        personalRanking: playSession.personalRanking,
        hierarchicalEnabled: playSession.hierarchicalData?.enabled || false
      };
    } catch (error) {
      console.error('DecisionTreeService.getCurrentSessionData error:', error);
      throw new Error(`Failed to get session data: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Initialize hierarchical decision tree session
   * STRATEGIC: Sets up parent-child ranking flow when standard ranking is complete
   * and parent cards with children are present in the ranking
   * 
   * @param {string} playId - Completed parent play session UUID
   * @param {Object} config - Hierarchical configuration options
   * @returns {Promise<Object>} Hierarchical initialization result
   */
  async initializeHierarchicalFlow(playId, config = {}) {
    try {
      const playSession = await Play.findOne({ uuid: playId });
      
      if (!playSession) {
        throw new Error('Play session not found');
      }

      if (playSession.status !== 'completed') {
        throw new Error('Play session must be completed before hierarchical initialization');
      }

      // FUNCTIONAL: Check if hierarchical processing is needed
      // STRATEGIC: Only initiate if parent cards with sufficient children exist
      const needsHierarchical = await this.hierarchicalManager.needsHierarchicalProcessing(
        playSession, 
        { ...this.config, ...config }
      );

      if (!needsHierarchical) {
        return {
          action: 'no_hierarchical_needed',
          reason: 'No parent cards with sufficient children found'
        };
      }

      // FUNCTIONAL: Initialize hierarchical flow
      // STRATEGIC: Start first child session and set up hierarchical state
      const result = await this.hierarchicalManager.initializeHierarchicalFlow(
        playSession,
        { ...this.config, ...config }
      );

      return result;
    } catch (error) {
      console.error('DecisionTreeService.initializeHierarchicalFlow error:', error);
      throw new Error(`Hierarchical initialization failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Get next comparison for binary search algorithm
   * STRATEGIC: Provides comparison context for UI without processing full swipe,
   * useful for previewing or preparing comparison interfaces
   * 
   * @param {string} playId - Play session UUID
   * @param {string} cardId - Card needing positioning
   * @returns {Promise<Object|null>} Comparison context or null if none needed
   */
  async getNextComparison(playId, cardId) {
    try {
      const playSession = await Play.findOne({ uuid: playId, status: 'active' });
      
      if (!playSession) {
        return null;
      }

      // FUNCTIONAL: Get comparison context from binary search engine
      // STRATEGIC: Use optimized algorithm to determine best comparison
      const comparisonContext = this.binarySearchEngine.getNextComparison(
        playSession.personalRanking,
        cardId,
        playSession.votes
      );

      return comparisonContext;
    } catch (error) {
      console.error('DecisionTreeService.getNextComparison error:', error);
      return null;
    }
  }

  /**
   * FUNCTIONAL: Analyze card hierarchy for decision tree implications
   * STRATEGIC: Provides information about parent-child relationships
   * and potential hierarchical session requirements
   * 
   * @param {string} organizationId - Organization identifier
   * @param {string} cardId - Card to analyze
   * @returns {Promise<Object>} Hierarchical analysis result
   */
  async analyzeCardHierarchy(organizationId, cardId) {
    try {
      return await this.hierarchicalManager.analyzeCardHierarchy(organizationId, cardId);
    } catch (error) {
      console.error('DecisionTreeService.analyzeCardHierarchy error:', error);
      return {
        isParent: false,
        hasChildren: false,
        error: error.message
      };
    }
  }

  /**
   * FUNCTIONAL: Get comprehensive decision tree session status
   * STRATEGIC: Provides complete status information for monitoring,
   * debugging, and user interface state management
   * 
   * @param {string} playId - Play session UUID
   * @returns {Promise<Object>} Complete session status
   */
  async getSessionStatus(playId) {
    try {
      const playSession = await Play.findOne({ uuid: playId });
      
      if (!playSession) {
        return null;
      }

      // FUNCTIONAL: Get status from all decision tree components
      // STRATEGIC: Aggregate information from different subsystems
      const flowStatus = this.sessionFlowController.getSessionFlowStatus(playSession);
      const hierarchicalStatus = this.hierarchicalManager.getHierarchicalSessionStatus(playId);
      const performanceMetrics = this.sessionFlowController.getSessionMetrics(playId);

      return {
        ...flowStatus,
        hierarchicalStatus,
        performanceMetrics,
        config: this.config
      };
    } catch (error) {
      console.error('DecisionTreeService.getSessionStatus error:', error);
      return {
        error: error.message,
        sessionId: playId
      };
    }
  }

  /**
   * FUNCTIONAL: Get binary search performance metrics
   * STRATEGIC: Provides algorithm performance data for optimization
   * and monitoring of decision tree efficiency
   * 
   * @returns {Object} Binary search performance metrics
   */
  getBinarySearchMetrics() {
    return this.binarySearchEngine.getPerformanceMetrics();
  }

  /**
   * FUNCTIONAL: Reset all decision tree components
   * STRATEGIC: Clears caches and metrics for fresh state,
   * useful for testing and performance benchmarking
   */
  resetComponents() {
    this.binarySearchEngine.resetMetrics();
    this.binarySearchEngine.clearCache();
    this.sessionFlowController.resetBinarySearchEngine();
  }

  /**
   * FUNCTIONAL: Update service configuration
   * STRATEGIC: Allows runtime configuration changes for different
   * organizational needs or A/B testing scenarios
   * 
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('DecisionTreeService configuration updated:', this.config);
  }

  /**
   * FUNCTIONAL: Clean up completed session data
   * STRATEGIC: Memory management and cleanup for long-running service instances
   * 
   * @param {string} playId - Session to clean up
   */
  async cleanupSession(playId) {
    try {
      this.sessionFlowController.cleanupSessionMetrics(playId);
      await this.hierarchicalManager.cleanupOrphanedSessions();
      console.log(`Session ${playId} cleaned up successfully`);
    } catch (error) {
      console.error(`Error cleaning up session ${playId}:`, error);
    }
  }

  /**
   * FUNCTIONAL: Update global ELO rankings asynchronously
   * STRATEGIC: Maintains global ranking system without blocking main flow
   * 
   * @param {string} winnerId - Winning card UUID
   * @param {string[]} personalRanking - Current personal ranking for context
   */
  async updateGlobalRankingsAsync(winnerId, personalRanking) {
    try {
      if (!winnerId || personalRanking.length < 2) {
        return; // Need at least 2 cards for meaningful ranking update
      }

      // FUNCTIONAL: Update winner's global score
      // STRATEGIC: Async update doesn't block main decision tree flow
      await Card.updateOne(
        { uuid: winnerId },
        { 
          $inc: { 
            voteCount: 1, 
            winCount: 1 
          }
        }
      );

      console.log(`Global rankings updated for card: ${winnerId}`);
    } catch (error) {
      console.error('Error updating global rankings:', error);
      // Don't throw - this is async and shouldn't break main flow
    }
  }

  /**
   * FUNCTIONAL: Validate decision tree service health
   * STRATEGIC: Health check for monitoring and diagnostics
   * 
   * @returns {Object} Service health status
   */
  getHealthStatus() {
    try {
      const binarySearchMetrics = this.binarySearchEngine.getPerformanceMetrics();
      
      return {
        healthy: true,
        components: {
          binarySearchEngine: 'operational',
          hierarchicalManager: 'operational',
          sessionFlowController: 'operational'
        },
        performance: {
          cacheHitRate: binarySearchMetrics.cacheHitRate,
          averageExecutionTime: binarySearchMetrics.averageExecutionTime,
          totalComparisons: binarySearchMetrics.totalComparisons
        },
        config: this.config,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = DecisionTreeService;
