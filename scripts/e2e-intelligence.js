#!/usr/bin/env node
/**
 * E2E: topic → fixture generation → projection → play decks API.
 * Requires: MONGODB_URI, guardian or sync+snapshot workers, optional OLLAMA_SKIP=1
 */
require('./load-env');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { connectMaster, getMasterOrganizationModel, getMasterTopicSpecModel } = require('../lib/db');
const { enqueueJob } = require('../lib/intelligence/jobQueue');
const { PORTS, JOB_TYPES } = require('../lib/intelligence/constants');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OPERATOR = `http://127.0.0.1:${PORTS.STATUS}`;

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

async function waitForJob(orgId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { body } = await fetchJson(`${OPERATOR}/api/jobs?organizationId=${orgId}`);
    const done = (body.jobs || []).find((j) => j.status === 'completed' || j.status === 'failed');
    if (done) return done;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Job timeout');
}

async function main() {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  let org = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!org) throw new Error('No active organization — run init-default-org.js first');
  const orgId = org.uuid;
  console.log('Using org', orgId);

  const TopicSpec = getMasterTopicSpecModel();
  const topic = await TopicSpec.create({
    uuid: uuidv4(),
    organizationId: orgId,
    title: 'E2E fixture deck',
    status: 'approved',
    approvedSummary: 'Smoke test deck',
    deckRootTag: '#SampleDeck',
    planningConstraints: { cardCount: 3, hierarchyLevels: 2 },
  });

  await enqueueJob({
    organizationId: orgId,
    type: JOB_TYPES.GENERATE_DECK_CARDS,
    payload: { topicSpecId: topic.uuid, useFixture: true },
  });
  console.log('Job enqueued; waiting for sync worker…');
  const job = await waitForJob(orgId);
  if (job.status === 'failed') throw new Error(`Job failed: ${job.error}`);

  await fetchJson(`${OPERATOR}/api/projection/refresh`, { method: 'POST', body: { organizationId: orgId } });

  const decksRes = await fetchJson(`${BASE}/api/play/decks?organizationId=${orgId}`);
  if (decksRes.status !== 200) throw new Error(`Play decks HTTP ${decksRes.status}`);
  const deckCount = decksRes.body.decks?.length || 0;
  console.log('Play decks:', deckCount, decksRes.body.meta);
  if (deckCount < 1 && process.env.E2E_STRICT === '1') {
    throw new Error('Expected at least one playable deck');
  }
  console.log('✅ E2E intelligence path OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ E2E failed:', err.message);
  process.exit(1);
});
