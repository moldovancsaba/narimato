#!/usr/bin/env node

/**
 * MongoDB Index Migration Script
 * 
 * This script fixes the md5 index issue that occurs when migrating from the old 
 * card system to the new UUID-based multi-level card system. It removes obsolete 
 * indexes and ensures the database schema matches the current Card model.
 * 
 * ISSUE: E11000 duplicate key error collection: test.cards index: md5_1 dup key: { md5: null }
 * SOLUTION: Drop old md5 index, remove md5 field from documents, ensure correct indexes
 * 
 * Run with: node scripts/fix-md5-index-migration.js
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'test'; // Extract from URI or configure as needed
const COLLECTION_NAME = 'cards';

/**
 * Logs messages with ISO 8601 timestamp format as required by project rules
 */
function logWithTimestamp(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  if (level === 'error') {
    console.error(logMessage, data || '');
  } else {
    console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
  }
}

/**
 * Main migration function
 */
async function fixMd5IndexMigration() {
  let client;
  
  try {
    logWithTimestamp('info', '🚀 Starting MongoDB index migration for md5 cleanup...');
    
    // Step 1: Connect to MongoDB
    logWithTimestamp('info', 'Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    logWithTimestamp('info', '✅ Successfully connected to MongoDB');
    
    // Step 2: Inspect current indexes
    logWithTimestamp('info', 'Inspecting current indexes on cards collection...');
    const indexes = await collection.indexes();
    
    logWithTimestamp('info', 'Current indexes found:', {
      count: indexes.length,
      indexes: indexes.map(idx => ({
        name: idx.name,
        key: idx.key,
        unique: idx.unique || false
      }))
    });
    
    // Step 3: Check for obsolete indexes and drop if they exist
    const obsoleteIndexes = [
      { field: 'md5', name: 'md5_1' },
      { field: 'slug', name: 'slug_1' }
    ];
    
    for (const obsoleteIndex of obsoleteIndexes) {
      const foundIndex = indexes.find(idx => idx.key && idx.key[obsoleteIndex.field] !== undefined);
      
      if (foundIndex) {
        logWithTimestamp('info', `Found ${obsoleteIndex.field} index: ${foundIndex.name}. Attempting to drop...`);
        
        try {
          await collection.dropIndex(foundIndex.name);
          logWithTimestamp('info', `✅ Successfully dropped ${obsoleteIndex.field} index: ${foundIndex.name}`);
        } catch (dropError) {
          logWithTimestamp('error', `Failed to drop ${obsoleteIndex.field} index: ${foundIndex.name}`, dropError.message);
          // Continue with migration even if drop fails
        }
      } else {
        logWithTimestamp('info', `No ${obsoleteIndex.field} index found - already clean`);
      }
    }
    
    // Step 4: Handle documents with obsolete fields
    const obsoleteFields = ['md5', 'slug'];
    
    for (const field of obsoleteFields) {
      logWithTimestamp('info', `Checking for documents with ${field} field...`);
      
      const documentsWithField = await collection.countDocuments({ [field]: { $exists: true } });
      logWithTimestamp('info', `Found ${documentsWithField} documents with ${field} field`);
      
      if (documentsWithField > 0) {
        logWithTimestamp('info', `Removing ${field} field from all documents...`);
        
        const updateResult = await collection.updateMany(
          { [field]: { $exists: true } },
          { $unset: { [field]: "" } }
        );
        
        logWithTimestamp('info', `✅ Successfully removed ${field} field from documents:`, {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount
        });
      }
    }
    
    // Step 5: Ensure required indexes for current Card schema
    logWithTimestamp('info', 'Ensuring required indexes for current Card schema...');
    
    const requiredIndexes = [
      { key: { uuid: 1 }, options: { unique: true, name: 'uuid_1' } },
      { key: { name: 1 }, options: { unique: true, name: 'name_1' } },
      { key: { isActive: 1 }, options: { name: 'isActive_1' } },
      { key: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
      { key: { isActive: 1, createdAt: -1 }, options: { name: 'isActive_1_createdAt_-1' } }
    ];
    
    for (const indexSpec of requiredIndexes) {
      try {
        // Check if index already exists
        const existingIndex = indexes.find(idx => idx.name === indexSpec.options.name);
        
        if (existingIndex) {
          logWithTimestamp('info', `Index ${indexSpec.options.name} already exists - skipping`);
        } else {
          await collection.createIndex(indexSpec.key, indexSpec.options);
          logWithTimestamp('info', `✅ Created index: ${indexSpec.options.name}`);
        }
      } catch (indexError) {
        logWithTimestamp('error', `Failed to create index ${indexSpec.options.name}`, indexError.message);
      }
    }
    
    // Step 6: Final verification
    logWithTimestamp('info', 'Performing final verification...');
    
    const finalIndexes = await collection.indexes();
    const finalDocumentCount = await collection.countDocuments();
    const documentsWithMd5After = await collection.countDocuments({ md5: { $exists: true } });
    
    logWithTimestamp('info', '📊 Migration completed successfully!', {
      totalDocuments: finalDocumentCount,
      documentsWithMd5: documentsWithMd5After,
      totalIndexes: finalIndexes.length,
      indexNames: finalIndexes.map(idx => idx.name)
    });
    
    if (documentsWithMd5After === 0) {
      logWithTimestamp('info', '✅ All md5 fields successfully removed');
    } else {
      logWithTimestamp('warning', `⚠️ ${documentsWithMd5After} documents still have md5 field`);
    }
    
  } catch (error) {
    logWithTimestamp('error', 'Migration failed with error:', error.message);
    throw error;
  } finally {
    if (client) {
      await client.close();
      logWithTimestamp('info', 'MongoDB connection closed');
    }
  }
}

/**
 * Entry point with proper error handling
 */
async function main() {
  try {
    await fixMd5IndexMigration();
    logWithTimestamp('info', '🎉 Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    logWithTimestamp('error', '❌ Migration script failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logWithTimestamp('warning', '⚠️ Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logWithTimestamp('warning', '⚠️ Migration terminated');
  process.exit(1);
});

// Run the migration if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { fixMd5IndexMigration };
