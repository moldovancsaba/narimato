const SwipeMoreEngine = require('../../../lib/services/SwipeMoreEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playId, cardA, cardB, winner } = req.body;

    if (!playId || !cardA || !cardB || !winner) {
      return res.status(400).json({ error: 'Missing required parameters: playId, cardA, cardB, winner' });
    }

    // Process the vote
    const result = await SwipeMoreEngine.processVote(playId, cardA, cardB, winner);

    return res.status(200).json(result);
  } catch (error) {
    console.error('SwipeMore vote error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
