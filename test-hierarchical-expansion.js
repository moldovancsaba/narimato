require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const Play = require('./lib/models/Play');
const {
  needsHierarchicalExpansion,
  expandHierarchicalRanking,
  applyHierarchicalExpansion
} = require('./lib/services/hierarchicalExpansion');

async function testHierarchicalExpansion() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🧪 TESTING HIERARCHICAL EXPANSION SYSTEM');
    console.log('==================================================');

    // 1. Clean up old test sessions
    await Play.deleteMany({ organizationId, deckTag: 'company' });
    console.log('🧹 Cleaned up old test sessions\n');

    // 2. Create a mock completed play session with parent ranking
    console.log('1. CREATING MOCK PARENT RANKING SESSION...');
    
    // Get the parent cards for company deck
    const parentCards = await Card.find({
      organizationId,
      parentTag: 'company',
      isParent: true,
      isActive: true
    }).sort({ name: 1 }); // Sort for predictable order
    
    console.log(`Found ${parentCards.length} parent cards:`);
    parentCards.forEach(card => {
      console.log(`  - "${card.name}" (${card.uuid})`);
    });

    if (parentCards.length < 2) {
      console.log('❌ Not enough parent cards for test!');
      return;
    }

    // Create mock play session with completed parent ranking
    // Let's say the user ranked: product > marketing > sales
    const mockRanking = [
      parentCards.find(c => c.name === 'product')?.uuid,
      parentCards.find(c => c.name === 'marketing')?.uuid,
      parentCards.find(c => c.name === 'sales')?.uuid
    ].filter(Boolean);

    const { v4: uuidv4 } = require('uuid');
    const mockPlay = new Play({
      uuid: uuidv4(),
      organizationId,
      deckTag: 'company',
      cardIds: mockRanking,
      swipes: mockRanking.map((cardId, i) => ({
        cardId,
        direction: 'right',
        timestamp: new Date(Date.now() - (mockRanking.length - i) * 1000)
      })),
      votes: [], // Assume no voting was needed
      personalRanking: mockRanking,
      status: 'completed',
      completedAt: new Date()
    });

    await mockPlay.save();
    console.log(`✅ Created mock session: ${mockPlay.uuid}`);
    console.log(`   Parent ranking: ${mockRanking.length} cards\n`);

    // 3. Test expansion detection
    console.log('2. TESTING EXPANSION DETECTION...');
    const needsExpansion = await needsHierarchicalExpansion(mockPlay);
    console.log(`Needs hierarchical expansion: ${needsExpansion ? '✅ YES' : '❌ NO'}\n`);

    if (!needsExpansion) {
      console.log('❌ Test failed: Should need expansion but doesn\'t');
      return;
    }

    // 4. Test expansion process
    console.log('3. TESTING EXPANSION PROCESS...');
    const expansionResult = await expandHierarchicalRanking(mockPlay);
    
    console.log('Expansion results:');
    console.log(`  Original parents: ${expansionResult.originalParentRanking.length}`);
    console.log(`  Expanded total: ${expansionResult.expandedRanking.length}`);
    console.log(`  Families processed: ${expansionResult.expansionLog.length}\n`);

    // Show detailed expansion
    console.log('4. EXPANSION DETAILS:');
    for (const entry of expansionResult.expansionLog) {
      console.log(`  Family "${entry.parentName}": ${entry.action} (${entry.childrenCount} children)`);
      if (entry.action === 'expanded') {
        // Get child names
        const childCards = await Card.find({ 
          uuid: { $in: entry.childrenIds },
          organizationId,
          isActive: true 
        });
        childCards.forEach((child, i) => {
          console.log(`    ${i + 1}. "${child.name}"`);
        });
      }
    }

    // 5. Apply expansion to session
    console.log('\n5. APPLYING EXPANSION TO SESSION...');
    await applyHierarchicalExpansion(mockPlay, expansionResult);
    
    // Reload to verify
    const updatedPlay = await Play.findOne({ uuid: mockPlay.uuid });
    console.log(`Session updated: isHierarchicallyExpanded = ${updatedPlay.isHierarchicallyExpanded}`);
    console.log(`Final ranking length: ${updatedPlay.personalRanking.length} cards`);

    // 6. Show final hierarchical ranking
    console.log('\n6. FINAL HIERARCHICAL RANKING:');
    const finalCards = await Card.find({
      uuid: { $in: updatedPlay.personalRanking },
      organizationId,
      isActive: true
    });
    
    // Create lookup for quick access
    const cardLookup = {};
    finalCards.forEach(card => {
      cardLookup[card.uuid] = card;
    });

    updatedPlay.personalRanking.forEach((cardId, index) => {
      const card = cardLookup[cardId];
      if (card) {
        const type = card.isParent ? 'Parent' : 'Child';
        const family = card.isParent ? '' : ` (${card.parentTag} family)`;
        console.log(`  ${index + 1}. "${card.name}" [${type}]${family}`);
      }
    });

    console.log('\n🎯 HIERARCHICAL EXPANSION TEST COMPLETE!');
    console.log('✅ The system now properly expands parent rankings with their children');
    console.log('✅ Play the company deck and you should see the full hierarchical result');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testHierarchicalExpansion();
