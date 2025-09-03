#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from './lib/db.js';
import Play from './lib/models/Play.js';
import Card from './lib/models/Card.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const ORG_ID = 'be34910d-fc7b-475b-8112-67fe778bff2c';

async function debugHierarchicalFlow() {
  console.log('🔍 DEBUGGING HIERARCHICAL FLOW');
  console.log('===============================\n');
  
  try {
    await connectDB();
    
    // Step 1: Clean up old sessions
    console.log('1️⃣ Cleaning up old sessions...');
    await Play.deleteMany({ organizationId: ORG_ID });
    console.log('   ✅ Cleaned up old sessions\n');
    
    // Step 2: Check company deck structure
    console.log('2️⃣ Checking company deck structure...');
    const parentCards = await Card.find({
      organizationId: ORG_ID,
      parentTag: 'company',
      isParent: true,
      isActive: true
    });
    
    console.log(`   Found ${parentCards.length} parent cards:`);
    for (const card of parentCards) {
      console.log(`   - "${card.title}" (${card.uuid})`);
      
      // Check children of this parent
      const children = await Card.find({
        organizationId: ORG_ID,
        parentTag: card.title,
        isActive: true
      });
      console.log(`     └─ ${children.length} children: ${children.map(c => c.title).join(', ')}`);
    }
    
    console.log('');
    
    // Step 3: Start a new company session
    console.log('3️⃣ Starting a new company session...');
    const startResponse = await fetch('http://localhost:3000/api/play/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        deckTag: 'company'
      })
    });
    
    if (!startResponse.ok) {
      throw new Error(`Start failed: ${startResponse.statusText}`);
    }
    
    const startData = await startResponse.json();
    console.log(`   ✅ Session created: ${startData.playId}`);
    console.log(`   Cards: ${startData.cards.map(c => c.title).join(', ')}\n`);
    
    // Step 4: Check the session in database
    console.log('4️⃣ Checking session in database...');
    const session = await Play.findOne({ uuid: startData.playId });
    console.log(`   Status: ${session.status}`);
    console.log(`   Hierarchical Phase: ${session.hierarchicalPhase || 'undefined'}`);
    console.log(`   Child Sessions: ${session.childSessions?.length || 0}`);
    console.log('');
    
    // Step 5: Simulate completing the parent session
    console.log('5️⃣ Simulating parent session completion...');
    let currentCardId = startData.currentCardId;
    let swipeCount = 0;
    
    while (currentCardId && swipeCount < 10) {
      swipeCount++;
      console.log(`   Swiping card ${swipeCount}: ${currentCardId}`);
      
      const swipeResponse = await fetch('http://localhost:3000/api/play/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playId: startData.playId,
          cardId: currentCardId,
          direction: 'right'
        })
      });
      
      if (!swipeResponse.ok) {
        throw new Error(`Swipe failed: ${swipeResponse.statusText}`);
      }
      
      const swipeData = await swipeResponse.json();
      console.log(`   Response:`, JSON.stringify(swipeData, null, 2));
      
      if (swipeData.completed) {
        console.log(`   ✅ Session completed after ${swipeCount} swipes\n`);
        break;
      } else if (swipeData.requiresVoting) {
        console.log('   💫 Voting required - handling votes...');
        
        // Handle voting rounds
        let votingContext = swipeData.votingContext;
        let voteCount = 0;
        
        while (votingContext && voteCount < 5) {
          voteCount++;
          console.log(`     Vote ${voteCount}: ${votingContext.newCard} vs ${votingContext.compareWith}`);
          
          const voteResponse = await fetch('http://localhost:3000/api/play/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playId: startData.playId,
              cardA: votingContext.newCard,
              cardB: votingContext.compareWith,
              winner: votingContext.newCard
            })
          });
          
          if (!voteResponse.ok) {
            throw new Error(`Vote failed: ${voteResponse.statusText}`);
          }
          
          const voteData = await voteResponse.json();
          console.log(`     Vote response:`, JSON.stringify(voteData, null, 2));
          
          if (voteData.completed) {
            console.log(`     ✅ Session completed after voting\n`);
            break;
          } else if (voteData.requiresMoreVoting) {
            votingContext = voteData.votingContext;
          } else if (voteData.returnToSwipe) {
            currentCardId = voteData.nextCardId;
            break;
          }
        }
        
        if (swipeData.completed || voteCount >= 5) {
          break;
        }
      } else if (swipeData.nextCardId) {
        currentCardId = swipeData.nextCardId;
      }
    }
    
    // Step 6: Check hierarchical status after completion
    console.log('6️⃣ Checking hierarchical status after completion...');
    const statusResponse = await fetch(`http://localhost:3000/api/play/hierarchical-status?playId=${startData.playId}&organizationId=${ORG_ID}`);
    
    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.statusText}`);
    }
    
    const statusData = await statusResponse.json();
    console.log('   Status response:', JSON.stringify(statusData, null, 2));
    
    // Step 7: Check session state in database again
    console.log('\n7️⃣ Final session state in database...');
    const finalSession = await Play.findOne({ uuid: startData.playId });
    console.log(`   Status: ${finalSession.status}`);
    console.log(`   Hierarchical Phase: ${finalSession.hierarchicalPhase || 'undefined'}`);
    console.log(`   Child Sessions: ${finalSession.childSessions?.length || 0}`);
    
    if (finalSession.childSessions?.length > 0) {
      console.log('   Child sessions:');
      finalSession.childSessions.forEach((child, i) => {
        console.log(`     ${i+1}. ${child.parentName} (${child.sessionId}) - Status: ${child.status}`);
      });
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    if (statusData.isHierarchical && statusData.action === 'start_child_session') {
      console.log('✅ Hierarchical flow is working correctly!');
    } else if (finalSession.status === 'completed' && !finalSession.hierarchicalPhase) {
      console.log('❌ Session completed but hierarchical initialization never happened');
      console.log('💡 The hierarchical session manager is not being triggered');
    } else {
      console.log('❌ Hierarchical flow failed at some step');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugHierarchicalFlow();
