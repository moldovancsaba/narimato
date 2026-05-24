#!/usr/bin/env node
/** Backfill approvalStatus=approved on legacy cards missing the field. */
require('./load-env');
const { connectMaster, getMasterOrganizationModel, getOrgConnection, getOrganizationDatabaseName } = require('../lib/db');
const { registerOrgModels } = require('../lib/models/registry');

async function main() {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  const orgs = await Organization.find({ isActive: true });
  let total = 0;
  for (const org of orgs) {
    const conn = await getOrgConnection(getOrganizationDatabaseName(org));
    const { Card } = registerOrgModels(conn);
    const res = await Card.updateMany(
      { approvalStatus: { $exists: false } },
      { $set: { approvalStatus: 'approved', source: 'manual' } }
    );
    if (res.modifiedCount) {
      console.log(`${org.slug}: backfilled ${res.modifiedCount} cards`);
      total += res.modifiedCount;
    }
  }
  console.log(`Done. ${total} cards updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
