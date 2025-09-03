const { connectDB } = require('../../../../lib/db');
const VoteOnlyEngine = require('../../../../lib/services/VoteOnlyEngine');

// FUNCTIONAL: Get current comparison pair for VoteOnly session
// STRATEGIC: Tournament-style comparison interface - no swiping context
const engine = new VoteOnlyEngine();

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
    
    console.log(`🗳️ Getting current comparison for VoteOnly session: ${playId}`);
    
    // FUNCTIONAL: Get current comparison pair or completion status
    // STRATEGIC: Strategic comparison selection for efficient ranking
    const currentComparison = await engine.getCurrentComparison(playId);
    
    res.json({
      ...currentComparison,
      success: true
    });

  } catch (error) {
    console.error('VoteOnly comparison error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('not found') || error.message.includes('not active')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error getting comparison' });
  }
}
