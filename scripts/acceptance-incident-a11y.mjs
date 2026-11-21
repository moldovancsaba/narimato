/**
 * EVT-02/EVT-03 acceptance: the incident overlay is a governed GDS dialog and
 * every incident is still announced, captioned, keyboard dismissable and static
 * under reduced motion.
 *
 * Evidence captured per kind:
 *   - visible `[role="dialog"]`, `aria-modal="true"`, accessible name = server title
 *   - `#meteor-title` is inside the dialog and carries the title text
 *   - `#incident-fx-layer` is aria-hidden product rendering behind the dialog
 *   - the dialog and its dismiss control descend from a GDS surface root
 *   - the close control and `#meteor-dismiss` are shipped GDS buttons (no
 *     hand-rolled control), Tab stays inside the dialog, Escape/DISMISS close
 *   - focus returns to `#arena-canvas`; the single polite `#event-announcer`
 *     still speaks once and static captions stay non-live
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

const visibleDialogSelector = () =>
  [...document.querySelectorAll('[role="dialog"]')].find((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('[aria-hidden="true"]');
  }) || null;

function readDom(page) {
  return page.evaluate((selectorSource) => {
    const visibleDialog = new Function(`return (${selectorSource})()`)();
    const $ = (id) => document.getElementById(id);
    const dialog = visibleDialog;
    const announcer = $('event-announcer');
    const captions = $('event-captions');
    const fx = $('incident-fx-layer');
    const labelledby = dialog ? dialog.getAttribute('aria-labelledby') : null;
    const title = $('meteor-title');
    const dismiss = $('meteor-dismiss');
    const close = dialog ? dialog.querySelector('[aria-label="Dismiss incident"]') : null;
    const gdsRoot = (element) => !!(element && element.closest('[data-gds-surface][data-gds-component]'));
    return {
      dialog: dialog
        ? {
            role: dialog.getAttribute('role'),
            ariaModal: dialog.getAttribute('aria-modal'),
            labelledby,
            describedby: dialog.getAttribute('aria-describedby'),
            name: labelledby && $(labelledby) ? $(labelledby).textContent : null,
            contentTag: dialog.tagName,
          }
        : null,
      title: title ? { text: title.textContent, tag: title.tagName, tabindex: title.getAttribute('tabindex') } : null,
      fxLayer: fx ? { ariaHidden: fx.getAttribute('aria-hidden'), active: fx.classList.contains('is-active'), role: fx.getAttribute('role') } : null,
      owner: { title: gdsRoot(title), dismiss: gdsRoot(dismiss), close: gdsRoot(close) },
      controls: {
        dismissTag: dismiss ? dismiss.tagName : null,
        dismissClass: dismiss ? dismiss.className : null,
        dismissHeight: dismiss ? dismiss.getBoundingClientRect().height : 0,
        dismissWidth: dismiss ? dismiss.getBoundingClientRect().width : 0,
        closeTag: close ? close.tagName : null,
        closeClass: close ? close.className : null,
      },
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
    };
  }, visibleDialogSelector.toString());
}

async function activeInDialog(page) {
  return page.evaluate((selectorSource) => {
    const dialog = new Function(`return (${selectorSource})()`)();
    return !!(dialog && document.activeElement && dialog.contains(document.activeElement));
  }, visibleDialogSelector.toString());
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
  await page.waitForFunction(() => window.__NARIMATO_GDS__?.status?.().booted === true, null, { timeout: 20_000 });
  await page.fill('#tag-input', tag);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15_000 });
  await delay(800);
  await page.click('#btn-landing-brief-start').catch(() => {});
  await delay(250);
}

async function waitForIncident(page, title) {
  await page.waitForFunction(
    (expected) => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      const dialog = dialogs.find((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('[aria-hidden="true"]');
      });
      const heading = document.getElementById('meteor-title');
      return !!dialog && !!heading && heading.textContent === expected;
    },
    title,
    { timeout: 5_000 },
  );
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
    await waitForIncident(page, TITLES[kind]);
    const dom = await readDom(page);
    if (dom.dialog?.role !== 'dialog') throw new Error(`${kind}: dialog role ${dom.dialog?.role}`);
    if (dom.dialog?.ariaModal !== 'true') throw new Error(`${kind}: aria-modal ${dom.dialog?.ariaModal}`);
    if (dom.dialog?.name !== TITLES[kind]) throw new Error(`${kind}: accessible name ${dom.dialog?.name} != ${TITLES[kind]}`);
    if (dom.title?.text !== TITLES[kind]) throw new Error(`${kind}: heading ${dom.title?.text} != ${TITLES[kind]}`);
    if (!dom.owner.title || !dom.owner.dismiss || !dom.owner.close) throw new Error(`${kind}: dialog controls are not inside a GDS surface`);
    if (!/mantine-Button/.test(dom.controls.dismissClass || '')) throw new Error(`${kind}: dismiss is not a GDS Button`);
    if (dom.controls.dismissHeight < 44 || dom.controls.dismissWidth < 44) throw new Error(`${kind}: dismiss target ${dom.controls.dismissWidth}x${dom.controls.dismissHeight}`);
    if (!/mantine-CloseButton|mantine-UnstyledButton|mantine-ActionIcon/.test(dom.controls.closeClass || '')) throw new Error(`${kind}: close control is not GDS`);
    if (dom.fxLayer?.ariaHidden !== 'true') throw new Error(`${kind}: FX layer is not aria-hidden`);
    if (!dom.fxLayer?.active) throw new Error(`${kind}: FX layer is not active`);
    if (dom.announcer?.role !== 'status' || dom.announcer?.live !== 'polite' || dom.announcer?.atomic !== 'true') {
      throw new Error(`${kind}: announcer contract ${JSON.stringify(dom.announcer)}`);
    }
    if (!dom.announcer.text.includes(TITLES[kind])) throw new Error(`${kind}: announcement misses title`);
    if (dom.announcer.text.includes('//')) throw new Error(`${kind}: spoken text contains //`);
    if (dom.statusRegions !== 1) throw new Error(`${kind}: ${dom.statusRegions} event announcers`);
    if (!dom.captions || dom.captions.items.length < 2) throw new Error(`${kind}: static captions missing`);
    if (dom.captions.live) throw new Error(`${kind}: caption list must not be live`);

    // Focus trap: a full Tab cycle stays inside the governed dialog.
    const trapped = [];
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      trapped.push(await activeInDialog(page));
    }
    if (!trapped.every(Boolean)) throw new Error(`${kind}: Tab escaped the incident dialog`);
    report.kinds.push({ kind, serverTitle: body.title, ...dom, trapped: trapped.length });

    // Keyboard dismissal: Escape closes and does not start the escape mission.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__ICOSA__?.incidentFxStats?.().open, null, { timeout: 3_000 });
    await delay(900);
    const afterEscape = await page.evaluate(() => ({
      open: window.__ICOSA__.incidentFxStats().open,
      activeElementId: document.activeElement ? document.activeElement.id : '',
      escapeCta: document.getElementById('escape-cta')?.classList.contains('is-active') || false,
    }));
    if (afterEscape.open) throw new Error(`${kind}: Escape did not close the incident`);
    if (afterEscape.escapeCta) throw new Error(`${kind}: Escape started the escape mission`);
    if (afterEscape.activeElementId !== 'arena-canvas') throw new Error(`${kind}: focus ${afterEscape.activeElementId} != arena-canvas`);
    await delay(700);
  }

  // DISMISS control closes and restores focus.
  await trigger(page, 'solar');
  await waitForIncident(page, TITLES.solar);
  const beforeDismiss = await page.evaluate(() => {
    const button = document.getElementById('meteor-dismiss');
    const rect = button ? button.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      dismissTag: button ? button.tagName : null,
      dismissClass: button ? button.className : null,
      dismissWidth: Math.round(rect.width),
      dismissHeight: Math.round(rect.height),
    };
  });
  await page.click('#meteor-dismiss');
  await page.waitForFunction(() => !window.__ICOSA__?.incidentFxStats?.().open, null, { timeout: 3_000 });
  await delay(900);
  report.dismissal = {
    ...beforeDismiss,
    ...(await page.evaluate(() => ({
      dismissed: !window.__ICOSA__.incidentFxStats().open,
      activeElementId: document.activeElement ? document.activeElement.id : '',
      dialogOpen: !!document.querySelector('[role="dialog"]:not([aria-hidden="true"])'),
    }))),
  };
  if (!/mantine-Button/.test(report.dismissal.dismissClass || '')) throw new Error('DISMISS is not a GDS Button');
  if (report.dismissal.dismissWidth < 44 || report.dismissal.dismissHeight < 44) throw new Error('DISMISS is below 44 px');
  if (!report.dismissal.dismissed) throw new Error('DISMISS did not close the incident dialog');
  if (report.dismissal.activeElementId === 'meteor-dismiss') throw new Error('focus stayed on the removed overlay control');
  if (report.dismissal.activeElementId !== 'arena-canvas') throw new Error(`focus ${report.dismissal.activeElementId} != arena-canvas after DISMISS`);
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
    await waitForIncident(reducedPage, TITLES[kind]);
    await reducedPage.waitForFunction(() => window.__ICOSA__?.incidentFxStats?.().poster === true, null, { timeout: 3_000 });
    const reducedState = await reducedPage.evaluate(() => ({
      stats: window.__ICOSA__.incidentFxStats(),
      shaking: document.body.classList.contains('is-shaking'),
      announcer: document.getElementById('event-announcer')?.textContent || '',
      captions: [...document.querySelectorAll('#event-caption-list li')].map((li) => li.textContent).length,
      title: document.getElementById('meteor-title')?.textContent || '',
      dialog: !!document.querySelector('[role="dialog"]:not([aria-hidden="true"])'),
    }));
    if (reducedState.shaking) throw new Error(`reduced/${kind}: body.is-shaking applied`);
    if (!reducedState.stats.reducedMotion) throw new Error(`reduced/${kind}: reducedMotion not detected`);
    if (reducedState.stats.dwellMs !== 1200) throw new Error(`reduced/${kind}: dwell ${reducedState.stats.dwellMs} != 1200`);
    if (reducedState.stats.blank) throw new Error(`reduced/${kind}: reduced poster is blank`);
    if (!reducedState.announcer.includes(TITLES[kind])) throw new Error(`reduced/${kind}: no announcement`);
    if (!reducedState.dialog || reducedState.title !== TITLES[kind]) throw new Error(`reduced/${kind}: GDS dialog/name missing`);
    report.reducedMotion[kind] = reducedState;
    await reducedPage.waitForFunction(() => !window.__ICOSA__?.incidentFxStats?.().open, null, { timeout: 4_000 });
    await delay(200);
  }
  await reduced.close();

  if (report.errors.length) throw new Error(`console errors: ${report.errors.join(' | ')}`);
  report.ok = true;
} catch (err) {
  report.error = err?.message || String(err);
  console.error(`[evt-02] ${report.error}`);
} finally {
  await browser.close();
  await writeFile(path.join(OUT_DIR, 'acceptance-incident-a11y.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (serverHandle) await serverHandle.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
console.log(JSON.stringify({ ok: report.ok, error: report.error || null, kinds: report.kinds.map((k) => k.kind), dismissal: report.dismissal }, null, 2));
if (!report.ok) process.exitCode = 1;
