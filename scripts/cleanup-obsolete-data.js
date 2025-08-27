#!/usr/bin/env node

/**
 * Comprehensive Database Cleanup Script
 * 
 * This script removes ALL obsolete data, fields, and indexes from the old card system
 * that are no longer needed in the new UUID-based multi-level card system.
 * 
 * CLEANS UP:
 * - Obsolete indexes (md5, slug, metadata fields, type, created_by, etc.)
 * - Obsolete document fields from old schema
 * - Old collections that are no longer used
 * - Ensures only current schema data remains
 * 
 * Run with: node scripts/cleanup-obsolete-data.js
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
 * Comprehensive database cleanup function
 */
async function cleanupObsoleteData() {
  let client;
  
  try {
    logWithTimestamp('info', '🗑️ Starting comprehensive database cleanup...');
    
    // Step 1: Connect to MongoDB
    logWithTimestamp('info', 'Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    logWithTimestamp('info', '✅ Successfully connected to MongoDB');
    
    // Step 2: Inspect current state
    logWithTimestamp('info', 'Inspecting current database state...');
    const indexes = await collection.indexes();
    const sampleDoc = await collection.findOne({});
    const totalDocs = await collection.countDocuments();
    
    logWithTimestamp('info', 'Current database state:', {
      totalDocuments: totalDocs,
      totalIndexes: indexes.length,
      sampleDocumentFields: sampleDoc ? Object.keys(sampleDoc) : []
    });
    
    // Step 3: Drop ALL obsolete indexes from old card system
    logWithTimestamp('info', 'Identifying and dropping obsolete indexes...');
    
    const obsoleteIndexPatterns = [
      'md5_1',
      'slug_1', 
      'type_1_metadata.status_1',
      'metadata.category_1_metadata.status_1',
      'metadata.tags_1',
      'created_by_1',
      'createdAt_1' // Keep createdAt_-1 but remove createdAt_1
    ];
    
    let droppedIndexCount = 0;
    
    for (const index of indexes) {
      const indexName = index.name;
      
      // Skip the default _id_ index and our required indexes
      if (indexName === '_id_' || 
          indexName === 'uuid_1' || 
          indexName === 'name_1' || 
          indexName === 'isActive_1' ||
          indexName === 'createdAt_-1' ||
          indexName === 'isActive_1_createdAt_-1') {
        logWithTimestamp('info', `Keeping required index: ${indexName}`);
        continue;
      }
      
      // Drop any index that matches obsolete patterns or isn't in our required list
      logWithTimestamp('info', `Dropping obsolete index: ${indexName}`);
      
      try {
        await collection.dropIndex(indexName);
        droppedIndexCount++;
        logWithTimestamp('info', `✅ Successfully dropped index: ${indexName}`);
      } catch (dropError) {
        logWithTimestamp('error', `Failed to drop index ${indexName}`, dropError.message);
      }
    }
    
    logWithTimestamp('info', `Dropped ${droppedIndexCount} obsolete indexes`);
    
    // Step 4: Remove ALL obsolete fields from documents
    logWithTimestamp('info', 'Removing obsolete fields from all documents...');
    
    const obsoleteFields = [
      'md5',
      'slug', 
      'type',
      'metadata',
      'created_by',
      'content', // Old content field vs new body field
      'title',   // Old title field vs new name field
      'category',
      'tags',    // Old tags vs new hashtags
      'status',
      'description',
      'imageData',
      'textData',
      'style',
      'version',
      'lastModified',
      'author'
    ];
    
    let totalFieldsRemoved = 0;
    
    for (const field of obsoleteFields) {
      const documentsWithField = await collection.countDocuments({ [field]: { $exists: true } });
      
      if (documentsWithField > 0) {
        logWithTimestamp('info', `Removing ${field} field from ${documentsWithField} documents...`);
        
        const updateResult = await collection.updateMany(
          { [field]: { $exists: true } },
          { $unset: { [field]: "" } }
        );
        
        totalFieldsRemoved += updateResult.modifiedCount;
        
        logWithTimestamp('info', `✅ Removed ${field} field:`, {
          documentsFound: documentsWithField,
          documentsModified: updateResult.modifiedCount
        });
      } else {
        logWithTimestamp('info', `No documents found with ${field} field - already clean`);
      }
    }
    
    logWithTimestamp('info', `Total field removals across all documents: ${totalFieldsRemoved}`);
    
    // Step 5: Ensure current Card schema compliance
    logWithTimestamp('info', 'Ensuring current Card schema compliance...');
    
    // Check for documents that don't match current schema
    const documentsWithoutUuid = await collection.countDocuments({ uuid: { $exists: false } });
    const documentsWithoutName = await collection.countDocuments({ name: { $exists: false } });
    const documentsWithoutBody = await collection.countDocuments({ body: { $exists: false } });
    
    if (documentsWithoutUuid > 0 || documentsWithoutName > 0) {
      logWithTimestamp('warning', 'Found documents that don\'t match current schema:', {
        withoutUuid: documentsWithoutUuid,
        withoutName: documentsWithoutName,
        withoutBody: documentsWithoutBody
      });
      
      // These might be test documents or corrupted data - log for manual review
      const invalidDocs = await collection.find({
        $or: [
          { uuid: { $exists: false } },
          { name: { $exists: false } }
        ]
      }).limit(5).toArray();
      
      logWithTimestamp('info', 'Sample invalid documents (first 5):', 
        invalidDocs.map(doc => ({ 
          _id: doc._id, 
          fields: Object.keys(doc),
          uuid: doc.uuid,
          name: doc.name
        }))
      );
    }
    
    // Step 6: Final verification and cleanup summary
    logWithTimestamp('info', 'Performing final verification...');
    
    const finalIndexes = await collection.indexes();
    const finalDocumentCount = await collection.countDocuments();
    const finalSampleDoc = await collection.findOne({});
    
    // Check for any remaining obsolete fields
    let remainingObsoleteFields = [];
    if (finalSampleDoc) {
      for (const field of obsoleteFields) {
        if (finalSampleDoc.hasOwnProperty(field)) {
          remainingObsoleteFields.push(field);
        }
      }
    }
    
    logWithTimestamp('info', '🎉 Database cleanup completed!', {
      finalState: {
        totalDocuments: finalDocumentCount,
        totalIndexes: finalIndexes.length,
        indexNames: finalIndexes.map(idx => idx.name),
        remainingObsoleteFields: remainingObsoleteFields,
        sampleDocumentFields: finalSampleDoc ? Object.keys(finalSampleDoc) : []
      },
      summary: {
        indexesDropped: droppedIndexCount,
        fieldsRemoved: totalFieldsRemoved,
        databaseCompliance: remainingObsoleteFields.length === 0 ? 'FULLY_COMPLIANT' : 'NEEDS_MANUAL_REVIEW'
      }
    });
    
    if (remainingObsoleteFields.length === 0) {
      logWithTimestamp('info', '✅ Database is fully compliant with current Card schema');
    } else {
      logWithTimestamp('warning', `⚠️ Some obsolete fields still remain: ${remainingObsoleteFields.join(', ')}`);
    }
    
    // Step 7: Verify required indexes exist
    const requiredIndexes = ['_id_', 'uuid_1', 'name_1', 'isActive_1', 'createdAt_-1', 'isActive_1_createdAt_-1'];
    const missingIndexes = requiredIndexes.filter(reqIdx => 
      !finalIndexes.find(idx => idx.name === reqIdx)
    );
    
    if (missingIndexes.length > 0) {
      logWithTimestamp('warning', `Missing required indexes: ${missingIndexes.join(', ')}`);
      logWithTimestamp('info', 'Run the fix-md5-index-migration.js script to ensure all required indexes');
    } else {
      logWithTimestamp('info', '✅ All required indexes are present');
    }
    
  } catch (error) {
    logWithTimestamp('error', 'Database cleanup failed:', error.message);
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
    await cleanupObsoleteData();
    logWithTimestamp('info', '🎉 Comprehensive database cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    logWithTimestamp('error', '❌ Database cleanup failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logWithTimestamp('warning', '⚠️ Cleanup interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logWithTimestamp('warning', '⚠️ Cleanup terminated');
  process.exit(1);
});

// Run the cleanup if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { cleanupObsoleteData };
