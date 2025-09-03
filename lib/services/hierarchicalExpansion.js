const Card = require('../models/Card');
const { rankCards } = require('../utils/ranking');

/**
 * SIMPLIFIED HIERARCHICAL EXPANSION
 * 
 * When a parent ranking is complete, this service:
 * 1. Identifies all ranked parent cards
 * 2. For each parent, gets their children and ranks them  
 * 3. Replaces the parent's position with the ranked children
 * 4. Returns the expanded hierarchical ranking
 */

/**
 * Check if a play session needs hierarchical expansion
 */
async function needsHierarchicalExpansion(play) {
  if (play.status !== 'completed') {
    return false;
  }

  // Check if any ranked cards are parents with children
  for (const cardId of play.personalRanking) {
    const card = await Card.findOne({ 
      uuid: cardId, 
      organizationId: play.organizationId,
      isActive: true 
    });
    
    if (card && card.isParent) {
      const children = await Card.find({
        organizationId: play.organizationId,
        parentTag: card.name,
        isActive: true
      });
      
      if (children.length > 0) {
        return true; // Has at least one parent with children
      }
    }
  }
  
  return false;
}

/**
 * Expand a completed parent ranking by inserting ranked children
 */
async function expandHierarchicalRanking(play) {
  console.log('🌳 Starting hierarchical expansion...');
  
  const expandedRanking = [];
  const expansionLog = [];
  
  // Process each position in the parent ranking
  for (let i = 0; i < play.personalRanking.length; i++) {
    const parentCardId = play.personalRanking[i];
    
    // Get parent card details
    const parentCard = await Card.findOne({ 
      uuid: parentCardId, 
      organizationId: play.organizationId,
      isActive: true 
    });
    
    if (!parentCard) {
      console.log(`⚠️ Parent card ${parentCardId} not found, skipping`);
      expandedRanking.push(parentCardId);
      continue;
    }
    
    // Check if this parent has children
    const children = await Card.find({
      organizationId: play.organizationId,
      parentTag: parentCard.name,
      isActive: true
    });
    
    if (children.length === 0) {
      // No children, keep parent as-is
      console.log(`📄 "${parentCard.title}" has no children, keeping in ranking`);
      expandedRanking.push(parentCardId);
      expansionLog.push({
        parentId: parentCardId,
        parentName: parentCard.name,
        parentTitle: parentCard.title,
        action: 'kept',
        childrenCount: 0
      });
    } else {
      // Has children - rank them and insert in parent's position
      console.log(`👨‍👩‍👧‍👦 "${parentCard.title}" has ${children.length} children, ranking family...`);
      
      // Create a mini ranking session for this family
      const childIds = children.map(child => child.uuid);
      const familyRanking = await rankChildrenFamily(childIds, play.organizationId);
      
      // Insert the ranked children at parent's position
      expandedRanking.push(...familyRanking);
      
      expansionLog.push({
        parentId: parentCardId,
        parentName: parentCard.name,
        parentTitle: parentCard.title,
        action: 'expanded',
        childrenCount: children.length,
        childrenIds: familyRanking
      });
      
      console.log(`✅ "${parentCard.title}" family ranked: ${children.length} children inserted`);
    }
  }
  
  console.log(`🎯 Hierarchical expansion complete: ${play.personalRanking.length} parents → ${expandedRanking.length} total cards`);
  
  return {
    expandedRanking,
    expansionLog,
    originalParentRanking: play.personalRanking
  };
}

/**
 * Rank children within a family using a simplified approach
 * For now, we'll use a simple scoring approach, but this could be enhanced
 * to create mini-voting sessions if needed
 */
async function rankChildrenFamily(childIds, organizationId) {
  // Get all child cards
  const children = await Card.find({
    uuid: { $in: childIds },
    organizationId,
    isActive: true
  });
  
  if (children.length <= 1) {
    return childIds; // No ranking needed for single child
  }
  
  // For now, rank by globalScore descending
  // TODO: This could be enhanced to create actual voting sessions for families
  const rankedChildren = children
    .sort((a, b) => (b.globalScore || 0) - (a.globalScore || 0))
    .map(child => child.uuid);
    
  console.log(`  📊 Family ranked by score: ${rankedChildren.length} children`);
  return rankedChildren;
}

/**
 * Update a play session with hierarchical expansion results
 */
async function applyHierarchicalExpansion(play, expansionResult) {
  // Store the expansion information
  play.hierarchicalExpansion = {
    originalRanking: expansionResult.originalParentRanking,
    expandedRanking: expansionResult.expandedRanking,
    expansionLog: expansionResult.expansionLog,
    expandedAt: new Date()
  };
  
  // Update the personal ranking to the expanded version
  play.personalRanking = expansionResult.expandedRanking;
  
  // Mark as hierarchically expanded
  play.isHierarchicallyExpanded = true;
  
  await play.save();
  
  console.log(`💾 Applied hierarchical expansion to session ${play.uuid}`);
  return play;
}

module.exports = {
  needsHierarchicalExpansion,
  expandHierarchicalRanking,
  applyHierarchicalExpansion
};
