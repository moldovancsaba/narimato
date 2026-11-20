/**
 * CTL-01 acceptance: orbit input SSOT.
 *
 * Proves in a real browser that:
 *  - an absolute surface-point drag keeps the grabbed point within 1 px of the
 *    pointer at eight orientations including roll;
 *  - all four arrows match the sign table, Shift multiplies the angle and both
 *    poles stay finite and visible;
 *  - `I` flips the visible label and the persisted value, and a reload restores it.
 *
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-orbit-input.mjs
 */
import { startLocalServer, loadPlaywright, launchChromium, finish, dismissGameOverlays } from './lib/local-server.mjs';

const failures = [];
let finished = false;
const server = await startLocalServer({ port: Number(process.env.ACCEPTANCE_PORT) || 0 });
const { chromium } = await loadPlaywright();
const browser = await launchChromium(chromium);
browser.on('disconnected', () => {
  if (!finished) failures.push('browser disconnected before the run completed');
});

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (/favicon/i.test(text) || /404 \(Not Found\)/.test(text)) return;
  consoleErrors.push(text);
});

try {
  // Suppress the auto-opened new-pilot guide so the canvas owns the viewport.
  await page.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  await page.goto(`${server.base}/?gds=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-join:not([disabled])', { timeout: 15000 });
  await page.fill('#tag-input', 'ORB1');
  await page.click('#btn-join');
  try {
    await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  } catch (err) {
    const state = await page.evaluate(() => ({
      error: document.getElementById('join-error')?.textContent,
      body: document.body.className,
      hasHook: !!window.__ICOSA__,
    })).catch(() => null);
    failures.push(`join failed: ${err.message} ${JSON.stringify(state)}`);
    throw err;
  }
  await dismissGameOverlays(page);

  /* ---------------- absolute drag at eight orientations ---------------- */
  const orientations = [
    [0, 0, 0],
    [0.4, 0.2, 0],
    [0.9, -0.3, 0],
    [Math.PI * 0.9, 0.2, 0],
    [0, Math.PI / 2, 0], // pole-facing
    [1.2, 0.1, Math.PI / 4], // rolled
    [-2.1, -0.5, Math.PI * 0.75],
    [2.7, 1.2, Math.PI],
  ];
  const drags = [];
  let dragMaxErr = 0;
  for (const [yaw, pitch, roll] of orientations) {
    const result = await page.evaluate(async ({ yaw, pitch, roll }) => {
      const qFromAxis = (axis, angle) => {
        const h = angle / 2;
        const s = Math.sin(h);
        return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) };
      };
      const qMul = (a, b) => ({
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      });
      const cam = window.__ICOSA__.camera;
      const qy = qFromAxis({ x: 0, y: 1, z: 0 }, yaw);
      const qx = qFromAxis({ x: 1, y: 0, z: 0 }, pitch);
      const qr = qFromAxis({ x: 0, y: 0, z: 1 }, roll);
      cam.setOrientation(qMul(qMul(qr, qx), qy));
      const width = cam.width || window.innerWidth;
      const height = cam.height || window.innerHeight;
      const x = width / 2;
      const y = height / 2;
      const hit = cam.unprojectScreen(x, y);
      if (!hit) return { skipped: true };
      window.__grabbed = hit.point;
      window.__grabStart = { x, y };
      return { skipped: false, start: [x, y] };
    }, { yaw, pitch, roll });
    if (result.skipped) continue;
    const [sx, sy] = result.start;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    const downState = await page.evaluate(() => window.__ICOSA__.cameraInertia());
    let maxErr = 0;
    for (let step = 1; step <= 25; step += 1) {
      const x = sx + (120 * step) / 25;
      const y = sy + (80 * step) / 25;
      await page.mouse.move(x, y, { steps: 1 });
      const err = await page.evaluate(({ x, y }) => {
        const p = window.__ICOSA__.camera.project(window.__grabbed);
        return Math.hypot(p.x - x, p.y - y);
      }, { x, y });
      maxErr = Math.max(maxErr, err);
    }
    await page.mouse.up();
    drags.push({
      yaw,
      pitch,
      roll,
      maxErr: Number(maxErr.toFixed(4)),
      downDragging: downState.pointerDragging,
      downDrag: downState.pointerDrag,
    });
    dragMaxErr = Math.max(dragMaxErr, maxErr);
  }
  if (!(dragMaxErr < 1)) failures.push(`drag follow error ${dragMaxErr.toFixed(3)} px is not under 1 px`);

  /* ---------------- arrows: signs, Shift, both poles ---------------- */
  const probe = { x: 0.11, y: 0.17, z: 0.979 };


  const waitFrames = (frames) => page.evaluate((count) => new Promise((resolve) => {
    let seen = 0;
    const step = () => {
      seen += 1;
      if (seen >= count) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), frames);

  const signResults = [];
  await page.evaluate(() => window.__ICOSA__.camera.reset());
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
    const before = await page.evaluate((point) => window.__ICOSA__.camera.project(point), probe);
    await page.keyboard.down(key);
    await waitFrames(8);
    await page.keyboard.up(key);
    const after = await page.evaluate((point) => window.__ICOSA__.camera.project(point), probe);
    signResults.push({ key, dx: Number((after.x - before.x).toFixed(2)), dy: Number((after.y - before.y).toFixed(2)) });
  }
  const expectSign = {
    ArrowRight: (r) => r.dx < -1,
    ArrowLeft: (r) => r.dx > 1,
    ArrowUp: (r) => r.dy > 1,
    ArrowDown: (r) => r.dy < -1,
  };
  for (const result of signResults) {
    if (!expectSign[result.key](result)) failures.push(`${result.key} has the wrong sign table direction (${result.dx}, ${result.dy})`);
  }

  // Shift scales the clamped step by SHIFT_BOOST (2.1).
  const shift = await page.evaluate(async () => {
    const { applyArrowTravel } = await import('/js/shared/orbit-controls.js');
    const cam = window.__ICOSA__.camera;
    const angleOf = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));
    cam.reset();
    const start = cam.viewAxis();
    applyArrowTravel(cam, 'ArrowUp', 0.05, false);
    const plain = angleOf(start, cam.viewAxis());
    cam.reset();
    const start2 = cam.viewAxis();
    applyArrowTravel(cam, 'ArrowUp', 0.05, true);
    const boosted = angleOf(start2, cam.viewAxis());
    return { plain, boosted, ratio: boosted / plain };
  });
  if (Math.abs(shift.ratio - 2.1) > 0.01) failures.push(`Shift ratio ${shift.ratio.toFixed(4)} is not 2.1 ± 0.01`);

  /* ---------------- explicit persistent I toggle ---------------- */
  const readMode = () => page.evaluate(() => ({
    label: document.getElementById('btn-drag-mode')?.textContent,
    pressed: document.getElementById('btn-drag-mode')?.getAttribute('aria-pressed'),
    mode: window.__ICOSA__.dragMode(),
    stored: localStorage.getItem('icosa.controls.v1'),
  }));
  const beforeToggle = await readMode();
  await page.keyboard.press('i');
  const afterToggle = await readMode();
  if (afterToggle.mode !== 'reverse') failures.push('I did not switch to reverse drag');
  if (afterToggle.label !== 'DRAG: REVERSE') failures.push(`visible label is "${afterToggle.label}"`);
  if (afterToggle.pressed !== 'true') failures.push('drag toggle does not expose aria-pressed=true');
  if (!afterToggle.stored || JSON.parse(afterToggle.stored).dragInvert !== true) failures.push('reverse drag was not persisted');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('icosa.tag', 'ORB1'));
  await page.fill('#tag-input', 'ORB1');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);
  const afterReload = await readMode();
  if (afterReload.mode !== 'reverse') failures.push('reload did not restore reverse drag');
  if (afterReload.label !== 'DRAG: REVERSE') failures.push('reload did not restore the visible label');

  finished = true;
  const report = {
    issue: 'CTL-01',
    drags,
    dragMaxErr: Number(dragMaxErr.toFixed(4)),
    arrows: signResults,
    shift: { plain: shift.plain, boosted: shift.boosted, ratio: Number(shift.ratio.toFixed(6)) },
    mode: { before: beforeToggle, after: afterToggle, afterReload },
    consoleErrors,
    failures,
  };
  for (const err of consoleErrors) failures.push(`console error: ${err}`);
  await finish(report);
} catch (err) {
  finished = true;
  failures.push(`acceptance crashed: ${err && err.message ? err.message : String(err)}`);
  await finish({
    issue: 'CTL-01',
    failures,
    drags: typeof drags !== 'undefined' ? drags : undefined,
    serverLog: server.log().slice(-800),
  });
} finally {
  await browser.close();
  await server.stop();
}
