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

async function createDefaultOrganization() {
  try {
    // Connect to master database
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('Connecting to master database...');
    await mongoose.connect(masterUri);
    
    // Create the Organization model
    const Organization = mongoose.model('Organization', organizationSchema);
    
    // Check if default organization already exists
    const existing = await Organization.findOne({ slug: 'default' });
    if (existing) {
      console.log('✅ Default organization already exists');
      process.exit(0);
    }
    
    // Create default organization
    const defaultOrg = new Organization({
      name: 'Default Organization',
      slug: 'default',
      databaseName: 'narimato_org_default',
      settings: {},
      isActive: true
    });
    
    await defaultOrg.save();
    console.log('✅ Default organization created successfully:', defaultOrg.toObject());
    
    // Now initialize the organization's database
    const orgUri = masterUri.replace('/narimato', '/narimato_org_default');
    console.log('Connecting to organization database...');
    
    const orgConnection = await mongoose.createConnection(orgUri);
    
    // Create collections and indexes
    const collections = [
      {
        name: 'cards',
        indexes: [
          { name: 1, unique: true },
          { uuid: 1, unique: true },
          { hashtags: 1 },
          { isActive: 1 },
          { createdAt: -1 }
        ]
      },
      {
        name: 'plays',
        indexes: [
          { playUuid: 1, unique: true },
          { sessionId: 1 },
          { status: 1 },
          { createdAt: -1 },
          { expiresAt: 1 }
        ]
      },
      {
        name: 'globalrankings',
        indexes: [
          { cardId: 1, unique: true },
          { eloRating: -1 },
          { lastUpdated: -1 }
        ]
      }
    ];
    
    for (const collection of collections) {
      console.log(`📊 Creating collection: ${collection.name}`);
      
      // Create collection if it doesn't exist
      const collectionExists = await orgConnection.db.listCollections({ name: collection.name }).hasNext();
      if (!collectionExists) {
        await orgConnection.db.createCollection(collection.name);
      }
      
      // Create indexes
      const coll = orgConnection.db.collection(collection.name);
      for (const index of collection.indexes) {
        await coll.createIndex(index);
      }
    }
    
    console.log('✅ Organization database initialized successfully');
    
    await orgConnection.close();
    await mongoose.connection.close();
    
    console.log('🎉 Default organization setup complete!');
    
  } catch (error) {
    console.error('❌ Error creating default organization:', error);
    process.exit(1);
  }
}

createDefaultOrganization();
