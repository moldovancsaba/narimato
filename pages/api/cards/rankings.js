const { connectMaster } = require('../../../lib/db');
const { withOrganization } = require('../../../lib/tenantContext');
const Card = require('../../../lib/models/Card');

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
      const query = {
        organizationId,
        isActive: true,
      };

      if (parentTag) {
        query.$and = [
          { name: { $ne: parentTag } },
          {
            $or: [{ parentTag: parentTag }, { hashtags: parentTag }],
          },
        ];
      }

      const cards = await Card.find(query).sort({
        voteCount: -1,
        globalScore: -1,
        winCount: -1,
      });

      const rankings = cards.map((card, index) => ({
        rank: index + 1,
        cardId: card.uuid,
        globalScore: card.globalScore || 1500,
        voteCount: card.voteCount || 0,
        winCount: card.winCount || 0,
        winRate: card.voteCount > 0 ? Math.round((card.winCount / card.voteCount) * 100) : 0,
      }));

      res.json({
        rankings,
        totalCards: rankings.length,
        lastUpdated: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('Rankings fetch error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
