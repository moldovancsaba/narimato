/**
 * FUNCTIONAL: Session Flow Controller for Decision Tree State Management
 * STRATEGIC: Orchestrates the complete decision tree flow from swipe to vote to ranking,
 * managing state transitions and coordinating between binary search and hierarchical logic
 */

const BinarySearchEngine = require('./BinarySearchEngine');
const HierarchicalManager = require('./HierarchicalManager');

/**
 * FUNCTIONAL: Controls the flow and state transitions in decision tree sessions
 * STRATEGIC: Serves as the main coordinator between different decision tree components,
 * ensuring proper state management and error recovery throughout the ranking process
 */
class SessionFlowController {
  constructor() {
    this.binarySearchEngine = new BinarySearchEngine();
    this.hierarchicalManager = new HierarchicalManager();
    
    // FUNCTIONAL: Valid state transitions matrix
    // STRATEGIC: Prevents invalid state changes and ensures consistent flow
    this.validTransitions = {
      'swiping': ['voting', 'completed'],
      'voting': ['swiping', 'completed', 'voting'], // can stay in voting for multiple comparisons
      'completed': ['hierarchically_completed'] // only for hierarchical sessions
    };

    // FUNCTIONAL: Track session performance metrics
    // STRATEGIC: Enable monitoring and optimization of decision tree performance
    this.sessionMetrics = new Map();
  }

  /**
   * FUNCTIONAL: Process swipe action in decision tree flow
   * STRATEGIC: Handles right swipes that trigger ranking insertion and potential voting,
   * coordinating with hierarchical logic for parent card decisions
   * 
   * @param {Object} playSession - Current play session
   * @param {string} cardId - Swiped card UUID
   * @param {'left'|'right'} direction - Swipe direction
   * @returns {Promise<Object>} Swipe processing result
   */
  async processSwipe(playSession, cardId, direction) {
    try {
      const startTime = Date.now();
      
      // FUNCTIONAL: Initialize session metrics if not exists
      // STRATEGIC: Track performance for optimization
      if (!this.sessionMetrics.has(playSession.uuid)) {
        this.sessionMetrics.set(playSession.uuid, {
          swipes: 0,
          votes: 0,
          startTime: Date.now(),
          stateTransitions: []
        });
      }

      const metrics = this.sessionMetrics.get(playSession.uuid);
      metrics.swipes++;

      // FUNCTIONAL: Record swipe in session history
      // STRATEGIC: Maintain complete swipe log for analysis and recovery
      playSession.swipes.push({
        cardId,
        direction,
        timestamp: new Date()
      });

      let result = {
        success: true,
        requiresVoting: false,
        nextCardId: null,
        hierarchicalDecision: null,
        stateTransition: null
      };

      if (direction === 'right') {
        // FUNCTIONAL: Process hierarchical decision for parent cards
        // STRATEGIC: Check if this swipe affects child card inclusion
        try {
          const hierarchicalDecision = await this.hierarchicalManager.processParentDecision(
            playSession.organizationId,
            cardId,
            direction
          );
          result.hierarchicalDecision = hierarchicalDecision;
        } catch (hierarchicalError) {
          console.warn('Hierarchical decision processing failed:', hierarchicalError.message);
          // Continue with standard processing
        }

        // FUNCTIONAL: Handle ranking insertion using binary search
        // STRATEGIC: Determine if card can be positioned immediately or needs comparison
        if (playSession.personalRanking.length === 0) {
          // First liked card - direct insertion
          playSession.personalRanking = [cardId];
          result.stateTransition = { from: playSession.state, to: 'swiping' };
        } else {
          // Need comparison to determine position
          const comparisonContext = this.binarySearchEngine.getNextComparison(
            playSession.personalRanking,
            cardId,
            playSession.votes
          );

          if (comparisonContext) {
            // FUNCTIONAL: Transition to voting state for comparison
            // STRATEGIC: User needs to compare card against existing ranking
            playSession.state = 'voting';
            result.requiresVoting = true;
            result.votingContext = comparisonContext;
            result.stateTransition = { from: 'swiping', to: 'voting' };
            
            metrics.stateTransitions.push({
              from: 'swiping',
              to: 'voting',
              timestamp: new Date(),
              cardId,
              reason: 'comparison_needed'
            });
          } else {
            // FUNCTIONAL: Position can be determined without comparison
            // STRATEGIC: Binary search bounds have collapsed, direct insertion possible
            const updatedRanking = this.binarySearchEngine.insertIntoRanking(
              playSession.personalRanking,
              cardId,
              null,
              null,
              null,
              playSession.votes
            );
            
            if (updatedRanking.length > playSession.personalRanking.length) {
              playSession.personalRanking = updatedRanking;
            }
            result.stateTransition = { from: playSession.state, to: 'swiping' };
          }
        }
      }

      // FUNCTIONAL: Determine next card if not in voting state
      // STRATEGIC: Continue deck presentation unless comparison is needed
      if (!result.requiresVoting) {
        const swipedIds = playSession.swipes.map(swipe => swipe.cardId);
        const remainingCards = playSession.cardIds.filter(id => !swipedIds.includes(id));
        result.nextCardId = remainingCards.length > 0 ? remainingCards[0] : null;
        
        // Check for session completion
        if (!result.nextCardId) {
          playSession.status = 'completed';
          playSession.completedAt = new Date();
          result.completed = true;
          result.stateTransition = { from: playSession.state, to: 'completed' };
          
          metrics.stateTransitions.push({
            from: playSession.state,
            to: 'completed',
            timestamp: new Date(),
            reason: 'all_cards_processed'
          });
        }
      }

      // Track processing time
      metrics.processingTimes = metrics.processingTimes || [];
      metrics.processingTimes.push(Date.now() - startTime);

      return result;
    } catch (error) {
      console.error('Error processing swipe:', error);
      throw new Error(`Swipe processing failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Process vote action in decision tree flow
   * STRATEGIC: Handles comparison votes that position cards in ranking,
   * managing the binary search algorithm and state transitions
   * 
   * @param {Object} playSession - Current play session
   * @param {string} cardA - First card in comparison
   * @param {string} cardB - Second card in comparison
   * @param {string} winner - Winning card UUID
   * @returns {Promise<Object>} Vote processing result
   */
  async processVote(playSession, cardA, cardB, winner) {
    try {
      const startTime = Date.now();
      const metrics = this.sessionMetrics.get(playSession.uuid);
      if (metrics) metrics.votes++;

      // FUNCTIONAL: Validate vote input
      // STRATEGIC: Ensure vote integrity for accurate ranking
      if (![cardA, cardB].includes(winner)) {
        throw new Error('Winner must be either cardA or cardB');
      }

      // FUNCTIONAL: Record vote in session history
      // STRATEGIC: Maintain complete vote history for binary search bounds calculation
      playSession.votes.push({
        cardA,
        cardB,
        winner,
        timestamp: new Date()
      });

      // FUNCTIONAL: Attempt to insert card using updated vote information
      // STRATEGIC: Binary search may now have sufficient information for positioning
      const newCard = playSession.personalRanking.includes(cardA) ? cardB : cardA;
      const updatedRanking = this.binarySearchEngine.insertIntoRanking(
        playSession.personalRanking,
        newCard,
        winner,
        cardA,
        cardB,
        playSession.votes
      );

      let result = {
        success: true,
        requiresMoreVoting: false,
        returnToSwipe: false,
        nextCardId: null,
        stateTransition: null
      };

      // FUNCTIONAL: Check if card was successfully positioned
      // STRATEGIC: Ranking length increase indicates successful insertion
      if (updatedRanking.length > playSession.personalRanking.length) {
        // Card positioned successfully
        playSession.personalRanking = updatedRanking;
        playSession.state = 'swiping';
        result.returnToSwipe = true;
        result.stateTransition = { from: 'voting', to: 'swiping' };
        
        if (metrics) {
          metrics.stateTransitions.push({
            from: 'voting',
            to: 'swiping',
            timestamp: new Date(),
            cardId: newCard,
            reason: 'card_positioned'
          });
        }
        
        // Get next card for swiping
        const swipedIds = playSession.swipes.map(swipe => swipe.cardId);
        const remainingCards = playSession.cardIds.filter(id => !swipedIds.includes(id));
        result.nextCardId = remainingCards.length > 0 ? remainingCards[0] : null;
        
        // Check for completion
        if (!result.nextCardId) {
          playSession.status = 'completed';
          playSession.completedAt = new Date();
          result.completed = true;
          result.stateTransition.to = 'completed';
        }
      } else {
        // FUNCTIONAL: Card needs more comparisons for positioning
        // STRATEGIC: Continue voting until binary search bounds collapse
        const nextComparison = this.binarySearchEngine.getNextComparison(
          playSession.personalRanking,
          newCard,
          playSession.votes
        );

        if (nextComparison) {
          result.requiresMoreVoting = true;
          result.votingContext = nextComparison;
          // State remains 'voting'
        } else {
          // FUNCTIONAL: No more comparisons available but card not inserted
          // STRATEGIC: Error condition - should not happen with correct algorithm
          console.warn(`No comparison available but card ${newCard} not inserted`);
          playSession.state = 'swiping';
          result.returnToSwipe = true;
          result.stateTransition = { from: 'voting', to: 'swiping' };
        }
      }

      // Track processing time
      if (metrics) {
        metrics.processingTimes = metrics.processingTimes || [];
        metrics.processingTimes.push(Date.now() - startTime);
      }

      return result;
    } catch (error) {
      console.error('Error processing vote:', error);
      throw new Error(`Vote processing failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Handle session completion and initiate hierarchical processing if needed
   * STRATEGIC: Orchestrates the transition from simple ranking to hierarchical decision tree,
   * determining if parent cards require child session processing
   * 
   * @param {Object} playSession - Completed play session
   * @returns {Promise<Object>} Completion processing result
   */
  async processSessionCompletion(playSession) {
    try {
      const metrics = this.sessionMetrics.get(playSession.uuid);
      if (metrics) {
        metrics.completionTime = Date.now();
        metrics.totalDuration = metrics.completionTime - metrics.startTime;
      }

      // FUNCTIONAL: Check if hierarchical processing is needed
      // STRATEGIC: Determine if any ranked cards are parents requiring child sessions
      const needsHierarchical = await this.hierarchicalManager.needsHierarchicalProcessing(playSession);
      
      if (needsHierarchical && playSession.hierarchicalPhase !== 'children') {
        console.log('🌳 Initiating hierarchical processing for completed parent session');
        
        try {
          const hierarchicalResult = await this.hierarchicalManager.initializeHierarchicalFlow(playSession);
          return {
            success: true,
            hierarchical: hierarchicalResult,
            completed: true,
            metrics: this.getSessionMetrics(playSession.uuid)
          };
        } catch (hierarchicalError) {
          console.error('Hierarchical processing failed:', hierarchicalError);
          // Continue with standard completion
        }
      } else if (playSession.hierarchicalPhase === 'children') {
        // FUNCTIONAL: Child session completed - notify hierarchical manager
        // STRATEGIC: Continue hierarchical flow or finalize if all children processed
        console.log('🌱 Child session completed - processing hierarchical continuation');
        
        try {
          const hierarchicalResult = await this.hierarchicalManager.onChildSessionComplete(playSession);
          return {
            success: true,
            hierarchical: hierarchicalResult,
            completed: true,
            metrics: this.getSessionMetrics(playSession.uuid)
          };
        } catch (hierarchicalError) {
          console.error('Child session processing failed:', hierarchicalError);
          // Fall through to standard completion
        }
      }

      // FUNCTIONAL: Standard session completion without hierarchical processing
      // STRATEGIC: Simple ranking session or hierarchical processing not needed
      return {
        success: true,
        completed: true,
        ranking: playSession.personalRanking,
        metrics: this.getSessionMetrics(playSession.uuid)
      };
    } catch (error) {
      console.error('Error processing session completion:', error);
      throw new Error(`Session completion processing failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Validate state transition
   * STRATEGIC: Ensures only valid state changes occur, preventing corruption
   * 
   * @param {string} currentState - Current session state
   * @param {string} newState - Proposed new state
   * @returns {boolean} Whether transition is valid
   */
  validateStateTransition(currentState, newState) {
    const validNextStates = this.validTransitions[currentState];
    return validNextStates && validNextStates.includes(newState);
  }

  /**
   * FUNCTIONAL: Get comprehensive session metrics
   * STRATEGIC: Provides performance data for monitoring and optimization
   * 
   * @param {string} sessionId - Session UUID
   * @returns {Object} Session performance metrics
   */
  getSessionMetrics(sessionId) {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return null;

    const avgProcessingTime = metrics.processingTimes?.length > 0
      ? metrics.processingTimes.reduce((a, b) => a + b, 0) / metrics.processingTimes.length
      : 0;

    return {
      sessionId,
      totalSwipes: metrics.swipes,
      totalVotes: metrics.votes,
      totalDuration: metrics.totalDuration || (Date.now() - metrics.startTime),
      averageProcessingTime: avgProcessingTime,
      stateTransitions: metrics.stateTransitions?.length || 0,
      efficiency: metrics.votes > 0 ? metrics.swipes / metrics.votes : 0,
      binarySearchMetrics: this.binarySearchEngine.getPerformanceMetrics()
    };
  }

  /**
   * FUNCTIONAL: Clean up session metrics
   * STRATEGIC: Memory management for completed sessions
   * 
   * @param {string} sessionId - Session UUID to clean up
   */
  cleanupSessionMetrics(sessionId) {
    this.sessionMetrics.delete(sessionId);
  }

  /**
   * FUNCTIONAL: Get session flow status
   * STRATEGIC: Provides debugging information for session state
   * 
   * @param {Object} playSession - Play session to analyze
   * @returns {Object} Session flow status
   */
  getSessionFlowStatus(playSession) {
    const metrics = this.sessionMetrics.get(playSession.uuid);
    const hierarchicalStatus = this.hierarchicalManager.getHierarchicalSessionStatus(playSession.uuid);

    return {
      sessionId: playSession.uuid,
      currentState: playSession.state,
      status: playSession.status,
      cardCount: playSession.cardIds.length,
      swipedCount: playSession.swipes.length,
      votedCount: playSession.votes.length,
      rankedCount: playSession.personalRanking.length,
      isHierarchical: !!playSession.hierarchicalPhase,
      hierarchicalPhase: playSession.hierarchicalPhase,
      hierarchicalStatus,
      metrics: metrics ? {
        swipes: metrics.swipes,
        votes: metrics.votes,
        duration: Date.now() - metrics.startTime
      } : null
    };
  }

  /**
   * FUNCTIONAL: Reset binary search engine
   * STRATEGIC: Allows fresh algorithm state for new sessions
   */
  resetBinarySearchEngine() {
    this.binarySearchEngine.resetMetrics();
    this.binarySearchEngine.clearCache();
  }
}

module.exports = SessionFlowController;
