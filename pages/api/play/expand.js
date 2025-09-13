const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');
const Card = require('../../../lib/models/Card');
const { v4: uuidv4 } = require('uuid');
const { fieldNames } = require('../../../lib/constants/fieldNames');
const { CARD_FIELDS, VOTE_FIELDS } = require('../../../lib/constants/fields');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId } = req.body;
    
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }

    const play = await Play.findOne({ [fieldNames.PlayUUID]: playId, status: 'completed' });
    
    if (!play) {
      return res.status(404).json({ error: 'Completed play session not found' });
    }

    console.log('🔍 Checking for parents in ranking:', play[VOTE_FIELDS.PERSONAL_RANKING]);

    // SIMPLE: Find parent cards in the current ranking
    const parentExpansions = [];
    
    for (const cardId of play[VOTE_FIELDS.PERSONAL_RANKING]) {
      const card = await Card.findOne({ 
        organizationId: play.organizationId, 
        [fieldNames.CardUUID]: cardId, 
        isParent: true,
        isActive: true 
      });
      
      if (card) {
        // Find children of this parent
        const children = await Card.find({
          organizationId: play.organizationId,
          parentTag: card.name,
          isActive: true
        });
        
        if (children.length > 0) {
          parentExpansions.push({
            parentCard: {
              id: card[CARD_FIELDS.UUID],
              title: card.title,
              name: card.name
            },
            children: children.map(child => ({
              id: child[CARD_FIELDS.UUID],
              title: child.title,
              name: child.name
            })),
            position: play[VOTE_FIELDS.PERSONAL_RANKING].indexOf(cardId)
          });
        }
      }
    }

    if (parentExpansions.length === 0) {
      return res.json({
        hasParents: false,
        message: 'No parent cards found in ranking. Ranking is complete.',
        finalRanking: play[VOTE_FIELDS.PERSONAL_RANKING]
      });
    }

    console.log(`📊 Found ${parentExpansions.length} parent(s) with children`);

  // Return the expansions that can be processed
  res.json({
    hasParents: true,
    parentExpansions: parentExpansions,
    currentRanking: play[VOTE_FIELDS.PERSONAL_RANKING],
    message: `Found ${parentExpansions.length} parent card(s) that can be expanded`
  });

  } catch (error) {
    console.error('Expand error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
