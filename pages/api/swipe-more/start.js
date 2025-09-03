const SwipeMoreEngine = require('../../../lib/services/SwipeMoreEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId, deckTag } = req.body;

    if (!organizationId || !deckTag) {
      return res.status(400).json({ error: 'Missing required parameters: organizationId, deckTag' });
    }

    // Create new session
    const sessionData = await SwipeMoreEngine.startSession(organizationId, deckTag);

    return res.status(200).json(sessionData);
  } catch (error) {
    console.error('SwipeMore start error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
