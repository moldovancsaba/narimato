require('./load-env');
const { connectMaster, buildOrgMongoUri } = require('../lib/db');
const { registerOrganizationModel } = require('../lib/models/Organization');

const DEFAULT_ORG = {
  uuid: 'mcszszcs-oooo-0707-1975-moldovan0707',
  name: 'Moldován Csaba Kft',
  slug: 'moldovan',
};

async function initializeDatabases() {
  try {
    const masterUri = process.env.MONGODB_URI;
    if (!masterUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('🗄️ Setting up Narimato database architecture...');
    console.log('🔗 Connecting to master database (narimato)...');
    const masterConnection = await connectMaster();
    const Organization = registerOrganizationModel(masterConnection);

    console.log('🏢 Setting up organization in master database...');
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

    const dbName = existing.databaseName || existing.uuid;
    const orgUri = buildOrgMongoUri(masterUri, dbName);
    console.log('\n📊 Organization database URI ready:', orgUri.replace(/\/\/[^@]+@/, '//<credentials>@'));

    console.log('\n🎉 Database setup complete!');
    console.log('🗄️ Master Database (narimato):');
    console.log('   ✅ Organizations collection');
    console.log(`   🏢 ${existing.name} (${existing.slug})`);
    console.log(`\n📊 Organization Database (${dbName}):`);
    console.log('   ✅ Created on first application access');

    await masterConnection.close();
    console.log('\n🔌 Connection closed');
    console.log('\n🚀 Ready to start the application!');
    console.log('   Run: npm run dev');
    console.log('   Visit: http://localhost:3000/organization/moldovan/cards');
  } catch (error) {
    console.error('❌ Error setting up databases:', error);
    process.exit(1);
  }
}

initializeDatabases();
