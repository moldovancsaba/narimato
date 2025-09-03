const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { mainPlayId, childPlayId } = req.body;
    
    if (!mainPlayId || !childPlayId) {
      return res.status(400).json({ error: 'mainPlayId and childPlayId required' });
    }

    // Get both play sessions
    const mainPlay = await Play.findOne({ uuid: mainPlayId, status: 'completed' });
    const childPlay = await Play.findOne({ uuid: childPlayId, status: 'completed' });
    
    if (!mainPlay) {
      return res.status(404).json({ error: 'Main play session not found or not completed' });
    }
    
    if (!childPlay) {
      return res.status(404).json({ error: 'Child play session not found or not completed' });
    }

    if (!childPlay.parentCardId) {
      return res.status(400).json({ error: 'Child play session is not linked to a parent card' });
    }

    console.log(`🔗 Merging child ranking for parent ${childPlay.parentCardId}`);
    console.log(`Main ranking before: [${mainPlay.personalRanking.join(', ')}]`);
    console.log(`Child ranking: [${childPlay.personalRanking.join(', ')}]`);

    // SIMPLE: Insert children after their parent in main ranking
    const parentCardId = childPlay.parentCardId;
    const parentPosition = mainPlay.personalRanking.indexOf(parentCardId);
    
    if (parentPosition === -1) {
      return res.status(400).json({ error: 'Parent card not found in main ranking' });
    }

    // Create new ranking with children inserted after parent
    const newRanking = [
      ...mainPlay.personalRanking.slice(0, parentPosition + 1), // Before parent (inclusive)
      ...childPlay.personalRanking, // Insert children
      ...mainPlay.personalRanking.slice(parentPosition + 1) // After parent
    ];

    // Update main play session
    mainPlay.personalRanking = newRanking;
    await mainPlay.save();

    // Mark child play as merged
    childPlay.status = 'merged';
    await childPlay.save();

    console.log(`Main ranking after: [${newRanking.join(', ')}]`);

    res.json({
      success: true,
      newRanking: newRanking,
      insertedAt: parentPosition + 1,
      childrenInserted: childPlay.personalRanking.length,
      message: `Inserted ${childPlay.personalRanking.length} children after parent card at position ${parentPosition}`
    });

  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
