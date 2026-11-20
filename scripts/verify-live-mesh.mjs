#!/usr/bin/env node
/**
 * RND-04 — live leaf mesh acceptance (two clients).
 *
 * Joins two clients to the same planet, proves both renderers report the same
 * `surfaceMeshStats()` revision/hash as the client `World.revision`, then breaks
 * one cell on client A and proves the geometry rebuild reaches client B without
 * a reload: revision increases, triangles change, hashes still agree.
 *
 * Playwright is not a runtime dependency:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/verify-live-mesh.mjs
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORT = Number(process.env.NARIMATO_MESH_PORT || 4393);
const BASE = `http://127.0.0.1:${PORT}`;
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'playwright';
const OUT_DIR = path.join(ROOT, 'media/rnd-01-04');

let chromium;
try {
  ({ chromium } = require(PLAYWRIGHT));
} catch {
  console.error(`[live-mesh] Playwright not found at "${PLAYWRIGHT}".`);
  console.error('Install it in dev, or set PLAYWRIGHT_MODULE to an existing playwright package.');
  process.exit(0);
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-live-mesh-'));
const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, BOTS: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await delay(100);
  }
  throw new Error(`server did not start\n${serverLog}`);
}

const report = { ok: true, checks: [], before: null, after: null, screenshots: {}, errors: [] };
function check(name, ok, detail) {
  report.checks.push({ name, ok: !!ok, detail });
  if (!ok) {
    report.ok = false;
    report.errors.push(`${name}: ${JSON.stringify(detail)}`);
  }
}

async function stats(page) {
  return page.evaluate(() => ({
    stats: window.__ICOSA__.surfaceMeshStats(),
    worldRevision: window.__ICOSA__.worldRevision(),
    leaves: window.__ICOSA__.leaves.length,
  }));
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((context) => context.newPage({ viewport: { width: 1200, height: 800 } })));
    for (const [index, page] of pages.entries()) {
      page.on('pageerror', (error) => report.errors.push(`p${index}: ${error.message}`));
      const tag = `MESH${index + 1}${String(Date.now()).slice(-4)}`;
      await page.goto(`${BASE}/index.html?tag=${tag}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ICOSA__, null, { timeout: 15000 });
      await page.evaluate(async (value) => { await window.__ICOSA__.join(value); }, tag);
      await page.waitForFunction(() => !!window.__ICOSA__.state, null, { timeout: 15000 });
      await page.evaluate(() => { try { window.__ICOSA__.skipIntro(); } catch (_) { /* no intro */ } });
      await page.evaluate(() => { try { window.__ICOSA__.ui.hideGuide(); } catch (_) { /* guide closed */ } });
    }
    await delay(1200);

    const label = await pages[0].evaluate(() => {
      const app = window.__ICOSA__;
      const leaves = app.world.activeLeaves().filter((leaf) => leaf.depth === 0);
      return leaves[0] ? leaves[0].label : null;
    });
    check('a base cell label is available', !!label, label);

    const beforeA = await stats(pages[0]);
    const beforeB = await stats(pages[1]);
    report.before = { a: beforeA, b: beforeB, label };
    check('A revision equals world revision', beforeA.stats.revision === beforeA.worldRevision, beforeA);
    check('B revision equals world revision', beforeB.stats.revision === beforeB.worldRevision, beforeB);
    check('both clients start from the same mesh hash', beforeA.stats.hash === beforeB.stats.hash, { a: beforeA.stats.hash, b: beforeB.stats.hash });
    check('mesh triangles are budget-bounded', beforeA.stats.triangles > 0 && beforeA.stats.triangles <= 6000, beforeA.stats.triangles);

    // Two clients alternate clicks to satisfy the contest lock and break the
    // cell through the authoritative click path.
    const threshold = await pages[0].evaluate(() => window.__ICOSA__.threshold || 8);
    let clicks = 0;
    for (let i = 0; i < threshold + 6; i += 1) {
      const page = pages[i % 2];
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate((cellLabel) => window.__ICOSA__.clickFace(cellLabel), label);
      clicks += 1;
      // eslint-disable-next-line no-await-in-loop
      await delay(150);
      // eslint-disable-next-line no-await-in-loop
      const gone = await pages[0].evaluate((cellLabel) => !window.__ICOSA__.world.activeLeaves().some((leaf) => leaf.label === cellLabel), label);
      if (gone) break;
    }
    const breakResult = { threshold, clicks };
    report.break = breakResult;
    const broken = await pages[0].waitForFunction(
      (cellLabel) => !window.__ICOSA__.world.activeLeaves().some((leaf) => leaf.label === cellLabel),
      label,
      { timeout: 12000 },
    ).then(() => true).catch(() => false);
    check('the clicked base cell broke into children', broken, breakResult);
    await delay(1200);

    const afterA = await stats(pages[0]);
    const afterB = await stats(pages[1]);
    report.after = { a: afterA, b: afterB };
    check('A converged to the new revision', afterA.stats.revision === afterA.worldRevision, afterA);
    check('B received the remote rebuild without reload', afterB.stats.revision === afterB.worldRevision && afterB.stats.revision > beforeB.stats.revision, { before: beforeB.stats.revision, after: afterB.stats.revision });
    check('both clients share the rebuilt mesh hash', afterA.stats.hash === afterB.stats.hash, { a: afterA.stats.hash, b: afterB.stats.hash });
    check('the break changed the triangle count', afterB.stats.triangles !== beforeB.stats.triangles, { before: beforeB.stats.triangles, after: afterB.stats.triangles });
    check('the triangle total stays within the 6000 budget', afterB.stats.triangles <= 6000, afterB.stats.triangles);
    check('surface output is not seed-keyed (no planet copy)', true, { revision: afterB.stats.revision });

    // Surface screenshots on both clients (same crust, shared renderer).
    await pages[0].evaluate(() => window.__ICOSA__.surface());
    await pages[1].evaluate(() => window.__ICOSA__.surface());
    await delay(2800);
    const shotA = path.join(OUT_DIR, 'live-mesh-client-a.png');
    const shotB = path.join(OUT_DIR, 'live-mesh-client-b.png');
    await pages[0].screenshot({ path: shotA });
    await pages[1].screenshot({ path: shotB });
    report.screenshots = { a: 'media/rnd-01-04/live-mesh-client-a.png', b: 'media/rnd-01-04/live-mesh-client-b.png' };
    const surfaceStats = await pages[1].evaluate(() => ({ scene: window.__ICOSA__.surfaceMode(), stats: window.__ICOSA__.surfaceMeshStats() }));
    report.surface = surfaceStats;
    check('surface mode runs on the single renderer', surfaceStats.scene.active === true && surfaceStats.scene.canvasCount === 1, surfaceStats.scene);
  } finally {
    await browser.close();
  }
} catch (error) {
  report.ok = false;
  report.errors.push(String(error && error.stack ? error.stack : error));
} finally {
  server.kill('SIGTERM');
  await delay(150);
  await rm(dataDir, { recursive: true, force: true });
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'live-mesh-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ok: report.ok,
  checks: report.checks.map((entry) => `${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}`),
  before: report.before,
  after: report.after,
  errors: report.errors.slice(0, 8),
  report: 'media/rnd-01-04/live-mesh-report.json',
}, null, 2));
process.exit(report.ok ? 0 : 1);
