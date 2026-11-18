#!/usr/bin/env node
/**
 * A4 — optional axe-core accessibility audit (dev-only).
 *
 *   npm install --no-save axe-core
 *   PLAYWRIGHT_MODULE=/path/to/playwright AXE_PATH=./node_modules/axe-core/axe.min.js \
 *     node scripts/audit-a11y.mjs
 *
 * Fails on serious/critical axe violations. Playwright and axe-core are not
 * runtime dependencies.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'playwright';
const ENGINE = process.env.PLAYWRIGHT_ENGINE || 'chromium';
const AXE_PATH = process.env.AXE_PATH || path.join(ROOT, 'node_modules/axe-core/axe.min.js');
const PORT = Number(process.env.NARIMATO_A11Y_PORT || 4396);
const BASE = `http://127.0.0.1:${PORT}`;
let chromium;
let webkit;
let firefox;
try { ({ chromium, webkit, firefox } = require(PLAYWRIGHT)); } catch { console.error('Playwright required for audit:a11y'); process.exit(0); }
let axeSource;
try { axeSource = await readFile(AXE_PATH, 'utf8'); } catch { console.error(`axe-core not found at ${AXE_PATH}; npm install --no-save axe-core`); process.exit(0); }

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-a11y-'));
const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, BOTS: '0' }, stdio: 'ignore' });
for (let i = 0; i < 80; i += 1) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* wait */ } await delay(150); }

const engine = { chromium, webkit, firefox }[ENGINE] || chromium;
const browser = await engine.launch({ headless: true });
const failures = [];
async function scan(label, viewport, setup) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await delay(600);
  if (setup) await setup(page);
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  }));
  const relevant = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  console.log(`${label}: ${results.violations.length} total, ${relevant.length} serious/critical`);
  for (const v of relevant) {
    failures.push(`${label}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
    for (const node of v.nodes.slice(0, 3)) console.log(`  ${v.id}: ${node.target.join(' ')}`);
  }
  await context.close();
}
try {
  await scan('landing-desktop', { width: 1440, height: 900 });
  await scan('landing-mobile', { width: 390, height: 844 });
  await scan('hud-desktop', { width: 1440, height: 900 }, async (page) => {
    await page.fill('#tag-input', 'AXE1');
    await page.click('#btn-join');
    await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
    await delay(600);
    const brief = await page.$('#landing-brief');
    if (brief && await brief.isVisible()) { await page.click('#btn-landing-brief-start').catch(() => {}); await delay(300); }
  });
  await scan('manual-mobile', { width: 390, height: 844 }, async (page) => {
    await page.fill('#tag-input', 'AXE2');
    await page.click('#btn-join');
    await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
    await delay(500);
    await page.click('#btn-landing-brief-start').catch(() => {});
    await delay(250);
    await page.click('#btn-help');
    await delay(300);
  });
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await delay(300);
  await rm(dataDir, { recursive: true, force: true });
}
if (failures.length) {
  console.error(`\n[a11y] ${failures.length} serious/critical violation(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n[a11y] clean (${ENGINE}; no serious/critical axe violations).`);
