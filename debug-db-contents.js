require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');

async function debugDbContents() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('🔍 DEBUGGING DATABASE CONTENTS');
    console.log('==================================================');

    // 1. Check all cards without organization filter
    console.log('1. ALL CARDS (no filter):');
    const allCardsNoFilter = await Card.find({});
    console.log(`Found ${allCardsNoFilter.length} total cards in database:`);
    allCardsNoFilter.forEach(card => {
      console.log(`  - "${card.uuid}" (name: "${card.name}", org: "${card.organizationId}", parentTag: "${card.parentTag}", isParent: ${card.isParent}, isActive: ${card.isActive})`);
    });

    // 2. Check distinct organization IDs
    console.log('\n2. DISTINCT ORGANIZATION IDs:');
    const distinctOrgs = await Card.distinct('organizationId');
    console.log('Organizations found:', distinctOrgs);

    // 3. Check each organization
    for (const orgId of distinctOrgs) {
      console.log(`\n3. ORGANIZATION "${orgId}":`);
      const orgCards = await Card.find({ organizationId: orgId });
      console.log(`  Found ${orgCards.length} cards:`);
      orgCards.forEach(card => {
        console.log(`    - "${card.uuid}" (name: "${card.name}", parentTag: "${card.parentTag}", isParent: ${card.isParent}, isActive: ${card.isActive})`);
      });
    }

    // 4. Try common organization IDs
    const commonOrgIds = ['org_123', 'default', 'test', ''];
    console.log('\n4. CHECKING COMMON ORG IDs:');
    for (const orgId of commonOrgIds) {
      const count = await Card.countDocuments({ organizationId: orgId });
      if (count > 0) {
        console.log(`  ✅ "${orgId}": ${count} cards`);
      } else {
        console.log(`  ❌ "${orgId}": 0 cards`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugDbContents();
