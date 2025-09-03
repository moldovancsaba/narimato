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

async function fixParentMatching() {
  await connectDB();
  
  try {
    console.log('🔧 Fixing parent-child name matching...\n');
    
    // Get all cards
    const allCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    });
    
    // Define the corrections needed
    const fixes = [
      // Sales children should reference #sales
      { childNames: ['#customer first', '#shark'], newParentTag: '#sales' },
      // Product children should reference #product  
      { childNames: ['#done is better', '#pixel perfect'], newParentTag: '#product' },
      // Marketing children should reference #marketing
      { childNames: ['designer', 'targeted'], newParentTag: '#marketing' }
    ];
    
    let fixedCount = 0;
    
    for (const fix of fixes) {
      console.log(`🔧 Updating children to use parentTag "${fix.newParentTag}":`);
      
      for (const childName of fix.childNames) {
        const childCard = allCards.find(c => c.name === childName);
        
        if (childCard && childCard.parentTag !== fix.newParentTag) {
          console.log(`  - ${childCard.name}: "${childCard.parentTag}" → "${fix.newParentTag}"`);
          
          await Card.findOneAndUpdate(
            { uuid: childCard.uuid },
            { parentTag: fix.newParentTag }
          );
          
          fixedCount++;
        } else if (childCard) {
          console.log(`  - ${childCard.name}: already correct`);
        } else {
          console.log(`  - ${childName}: not found`);
        }
      }
      
      console.log('');
    }
    
    console.log(`✅ Fixed ${fixedCount} parent-child relationships\n`);
    
    // Now update parent flags
    console.log('🔧 Updating parent flags...\n');
    
    const updatedCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    });
    
    let parentFlagsFixed = 0;
    
    for (const card of updatedCards) {
      const children = updatedCards.filter(c => c.parentTag === card.name);
      const shouldBeParent = children.length > 0;
      
      if (card.isParent !== shouldBeParent || card.hasChildren !== shouldBeParent) {
        console.log(`${card.name}: ${children.length} children, setting parent flags to ${shouldBeParent}`);
        
        await Card.findOneAndUpdate(
          { uuid: card.uuid },
          { 
            isParent: shouldBeParent, 
            hasChildren: shouldBeParent 
          }
        );
        
        parentFlagsFixed++;
      }
    }
    
    console.log(`✅ Fixed ${parentFlagsFixed} parent flags\n`);
    
    // Final verification
    console.log('🎯 FINAL COMPANY HIERARCHY:\n');
    
    const finalCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    }).sort({ name: 1 });
    
    const companyCard = finalCards.find(c => c.name === '#company');
    if (companyCard) {
      const companyChildren = finalCards.filter(c => c.parentTag === '#company');
      console.log(`Company: ${companyCard.name} (isParent: ${companyCard.isParent}, children: ${companyChildren.length})\n`);
      
      companyChildren.forEach(child => {
        const grandchildren = finalCards.filter(c => c.parentTag === child.name);
        console.log(`📁 ${child.name} - isParent: ${child.isParent}, children: ${grandchildren.length}`);
        grandchildren.forEach(grandchild => {
          console.log(`   📄 ${grandchild.name}`);
        });
        console.log('');
      });
    }
    
    console.log('🎉 Company hierarchy fixed! SwipeMore should now work.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixParentMatching().catch(console.error);
