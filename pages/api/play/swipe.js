const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');
const { getNextComparison } = require('../../../lib/utils/ranking');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId, cardId, direction } = req.body;
    
    if (!playId || !cardId || !direction) {
      return res.status(400).json({ error: 'playId, cardId, and direction required' });
    }

    if (!['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be left or right' });
    }

    const play = await Play.findOne({ uuid: playId, status: 'active' });
    
    if (!play) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    // Check if card was already swiped
    if (play.swipes.some(swipe => swipe.cardId === cardId)) {
      return res.status(400).json({ error: 'Card already swiped' });
    }

    // Add swipe
    play.swipes.push({
      cardId,
      direction,
      timestamp: new Date()
    });

    let requiresVoting = false;
    let votingContext = null;

    // If swiped right (liked), determine if voting is needed
    if (direction === 'right') {
      if (play.personalRanking.length === 0) {
        // First liked card goes directly to ranking
        play.personalRanking = [cardId];
      } else {
        // Need to compare with existing cards using proper binary search
        const compareWith = getNextComparison(play.personalRanking, cardId, play.votes);
        if (compareWith) {
          play.state = 'voting';
          requiresVoting = true;
          votingContext = {
            newCard: cardId,
            compareWith
          };
        } else {
          // No comparison needed, card position already determined by binary search bounds
          // This means the binary search bounds collapsed to a specific position
          play.personalRanking.unshift(cardId);
        }
      }
    }

    // Get next card for swiping
    const swipedIds = play.swipes.map(swipe => swipe.cardId);
    const remainingCards = play.cardIds.filter(id => !swipedIds.includes(id));
    const nextCardId = remainingCards.length > 0 ? remainingCards[0] : null;

    // Check if play is complete
    if (!nextCardId && !requiresVoting) {
      play.status = 'completed';
      play.completedAt = new Date();
    }

    await play.save();

    res.json({
      success: true,
      requiresVoting,
      votingContext,
      nextCardId,
      currentRanking: play.personalRanking,
      completed: play.status === 'completed'
    });

  } catch (error) {
    console.error('Swipe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
