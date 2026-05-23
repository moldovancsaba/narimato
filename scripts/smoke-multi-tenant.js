/**
 * Smoke test: master connection, org resolution, per-org Card access.
 * Run: node scripts/smoke-multi-tenant.js
 */
require('./load-env');
const { connectMaster, getMasterOrganizationModel } = require('../lib/db');
const { withOrganization } = require('../lib/tenantContext');
const Card = require('../lib/models/Card');
const { resolvePlayOrganizationId } = require('../lib/playSessionIndex');

async function main() {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  const orgs = await Organization.find({ isActive: true }).sort({ slug: 1 });

  if (!orgs.length) {
    console.error('No organizations in master DB');
    process.exit(1);
  }

  console.log(`Organizations: ${orgs.length}`);
  for (const org of orgs) {
    const dbName = org.databaseName || org.uuid;
    const cardCount = await withOrganization(org.uuid, () =>
      Card.countDocuments({ organizationId: org.uuid, isActive: true })
    );
    console.log(`  ${org.slug} (${org.uuid}) db=${dbName} activeCards=${cardCount}`);
  }

  const PlaySessionIndex = require('../lib/db').getMasterPlaySessionIndexModel();
  const indexCount = await PlaySessionIndex.countDocuments();
  console.log(`PlaySessionIndex entries: ${indexCount}`);

  if (indexCount > 0) {
    const sample = await PlaySessionIndex.findOne().sort({ updatedAt: -1 });
    const resolved = await resolvePlayOrganizationId(sample.playId);
    console.log(
      `Latest playId ${sample.playId} → org ${resolved} (expected ${sample.organizationId})`
    );
    if (resolved !== sample.organizationId) {
      console.error('PlaySessionIndex resolution mismatch');
      process.exit(1);
    }
  }

  console.log('Smoke test passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
