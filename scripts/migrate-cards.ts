import { connect } from 'mongoose';
import { Card } from '../models/Card';
import { generateMD5 } from '../lib/utils/md5';

async function migrateCards() {
  console.log('Starting card migration...');
  
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/narimato';
    await connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all cards
    const cards = await Card.find({});
    console.log(`Found ${cards.length} cards to migrate`);

    // Update each card
    for (const card of cards) {
      try {
        // Generate contentMD5 if not exists
        if (!card.contentMD5) {
          card.contentMD5 = generateMD5(card.content);
          console.log(`Generated contentMD5 for card ${card._id}: ${card.contentMD5}`);
        }

        // Save the card
        await card.save();
        console.log(`Successfully migrated card ${card._id}`);
      } catch (error) {
        console.error(`Error migrating card ${card._id}:`, error);
      }
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateCards();
