#!/usr/bin/env node
/**
 * Build intelligence projection for an org from current approved cards (no LLM).
 * Usage: node scripts/build-projection.js <organizationId>
 */
require('./load-env');
const { connectMaster } = require('../lib/db');
const { withOrganization } = require('../lib/tenantContext');
const { refreshOrgProjection } = require('../lib/intelligence/projectionBuilder');
const { clearOrgDirty } = require('../lib/intelligence/dirtyQueue');

async function main() {
  const organizationId = process.argv[2];
  if (!organizationId) {
    console.error('Usage: node scripts/build-projection.js <organizationId>');
    process.exit(1);
  }
  await connectMaster();
  let projection;
  await withOrganization(organizationId, async () => {
    const { getTenantModels } = require('../lib/tenantContext');
    projection = await refreshOrgProjection(organizationId, getTenantModels());
  });
  await clearOrgDirty(organizationId);
  console.log(JSON.stringify({ builtAt: projection.builtAt, cards: projection.cards.length, decks: projection.decks.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
