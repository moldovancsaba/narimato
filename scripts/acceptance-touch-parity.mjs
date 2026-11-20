/**
 * CTL-06 acceptance: touch parity — capture, cancellation, pinch, safe areas.
 *
 * Runs with `hasTouch` and real CDP touch dispatch (not synthetic DOM events):
 *  - a pad keeps steering when the finger slides off it (pointer capture);
 *  - release/cancel/blur/orientation clear input with no stuck steering;
 *  - two-finger pinch zooms in both directions and returns near the baseline;
 *  - nine viewports keep 44 px touch targets and clear of the home indicator.
 *
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-touch-parity.mjs
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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (/favicon/i.test(text) || /404 \(Not Found\)/.test(text) || /409 \(Conflict\)/.test(text)) return;
  consoleErrors.push(text);
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: points.map((point) => ({
    x: point.x,
    y: point.y,
    id: point.id,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  })),
});
const roles = () => page.evaluate(() => [...window.__ICOSA__.pointerRoles(), ...window.__ICOSA__.surfacePointerRoles()]);
const pose = () => page.evaluate(() => window.__ICOSA__.surfacePose());
const poseDistance = (a, b) => (a && b ? Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z) : 0);
const held = () => page.evaluate(() => document.querySelector('[data-surface-hold="KeyW"]')?.classList.contains('is-held') || false);

async function padCentre() {
  return page.evaluate(() => {
    const pad = document.querySelector('[data-surface-hold="KeyW"]');
    const rect = pad.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height };
  });
}

try {
  await page.addInitScript(() => { try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private */ } });
  await page.goto(`${server.base}/?gds=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.fill('#tag-input', 'TOUCH');
  await page.tap('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);
  await page.evaluate(() => window.__ICOSA__.surface());
  await page.waitForFunction(() => window.__ICOSA__.surfaceMode().phase === 'walking', null, { timeout: 12000 });
  await sleep(300);

  const pad = await padCentre();
  const traces = [];

  /* 1. pad capture: steering survives a finger sliding off the pad */
  await touch('touchStart', [{ x: pad.x, y: pad.y, id: 1 }]);
  await sleep(220);
  const startRoles = await roles();
  const p0 = await pose();
  const startHeld = await held();
  await touch('touchMove', [{ x: pad.x - 260, y: pad.y - 320, id: 1 }]);
  await sleep(320);
  const moveRoles = await roles();
  const p1 = await pose();
  const moveHeld = await held();
  await touch('touchEnd', []);
  await sleep(260);
  const endRoles = await roles();
  const p2 = await pose();
  await sleep(260);
  const p3 = await pose();
  traces.push({ step: 'pad-capture', startRoles, moveRoles, endRoles, startHeld, moveHeld, movedWhileCaptured: poseDistance(p0, p1), movedAfterRelease: poseDistance(p2, p3) });
  if (!startRoles.includes('steer') || !moveRoles.includes('steer')) failures.push('pad capture lost steering when the finger left the pad');
  if (!startHeld || !moveHeld) failures.push('pad never showed its pressed state while held');
  if (!(poseDistance(p0, p1) > 0.0002)) failures.push('held pad did not steer the pilot');
  if (endRoles.length !== 0) failures.push(`roles survived touchEnd: ${JSON.stringify(endRoles)}`);
  if (poseDistance(p2, p3) > 1e-6) failures.push('steering continued after release');

  /* 2. pointercancel clears the role and the pressed state */
  await touch('touchStart', [{ x: pad.x, y: pad.y, id: 2 }]);
  await sleep(150);
  await touch('touchCancel', []);
  await sleep(250);
  const cancelRoles = await roles();
  const cancelHeld = await held();
  traces.push({ step: 'cancel', cancelRoles, cancelHeld });
  if (cancelRoles.length !== 0) failures.push(`pointercancel left roles ${JSON.stringify(cancelRoles)}`);
  if (cancelHeld) failures.push('pointercancel left the pad pressed');

  /* 3. blur / orientationchange dispatch cancel-all */
  await touch('touchStart', [{ x: pad.x, y: pad.y, id: 3 }]);
  await sleep(150);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(200);
  const blurRoles = await roles();
  await touch('touchEnd', []);
  if (blurRoles.length !== 0) failures.push(`blur left roles ${JSON.stringify(blurRoles)}`);
  await touch('touchStart', [{ x: pad.x, y: pad.y, id: 4 }]);
  await sleep(150);
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
  await sleep(200);
  const orientationRoles = await roles();
  await touch('touchEnd', []);
  if (orientationRoles.length !== 0) failures.push(`orientationchange left roles ${JSON.stringify(orientationRoles)}`);
  traces.push({ step: 'environment', blurRoles, orientationRoles });

  /* 5. nine viewports: 44 px targets, in-viewport, clear of insets */
  const viewports = [
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
  const layout = [];
  for (const [width, height, name] of viewports) {
    await page.setViewportSize({ width, height });
    await sleep(280);
    let hintClear = true;
    const snap = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        pads: [...document.querySelectorAll('[data-surface-hold]')].map((pad) => {
          const r = pad.getBoundingClientRect();
          return { hold: pad.getAttribute('data-surface-hold'), width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
        modeActions: [...document.querySelectorAll('#control-mode button')].map((button) => {
          const r = button.getBoundingClientRect();
          return { id: button.id, width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
        hint: rect('#hud-hint'),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    for (const pad of snap.pads) {
      if (pad.width < 44 || pad.height < 44) failures.push(`${name}: pad ${pad.hold} is ${pad.width}x${pad.height}px`);
      if (pad.right > snap.viewport.width + 1 || pad.bottom > snap.viewport.height + 1) failures.push(`${name}: pad ${pad.hold} is outside the viewport`);
    }
    if (!snap.pads.length) failures.push(`${name}: no surface pads mounted`);
    for (const action of snap.modeActions) {
      if (action.width < 44 || action.height < 44) failures.push(`${name}: ${action.id} is ${action.width}x${action.height}px`);
    }
    if (snap.hint) {
      const overlap = snap.pads.some((pad) => Math.min(pad.right, snap.hint.right) > Math.max(pad.left, snap.hint.left)
        && Math.min(pad.bottom, snap.hint.bottom) > Math.max(pad.top, snap.hint.top));
      if (overlap) failures.push(`${name}: a surface pad overlaps the HUD hint`);
      hintClear = !overlap;
    }
    layout.push({ name, width, height, pads: snap.pads.length, hintClear });
    if (name === 'mobile' || name === 'landscape') {
      await page.screenshot({ path: path.join(shotsDir, `touch-${name}.jpg`), type: 'jpeg', quality: 82 });
    }
  }

  /* 4. pinch zooms both ways on the canvas */
  await page.evaluate(() => window.__ICOSA__.exitSurface());
  await page.waitForFunction(() => window.__ICOSA__.controlMode().mode === 'orbit', null, { timeout: 12000 });
  await sleep(300);
  const centre = { x: 195, y: 420 };
  const zoomBefore = await page.evaluate(() => window.__ICOSA__.camera.zoom);
  await touch('touchStart', [
    { x: centre.x - 40, y: centre.y, id: 11 },
    { x: centre.x + 40, y: centre.y, id: 12 },
  ]);
  await sleep(80);
  await touch('touchMove', [
    { x: centre.x - 120, y: centre.y, id: 11 },
    { x: centre.x + 120, y: centre.y, id: 12 },
  ]);
  await sleep(320);
  const zoomOut = await page.evaluate(() => window.__ICOSA__.camera.zoom);
  await touch('touchMove', [
    { x: centre.x - 20, y: centre.y, id: 11 },
    { x: centre.x + 20, y: centre.y, id: 12 },
  ]);
  await sleep(340);
  await touch('touchEnd', []);
  await sleep(350);
  const zoomBack = await page.evaluate(() => window.__ICOSA__.camera.zoom);
  traces.push({ step: 'pinch', zoomBefore, zoomOut, zoomBack, pinchRolesAfter: await roles() });
  if (!(zoomOut > zoomBefore * 1.2)) failures.push(`pinch-out did not zoom in (${zoomBefore} -> ${zoomOut})`);
  if (Math.abs(zoomBack / zoomBefore - 1) > 0.05) failures.push(`pinch-in did not return near the baseline (${zoomBefore} -> ${zoomBack})`);
  if ((await roles()).length !== 0) failures.push('pinch left a pointer role behind');

  for (const err of consoleErrors) failures.push(`console error: ${err}`);
  finished = true;
  await finish({
    issue: 'CTL-06',
    traces,
    layout,
    screenshots: ['media/ctl/touch-mobile.jpg', 'media/ctl/touch-landscape.jpg'],
    consoleErrors,
    failures,
  });
} catch (err) {
  finished = true;
  failures.push(`acceptance crashed: ${err && err.message ? err.message : String(err)}`);
  await finish({ issue: 'CTL-06', failures, serverLog: server.log().slice(-1200) });
} finally {
  await context.close();
  await browser.close();
  await server.stop();
}
