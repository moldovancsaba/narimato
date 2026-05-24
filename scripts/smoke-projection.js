#!/usr/bin/env node
/** Smoke: build projection and verify reader for first active org. */
require('./load-env');
const { connectMaster, getMasterOrganizationModel } = require('../lib/db');
const { withOrganization } = require('../lib/tenantContext');
const { refreshOrgProjection } = require('../lib/intelligence/projectionBuilder');
const { getProjectedDecks } = require('../lib/intelligence/projectionReader');

async function main() {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  const org = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!org) {
    console.error('No active organization');
    process.exit(1);
  }

  await withOrganization(org.uuid, async () => {
    const { getTenantModels } = require('../lib/tenantContext');
    const models = getTenantModels();
    const projection = await refreshOrgProjection(org.uuid, models);
    const { decks, source, freshness } = await getProjectedDecks(org.uuid, models);
    console.log(JSON.stringify({
      org: org.slug,
      cards: projection.cards.length,
      decks: decks.length,
      source,
      freshness,
      ok: true,
    }, null, 2));
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
