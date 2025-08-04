#!/usr/bin/env node

/**
 * Create Default Organization Script - UUID-First Architecture
 * 
 * This script creates the default organization using clean UUID-First Architecture
 * without backward compatibility mess.
 * 
 * Usage: node scripts/create-default-org.js
 */

const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// 🔑 UUID-First Architecture: Clean Organization schema
const OrganizationSchema = new mongoose.Schema({
  OrganizationUUID: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
      message: 'OrganizationUUID must be a valid UUID v4 format'
    }
  },
  OrganizationName: { type: String, required: true, maxlength: 255 },
  OrganizationSlug: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: (slug) => /^[a-z0-9-]+$/.test(slug),
      message: 'OrganizationSlug must contain only lowercase letters, numbers, and hyphens'
    }
  },
  OrganizationDescription: { type: String, maxlength: 1000, default: '' },
  databaseName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { 
  collection: 'organizations',
  strict: false
});

async function createDefaultOrganization() {
  console.log('🚀 Creating default organization with clean UUID-First Architecture...');
  
  try {
    // Connect to master database
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('✅ Connecting to master database...');
    await mongoose.connect(masterUri);
    
    const Organization = mongoose.model('Organization', OrganizationSchema);
    
    // Check if default organization already exists (UUID-first lookup)
    const existingOrg = await Organization.findOne({
      OrganizationSlug: 'default-org'
    });
    
    if (existingOrg) {
      console.log('✅ Default organization already exists:');
      console.log(`   🔑 OrganizationUUID: ${existingOrg.OrganizationUUID}`);
      console.log(`   📛 OrganizationName: ${existingOrg.OrganizationName}`);
      console.log(`   🔗 OrganizationSlug: ${existingOrg.OrganizationSlug}`);
      return existingOrg;
    }
    
    // 🆕 Create new default organization with UUID-First Architecture
    const orgUUID = uuidv4();
    
    const defaultOrg = new Organization({
      OrganizationUUID: orgUUID,
      OrganizationName: 'Default Organization 🏢',
      OrganizationSlug: 'default-org',
      OrganizationDescription: 'Default organization for Narimato ranking system with clean UUID architecture 🚀',
      databaseName: 'narimato',
      isActive: true,
      createdAt: new Date()
    });
    
    await defaultOrg.save();
    
    console.log('🎉 Default organization created successfully!');
    console.log(`   🔑 OrganizationUUID: ${orgUUID}`);
    console.log(`   📛 OrganizationName: Default Organization 🏢`);
    console.log(`   🔗 OrganizationSlug: default-org`);
    console.log(`   📝 Description: Default organization for Narimato ranking system with clean UUID architecture 🚀`);
    console.log(`   🗄️ Database: narimato`);
    
    return defaultOrg;
    
  } catch (error) {
    console.error('\n❌ Failed to create default organization:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Execute if run directly
if (require.main === module) {
  createDefaultOrganization()
    .then(() => {
      console.log('\n✨ Default organization creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Default organization creation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createDefaultOrganization };
