const { connectDB } = require('../../../../lib/db');
const SwipeOnlyEngine = require('../../../../lib/services/SwipeOnlyEngine');

// FUNCTIONAL: Get final results for SwipeOnly session
// STRATEGIC: Simple ranking based on swipe order - first liked = highest preference
const engine = new SwipeOnlyEngine();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId } = req.query;
    
    // FUNCTIONAL: Validate playId parameter
    // STRATEGIC: Ensure valid session before retrieving results
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }
    
    console.log(`📊 Getting SwipeOnly results for session: ${playId}`);
    
    // FUNCTIONAL: Get final ranking and session results
    // STRATEGIC: Complete ranking with liked cards ordered by swipe timing
    const results = await engine.getFinalRanking(playId);
    
    res.json({
      ...results,
      success: true
    });

  } catch (error) {
    console.error('SwipeOnly results error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error getting results' });
  }
}
