#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

// Import CommonJS modules
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { connectDB } = require('./lib/db');
const { isDeck } = require('./lib/utils/cardUtils');

async function testIsDeck() {
  console.log('🧪 TESTING FIXED isDeck() FUNCTION');
  console.log('===================================\n');
  
  try {
    await connectDB();
    const orgId = 'be34910d-fc7b-475b-8112-67fe778bff2c';
    
    const decksToTest = ['0', '1', '2', '3', 'company', 'sales', 'marketing', 'product'];
    
    console.log('Testing deck playability:\n');
    
    for (const deck of decksToTest) {
      const isPlayable = await isDeck(orgId, deck);
      console.log(`📦 Deck "${deck}": ${isPlayable ? '✅ PLAYABLE' : '❌ NOT PLAYABLE'}`);
    }
    
    console.log('\n🎯 EXPECTED RESULTS:');
    console.log('All decks should be PLAYABLE now!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testIsDeck();
