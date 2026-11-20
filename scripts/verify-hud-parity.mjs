#!/usr/bin/env node
/**
 * RND-03 — HUD parity acceptance.
 *
 * Proves one mounted HUD tree serves orbit and surface: the ordered
 * `data-hud-node` id list is captured before, during and 500 ms after surface
 * entry, then compared with the parity contract in `shared/hud-parity.js`.
 * Surface may only add `surface-*` nodes; every orbital node must keep its
 * identity. Writes `media/hud-parity/report.json`.
 *
 * Playwright is not a runtime dependency:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/verify-hud-parity.mjs
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { ALL_HUD_NODES, parity } from '../public/js/shared/hud-parity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORT = Number(process.env.NARIMATO_PARITY_PORT || 4392);
const BASE = `http://127.0.0.1:${PORT}`;
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'playwright';
const OUT_DIR = path.join(ROOT, 'media/hud-parity');
const VIEWPORTS = [[1200, 800, 'desktop'], [390, 844, 'mobile']];

let chromium;
try {
  ({ chromium } = require(PLAYWRIGHT));
} catch {
  console.error(`[hud-parity] Playwright not found at "${PLAYWRIGHT}".`);
  console.error('Install it in dev, or set PLAYWRIGHT_MODULE to an existing playwright package.');
  process.exit(0);
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-hud-parity-'));
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

const report = { ok: true, checks: [], phases: {}, parity: null, accessibility: {}, errors: [] };
function check(name, ok, detail) {
  report.checks.push({ name, ok: !!ok, detail });
  if (!ok) {
    report.ok = false;
    report.errors.push(`${name}: ${JSON.stringify(detail)}`);
  }
}

async function snapshot(page) {
  return page.evaluate(() => {
    const app = window.__ICOSA__;
    return {
      hud: app.hudSnapshot(),
      scene: app.surfaceMode(),
      renderer: !!app.renderer,
      mode: document.getElementById('hud')?.dataset.mode,
      activeElement: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute('data-hud-node') || document.activeElement.tagName),
      targetText: document.getElementById('surface-target')?.textContent || null,
      targetLive: document.getElementById('surface-target')?.getAttribute('aria-live') || null,
      lapNow: document.getElementById('surface-lap')?.getAttribute('aria-valuenow') || null,
      pads: [...document.querySelectorAll('[data-surface-hold]')].map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.getAttribute('aria-label'),
          ariaDisabled: button.getAttribute('aria-disabled'),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    };
  });
}

async function a11y(page) {
  try {
    const aria = await page.locator('#hud').ariaSnapshot();
    return { aria, length: aria.length, roles: (aria.match(/^\s*-\s+\w+/gm) || []).length };
  } catch (error) {
    return { aria: '', length: 0, error: String(error && error.message ? error.message : error) };
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    for (const [width, height, label] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (error) => report.errors.push(`pageerror(${label}): ${error.message}`));
      const tag = `PAR${String(Date.now()).slice(-6)}`;
      await page.goto(`${BASE}/index.html?tag=${tag}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ICOSA__, null, { timeout: 15000 });
      await page.evaluate(async (value) => { await window.__ICOSA__.join(value); }, tag);
      await page.waitForFunction(() => !!window.__ICOSA__.state, null, { timeout: 15000 });
      await page.evaluate(() => { try { window.__ICOSA__.skipIntro(); } catch (_) { /* no intro */ } });
      await page.evaluate(() => { try { window.__ICOSA__.ui.hideGuide(); } catch (_) { /* guide closed */ } });
      await delay(900);

      const before = await snapshot(page);
      const beforeA11y = await a11y(page);

      await page.evaluate(() => window.__ICOSA__.surface());
      await delay(500);
      const during = await snapshot(page);
      const duringA11y = await a11y(page);

      // Keyboard-only move, then leave through the exit control.
      await page.keyboard.down('w');
      await delay(280);
      await page.keyboard.up('w');
      await page.evaluate(() => document.getElementById('btn-surface-exit').click());
      await delay(2200);
      const after = await snapshot(page);
      const afterA11y = await a11y(page);

      const compare = parity(before.hud, during.hud, after.hud);
      report.phases[label] = { before, during, after };
      report.parity = compare;
      report.accessibility[label] = { before: beforeA11y, during: duringA11y, after: afterA11y };

      check(`${label}: parity P = 1.0`, compare.P === 1, compare);
      check(`${label}: no duplicate HUD ids`, compare.duplicates.length === 0, compare.duplicates);
      check(`${label}: surface only adds surface nodes`, compare.unexpectedDuring.length === 0, compare.unexpectedDuring);
      check(`${label}: one renderer before/after entry`, during.renderer === true, during.renderer);
      check(`${label}: no second planet canvas`, during.scene.canvasCount === 1, during.scene);
      check(`${label}: hud[data-mode] switches`, before.mode === 'orbit' && during.mode === 'surface' && after.mode === 'orbit', { before: before.mode, during: during.mode, after: after.mode });
      check(`${label}: target readout is a polite live region`, during.targetLive === 'polite', during.targetLive);
      check(`${label}: lap progressbar updates`, during.lapNow !== null, during.lapNow);
      check(`${label}: pads are named 44px targets`, during.pads.length === 4 && during.pads.every((pad) => pad.label && pad.width >= 44 && pad.height >= 44), during.pads);
      check(`${label}: focus placed in the strip on entry`, /surface/.test(String(during.activeElement)), during.activeElement);
      check(`${label}: focus restored to the orbit HUD on exit`, after.activeElement === 'hud-zoom' || after.activeElement === 'hud', after.activeElement);
      check(`${label}: accessibility tree non-empty in both views`,
        beforeA11y.length > 0 && duringA11y.length > 0 && afterA11y.length > 0,
        { before: beforeA11y.length, during: duringA11y.length, after: afterA11y.length, error: beforeA11y.error || duringA11y.error || afterA11y.error || null });
      await page.close();
    }
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
await writeFile(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ok: report.ok,
  expectedNodes: ALL_HUD_NODES.length,
  checks: report.checks.map((entry) => `${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}`),
  parity: report.parity,
  errors: report.errors.slice(0, 8),
  report: 'media/hud-parity/report.json',
}, null, 2));
process.exit(report.ok ? 0 : 1);
