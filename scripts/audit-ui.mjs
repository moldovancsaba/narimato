#!/usr/bin/env node
/**
 * A0 — NARIMATO viewport audit harness.
 *
 * Starts a throwaway server, joins at nine viewports, and asserts:
 *  - the score is not covered by planet/nav/status elements;
 *  - overlays keep their primary actions reachable (scrollable when short);
 *  - target inspector and subtitles do not overlap when both visible;
 *  - no horizontal page overflow, no console/page errors.
 *
 * Playwright is not a runtime dependency. Install it in dev or point at an
 * existing installation:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright npm run audit:ui
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORT = Number(process.env.NARIMATO_AUDIT_PORT || 4391);
const BASE = `http://127.0.0.1:${PORT}`;
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'playwright';
const VIEWPORTS = [
  [1440, 900, 'desktop'],
  [1280, 800, 'laptop'],
  [1024, 768, 'tablet'],
  [900, 600, 'small-tablet'],
  [792, 600, 'cropped'],
  [844, 390, 'landscape'],
  [792, 302, 'short'],
  [390, 844, 'mobile'],
  [360, 740, 'small-mobile'],
];

let chromium;
try {
  ({ chromium } = require(PLAYWRIGHT));
} catch {
  console.error(`[audit] Playwright not found at "${PLAYWRIGHT}".`);
  console.error('Instal it in dev, or set PLAYWRIGHT_MODULE to an existing playwright package.');
  process.exit(0);
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-ui-audit-'));
const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, BOTS: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await delay(150);
  }
  throw new Error(`audit server did not start:\n${serverLog}`);
}

function hit(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

async function layoutSnapshot(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const visible = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
    const rect = (e) => { if (!visible(e)) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const byId = (id) => document.getElementById(id);
    const score = rect(q('.score-value'));
    const scoreLabel = rect(q('.score-label'));
    const badge = rect(byId('planet-badge'));
    const nav = rect(byId('nav-chip'));
    const status = rect(q('.status-cluster'));
    const target = rect(q('.target-panel'));
    const subtitle = rect(byId('narrative-subtitles'));
    return { score, scoreLabel, badge, nav, status, target, subtitle, viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}

await waitForServer();
const browser = await chromium.launch({ headless: true });
const failures = [];
let tagIndex = 0;
try {
  for (const [w, h, name] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(`PAGE ${e.message}`));
    await page.goto(`${BASE}/?intro=0`, { waitUntil: 'domcontentloaded' });
    await delay(900);
    const tag = `AU${String(++tagIndex).padStart(2, '0')}`;
    await page.fill('#tag-input', tag);
    await page.click('#btn-join');
    await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
    await delay(700);

    const pre = await page.evaluate(() => {
      const brief = document.getElementById('landing-brief');
      const btn = document.getElementById('btn-landing-brief-start');
      if (!brief || brief.hidden) return null;
      const b = btn.getBoundingClientRect();
      return { button: { left: b.left, top: b.top, right: b.right, bottom: b.bottom }, inViewport: b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth, scrollable: document.querySelector('.landing-brief-card')?.scrollHeight > document.querySelector('.landing-brief-card')?.clientHeight };
    });
    if (pre && !pre.inViewport && !pre.scrollable) {
      failures.push(`${name}: landing briefing primary action is outside viewport and card is not scrollable`);
    }
    const briefBtn = await page.$('#btn-landing-brief-start');
    if (briefBtn && await briefBtn.isVisible()) {
      await briefBtn.scrollIntoViewIfNeeded();
      await page.click('#btn-landing-brief-start');
      await delay(400);
    }

    // Hover the planet to reveal the target inspector.
    await page.mouse.move(w / 2, h / 2);
    await delay(250);
    const snap = await layoutSnapshot(page);
    const scoreHit = Math.max(
      hit(snap.score, snap.badge),
      hit(snap.score, snap.nav),
      hit(snap.score, snap.status),
    );
    if (scoreHit > 12) failures.push(`${name}: score is covered by top HUD (${Math.round(scoreHit)}px² overlap)`);
    if (snap.overflow) failures.push(`${name}: horizontal page overflow`);
    if (snap.target && snap.subtitle && hit(snap.target, snap.subtitle) > 8) {
      failures.push(`${name}: subtitles overlap the target inspector (${Math.round(hit(snap.target, snap.subtitle))}px²) target=${JSON.stringify(snap.target)} sub=${JSON.stringify(snap.subtitle)} body=${await page.evaluate(() => document.body.className)} bottom=${await page.evaluate(() => getComputedStyle(document.getElementById('narrative-subtitles')).bottom)}`);
    }
    if (consoleErrors.length) failures.push(`${name}: console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);
    console.log(`${name.padEnd(12)} viewport=${w}x${h} score-overlap=${Math.round(scoreHit)} target-sub-overlap=${Math.round(snap.target && snap.subtitle ? hit(snap.target, snap.subtitle) : 0)} errors=${consoleErrors.length}`);
    await context.close();
  }

  // Intro captions must not cover the touch steering pads.
  for (const [w, h, name] of [[390, 844, 'mobile'], [792, 302, 'short']]) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await delay(1200);
    const overlap = await page.evaluate(() => {
      const a = document.getElementById('narrative-subtitles')?.getBoundingClientRect();
      const b = document.getElementById('intro-steer')?.getBoundingClientRect();
      if (!a || !b || !a.width || !b.width) return 0;
      return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    });
    if (overlap > 8) failures.push(`${name}: intro subtitles overlap touch steering (${Math.round(overlap)}px²)`);
    console.log(`intro-${name.padEnd(7)} caption-steer-overlap=${Math.round(overlap)}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await delay(300);
  await rm(dataDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n[audit] ${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\n[audit] clean.');
