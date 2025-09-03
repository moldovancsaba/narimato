#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from './lib/db.js';
import Play from './lib/models/Play.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

async function checkSessionState() {
  console.log('🔍 CHECKING SESSION STATE');
  console.log('==========================\n');
  
  try {
    await connectDB();
    
    const playId = 'aaf70f63-abfe-44fb-b8bf-dbb709d16ffc';
    const play = await Play.findOne({ uuid: playId });
    
    if (!play) {
      console.log('❌ Session not found');
      return;
    }
    
    console.log('📊 Session Details:');
    console.log(`   Status: ${play.status}`);
    console.log(`   Hierarchical Phase: ${play.hierarchicalPhase || 'undefined'}`);
    console.log(`   Current Child Session: ${play.currentChildSession || 'none'}`);
    console.log(`   Child Sessions Count: ${play.childSessions?.length || 0}`);
    
    if (play.childSessions && play.childSessions.length > 0) {
      console.log('\n👨‍👩‍👧‍👦 Child Sessions:');
      play.childSessions.forEach((child, i) => {
        console.log(`   ${i+1}. Parent: "${child.parentName}" (${child.parentId})`);
        console.log(`      Session: ${child.sessionId}`);
        console.log(`      Status: ${child.status}`);
        console.log(`      Children: ${child.childCount}`);
      });
    }
    
    // Check if child sessions exist in database
    if (play.childSessions && play.childSessions.length > 0) {
      console.log('\n🔍 Checking child sessions in database:');
      for (const child of play.childSessions) {
        const childSession = await Play.findOne({ uuid: child.sessionId });
        if (childSession) {
          console.log(`   ✅ Child session "${child.sessionId}" exists`);
          console.log(`      Cards: ${childSession.cardIds.length}`);
          console.log(`      Status: ${childSession.status}`);
        } else {
          console.log(`   ❌ Child session "${child.sessionId}" NOT found in database`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSessionState();
