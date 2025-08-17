#!/usr/bin/env node

/**
 * Delete Default Organization Script
 * 
 * This script deletes the default organization that should never have been created.
 * Users should be redirected to create their own organizations instead.
 * 
 * Usage: node scripts/delete-default-org.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Organization schema (minimal for deletion)
const OrganizationSchema = new mongoose.Schema({
  OrganizationUUID: { type: String, required: true, unique: true },
  OrganizationName: { type: String, required: true },
  OrganizationSlug: { type: String, required: true, unique: true },
  OrganizationDescription: { type: String, default: '' },
  databaseName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { 
  collection: 'organizations',
  strict: false
});

async function deleteDefaultOrganization() {
  console.log('🗑️  Deleting default organization (should never have existed)...');
  
  try {
    // Connect to master database
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('✅ Connecting to master database...');
    await mongoose.connect(masterUri);
    
    const Organization = mongoose.model('Organization', OrganizationSchema);
    
    // Find the default organization
    const defaultOrg = await Organization.findOne({
      OrganizationSlug: 'default-org'
    });
    
    if (!defaultOrg) {
      console.log('✅ No default organization found to delete');
      return;
    }
    
    console.log('🔍 Found default organization:');
    console.log(`   🔑 OrganizationUUID: ${defaultOrg.OrganizationUUID}`);
    console.log(`   📛 OrganizationName: ${defaultOrg.OrganizationName}`);
    console.log(`   🔗 OrganizationSlug: ${defaultOrg.OrganizationSlug}`);
    
    // Delete the default organization
    await Organization.deleteOne({ OrganizationSlug: 'default-org' });
    
    console.log('🎉 Default organization deleted successfully!');
    console.log('💡 Users will now be properly redirected to create their own organizations');
    
  } catch (error) {
    console.error('\n❌ Failed to delete default organization:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Execute if run directly
if (require.main === module) {
  deleteDefaultOrganization()
    .then(() => {
      console.log('\n✨ Default organization deletion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Default organization deletion failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deleteDefaultOrganization };
