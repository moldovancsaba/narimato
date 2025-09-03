const { connectDB } = require('../../../../lib/db');
const SwipeOnlyEngine = require('../../../../lib/services/SwipeOnlyEngine');

// FUNCTIONAL: Process swipe actions for SwipeOnly sessions
// STRATEGIC: Pure swipe processing - no voting triggers or complex state transitions
const engine = new SwipeOnlyEngine();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId } = req.query;
    const { cardId, direction } = req.body;
    
    // FUNCTIONAL: Validate input parameters
    // STRATEGIC: Early validation prevents processing invalid swipe requests
    if (!playId || !cardId || !direction) {
      return res.status(400).json({ error: 'playId, cardId, and direction required' });
    }

    if (!['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be left or right' });
    }

    console.log(`👆 Processing SwipeOnly: ${cardId} swiped ${direction}`);

    // FUNCTIONAL: Process swipe through SwipeOnly engine
    // STRATEGIC: Pure swipe-based ranking without any voting complexity
    const result = await engine.processSwipe(playId, cardId, direction);

    // FUNCTIONAL: Build clean API response for swipe-only workflow
    // STRATEGIC: Simple response structure focused on swipe progression
    const response = {
      success: result.success,
      completed: result.completed,
      nextCardId: result.nextCardId,
      progress: result.progress
    };

    res.json(response);

  } catch (error) {
    console.error('SwipeOnly swipe error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('not found') || error.message.includes('not active')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already swiped')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error processing swipe' });
  }
}
