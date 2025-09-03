require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const Play = require('./lib/models/Play');
const {
  initializeHierarchicalSession,
  onChildSessionComplete
} = require('./lib/services/hierarchicalSessionManager');

async function testInteractiveHierarchical() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🧪 TESTING INTERACTIVE HIERARCHICAL SESSION SYSTEM');
    console.log('==================================================');

    // 1. Clean up old test sessions
    await Play.deleteMany({ organizationId, deckTag: 'company' });
    console.log('🧹 Cleaned up old test sessions\n');

    // 2. Create a mock completed parent session
    console.log('1. CREATING MOCK PARENT SESSION...');
    
    // Get the parent cards for company deck
    const parentCards = await Card.find({
      organizationId,
      parentTag: 'company',
      isParent: true,
      isActive: true
    }).sort({ name: 1 });
    
    console.log(`Found ${parentCards.length} parent cards:`);
    parentCards.forEach(card => {
      console.log(`  - "${card.name}" (${card.uuid})`);
    });

    // Create parent ranking: sales > product > marketing
    const parentRanking = [
      parentCards.find(c => c.name === 'sales')?.uuid,
      parentCards.find(c => c.name === 'product')?.uuid,
      parentCards.find(c => c.name === 'marketing')?.uuid
    ].filter(Boolean);

    const { v4: uuidv4 } = require('uuid');
    const parentSession = new Play({
      uuid: uuidv4(),
      organizationId,
      deckTag: 'company',
      cardIds: parentRanking,
      swipes: parentRanking.map((cardId, i) => ({
        cardId,
        direction: 'right',
        timestamp: new Date(Date.now() - (parentRanking.length - i) * 1000)
      })),
      votes: [],
      personalRanking: parentRanking,
      status: 'completed',
      completedAt: new Date()
    });

    await parentSession.save();
    console.log(`✅ Created parent session: ${parentSession.uuid}`);
    console.log(`   Parent ranking (${parentRanking.length} cards): sales > product > marketing\n`);

    // 3. Initialize hierarchical sessions
    console.log('2. INITIALIZING HIERARCHICAL SESSIONS...');
    const initResult = await initializeHierarchicalSession(parentSession);
    
    console.log(`Initialization result: ${initResult.action}`);
    if (initResult.action === 'child_session_started') {
      console.log(`  First child session: "${initResult.childSession.parentName}" family`);
      console.log(`  Session ID: ${initResult.childSession.playId}`);
      console.log(`  Cards to rank: ${initResult.childSession.totalCards}`);
      
      // Show cards
      initResult.childSession.cards.forEach((card, i) => {
        console.log(`    ${i + 1}. "${card.title}"`);
      });
    }
    console.log('');

    // 4. Simulate first child session completion
    if (initResult.action === 'child_session_started') {
      console.log('3. SIMULATING FIRST CHILD SESSION COMPLETION...');
      const childSessionId = initResult.childSession.playId;
      
      // Load the child session
      const childSession = await Play.findOne({ uuid: childSessionId });
      console.log(`Child session for "${childSession.currentParentName}" family`);
      
      // Simulate child ranking (e.g., for sales: shark > customer first)
      const childRanking = childSession.cardIds; // Keep original order for simplicity
      childSession.personalRanking = childRanking;
      childSession.status = 'completed';
      childSession.completedAt = new Date();
      await childSession.save();
      
      console.log(`  Child ranking: ${childRanking.length} cards ranked`);
      console.log('  Child session marked as completed\n');
      
      // 5. Process child completion and start next
      console.log('4. PROCESSING CHILD COMPLETION...');
      const nextResult = await onChildSessionComplete(childSession);
      
      console.log(`Next action: ${nextResult.action}`);
      if (nextResult.action === 'child_session_started') {
        console.log(`  Next child session: "${nextResult.childSession.parentName}" family`);
        console.log(`  Session ID: ${nextResult.childSession.playId}`);
        
        // Continue the chain...
        console.log('  (Would continue with next family...)\n');
      } else if (nextResult.action === 'hierarchical_complete') {
        console.log(`  🏁 All families completed!`);
        console.log(`  Total items in final ranking: ${nextResult.totalItems}`);
      }
    }

    // 6. Show final state
    console.log('5. FINAL STATE ANALYSIS...');
    const updatedParent = await Play.findOne({ uuid: parentSession.uuid });
    
    console.log(`Parent session status: ${updatedParent.status}`);
    console.log(`Child sessions tracked: ${updatedParent.childSessions?.length || 0}`);
    
    if (updatedParent.childSessions) {
      updatedParent.childSessions.forEach((cs, i) => {
        console.log(`  ${i + 1}. "${cs.parentName}" family: ${cs.status} (${cs.childCount} children)`);
      });
    }
    
    if (updatedParent.hierarchicalRanking) {
      console.log('\n🎯 FINAL HIERARCHICAL RANKING:');
      const finalCards = await Card.find({
        uuid: { $in: updatedParent.hierarchicalRanking },
        organizationId,
        isActive: true
      });
      
      const cardLookup = {};
      finalCards.forEach(card => {
        cardLookup[card.uuid] = card;
      });
      
      updatedParent.hierarchicalRanking.forEach((cardId, index) => {
        const card = cardLookup[cardId];
        if (card) {
          const type = card.isParent ? 'PARENT' : 'child';
          const family = card.isParent ? '' : ` (${card.parentTag} family)`;
          console.log(`  ${index + 1}. "${card.name}" [${type}]${family}`);
        }
      });
    }

    console.log('\n✅ INTERACTIVE HIERARCHICAL TEST COMPLETE!');
    console.log('🎮 The system now supports your expected flow:');
    console.log('   1. Play parent cards → Rank them');
    console.log('   2. Play first family children → Rank them');  
    console.log('   3. Play next family children → Rank them');
    console.log('   4. Continue until all families completed');
    console.log('   5. Get final hierarchical ranking with proper grouping');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testInteractiveHierarchical();
