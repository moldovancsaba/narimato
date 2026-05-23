require('dotenv').config({ path: '.env.local' });
const { connectMaster } = require('../lib/db');
const { registerOrganizationModel } = require('../lib/models/Organization');

const DEFAULT_ORG = {
  uuid: 'mcszszcs-oooo-0707-1975-moldovan0707',
  name: 'Moldován Csaba Kft',
  slug: 'moldovan',
};

async function initializeMasterDatabase() {
  try {
    console.log('🔗 Connecting to master database...');
    const masterConnection = await connectMaster();
    const Organization = registerOrganizationModel(masterConnection);

    let existing = await Organization.findOne({ slug: DEFAULT_ORG.slug });
    if (existing) {
      console.log('✅ Moldován Csaba Kft organization already exists in master database');
      console.log(`   UUID: ${existing.uuid}`);
      console.log(`   Name: ${existing.name}`);
      console.log(`   Slug: ${existing.slug}`);
      console.log(`   Database: ${existing.databaseName || existing.uuid}`);
    } else {
      const organization = new Organization({
        ...DEFAULT_ORG,
        databaseName: DEFAULT_ORG.uuid,
        settings: {
          timezone: 'Europe/Budapest',
          locale: 'hu-HU',
          features: {
            analytics: false,
            multipleDecks: true,
            customBranding: true,
          },
        },
        isActive: true,
      });
      await organization.save();
      console.log('✅ Moldován Csaba Kft organization created in master database');
      existing = organization;
    }

    const collections = [
      {
        name: 'organizations',
        model: Organization,
        indexes: [{ uuid: 1 }, { slug: 1 }, { isActive: 1 }, { createdAt: -1 }],
        uniqueIndexes: [{ uuid: 1 }, { slug: 1 }],
      },
    ];

    for (const collection of collections) {
      console.log(`📊 Processing master collection: ${collection.name}`);
      const collectionExists = await masterConnection.db
        .listCollections({ name: collection.name })
        .hasNext();
      if (!collectionExists) {
        await masterConnection.db.createCollection(collection.name);
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

      if (collection.uniqueIndexes) {
        for (const index of collection.uniqueIndexes) {
          try {
            await collection.model.collection.createIndex(index, { unique: true });
            console.log('  📝 Created unique index:', index);
          } catch (error) {
            if (error.code === 11000 || error.message.includes('already exists')) {
              console.log('  📝 Unique index already exists:', index);
            } else {
              console.warn('  ⚠️ Failed to create unique index:', index, error.message);
            }
          }
        }
      }
    }

    const orgCount = await Organization.countDocuments();
    const activeOrgs = await Organization.countDocuments({ isActive: true });

    console.log('\n🎉 Master database setup complete!');
    console.log(`📊 Total organizations: ${orgCount}`);
    console.log(`✅ Active organizations: ${activeOrgs}`);
    console.log(`🏢 Your organization: ${existing.name} (${existing.slug})`);
    console.log(`💾 Organization database: ${existing.databaseName || existing.uuid}`);

    await masterConnection.close();
  } catch (error) {
    console.error('❌ Error initializing master database:', error);
    process.exit(1);
  }
}

initializeMasterDatabase();
