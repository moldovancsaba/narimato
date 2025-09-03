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

async function recreateOrganization() {
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
    
    console.log('🗑️ Deleting existing organization with slug "moldovan"...');
    const deleteResult = await Organization.deleteMany({ slug: 'moldovan' });
    console.log(`✅ Deleted ${deleteResult.deletedCount} organization(s)`);
    
    // Create your organization in master database
    const orgUUID = 'mcszszcs-oooo-0707-1975-moldovan0707';
    console.log('🏗️ Creating new organization...');
    
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
    
    // Verify the creation
    const created = await Organization.findOne({ slug: 'moldovan' });
    console.log('\n📊 New organization details:');
    console.log(`   UUID: ${created.uuid}`);
    console.log(`   DisplayName: ${created.displayName}`);
    console.log(`   Slug: ${created.slug}`);
    console.log(`   Database: ${created.databaseName}`);
    console.log(`   IsActive: ${created.isActive}`);
    console.log(`   Settings: ${JSON.stringify(created.settings, null, 2)}`);
    
    // Verify setup
    const orgCount = await Organization.countDocuments();
    const activeOrgs = await Organization.countDocuments({ isActive: true });
    
    console.log(`\n🎉 Organization recreation complete!`);
    console.log(`📊 Total organizations: ${orgCount}`);
    console.log(`✅ Active organizations: ${activeOrgs}`);
    console.log(`🏢 Your organization: ${created.displayName} (${created.slug})`);
    console.log(`💾 Organization database: ${created.databaseName}`);
    console.log(`🌐 Master database: narimato`);
    
    await masterConnection.close();
    
  } catch (error) {
    console.error('❌ Error recreating organization:', error);
    process.exit(1);
  }
}

recreateOrganization();
