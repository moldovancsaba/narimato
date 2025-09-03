require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');

async function fixFamilyData() {
  await connectDB();
  
  console.log('\n🔧 FIXING FAMILY DATA STRUCTURE');
  console.log('='.repeat(50));
  
  // 1. Find all cards that have children but isParent=false
  const childCards = await Card.find({});
  const parentTags = [...new Set(childCards.map(card => card.parentTag).filter(Boolean))];
  
  console.log('\n1. PARENT TAGS THAT NEED PARENTS:');
  console.log('Parent tags found:', parentTags);
  
  for (const parentTag of parentTags) {
    console.log(`\nProcessing parent tag: "${parentTag}"`);
    
    // Find children
    const children = await Card.find({ parentTag: parentTag });
    console.log(`  - Found ${children.length} children`);
    
    // Find potential parent cards (cards with name matching parentTag)
    let parentCard = await Card.findOne({ 
      name: parentTag,
      isParent: true 
    });
    
    if (!parentCard) {
      // Look for cards that could be parents (name contains parentTag or similar)
      const potentialParents = await Card.find({
        $or: [
          { name: { $regex: parentTag, $options: 'i' } },
          { name: `root/${parentTag}` },
          { title: { $regex: parentTag, $options: 'i' } }
        ]
      });
      
      console.log(`  - Found ${potentialParents.length} potential parents:`);
      potentialParents.forEach(p => {
        console.log(`    └─ "${p.title}" (name: "${p.name}", isParent: ${p.isParent})`);
      });
      
      if (potentialParents.length > 0) {
        // Update the first potential parent to be a proper parent
        const targetParent = potentialParents[0];
        console.log(`  - Setting "${targetParent.title}" as parent with isParent=true and name="${parentTag}"`);
        
        await Card.updateOne(
          { _id: targetParent._id },
          { 
            $set: { 
              isParent: true,
              name: parentTag,
              hasChildren: true,
              childrenPlayMode: 'conditional'
            }
          }
        );
        
        console.log(`    ✅ Updated "${targetParent.title}" to be parent of "${parentTag}"`);
        
      } else {
        // Create a new parent card
        console.log(`  - Creating new parent card for "${parentTag}"`);
        
        const newParent = new Card({
          uuid: require('uuid').v4(),
          organizationId: children[0].organizationId,
          name: parentTag,
          title: parentTag,
          description: `Parent card for ${parentTag} family`,
          isParent: true,
          hasChildren: true,
          childrenPlayMode: 'conditional',
          isActive: true,
          parentTag: parentTag === 'yolo' || parentTag === 'betterme' ? 'root' : null
        });
        
        await newParent.save();
        console.log(`    ✅ Created new parent card "${parentTag}"`);
      }
    } else {
      console.log(`  - Parent card already exists and properly configured`);
    }
  }
  
  // 2. Final verification
  console.log('\n2. FINAL VERIFICATION:');
  const allParents = await Card.find({ isParent: true });
  console.log(`\nFound ${allParents.length} parent cards:`);
  
  for (const parent of allParents) {
    const children = await Card.find({ parentTag: parent.name });
    console.log(`  - "${parent.title}" (name: "${parent.name}") has ${children.length} children`);
    children.forEach(child => {
      console.log(`    └─ ${child.title}`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Family data structure fixed!');
}

fixFamilyData().catch(console.error);
