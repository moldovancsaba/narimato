const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function migrateNameToDisplayName() {
  try {
    // Get MongoDB URI for master database
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('🔗 Connecting to master database...');
    const masterConnection = await mongoose.createConnection(masterUri);
    
    // Get the organizations collection directly
    const organizationsCollection = masterConnection.db.collection('organizations');
    
    // Check current state
    const orgsBefore = await organizationsCollection.find({}).toArray();
    console.log('📊 Organizations before migration:');
    orgsBefore.forEach(org => {
      console.log(`  - UUID: ${org.uuid}`);
      console.log(`    Name: ${org.name || 'undefined'}`);
      console.log(`    DisplayName: ${org.displayName || 'undefined'}`);
      console.log(`    Slug: ${org.slug}`);
      console.log('');
    });
    
    // Update all organizations that have 'name' field but no 'displayName' field
    const updateResult = await organizationsCollection.updateMany(
      { 
        name: { $exists: true },
        displayName: { $exists: false }
      },
      [
        {
          $addFields: {
            displayName: "$name"
          }
        },
        {
          $unset: "name"
        }
      ]
    );
    
    console.log(`✅ Migration completed!`);
    console.log(`   Modified ${updateResult.modifiedCount} documents`);
    console.log(`   Matched ${updateResult.matchedCount} documents`);
    
    // Verify the migration
    const orgsAfter = await organizationsCollection.find({}).toArray();
    console.log('\n📊 Organizations after migration:');
    orgsAfter.forEach(org => {
      console.log(`  - UUID: ${org.uuid}`);
      console.log(`    Name: ${org.name || 'undefined'}`);
      console.log(`    DisplayName: ${org.displayName || 'undefined'}`);
      console.log(`    Slug: ${org.slug}`);
      console.log('');
    });
    
    await masterConnection.close();
    console.log('🔌 Connection closed');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

migrateNameToDisplayName();
