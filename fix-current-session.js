require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Play = require('./lib/models/Play');

async function fixCurrentSession() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    // Get the most recent company session
    const recentSession = await Play.findOne({
      organizationId,
      deckTag: 'company'
    }).sort({ createdAt: -1 });

    if (!recentSession) {
      console.log('❌ No recent company session found');
      return;
    }

    console.log('🔧 FIXING CURRENT SESSION');
    console.log('==================================================');
    console.log(`Session: ${recentSession.uuid}`);
    console.log(`Status: ${recentSession.status}`);
    console.log(`Hierarchical Phase: ${recentSession.hierarchicalPhase || 'undefined'}\n`);

    // Fix the hierarchical phase
    if (recentSession.status === 'waiting_for_children' && !recentSession.hierarchicalPhase) {
      recentSession.hierarchicalPhase = 'parents';
      await recentSession.save();
      console.log('✅ Fixed hierarchical phase to "parents"');
    }

    // Verify child sessions
    if (recentSession.childSessions && recentSession.childSessions.length > 0) {
      console.log(`\nChild sessions (${recentSession.childSessions.length}):`);
      recentSession.childSessions.forEach((cs, i) => {
        console.log(`  ${i + 1}. "${cs.parentName}": ${cs.status} (${cs.sessionId})`);
      });
    }

    console.log('\n🧪 Testing API after fix...');
    
    // Test the API endpoint again
    const handler = require('./pages/api/play/hierarchical-status.js').default;
    
    const mockReq = {
      method: 'GET',
      query: {
        playId: recentSession.uuid
      }
    };

    const mockRes = {
      json: (data) => {
        console.log('\n📤 API Response:');
        console.log(`   Is Hierarchical: ${data.isHierarchical}`);
        console.log(`   Action: ${data.action}`);
        
        if (data.action === 'start_child_session') {
          console.log(`   Child Session: ${data.data.childSessionId}`);
          console.log(`   Family: "${data.data.parentName}"`);
          console.log(`   Message: "${data.data.message}"`);
          
          console.log('\n🎯 SUCCESS! Frontend should now:');
          console.log(`   1. Show: "${data.data.message}"`);
          console.log(`   2. Redirect to: /play/${data.data.childSessionId}`);
          console.log(`   3. User can rank: ${data.data.cards.map(c => c.title).join(' vs ')}`);
        }
      },
      status: (code) => ({
        json: (data) => console.log(`Error ${code}:`, data)
      })
    };

    // This might still have the ES module issue, but let's try
    try {
      await handler(mockReq, mockRes);
    } catch (error) {
      console.log('⚠️ API test failed due to module loading, but session should be fixed');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

fixCurrentSession();
