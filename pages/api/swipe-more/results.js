const SwipeMoreEngine = require('../../../lib/services/SwipeMoreEngine');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playId } = req.query;

    if (!playId) {
      return res.status(400).json({ error: 'Missing required parameter: playId' });
    }

    // Get final results and stats
    const results = await SwipeMoreEngine.getFinalRanking(playId);

    if (!results) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('SwipeMore results error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
