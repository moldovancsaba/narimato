const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');
const { getDeckCards, isDeck } = require('../../../lib/utils/cardUtils');
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { organizationId, deckTag } = req.body;
    
    if (!organizationId || !deckTag) {
      return res.status(400).json({ error: 'organizationId and deckTag required' });
    }

    // Check if it's a valid deck
    if (!await isDeck(organizationId, deckTag)) {
      return res.status(400).json({ error: 'Not a playable deck' });
    }

    // Get deck cards
    const cards = await getDeckCards(organizationId, deckTag);
    
    if (cards.length < 2) {
      return res.status(400).json({ error: 'Deck needs at least 2 cards' });
    }

    // Shuffle cards
    const shuffledCards = cards.sort(() => Math.random() - 0.5);
    const cardIds = shuffledCards.map(card => card.uuid);

    // Create play session
    const play = new Play({
      uuid: uuidv4(),
      organizationId,
      deckTag,
      cardIds,
      swipes: [],
      votes: [],
      personalRanking: []
    });

    await play.save();

    res.json({
      playId: play.uuid,
      deckTag,
      cards: shuffledCards.map(card => ({
        id: card.uuid,
        title: card.title,
        description: card.description,
        imageUrl: card.imageUrl
      })),
      currentCardId: cardIds[0]
    });

  } catch (error) {
    console.error('Play start error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
