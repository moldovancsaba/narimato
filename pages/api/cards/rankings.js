const { connectDB } = require('../../../lib/db');
const Card = require('../../../lib/models/Card');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { organizationId, parentTag } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
    }

    // Build query
    const query = { 
      organizationId, 
      isActive: true,
      voteCount: { $gt: 0 } // Only include cards that have been voted on
    };
    
    if (parentTag) {
      query.parentTag = parentTag;
    }

    // Get cards sorted by global score (ELO rating)
    const cards = await Card.find(query)
      .sort({ 
        globalScore: -1,    // Primary: ELO score descending
        voteCount: -1,      // Secondary: Vote count descending  
        winCount: -1        // Tertiary: Win count descending
      });

    // Transform to ranking format
    const rankings = cards.map((card, index) => ({
      rank: index + 1,
      cardId: card.uuid,
      globalScore: card.globalScore || 1500,
      voteCount: card.voteCount || 0,
      winCount: card.winCount || 0,
      winRate: card.voteCount > 0 ? Math.round((card.winCount / card.voteCount) * 100) : 0
    }));

    res.json({
      rankings,
      totalCards: rankings.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Rankings fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
