/**
 * One-time: set databaseName on master organizations missing it (defaults to uuid).
 * Run: node scripts/backfill-org-database-name.js
 */
require('dotenv').config({ path: '.env.local' });
const { connectMaster, getMasterOrganizationModel } = require('../lib/db');

async function main() {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  const orgs = await Organization.find({
    $or: [{ databaseName: { $exists: false } }, { databaseName: null }, { databaseName: '' }],
  });
  let updated = 0;
  for (const org of orgs) {
    org.databaseName = org.uuid;
    await org.save();
    updated += 1;
    console.log(`Updated ${org.slug} → databaseName=${org.databaseName}`);
  }
  console.log(`Done. Updated ${updated} organization(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
