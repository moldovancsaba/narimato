const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Organization schema for master database
const organizationSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  subdomain: { type: String },
  databaseName: { type: String, required: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

async function initializeMasterDatabase() {
  try {
    // Get MongoDB URI for master database
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('🔗 Connecting to master database...');
    const masterConnection = await mongoose.createConnection(masterUri);
    
    // Create the Organization model
    const Organization = masterConnection.model('Organization', organizationSchema);
    
    // Check if your organization already exists
    let existing = await Organization.findOne({ slug: 'moldovan' });
    if (existing) {
      console.log('✅ Moldován Csaba Kft organization already exists in master database');
      console.log(`   UUID: ${existing.uuid}`);
      console.log(`   DisplayName: ${existing.displayName}`);
      console.log(`   Slug: ${existing.slug}`);
      console.log(`   Database: ${existing.databaseName}`);
    } else {
      // Create your organization in master database
      const orgUUID = 'mcszszcs-oooo-0707-1975-moldovan0707';
      const organization = new Organization({
        uuid: orgUUID,
        displayName: 'Moldován Csaba Kft',
        slug: 'moldovan',
        databaseName: orgUUID,
        settings: {
          timezone: 'Europe/Budapest',
          locale: 'hu-HU',
          features: {
            analytics: false,
            multipleDecks: true,
            customBranding: true
          }
        },
        isActive: true
      });
      
      await organization.save();
      console.log('✅ Moldován Csaba Kft organization created in master database');
      existing = organization;
    }
    
    // Create collections and indexes for master database
    const collections = [
      {
        name: 'organizations',
        model: Organization,
        indexes: [
          { uuid: 1 },
          { slug: 1 },
          { isActive: 1 },
          { createdAt: -1 }
        ],
        uniqueIndexes: [
          { uuid: 1 },
          { slug: 1 }
        ]
      }
    ];
    
    for (const collection of collections) {
      console.log(`📊 Processing master collection: ${collection.name}`);
      
      // Create collection if it doesn't exist
      const collectionExists = await masterConnection.db.listCollections({ name: collection.name }).hasNext();
      if (!collectionExists) {
        await masterConnection.db.createCollection(collection.name);
        console.log(`  ✅ Created collection: ${collection.name}`);
      } else {
        console.log(`  ✅ Collection exists: ${collection.name}`);
      }
      
      // Create regular indexes
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
      
      // Create unique indexes
      if (collection.uniqueIndexes) {
        for (const index of collection.uniqueIndexes) {
          try {
            await collection.model.collection.createIndex(index, { unique: true });
            console.log(`  📝 Created unique index:`, index);
          } catch (error) {
            if (error.code === 11000 || error.message.includes('already exists')) {
              console.log(`  📝 Unique index already exists:`, index);
            } else {
              console.warn(`  ⚠️ Failed to create unique index:`, index, error.message);
            }
          }
        }
      }
    }
    
    // Verify setup
    const orgCount = await Organization.countDocuments();
    const activeOrgs = await Organization.countDocuments({ isActive: true });
    
    console.log(`\n🎉 Master database setup complete!`);
    console.log(`📊 Total organizations: ${orgCount}`);
    console.log(`✅ Active organizations: ${activeOrgs}`);
    console.log(`🏢 Your organization: ${existing.displayName} (${existing.slug})`);
    console.log(`💾 Organization database: ${existing.databaseName}`);
    console.log(`🌐 Master database: narimato`);
    
    await masterConnection.close();
    
  } catch (error) {
    console.error('❌ Error initializing master database:', error);
    process.exit(1);
  }
}

initializeMasterDatabase();
