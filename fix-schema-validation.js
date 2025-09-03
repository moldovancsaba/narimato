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

const mongoose = require('mongoose');
const { connectDB } = require('./lib/db');
const Play = require('./lib/models/Play');

async function fixSchemaValidation() {
  console.log('🔧 FIXING SCHEMA VALIDATION ISSUE');
  console.log('===================================\n');
  
  try {
    await connectDB();
    
    // Clear mongoose model cache to ensure fresh schema
    console.log('1️⃣ Clearing mongoose model cache...');
    delete mongoose.models.Play;
    delete mongoose.modelSchemas.Play;
    
    // Reload the model
    console.log('2️⃣ Reloading Play model...');
    const FreshPlay = require('./lib/models/Play');
    
    // Test creating a document with waiting_for_children status
    console.log('3️⃣ Testing waiting_for_children status...');
    
    const testPlay = new FreshPlay({
      uuid: 'test-validation-123',
      organizationId: 'test-org',
      deckTag: 'test-deck',
      cardIds: ['card1', 'card2'],
      status: 'waiting_for_children',
      hierarchicalPhase: 'parents',
      swipes: [],
      votes: [],
      personalRanking: []
    });
    
    // Validate the document
    const validationError = testPlay.validateSync();
    
    if (validationError) {
      console.log('❌ Validation failed:', validationError.message);
      console.log('   Errors:', validationError.errors);
    } else {
      console.log('✅ Validation passed - waiting_for_children is valid');
    }
    
    // Test saving to database
    console.log('\n4️⃣ Testing database save...');
    try {
      await testPlay.save();
      console.log('✅ Document saved successfully with waiting_for_children status');
      
      // Clean up test document
      await FreshPlay.deleteOne({ uuid: 'test-validation-123' });
      console.log('✅ Test document cleaned up');
      
    } catch (saveError) {
      console.log('❌ Save failed:', saveError.message);
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    if (!validationError) {
      console.log('✅ Schema validation is working correctly');
      console.log('💡 The issue might be in how the hierarchical manager is calling save()');
      console.log('🔍 Check if the document is being modified incorrectly before save');
    } else {
      console.log('❌ Schema validation is broken');
      console.log('💡 Need to fix the schema enum definition');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixSchemaValidation();
