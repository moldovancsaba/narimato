const { connectDB } = require('../../../lib/db');
const DecisionTreeEngine = require('../../../lib/services/DecisionTreeEngine');
const Play = require('../../../lib/models/Play');

// FUNCTIONAL: Clean decision tree engine
// STRATEGIC: Simple, working implementation built from scratch
const engine = new DecisionTreeEngine();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { organizationId, deckTag } = req.body;
    
    if (!organizationId || !deckTag) {
      return res.status(400).json({ error: 'organizationId and deckTag required' });
    }
    
    // Check for existing session
    const existingSession = await Play.findOne({ 
      organizationId, 
      deckTag, 
      status: { $in: ['active', 'waiting_for_children'] }
    }).sort({ createdAt: -1 });
    
    if (existingSession) {
      console.log('🔁 Resuming session:', existingSession.uuid);
      const sessionData = await engine.getSessionData(existingSession.uuid);
      return res.json({
        ...sessionData,
        resumed: true
      });
    }

    // Create new session
    console.log('🎆 Creating new session for:', deckTag);
    const sessionData = await engine.createSession(organizationId, deckTag);
    res.json(sessionData);

  } catch (error) {
    console.error('Play start error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
