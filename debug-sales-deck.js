require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');
const { isDeck } = require('./lib/utils/cardUtils');

async function debugSalesDeck() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('🔍 DEBUGGING SALES DECK');
    console.log('==================================================');

    // 1. Find all cards related to sales
    console.log('1. ALL SALES-RELATED CARDS:');
    const salesCards = await Card.find({
      $or: [
        { name: { $regex: /sales/i } },
        { hashtags: { $regex: /sales/i } },
        { parentTag: { $regex: /sales/i } }
      ],
      isActive: true
    });
    
    console.log(`Found ${salesCards.length} sales-related cards:`);
    salesCards.forEach(card => {
      console.log(`  - "${card.name}" (org: "${card.organizationId}", parentTag: "${card.parentTag}", isParent: ${card.isParent}, hashtags: ${JSON.stringify(card.hashtags)})`);
    });

    // 2. Check all organizations
    console.log('\n2. ALL ORGANIZATIONS:');
    const distinctOrgs = await Card.distinct('organizationId');
    console.log('Organizations found:', distinctOrgs);

    // 3. Test isDeck for each organization + sales combination
    console.log('\n3. TESTING isDeck() FOR SALES:');
    for (const orgId of distinctOrgs) {
      const isValid = await isDeck(orgId, 'sales');
      console.log(`  - Org "${orgId}" + deck "sales": ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (isValid) {
        // Show what would be found
        const parentCards = await Card.find({
          organizationId: orgId,
          parentTag: 'sales',
          isParent: true,
          isActive: true
        });
        console.log(`    Found ${parentCards.length} parent cards:`);
        parentCards.forEach(card => {
          console.log(`      - "${card.name}" (${card.uuid})`);
        });
      }
    }

    // 4. Check if sales cards need to be restructured
    console.log('\n4. CURRENT SALES STRUCTURE ANALYSIS:');
    console.log('Based on your UI description:');
    console.log('- "sales" deck has 2 cards: "shark" and "customer first"');
    console.log('- This suggests "shark" and "customer first" should be parent cards with parentTag="sales"');
    
    // Check current structure
    const sharkCard = await Card.findOne({ name: 'shark', isActive: true });
    const customerCard = await Card.findOne({ name: 'customer first', isActive: true });
    const salesCard = await Card.findOne({ name: 'sales', isActive: true });
    
    console.log('\nCurrent card structure:');
    if (salesCard) {
      console.log(`- "sales" card: parentTag="${salesCard.parentTag}", isParent=${salesCard.isParent}`);
    } else {
      console.log('- No "sales" card found');
    }
    
    if (sharkCard) {
      console.log(`- "shark" card: parentTag="${sharkCard.parentTag}", isParent=${sharkCard.isParent}`);
    } else {
      console.log('- No "shark" card found');
    }
    
    if (customerCard) {
      console.log(`- "customer first" card: parentTag="${customerCard.parentTag}", isParent=${customerCard.isParent}`);
    } else {
      console.log('- No "customer first" card found');
    }

    // 5. Suggest fix
    console.log('\n5. SUGGESTED FIX:');
    console.log('For sales deck to work with hierarchical system:');
    console.log('- "shark" and "customer first" should have isParent=true and parentTag="sales"');
    console.log('- OR create a parent-level deck structure');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugSalesDeck();
