const { connectMaster } = require('../../../lib/db');
const { withOrganization } = require('../../../lib/tenantContext');
const Card = require('../../../lib/models/Card');
const {
  getProjectedCards,
  getRankingsFromProjection,
  isOrgProjectionDirty,
} = require('../../../lib/intelligence/projectionReader');
const { normalizeWebappProjection } = require('../../../lib/webapp-projection');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organizationId, parentTag } = req.query;

  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId required' });
  }

  try {
    await connectMaster();
    return await withOrganization(organizationId, async () => {
      const models = require('../../../lib/tenantContext').getTenantModels();
      const { IntelligenceSnapshot } = models;
      const isDirty = await isOrgProjectionDirty(organizationId);
      const snapshot = await IntelligenceSnapshot.findOne({
        organizationId,
        deckRootTag: null,
      });
      const projection = normalizeWebappProjection(snapshot?.webappProjection, {
        organizationId,
        isDirty,
      });

      let rankings = getRankingsFromProjection(projection);
      let meta = { source: 'projection', freshness: projection?.freshness };

      if (!rankings?.length) {
        const { cards, source, freshness } = await getProjectedCards(organizationId, models, {
          parentTag,
        });
        rankings = cards.map((card, index) => ({
          rank: index + 1,
          cardId: card.uuid,
          globalScore: card.globalScore || 1500,
          voteCount: card.voteCount || 0,
          winCount: card.winCount || 0,
          winRate:
            card.voteCount > 0
              ? Math.round((card.winCount / card.voteCount) * 100)
              : 0,
        }));
        meta = { source, freshness };
      }

      res.json({
        rankings,
        totalCards: rankings.length,
        lastUpdated: projection?.builtAt || new Date().toISOString(),
        meta,
      });
    });
  } catch (error) {
    console.error('Rankings fetch error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
