require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const mongoose = require('mongoose');

async function forceUpdateSession() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const sessionId = '4a1b97dd-60e8-4fd4-aa4d-b7df27cfaa8c';

    console.log('🔧 FORCE UPDATING SESSION WITH RAW MONGODB');
    console.log('==================================================');

    // Use raw MongoDB to update
    const db = mongoose.connection.db;
    const playsCollection = db.collection('plays');

    // First, check the current document
    const currentDoc = await playsCollection.findOne({ uuid: sessionId });
    console.log('Current document structure:');
    console.log(`  _id: ${currentDoc._id}`);
    console.log(`  uuid: ${currentDoc.uuid}`);
    console.log(`  status: ${currentDoc.status}`);
    console.log(`  hierarchicalPhase: ${currentDoc.hierarchicalPhase}`);
    console.log(`  childSessions: ${currentDoc.childSessions ? currentDoc.childSessions.length : 'undefined'}`);

    // Force update with raw MongoDB
    const updateResult = await playsCollection.updateOne(
      { uuid: sessionId },
      { 
        $set: { 
          hierarchicalPhase: 'parents',
          updatedAt: new Date()
        } 
      }
    );

    console.log(`\n✅ Raw update result: ${updateResult.modifiedCount} documents modified`);

    // Verify the update
    const updatedDoc = await playsCollection.findOne({ uuid: sessionId });
    console.log('\nUpdated document:');
    console.log(`  hierarchicalPhase: ${updatedDoc.hierarchicalPhase}`);
    console.log(`  updatedAt: ${updatedDoc.updatedAt}`);

    // Test the API now
    console.log('\n🧪 Testing API after raw update...');
    
    // Make HTTP request to test
    const response = await fetch(`http://localhost:3000/api/play/hierarchical-status?playId=${sessionId}`);
    const data = await response.json();
    
    console.log('\n📤 API Response:');
    console.log(`  Status: ${data.status}`);
    console.log(`  Hierarchical Phase: ${data.hierarchicalPhase}`);
    console.log(`  Is Hierarchical: ${data.isHierarchical}`);
    console.log(`  Action: ${data.action}`);

    if (data.isHierarchical && data.action === 'start_child_session') {
      console.log('\n🎯 SUCCESS! The API now detects the hierarchical session correctly!');
      console.log(`  Child Session ID: ${data.data.childSessionId}`);
      console.log(`  Family: "${data.data.parentName}"`);
      console.log(`  Message: "${data.data.message}"`);
      console.log('\n📱 FRONTEND ACTION NEEDED:');
      console.log(`  Redirect to: /play/${data.data.childSessionId}`);
    } else {
      console.log('\n❌ API still not working correctly');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

forceUpdateSession();
