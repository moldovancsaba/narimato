const SwipeOnlyEngine = require('../../../lib/services/SwipeOnlyEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playId, cardId, direction } = req.body;

    if (!playId || !cardId || !direction) {
      return res.status(400).json({ error: 'Missing required fields: playId, cardId, direction' });
    }

    if (!['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be "left" or "right"' });
    }

    // Process the swipe
    const result = await SwipeOnlyEngine.processSwipe(playId, cardId, direction);

    if (!result) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('SwipeOnly swipe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
