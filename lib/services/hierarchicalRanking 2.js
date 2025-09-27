const Card = require('../models/Card');

/**
 * FUNCTIONAL: Hierarchical Ranking Service for Decision Tree Card Management
 * STRATEGIC: Enables parent cards to control child card inclusion and ranking behavior
 * in play sessions, implementing conditional hierarchical decision logic
 */
class HierarchicalRankingService {
  
  /**
   * FUNCTIONAL: Detect if a card is a parent with children in conditional mode
   * STRATEGIC: Determines if swipe decision affects child card inclusion
   */
  async isParentWithConditionalChildren(organizationId, cardId) {
    try {
      const card = await Card.findOne({ 
        organizationId, 
        uuid: cardId, 
        isActive: true 
      });

      if (!card || !card.isParent) {
        return { isParent: false, children: [] };
      }

      // FUNCTIONAL: Get child cards that are affected by parent decision
      // STRATEGIC: Only conditional children are affected by parent swipe direction
      const children = await Card.find({
        organizationId,
        parentTag: card.name,
        isActive: true
      });

      return {
        isParent: true,
        hasConditionalChildren: card.childrenPlayMode === 'conditional' && children.length > 0,
        children: children,
        playMode: card.childrenPlayMode
      };
    } catch (error) {
      console.error('Error checking parent status:', error);
      return { isParent: false, children: [] };
    }
  }

  /**
   * FUNCTIONAL: Get all cards that should be included in a play session
   * STRATEGIC: Builds complete deck including parent cards and conditionally included children
   */
  async buildHierarchicalDeck(organizationId, deckTag) {
    try {
      // FUNCTIONAL: Get all child cards of the requested deck
      // STRATEGIC: These become the parent cards in hierarchical sessions
      const parentCards = await Card.find({
        organizationId,
        parentTag: deckTag,
        isActive: true
      }).sort({ globalScore: -1 });

      // FUNCTIONAL: Build deck with parent cards and their potential children
      // STRATEGIC: Include all cards but mark children for conditional inclusion
      let hierarchicalDeck = [];
      
      for (const parent of parentCards) {
        // Add parent card to deck
        hierarchicalDeck.push({
          ...parent.toObject(),
          cardType: 'parent',
          originalIndex: hierarchicalDeck.length
        });

        // FUNCTIONAL: Get children of this parent card
        // STRATEGIC: Children will be conditionally included based on parent swipe
        const children = await Card.find({
          organizationId,
          parentTag: parent.name,
          isActive: true
        }).sort({ globalScore: -1 });

        // Mark children with conditional inclusion metadata
        children.forEach(child => {
          hierarchicalDeck.push({
            ...child.toObject(),
            cardType: 'child',
            parentCardId: parent.uuid,
            parentName: parent.name,
            conditionalInclusion: parent.childrenPlayMode === 'conditional',
            originalIndex: hierarchicalDeck.length
          });
        });
      }

      return {
        deck: hierarchicalDeck,
        totalCards: hierarchicalDeck.length,
        parentCount: parentCards.length,
        childCount: hierarchicalDeck.length - parentCards.length
      };
    } catch (error) {
      console.error('Error building hierarchical deck:', error);
      throw error;
    }
  }

  /**
   * FUNCTIONAL: Process parent card swipe decision
   * STRATEGIC: Determines which child cards should be included/excluded based on swipe direction
   */
  async processParentSwipeDecision(organizationId, parentCardId, swipeDirection, currentPlay) {
    try {
      const parentInfo = await this.isParentWithConditionalChildren(organizationId, parentCardId);
      
      if (!parentInfo.isParent || !parentInfo.hasConditionalChildren) {
        return {
          hasChildrenToProcess: false,
          childCards: [],
          decision: 'no_children'
        };
      }

      const decision = swipeDirection === 'right' ? 'include_children' : 'exclude_children';
      
      return {
        hasChildrenToProcess: parentInfo.hasConditionalChildren,
        childCards: parentInfo.children,
        decision: decision,
        parentName: parentCardId,
        childrenCount: parentInfo.children.length
      };
    } catch (error) {
      console.error('Error processing parent swipe decision:', error);
      throw error;
    }
  }

  /**
   * FUNCTIONAL: Filter deck cards based on parent decisions made during session
   * STRATEGIC: Dynamically excludes child cards whose parents were swiped left
   */
  filterDeckByParentDecisions(deck, parentDecisions) {
    return deck.filter(card => {
      // Always include parent cards
      if (card.cardType === 'parent') {
        return true;
      }

      // FUNCTIONAL: For child cards, check parent decision
      // STRATEGIC: Only include children whose parents were swiped right
      if (card.cardType === 'child' && card.conditionalInclusion) {
        const parentDecision = parentDecisions[card.parentCardId];
        
        // If parent hasn't been swiped yet, keep child in potential deck
        if (!parentDecision) {
          return true;
        }
        
        // Only include if parent was swiped right
        return parentDecision.direction === 'right';
      }

      // Include non-conditional children
      return true;
    });
  }

  /**
   * FUNCTIONAL: Create child ranking mini-session
   * STRATEGIC: Isolate child cards for ranking among siblings only
   */
  async createChildRankingSession(organizationId, parentCardId, childCards, currentPlay) {
    try {
      // FUNCTIONAL: Filter only the children of the specific parent
      // STRATEGIC: Children compete only against their siblings
      // Note: childCards come from database and don't have parentCardId set to UUID,
      // but we know all cards in this array belong to this parent already
      const siblingCards = childCards; // All childCards already belong to this parent
      
      if (siblingCards.length < 2) {
        // Not enough children for ranking, add directly to parent position
        return {
          requiresChildSession: false,
          childCards: siblingCards,
          sessionType: 'direct_insert'
        };
      }

      return {
        requiresChildSession: true,
        childCards: siblingCards,
        sessionType: 'child_ranking',
        parentCardId: parentCardId
      };
    } catch (error) {
      console.error('Error creating child ranking session:', error);
      throw error;
    }
  }

  /**
   * FUNCTIONAL: Insert child rankings at their parent's position
   * STRATEGIC: Maintain hierarchical order by positioning children relative to parent
   */
  insertChildrenAtParentPosition(finalRanking, parentCardId, childRanking) {
    try {
      // FUNCTIONAL: Find parent's position in final ranking
      // STRATEGIC: Children will be inserted immediately after parent
      const parentIndex = finalRanking.findIndex(card => card.uuid === parentCardId);
      
      if (parentIndex === -1) {
        console.warn(`Parent card ${parentCardId} not found in ranking`);
        return finalRanking;
      }

      // FUNCTIONAL: Insert children after parent, maintaining their relative order
      // STRATEGIC: Preserves both hierarchical structure and child ranking results
      const beforeParent = finalRanking.slice(0, parentIndex + 1);
      const afterParent = finalRanking.slice(parentIndex + 1);
      
      return [...beforeParent, ...childRanking, ...afterParent];
    } catch (error) {
      console.error('Error inserting children at parent position:', error);
      return finalRanking;
    }
  }

  /**
   * FUNCTIONAL: Get next card considering hierarchical flow
   * STRATEGIC: Manages card presentation order respecting parent-child relationships
   */
  getNextCardInHierarchicalFlow(filteredDeck, swipedCardIds, parentDecisions) {
    // FUNCTIONAL: Get cards not yet swiped
    // STRATEGIC: Prioritize parent cards, then include/exclude children based on decisions
    const availableCards = filteredDeck.filter(card => 
      !swipedCardIds.includes(card.uuid)
    );

    if (availableCards.length === 0) {
      return null;
    }

    // FUNCTIONAL: Prefer parent cards first, then children
    // STRATEGIC: Establish parent decisions before showing children
    const parentCard = availableCards.find(card => card.cardType === 'parent');
    if (parentCard) {
      return parentCard;
    }

    // FUNCTIONAL: If no parents left, show children whose parents were swiped right
    // STRATEGIC: Only show children that should be included based on parent decisions
    const availableChild = availableCards.find(card => {
      if (card.cardType !== 'child' || !card.conditionalInclusion) {
        return true; // Non-conditional children always available
      }

      const parentDecision = parentDecisions[card.parentCardId];
      return parentDecision && parentDecision.direction === 'right';
    });

    return availableChild || null;
  }

  /**
   * FUNCTIONAL: Validate hierarchical session state
   * STRATEGIC: Ensure consistency in decision tree session management
   */
  validateHierarchicalState(play, parentDecisions) {
    const warnings = [];
    
    // Check for orphaned children
    const childCards = play.cardIds.filter(cardId => {
      const card = play.deck.find(c => c.uuid === cardId);
      return card && card.cardType === 'child';
    });

    childCards.forEach(childCardId => {
      const childCard = play.deck.find(c => c.uuid === childCardId);
      if (childCard && childCard.conditionalInclusion) {
        const parentDecision = parentDecisions[childCard.parentCardId];
        if (!parentDecision) {
          warnings.push(`Child card ${childCardId} has no parent decision`);
        }
      }
    });

    return { isValid: warnings.length === 0, warnings };
  }
}

module.exports = new HierarchicalRankingService();
