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
const ENTRY_PATH = path.join(UI_DIR, 'entry.jsx');
const BUILD_SCRIPT = path.join(__dirname, 'build-operator-ui.js');
const REPO_ROOT = path.join(__dirname, '..');

function newestMtimeMs(paths) {
  return paths.reduce((max, p) => {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        return Math.max(max, newestMtimeMs(fs.readdirSync(p).map((name) => path.join(p, name))));
      }
      return Math.max(max, stat.mtimeMs);
    } catch {
      return max;
    }
  }, 0);
}

function operatorSourcesStale(bundleMtimeMs) {
  const watchPaths = [
    ENTRY_PATH,
    BUILD_SCRIPT,
    path.join(REPO_ROOT, 'components', 'NarimatoProviders.js'),
    path.join(REPO_ROOT, 'components', 'NarimatoSemanticButton.js'),
    path.join(REPO_ROOT, 'components', 'NarimatoMetricCard.js'),
    path.join(REPO_ROOT, 'components', 'NarimatoThemeToggle.js'),
    path.join(REPO_ROOT, 'components', 'operator'),
    path.join(REPO_ROOT, 'lib', 'ui', 'narimatoTheme.js'),
    path.join(REPO_ROOT, 'packages', 'gds-core', 'dist'),
    path.join(REPO_ROOT, 'packages', 'gds-theme', 'dist'),
  ];
  return newestMtimeMs(watchPaths) > bundleMtimeMs;
}

function ensureOperatorBundle() {
  const hasBundle = fs.existsSync(BUNDLE_PATH) && fs.existsSync(BUNDLE_CSS_PATH);
  const bundleMtimeMs = hasBundle ? fs.statSync(BUNDLE_PATH).mtimeMs : 0;
  const stale = hasBundle && operatorSourcesStale(bundleMtimeMs);
  if (hasBundle && !stale) return;

  console.log(hasBundle ? '📦 Operator UI sources changed — rebuilding…' : '📦 Operator bundle missing — building…');
  execSync('node scripts/build-operator-ui.js', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
}

ensureOperatorBundle();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTS.STATUS}`);
  const pathname = url.pathname;

  if (pathname === '/' && req.method === 'GET') {
    if (!fs.existsSync(BUNDLE_PATH) || !fs.existsSync(BUNDLE_CSS_PATH)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Operator UI bundle missing. Run: npm run build:operator');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(UI_PATH, 'utf8'));
    return;
  }

  if (pathname === '/bundle.js' && req.method === 'GET') {
    if (!fs.existsSync(BUNDLE_PATH)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('bundle.js not found — run npm run build:operator');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(fs.readFileSync(BUNDLE_PATH));
    return;
  }

  if (pathname === '/bundle.css' && req.method === 'GET') {
    if (!fs.existsSync(BUNDLE_CSS_PATH)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('bundle.css not found — run npm run build:operator');
      return;
    }
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
    console.log(`🖥️  Local operator console: http://127.0.0.1:${PORTS.STATUS} (GDS React UI)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
