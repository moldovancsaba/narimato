const { connectMaster } = require('../../../lib/db');
const { withPlayOrganization } = require('../../../lib/api/playRoute');
const Play = require('../../../lib/models/Play');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectMaster();

    const { playId } = req.query;
    
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }

    return await withPlayOrganization(playId, async () => {
    const play = await Play.findOne({ uuid: playId });
    
    if (!play) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    res.json({
      playId: play.uuid,
      status: play.status,
      personalRanking: play.personalRanking,
      votes: play.votes,
      swipes: play.swipes,
      completedAt: play.completedAt,
      organizationId: play.organizationId,
      deckTag: play.deckTag
    });
    });

  } catch (error) {
    console.error('Results fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
