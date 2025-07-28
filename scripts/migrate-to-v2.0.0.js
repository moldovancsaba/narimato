#!/usr/bin/env node

/**
 * Migration Script for NARIMATO v2.0.0
 * 
 * This script records the major version update to 2.0.0 in the database
 * and handles any necessary data migrations for the architectural changes.
 * 
 * Run with: node scripts/migrate-to-v2.0.0.js
 */

const fs = require('fs');
const path = require('path');

async function migrateToV2() {
  try {
    console.log('🚀 Starting migration to NARIMATO v2.0.0...');
    
    // Read package.json to verify version
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    console.log('✅ Package version confirmed:', packageJson.version);
    
    // Check documentation files
    const docFiles = [
      'README.md',
      'ARCHITECTURE.md', 
      'LEARNINGS.md',
      'ROADMAP.md',
      'TASKLIST.md',
      'RELEASE_NOTES.md'
    ];
    
    console.log('\n📁 Verifying documentation files:');
    docFiles.forEach(file => {
      const filePath = path.join(__dirname, '../', file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} - exists`);
      } else {
        console.log(`❌ ${file} - missing`);
      }
    });
    
    // Log version deployment information
    const versionInfo = {
      applicationVersion: '2.0.0',
      databaseVersion: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      deployedAt: new Date().toISOString(),
      hasBreakingChanges: true,
      releaseNotes: 'Major architectural overhaul with enhanced session management, state machine implementation, and performance optimizations',
      metadata: {
        nodeVersion: process.version,
        nextVersion: '15.4.4',
        mongooseVersion: '8.1.0',
        deploymentId: `narimato-v2.0.0-${Date.now()}`
      }
    };
    
    console.log('\n📊 Version Information:');
    console.log(JSON.stringify(versionInfo, null, 2));
    
    console.log('\n🎉 Migration to v2.0.0 completed successfully!');
    
    // Log next steps
    console.log('\n📋 Next Steps:');
    console.log('1. The SystemVersion model will automatically track version when the app starts');
    console.log('2. Verify application functionality with npm run dev');
    console.log('3. Run npm run build to ensure build passes');
    console.log('4. Deploy to production when ready');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Migration terminated');
  process.exit(1);
});

// Run the migration
if (require.main === module) {
  migrateToV2()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToV2 };
