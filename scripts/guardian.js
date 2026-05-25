#!/usr/bin/env node
require('./load-env');
const { spawn } = require('child_process');
const path = require('path');
const { connectMaster } = require('../lib/db');
const { setWorkerHeartbeat } = require('../lib/intelligence/dirtyQueue');

const procs = [
  { name: 'sync', script: 'sync.js' },
  { name: 'snapshot-worker', script: 'snapshot-worker.js' },
  { name: 'status-server', script: 'status-server.js' },
];

const children = new Map();
const restartCounts = new Map();
const HEARTBEAT_MS = Number(process.env.INTELLIGENCE_GUARDIAN_HEARTBEAT_MS || 15000);
const MAX_RESTART_DELAY_MS = 30000;

function restartDelay(name) {
  const n = (restartCounts.get(name) || 0) + 1;
  restartCounts.set(name, n);
  return Math.min(2000 * n, MAX_RESTART_DELAY_MS);
}

function startOne(def) {
  const scriptPath = path.join(__dirname, def.script);
  const interactive = process.stdout.isTTY;
  const child = spawn(process.execPath, [scriptPath], {
    stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
  if (!interactive) {
    child.stdout?.on('data', (chunk) => {
      process.stdout.write(`[${def.name}] ${chunk}`);
    });
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[${def.name}] ${chunk}`);
    });
  }
  children.set(def.name, { child, pid: child.pid, startedAt: new Date().toISOString() });
  child.on('exit', (code, signal) => {
    const delay = restartDelay(def.name);
    console.warn(
      `⚠️  ${def.name} exited (code=${code}, signal=${signal}); restarting in ${delay}ms`
    );
    children.delete(def.name);
    setTimeout(() => startOne(def), delay);
  });
}

function childSnapshot() {
  return Object.fromEntries(
    [...children.entries()].map(([name, meta]) => [
      name,
      { pid: meta.pid, startedAt: meta.startedAt },
    ])
  );
}

async function writeGuardianHeartbeat() {
  try {
    await connectMaster();
    await setWorkerHeartbeat('guardian', {
      running: true,
      children: childSnapshot(),
      restartCounts: Object.fromEntries(restartCounts),
    });
  } catch (err) {
    console.warn('Guardian heartbeat failed:', err.message);
  }
}

function shutdown() {
  for (const { child } of children.values()) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('🛡️  guardian starting local intelligence processes…');
console.log('   Install at login: npm run intelligence:install');
for (const def of procs) {
  startOne(def);
}

writeGuardianHeartbeat();
setInterval(writeGuardianHeartbeat, HEARTBEAT_MS);
