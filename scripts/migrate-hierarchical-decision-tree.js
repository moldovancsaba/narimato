#!/usr/bin/env node

/**
 * FUNCTIONAL: Migration script for Hierarchical Decision Tree v5.0.0
 * STRATEGIC: Add hierarchical decision control fields to existing cards
 * and establish parent-child relationships based on current hashtag structure
 * 
 * This script safely migrates existing card data to support the new
 * hierarchical decision tree ranking system without data loss.
 */

const mongoose = require('mongoose');
const Card = require('../lib/models/Card');
const { connectDB } = require('../lib/db');

// FUNCTIONAL: Migration statistics tracking
// STRATEGIC: Provide detailed feedback on migration progress and results
const migrationStats = {
  startTime: new Date(),
  totalCards: 0,
  parentCardsIdentified: 0,
  childCardsProcessed: 0,
  hierarchyLevelsSet: 0,
  errorsEncountered: 0,
  organizationsProcessed: new Set()
};

/**
 * FUNCTIONAL: Main migration orchestrator
 * STRATEGIC: Execute migration in safe, reversible stages with validation
 */
async function runHierarchicalMigration() {
  try {
    console.log('🚀 Starting Hierarchical Decision Tree Migration v5.0.0');
    console.log('📅 Migration started at:', migrationStats.startTime.toISOString());
    
    await connectDB();
    console.log('✅ Database connection established');

    // Stage 1: Analyze current data structure
    console.log('\n📊 Stage 1: Analyzing current data structure...');
    await analyzeCurrentStructure();

    // Stage 2: Add hierarchical fields to existing cards
    console.log('\n🔧 Stage 2: Adding hierarchical fields...');
    await addHierarchicalFields();

    // Stage 3: Establish parent-child relationships
    console.log('\n🔗 Stage 3: Establishing parent-child relationships...');
    await establishParentChildRelationships();

    // Stage 4: Calculate hierarchy levels
    console.log('\n📏 Stage 4: Calculating hierarchy levels...');
    await calculateHierarchyLevels();

    // Stage 5: Validate migration results
    console.log('\n✅ Stage 5: Validating migration results...');
    await validateMigrationResults();

    // Final summary
    await printMigrationSummary();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

/**
 * FUNCTIONAL: Analyze existing card structure before migration
 * STRATEGIC: Understand current data patterns to ensure safe migration
 */
async function analyzeCurrentStructure() {
  try {
    // Get total card count
    migrationStats.totalCards = await Card.countDocuments({ isActive: true });
    console.log(`📋 Found ${migrationStats.totalCards} active cards`);

    // Get organization breakdown
    const orgBreakdown = await Card.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$organizationId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('🏢 Organizations found:');
    orgBreakdown.forEach(org => {
      console.log(`   - ${org._id}: ${org.count} cards`);
      migrationStats.organizationsProcessed.add(org._id);
    });

    // Analyze hashtag patterns
    const hashtagAnalysis = await Card.aggregate([
      { $match: { isActive: true, parentTag: { $exists: true, $ne: null } } },
      { $group: { _id: '$parentTag', childCount: { $sum: 1 } } },
      { $sort: { childCount: -1 } }
    ]);

    console.log('🏷️ Current hashtag hierarchy patterns:');
    hashtagAnalysis.slice(0, 10).forEach(pattern => {
      console.log(`   - ${pattern._id}: ${pattern.childCount} children`);
    });

  } catch (error) {
    console.error('❌ Error analyzing structure:', error);
    throw error;
  }
}

/**
 * FUNCTIONAL: Add new hierarchical fields to existing cards
 * STRATEGIC: Safely extend schema without affecting existing functionality
 */
async function addHierarchicalFields() {
  try {
    const bulkOperations = [];
    
    // FUNCTIONAL: Add default hierarchical fields to all cards
    // STRATEGIC: Use conservative defaults that maintain existing behavior
    bulkOperations.push({
      updateMany: {
        filter: { isActive: true },
        update: {
          $set: {
            isParent: false,
            hasChildren: false,
            childrenPlayMode: 'conditional', // Default to conditional behavior
            hierarchyLevel: 0 // Will be calculated later
          }
        }
      }
    });

    console.log('📝 Adding hierarchical fields to all active cards...');
    const result = await Card.bulkWrite(bulkOperations, { ordered: false });
    console.log(`✅ Updated ${result.modifiedCount} cards with hierarchical fields`);

  } catch (error) {
    console.error('❌ Error adding hierarchical fields:', error);
    migrationStats.errorsEncountered++;
    throw error;
  }
}

/**
 * FUNCTIONAL: Establish parent-child relationships based on hashtag structure
 * STRATEGIC: Convert existing hashtag hierarchy into explicit parent-child relationships
 */
async function establishParentChildRelationships() {
  try {
    const organizations = Array.from(migrationStats.organizationsProcessed);
    
    for (const organizationId of organizations) {
      console.log(`🔗 Processing organization: ${organizationId}`);
      
      // FUNCTIONAL: Find all cards that have children (parents)
      // STRATEGIC: Identify parent cards by finding cards referenced in parentTag field
      const parentCards = await Card.aggregate([
        { $match: { organizationId, isActive: true, parentTag: { $exists: true, $ne: null } } },
        { $group: { _id: '$parentTag', childCount: { $sum: 1 } } },
        { $match: { childCount: { $gte: 1 } } }
      ]);

      console.log(`   Found ${parentCards.length} parent categories`);

      for (const parentInfo of parentCards) {
        const parentTag = parentInfo._id;
        const childCount = parentInfo.childCount;

        // FUNCTIONAL: Update parent card to reflect it has children
        // STRATEGIC: Enable hierarchical decision logic for cards with children
        const parentUpdateResult = await Card.updateOne(
          { organizationId, name: parentTag, isActive: true },
          { 
            $set: { 
              isParent: true, 
              hasChildren: true,
              childrenPlayMode: 'conditional' // Enable conditional child inclusion
            } 
          }
        );

        if (parentUpdateResult.modifiedCount > 0) {
          migrationStats.parentCardsIdentified++;
          console.log(`   ✅ ${parentTag}: ${childCount} children (parent updated)`);
        } else {
          // Parent card might not exist as a card entity
          console.log(`   ⚠️  ${parentTag}: ${childCount} children (parent card not found)`);
        }

        // Update child cards count
        migrationStats.childCardsProcessed += childCount;
      }
    }

    console.log(`🎯 Migration summary so far:`);
    console.log(`   - Parent cards identified: ${migrationStats.parentCardsIdentified}`);
    console.log(`   - Child cards processed: ${migrationStats.childCardsProcessed}`);

  } catch (error) {
    console.error('❌ Error establishing relationships:', error);
    migrationStats.errorsEncountered++;
    throw error;
  }
}

/**
 * FUNCTIONAL: Calculate hierarchy levels for all cards
 * STRATEGIC: Enable efficient hierarchical queries by pre-computing levels
 */
async function calculateHierarchyLevels() {
  try {
    const organizations = Array.from(migrationStats.organizationsProcessed);
    let levelsCalculated = 0;

    for (const organizationId of organizations) {
      console.log(`📏 Calculating hierarchy levels for: ${organizationId}`);

      // FUNCTIONAL: Root cards (no parent) are level 0
      // STRATEGIC: Establish hierarchy foundation for multi-level traversal
      const rootUpdateResult = await Card.updateMany(
        { 
          organizationId, 
          isActive: true, 
          $or: [
            { parentTag: { $exists: false } },
            { parentTag: null },
            { parentTag: '' }
          ]
        },
        { $set: { hierarchyLevel: 0 } }
      );

      levelsCalculated += rootUpdateResult.modifiedCount;
      console.log(`   Level 0 (root): ${rootUpdateResult.modifiedCount} cards`);

      // FUNCTIONAL: Child cards (have parent) are level 1
      // STRATEGIC: Support current 2-level hierarchy with room for expansion
      const childUpdateResult = await Card.updateMany(
        { 
          organizationId, 
          isActive: true, 
          parentTag: { $exists: true, $ne: null, $ne: '' }
        },
        { $set: { hierarchyLevel: 1 } }
      );

      levelsCalculated += childUpdateResult.modifiedCount;
      console.log(`   Level 1 (child): ${childUpdateResult.modifiedCount} cards`);
    }

    migrationStats.hierarchyLevelsSet = levelsCalculated;
    console.log(`✅ Hierarchy levels calculated for ${levelsCalculated} cards`);

  } catch (error) {
    console.error('❌ Error calculating hierarchy levels:', error);
    migrationStats.errorsEncountered++;
    throw error;
  }
}

/**
 * FUNCTIONAL: Validate migration results and data integrity
 * STRATEGIC: Ensure migration completed successfully and data is consistent
 */
async function validateMigrationResults() {
  try {
    console.log('🔍 Running validation checks...');

    // Check 1: All active cards have hierarchical fields
    const cardsWithoutFields = await Card.countDocuments({
      isActive: true,
      $or: [
        { isParent: { $exists: false } },
        { hasChildren: { $exists: false } },
        { childrenPlayMode: { $exists: false } },
        { hierarchyLevel: { $exists: false } }
      ]
    });

    if (cardsWithoutFields === 0) {
      console.log('✅ All active cards have hierarchical fields');
    } else {
      console.log(`❌ ${cardsWithoutFields} cards missing hierarchical fields`);
      migrationStats.errorsEncountered++;
    }

    // Check 2: Parent cards are properly marked
    const parentCardsMarked = await Card.countDocuments({
      isActive: true,
      isParent: true,
      hasChildren: true
    });

    console.log(`✅ ${parentCardsMarked} cards marked as parents`);

    // Check 3: Hierarchy level distribution
    const levelDistribution = await Card.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$hierarchyLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('📊 Hierarchy level distribution:');
    levelDistribution.forEach(level => {
      console.log(`   Level ${level._id}: ${level.count} cards`);
    });

    // Check 4: Validate parent-child consistency
    const orphanedChildren = await Card.aggregate([
      { $match: { isActive: true, parentTag: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'cards',
          let: { parentName: '$parentTag', orgId: '$organizationId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$name', '$$parentName'] },
                    { $eq: ['$organizationId', '$$orgId'] },
                    { $eq: ['$isActive', true] }
                  ]
                }
              }
            }
          ],
          as: 'parentCard'
        }
      },
      { $match: { parentCard: { $size: 0 } } },
      { $count: 'orphanedCount' }
    ]);

    const orphanCount = orphanedChildren[0]?.orphanedCount || 0;
    if (orphanCount === 0) {
      console.log('✅ No orphaned child cards found');
    } else {
      console.log(`⚠️  ${orphanCount} orphaned child cards (parents not found as card entities)`);
    }

  } catch (error) {
    console.error('❌ Error during validation:', error);
    migrationStats.errorsEncountered++;
    throw error;
  }
}

/**
 * FUNCTIONAL: Print comprehensive migration summary
 * STRATEGIC: Provide complete audit trail of migration results
 */
async function printMigrationSummary() {
  const endTime = new Date();
  const duration = Math.round((endTime - migrationStats.startTime) / 1000);

  console.log('\n🎉 Hierarchical Decision Tree Migration v5.0.0 Complete!');
  console.log('=' .repeat(60));
  console.log(`📅 Started:  ${migrationStats.startTime.toISOString()}`);
  console.log(`📅 Finished: ${endTime.toISOString()}`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log('');
  console.log('📊 Migration Statistics:');
  console.log(`   Total cards processed:     ${migrationStats.totalCards}`);
  console.log(`   Parent cards identified:   ${migrationStats.parentCardsIdentified}`);
  console.log(`   Child cards processed:     ${migrationStats.childCardsProcessed}`);
  console.log(`   Hierarchy levels set:      ${migrationStats.hierarchyLevelsSet}`);
  console.log(`   Organizations updated:     ${migrationStats.organizationsProcessed.size}`);
  console.log(`   Errors encountered:        ${migrationStats.errorsEncountered}`);
  console.log('');

  if (migrationStats.errorsEncountered === 0) {
    console.log('✅ Migration completed successfully with no errors!');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Update your application to version 5.0.0');
    console.log('   2. Test hierarchical decision tree functionality');
    console.log('   3. Update Play sessions to use hierarchicalData.enabled = true');
    console.log('   4. Deploy frontend components for child session UI');
    console.log('');
    console.log('📚 New Features Available:');
    console.log('   - Conditional child card inclusion based on parent swipes');
    console.log('   - Child ranking mini-sessions with sibling comparisons');
    console.log('   - Hierarchical final rankings with parent-child positioning');
    console.log('   - Enhanced analytics tracking for decision patterns');
  } else {
    console.log('⚠️  Migration completed with errors. Please review the logs above.');
    console.log('   Consider running the migration again or manually addressing issues.');
  }

  console.log('=' .repeat(60));
}

// FUNCTIONAL: Execute migration if run directly
// STRATEGIC: Allow both direct execution and programmatic usage
if (require.main === module) {
  runHierarchicalMigration()
    .then(() => {
      console.log('Migration process finished.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runHierarchicalMigration,
  migrationStats
};
