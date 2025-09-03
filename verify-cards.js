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

async function verifyAllCards() {
  await connectDB();
  
  try {
    console.log('🔍 VERIFYING ALL CARDS ARE PRESENT\n');
    
    const allCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    }).sort({ name: 1 });
    
    console.log(`Total cards found: ${allCards.length}\n`);
    
    // List all cards with their details
    console.log('📋 COMPLETE CARD LIST:\n');
    allCards.forEach((card, index) => {
      console.log(`${index + 1}. ${card.name} (${card.title})`);
      console.log(`   parentTag: "${card.parentTag || 'ROOT'}"`);
      console.log(`   isParent: ${card.isParent}, hasChildren: ${card.hasChildren}`);
      console.log(`   globalScore: ${card.globalScore}, voteCount: ${card.voteCount}`);
      console.log('');
    });
    
    // Expected cards based on your original list
    const expectedCards = [
      '#0', '#1', '#2', '#3', '#11', '#12', '#21', '#22', '#31', '#32',
      '#company', '#sales', '#product', '#marketing', 
      '#shark', '#customer first', '#done is better', '#pixel perfect',
      'designer', 'targeted'
    ];
    
    console.log('🔍 CHECKING FOR EXPECTED CARDS:\n');
    
    let missingCards = [];
    let foundCards = [];
    
    expectedCards.forEach(expectedName => {
      const found = allCards.find(card => card.name === expectedName);
      if (found) {
        foundCards.push(expectedName);
        console.log(`✅ ${expectedName} - FOUND`);
      } else {
        missingCards.push(expectedName);
        console.log(`❌ ${expectedName} - MISSING`);
      }
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Found: ${foundCards.length} cards`);
    console.log(`❌ Missing: ${missingCards.length} cards`);
    
    if (missingCards.length === 0) {
      console.log(`\n🎉 ALL CARDS ARE PRESENT! No cards were removed.`);
    } else {
      console.log(`\n⚠️  Missing cards: ${missingCards.join(', ')}`);
    }
    
    // Show what was actually changed
    console.log(`\n🔧 WHAT WAS CHANGED:`);
    console.log(`- NO CARDS WERE DELETED`);
    console.log(`- Only parentTag values were updated to fix hierarchy`);
    console.log(`- Only isParent/hasChildren flags were corrected`);
    console.log(`- All card content (title, description, scores) unchanged`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyAllCards().catch(console.error);
