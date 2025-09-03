const VoteOnlyEngine = require('../../../lib/services/VoteOnlyEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playId, cardA, cardB, winner } = req.body;

    if (!playId || !cardA || !cardB || !winner) {
      return res.status(400).json({ error: 'Missing required fields: playId, cardA, cardB, winner' });
    }

    // Process the vote
    const result = await VoteOnlyEngine.processVote(playId, cardA, cardB, winner);

    if (!result) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('VoteOnly vote error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
