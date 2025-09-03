require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Play = require('./lib/models/Play');
const Card = require('./lib/models/Card');

async function debugCurrentSession() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🔍 DEBUGGING CURRENT HIERARCHICAL SESSION STATE');
    console.log('==================================================');

    // 1. Find the most recent company session
    const recentSession = await Play.findOne({
      organizationId,
      deckTag: 'company'
    }).sort({ createdAt: -1 });

    if (!recentSession) {
      console.log('❌ No recent company session found');
      return;
    }

    console.log(`🎮 MOST RECENT SESSION: ${recentSession.uuid}`);
    console.log(`   Status: ${recentSession.status}`);
    console.log(`   Hierarchical Phase: ${recentSession.hierarchicalPhase || 'none'}`);
    console.log(`   Created: ${recentSession.createdAt}`);
    console.log(`   Personal Ranking: ${recentSession.personalRanking.length} cards\n`);

    // Show parent ranking
    if (recentSession.personalRanking.length > 0) {
      console.log('📊 PARENT RANKING:');
      const parentCards = await Card.find({
        uuid: { $in: recentSession.personalRanking },
        organizationId,
        isActive: true
      });
      
      const cardLookup = {};
      parentCards.forEach(card => {
        cardLookup[card.uuid] = card;
      });

      recentSession.personalRanking.forEach((cardId, index) => {
        const card = cardLookup[cardId];
        if (card) {
          console.log(`  ${index + 1}. "${card.name}" (${card.uuid})`);
        }
      });
      console.log('');
    }

    // 2. Check for child sessions
    console.log('👨‍👩‍👧‍👦 CHILD SESSIONS:');
    if (recentSession.childSessions && recentSession.childSessions.length > 0) {
      console.log(`Found ${recentSession.childSessions.length} child sessions:`);
      recentSession.childSessions.forEach((cs, i) => {
        console.log(`  ${i + 1}. "${cs.parentName}" family: ${cs.status} (Session: ${cs.sessionId})`);
        console.log(`     Children: ${cs.childCount}, Started: ${cs.startedAt}`);
      });
      
      // Check if there's an active child session
      const activeChild = recentSession.childSessions.find(cs => cs.status === 'active');
      if (activeChild) {
        console.log(`\n🔥 ACTIVE CHILD SESSION: ${activeChild.sessionId}`);
        
        // Get the actual child session
        const childSession = await Play.findOne({ uuid: activeChild.sessionId });
        if (childSession) {
          console.log(`   Child session status: ${childSession.status}`);
          console.log(`   Child cards: ${childSession.cardIds.length}`);
          console.log(`   Child ranking: ${childSession.personalRanking.length} cards ranked`);
          
          // Show child cards
          const childCards = await Card.find({
            uuid: { $in: childSession.cardIds },
            organizationId,
            isActive: true
          });
          
          console.log(`\n   Child cards to rank:`);
          childCards.forEach(card => {
            console.log(`     - "${card.name}" (${card.uuid})`);
          });
        }
      }
    } else {
      console.log('❌ No child sessions found');
    }

    // 3. Check if hierarchical initialization is needed
    console.log('\n🌳 HIERARCHICAL STATUS:');
    if (recentSession.status === 'completed' && !recentSession.hierarchicalPhase) {
      console.log('⚠️ Parent session completed but hierarchical phase not initialized!');
      console.log('   This suggests the hierarchical initialization failed or wasn\'t triggered.');
    } else if (recentSession.status === 'waiting_for_children') {
      console.log('✅ Parent session is waiting for children - hierarchical flow active');
    } else if (recentSession.status === 'hierarchically_completed') {
      console.log('🏁 Hierarchical session fully completed');
      
      if (recentSession.hierarchicalRanking) {
        console.log(`   Final hierarchical ranking: ${recentSession.hierarchicalRanking.length} items`);
      }
    }

    // 4. Suggest next action
    console.log('\n💡 SUGGESTED NEXT ACTION:');
    if (recentSession.status === 'completed' && !recentSession.hierarchicalPhase) {
      console.log('   The frontend should call the hierarchical initialization API to start child sessions');
    } else if (recentSession.status === 'waiting_for_children') {
      const activeChild = recentSession.childSessions?.find(cs => cs.status === 'active');
      if (activeChild) {
        console.log(`   The frontend should redirect to child session: ${activeChild.sessionId}`);
        console.log(`   This will let the user rank the "${activeChild.parentName}" family`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugCurrentSession();
