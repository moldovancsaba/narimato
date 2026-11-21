/**
 * EVT-02 acceptance: every incident kind draws a measurable, consistent visual.
 *
 * Drives the incident overlay at 1280×800 (DPR 1) and 390×844 (DPR 3), asserts
 * `window.__ICOSA__.incidentFxStats()` per kind:
 *   coverage ≥ MIN_COVERAGE (0.03), frames ≥ 30, blank = false,
 *   ships signature (meteor 1, nuclear 0, solar 0, alien 2), DPR-correct canvas,
 * then re-runs every kind under `prefers-reduced-motion: reduce` and asserts a
 * single non-blank poster frame (poster = true, no animation loop).
 *
 * One screenshot per kind per viewport plus reduced-motion screenshots land in
 * media/evt-01-03-aud-01/.
 *
 * Usage (self-contained server on an ephemeral port + throwaway DATA_DIR):
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-incident-visual.mjs
 * Against a running server: BASE_URL=http://127.0.0.1:4173 PLAYWRIGHT_MODULE=...
 */
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'media', 'evt-01-03-aud-01');

const KINDS = ['meteor', 'nuclear', 'solar', 'alien'];
const TITLES = { meteor: 'METEOR IMPACT', nuclear: 'NUCLEAR WAR', solar: 'SOLAR FLARE', alien: 'ALIEN INVASION' };
const SHIPS = { meteor: 1, nuclear: 0, solar: 0, alien: 2 };
const COPY = {
  meteor: ['A METEOR SHATTERED THE OLD CRUST', 'A rogue meteor punched through the surface and cracked open fresh ore veins.'],
  nuclear: ['ATOMIC FIRE SWEPT THE PLANET', 'The blast waves split the crust and exposed new materials.'],
  solar: ['A SOLAR FLARE COOKED THE DAYLIGHT SIDE', 'The magnetic storm peeled back rock and scattered rare elements.'],
  alien: ['A FLEET RAZED THE PLANET FROM ORBIT', 'Their beams demolished the old surface and scattered new materials.'],
};
const MIN_COVERAGE = 0.03;
const ISOLATED = 'evt-01-03-aud-01';

let serverHandle = null;
let dataDir = null;
let base = process.env.BASE_URL || '';
if (!base) {
  const { startServer } = await import('../server.js');
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-evt-visual-'));
  serverHandle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { eventTrigger: true, depositChance: 1, bots: 0, clickCooldownMs: 0, saveDebounceMs: 10 },
  });
  base = serverHandle.url;
}
await mkdir(OUT_DIR, { recursive: true });

const report = { ok: false, base, viewports: [], reducedMotion: [], errors: [], startedAt: new Date().toISOString() };
const browser = await chromium.launch({ headless: true });
const allErrors = [];

const usedTags = new Set();
async function join(page, tag = 'EVTFX') {
  let unique = tag;
  for (let i = 2; usedTags.has(unique); i += 1) unique = `${tag}${i}`;
  usedTags.add(unique);
  await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NARIMATO_GDS__?.status?.().booted === true, null, { timeout: 20000 });
  await page.waitForSelector('#tag-input', { state: 'visible', timeout: 20000 });
  await page.fill('#tag-input', unique);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await delay(700);
  await page.click('#btn-landing-brief-start').catch(() => {});
  await delay(250);
}

async function openIncident(page, kind) {
  const [message, description] = COPY[kind];
  await page.evaluate(
    ({ k, title, msg, desc }) => window.__ICOSA__.incident(k, title, msg, desc),
    { k: kind, title: TITLES[kind], msg: message, desc: description },
  );
}

async function readStats(page) {
  return page.evaluate(() => window.__ICOSA__?.incidentFxStats?.() || null);
}

try {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800, dpr: 1 },
    { name: 'mobile', width: 390, height: 844, dpr: 3 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
    });
    // Deterministic first-run: never let the one-time Quick Guide auto-open over
    // the incident overlay we are screenshotting.
    await context.addInitScript(() => {
      try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => allErrors.push(`${viewport.name}: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') allErrors.push(`${viewport.name}: ${msg.text()}`);
    });
    await join(page, `FX${viewport.name.slice(0, 3).toUpperCase()}`);
    const rows = [];
    for (const kind of KINDS) {
      await openIncident(page, kind);
      await page.waitForFunction(
        () => {
          const stats = window.__ICOSA__?.incidentFxStats?.();
          return !!stats && stats.open && stats.frames >= 30 && stats.coverage > 0;
        },
        null,
        { timeout: 5000 },
      );
      const stats = await readStats(page);
      const canvas = await page.evaluate(() => {
        const el = document.getElementById('meteor-fx');
        return el
          ? { width: el.width, height: el.height, cssWidth: el.clientWidth, cssHeight: el.clientHeight, innerWidth: window.innerWidth, innerHeight: window.innerHeight, dpr: window.devicePixelRatio }
          : null;
      });
      const row = { kind, stats, canvas };
      if (stats.kind !== kind) throw new Error(`${viewport.name}/${kind}: stats.kind ${stats.kind}`);
      if (stats.blank) throw new Error(`${viewport.name}/${kind}: blank FX frame`);
      if (stats.coverage < MIN_COVERAGE) throw new Error(`${viewport.name}/${kind}: coverage ${stats.coverage} < ${MIN_COVERAGE}`);
      if (stats.frames < stats.minFrames) throw new Error(`${viewport.name}/${kind}: frames ${stats.frames} < 30`);
      if (stats.ships !== SHIPS[kind]) throw new Error(`${viewport.name}/${kind}: ships ${stats.ships} != ${SHIPS[kind]}`);
      if (stats.reducedMotion !== false) throw new Error(`${viewport.name}/${kind}: full-motion run reports reducedMotion`);
      if (kind === 'nuclear' && !(stats.firstFrameLuminance > 0.6)) {
        throw new Error(`${viewport.name}/nuclear: first-frame luminance ${stats.firstFrameLuminance} <= 0.6`);
      }
      if (stats.dpr !== viewport.dpr) throw new Error(`${viewport.name}/${kind}: dpr ${stats.dpr} != ${viewport.dpr}`);
      const expectedWidth = Math.round(canvas.innerWidth * viewport.dpr);
      const expectedHeight = Math.round(canvas.innerHeight * viewport.dpr);
      if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
        throw new Error(`${viewport.name}/${kind}: canvas ${canvas.width}x${canvas.height} != ${expectedWidth}x${expectedHeight}`);
      }
      await page.screenshot({ path: path.join(OUT_DIR, `incident-${kind}-${viewport.name}.jpg`), type: 'jpeg', quality: 82 });
      rows.push(row);
      await page.waitForFunction(() => !window.__ICOSA__?.incidentFxStats?.().open, null, { timeout: 5000 });
      await delay(350);
    }
    report.viewports.push({ ...viewport, kinds: rows });
    await context.close();
  }

  // Reduced motion: one static, non-blank poster frame; 1200 ms dwell; no shake.
  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await reduced.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  const reducedPage = await reduced.newPage();
  reducedPage.on('pageerror', (err) => allErrors.push(`reduced: ${err.message}`));
  await join(reducedPage, 'FXRED');
  for (const kind of KINDS) {
    await openIncident(reducedPage, kind);
    await reducedPage.waitForFunction(
      () => window.__ICOSA__?.incidentFxStats?.().poster === true,
      null,
      { timeout: 3000 },
    );
    const stats = await readStats(reducedPage);
    const shake = await reducedPage.evaluate(() => document.body.classList.contains('is-shaking'));
    if (stats.reducedMotion !== true) throw new Error(`reduced/${kind}: reducedMotion false`);
    if (stats.poster !== true) throw new Error(`reduced/${kind}: no poster frame`);
    if (stats.blank) throw new Error(`reduced/${kind}: poster is blank (coverage ${stats.coverage})`);
    if (stats.coverage < MIN_COVERAGE) throw new Error(`reduced/${kind}: poster coverage ${stats.coverage} < ${MIN_COVERAGE}`);
    if (stats.dwellMs !== 1200) throw new Error(`reduced/${kind}: dwell ${stats.dwellMs} != 1200`);
    if (shake) throw new Error(`reduced/${kind}: body.is-shaking applied under reduced motion`);
    await reducedPage.screenshot({ path: path.join(OUT_DIR, `incident-${kind}-reduced-motion.jpg`), type: 'jpeg', quality: 82 });
    report.reducedMotion.push({ kind, stats, shake });
    await reducedPage.waitForFunction(() => !window.__ICOSA__?.incidentFxStats?.().open, null, { timeout: 4000 });
    await delay(200);
  }
  await reduced.close();

  report.errors = allErrors;
  if (allErrors.length) throw new Error(`console errors: ${allErrors.join(' | ')}`);
  report.ok = true;
} catch (err) {
  report.error = err?.message || String(err);
  console.error(`[evt-02] ${report.error}`);
} finally {
  await browser.close();
  await writeFile(path.join(OUT_DIR, 'acceptance-incident-visual.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (serverHandle) await serverHandle.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
void ISOLATED;
