/**
 * CTL-05 acceptance: visible control mode and one persisted preference record.
 *
 * Proves: the indicator states mode + drag direction in every reachable state,
 * `I` and the toggle update label/aria-pressed/storage, reload restores, the
 * action enters and exits the surface, one polite announcement per transition,
 * no overlap with score/NAV/badge at three viewports, and only
 * `icosa.controls.v1` is written for control prefs.
 *
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-control-mode.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startLocalServer, loadPlaywright, launchChromium, finish, dismissGameOverlays, ROOT } from './lib/local-server.mjs';

const failures = [];
let finished = false;
const shotsDir = path.join(ROOT, 'media', 'ctl');
await mkdir(shotsDir, { recursive: true });
const server = await startLocalServer({ port: Number(process.env.ACCEPTANCE_PORT) || 0 });
const { chromium } = await loadPlaywright();
const browser = await launchChromium(chromium);
browser.on('disconnected', () => { if (!finished) failures.push('browser disconnected before the run completed'); });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (/favicon/i.test(text) || /404 \(Not Found\)/.test(text) || /409 \(Conflict\)/.test(text)) return;
  consoleErrors.push(text);
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const modeState = () => page.evaluate(() => ({
  mode: window.__ICOSA__.controlMode().mode,
  dragMode: window.__ICOSA__.dragMode(),
  dataMode: document.getElementById('control-mode')?.dataset.mode,
  label: document.getElementById('control-mode-label')?.textContent,
  dragLabel: document.getElementById('btn-drag-mode')?.textContent,
  pressed: document.getElementById('btn-drag-mode')?.getAttribute('aria-pressed'),
  actionLabel: document.getElementById('btn-control-mode')?.textContent,
  actionDisabled: document.getElementById('btn-control-mode')?.getAttribute('aria-disabled'),
  describedBy: document.getElementById('btn-drag-mode')?.getAttribute('aria-describedby'),
  live: document.getElementById('control-mode-live')?.textContent || '',
  storage: Object.fromEntries(Object.keys(localStorage)
    .filter((key) => /icosa\.(controls|dragInvert|orbitInputMode)/.test(key))
    .map((key) => [key, localStorage.getItem(key)])),
}));

async function installAnnouncementCounter() {
  await page.evaluate(() => {
    window.__announcements = 0;
    const node = document.getElementById('control-mode-live');
    if (!node) return;
    window.__announceObserver?.disconnect?.();
    const observer = new MutationObserver(() => { window.__announcements += 1; });
    observer.observe(node, { childList: true, characterData: true, subtree: true });
    window.__announceObserver = observer;
  });
}
const announcements = () => page.evaluate(() => window.__announcements || 0);

function overlap(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

try {
  await page.addInitScript(() => { try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private */ } });
  await page.goto(`${server.base}/?gds=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await sleep(300);
  const preJoin = await modeState();
  if (preJoin.mode !== 'offline' || preJoin.dataMode !== 'offline') failures.push(`pre-join mode is ${preJoin.mode}/${preJoin.dataMode}`);
  if (preJoin.actionDisabled !== 'true') failures.push('action is not aria-disabled before join');

  await page.fill('#tag-input', 'MODE');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);
  const orbit = await modeState();
  if (orbit.mode !== 'orbit' || orbit.dataMode !== 'orbit') failures.push(`joined mode is ${orbit.mode}/${orbit.dataMode}`);
  if (orbit.label !== 'ORBIT') failures.push(`mode label is "${orbit.label}"`);
  if (orbit.actionLabel !== 'ENTER SURFACE' || orbit.actionDisabled !== 'false') failures.push('orbit action is not ENTER SURFACE/enabled');
  if (orbit.dragLabel !== 'DRAG: FOLLOW CURSOR' || orbit.pressed !== 'false') failures.push('initial drag label/pressed is wrong');
  if (orbit.describedBy !== 'control-mode-reason') failures.push('drag toggle is not described by the reason node');

  await installAnnouncementCounter();
  await page.click('#btn-drag-mode');
  await sleep(120);
  const reversed = await modeState();
  if (reversed.dragMode !== 'reverse' || reversed.dragLabel !== 'DRAG: REVERSE' || reversed.pressed !== 'true') {
    failures.push(`drag toggle did not reverse visibly (${reversed.dragMode}/${reversed.dragLabel}/${reversed.pressed})`);
  }
  if (JSON.parse(reversed.storage['icosa.controls.v1'] || '{}').dragInvert !== true) failures.push('drag polarity was not persisted');
  if (reversed.storage['icosa.dragInvert.v2'] !== undefined) failures.push('legacy drag key still written');
  if (reversed.storage['icosa.orbitInputMode.v1'] !== undefined) failures.push('CTL-01 draft key still written');
  const toggleAnnouncements = await announcements();
  if (toggleAnnouncements < 1) failures.push('drag toggle did not announce');

  // I is an equivalent shortcut: flip to follow.
  await installAnnouncementCounter();
  await page.keyboard.press('i');
  await sleep(120);
  const followed = await modeState();
  if (followed.dragLabel !== 'DRAG: FOLLOW CURSOR' || followed.pressed !== 'false') failures.push('I shortcut did not flip the visible label');

  // Action enters and exits surface through the same derivation.
  await installAnnouncementCounter();
  await page.click('#btn-control-mode');
  await page.waitForFunction(() => document.getElementById('control-mode')?.dataset.mode === 'surface', null, { timeout: 15000 });
  const surface = await modeState();
  if (surface.mode !== 'surface' || surface.dataMode !== 'surface') failures.push(`surface mode is ${surface.mode}/${surface.dataMode}`);
  if (surface.actionLabel !== 'RETURN TO ORBIT') failures.push(`surface action is "${surface.actionLabel}"`);
  const surfaceAnnouncements = await announcements();
  if (surfaceAnnouncements < 1) failures.push('surface entry did not announce');
  await page.screenshot({ path: path.join(shotsDir, 'control-mode-surface.jpg'), type: 'jpeg', quality: 82 });
  await page.click('#btn-control-mode');
  await page.waitForFunction(() => window.__ICOSA__.controlMode().mode === 'orbit', null, { timeout: 12000 });
  await sleep(250);
  const backToOrbit = await modeState();
  if (backToOrbit.mode !== 'orbit') failures.push('action did not return to orbit');

  // Reload restores the persisted drag direction (not the mode).
  await page.click('#btn-drag-mode');
  await sleep(120);
  const beforeReload = await modeState();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#tag-input', 'MODE');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);
  const afterReload = await modeState();
  if (afterReload.dragLabel !== beforeReload.dragLabel) failures.push(`reload restored "${afterReload.dragLabel}" instead of "${beforeReload.dragLabel}"`);

  // GDS island mode (UI-02..05): the same indicator must exist as GDS components.
  const gdsPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const gdsErrors = [];
  gdsPage.on('pageerror', (err) => gdsErrors.push(err.message));
  await gdsPage.addInitScript(() => { try { localStorage.setItem('icosa.guideSeen', '1'); localStorage.setItem('narimato.gds', 'on'); } catch { /* private */ } });
  await gdsPage.goto(`${server.base}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await gdsPage.waitForFunction(() => document.documentElement.dataset.gdsUi === 'on', null, { timeout: 20000 });
  await gdsPage.waitForSelector('#gds-root[data-gds-ready="true"]', { timeout: 20000 });
  await gdsPage.waitForSelector('#control-mode', { timeout: 20000 });
  await gdsPage.fill('#tag-input', 'GMODE');
  await gdsPage.click('#btn-join');
  await gdsPage.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 20000 });
  await dismissGameOverlays(gdsPage);
  const gdsSnap = async () => gdsPage.evaluate(() => ({
    root: !!document.getElementById('gds-root'),
    group: !!document.querySelector('#gds-root #control-mode[data-gds-component="control-mode"]'),
    dataMode: document.getElementById('control-mode')?.dataset.mode,
    label: document.getElementById('control-mode-label')?.textContent,
    dragLabel: document.getElementById('btn-drag-mode')?.textContent,
    pressed: document.getElementById('btn-drag-mode')?.getAttribute('aria-pressed'),
    actionLabel: document.getElementById('btn-control-mode')?.textContent,
    describedBy: document.getElementById('btn-drag-mode')?.getAttribute('aria-describedby'),
    live: document.getElementById('control-mode-live')?.textContent,
    gdsButtons: [...document.querySelectorAll('#gds-root button')].length,
  }));
  const gdsOrbit = await gdsSnap();
  if (!gdsOrbit.group) failures.push('GDS mode: control-mode indicator is not inside #gds-root');
  if (gdsOrbit.dataMode !== 'orbit' || gdsOrbit.label !== 'ORBIT') failures.push(`GDS mode: mode is ${gdsOrbit.dataMode}/${gdsOrbit.label}`);
  if (gdsOrbit.dragLabel !== 'DRAG: FOLLOW CURSOR' || gdsOrbit.pressed !== 'false') failures.push('GDS mode: drag toggle state is wrong');
  if (gdsOrbit.actionLabel !== 'ENTER SURFACE') failures.push(`GDS mode: action is "${gdsOrbit.actionLabel}"`);
  await gdsPage.click('#btn-drag-mode');
  await sleep(150);
  const gdsReverse = await gdsSnap();
  if (gdsReverse.dragLabel !== 'DRAG: REVERSE' || gdsReverse.pressed !== 'true') failures.push('GDS mode: drag toggle did not reverse');
  await gdsPage.click('#btn-control-mode');
  await gdsPage.waitForFunction(() => document.getElementById('control-mode')?.dataset.mode === 'surface', null, { timeout: 15000 });
  const gdsSurface = await gdsSnap();
  if (gdsSurface.dataMode !== 'surface' || gdsSurface.actionLabel !== 'RETURN TO ORBIT') failures.push(`GDS mode: surface action/label wrong (${gdsSurface.dataMode}/${gdsSurface.actionLabel})`);
  await gdsPage.click('#btn-control-mode');
  await gdsPage.waitForFunction(() => window.__ICOSA__.controlMode().mode === 'orbit', null, { timeout: 12000 });
  if (gdsErrors.length) failures.push(`GDS mode console errors: ${gdsErrors.slice(0, 2).join(' | ')}`);
  const gdsEvidence = { orbit: gdsOrbit, reverse: gdsReverse, surface: gdsSurface };
  await gdsPage.close();

  // Three viewports: visible, 44px targets, no overlap with score/NAV/badge.
  const viewports = [
    [1440, 900, 'desktop'],
    [390, 844, 'mobile'],
    [792, 302, 'short'],
  ];
  const layout = [];
  for (const [width, height, name] of viewports) {
    await page.setViewportSize({ width, height });
    await sleep(350);
    const snap = await page.evaluate(() => {
      const box = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (!r.width || !r.height || style.display === 'none' || style.visibility === 'hidden') return null;
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        control: box('control-mode'),
        score: box('hud-score'),
        nav: box('nav-chip'),
        badge: box('planet-badge'),
        drag: box('btn-drag-mode'),
        action: box('btn-control-mode'),
        inner: { width: innerWidth, height: innerHeight },
      };
    });
    if (!snap.control) failures.push(`${name}: control-mode indicator is not visible`);
    if (!snap.drag || snap.drag.height < 44) failures.push(`${name}: drag toggle is under 44px`);
    if (!snap.action || snap.action.height < 44) failures.push(`${name}: mode action is under 44px`);
    const withScore = overlap(snap.control, snap.score);
    const withNav = overlap(snap.control, snap.nav);
    const withBadge = overlap(snap.control, snap.badge);
    if (withScore > 1 || withNav > 1 || withBadge > 1) failures.push(`${name}: indicator overlaps score/nav/badge`);
    if (snap.control && (snap.control.right > snap.inner.width + 1 || snap.control.bottom > snap.inner.height + 1)) {
      failures.push(`${name}: indicator is clipped by the viewport`);
    }
    layout.push({ name, width, height, control: snap.control, overlaps: { score: Math.round(withScore), nav: Math.round(withNav), badge: Math.round(withBadge) } });
    await page.screenshot({ path: path.join(shotsDir, `control-mode-${name}.jpg`), type: 'jpeg', quality: 82 });
  }

  for (const err of consoleErrors) failures.push(`console error: ${err}`);
  finished = true;
  await finish({
    issue: 'CTL-05',
    preJoin,
    orbit: { mode: orbit.mode, label: orbit.label, dragLabel: orbit.dragLabel, action: orbit.actionLabel },
    reversed: { dragLabel: reversed.dragLabel, pressed: reversed.pressed, storage: reversed.storage, announcements: toggleAnnouncements },
    surface: { mode: surface.mode, action: surface.actionLabel, announcements: surfaceAnnouncements },
    afterReload: { dragLabel: afterReload.dragLabel, storage: afterReload.storage },
    layout,
    gds: gdsEvidence,
    screenshots: ['media/ctl/control-mode-desktop.jpg', 'media/ctl/control-mode-mobile.jpg', 'media/ctl/control-mode-short.jpg'],
    consoleErrors,
    failures,
  });
} catch (err) {
  finished = true;
  failures.push(`acceptance crashed: ${err && err.message ? err.message : String(err)}`);
  await finish({ issue: 'CTL-05', failures, serverLog: server.log().slice(-1200) });
} finally {
  await browser.close();
  await server.stop();
}
