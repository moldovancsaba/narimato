#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const BASE_URL = 'localhost';
const PORT = 3000;
const ORG_ID = 'be34910d-fc7b-475b-8112-67fe778bff2c';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonData = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: jsonData, body });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, body, error: e.message });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runComprehensiveTest() {
  console.log('🔍 COMPREHENSIVE HIERARCHICAL DECISION TREE TEST');
  console.log('================================================\n');

  try {
    // Clean up any existing sessions first
    console.log('🧹 Cleaning up existing sessions...');
    await makeRequest('DELETE', `/api/play/cleanup?organizationId=${ORG_ID}`); // This may fail, that's OK
    
    // Test 1: Start company deck session
    console.log('1️⃣ Testing company deck start...');
    const startResponse = await makeRequest('POST', '/api/play/start', {
      organizationId: ORG_ID,
      deckTag: 'company'
    });

    if (startResponse.status !== 200) {
      console.log(`❌ Start failed: Status ${startResponse.status}`);
      console.log(`   Body: ${startResponse.body}`);
      return;
    }

    console.log(`✅ Company deck started successfully`);
    console.log(`   Play ID: ${startResponse.data.playId}`);
    console.log(`   Cards: ${startResponse.data.cards.map(c => c.title).join(', ')}`);
    console.log(`   Total cards: ${startResponse.data.totalCards}\n`);

    const playId = startResponse.data.playId;
    let currentCardId = startResponse.data.currentCardId;

    // Test 2: Complete the parent session by swiping all cards right
    console.log('2️⃣ Completing parent session (all right swipes)...');
    
    for (let i = 0; i < 5; i++) { // Safety limit
      if (!currentCardId) break;

      console.log(`   Swiping card ${i + 1}: ${currentCardId}`);
      const swipeResponse = await makeRequest('POST', '/api/play/swipe', {
        playId: playId,
        cardId: currentCardId,
        direction: 'right'
      });

      if (swipeResponse.status !== 200) {
        console.log(`❌ Swipe failed: Status ${swipeResponse.status}`);
        console.log(`   Body: ${swipeResponse.body}`);
        break;
      }

      console.log(`   Swipe response:`, JSON.stringify(swipeResponse.data, null, 2));

      if (swipeResponse.data.completed) {
        console.log(`✅ Parent session completed!\n`);
        break;
      } else if (swipeResponse.data.requiresVoting) {
        console.log(`   💫 Voting required - handling vote sequence...`);
        
        // Handle potentially multiple voting rounds
        let votingContext = swipeResponse.data.votingContext;
        let voteCount = 0;
        
        while (votingContext && voteCount < 10) { // Safety limit
          voteCount++;
          console.log(`     Vote ${voteCount}: ${votingContext.newCard} vs ${votingContext.compareWith}`);
          
          const voteResponse = await makeRequest('POST', '/api/play/vote', {
            playId: playId,
            cardA: votingContext.newCard,
            cardB: votingContext.compareWith,
            winner: votingContext.newCard
          });

          if (voteResponse.status !== 200) {
            console.log(`❌ Vote failed: Status ${voteResponse.status}`);
            break;
          }

          console.log(`     Vote ${voteCount} response:`, JSON.stringify(voteResponse.data, null, 2));

          if (voteResponse.data.completed) {
            console.log(`✅ Parent session completed after ${voteCount} votes!\n`);
            return; // Exit the swipe loop
          } else if (voteResponse.data.requiresMoreVoting) {
            votingContext = voteResponse.data.votingContext;
          } else if (voteResponse.data.returnToSwipe) {
            currentCardId = voteResponse.data.nextCardId;
            break; // Exit voting loop, continue swiping
          } else {
            console.log(`   ⚠️ Unexpected vote response state`);
            break;
          }
        }
        
        if (voteCount >= 10) {
          console.log(`❌ Vote loop exceeded safety limit`);
          break;
        }
      } else {
        currentCardId = swipeResponse.data.nextCardId;
      }
    }

    // Test 3: Check hierarchical status
    console.log('3️⃣ Checking hierarchical status...');
    const statusResponse = await makeRequest('GET', `/api/play/hierarchical-status?playId=${playId}&organizationId=${ORG_ID}`);

    if (statusResponse.status !== 200) {
      console.log(`❌ Status check failed: Status ${statusResponse.status}`);
      console.log(`   Body: ${statusResponse.body}`);
      return;
    }

    console.log(`   Status response:`, JSON.stringify(statusResponse.data, null, 2));

    // Test 4: Analyze the results
    console.log('\n4️⃣ Analysis of hierarchical workflow:');
    
    const status = statusResponse.data;
    
    if (status.isHierarchical && status.action === 'start_child_session') {
      console.log(`✅ HIERARCHICAL WORKFLOW IS WORKING!`);
      console.log(`   Child session ready: ${status.data.childSessionId}`);
      console.log(`   Family: "${status.data.parentName}"`);
      console.log(`   Message: ${status.data.message}`);
      
      // Test child session loading
      console.log('\n5️⃣ Testing child session loading...');
      const childResponse = await makeRequest('GET', `/api/play/current?playId=${status.data.childSessionId}`);
      
      if (childResponse.status === 200) {
        console.log(`✅ Child session loads correctly`);
        console.log(`   Family cards: ${childResponse.data.cards.map(c => c.title).join(', ')}`);
      } else {
        console.log(`❌ Child session loading failed: Status ${childResponse.status}`);
      }
    } else {
      console.log(`❌ HIERARCHICAL WORKFLOW NOT WORKING`);
      console.log(`   Expected: isHierarchical=true, action='start_child_session'`);
      console.log(`   Actual: isHierarchical=${status.isHierarchical}, action='${status.action}'`);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

runComprehensiveTest();
