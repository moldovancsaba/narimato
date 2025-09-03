// FUNCTIONAL: Fix the marketing card parentTag inconsistency
// STRATEGIC: Ensure all company children use consistent parentTag format

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const ORG_ID = 'be34910d-fc7b-475b-8112-67fe778bff2c';
const Card = require('./lib/models/Card.js');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  }
}

async function fixMarketingParent() {
  await connectDB();
  
  try {
    console.log('🔧 Fixing marketing card parentTag...\n');
    
    // Find the marketing card
    const marketingCard = await Card.findOne({ 
      organizationId: ORG_ID,
      name: '#marketing',
      isActive: true 
    });
    
    if (!marketingCard) {
      console.log('❌ Marketing card not found');
      return;
    }
    
    console.log(`Found marketing card:`);
    console.log(`  Name: ${marketingCard.name}`);
    console.log(`  Title: ${marketingCard.title}`);
    console.log(`  Current parentTag: "${marketingCard.parentTag}"`);
    
    // Update parentTag to be consistent with sales and product
    await Card.findOneAndUpdate(
      { uuid: marketingCard.uuid },
      { parentTag: 'company' }
    );
    
    console.log('✅ Updated marketing card parentTag to "company"\n');
    
    // Update company card flags
    const companyCard = await Card.findOne({ 
      organizationId: ORG_ID,
      name: '#company',
      isActive: true 
    });
    
    if (companyCard) {
      await Card.findOneAndUpdate(
        { uuid: companyCard.uuid },
        { isParent: true, hasChildren: true }
      );
      console.log('✅ Updated company card to be a parent\n');
    }
    
    // Update all cards with proper parent flags
    const allCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    });
    
    for (const card of allCards) {
      const children = allCards.filter(c => c.parentTag === card.name);
      const shouldBeParent = children.length > 0;
      
      if (card.isParent !== shouldBeParent || card.hasChildren !== shouldBeParent) {
        await Card.findOneAndUpdate(
          { uuid: card.uuid },
          { 
            isParent: shouldBeParent, 
            hasChildren: shouldBeParent 
          }
        );
        console.log(`✅ Fixed parent flags for ${card.name} (children: ${children.length})`);
      }
    }
    
    console.log('\n🎯 Hierarchy fixed! Company deck should now work properly in SwipeMore.\n');
    
    // Show final structure
    console.log('📊 FINAL COMPANY HIERARCHY:');
    const companyChildren = allCards.filter(card => card.parentTag === 'company');
    console.log(`\nCompany children (${companyChildren.length}):`);
    companyChildren.forEach(child => {
      const grandchildren = allCards.filter(c => c.parentTag === child.name);
      console.log(`  - ${child.name} (${child.title}) - ${grandchildren.length} children`);
      grandchildren.forEach(grandchild => {
        console.log(`    - ${grandchild.name} (${grandchild.title})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixMarketingParent().catch(console.error);
