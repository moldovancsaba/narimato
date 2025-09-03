require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Play = require('./lib/models/Play');
const Card = require('./lib/models/Card');

async function testCompleteHierarchicalFlow() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🧪 COMPLETE HIERARCHICAL FLOW TEST');
    console.log('==================================================');

    // 1. Clean up all existing sessions
    console.log('1. CLEANING UP OLD SESSIONS...');
    const deleteResult = await Play.deleteMany({ organizationId });
    console.log(`   Deleted ${deleteResult.deletedCount} old sessions\n`);

    // 2. Verify card structure
    console.log('2. VERIFYING CARD STRUCTURE...');
    const parentCards = await Card.find({
      organizationId,
      parentTag: 'company',
      isParent: true,
      isActive: true
    }).sort({ name: 1 });

    console.log(`   Found ${parentCards.length} parent cards:`);
    parentCards.forEach(card => {
      console.log(`     - "${card.name}" (${card.uuid})`);
    });

    // Check children for each parent
    for (const parent of parentCards) {
      const children = await Card.find({
        organizationId,
        parentTag: parent.name,
        isParent: false,
        isActive: true
      });
      console.log(`     └─ "${parent.name}" has ${children.length} children: ${children.map(c => c.name).join(', ')}`);
    }

    if (parentCards.length < 2) {
      console.log('❌ Insufficient parent cards for hierarchical test');
      return;
    }

    console.log('\n✅ Card structure looks good for hierarchical testing!');
    
    console.log('\n3. READY FOR HIERARCHICAL DECISION TREE TEST! 🎯');
    console.log('==================================================');
    console.log('Now you can test the complete flow:');
    console.log('');
    console.log('1. 🎮 GO TO: http://localhost:3000/play?org=be34910d-fc7b-475b-8112-67fe778bff2c&deck=company');
    console.log('');
    console.log('2. 📊 PARENT PHASE: You will see 3 cards to rank:');
    parentCards.forEach((card, i) => {
      console.log(`   ${i + 1}. "${card.name}"`);
    });
    console.log('');
    console.log('3. 🌳 HIERARCHICAL FLOW: After ranking parents, you should get:');
    console.log('   - Alert: "Parent ranking complete! Now rank the [first parent] family"');
    console.log('   - Auto-redirect to child session for first family');
    console.log('   - After completing first family → auto-redirect to second family');
    console.log('   - After completing second family → auto-redirect to third family');
    console.log('   - After completing all families → final hierarchical results');
    console.log('');
    console.log('4. 🏆 EXPECTED FINAL RESULT:');
    console.log('   A complete hierarchical ranking where each family is grouped together');
    console.log('   in their parent\'s position, like:');
    console.log('   1. [Top Parent]');
    console.log('   2. [Top Parent Child 1]');
    console.log('   3. [Top Parent Child 2]');
    console.log('   4. [Middle Parent]');
    console.log('   5. [Middle Parent Child 1]');
    console.log('   6. [Middle Parent Child 2]');
    console.log('   7. [Bottom Parent]');
    console.log('   8. [Bottom Parent Child 1]');
    console.log('   9. [Bottom Parent Child 2]');
    console.log('');
    console.log('🚀 START THE TEST NOW! The hierarchical decision tree is ready!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testCompleteHierarchicalFlow();
