require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const Play = require('./lib/models/Play');

async function debugFamilyFix() {
  await connectDB();
  
  const organizationId = 'mcszszcs-oooo-0707-1975-moldovan0707';
  const deckTag = 'root';
  
  console.log('\n🔍 DEBUGGING FAMILY FIX');
  console.log('='.repeat(50));
  
  // 0. Show all cards in database
  console.log('\n0. ALL CARDS IN DATABASE:');
  const allCards = await Card.find({}).limit(10);
  console.log(`Found ${allCards.length} total cards:`);
  allCards.forEach(card => {
    console.log(`  - "${card.title}" (name: "${card.name}", parentTag: "${card.parentTag || 'null'}", isParent: ${card.isParent})`);
  });
  
  // 1. Check what the old logic would have returned (children)
  console.log('\n1. OLD LOGIC (children of root):');
  const oldCards = await Card.find({
    organizationId,
    parentTag: deckTag,
    isActive: true
  });
  console.log(`Found ${oldCards.length} children cards:`);
  oldCards.forEach(card => {
    console.log(`  - ${card.title} (isParent: ${card.isParent}, name: "${card.name}", parentTag: "${card.parentTag}")`);
  });
  
  // 2. Check what the new logic returns (parents)
  console.log('\n2. NEW LOGIC (parent cards for root deck):');
  const newCards = await Card.find({
    organizationId,
    $or: [
      { name: deckTag, isParent: true },
      { hashtags: deckTag, isParent: true }
    ],
    isActive: true
  });
  console.log(`Found ${newCards.length} parent cards:`);
  newCards.forEach(card => {
    console.log(`  - ${card.title} (isParent: ${card.isParent}, name: "${card.name}", parentTag: "${card.parentTag || 'null'}")`);
  });
  
  // 3. Show expected family sessions
  console.log('\n3. EXPECTED FAMILY SESSIONS:');
  for (const parent of newCards) {
    const children = await Card.find({
      organizationId,
      parentTag: parent.name,
      isActive: true
    });
    console.log(`  - Parent "${parent.title}" should have ${children.length} children in separate session:`);
    children.forEach(child => {
      console.log(`    └─ ${child.title}`);
    });
  }
  
  // 4. Check current active play sessions
  console.log('\n4. CURRENT ACTIVE SESSIONS:');
  const activeSessions = await Play.find({ organizationId, status: 'active' });
  console.log(`Found ${activeSessions.length} active sessions:`);
  
  for (const session of activeSessions) {
    console.log(`  - Session ${session.uuid.slice(0, 8)}: ${session.cardIds.length} cards, ${session.swipes.length} swipes`);
    
    // Get card details
    for (const cardId of session.cardIds) {
      const card = await Card.findOne({ uuid: cardId });
      if (card) {
        console.log(`    └─ ${card.title} (isParent: ${card.isParent})`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Family fix verification complete');
}

debugFamilyFix().catch(console.error);
