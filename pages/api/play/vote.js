const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');
const { insertIntoPersonalRanking, getNextComparison, updateGlobalRankings } = require('../../../lib/utils/ranking');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId, cardA, cardB, winner } = req.body;
    
    if (!playId || !cardA || !cardB || !winner) {
      return res.status(400).json({ error: 'playId, cardA, cardB, and winner required' });
    }

    if (![cardA, cardB].includes(winner)) {
      return res.status(400).json({ error: 'winner must be either cardA or cardB' });
    }

    const play = await Play.findOne({ uuid: playId, status: 'active' });
    
    if (!play) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    if (play.state !== 'voting') {
      return res.status(400).json({ error: 'Play not in voting state' });
    }

    // Record the vote
    play.votes.push({
      cardA,
      cardB,
      winner,
      timestamp: new Date()
    });

    // Update personal ranking using proper binary search with accumulated bounds
    const newCard = play.personalRanking.includes(cardA) ? cardB : cardA;
    const updatedRanking = insertIntoPersonalRanking(
      play.personalRanking,
      newCard,
      winner,
      cardA,
      cardB,
      play.votes // Pass all previous votes for accumulated bounds calculation
    );
    
    // Only update ranking if card was actually inserted
    if (updatedRanking.length > play.personalRanking.length) {
      play.personalRanking = updatedRanking;
      
      // Card was inserted, no more voting needed for this card
      play.state = 'swiping';
    } else {
      // Card needs more comparisons, stay in voting state
      play.state = 'voting';
    }

    // Check if more voting is needed for the current card
    const nextComparison = getNextComparison(
      play.personalRanking, 
      newCard, 
      play.votes // Pass vote history to avoid redundant comparisons
    );
    let requiresMoreVoting = false;
    let votingContext = null;

    if (nextComparison && play.state === 'voting') {
      requiresMoreVoting = true;
      votingContext = {
        newCard,
        compareWith: nextComparison
      };
    } else {
      // No more comparisons needed or card already inserted
      requiresMoreVoting = false;
    }

    // Get next card for swiping (if returning to swipe mode)
    const swipedIds = play.swipes.map(swipe => swipe.cardId);
    const remainingCards = play.cardIds.filter(id => !swipedIds.includes(id));
    const nextCardId = remainingCards.length > 0 ? remainingCards[0] : null;

    // Check if play is complete
    if (!nextCardId && !requiresMoreVoting) {
      play.status = 'completed';
      play.completedAt = new Date();
    }

    await play.save();

    // Update global rankings asynchronously
    updateGlobalRankings(winner, winner === cardA ? cardB : cardA).catch(console.error);

    res.json({
      success: true,
      requiresMoreVoting,
      votingContext,
      returnToSwipe: !requiresMoreVoting,
      nextCardId: !requiresMoreVoting ? nextCardId : null,
      currentRanking: play.personalRanking,
      completed: play.status === 'completed'
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
