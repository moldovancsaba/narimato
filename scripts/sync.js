#!/usr/bin/env node
require('./load-env');
const http = require('http');
const { PORTS } = require('../lib/intelligence/constants');
const { claimNextJob, completeJob, failJob } = require('../lib/intelligence/jobQueue');
const { handleJob } = require('../lib/intelligence/jobHandlers');
const { setWorkerHeartbeat } = require('../lib/intelligence/dirtyQueue');
const { connectMaster } = require('../lib/db');

const POLL_MS = Number(process.env.INTELLIGENCE_SYNC_POLL_MS || 3000);
let running = false;
let lastError = null;
let lastJob = null;

async function processOneJob() {
  if (running) return;
  const job = await claimNextJob();
  if (!job) return;
  running = true;
  lastJob = { uuid: job.uuid, type: job.type, at: new Date().toISOString() };
  try {
    const result = await handleJob(job);
    await completeJob(job.uuid, result);
    lastError = null;
    console.log(`✅ Job ${job.uuid} (${job.type}) completed`);
  } catch (err) {
    lastError = err.message;
    await failJob(job.uuid, err.message);
    console.error(`❌ Job ${job.uuid} failed:`, err.message);
  } finally {
    running = false;
  }
}

async function tick() {
  try {
    await setWorkerHeartbeat('sync', { running, lastJob, lastError });
    await processOneJob();
  } catch (err) {
    console.error('Sync tick error:', err.message);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running, lastJob, lastError, port: PORTS.SYNC }));
    return;
  }
  res.writeHead(404);
  res.end();
});

async function main() {
  await connectMaster();
  server.listen(PORTS.SYNC, '127.0.0.1', () => {
    console.log(`🔄 sync.js listening on 127.0.0.1:${PORTS.SYNC}`);
  });
  setInterval(tick, POLL_MS);
  await tick();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
