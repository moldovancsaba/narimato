const { connectDB } = require('../../../lib/db');
const DecisionTreeEngine = require('../../../lib/services/DecisionTreeEngine');

// FUNCTIONAL: Clean decision tree engine
// STRATEGIC: Simple, working implementation built from scratch
const engine = new DecisionTreeEngine();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId, cardId, direction } = req.body;
    
    // FUNCTIONAL: Validate input parameters
    // STRATEGIC: Early validation prevents processing invalid requests
    if (!playId || !cardId || !direction) {
      return res.status(400).json({ error: 'playId, cardId, and direction required' });
    }

    if (!['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be left or right' });
    }

    console.log(`👆 Processing swipe: ${cardId} swiped ${direction}`);

    // FUNCTIONAL: Process swipe through clean decision tree engine
    // STRATEGIC: Built-from-scratch implementation that actually works
    const result = await engine.processSwipe(playId, cardId, direction);

    // FUNCTIONAL: Build API response with hierarchical redirect information
    // STRATEGIC: Provide complete information for UI state management
    const response = {
      success: result.success,
      requiresVoting: result.requiresVoting,
      votingContext: result.votingContext,
      nextCardId: result.nextCardId,
      currentRanking: result.currentRanking,
      completed: result.completed,
      hierarchical: result.hierarchical
    };

    // FUNCTIONAL: Add redirect information for hierarchical flow
    // STRATEGIC: Enable seamless UI transitions between parent and child sessions
    if (result.hierarchical && result.hierarchical.action === 'child_session_started') {
      response.redirectTo = {
        type: 'child_session',
        playId: result.hierarchical.childSession.playId,
        message: `Now rank the "${result.hierarchical.childSession.parentName}" family`,
        delay: 2000 // 2 second delay to show completion message first
      };
      console.log(`✅ Swipe API - Added redirect info: ${response.redirectTo.playId}`);
    }
    
    if (result.hierarchical && result.hierarchical.action === 'hierarchical_complete') {
      response.redirectTo = {
        type: 'hierarchical_results',
        playId: result.hierarchical.parentSessionId,
        message: 'Hierarchical decision tree complete!',
        delay: 2000
      };
      console.log(`✅ Swipe API - Hierarchical complete redirect`);
    }

    res.json(response);

  } catch (error) {
    console.error('Swipe API error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already swiped') || error.message.includes('Cannot swipe')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error processing swipe' });
  }
}
