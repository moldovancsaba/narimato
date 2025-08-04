const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function cleanupDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db('test'); // Default database
    
    console.log('🗑️ Cleaning up legacy collections and indexes...');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📋 Found collections:', collections.map(c => c.name));
    
    // Drop organization-related collections completely
    const orgCollections = ['organizations', 'orgs', 'testorgs', 'Organization'];
    
    for (const collectionName of orgCollections) {
      try {
        const collectionExists = collections.some(c => c.name === collectionName);
        if (collectionExists) {
          await db.collection(collectionName).drop();
          console.log(`✅ Dropped collection: ${collectionName}`);
        }
      } catch (error) {
        console.log(`ℹ️  Collection ${collectionName} doesn't exist or already dropped`);
      }
    }
    
    // Create fresh organizations collection with proper indexes
    console.log('🆕 Creating fresh organizations collection...');
    const orgsCollection = db.collection('organizations');
    
    // Create indexes for UUID-first architecture
    await orgsCollection.createIndex({ uuid: 1 }, { unique: true });
    await orgsCollection.createIndex({ slug: 1 }, { unique: true });
    await orgsCollection.createIndex({ isActive: 1 });
    await orgsCollection.createIndex({ displayName: 1 }); // Non-unique for display
    await orgsCollection.createIndex({ createdAt: -1 });
    
    console.log('✅ Created proper indexes for UUID-first architecture:');
    console.log('  - uuid (unique)');
    console.log('  - slug (unique)');
    console.log('  - isActive');
    console.log('  - displayName (non-unique)');
    console.log('  - createdAt');
    
    console.log('🎉 Database cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

// Run cleanup
cleanupDatabase().then(() => {
  console.log('✨ Ready for clean organization creation!');
  process.exit(0);
});
