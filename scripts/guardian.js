#!/usr/bin/env node
require('./load-env');
const { spawn } = require('child_process');
const path = require('path');

const procs = [
  { name: 'sync', script: 'sync.js' },
  { name: 'snapshot-worker', script: 'snapshot-worker.js' },
  { name: 'status-server', script: 'status-server.js' },
];

const children = new Map();

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
  children.set(def.name, child);
  child.on('exit', (code, signal) => {
    console.warn(`⚠️  ${def.name} exited (code=${code}, signal=${signal}); restarting in 2s`);
    children.delete(def.name);
    setTimeout(() => startOne(def), 2000);
  });
}

function shutdown() {
  for (const child of children.values()) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('🛡️  guardian starting local intelligence processes...');
for (const def of procs) {
  startOne(def);
}
