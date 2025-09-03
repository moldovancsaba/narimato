require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const { isDeck } = require('./lib/utils/cardUtils');

async function debugDeckHierarchy() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';
    const deckTag = 'root';

    console.log('🔍 DEBUGGING DECK HIERARCHY');
    console.log('==================================================');
    console.log(`Organization: ${organizationId}`);
    console.log(`Deck: ${deckTag}\n`);

    // 1. Check if it's a valid deck
    const isValidDeck = await isDeck(organizationId, deckTag);
    console.log(`1. IS VALID DECK: ${isValidDeck}\n`);

    // 2. Show what isDeck() looks for
    console.log('2. WHAT isDeck() LOOKS FOR:');
    const parentCards = await Card.find({
      organizationId,
      parentTag: deckTag,
      isParent: true,
      isActive: true
    });
    console.log(`Found ${parentCards.length} parent cards matching deck "${deckTag}":`);
    parentCards.forEach(card => {
      console.log(`  - "${card.uuid}" (name: "${card.name}", hashtags: ${JSON.stringify(card.hashtags)}, isParent: ${card.isParent})`);
    });

    // 3. Show all cards and their hierarchy
    console.log('\n3. ALL CARDS HIERARCHY:');
    const allCards = await Card.find({ organizationId, isActive: true });
    console.log(`Found ${allCards.length} total cards:`);
    
    // Group by parentTag
    const byParentTag = {};
    allCards.forEach(card => {
      const parent = card.parentTag || 'NO_PARENT';
      if (!byParentTag[parent]) byParentTag[parent] = [];
      byParentTag[parent].push(card);
    });

    Object.keys(byParentTag).forEach(parentTag => {
      console.log(`\n  Parent Tag: "${parentTag}"`);
      byParentTag[parentTag].forEach(card => {
        console.log(`    - "${card.uuid}" (name: "${card.name}", isParent: ${card.isParent})`);
      });
    });

    // 4. Show what play/start.js would get
    console.log('\n4. WHAT PLAY/START WOULD GET:');
    const playStartCards = await Card.find({
      organizationId,
      parentTag: deckTag,
      isParent: true,
      isActive: true
    }).sort({ globalScore: -1 });

    console.log(`Play/start would get ${playStartCards.length} cards for deck "${deckTag}":`);
    playStartCards.forEach(card => {
      console.log(`  - "${card.uuid}" (name: "${card.name}", isParent: ${card.isParent})`);
    });

    // 5. Suggest fix
    console.log('\n5. SUGGESTED FIX:');
    if (playStartCards.length < 2) {
      console.log('❌ Not enough parent cards for deck!');
      console.log('Options:');
      console.log(`  A) Create more parent cards with name="${deckTag}" or hashtags=["${deckTag}"]`);
      console.log(`  B) Change deck structure to use existing parent cards`);
      console.log(`  C) Update some existing cards to be parents for this deck`);
      
      // Show potential parent cards
      const potentialParents = allCards.filter(card => 
        !card.isParent && 
        (card.name.includes(deckTag) || card.parentTag === deckTag)
      );
      
      if (potentialParents.length > 0) {
        console.log('\n  Potential cards to make parents:');
        potentialParents.slice(0, 5).forEach(card => {
          console.log(`    - "${card.uuid}" (name: "${card.name}", parentTag: "${card.parentTag}")`);
        });
      }
    } else {
      console.log('✅ Sufficient parent cards found!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugDeckHierarchy();
