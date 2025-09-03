require('dotenv').config({ path: '.env.local' });
const { connectDB } = require('./lib/db');
const Card = require('./lib/models/Card');

async function fixSalesDeck() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    const organizationId = 'be34910d-fc7b-475b-8112-67fe778bff2c';

    console.log('🔧 FIXING SALES DECK STRUCTURE');
    console.log('==================================================');

    // 1. Show current sales cards
    console.log('1. CURRENT SALES CARDS:');
    const currentSalesCards = await Card.find({
      organizationId,
      $or: [
        { name: { $regex: /sales/i } },
        { hashtags: { $regex: /sales/i } },
        { parentTag: { $regex: /sales/i } }
      ],
      isActive: true
    });
    
    currentSalesCards.forEach(card => {
      console.log(`  - "${card.name}" (parentTag: "${card.parentTag}", isParent: ${card.isParent})`);
    });

    // 2. Fix: Make shark and customer_first parent cards
    console.log('\n2. UPDATING CARDS TO BE PARENT CARDS...');
    
    // Update shark card
    const sharkResult = await Card.updateOne(
      { organizationId, hashtags: '#shark' },
      { 
        $set: { 
          isParent: true,
          name: 'shark' // Remove # from name for cleaner display
        } 
      }
    );
    console.log(`  - Shark card updated: ${sharkResult.modifiedCount > 0 ? '✅' : '❌'}`);
    
    // Update customer_first card  
    const customerResult = await Card.updateOne(
      { organizationId, hashtags: '#customer_first' },
      { 
        $set: { 
          isParent: true,
          name: 'customer first' // Remove # and format name
        } 
      }
    );
    console.log(`  - Customer first card updated: ${customerResult.modifiedCount > 0 ? '✅' : '❌'}`);

    // 3. Verify the fix
    console.log('\n3. VERIFYING UPDATED STRUCTURE...');
    const updatedCards = await Card.find({
      organizationId,
      parentTag: 'sales',
      isParent: true,
      isActive: true
    });

    console.log(`Found ${updatedCards.length} parent cards for sales deck:`);
    updatedCards.forEach(card => {
      console.log(`  - "${card.name}" (${card.uuid})`);
    });

    // 4. Test isDeck
    console.log('\n4. TESTING isDeck() AFTER FIX...');
    const { isDeck } = require('./lib/utils/cardUtils');
    const isValid = await isDeck(organizationId, 'sales');
    console.log(`Sales deck is now ${isValid ? '✅ PLAYABLE' : '❌ STILL INVALID'}`);

    // 5. If still not working, show what's missing
    if (!isValid) {
      console.log('\nPROBLEM ANALYSIS:');
      console.log(`- isDeck() requires at least 2 parent cards with parentTag="sales" and isParent=true`);
      console.log(`- Found ${updatedCards.length} parent cards`);
      console.log('- Need to ensure both shark and customer_first cards exist and are properly updated');
    } else {
      console.log('\n✅ SALES DECK IS NOW READY FOR HIERARCHICAL PLAY!');
      console.log('You can now:');
      console.log('1. Start a play session with deck "sales"');
      console.log('2. Swipe through parent cards: "shark" and "customer first"');
      console.log('3. Create child cards for each parent to enable family sessions');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

fixSalesDeck();
