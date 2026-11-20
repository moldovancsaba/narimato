/**
 * EVT-03 acceptance: incident feedback is announced, captioned, keyboard
 * dismissable and static under reduced motion.
 *
 * Evidence captured per kind:
 *   - role/aria-labelledby/aria-describedby on the overlay, name = server title
 *   - the single #event-announcer write (role=status, aria-live=polite,
 *     aria-atomic=true) with the full spoken sentence (no "//")
 *   - static #event-captions units, never a second live region
 *   - Escape closes the overlay; DISMISS closes it and focus returns
 *   - reduced motion: poster only, no body.is-shaking, 1200 ms dwell
 *
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-incident-a11y.mjs
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

let serverHandle = null;
let dataDir = null;
let base = process.env.BASE_URL || '';
if (!base) {
  const { startServer } = await import('../server.js');
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-evt-a11y-'));
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

const report = { ok: false, base, kinds: [], dismissal: {}, reducedMotion: {}, errors: [] };
const browser = await chromium.launch({ headless: true });

function readDom(page) {
  return page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const overlay = $('meteor-overlay');
    const announcer = $('event-announcer');
    const captions = $('event-captions');
    return {
      overlay: overlay
        ? {
            role: overlay.getAttribute('role'),
            labelledby: overlay.getAttribute('aria-labelledby'),
            describedby: overlay.getAttribute('aria-describedby'),
            ariaHidden: overlay.getAttribute('aria-hidden'),
            active: overlay.classList.contains('is-active'),
            liveRegionsInside: overlay.querySelectorAll('[aria-live],[role="status"],[role="alert"]').length,
          }
        : null,
      name: overlay && overlay.getAttribute('aria-labelledby')
        ? ($(overlay.getAttribute('aria-labelledby')) || {}).textContent
        : null,
      announcer: announcer
        ? {
            role: announcer.getAttribute('role'),
            live: announcer.getAttribute('aria-live'),
            atomic: announcer.getAttribute('aria-atomic'),
            text: announcer.textContent,
          }
        : null,
      captions: captions
        ? {
            live: captions.getAttribute('aria-live'),
            role: captions.getAttribute('role'),
            items: [...captions.querySelectorAll('li')].map((li) => li.textContent),
          }
        : null,
      statusRegions: document.querySelectorAll('#event-announcer[role="status"][aria-live="polite"]').length,
      activeElementId: document.activeElement ? document.activeElement.id : '',
    };
  });
}

async function trigger(page, kind) {
  return page.evaluate(async (k) => {
    const token = localStorage.getItem('icosa.token');
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, type: 'incident', kind: k }),
    });
    return res.json();
  }, kind);
}

async function join(page, tag) {
  await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await page.fill('#tag-input', tag);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await delay(800);
  await page.click('#btn-landing-brief-start').catch(() => {});
  await delay(250);
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => report.errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.errors.push(msg.text());
  });
  await join(page, 'A11YEVT');

  for (const kind of KINDS) {
    const body = await trigger(page, kind);
    await page.waitForFunction(
      (title) => document.getElementById('meteor-title')?.textContent === title && document.getElementById('meteor-overlay')?.classList.contains('is-active'),
      TITLES[kind],
      { timeout: 4000 },
    );
    const dom = await readDom(page);
    if (dom.overlay?.role !== 'region') throw new Error(`${kind}: overlay role ${dom.overlay?.role}`);
    if (dom.overlay?.labelledby !== 'meteor-title') throw new Error(`${kind}: aria-labelledby is not meteor-title`);
    if (dom.overlay?.describedby !== 'meteor-sub meteor-description') throw new Error(`${kind}: aria-describedby mismatch`);
    if (dom.name !== TITLES[kind]) throw new Error(`${kind}: accessible name ${dom.name} != ${TITLES[kind]}`);
    if (dom.announcer?.role !== 'status' || dom.announcer?.live !== 'polite' || dom.announcer?.atomic !== 'true') {
      throw new Error(`${kind}: announcer contract ${JSON.stringify(dom.announcer)}`);
    }
    if (!dom.announcer.text.includes(TITLES[kind])) throw new Error(`${kind}: announcement misses title`);
    if (dom.announcer.text.includes('//')) throw new Error(`${kind}: spoken text contains //`);
    if (dom.statusRegions !== 1) throw new Error(`${kind}: ${dom.statusRegions} event announcers`);
    if (dom.overlay.liveRegionsInside !== 0) throw new Error(`${kind}: overlay contains its own live region`);
    if (!dom.captions || dom.captions.items.length < 2) throw new Error(`${kind}: static captions missing`);
    if (dom.captions.live) throw new Error(`${kind}: caption list must not be live`);
    report.kinds.push({ kind, serverTitle: body.title, ...dom });

    // Keyboard dismissal: Escape closes and does not start the escape mission.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('meteor-overlay')?.getAttribute('aria-hidden') === 'true', null, { timeout: 3000 });
    const afterEscape = await page.evaluate(() => ({
      active: document.getElementById('meteor-overlay').classList.contains('is-active'),
      escapeCta: document.getElementById('escape-cta')?.classList.contains('is-active') || false,
    }));
    if (afterEscape.active) throw new Error(`${kind}: Escape did not close the overlay`);
    if (afterEscape.escapeCta) throw new Error(`${kind}: Escape started the escape mission`);
    await delay(900);
  }

  // DISMISS control closes and restores focus.
  await trigger(page, 'solar');
  await page.waitForFunction(() => document.getElementById('meteor-overlay')?.classList.contains('is-active'), null, { timeout: 4000 });
  await page.click('#meteor-dismiss');
  await page.waitForFunction(() => document.getElementById('meteor-overlay')?.getAttribute('aria-hidden') === 'true', null, { timeout: 3000 });
  report.dismissal = await page.evaluate(() => ({
    dismissed: !document.getElementById('meteor-overlay').classList.contains('is-active'),
    activeElementId: document.activeElement ? document.activeElement.id : '',
    dismissTag: document.getElementById('meteor-dismiss')?.tagName,
    dismissMinHeight: getComputedStyle(document.getElementById('meteor-dismiss')).minHeight,
    dismissMinWidth: getComputedStyle(document.getElementById('meteor-dismiss')).minWidth,
  }));
  if (!report.dismissal.dismissed) throw new Error('DISMISS did not close the incident overlay');
  if (report.dismissal.activeElementId === 'meteor-dismiss') throw new Error('focus stayed on the removed overlay control');
  await context.close();

  // Reduced motion: static poster, no shake, 1200 ms dwell, announcement still speaks.
  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await reduced.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  const reducedPage = await reduced.newPage();
  reducedPage.on('pageerror', (err) => report.errors.push(`reduced: ${err.message}`));
  await join(reducedPage, 'A11YRED');
  for (const kind of KINDS) {
    await trigger(reducedPage, kind);
    await reducedPage.waitForFunction(() => window.__ICOSA__?.incidentFxStats?.().poster === true, null, { timeout: 3000 });
    const reducedState = await reducedPage.evaluate(() => ({
      stats: window.__ICOSA__.incidentFxStats(),
      shaking: document.body.classList.contains('is-shaking'),
      announcer: document.getElementById('event-announcer')?.textContent || '',
      captions: [...document.querySelectorAll('#event-caption-list li')].map((li) => li.textContent).length,
    }));
    if (reducedState.shaking) throw new Error(`reduced/${kind}: body.is-shaking applied`);
    if (!reducedState.stats.reducedMotion) throw new Error(`reduced/${kind}: reducedMotion not detected`);
    if (reducedState.stats.dwellMs !== 1200) throw new Error(`reduced/${kind}: dwell ${reducedState.stats.dwellMs} != 1200`);
    if (reducedState.stats.blank) throw new Error(`reduced/${kind}: reduced poster is blank`);
    if (!reducedState.announcer.includes(TITLES[kind])) throw new Error(`reduced/${kind}: no announcement`);
    report.reducedMotion[kind] = reducedState;
    await reducedPage.waitForFunction(() => !window.__ICOSA__?.incidentFxStats?.().open, null, { timeout: 4000 });
    await delay(200);
  }
  await reduced.close();

  if (report.errors.length) throw new Error(`console errors: ${report.errors.join(' | ')}`);
  report.ok = true;
} catch (err) {
  report.error = err?.message || String(err);
  console.error(`[evt-03] ${report.error}`);
} finally {
  await browser.close();
  await writeFile(path.join(OUT_DIR, 'acceptance-incident-a11y.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (serverHandle) await serverHandle.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
console.log(JSON.stringify({ ok: report.ok, error: report.error || null, kinds: report.kinds.map((k) => k.kind), dismissal: report.dismissal }, null, 2));
if (!report.ok) process.exitCode = 1;
