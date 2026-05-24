#!/usr/bin/env node
require('./load-env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PORTS } = require('../lib/intelligence/constants');
const { routeOperatorApi } = require('./lib/operator-api');
const { connectMaster } = require('../lib/db');

const UI_DIR = path.join(__dirname, 'local-operator');
const UI_PATH = path.join(UI_DIR, 'index.html');
const BUNDLE_PATH = path.join(UI_DIR, 'bundle.js');
const BUNDLE_CSS_PATH = path.join(UI_DIR, 'bundle.css');

function ensureOperatorBundle() {
  if (fs.existsSync(BUNDLE_PATH)) return;
  console.log('📦 Operator bundle missing — building…');
  execSync('node scripts/build-operator-ui.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
}

ensureOperatorBundle();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTS.STATUS}`);
  const pathname = url.pathname;

  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(UI_PATH, 'utf8'));
    return;
  }

  if (pathname === '/bundle.js' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(fs.readFileSync(BUNDLE_PATH));
    return;
  }

  if (pathname === '/bundle.css' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
    res.end(fs.readFileSync(BUNDLE_CSS_PATH));
    return;
  }

  if (pathname.startsWith('/api/')) {
    await routeOperatorApi(req, res, pathname);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

async function main() {
  await connectMaster();
  server.listen(PORTS.STATUS, '127.0.0.1', () => {
    console.log(`🖥️  Local operator console: http://127.0.0.1:${PORTS.STATUS}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
