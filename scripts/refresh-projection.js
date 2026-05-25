#!/usr/bin/env node
/**
 * CLI alias for projection refresh (no LLM).
 * Usage: node scripts/refresh-projection.js --org=<organizationId>
 */
require('./load-env');
const { refreshProjectionForOrg } = require('./build-projection');

async function main() {
  const orgArg = process.argv.find((a) => a.startsWith('--org='));
  const organizationId = orgArg ? orgArg.split('=')[1] : process.argv[2];
  if (!organizationId) {
    console.error('Usage: node scripts/refresh-projection.js --org=<organizationId>');
    process.exit(1);
  }
  const projection = await refreshProjectionForOrg(organizationId);
  console.log(
    JSON.stringify(
      { organizationId, builtAt: projection.builtAt, cards: projection.cards.length, decks: projection.decks.length },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
