require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const { isDeck } = require('./lib/utils/cardUtils');

async function verifyDatabaseStructure() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('🔍 COMPREHENSIVE DATABASE VERIFICATION');
    console.log('==================================================');

    // 1. Get ALL cards in database
    console.log('1. ALL CARDS IN DATABASE:');
    const allCards = await Card.find({}).sort({ name: 1 });
    console.log(`Found ${allCards.length} total cards across all organizations:\n`);

    // Group by organization
    const byOrg = {};
    allCards.forEach(card => {
      if (!byOrg[card.organizationId]) byOrg[card.organizationId] = [];
      byOrg[card.organizationId].push(card);
    });

    for (const [orgId, cards] of Object.entries(byOrg)) {
      console.log(`📂 ORGANIZATION: ${orgId}`);
      console.log(`   ${cards.length} cards:`);
      
      cards.forEach(card => {
        const parentFlag = card.isParent ? '[PARENT]' : '[CHILD]';
        const activeFlag = card.isActive ? '✅' : '❌';
        console.log(`   ${activeFlag} "${card.name}" ${parentFlag} (parentTag: "${card.parentTag}", hashtags: ${JSON.stringify(card.hashtags || [])})`);
      });
      console.log('');
    }

    // 2. Check the target organization specifically
    const targetOrg = 'be34910d-fc7b-475b-8112-67fe778bff2c';
    console.log(`2. TARGET ORGANIZATION ANALYSIS: ${targetOrg}`);
    console.log('==================================================');

    const orgCards = await Card.find({ organizationId: targetOrg, isActive: true }).sort({ name: 1 });
    console.log(`Found ${orgCards.length} active cards in target organization:\n`);

    // Group by parentTag to show hierarchy
    const hierarchy = {};
    orgCards.forEach(card => {
      const parent = card.parentTag || 'ROOT';
      if (!hierarchy[parent]) hierarchy[parent] = [];
      hierarchy[parent].push(card);
    });

    for (const [parentTag, cards] of Object.entries(hierarchy)) {
      console.log(`📁 PARENT TAG: "${parentTag}"`);
      cards.forEach(card => {
        const type = card.isParent ? 'PARENT' : 'child';
        console.log(`   └─ "${card.name}" [${type}] (${card.uuid})`);
      });
      console.log('');
    }

    // 3. Test specific deck validations
    console.log('3. DECK VALIDATION TESTS:');
    console.log('==================================================');

    const testDecks = ['company', 'sales', 'marketing', 'product'];
    
    for (const deckTag of testDecks) {
      console.log(`🧪 Testing deck: "${deckTag}"`);
      
      // Test isDeck function
      const isValid = await isDeck(targetOrg, deckTag);
      console.log(`   isDeck() result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      // Show what isDeck is looking for
      const parentCards = await Card.find({
        organizationId: targetOrg,
        parentTag: deckTag,
        isParent: true,
        isActive: true
      });
      
      console.log(`   Parent cards found: ${parentCards.length}`);
      parentCards.forEach(card => {
        console.log(`     - "${card.name}" (${card.uuid})`);
      });
      
      // Show children if this is a valid deck
      if (isValid) {
        console.log(`   ✅ "${deckTag}" is playable with ${parentCards.length} parent cards`);
        
        // Show children for each parent
        for (const parent of parentCards) {
          const children = await Card.find({
            organizationId: targetOrg,
            parentTag: parent.name,
            isActive: true
          });
          
          if (children.length > 0) {
            console.log(`     └─ "${parent.name}" family: ${children.length} children`);
            children.forEach(child => {
              console.log(`       - "${child.name}" (isParent: ${child.isParent})`);
            });
          } else {
            console.log(`     └─ "${parent.name}" family: NO CHILDREN`);
          }
        }
      } else {
        console.log(`   ❌ "${deckTag}" is not playable`);
      }
      console.log('');
    }

    // 4. Check for common data issues
    console.log('4. DATA INTEGRITY CHECKS:');
    console.log('==================================================');

    // Check for cards with missing parentTag
    const orphanCards = orgCards.filter(card => !card.parentTag || card.parentTag === 'null' || card.parentTag === '');
    console.log(`🔍 Orphan cards (no parentTag): ${orphanCards.length}`);
    orphanCards.forEach(card => {
      console.log(`   - "${card.name}" (parentTag: "${card.parentTag}")`);
    });

    // Check for parent cards with no children
    const parentsWithoutChildren = [];
    for (const card of orgCards.filter(c => c.isParent)) {
      const children = orgCards.filter(c => c.parentTag === card.name && !c.isParent);
      if (children.length === 0) {
        parentsWithoutChildren.push(card);
      }
    }
    
    console.log(`\n🔍 Parent cards with no children: ${parentsWithoutChildren.length}`);
    parentsWithoutChildren.forEach(card => {
      console.log(`   - "${card.name}" (parentTag: "${card.parentTag}")`);
    });

    // Check for children with missing parents
    const childrenWithMissingParents = [];
    for (const card of orgCards.filter(c => !c.isParent)) {
      const parent = orgCards.find(p => p.name === card.parentTag && p.isParent);
      if (!parent) {
        childrenWithMissingParents.push(card);
      }
    }
    
    console.log(`\n🔍 Children with missing parent cards: ${childrenWithMissingParents.length}`);
    childrenWithMissingParents.forEach(card => {
      console.log(`   - "${card.name}" (looking for parent: "${card.parentTag}")`);
    });

    // Check for incorrect isParent flags
    const incorrectParentFlags = [];
    for (const card of orgCards) {
      const children = orgCards.filter(c => c.parentTag === card.name);
      const hasChildren = children.length > 0;
      
      if (hasChildren && !card.isParent) {
        incorrectParentFlags.push({ card, issue: 'should_be_parent', children: children.length });
      } else if (!hasChildren && card.isParent) {
        incorrectParentFlags.push({ card, issue: 'should_not_be_parent', children: 0 });
      }
    }
    
    console.log(`\n🔍 Incorrect isParent flags: ${incorrectParentFlags.length}`);
    incorrectParentFlags.forEach(item => {
      console.log(`   - "${item.card.name}" (isParent: ${item.card.isParent}, issue: ${item.issue}, children: ${item.children})`);
    });

    // 5. Specific company deck problem diagnosis
    console.log('\n5. COMPANY DECK PROBLEM DIAGNOSIS:');
    console.log('==================================================');
    
    console.log('What company deck SHOULD have:');
    console.log('   Parent cards with parentTag="company" and isParent=true:');
    console.log('   - sales (should have shark, customer first as children)');
    console.log('   - marketing (should have targeted, designer as children)');
    console.log('   - product (should have done is better, pixel perfect as children)');
    
    console.log('\nWhat company deck ACTUALLY has:');
    const actualCompanyParents = orgCards.filter(card => card.parentTag === 'company' && card.isParent);
    console.log(`   ${actualCompanyParents.length} parent cards:`);
    actualCompanyParents.forEach(card => {
      const children = orgCards.filter(c => c.parentTag === card.name);
      console.log(`   - "${card.name}" (${children.length} children: ${children.map(c => c.name).join(', ')})`);
    });

    // 6. Final recommendation
    console.log('\n6. RECOMMENDED FIX:');
    console.log('==================================================');
    
    if (actualCompanyParents.length < 2) {
      console.log('❌ PROBLEM: Not enough parent cards for company deck');
      console.log('   Need at least 2 parent cards with parentTag="company" and isParent=true');
    } else {
      console.log('✅ Parent cards look correct');
    }

    // Check if children are properly linked
    let childrenProblemsFound = false;
    for (const parent of actualCompanyParents) {
      const children = orgCards.filter(c => c.parentTag === parent.name);
      if (children.length === 0) {
        console.log(`❌ PROBLEM: Parent "${parent.name}" has no children`);
        childrenProblemsFound = true;
      } else {
        console.log(`✅ Parent "${parent.name}" has ${children.length} children`);
      }
    }

    if (!childrenProblemsFound && actualCompanyParents.length >= 2) {
      console.log('\n🎯 DATABASE STRUCTURE LOOKS CORRECT!');
      console.log('   The issue might be in the API logic or frontend handling.');
      console.log('   Try the hierarchical flow test URL provided above.');
    } else {
      console.log('\n❌ DATABASE STRUCTURE PROBLEMS FOUND!');
      console.log('   Fix the issues listed above first.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

verifyDatabaseStructure();
