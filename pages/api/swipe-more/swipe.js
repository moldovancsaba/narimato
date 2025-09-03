const SwipeMoreEngine = require('../../../lib/services/SwipeMoreEngine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playId, cardId, direction } = req.body;

    if (!playId || !cardId || !direction) {
      return res.status(400).json({ error: 'Missing required parameters: playId, cardId, direction' });
    }

    // Process the swipe
    console.log(`🎯 API: Processing swipe for ${playId}, card ${cardId}, direction ${direction}`);
    const result = await SwipeMoreEngine.processSwipe(playId, cardId, direction);
    
    console.log(`📦 API: SwipeMoreEngine returned result:`);
    console.log(`📦 API: result.completed = ${result.completed}`);
    console.log(`📦 API: result.nextCardId = ${result.nextCardId}`);
    console.log(`📦 API: result.currentCard = ${JSON.stringify(result.currentCard)}`);
    console.log(`📦 API: result.cards.length = ${result.cards?.length}`);
    console.log(`📦 API: result.familyContext = ${JSON.stringify(result.familyContext)}`);
    
    console.log(`🚀 API: About to send response...`);
    const response = res.status(200).json(result);
    console.log(`✅ API: Response sent successfully`);
    return response;
  } catch (error) {
    console.error('SwipeMore swipe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
