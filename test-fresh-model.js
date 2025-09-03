require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testFreshModel() {
  try {
    const { connectDB } = require('./lib/db');
    
    // Clear all cached models
    if (mongoose.models.Play) {
      delete mongoose.models.Play;
    }
    if (mongoose.modelSchemas && mongoose.modelSchemas.Play) {
      delete mongoose.modelSchemas.Play;
    }
    await connectDB();
    console.log('✅ MongoDB connected\n');

    // Load fresh model
    const Play = require('./lib/models/Play');

    const sessionId = '4a1b97dd-60e8-4fd4-aa4d-b7df27cfaa8c';

    console.log('🔧 TESTING FRESH MODEL LOADING');
    console.log('==================================================');

    // Get the session with fresh model
    const session = await Play.findOne({ uuid: sessionId });
    
    console.log('Session data from fresh model:');
    console.log(`  UUID: ${session.uuid}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Hierarchical Phase: ${session.hierarchicalPhase}`);
    console.log(`  Child Sessions: ${session.childSessions ? session.childSessions.length : 'undefined'}`);

    // Try to explicitly access the field
    console.log('\nDirect field access:');
    console.log(`  session.hierarchicalPhase = ${session.hierarchicalPhase}`);
    console.log(`  session.get('hierarchicalPhase') = ${session.get('hierarchicalPhase')}`);
    console.log(`  session.toObject().hierarchicalPhase = ${session.toObject().hierarchicalPhase}`);

    // Check the raw document
    console.log('\nRaw document check:');
    const rawDoc = await mongoose.connection.db.collection('plays').findOne({ uuid: sessionId });
    console.log(`  rawDoc.hierarchicalPhase = ${rawDoc.hierarchicalPhase}`);

    // Test the actual condition
    console.log('\nCondition test:');
    console.log(`  status === 'waiting_for_children': ${session.status === 'waiting_for_children'}`);
    console.log(`  hierarchicalPhase === 'parents': ${session.hierarchicalPhase === 'parents'}`);
    console.log(`  Both conditions: ${session.status === 'waiting_for_children' && session.hierarchicalPhase === 'parents'}`);

    // Try updating and re-reading
    console.log('\nTesting update and re-read:');
    await Play.updateOne(
      { uuid: sessionId },
      { $set: { hierarchicalPhase: 'parents' } }
    );

    const updatedSession = await Play.findOne({ uuid: sessionId });
    console.log(`  After update: ${updatedSession.hierarchicalPhase}`);

    // Make sure child sessions exist
    if (session.childSessions && session.childSessions.length > 0) {
      const activeChild = session.childSessions.find(cs => cs.status === 'active');
      console.log('\nChild session check:');
      console.log(`  Active child found: ${activeChild ? 'YES' : 'NO'}`);
      if (activeChild) {
        console.log(`  Active child session ID: ${activeChild.sessionId}`);
        console.log(`  Active child parent: ${activeChild.parentName}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testFreshModel();
