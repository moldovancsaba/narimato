require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Play = require('./lib/models/Play');

async function testHierarchicalAPI() {
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

    console.log('🧪 TESTING HIERARCHICAL STATUS API');
    console.log('==================================================');
    console.log(`Testing with session: ${recentSession.uuid}\n`);

    // Simulate the API call
    const handler = require('./pages/api/play/hierarchical-status.js').default;
    
    const mockReq = {
      method: 'GET',
      query: {
        playId: recentSession.uuid,
        organizationId
      }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`📤 API Response (${code}):`);
          console.log(JSON.stringify(data, null, 2));
        }
      }),
      json: (data) => {
        console.log('📤 API Response (200):');
        console.log(JSON.stringify(data, null, 2));
        
        // Analyze the response
        console.log('\n🔍 RESPONSE ANALYSIS:');
        if (data.isHierarchical) {
          console.log(`✅ Hierarchical session detected!`);
          console.log(`   Action: ${data.action}`);
          
          if (data.action === 'start_child_session') {
            console.log(`   👨‍👩‍👧‍👦 Child session ready: ${data.data.childSessionId}`);
            console.log(`   📝 Family: "${data.data.parentName}" (${data.data.totalCards} cards)`);
            console.log(`   💬 Message: ${data.data.message}`);
            
            console.log('\n🎯 FRONTEND SHOULD:');
            console.log(`   1. Show message: "${data.data.message}"`);
            console.log(`   2. Redirect to play session: ${data.data.childSessionId}`);
            console.log(`   3. Present cards: ${data.data.cards.map(c => c.title).join(', ')}`);
          }
        } else {
          console.log('❌ Not a hierarchical session');
        }
      }
    };

    await handler(mockReq, mockRes);

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testHierarchicalAPI();
