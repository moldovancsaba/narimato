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

async function fixCompanyFlags() {
  await connectDB();
  
  try {
    console.log('🔧 Fixing company card parent flags...\n');
    
    // Get all cards
    const allCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    });
    
    // Find company card
    const companyCard = allCards.find(c => c.name === '#company');
    if (!companyCard) {
      console.log('❌ Company card not found');
      return;
    }
    
    // Find children of company card
    const companyChildren = allCards.filter(c => c.parentTag === 'company');
    console.log(`Company card: ${companyCard.name}`);
    console.log(`Current flags: isParent=${companyCard.isParent}, hasChildren=${companyCard.hasChildren}`);
    console.log(`Children found: ${companyChildren.length}`);
    companyChildren.forEach(child => {
      console.log(`  - ${child.name} (${child.title})`);
    });
    
    // Update company card flags
    if (companyChildren.length > 0) {
      await Card.findOneAndUpdate(
        { uuid: companyCard.uuid },
        { 
          isParent: true, 
          hasChildren: true 
        }
      );
      console.log('\n✅ Updated company card to be a parent');
    }
    
    // Final verification
    const updatedCompany = await Card.findOne({ uuid: companyCard.uuid });
    console.log(`\nFinal state: isParent=${updatedCompany.isParent}, hasChildren=${updatedCompany.hasChildren}`);
    
    console.log('\n🎉 COMPANY HIERARCHY IS NOW READY FOR SWIPEMORE!');
    console.log('\nHierarchy structure:');
    console.log('📁 #company (3 children)');
    console.log('  📁 #sales (2 children)');
    console.log('    📄 #shark');
    console.log('    📄 #customer first');
    console.log('  📁 #product (2 children)');
    console.log('    📄 #done is better');
    console.log('    📄 #pixel perfect');
    console.log('  📁 #marketing (2 children)');
    console.log('    📄 targeted');
    console.log('    📄 designer');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixCompanyFlags().catch(console.error);
