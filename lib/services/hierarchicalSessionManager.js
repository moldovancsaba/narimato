const Card = require('../models/Card');
const Play = require('../models/Play');
const { v4: uuidv4 } = require('uuid');

/**
 * INTERACTIVE HIERARCHICAL SESSION MANAGER
 * 
 * Manages the complete hierarchical decision tree flow:
 * 1. Parent session: Rank parent cards
 * 2. Child sessions: For each ranked parent, create interactive child session
 * 3. Final assembly: Combine results into hierarchical ranking
 */

/**
 * Check if a completed parent session should start child sessions
 */
async function needsChildSessions(play) {
  if (play.status !== 'completed' || play.hierarchicalPhase !== 'parents') {
    return false;
  }

  // Check if any ranked parents have children
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
      
      if (children.length >= 2) { // Only create child session if 2+ children
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Start the next child session for a hierarchical play
 */
async function startNextChildSession(parentPlay) {
  console.log(`🌳 Starting next child session for hierarchical play: ${parentPlay.uuid}`);
  
  // Get the next parent that needs a child session
  const nextParent = await findNextParentForChildSession(parentPlay);
  
  if (!nextParent) {
    // No more parents need child sessions - finalize hierarchical ranking
    return await finalizeHierarchicalRanking(parentPlay);
  }
  
  console.log(`👨‍👩‍👧‍👦 Creating child session for parent: "${nextParent.card.name}"`);
  
  // Get children for this parent
  const children = await Card.find({
    organizationId: parentPlay.organizationId,
    parentTag: nextParent.card.name,
    isActive: true
  });
  
  if (children.length < 2) {
    // Skip parents with less than 2 children
    console.log(`⚠️ Parent "${nextParent.card.name}" has ${children.length} children, skipping`);
    
    // Mark this parent as processed and try next
    if (!parentPlay.childSessions) parentPlay.childSessions = [];
    parentPlay.childSessions.push({
      parentId: nextParent.card.uuid,
      parentName: nextParent.card.name,
      status: 'skipped',
      reason: 'insufficient_children',
      childCount: children.length
    });
    await parentPlay.save();
    
    // Recursively try next parent
    return await startNextChildSession(parentPlay);
  }
  
  // Create child session
  const shuffledChildren = [...children].sort(() => Math.random() - 0.5);
  const childIds = shuffledChildren.map(child => child.uuid);
  
  const childSession = new Play({
    uuid: uuidv4(),
    organizationId: parentPlay.organizationId,
    deckTag: nextParent.card.name, // Child session deck is parent's name
    cardIds: childIds,
    swipes: [],
    votes: [],
    personalRanking: [],
    status: 'active',
    hierarchicalPhase: 'children',
    parentSessionId: parentPlay.uuid,
    currentParentId: nextParent.card.uuid,
    currentParentName: nextParent.card.name,
    parentRankPosition: nextParent.position
  });
  
  await childSession.save();
  
  // Update parent session - reload fresh document and save
  const freshParentPlay = await Play.findOne({ uuid: parentPlay.uuid });
  if (!freshParentPlay.childSessions) freshParentPlay.childSessions = [];
  
  freshParentPlay.childSessions.push({
    parentId: nextParent.card.uuid,
    parentName: nextParent.card.name,
    sessionId: childSession.uuid,
    status: 'active',
    childCount: children.length,
    startedAt: new Date()
  });
  
  freshParentPlay.status = 'waiting_for_children';
  freshParentPlay.currentChildSession = childSession.uuid;
  
  try {
    await freshParentPlay.save();
    console.log('✅ Parent session updated successfully with child session');
  } catch (saveError) {
    console.log('⚠️ Save error, trying direct MongoDB update...', saveError.message);
    // Fallback to direct MongoDB update with raw collection access
    const result = await Play.collection.updateOne(
      { uuid: parentPlay.uuid },
      {
        $push: { 
          childSessions: {
            parentId: nextParent.card.uuid,
            parentName: nextParent.card.name,
            sessionId: childSession.uuid,
            status: 'active',
            childCount: children.length,
            startedAt: new Date()
          }
        },
        $set: {
          status: 'waiting_for_children',
          currentChildSession: childSession.uuid
        }
      }
    );
    console.log('✅ MongoDB direct update result:', result.modifiedCount, 'documents modified');
  }
  
  console.log(`✅ Child session created: ${childSession.uuid} for "${nextParent.card.name}" family`);
  
  return {
    action: 'child_session_started',
    childSession: {
      playId: childSession.uuid,
      parentName: nextParent.card.name,
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
}

/**
 * Find the next parent that needs a child session
 */
async function findNextParentForChildSession(parentPlay) {
  const processedParents = (parentPlay.childSessions || []).map(cs => cs.parentId);
  
  // Go through parent ranking in order
  for (let position = 0; position < parentPlay.personalRanking.length; position++) {
    const cardId = parentPlay.personalRanking[position];
    
    // Skip if already processed
    if (processedParents.includes(cardId)) {
      continue;
    }
    
    // Get card details
    const card = await Card.findOne({ 
      uuid: cardId, 
      organizationId: parentPlay.organizationId,
      isActive: true 
    });
    
    if (card && card.isParent) {
      return { card, position: position + 1 }; // 1-indexed position
    }
  }
  
  return null; // No more parents need child sessions
}

/**
 * Handle completion of a child session
 */
async function onChildSessionComplete(childSession) {
  console.log(`🎯 Child session completed: ${childSession.uuid} for "${childSession.currentParentName}"`);
  
  // Get parent session
  const parentPlay = await Play.findOne({ uuid: childSession.parentSessionId });
  if (!parentPlay) {
    throw new Error('Parent session not found');
  }
  
  // Update parent session with child results
  const childSessionIndex = parentPlay.childSessions.findIndex(cs => cs.sessionId === childSession.uuid);
  if (childSessionIndex >= 0) {
    parentPlay.childSessions[childSessionIndex].status = 'completed';
    parentPlay.childSessions[childSessionIndex].completedAt = new Date();
    parentPlay.childSessions[childSessionIndex].childRanking = childSession.personalRanking;
  }
  
  // Start next child session or finalize
  const result = await startNextChildSession(parentPlay);
  
  console.log(`📊 Child session processed, next action: ${result.action}`);
  return result;
}

/**
 * Finalize the complete hierarchical ranking
 */
async function finalizeHierarchicalRanking(parentPlay) {
  console.log(`🏁 Finalizing hierarchical ranking for: ${parentPlay.uuid}`);
  
  const hierarchicalRanking = [];
  const rankingDetails = [];
  
  // Process each parent in ranking order
  for (let position = 0; position < parentPlay.personalRanking.length; position++) {
    const parentId = parentPlay.personalRanking[position];
    
    // Find child session for this parent
    const childSession = parentPlay.childSessions?.find(cs => cs.parentId === parentId);
    
    if (childSession && childSession.status === 'completed' && childSession.childRanking) {
      // Insert parent followed by ranked children
      hierarchicalRanking.push(parentId);
      hierarchicalRanking.push(...childSession.childRanking);
      
      rankingDetails.push({
        parentId,
        parentPosition: position + 1,
        type: 'parent_with_children',
        childCount: childSession.childRanking.length,
        childIds: childSession.childRanking
      });
    } else {
      // Parent with no children or skipped session
      hierarchicalRanking.push(parentId);
      
      rankingDetails.push({
        parentId,
        parentPosition: position + 1,
        type: 'parent_only',
        childCount: 0
      });
    }
  }
  
  // Update parent session with final results
  parentPlay.status = 'hierarchically_completed';
  parentPlay.hierarchicalRanking = hierarchicalRanking;
  parentPlay.hierarchicalDetails = rankingDetails;
  parentPlay.completedAt = new Date();
  parentPlay.currentChildSession = null;
  
  await parentPlay.save();
  
  console.log(`✅ Hierarchical ranking finalized: ${parentPlay.personalRanking.length} parents → ${hierarchicalRanking.length} total items`);
  
  return {
    action: 'hierarchical_complete',
    parentSessionId: parentPlay.uuid,
    totalItems: hierarchicalRanking.length,
    hierarchicalRanking,
    rankingDetails
  };
}

/**
 * Initialize hierarchical session on parent completion
 */
async function initializeHierarchicalSession(play) {
  // Mark as parent phase completed
  play.hierarchicalPhase = 'parents';
  await play.save();
  
  // Check if we need child sessions
  if (await needsChildSessions(play)) {
    console.log(`🌱 Initializing hierarchical child sessions for: ${play.uuid}`);
    return await startNextChildSession(play);
  } else {
    // No child sessions needed - finalize immediately
    console.log(`📋 No child sessions needed, finalizing: ${play.uuid}`);
    return await finalizeHierarchicalRanking(play);
  }
}

module.exports = {
  needsChildSessions,
  startNextChildSession,
  onChildSessionComplete,
  initializeHierarchicalSession
};
