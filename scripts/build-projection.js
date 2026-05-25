#!/usr/bin/env node
/**
 * Build intelligence projection for an org from current approved cards (no LLM).
 * Usage: node scripts/build-projection.js <organizationId>
 *    or: npm run intelligence:refresh-projection -- --org=<organizationId>
 */
require('./load-env');
const { connectMaster } = require('../lib/db');
const { withOrganization } = require('../lib/tenantContext');
const { refreshOrgProjection } = require('../lib/intelligence/projectionBuilder');
const { clearOrgDirty } = require('../lib/intelligence/dirtyQueue');

async function refreshProjectionForOrg(organizationId) {
  await connectMaster();
  let projection;
  await withOrganization(organizationId, async () => {
    const { getTenantModels } = require('../lib/tenantContext');
    projection = await refreshOrgProjection(organizationId, getTenantModels());
  });
  await clearOrgDirty(organizationId);
  return projection;
}

async function main() {
  const organizationId = process.argv[2];
  if (!organizationId) {
    console.error('Usage: node scripts/build-projection.js <organizationId>');
    process.exit(1);
  }
  const projection = await refreshProjectionForOrg(organizationId);
  console.log(
    JSON.stringify(
      { builtAt: projection.builtAt, cards: projection.cards.length, decks: projection.decks.length },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { refreshProjectionForOrg };
