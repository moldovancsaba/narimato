require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');

async function fixCompanyHierarchy() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🔧 FIXING COMPLETE HIERARCHICAL STRUCTURE');
    console.log('==================================================');

    // 1. Fix the parent cards for company deck
    console.log('1. CREATING PROPER PARENT CARDS FOR COMPANY DECK...');
    
    // Update company/sales to become sales parent card
    const salesResult = await Card.updateOne(
      { organizationId, name: 'company/sales' },
      { 
        $set: { 
          name: 'sales',
          isParent: true,
          parentTag: 'company'
        } 
      }
    );
    console.log(`  - Sales parent card: ${salesResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // Update company/marketing to become marketing parent card
    const marketingResult = await Card.updateOne(
      { organizationId, name: 'company/marketing' },
      { 
        $set: { 
          name: 'marketing',
          isParent: true,
          parentTag: 'company'
        } 
      }
    );
    console.log(`  - Marketing parent card: ${marketingResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // Update company/product to become product parent card
    const productResult = await Card.updateOne(
      { organizationId, name: 'company/product' },
      { 
        $set: { 
          name: 'product',
          isParent: true,
          parentTag: 'company'
        } 
      }
    );
    console.log(`  - Product parent card: ${productResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // 2. Fix child cards to be properly structured
    console.log('\n2. FIXING CHILD CARDS...');
    
    // Fix shark - should be child of sales, not parent
    const sharkResult = await Card.updateOne(
      { organizationId, name: 'shark' },
      { 
        $set: { 
          isParent: false,  // Child card!
          parentTag: 'sales'
        } 
      }
    );
    console.log(`  - Shark (sales child): ${sharkResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // Fix customer first - should be child of sales, not parent
    const customerResult = await Card.updateOne(
      { organizationId, name: 'sales/customer first' },
      { 
        $set: { 
          name: 'customer first',
          isParent: false,  // Child card!
          parentTag: 'sales'
        } 
      }
    );
    console.log(`  - Customer first (sales child): ${customerResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // Fix marketing children (remove # from names)
    const targetedResult = await Card.updateOne(
      { organizationId, name: '#targeted' },
      { 
        $set: { 
          name: 'targeted',
          isParent: false,
          parentTag: 'marketing'
        } 
      }
    );
    console.log(`  - Targeted (marketing child): ${targetedResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    const designerResult = await Card.updateOne(
      { organizationId, name: '#designer' },
      { 
        $set: { 
          name: 'designer',
          isParent: false,
          parentTag: 'marketing'
        } 
      }
    );
    console.log(`  - Designer (marketing child): ${designerResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // Fix product children (remove # from names)
    const doneResult = await Card.updateOne(
      { organizationId, name: '#done_is_better' },
      { 
        $set: { 
          name: 'done is better',
          isParent: false,
          parentTag: 'product'
        } 
      }
    );
    console.log(`  - Done is better (product child): ${doneResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    const pixelResult = await Card.updateOne(
      { organizationId, name: '#pixel_perfect' },
      { 
        $set: { 
          name: 'pixel perfect',
          isParent: false,
          parentTag: 'product'
        } 
      }
    );
    console.log(`  - Pixel perfect (product child): ${pixelResult.modifiedCount > 0 ? '✅ Fixed' : '❌ Not found/updated'}`);

    // 3. Verify the fix
    console.log('\n3. VERIFYING HIERARCHICAL STRUCTURE...');
    
    // Check company deck
    const { isDeck } = require('./lib/utils/cardUtils');
    const isCompanyValid = await isDeck(organizationId, 'company');
    console.log(`Company deck: ${isCompanyValid ? '✅ PLAYABLE' : '❌ STILL BROKEN'}`);

    if (isCompanyValid) {
      const companyParents = await Card.find({
        organizationId,
        parentTag: 'company',
        isParent: true,
        isActive: true
      });
      
      console.log(`\nCompany deck now has ${companyParents.length} parent cards:`);
      companyParents.forEach(card => {
        console.log(`  - "${card.name}"`);
      });

      // Check each family
      console.log('\nFamily structures:');
      for (const parent of companyParents) {
        const children = await Card.find({
          organizationId,
          parentTag: parent.name,
          isParent: false,
          isActive: true
        });
        console.log(`  ${parent.name} family: ${children.length} children`);
        children.forEach(child => {
          console.log(`    - "${child.name}"`);
        });
      }
    }

    // 4. Test other decks
    console.log('\n4. CHECKING OTHER DECKS...');
    const salesDeckValid = await isDeck(organizationId, 'sales');
    const marketingDeckValid = await isDeck(organizationId, 'marketing');
    const productDeckValid = await isDeck(organizationId, 'product');
    
    console.log(`Sales deck: ${salesDeckValid ? '✅ PLAYABLE' : '❌ NOT PLAYABLE'}`);
    console.log(`Marketing deck: ${marketingDeckValid ? '✅ PLAYABLE' : '❌ NOT PLAYABLE'}`);
    console.log(`Product deck: ${productDeckValid ? '✅ PLAYABLE' : '❌ NOT PLAYABLE'}`);

    console.log('\n🎯 HIERARCHICAL DECISION TREE READY!');
    console.log('You can now:');
    console.log('1. Play "company" deck → Rank sales vs marketing vs product');
    console.log('2. When you swipe right on "sales" → Rank shark vs customer first');
    console.log('3. When you swipe right on "marketing" → Rank targeted vs designer');
    console.log('4. When you swipe right on "product" → Rank done is better vs pixel perfect');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

fixCompanyHierarchy();
