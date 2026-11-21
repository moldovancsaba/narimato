/**
 * EVT-01 acceptance: the deterministic incident trigger reaches all four kinds.
 *
 * Proves, in a real browser against the real server:
 *   - four consecutive gated triggers are meteor, nuclear, solar, alien;
 *   - the overlay title equals the server `title` for every kind;
 *   - the crust is reset to 20 leaves and the response carries the reset state;
 *   - exactly ONE #event-announcer mutation per incident (no duplicates);
 *   - zero console errors.
 *
 * Usage (self-contained: starts the server with NARIMATO_EVENT_TRIGGER-equivalent
 * config on an ephemeral port and a throwaway DATA_DIR):
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-incident-cycle.mjs
 *
 * Against an already running server (must be started with NARIMATO_EVENT_TRIGGER=1):
 *   BASE_URL=http://127.0.0.1:4173 PLAYWRIGHT_MODULE=... node scripts/acceptance-incident-cycle.mjs
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
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-evt-cycle-'));
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
const report = { ok: false, base, kinds: [], mutations: 0, errors: [], startedAt: new Date().toISOString() };
const browser = await chromium.launch({ headless: true });
let exitCode = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NARIMATO_GDS__?.status?.().booted === true, null, { timeout: 20000 });
  await page.waitForSelector('#tag-input', { state: 'visible', timeout: 20000 });
  await page.fill('#tag-input', 'EVTCYC');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await delay(800);
  await page.click('#btn-landing-brief-start').catch(() => {});
  await delay(300);

  // Count live-region writes: exactly one per incident.
  await page.evaluate(() => {
    window.__EVT_ANNOUNCER_WRITES__ = 0;
    const node = document.getElementById('event-announcer');
    if (node) {
      new MutationObserver(() => {
        window.__EVT_ANNOUNCER_WRITES__ += 1;
      }).observe(node, { childList: true, characterData: true, subtree: true });
    }
  });

  for (const kind of KINDS) {
    const result = await page.evaluate(async (k) => {
      const token = localStorage.getItem('icosa.token');
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, type: 'incident', kind: k }),
      });
      return { status: res.status, body: await res.json() };
    }, kind);
    if (result.status !== 200) throw new Error(`${kind}: trigger HTTP ${result.status} ${JSON.stringify(result.body)}`);
    const body = result.body;
    if (body.kind !== kind) throw new Error(`${kind}: server fired ${body.kind}`);
    if (body.title !== TITLES[kind]) throw new Error(`${kind}: title ${body.title} != ${TITLES[kind]}`);
    if (!Array.isArray(body.leaves) || body.leaves.length !== 20) throw new Error(`${kind}: reset leaves ${body.leaves?.length}`);
    if (!body.message.includes('//')) throw new Error(`${kind}: play copy missing`);
    if (!(body.description || '').length) throw new Error(`${kind}: description missing`);

    // The GDS dialog names the kind the server fired (EVT-02/EVT-03 contract).
    await page.waitForFunction(
      (title) => {
        const heading = document.getElementById('meteor-title');
        const dialog = [...document.querySelectorAll('[role="dialog"]')].find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !element.closest('[aria-hidden="true"]');
        });
        return !!dialog && !!heading && heading.textContent === title;
      },
      body.title,
      { timeout: 4000 },
    );
    const live = await page.evaluate(() => ({
      announcement: document.getElementById('event-announcer')?.textContent || '',
      leaves: window.__ICOSA__?.leaves,
      title: document.getElementById('meteor-title')?.textContent,
      dialog: !!document.querySelector('[role="dialog"]:not([aria-hidden="true"])'),
      fxHidden: document.getElementById('incident-fx-layer')?.getAttribute('aria-hidden'),
    }));
    if (!live.dialog) throw new Error(`${kind}: GDS incident dialog is not open`);
    if (live.fxHidden !== 'true') throw new Error(`${kind}: FX layer must stay aria-hidden`);
    if (live.announcement.includes('//')) throw new Error(`${kind}: spoken announcement contains "//"`);
    if (!live.announcement.includes(body.title)) throw new Error(`${kind}: announcement misses the title`);
    if (live.leaves !== 20) throw new Error(`${kind}: client leaf count ${live.leaves} != 20 after reset`);
    report.kinds.push({
      kind,
      status: result.status,
      title: body.title,
      serverLeaves: body.leaves.length,
      clientLeaves: live.leaves,
      incidentCycle: body.incidentCycle,
      announcement: live.announcement,
    });

    // Let the dialog dwell + the crust reload finish before the next trigger.
    await delay(3200);
    const closed = await page.evaluate(() => window.__ICOSA__?.incidentFxStats?.().open === false);
    if (!closed) throw new Error(`${kind}: incident dialog did not close`);
  }

  report.mutations = await page.evaluate(() => window.__EVT_ANNOUNCER_WRITES__ || 0);
  if (report.mutations !== KINDS.length) {
    throw new Error(`expected ${KINDS.length} announcement writes, saw ${report.mutations}`);
  }
  const health = await (await fetch(`${base}/api/health`)).json();
  if (health.eventTrigger !== true) throw new Error('health does not advertise eventTrigger');
  report.health = { eventTrigger: health.eventTrigger, appVersion: health.appVersion };
  report.errors = errors;
  if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
  report.ok = true;
} catch (err) {
  report.error = err?.message || String(err);
  exitCode = 1;
  console.error(`[evt-01] ${report.error}`);
} finally {
  await browser.close();
  await writeFile(path.join(OUT_DIR, 'acceptance-incident-cycle.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (serverHandle) await serverHandle.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
void exitCode;
