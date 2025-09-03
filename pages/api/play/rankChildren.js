const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');
const Card = require('../../../lib/models/Card');
const { getDeckCards } = require('../../../lib/utils/cardUtils');
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { parentCardId, organizationId } = req.body;
    
    if (!parentCardId || !organizationId) {
      return res.status(400).json({ error: 'parentCardId and organizationId required' });
    }

    // Get the parent card
    const parentCard = await Card.findOne({ 
      organizationId, 
      uuid: parentCardId, 
      isParent: true,
      isActive: true 
    });
    
    if (!parentCard) {
      return res.status(404).json({ error: 'Parent card not found' });
    }

    // Get children of this parent
    const children = await Card.find({
      organizationId,
      parentTag: parentCard.name,
      isActive: true
    });
    
    if (children.length < 2) {
      return res.status(400).json({ error: 'Parent needs at least 2 children for ranking' });
    }

    console.log(`🎮 Starting FAMILY-ONLY ranking for parent "${parentCard.title}" with ${children.length} children`);
    console.log('🛡️ FAMILY RULE: Only siblings from the same parent can compete against each other');

    // Create child ranking session - ONLY siblings compete
    const shuffledChildren = [...children].sort(() => Math.random() - 0.5);
    const childIds = shuffledChildren.map(child => child.uuid);

    const childPlay = new Play({
      uuid: uuidv4(),
      organizationId,
      deckTag: `${parentCard.name}_children`, // Special deck tag for child sessions
      cardIds: childIds,
      swipes: [],
      votes: [],
      personalRanking: [],
      parentCardId: parentCardId, // Mark this as a child session
      parentCardName: parentCard.name
    });

    await childPlay.save();

    // Return child ranking session
    res.json({
      childPlayId: childPlay.uuid,
      parentCard: {
        id: parentCard.uuid,
        title: parentCard.title,
        name: parentCard.name
      },
      totalChildren: children.length,
      children: shuffledChildren.map(child => ({
        id: child.uuid,
        title: child.title,
        description: child.description,
        imageUrl: child.imageUrl
      })),
      currentCardId: childIds[0],
      message: `Child ranking session started for "${parentCard.title}"`
    });

    console.log(`✅ Child ranking session created: ${childPlay.uuid}`);

  } catch (error) {
    console.error('Rank children error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
