const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Organization schema
const organizationSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  databaseName: { type: String, required: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Initialize databases
async function initializeDatabases() {
  try {
    // Get MongoDB connection URI base
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('🗄️ Setting up Narimato database architecture...');
    
    // 1. Connect to the master database (narimato)
    console.log('🔗 Connecting to master database (narimato)...');
    const masterConnection = await mongoose.createConnection(masterUri);
    const Organization = masterConnection.model('Organization', organizationSchema);
    
    // 2. Create organization in master database
    console.log('🏢 Setting up organization in master database...');
    let existing = await Organization.findOne({ slug: 'moldovan' });
    if (existing) {
      console.log('✅ Moldován Csaba Kft organization already exists in master database');
      console.log(`   UUID: ${existing.uuid}`);
      console.log(`   DisplayName: ${existing.displayName}`);
      console.log(`   Slug: ${existing.slug}`);
      console.log(`   Database: ${existing.databaseName}`);
    } else {
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
    
    console.log('📊 Organization database will be created when first accessed by the application');
    
    console.log('\n🎉 Database setup complete!');
    console.log('🗄️ Master Database (narimato):');
    console.log(`   ✅ Organizations collection`);
    console.log(`   🏢 ${existing.displayName} (${existing.slug})`);
    console.log(`\n📊 Organization Database (${existing.databaseName}):`);
    console.log(`   ✅ Will be created automatically when accessed`);
    console.log(`   🃋 Sample cards will be added on first use`);
    
    // Close connections
    await masterConnection.close();
    console.log('\n🔌 All connections closed');
    
    console.log('\n🚀 Ready to start the application!');
    console.log('   Run: npm run dev');
    console.log('   Visit: http://localhost:3000/organization/moldovan/cards');

  } catch (error) {
    console.error('❌ Error initializing databases:', error);
    process.exit(1);
  }
}

initializeDatabases();
