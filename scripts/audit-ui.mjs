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
const ENGINE = process.env.PLAYWRIGHT_ENGINE || 'chromium';
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
let webkit;
let firefox;
try {
  ({ chromium, webkit, firefox } = require(PLAYWRIGHT));
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
const engine = { chromium, webkit, firefox }[ENGINE] || chromium;
if (!engine) {
  console.error(`[audit] Engine "${ENGINE}" is not available in this Playwright build.`);
  process.exit(0);
}
const browser = await engine.launch({ headless: true });
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
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button')].filter((e) => e.offsetParent !== null && !(e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent.trim())).map((e) => e.id || e.className));
    if (unnamed.length) failures.push(`${name}: visible buttons without accessible name: ${unnamed.slice(0, 3).join(', ')}`);
    if (w <= 760) {
      const minTarget = await page.evaluate(() => [...document.querySelectorAll('#mobile-dock button, .status-cluster button, .manual-play, #control-mode button, .surface-pad, .surface-exit')].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, id: e.id || e.className }; }));
      if (minTarget.some((t) => t.w < 44 || t.h < 44)) failures.push(`${name}: primary touch targets below 44px`);
    }
    if (w <= 760) {
      const touch = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.status-cluster .icon-btn')].filter((e) => e.offsetParent !== null);
        return buttons.map((e) => {
          const r = e.getBoundingClientRect();
          const label = e.querySelector('.icon-btn-label');
          return { w: r.width, h: r.height, label: label ? getComputedStyle(label).display : 'none' };
        });
      });
      if (touch.some((t) => t.w < 44 || t.h < 44)) failures.push(`${name}: visible mobile media controls are smaller than 44px`);
      if (touch.some((t) => t.label === 'none')) failures.push(`${name}: visible mobile media controls have no visible label`);
    }
    console.log(`${name.padEnd(12)} viewport=${w}x${h} score-overlap=${Math.round(scoreHit)} target-sub-overlap=${Math.round(snap.target && snap.subtitle ? hit(snap.target, snap.subtitle) : 0)} errors=${consoleErrors.length}`);
    await context.close();
  }

  // CTL-06: real touch semantics — surface pads keep 44 px and stay in view.
  for (const [w, h, name] of [[390, 844, 'mobile'], [844, 390, 'landscape']]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`${BASE}/?intro=0`, { waitUntil: 'domcontentloaded' });
    await delay(400);
    await page.fill('#tag-input', `AUD${w}`.slice(0, 12));
    await page.click('#btn-join');
    await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
    await delay(800);
    await page.evaluate(() => {
      const brief = document.getElementById('btn-landing-brief-start');
      if (brief && brief.getClientRects().length) brief.click();
      const guide = document.getElementById('btn-guide-close');
      const overlay = document.getElementById('guide-overlay');
      if (guide && overlay && !overlay.classList.contains('is-hidden')) guide.click();
    });
    await page.evaluate(() => window.__ICOSA__.surface());
    await page.waitForFunction(() => window.__ICOSA__.surfaceMode().phase === 'walking', null, { timeout: 12000 });
    await delay(400);
    const pads = await page.evaluate(() => [...document.querySelectorAll('[data-surface-hold]')].filter((e) => e.offsetParent !== null).map((e) => {
      const r = e.getBoundingClientRect();
      return { hold: e.getAttribute('data-surface-hold'), w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }));
    if (!pads.length) failures.push(`${name}: surface pads are not mounted`);
    if (pads.some((pad) => pad.w < 44 || pad.h < 44)) failures.push(`${name}: surface pad below 44px`);
    if (pads.some((pad) => pad.right > w + 1 || pad.bottom > h + 1 || pad.left < 0 || pad.top < 0)) failures.push(`${name}: surface pad outside the viewport`);
    const exit = await page.evaluate(() => {
      const el = document.getElementById('btn-surface-exit');
      if (!el || !el.offsetParent) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    if (!exit || exit.h < 44) failures.push(`${name}: surface exit below 44px`);
    console.log(`surface-${name.padEnd(8)} pads=${pads.length} min=${pads.length ? Math.min(...pads.map((p) => Math.min(p.w, p.h))) : 0}px exit=${exit ? Math.round(exit.h) : 'none'}px`);
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

  // A3: landing has no in-game chrome and the join action is on-screen in short landscape.
  for (const [w, h, name] of [[844, 390, 'landscape'], [792, 302, 'short']]) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    await page.goto(`${BASE}/?intro=0`, { waitUntil: 'domcontentloaded' });
    await delay(700);
    const landing = await page.evaluate(() => {
      const form = document.querySelector('.join-form')?.getBoundingClientRect();
      const status = document.querySelector('.status-cluster');
      const statusVisible = !!status && getComputedStyle(status).display !== 'none';
      return { form: form ? { top: form.top, bottom: form.bottom } : null, statusVisible, vh: innerHeight };
    });
    if (!landing.form || landing.form.bottom < 0 || landing.form.top > landing.vh) {
      failures.push(`${name}: join form is not visible on the landing screen`);
    }
    if (landing.statusVisible) failures.push(`${name}: in-game status cluster is visible over the landing screen`);
    console.log(`landing-${name.padEnd(7)} form=${landing.form ? `${Math.round(landing.form.top)}..${Math.round(landing.form.bottom)}` : 'missing'} status=${landing.statusVisible}`);
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
console.log(`\n[audit] clean (engine: ${ENGINE}).`);
