# Migration Plan: Monolithic to Multi-Tenant Architecture

**Version:** 3.7.0  
**Date:** 2025-08-03T15:33:53.000Z  
**Status:** PLANNED  

## Executive Summary

This document outlines the migration strategy to move existing Narimato data from the current monolithic database structure to the new multi-tenant architecture where each organization has its own separate database.

## Migration Architecture

### Current State
- Single MongoDB database containing all cards, plays, rankings, and analytics
- All users and data share the same database collections
- No organization isolation

### Target State
- Master database containing only Organization metadata
- Separate database per organization (format: `narimato_org_{slug}`)
- Complete data isolation between organizations
- Shared codebase with organization-aware database connections

## Migration Strategy

### Phase 1: Infrastructure Preparation
1. **Backup Current Database**
   - Create full backup of existing database
   - Verify backup integrity
   - Store backup in secure location with versioning

2. **Deploy Multi-Tenant Code**
   - Deploy new database connection management
   - Deploy organization middleware and APIs
   - Test with empty organization databases

3. **Create Master Database**
   - Initialize Organization collection in master database
   - Create default organization entry for existing data

### Phase 2: Data Migration Execution

#### Step 1: Create Default Organization
```typescript
// Create default organization for existing data
const defaultOrg = {
  name: "Narimato Default",
  slug: "default",
  databaseName: "narimato_org_default",
  isActive: true,
  createdAt: new Date()
};
```

#### Step 2: Migrate Card Data
```typescript
// Migration script for cards
async function migrateCards() {
  const sourceDb = await connectToSource();
  const targetDb = await createOrgDbConnect('default')();
  
  const cards = await sourceDb.collection('cards').find({}).toArray();
  
  for (const card of cards) {
    // Preserve all existing card data structure
    await targetDb.collection('cards').insertOne(card);
  }
  
  console.log(`Migrated ${cards.length} cards`);
}
```

#### Step 3: Migrate Play Sessions
```typescript
// Migration script for play sessions
async function migratePlays() {
  const sourceDb = await connectToSource();
  const targetDb = await createOrgDbConnect('default')();
  
  const plays = await sourceDb.collection('plays').find({}).toArray();
  
  for (const play of plays) {
    // Preserve all existing play data structure
    await targetDb.collection('plays').insertOne(play);
  }
  
  console.log(`Migrated ${plays.length} play sessions`);
}
```

#### Step 4: Migrate Global Rankings
```typescript
// Migration script for global rankings
async function migrateGlobalRankings() {
  const sourceDb = await connectToSource();
  const targetDb = await createOrgDbConnect('default')();
  
  const rankings = await sourceDb.collection('globalrankings').find({}).toArray();
  
  for (const ranking of rankings) {
    // Preserve all existing ranking data structure
    await targetDb.collection('globalrankings').insertOne(ranking);
  }
  
  console.log(`Migrated ${rankings.length} global rankings`);
}
```

### Phase 3: Validation and Testing

#### Data Integrity Validation
1. **Record Count Verification**
   - Compare record counts between source and target
   - Verify no data loss occurred during migration

2. **Data Structure Validation**
   - Validate all fields preserved correctly
   - Check data types and relationships
   - Verify indexes are properly created

3. **Functional Testing**
   - Test card creation and retrieval
   - Test play session functionality
   - Test ranking calculations
   - Verify organization isolation

#### Performance Testing
1. **Connection Performance**
   - Test organization detection middleware
   - Validate database connection caching
   - Monitor connection pool usage

2. **Query Performance**
   - Benchmark card queries
   - Test play session operations
   - Validate ranking calculations

### Phase 4: Production Cutover

#### Pre-Cutover Checklist
- [ ] All migration scripts tested
- [ ] Data validation complete
- [ ] Performance testing passed
- [ ] Rollback procedures defined
- [ ] Team trained on new architecture

#### Cutover Process
1. **Maintenance Window Start**
   - Enable maintenance mode
   - Stop all write operations
   - Complete final data sync

2. **Database Switchover**
   - Update environment variables
   - Switch API routes to organization-aware versions
   - Restart application services

3. **Validation**
   - Test critical user journeys
   - Verify data accessibility
   - Monitor error logs

4. **Go-Live**
   - Disable maintenance mode
   - Monitor system performance
   - Be ready for rollback if needed

## Rollback Plan

### Rollback Triggers
- Critical functionality broken
- Data integrity issues discovered
- Performance degradation beyond acceptable limits
- User-impacting bugs that cannot be quickly resolved

### Rollback Procedure
1. **Immediate Actions**
   - Enable maintenance mode
   - Revert environment variables to monolithic database
   - Deploy previous code version
   - Restart application services

2. **Data Synchronization**
   - Sync any new data created during migration window
   - Verify data integrity in monolithic database
   - Update any changed records

3. **Validation**
   - Test critical functionality
   - Verify user access restored
   - Monitor for any issues

## Migration Scripts

### Master Migration Script
```bash
#!/bin/bash
# migration.sh - Master migration script

set -e

echo "Starting Narimato Multi-Tenant Migration"
echo "Date: $(date)"

# Phase 1: Backup
echo "Creating database backup..."
mongodump --uri="$SOURCE_MONGODB_URI" --out="./backup/$(date +%Y%m%d_%H%M%S)"

# Phase 2: Create default organization
echo "Creating default organization..."
node scripts/create-default-org.js

# Phase 3: Migrate data
echo "Migrating cards..."
node scripts/migrate-cards.js

echo "Migrating plays..."
node scripts/migrate-plays.js

echo "Migrating rankings..."
node scripts/migrate-rankings.js

# Phase 4: Validate
echo "Validating migration..."
node scripts/validate-migration.js

echo "Migration completed successfully!"
```

### Validation Script
```typescript
// validate-migration.js
import { connectMasterDb, createOrgDbConnect } from '../app/lib/utils/db';

async function validateMigration() {
  console.log('🔍 Starting migration validation...');
  
  // Connect to source and target databases
  const sourceDb = await connectToSource();
  const targetDb = await createOrgDbConnect('default')();
  
  // Validate record counts
  const collections = ['cards', 'plays', 'globalrankings'];
  
  for (const collection of collections) {
    const sourceCount = await sourceDb.collection(collection).countDocuments();
    const targetCount = await targetDb.collection(collection).countDocuments();
    
    if (sourceCount !== targetCount) {
      throw new Error(`Count mismatch for ${collection}: source=${sourceCount}, target=${targetCount}`);
    }
    
    console.log(`✅ ${collection}: ${sourceCount} records migrated successfully`);
  }
  
  console.log('✅ Migration validation completed successfully');
}
```

## Post-Migration Tasks

### Immediate (First 24 Hours)
- [ ] Monitor application performance
- [ ] Check error logs for any issues
- [ ] Validate user functionality
- [ ] Monitor database connections and performance

### Short-term (First Week)
- [ ] Performance optimization based on real usage
- [ ] Fix any minor issues discovered
- [ ] Update monitoring and alerting
- [ ] Document any lessons learned

### Long-term (First Month)
- [ ] Create additional organizations as needed
- [ ] Optimize database connection pooling
- [ ] Implement organization-specific analytics
- [ ] Plan for scaling additional organizations

## Risk Assessment

### High Risk
- **Data Loss**: Comprehensive backup and validation mitigates this
- **Service Downtime**: Planned maintenance window and rollback plan
- **Performance Issues**: Pre-migration testing and monitoring

### Medium Risk
- **Connection Issues**: Database connection caching and testing
- **Feature Regressions**: Comprehensive testing of all functionality

### Low Risk
- **Minor UI Issues**: Non-critical and can be fixed post-migration
- **Analytics Gaps**: Can be addressed in subsequent releases

## Success Criteria

### Technical Success
- [ ] All data migrated with 100% integrity
- [ ] No performance degradation
- [ ] All existing functionality works
- [ ] Organization isolation verified

### Business Success
- [ ] No user-facing disruption
- [ ] Ability to onboard new organizations
- [ ] Foundation for whitelabel offerings
- [ ] Scalable multi-tenant architecture

## Timeline

### Preparation Phase: 2 Days
- Day 1: Script development and testing
- Day 2: Final validation and team training

### Migration Phase: 4 Hours (Maintenance Window)
- Hour 1: Backup and preparation
- Hour 2: Data migration execution
- Hour 3: Validation and testing
- Hour 4: Production cutover and monitoring

### Post-Migration: 1 Week
- Continuous monitoring and optimization
- Issue resolution and documentation

---

**Migration Lead:** Development Team  
**Approval Required:** Technical Lead, Product Owner  
**Emergency Contact:** [Emergency contact information]
