require('dotenv').config({ path: '.env.local' });
const { connectMaster, buildOrgMongoUri, getOrgConnection } = require('../lib/db');
const { registerOrganizationModel } = require('../lib/models/Organization');
const { registerCardModel } = require('../lib/models/Card');

const DEFAULT_ORG = {
  uuid: 'mcszszcs-oooo-0707-1975-moldovan0707',
  name: 'Moldován Csaba Kft',
  slug: 'moldovan',
};

async function initializeDefaultOrganization() {
  try {
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('🔗 Connecting to master database...');
    const masterConnection = await connectMaster();
    const Organization = registerOrganizationModel(masterConnection);

    let existing = await Organization.findOne({ slug: DEFAULT_ORG.slug });
    if (existing) {
      console.log('✅ Moldován Csaba Kft organization already exists in master database');
    } else {
      const defaultOrg = new Organization({
        ...DEFAULT_ORG,
        databaseName: DEFAULT_ORG.uuid,
        settings: {},
        isActive: true,
      });
      await defaultOrg.save();
      console.log('✅ Moldován Csaba Kft organization created in master database');
      existing = defaultOrg;
    }

    const dbName = existing.databaseName || existing.uuid;
    const orgUri = buildOrgMongoUri(masterUri, dbName);
    console.log(
      '🔗 Connecting to organization database:',
      orgUri.replace(/\/\/[^@]+@/, '//<credentials>@')
    );

    const orgConnection = await getOrgConnection(dbName);
    const Card = registerCardModel(orgConnection);

    const cardCount = await Card.countDocuments();
    console.log(`📊 Found ${cardCount} existing cards in organization database`);

    const collections = [
      {
        name: 'cards',
        model: Card,
        indexes: [
          { organizationId: 1 },
          { name: 1 },
          { uuid: 1 },
          { hashtags: 1 },
          { isActive: 1 },
          { createdAt: -1 },
        ],
        uniqueIndexes: [{ uuid: 1 }],
      },
    ];

    for (const collection of collections) {
      console.log(`📊 Processing collection: ${collection.name}`);
      const collectionExists = await orgConnection.db
        .listCollections({ name: collection.name })
        .hasNext();
      if (!collectionExists) {
        await orgConnection.db.createCollection(collection.name);
        console.log(`  ✅ Created collection: ${collection.name}`);
      } else {
        console.log(`  ✅ Collection exists: ${collection.name}`);
      }

      for (const index of collection.indexes) {
        try {
          await collection.model.collection.createIndex(index);
          console.log('  📝 Created index:', index);
        } catch (error) {
          if (error.code === 11000 || error.message.includes('already exists')) {
            console.log('  📝 Index already exists:', index);
          } else {
            console.warn('  ⚠️ Failed to create index:', index, error.message);
          }
        }
      }
    }

    if (cardCount === 0) {
      console.log('📦 Adding sample cards...');
      const orgId = existing.uuid;
      const sampleCards = [
        {
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          organizationId: orgId,
          name: '#SampleDeck',
          title: '#SampleDeck',
          description: 'This is a sample parent card for testing',
          hashtags: ['#SampleDeck'],
          isActive: true,
        },
        {
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          organizationId: orgId,
          name: 'Sample Card 1',
          title: 'Sample Card 1',
          description: 'First sample card for ranking',
          hashtags: ['#SampleDeck'],
          isActive: true,
        },
        {
          uuid: '550e8400-e29b-41d4-a716-446655440003',
          organizationId: orgId,
          name: 'Sample Card 2',
          title: 'Sample Card 2',
          description: 'Second sample card for ranking',
          hashtags: ['#SampleDeck'],
          isActive: true,
        },
        {
          uuid: '550e8400-e29b-41d4-a716-446655440004',
          organizationId: orgId,
          name: 'Sample Card 3',
          title: 'Sample Card 3',
          description: 'Third sample card for ranking',
          hashtags: ['#SampleDeck'],
          isActive: true,
        },
      ];
      await Card.insertMany(sampleCards);
      console.log(`✅ Added ${sampleCards.length} sample cards`);
    }

    const finalCardCount = await Card.countDocuments();
    console.log('\n🎉 Default organization setup complete!');
    console.log(`📊 Total cards: ${finalCardCount}`);
    console.log(`🏢 Organization: ${existing.name} (${existing.slug})`);
    console.log(`💾 Database: ${dbName}`);

    await orgConnection.close();
    await masterConnection.close();
  } catch (error) {
    console.error('❌ Error initializing default organization:', error);
    process.exit(1);
  }
}

initializeDefaultOrganization();
