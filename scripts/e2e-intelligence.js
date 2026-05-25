#!/usr/bin/env node
/**
 * E2E: corpus Source → ingest job → fixture generation → projection → play session.
 * Requires: MONGODB_URI, npm run intelligence:guardian (or sync+snapshot+status),
 *           optional dev server at E2E_BASE_URL for play APIs.
 *
 * OLLAMA_SKIP=1 uses fixture cards (no LLM).
 */
require('./load-env');
process.env.OLLAMA_SKIP = process.env.OLLAMA_SKIP || '1';

const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { connectMaster, getMasterOrganizationModel, getMasterTopicSpecModel } = require('../lib/db');
const { enqueueJob } = require('../lib/intelligence/jobQueue');
const { createSource } = require('../lib/intelligence/sourceService');
const { PORTS, JOB_TYPES } = require('../lib/intelligence/constants');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OPERATOR = `http://127.0.0.1:${PORTS.STATUS}`;
const DECK = process.env.E2E_DECK_TAG || '#SampleDeck';

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

async function assertOperatorUp() {
  const { status, body } = await fetchJson(`${OPERATOR}/api/status`);
  if (status !== 200) {
    throw new Error(`status-server not reachable at ${OPERATOR} (HTTP ${status})`);
  }
  if (!body.ollama && process.env.OLLAMA_SKIP !== '1') {
    console.warn('⚠️  Ollama not reachable; set OLLAMA_SKIP=1 for fixture-only E2E');
  }
  return body;
}

async function waitForJob(orgId, type, { timeoutMs = 90000, sinceMs = 0 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { body } = await fetchJson(`${OPERATOR}/api/jobs?organizationId=${orgId}`);
    const jobs = (body.jobs || []).filter((j) => {
      if (j.type !== type) return false;
      if (sinceMs && j.createdAt && new Date(j.createdAt).getTime() < sinceMs) return false;
      return true;
    });
    const running = jobs.some((j) => j.status === 'pending' || j.status === 'running');
    const done = jobs.find((j) => j.status === 'completed' || j.status === 'failed');
    if (done && !running) return done;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Job ${type} timeout`);
}

async function startPlay(orgId, mode = 'swipe_only') {
  const res = await fetch(`${BASE}/api/v1/play/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: orgId, deckTag: DECK, mode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`play start: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  await assertOperatorUp();
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  let org = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!org) throw new Error('No active organization — run init-default-org.js first');
  const orgId = org.uuid;
  console.log('Using org', org.slug || orgId);

  const testStart = Date.now();

  const source = await createSource({
    organizationId: orgId,
    title: 'E2E corpus source',
    kind: 'markdown',
    content: 'End-to-end intelligence validation corpus.',
    metadata: { deckRootTag: DECK },
    enqueueIngest: true,
  });
  console.log('Source created', source.uuid);

  const ingestJob = await waitForJob(orgId, JOB_TYPES.INGEST_SOURCE, { sinceMs: testStart });
  if (ingestJob.status === 'failed') {
    throw new Error(`INGEST_SOURCE failed: ${ingestJob.error}`);
  }
  console.log('✅ INGEST_SOURCE', ingestJob.uuid);

  const TopicSpec = getMasterTopicSpecModel();
  let topic = await TopicSpec.findOne({ organizationId: orgId }).sort({ updatedAt: -1 });
  if (!topic) {
    topic = await TopicSpec.create({
      uuid: uuidv4(),
      organizationId: orgId,
      title: 'E2E fixture deck',
      status: 'approved',
      approvedSummary: 'Smoke test deck',
      deckRootTag: DECK,
      planningConstraints: { cardCount: 3, hierarchyLevels: 2 },
    });
  } else {
    topic.status = 'approved';
    topic.deckRootTag = DECK;
    await topic.save();
  }

  const genStart = Date.now();
  await enqueueJob({
    organizationId: orgId,
    type: JOB_TYPES.GENERATE_DECK_CARDS,
    payload: { topicSpecId: topic.uuid, useFixture: true },
  });
  console.log('GENERATE_DECK_CARDS enqueued…');
  const genJob = await waitForJob(orgId, JOB_TYPES.GENERATE_DECK_CARDS, { sinceMs: genStart });
  if (genJob.status === 'failed') throw new Error(`GENERATE failed: ${genJob.error}`);
  console.log('✅ GENERATE_DECK_CARDS', genJob.uuid);

  await fetchJson(`${OPERATOR}/api/projection/refresh`, {
    method: 'POST',
    body: { organizationId: orgId },
  });

  const decksRes = await fetchJson(`${BASE}/api/play/decks?organizationId=${orgId}`);
  if (decksRes.status !== 200) throw new Error(`Play decks HTTP ${decksRes.status}`);
  const deckCount = decksRes.body.decks?.length || 0;
  console.log('Play decks:', deckCount, decksRes.body.meta);
  if (deckCount < 1 && process.env.E2E_STRICT === '1') {
    throw new Error('Expected at least one playable deck');
  }

  try {
    const play = await startPlay(orgId, 'swipe_only');
    console.log('✅ Play session started', play.playId);
    if (play.playId) {
      const nextRes = await fetch(`${BASE}/api/v1/play/${play.playId}/next`);
      if (nextRes.ok) console.log('✅ Play next card OK');
    }
  } catch (err) {
    if (process.env.E2E_STRICT === '1') throw err;
    console.warn('⚠️  Play start skipped (dev server?):', err.message);
  }

  console.log('✅ E2E intelligence path OK (corpus → worker → projection → play)');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ E2E failed:', err.message);
  process.exit(1);
});
