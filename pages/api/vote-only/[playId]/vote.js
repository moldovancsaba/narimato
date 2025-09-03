const { connectDB } = require('../../../../lib/db');
const VoteOnlyEngine = require('../../../../lib/services/VoteOnlyEngine');

// FUNCTIONAL: Process vote results for VoteOnly session comparisons
// STRATEGIC: Pure tournament-based voting - no swiping triggers or complex state transitions
const engine = new VoteOnlyEngine();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { playId } = req.query;
    const { cardA, cardB, winner } = req.body;
    
    // FUNCTIONAL: Validate input parameters
    // STRATEGIC: Early validation prevents processing invalid vote requests
    if (!playId || !cardA || !cardB || !winner) {
      return res.status(400).json({ error: 'playId, cardA, cardB, and winner required' });
    }

    if (![cardA, cardB].includes(winner)) {
      return res.status(400).json({ error: 'winner must be either cardA or cardB' });
    }

    console.log(`🗳️ Processing VoteOnly: ${winner} wins between ${cardA} and ${cardB}`);

    // FUNCTIONAL: Process vote through VoteOnly engine
    // STRATEGIC: Tournament-style comparison processing without any swiping complexity
    const result = await engine.processVote(playId, cardA, cardB, winner);

    // FUNCTIONAL: Build clean API response for vote-only workflow
    // STRATEGIC: Simple response structure focused on comparison progression
    const response = {
      success: result.success,
      completed: result.completed,
      nextComparison: result.nextComparison,
      progress: result.progress
    };

    res.json(response);

  } catch (error) {
    console.error('VoteOnly vote error:', error);
    
    // FUNCTIONAL: Return appropriate error status based on error type
    // STRATEGIC: Provide meaningful error responses for debugging and user feedback
    if (error.message.includes('not found') || error.message.includes('not active')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Winner must be')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error processing vote' });
  }
}
