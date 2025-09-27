/**
 * FUNCTIONAL: Hierarchical Manager for Parent-Child Card Relationships
 * STRATEGIC: Manages the decision tree logic where parent card decisions determine
 * child card inclusion and ranking flow in multi-level card hierarchies
 */

const Card = require('../../models/Card');
const Play = require('../../models/Play');
const { v4: uuidv4 } = require('uuid');
const BinarySearchEngine = require('./BinarySearchEngine');

/**
 * FUNCTIONAL: Manages hierarchical decision tree logic for card ranking
 * STRATEGIC: Enables complex decision flows where parent cards control child card
 * inclusion and ranking behavior, supporting conditional and sequential modes
 */
class HierarchicalManager {
  constructor() {
    this.binarySearchEngine = new BinarySearchEngine();
    
    // FUNCTIONAL: Track active hierarchical sessions
    // STRATEGIC: Maintain state for multiple concurrent hierarchical flows
    this.activeHierarchicalSessions = new Map();
  }

  /**
   * FUNCTIONAL: Analyze card to determine if it has hierarchical children
   * STRATEGIC: Identifies parent cards that can trigger child sessions,
   * providing the foundation for conditional decision tree logic
   * 
   * @param {string} organizationId - Organization identifier
   * @param {string} cardId - Card to analyze
   * @returns {Promise<Object>} Hierarchical analysis result
   */
  async analyzeCardHierarchy(organizationId, cardId) {
    try {
      const card = await Card.findOne({
        organizationId,
        uuid: cardId,
        isActive: true
      });

      if (!card || !card.isParent) {
        return {
          isParent: false,
          hasChildren: false,
          childrenCount: 0,
          playMode: 'none'
        };
      }

      // FUNCTIONAL: Get child cards for this parent
      // STRATEGIC: Determine potential child session size and viability
      const children = await Card.find({
        organizationId,
        parentTag: card.name,
        isActive: true
      });

      return {
        isParent: true,
        hasChildren: children.length > 0,
        childrenCount: children.length,
        playMode: card.childrenPlayMode || 'conditional',
        childCards: children,
        parentCard: card
      };
    } catch (error) {
      console.error('Error analyzing card hierarchy:', error);
      return {
        isParent: false,
        hasChildren: false,
        childrenCount: 0,
        playMode: 'none',
        error: error.message
      };
    }
  }

  /**
   * FUNCTIONAL: Process parent card decision (swipe) for hierarchical implications
   * STRATEGIC: Translates parent swipe direction into child inclusion decisions,
   * implementing the core decision tree logic
   * 
   * @param {string} organizationId - Organization identifier
   * @param {string} parentCardId - Parent card UUID
   * @param {'left'|'right'} swipeDirection - Parent swipe direction
   * @param {Object} hierarchicalConfig - Configuration for hierarchical behavior
   * @returns {Promise<ParentDecision>} Decision result with child implications
   */
  async processParentDecision(organizationId, parentCardId, swipeDirection, hierarchicalConfig = {}) {
    try {
      const hierarchy = await this.analyzeCardHierarchy(organizationId, parentCardId);
      
      if (!hierarchy.isParent || !hierarchy.hasChildren) {
        return {
          parentCardId,
          direction: swipeDirection,
          decision: 'no_children',
          childrenCount: 0,
          affectedChildren: [],
          timestamp: new Date()
        };
      }

      // FUNCTIONAL: Determine child inclusion based on swipe direction and play mode
      // STRATEGIC: Right swipe typically includes children, left excludes them
      let decision;
      switch (hierarchy.playMode) {
        case 'conditional':
          decision = swipeDirection === 'right' ? 'include_children' : 'exclude_children';
          break;
        case 'always':
          decision = 'include_children'; // Always include regardless of swipe
          break;
        case 'never':
          decision = 'no_children'; // Never include children
          break;
        default:
          decision = swipeDirection === 'right' ? 'include_children' : 'exclude_children';
      }

      return {
        parentCardId,
        direction: swipeDirection,
        decision,
        childrenCount: hierarchy.childrenCount,
        affectedChildren: hierarchy.childCards.map(child => child.uuid),
        parentName: hierarchy.parentCard.name,
        playMode: hierarchy.playMode,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error processing parent decision:', error);
      throw new Error(`Parent decision processing failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Initialize hierarchical session after parent ranking completion
   * STRATEGIC: Orchestrates the transition from parent ranking to child sessions,
   * setting up the sequential processing of each parent's children
   * 
   * @param {Object} parentPlay - Completed parent play session
   * @param {Object} config - Hierarchical configuration
   * @returns {Promise<Object>} Initialization result
   */
  async initializeHierarchicalFlow(parentPlay, config = {}) {
    try {
      console.log(`🌳 Initializing hierarchical flow for session: ${parentPlay.uuid}`);
      
      const { minChildrenForSession = 2 } = config;
      
      // FUNCTIONAL: Analyze all ranked parents for child session potential
      // STRATEGIC: Determine which parents need child sessions based on children count
      const parentAnalysis = [];
      for (const parentCardId of parentPlay.personalRanking) {
        const hierarchy = await this.analyzeCardHierarchy(parentPlay.organizationId, parentCardId);
        if (hierarchy.hasChildren && hierarchy.childrenCount >= minChildrenForSession) {
          parentAnalysis.push({
            parentCardId,
            parentName: hierarchy.parentCard.name,
            childrenCount: hierarchy.childrenCount,
            needsChildSession: true,
            position: parentPlay.personalRanking.indexOf(parentCardId) + 1
          });
        }
      }

      if (parentAnalysis.length === 0) {
        // FUNCTIONAL: No parents need child sessions - finalize immediately
        // STRATEGIC: Skip hierarchical processing when no children qualify
        return await this.finalizeHierarchicalRanking(parentPlay, []);
      }

      // FUNCTIONAL: Mark parent session as hierarchical and start first child session
      // STRATEGIC: Update session state to track hierarchical progress
      parentPlay.status = 'waiting_for_children';
      parentPlay.hierarchicalPhase = 'parents';
      parentPlay.childSessions = [];
      await parentPlay.save();

      // Track in memory for quick access
      this.activeHierarchicalSessions.set(parentPlay.uuid, {
        parentSession: parentPlay,
        parentAnalysis,
        processedParents: [],
        childSessions: []
      });

      // Start the first child session
      return await this.startNextChildSession(parentPlay.uuid);
    } catch (error) {
      console.error('Error initializing hierarchical flow:', error);
      throw new Error(`Hierarchical initialization failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Start the next child session in hierarchical sequence
   * STRATEGIC: Creates child ranking sessions in parent ranking order,
   * ensuring hierarchical structure is maintained in final results
   * 
   * @param {string} parentSessionId - Parent session UUID
   * @returns {Promise<Object>} Child session creation result
   */
  async startNextChildSession(parentSessionId) {
    try {
      const hierarchicalState = this.activeHierarchicalSessions.get(parentSessionId);
      if (!hierarchicalState) {
        throw new Error('Hierarchical session state not found');
      }

      const { parentSession, parentAnalysis, processedParents } = hierarchicalState;
      
      // FUNCTIONAL: Find next unprocessed parent that needs a child session
      // STRATEGIC: Process parents in ranking order to maintain hierarchy
      const nextParent = parentAnalysis.find(p => !processedParents.includes(p.parentCardId));
      
      if (!nextParent) {
        // FUNCTIONAL: All parents processed - finalize hierarchical ranking
        // STRATEGIC: Aggregate all child session results into final ranking
        return await this.finalizeHierarchicalRanking(parentSession, hierarchicalState.childSessions);
      }

      console.log(`👨‍👩‍👧‍👦 Creating child session for parent: "${nextParent.parentName}"`);

      // FUNCTIONAL: Get child cards for this parent
      // STRATEGIC: Create isolated ranking session for sibling cards only
      const children = await Card.find({
        organizationId: parentSession.organizationId,
        parentTag: nextParent.parentName,
        isActive: true
      });

      // Shuffle children for unbiased initial presentation
      const shuffledChildren = [...children].sort(() => Math.random() - 0.5);
      const childIds = shuffledChildren.map(child => child.uuid);

      // FUNCTIONAL: Create child play session
      // STRATEGIC: Isolated session allows children to be ranked among siblings only
      const childSession = new Play({
        uuid: uuidv4(),
        organizationId: parentSession.organizationId,
        deckTag: nextParent.parentName, // Child session uses parent name as deck
        cardIds: childIds,
        swipes: [],
        votes: [],
        personalRanking: [],
        status: 'active',
        state: 'swiping',
        hierarchicalPhase: 'children',
        parentSessionId: parentSession.uuid,
        currentParentId: nextParent.parentCardId,
        currentParentName: nextParent.parentName,
        parentRankPosition: nextParent.position
      });

      await childSession.save();

      // FUNCTIONAL: Update parent session with child session info
      // STRATEGIC: Maintain bidirectional reference for session management
      parentSession.childSessions.push({
        parentId: nextParent.parentCardId,
        parentName: nextParent.parentName,
        sessionId: childSession.uuid,
        status: 'active',
        childCount: children.length,
        startedAt: new Date()
      });
      parentSession.currentChildSession = childSession.uuid;
      await parentSession.save();

      // Update in-memory state
      hierarchicalState.childSessions.push({
        sessionId: childSession.uuid,
        parentCardId: nextParent.parentCardId,
        parentName: nextParent.parentName,
        status: 'active'
      });

      console.log(`✅ Child session created: ${childSession.uuid} for "${nextParent.parentName}" family`);

      return {
        action: 'child_session_started',
        childSession: {
          playId: childSession.uuid,
          parentName: nextParent.parentName,
          parentPosition: nextParent.position,
          totalCards: children.length,
          cards: shuffledChildren.map(card => ({
            id: card.uuid,
            title: card.title,
            description: card.description,
            imageUrl: card.imageUrl
          })),
          currentCardId: childIds[0]
        }
      };
    } catch (error) {
      console.error('Error starting child session:', error);
      throw new Error(`Child session creation failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Handle completion of a child session
   * STRATEGIC: Processes child session results and continues hierarchical flow,
   * either starting next child session or finalizing complete ranking
   * 
   * @param {Object} childSession - Completed child session
   * @returns {Promise<Object>} Next action result
   */
  async onChildSessionComplete(childSession) {
    try {
      console.log(`🎯 Child session completed: ${childSession.uuid} for "${childSession.currentParentName}"`);
      
      const parentSession = await Play.findOne({ uuid: childSession.parentSessionId });
      if (!parentSession) {
        throw new Error('Parent session not found');
      }

      // FUNCTIONAL: Update parent session with child results
      // STRATEGIC: Store child ranking for final aggregation
      const childSessionIndex = parentSession.childSessions.findIndex(cs => cs.sessionId === childSession.uuid);
      if (childSessionIndex >= 0) {
        parentSession.childSessions[childSessionIndex].status = 'completed';
        parentSession.childSessions[childSessionIndex].completedAt = new Date();
        parentSession.childSessions[childSessionIndex].childRanking = childSession.personalRanking;
        await parentSession.save();
      }

      // Update in-memory state
      const hierarchicalState = this.activeHierarchicalSessions.get(parentSession.uuid);
      if (hierarchicalState) {
        hierarchicalState.processedParents.push(childSession.currentParentId);
        const sessionState = hierarchicalState.childSessions.find(cs => cs.sessionId === childSession.uuid);
        if (sessionState) {
          sessionState.status = 'completed';
          sessionState.ranking = childSession.personalRanking;
        }
      }

      // Continue hierarchical flow
      return await this.startNextChildSession(parentSession.uuid);
    } catch (error) {
      console.error('Error processing child session completion:', error);
      throw new Error(`Child session completion failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Finalize complete hierarchical ranking
   * STRATEGIC: Aggregates parent ranking with all child rankings, maintaining
   * hierarchical order with parents followed by their ranked children
   * 
   * @param {Object} parentSession - Parent session with completed child sessions
   * @param {Array} childSessions - Array of completed child session data
   * @returns {Promise<HierarchicalResult>} Final hierarchical ranking
   */
  async finalizeHierarchicalRanking(parentSession, childSessions = []) {
    try {
      console.log(`🏁 Finalizing hierarchical ranking for: ${parentSession.uuid}`);

      const hierarchicalRanking = [];
      const rankingDetails = [];

      // FUNCTIONAL: Process each parent in ranking order
      // STRATEGIC: Maintain parent ranking sequence while inserting children
      for (let position = 0; position < parentSession.personalRanking.length; position++) {
        const parentId = parentSession.personalRanking[position];
        
        // Add parent to ranking
        hierarchicalRanking.push(parentId);
        
        // FUNCTIONAL: Find corresponding child session results
        // STRATEGIC: Insert children immediately after their parent
        const childSession = parentSession.childSessions?.find(cs => cs.parentId === parentId);
        
        if (childSession && childSession.status === 'completed' && childSession.childRanking) {
          // Add ranked children after parent
          hierarchicalRanking.push(...childSession.childRanking);
          
          rankingDetails.push({
            parentId,
            parentPosition: position + 1,
            type: 'parent_with_children',
            childCount: childSession.childRanking.length,
            childIds: childSession.childRanking
          });
        } else {
          // Parent with no children or incomplete child session
          rankingDetails.push({
            parentId,
            parentPosition: position + 1,
            type: 'parent_only',
            childCount: 0
          });
        }
      }

      // FUNCTIONAL: Update parent session with final results
      // STRATEGIC: Store complete hierarchical data for future reference
      parentSession.status = 'hierarchically_completed';
      parentSession.hierarchicalRanking = hierarchicalRanking;
      parentSession.hierarchicalDetails = rankingDetails;
      parentSession.completedAt = new Date();
      parentSession.currentChildSession = null;
      await parentSession.save();

      // Clean up in-memory state
      this.activeHierarchicalSessions.delete(parentSession.uuid);

      console.log(`✅ Hierarchical ranking finalized: ${parentSession.personalRanking.length} parents → ${hierarchicalRanking.length} total items`);

      return {
        action: 'hierarchical_complete',
        parentSessionId: parentSession.uuid,
        totalItems: hierarchicalRanking.length,
        parentCount: parentSession.personalRanking.length,
        childCount: hierarchicalRanking.length - parentSession.personalRanking.length,
        hierarchicalRanking,
        rankingDetails,
        completedAt: new Date()
      };
    } catch (error) {
      console.error('Error finalizing hierarchical ranking:', error);
      throw new Error(`Hierarchical finalization failed: ${error.message}`);
    }
  }

  /**
   * FUNCTIONAL: Check if a play session needs hierarchical processing
   * STRATEGIC: Determines when to initiate hierarchical flow based on parent cards
   * in the completed ranking
   * 
   * @param {Object} playSession - Completed play session to analyze
   * @param {Object} config - Configuration options
   * @returns {Promise<boolean>} Whether hierarchical processing is needed
   */
  async needsHierarchicalProcessing(playSession, config = {}) {
    if (playSession.status !== 'completed' || playSession.hierarchicalPhase === 'children') {
      return false;
    }

    const { minChildrenForSession = 2 } = config;

    // Check if any ranked cards are parents with sufficient children
    for (const cardId of playSession.personalRanking) {
      const hierarchy = await this.analyzeCardHierarchy(playSession.organizationId, cardId);
      if (hierarchy.hasChildren && hierarchy.childrenCount >= minChildrenForSession) {
        return true;
      }
    }

    return false;
  }

  /**
   * FUNCTIONAL: Get hierarchical session status
   * STRATEGIC: Provides monitoring and debugging information for active sessions
   * 
   * @param {string} parentSessionId - Parent session UUID
   * @returns {Object|null} Current hierarchical state
   */
  getHierarchicalSessionStatus(parentSessionId) {
    const state = this.activeHierarchicalSessions.get(parentSessionId);
    if (!state) {
      return null;
    }

    return {
      parentSessionId,
      totalParents: state.parentAnalysis.length,
      processedParents: state.processedParents.length,
      activeChildSessions: state.childSessions.filter(cs => cs.status === 'active').length,
      completedChildSessions: state.childSessions.filter(cs => cs.status === 'completed').length
    };
  }

  /**
   * FUNCTIONAL: Clean up orphaned hierarchical sessions
   * STRATEGIC: Memory management and error recovery for interrupted sessions
   */
  async cleanupOrphanedSessions() {
    const currentTime = new Date();
    const expiredSessions = [];

    // Find sessions older than 24 hours
    for (const [sessionId, state] of this.activeHierarchicalSessions.entries()) {
      const sessionAge = currentTime - state.parentSession.createdAt;
      if (sessionAge > 24 * 60 * 60 * 1000) { // 24 hours
        expiredSessions.push(sessionId);
      }
    }

    // Clean up expired sessions
    for (const sessionId of expiredSessions) {
      this.activeHierarchicalSessions.delete(sessionId);
      console.log(`🧹 Cleaned up orphaned hierarchical session: ${sessionId}`);
    }

    return expiredSessions.length;
  }
}

module.exports = HierarchicalManager;
