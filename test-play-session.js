require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const Play = require('./lib/models/Play');

async function testPlaySession() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';
    const deckTag = 'root';

    console.log('🎮 TESTING PLAY SESSION');
    console.log('==================================================');
    console.log(`Organization: ${organizationId}`);
    console.log(`Deck: ${deckTag}\n`);

    // 1. Simulate play start API call
    console.log('1. STARTING PLAY SESSION...');
    
    // Clean up any existing sessions
    await Play.deleteMany({ organizationId, deckTag });
    console.log('🧹 Cleaned up old sessions\n');
    
    // Get parent cards for main session (simulate play/start logic)
    const parentCards = await Card.find({
      organizationId,
      parentTag: deckTag,
      isParent: true,
      isActive: true
    }).sort({ globalScore: -1 });

    console.log(`Found ${parentCards.length} parent cards for main session:`);
    parentCards.forEach(card => {
      console.log(`  - "${card.name}" (${card.uuid})`);
    });

    if (parentCards.length < 2) {
      console.log('❌ Not enough parent cards to start session!');
      return;
    }

    // Create play session
    const { v4: uuidv4 } = require('uuid');
    const shuffledCards = [...parentCards].sort(() => Math.random() - 0.5);
    const cardIds = shuffledCards.map(card => card.uuid);

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
    console.log(`✅ Play session created: ${play.uuid}\n`);

    // 2. Test family lookup for each parent card
    console.log('2. TESTING FAMILY LOOKUPS...');
    for (const parentCard of parentCards) {
      const children = await Card.find({
        organizationId,
        parentTag: parentCard.name, // Children have parentTag = parent's name
        isParent: false,
        isActive: true
      });
      
      console.log(`Family "${parentCard.name}": ${children.length} children`);
      if (children.length > 0) {
        children.forEach(child => {
          console.log(`  - "${child.name}" (${child.uuid})`);
        });
      }
    }

    console.log('\n3. READY FOR HIERARCHICAL RANKING! ✅');
    console.log('Next steps:');
    console.log('- Swipe through parent cards in main session');
    console.log('- When parent swiped right, start family session for its children');
    console.log('- Rank children within family, then merge back to parent position');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testPlaySession();
