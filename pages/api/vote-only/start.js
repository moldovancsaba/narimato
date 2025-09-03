const VoteOnlyEngine = require('../../../lib/services/VoteOnlyEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId, deckTag } = req.body;

    if (!organizationId || !deckTag) {
      return res.status(400).json({ error: 'Missing required fields: organizationId, deckTag' });
    }

    // Start or resume a vote-only session
    const session = await VoteOnlyEngine.startSession(organizationId, deckTag);

    if (!session) {
      return res.status(400).json({ error: 'Could not start session. Check if deck exists and has at least 2 cards.' });
    }

    return res.status(200).json(session);
  } catch (error) {
    console.error('VoteOnly start error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
