const SwipeOnlyEngine = require('../../../lib/services/SwipeOnlyEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId, deckTag } = req.body;
    
    if (!organizationId || !deckTag) {
      return res.status(400).json({ error: 'Missing required fields: organizationId, deckTag' });
    }
    
    console.log(`🎆 Creating SwipeOnly session for deck: ${deckTag}`);
    
    // Start or resume a swipe-only session
    const sessionData = await SwipeOnlyEngine.startSession(organizationId, deckTag);
    
    res.json({
      ...sessionData,
      success: true,
      message: 'SwipeOnly session created successfully'
    });

  } catch (error) {
    console.error('SwipeOnly start error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('Need at least 2 cards')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error creating SwipeOnly session' });
  }
}
