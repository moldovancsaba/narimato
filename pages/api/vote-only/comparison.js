const VoteOnlyEngine = require('../../../lib/services/VoteOnlyEngine');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playId } = req.query;

    if (!playId) {
      return res.status(400).json({ error: 'Missing required parameter: playId' });
    }

    // Get the next comparison pair
    const comparison = await VoteOnlyEngine.getNextComparison(playId);

    if (!comparison) {
      return res.status(404).json({ error: 'Play session not found or completed' });
    }

    return res.status(200).json(comparison);
  } catch (error) {
    console.error('VoteOnly comparison error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
