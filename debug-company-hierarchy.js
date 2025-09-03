require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const { isDeck } = require('./lib/utils/cardUtils');

async function debugCompanyHierarchy() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🔍 ANALYZING COMPANY DECK HIERARCHY');
    console.log('==================================================');

    // 1. Show all cards to understand current structure
    console.log('1. ALL CARDS IN DATABASE:');
    const allCards = await Card.find({ organizationId, isActive: true }).sort({ name: 1 });
    
    console.log(`Found ${allCards.length} total cards:`);
    allCards.forEach(card => {
      console.log(`  - "${card.name}" (parentTag: "${card.parentTag}", isParent: ${card.isParent})`);
    });

    // 2. Analyze what should be the company deck structure
    console.log('\n2. COMPANY DECK ANALYSIS:');
    console.log('Based on your UI, company deck should have 3 parent cards:');
    console.log('  - sales (parent for shark, customer first)');
    console.log('  - marketing (parent for targeted, designer)');
    console.log('  - product (parent for done is better, pixel perfect)');

    // Check current company deck structure
    const companyParents = await Card.find({
      organizationId,
      parentTag: 'company',
      isParent: true,
      isActive: true
    });

    console.log(`\nCurrent parent cards under "company": ${companyParents.length}`);
    companyParents.forEach(card => {
      console.log(`  - "${card.name}" (isParent: ${card.isParent})`);
    });

    // 3. Check if company deck is valid
    const isCompanyValid = await isDeck(organizationId, 'company');
    console.log(`\n3. IS COMPANY DECK PLAYABLE: ${isCompanyValid ? '✅ YES' : '❌ NO'}`);

    // 4. Show the hierarchy levels we should have
    console.log('\n4. EXPECTED vs ACTUAL HIERARCHY:');
    
    console.log('\nEXPECTED STRUCTURE:');
    console.log('  Level 1 - Company deck: sales, marketing, product (isParent=true, parentTag="company")');
    console.log('  Level 2 - Sales family: shark, customer first (isParent=false, parentTag="sales")');
    console.log('  Level 2 - Marketing family: targeted, designer (isParent=false, parentTag="marketing")');
    console.log('  Level 2 - Product family: done is better, pixel perfect (isParent=false, parentTag="product")');

    console.log('\nACTUAL STRUCTURE:');
    
    // Group cards by parentTag to show actual hierarchy
    const hierarchy = {};
    allCards.forEach(card => {
      const parent = card.parentTag || 'ROOT';
      if (!hierarchy[parent]) hierarchy[parent] = [];
      hierarchy[parent].push(card);
    });

    Object.keys(hierarchy).sort().forEach(parentTag => {
      console.log(`  ${parentTag}:`);
      hierarchy[parentTag].forEach(card => {
        console.log(`    - "${card.name}" (isParent: ${card.isParent})`);
      });
    });

    // 5. Identify the problem
    console.log('\n5. PROBLEM IDENTIFICATION:');
    
    // Check specific cards that should be parents
    const salesCard = allCards.find(card => card.name === 'sales');
    const marketingCard = allCards.find(card => card.name === 'marketing');
    const productCard = allCards.find(card => card.name === 'product');

    console.log('\nKey parent cards status:');
    if (salesCard) {
      console.log(`  - "sales": parentTag="${salesCard.parentTag}", isParent=${salesCard.isParent}`);
      if (salesCard.parentTag !== 'company' || !salesCard.isParent) {
        console.log('    ❌ Should have parentTag="company" and isParent=true');
      }
    } else {
      console.log('  - "sales": ❌ NOT FOUND');
    }

    if (marketingCard) {
      console.log(`  - "marketing": parentTag="${marketingCard.parentTag}", isParent=${marketingCard.isParent}`);
      if (marketingCard.parentTag !== 'company' || !marketingCard.isParent) {
        console.log('    ❌ Should have parentTag="company" and isParent=true');
      }
    } else {
      console.log('  - "marketing": ❌ NOT FOUND');
    }

    if (productCard) {
      console.log(`  - "product": parentTag="${productCard.parentTag}", isParent=${productCard.isParent}`);
      if (productCard.parentTag !== 'company' || !productCard.isParent) {
        console.log('    ❌ Should have parentTag="company" and isParent=true');
      }
    } else {
      console.log('  - "product": ❌ NOT FOUND');
    }

    // 6. Provide fix recommendations
    console.log('\n6. FIX NEEDED:');
    if (!isCompanyValid) {
      console.log('The company deck needs these cards to be updated:');
      if (salesCard && (salesCard.parentTag !== 'company' || !salesCard.isParent)) {
        console.log(`  - Set "sales" card: parentTag="company", isParent=true`);
      }
      if (marketingCard && (marketingCard.parentTag !== 'company' || !marketingCard.isParent)) {
        console.log(`  - Set "marketing" card: parentTag="company", isParent=true`);
      }
      if (productCard && (productCard.parentTag !== 'company' || !productCard.isParent)) {
        console.log(`  - Set "product" card: parentTag="company", isParent=true`);
      }
    } else {
      console.log('✅ Company deck structure looks correct!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugCompanyHierarchy();
