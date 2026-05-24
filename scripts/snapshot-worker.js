#!/usr/bin/env node
require('./load-env');
const http = require('http');
const { PORTS } = require('../lib/intelligence/constants');
const { getDirtyState, clearOrgDirty, setWorkerHeartbeat } = require('../lib/intelligence/dirtyQueue');
const { refreshOrgProjection } = require('../lib/intelligence/projectionBuilder');
const { withOrganization } = require('../lib/tenantContext');
const { connectMaster } = require('../lib/db');

const POLL_MS = Number(process.env.INTELLIGENCE_SNAPSHOT_POLL_MS || 5000);
let lastRefresh = null;
let lastError = null;

async function refreshDirtyOrgs() {
  const dirty = await getDirtyState();
  const orgIds = dirty.orgIds || [];
  for (const organizationId of orgIds) {
    try {
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../lib/tenantContext');
        const models = getTenantModels();
        const projection = await refreshOrgProjection(organizationId, models);
        lastRefresh = {
          organizationId,
          builtAt: projection.builtAt,
          cardCount: projection.cards.length,
          at: new Date().toISOString(),
        };
        console.log(`📸 Projection refreshed for ${organizationId} (${projection.cards.length} cards)`);
      });
      await clearOrgDirty(organizationId);
      lastError = null;
    } catch (err) {
      lastError = err.message;
      console.error(`Snapshot refresh failed for ${organizationId}:`, err.message);
    }
  }
}

async function tick() {
  try {
    await setWorkerHeartbeat('snapshot-worker', { lastRefresh, lastError });
    await refreshDirtyOrgs();
  } catch (err) {
    lastError = err.message;
    console.error('Snapshot worker tick error:', err.message);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, lastRefresh, lastError, port: PORTS.SNAPSHOT }));
    return;
  }
  if (req.url === '/force' && req.method === 'POST') {
    tick()
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, lastRefresh }));
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }
  res.writeHead(404);
  res.end();
});

async function main() {
  await connectMaster();
  server.listen(PORTS.SNAPSHOT, '127.0.0.1', () => {
    console.log(`📸 snapshot-worker on 127.0.0.1:${PORTS.SNAPSHOT}`);
  });
  setInterval(tick, POLL_MS);
  await tick();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
