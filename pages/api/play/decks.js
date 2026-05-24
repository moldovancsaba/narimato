const { connectMaster } = require('../../../lib/db');
const { withOrganization } = require('../../../lib/tenantContext');
const { getProjectedDecks } = require('../../../lib/intelligence/projectionReader');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const organizationId = req.query.organizationId;
  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId required' });
  }

  try {
    await connectMaster();
    const includeHidden = req.query.includeHidden === 'true';
    const result = await withOrganization(organizationId, async () => {
      const { getTenantModels } = require('../../../lib/tenantContext');
      const models = getTenantModels();
      return getProjectedDecks(organizationId, models, { includeHidden });
    });

    res.json({
      decks: result.decks,
      cards: result.cards,
      meta: {
        source: result.source,
        freshness: result.freshness,
      },
    });
  } catch (error) {
    console.error('Play decks API error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
