const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Organization schema
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  subdomain: { type: String },
  databaseName: { type: String, required: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Card schema for organization database
const cardSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  body: { type: String, default: '' },
  hashtags: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

async function initializeDefaultOrganization() {
  try {
    // Get MongoDB URI
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('🔗 Connecting to master database...');
    const masterConnection = await mongoose.createConnection(masterUri);
    
    // Create the Organization model
    const Organization = masterConnection.model('Organization', organizationSchema);
    
    // Check if default organization already exists
    let existing = await Organization.findOne({ slug: 'default' });
    if (existing) {
      console.log('✅ Default organization already exists in master database');
    } else {
      // Create default organization
      const defaultOrg = new Organization({
        name: 'Default Organization',
        slug: 'default',
        databaseName: 'narimato_org_default',
        settings: {},
        isActive: true
      });
      
      await defaultOrg.save();
      console.log('✅ Default organization created in master database');
      existing = defaultOrg;
    }
    
    // Now initialize the organization's database
    const orgUri = masterUri.replace(/\/[^\/]+$/, '/narimato_org_default');
    console.log('🔗 Connecting to organization database:', orgUri.replace(/\/\/[^@]+@/, '//<credentials>@'));
    
    const orgConnection = await mongoose.createConnection(orgUri);
    
    // Create Card model for organization database
    const Card = orgConnection.model('Card', cardSchema);
    
    // Check if we have any cards
    const cardCount = await Card.countDocuments();
    console.log(`📊 Found ${cardCount} existing cards in organization database`);
    
    // Create collections and indexes
    const collections = [
      {
        name: 'cards',
        model: Card,
        indexes: [
          { name: 1, unique: true },
          { uuid: 1, unique: true },
          { hashtags: 1 },
          { isActive: 1 },
          { createdAt: -1 }
        ]
      }
    ];
    
    for (const collection of collections) {
      console.log(`📊 Processing collection: ${collection.name}`);
      
      // Create collection if it doesn't exist
      const collectionExists = await orgConnection.db.listCollections({ name: collection.name }).hasNext();
      if (!collectionExists) {
        await orgConnection.db.createCollection(collection.name);
        console.log(`  ✅ Created collection: ${collection.name}`);
      } else {
        console.log(`  ✅ Collection exists: ${collection.name}`);
      }
      
      // Create indexes
      for (const index of collection.indexes) {
        try {
          await collection.model.collection.createIndex(index);
          console.log(`  📝 Created index:`, index);
        } catch (error) {
          if (error.code === 11000 || error.message.includes('already exists')) {
            console.log(`  📝 Index already exists:`, index);
          } else {
            console.warn(`  ⚠️ Failed to create index:`, index, error.message);
          }
        }
      }
    }
    
    // Add some sample cards if database is empty
    if (cardCount === 0) {
      console.log('📦 Adding sample cards...');
      
      const sampleCards = [
        {
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          name: '#SampleDeck',
          body: 'This is a sample parent card for testing',
          hashtags: ['#SampleDeck'],
          isActive: true
        },
        {
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Sample Card 1',
          body: 'First sample card for ranking',
          hashtags: ['#SampleDeck'],
          isActive: true
        },
        {
          uuid: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Sample Card 2',
          body: 'Second sample card for ranking',
          hashtags: ['#SampleDeck'],
          isActive: true
        },
        {
          uuid: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Sample Card 3',
          body: 'Third sample card for ranking',
          hashtags: ['#SampleDeck'],
          isActive: true
        }
      ];
      
      await Card.insertMany(sampleCards);
      console.log(`✅ Added ${sampleCards.length} sample cards`);
    }
    
    // Verify setup
    const finalCardCount = await Card.countDocuments();
    const playableCards = await Card.countDocuments({ hashtags: '#SampleDeck', name: { $ne: '#SampleDeck' } });
    
    console.log(`\n🎉 Default organization setup complete!`);
    console.log(`📊 Total cards: ${finalCardCount}`);
    console.log(`🎮 Playable cards: ${playableCards}`);
    console.log(`🏢 Organization: ${existing.name} (${existing.slug})`);
    console.log(`💾 Database: ${existing.databaseName}`);
    
    await orgConnection.close();
    await masterConnection.close();
    
  } catch (error) {
    console.error('❌ Error initializing default organization:', error);
    process.exit(1);
  }
}

initializeDefaultOrganization();
