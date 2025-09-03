const { connectDB } = require('../../../../lib/db');
const SwipeOnlyEngine = require('../../../../lib/services/SwipeOnlyEngine');

// FUNCTIONAL: Get current card state for SwipeOnly session
// STRATEGIC: Pure swipe interface - no voting context or complex state
const engine = new SwipeOnlyEngine();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId } = req.query;
    
    // FUNCTIONAL: Validate playId parameter
    // STRATEGIC: Ensure valid session before processing
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }
    
    console.log(`📋 Getting current card for SwipeOnly session: ${playId}`);
    
    // FUNCTIONAL: Get current card or completion status
    // STRATEGIC: Simple state retrieval for swipe-only workflow
    const currentState = await engine.getCurrentCard(playId);
    
    res.json({
      ...currentState,
      success: true
    });

  } catch (error) {
    console.error('SwipeOnly current card error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('not found') || error.message.includes('not active')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error getting current card' });
  }
}
