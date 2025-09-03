const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');
const Card = require('../../../lib/models/Card');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId } = req.query;
    
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }

    const play = await Play.findOne({ uuid: playId, status: 'active' });
    
    if (!play) {
      return res.status(404).json({ error: 'Active play session not found' });
    }

    // Get next card to play
    const swipedIds = play.swipes.map(swipe => swipe.cardId);
    const remainingCardIds = play.cardIds.filter(id => !swipedIds.includes(id));
    
    if (remainingCardIds.length === 0) {
      return res.json({
        playId: play.uuid,
        completed: true,
        currentCard: null,
        remainingCards: 0,
        totalCards: play.cardIds.length,
        currentRanking: play.personalRanking
      });
    }

    // Get the current card details
    const currentCardId = remainingCardIds[0];
    const currentCard = await Card.findOne({ uuid: currentCardId });

    if (!currentCard) {
      console.error('Card not found in database:', currentCardId);
      return res.status(404).json({ 
        error: 'Current card not found in database',
        cardId: currentCardId
      });
    }

    // Return current card and session info
    res.json({
      playId: play.uuid,
      completed: false,
      currentCard: {
        id: currentCard.uuid,
        title: currentCard.title,
        description: currentCard.description,
        imageUrl: currentCard.imageUrl,
        parentTag: currentCard.parentTag,
        isParent: currentCard.isParent
      },
      remainingCards: remainingCardIds.length,
      totalCards: play.cardIds.length,
      swipedCards: swipedIds.length,
      currentRanking: play.personalRanking,
      state: play.state
    });

  } catch (error) {
    console.error('Current card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
