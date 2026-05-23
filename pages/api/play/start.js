const { connectMaster } = require('../../../lib/db');
const { withOrganization } = require('../../../lib/tenantContext');
const { registerPlaySession } = require('../../../lib/playSessionIndex');
const DecisionTreeEngine = require('../../../lib/services/DecisionTreeEngine');
const Play = require('../../../lib/models/Play');

const engine = new DecisionTreeEngine();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId, deckTag } = req.body;

    if (!organizationId || !deckTag) {
      return res.status(400).json({ error: 'organizationId and deckTag required' });
    }

    await connectMaster();

    const sessionData = await withOrganization(organizationId, async () => {
      const existingSession = await Play.findOne({
        organizationId,
        deckTag,
        status: { $in: ['active', 'waiting_for_children'] },
      }).sort({ createdAt: -1 });

      if (existingSession) {
        const data = await engine.getSessionData(existingSession.uuid);
        return { ...data, resumed: true };
      }

      return engine.createSession(organizationId, deckTag);
    });

    if (sessionData.playId) {
      await registerPlaySession(sessionData.playId, organizationId, 'classic');
    }

    res.json(sessionData);
  } catch (error) {
    console.error('Play start error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
