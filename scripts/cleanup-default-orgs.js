#!/usr/bin/env node

/**
 * NARIMATO - Default Organizations Cleanup Script
 * 
 * PROBLEM: Production has /default-org routes from old multi-tenant architecture
 * SOLUTION: This script removes all default/dummy organizations from MongoDB Atlas
 * 
 * FUNCTIONAL: Connects to MongoDB Atlas and removes organizations with default slugs
 * STRATEGIC: Ensures single database architecture with user-created organizations only
 * 
 * Usage: node scripts/cleanup-default-orgs.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Organization schema - single database architecture
const organizationSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

async function cleanupDefaultOrganizations() {
  console.log('🧹 NARIMATO - Default Organizations Cleanup');
  console.log('==========================================');
  console.log('');
  
  try {
    // Connect to single MongoDB Atlas database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('❌ MONGODB_URI environment variable is not set');
    }
    
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Organization = mongoose.model('Organization', organizationSchema);
    
    // Find all existing organizations first for audit
    const allOrganizations = await Organization.find({});
    console.log(`\n📊 Found ${allOrganizations.length} total organizations in database`);
    
    if (allOrganizations.length > 0) {
      console.log('\n📋 Current organizations:');
      allOrganizations.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name} (${org.slug}) - UUID: ${org.uuid}`);
      });
    }
    
    // Define patterns for default/dummy organizations to remove
    const defaultPatterns = [
      'default-org',
      'default_org', 
      'defaultorg',
      'test-org',
      'test_org',
      'testorg',
      'sample-org',
      'sample_org',
      'sampleorg',
      'demo-org',
      'demo_org',
      'demoorg',
      'dummy-org',
      'dummy_org',
      'dummyorg'
    ];
    
    // Find organizations matching default patterns
    const defaultOrganizations = await Organization.find({
      $or: [
        { slug: { $in: defaultPatterns } },
        { name: { $regex: /default|test|sample|demo|dummy/i } },
        { slug: { $regex: /default|test|sample|demo|dummy/i } }
      ]
    });
    
    if (defaultOrganizations.length === 0) {
      console.log('\n✅ No default organizations found to remove');
      console.log('💡 Database is clean - only user-created organizations exist');
      return;
    }
    
    console.log(`\n🔍 Found ${defaultOrganizations.length} default organization(s) to remove:`);
    defaultOrganizations.forEach((org, index) => {
      console.log(`   ${index + 1}. "${org.name}" (${org.slug}) - UUID: ${org.uuid}`);
    });
    
    // Remove default organizations
    console.log('\n🗑️ Removing default organizations...');
    const deleteResult = await Organization.deleteMany({
      $or: [
        { slug: { $in: defaultPatterns } },
        { name: { $regex: /default|test|sample|demo|dummy/i } },
        { slug: { $regex: /default|test|sample|demo|dummy/i } }
      ]
    });
    
    console.log(`✅ Successfully removed ${deleteResult.deletedCount} default organization(s)`);
    
    // Verify cleanup
    const remainingOrganizations = await Organization.find({});
    console.log(`\n📊 Database now contains ${remainingOrganizations.length} user-created organization(s)`);
    
    if (remainingOrganizations.length > 0) {
      console.log('\n📋 Remaining organizations (user-created):');
      remainingOrganizations.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name} (${org.slug}) - UUID: ${org.uuid}`);
      });
    } else {
      console.log('💡 Database is now empty - users can create their first organization');
    }
    
    console.log('\n🎉 Default organizations cleanup completed successfully!');
    console.log('🚀 Application will now use single database architecture');
    console.log('👤 Users must create their own organizations (no defaults)');
    
  } catch (error) {
    console.error('\n❌ Failed to cleanup default organizations:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB Atlas');
  }
}

// Execute if run directly
if (require.main === module) {
  cleanupDefaultOrganizations()
    .then(() => {
      console.log('\n✨ Default organizations cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Default organizations cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupDefaultOrganizations };
