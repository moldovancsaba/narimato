#!/usr/bin/env node

/**
 * Migration Script: Add cardSize Property to All Cards
 * 
 * This script ensures ALL cards in the database have a cardSize property.
 * Cards without cardSize will get a default size based on their content type.
 * 
 * Usage: node scripts/add-cardsize-to-cards.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Card schema (simplified for migration)
const CardSchema = new mongoose.Schema({
  uuid: String,
  name: String,
  body: {
    imageUrl: String,
    textContent: String,
    background: Object
  },
  cardSize: String,
  children: [String],
  hashtags: [String],
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
});

const Card = mongoose.models.Card || mongoose.model('Card', CardSchema);

async function addCardSizeToCards() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all cards without cardSize property
    const cardsWithoutSize = await Card.find({
      $or: [
        { cardSize: { $exists: false } },
        { cardSize: null },
        { cardSize: '' }
      ]
    });

    console.log(`📊 Found ${cardsWithoutSize.length} cards without cardSize property`);

    if (cardsWithoutSize.length === 0) {
      console.log('✅ All cards already have cardSize property!');
      return;
    }

    let updated = 0;
    for (const card of cardsWithoutSize) {
      let cardSize;
      
      // Determine appropriate cardSize based on card content
      if (card.body?.imageUrl) {
        // Media cards - use 4:5 aspect ratio (Instagram-like)
        cardSize = '400:500';
      } else if (card.body?.textContent) {
        // Text cards - use 3:4 aspect ratio (portrait)
        cardSize = '300:400';
      } else if (card.name?.startsWith('#')) {
        // Category/deck cards - use 16:9 aspect ratio (landscape)
        cardSize = '400:225';
      } else {
        // Default - use 3:4 aspect ratio
        cardSize = '300:400';
      }

      // Update card with cardSize
      await Card.updateOne(
        { _id: card._id },
        { 
          $set: { 
            cardSize: cardSize,
            updatedAt: new Date()
          }
        }
      );

      updated++;
      console.log(`✅ Updated card ${card.name || card.uuid}: ${cardSize}`);
    }

    console.log(`🎯 Successfully updated ${updated} cards with cardSize property`);
    
    // Verify all cards now have cardSize
    const remainingCards = await Card.find({
      $or: [
        { cardSize: { $exists: false } },
        { cardSize: null },
        { cardSize: '' }
      ]
    });

    if (remainingCards.length === 0) {
      console.log('✅ MIGRATION COMPLETE: All cards now have cardSize property!');
    } else {
      console.log(`⚠️  WARNING: ${remainingCards.length} cards still missing cardSize`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  addCardSizeToCards().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { addCardSizeToCards };
