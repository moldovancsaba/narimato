#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const BASE_URL = 'http://localhost:3000';
const ORG_ID = 'be34910d-fc7b-475b-8112-67fe778bff2c';

async function simulateHierarchicalFlow() {
  console.log('🎮 FINAL HIERARCHICAL DECISION TREE TEST');
  console.log('=========================================\n');
  
  try {
    // Step 1: Start company deck session
    console.log('1️⃣ Starting company deck session...');
    const startRes = await fetch(`${BASE_URL}/api/play/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        deckTag: 'company'
      })
    });
    
    if (!startRes.ok) {
      throw new Error(`Failed to start session: ${startRes.statusText}`);
    }
    
    const session = await startRes.json();
    console.log(`✅ Parent session started: ${session.playId}`);
    console.log(`   Cards: ${session.cards.map(c => c.title).join(', ')}\n`);
    
    // Step 2: Complete parent session
    console.log('2️⃣ Completing parent session (swipe all cards right)...');
    
    let currentCardId = session.currentCardId;
    let swipeCount = 0;
    
    while (currentCardId && swipeCount < 10) {
      swipeCount++;
      console.log(`   Swiping card ${swipeCount}`);
      
      const swipeRes = await fetch(`${BASE_URL}/api/play/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playId: session.playId,
          cardId: currentCardId,
          direction: 'right'
        })
      });
      
      const swipeData = await swipeRes.json();
      
      if (swipeData.completed) {
        console.log(`✅ Parent session completed!\n`);
        break;
      } else if (swipeData.requiresVoting) {
        console.log(`   💫 Voting required...`);
        
        // Handle voting
        let voteData = await fetch(`${BASE_URL}/api/play/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playId: session.playId,
            cardA: swipeData.votingContext.newCard,
            cardB: swipeData.votingContext.compareWith,
            winner: swipeData.votingContext.newCard
          })
        });
        
        const voteResult = await voteData.json();
        
        if (voteResult.completed) {
          console.log(`✅ Parent session completed after voting!\n`);
          break;
        } else if (voteResult.returnToSwipe) {
          currentCardId = voteResult.nextCardId;
        } else if (voteResult.requiresMoreVoting) {
          // Continue voting
          continue;
        }
      } else {
        currentCardId = swipeData.nextCardId;
      }
    }
    
    // Step 3: Check hierarchical status
    console.log('3️⃣ Checking hierarchical status...');
    const statusRes = await fetch(`${BASE_URL}/api/play/hierarchical-status?playId=${session.playId}&organizationId=${ORG_ID}`);
    const statusData = await statusRes.json();
    
    console.log(`   Status: ${statusData.status}`);
    console.log(`   Is Hierarchical: ${statusData.isHierarchical}`);
    console.log(`   Action: ${statusData.action}`);
    
    if (statusData.isHierarchical && statusData.action === 'start_child_session') {
      console.log(`✅ HIERARCHICAL FLOW WORKING!`);
      console.log(`   Child session ready: ${statusData.data.childSessionId}`);
      console.log(`   Family: "${statusData.data.parentName}"`);
      console.log(`   Cards: ${statusData.data.cards.map(c => c.title).join(', ')}`);
      console.log(`   Message: ${statusData.data.message}\n`);
      
      // Step 4: Test child session loading
      console.log('4️⃣ Testing child session loading...');
      const childRes = await fetch(`${BASE_URL}/api/play/current?playId=${statusData.data.childSessionId}`);
      
      if (childRes.ok) {
        const childData = await childRes.json();
        console.log(`✅ Child session loaded successfully`);
        console.log(`   Family cards: ${childData.cards.map(c => c.title).join(', ')}\n`);
        
        console.log('🎯 HIERARCHICAL DECISION TREE IS WORKING! 🎉\n');
        console.log('📋 FRONTEND INTEGRATION STEPS:');
        console.log(`1. When parent session completes:`);
        console.log(`   - Call: GET /api/play/hierarchical-status?playId=${session.playId}`);
        console.log(`   - Check: response.isHierarchical && response.action === 'start_child_session'`);
        console.log(`2. Show message: "${statusData.data.message}"`);
        console.log(`3. Redirect to child session:`);
        console.log(`   - URL: /play?org=${ORG_ID}&deck=child&playId=${statusData.data.childSessionId}`);
        console.log(`4. User ranks family cards: ${statusData.data.cards.map(c => c.title).join(', ')}`);
        console.log(`5. Repeat for all families until hierarchical completion`);
        console.log(`6. Show final hierarchical results`);
        
        console.log(`\n🚀 GO TEST THE FRONTEND:`);
        console.log(`1. Visit: http://localhost:3000/play?org=${ORG_ID}&deck=company`);
        console.log(`2. Complete parent ranking`);
        console.log(`3. Your frontend should redirect to child sessions automatically!`);
        
      } else {
        console.log(`❌ Child session loading failed: ${childRes.statusText}`);
      }
      
    } else if (statusData.action === 'initialize_hierarchical') {
      console.log(`⚠️ Hierarchical initialization needed`);
      console.log(`💡 The session completed but child sessions weren't started automatically`);
    } else {
      console.log(`❌ Hierarchical flow not detected`);
      console.log(`   Status data:`, statusData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

simulateHierarchicalFlow();
