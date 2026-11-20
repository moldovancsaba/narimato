/**
 * CTL-04 acceptance: exit to the farthest orbit with HUD restoration.
 *
 * Every exit path (RETURN TO ORBIT button, Escape, browser/mobile back) must end
 * at zoom === ORBIT_FAR_ZOOM with the orbital HUD restored, the overlay gone and
 * focus on the orbit control. Exit is single-flight.
 *
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-surface-exit.mjs
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (/favicon/i.test(text) || /404 \(Not Found\)/.test(text) || /409 \(Conflict\)/.test(text)) return;
  consoleErrors.push(text);
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const exitState = () => page.evaluate(() => ({
  result: window.__ICOSA__.surfaceExitResult(),
  zoom: window.__ICOSA__.camera.zoom,
  zoomTarget: window.__ICOSA__.cameraInertia().zoomTarget,
  zoomLevel: window.__ICOSA__.zoomLevel().level,
  hudAria: document.getElementById('hud')?.getAttribute('aria-hidden'),
  overlay: !!document.getElementById('surface-overlay'),
  activeFocus: document.activeElement ? document.activeElement.id : null,
  mode: window.__ICOSA__.controlMode().mode,
  url: location.href,
}));

async function waitExit() {
  return page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const step = () => {
      const result = window.__ICOSA__.surfaceExitResult();
      if (result || frames > 600) { resolve(result); return; }
      frames += 1;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
}

async function enterSurface() {
  await page.evaluate(() => window.__ICOSA__.surface());
  await page.waitForFunction(() => window.__ICOSA__.surfaceMode().phase === 'walking', null, { timeout: 12000 });
  await sleep(200);
}

function auditExit(name, state) {
  if (!state.result) failures.push(`${name}: no surfaceExitResult was recorded`);
  if (state.zoom !== 0.4) failures.push(`${name}: camera.zoom ${state.zoom} is not ORBIT_FAR_ZOOM (0.4)`);
  if (state.result && state.result.zoom !== 0.4) failures.push(`${name}: result.zoom ${state.result.zoom} is not 0.4`);
  if (state.zoomTarget !== null) failures.push(`${name}: zoom target still animating (${state.zoomTarget})`);
  if (state.result && state.result.overlayRemoved !== true) failures.push(`${name}: overlayRemoved is false`);
  if (state.overlay) failures.push(`${name}: #surface-overlay survived the exit`);
  if (state.hudAria === 'true') failures.push(`${name}: HUD stayed aria-hidden="true"`);
  if (state.result && state.result.hudVisible !== true) failures.push(`${name}: hudVisible is false`);
  if (!state.result || !state.result.focusTarget) failures.push(`${name}: focus did not land on an orbit control`);
  if (!['btn-control-mode', 'hud-zoom', 'hud'].includes(state.activeFocus)) failures.push(`${name}: focus is on "${state.activeFocus}"`);
  if (state.mode !== 'orbit') failures.push(`${name}: control mode is ${state.mode}, expected orbit`);
  if (state.zoomLevel !== 0) failures.push(`${name}: zoom level ${state.zoomLevel} is not 0`);
}

try {
  await page.addInitScript(() => { try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private */ } });
  await page.goto(`${server.base}/?gds=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.fill('#tag-input', 'EXIT');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);

  /* 1. RETURN TO ORBIT button */
  await enterSurface();
  await page.click('#btn-surface-exit');
  await waitExit();
  await sleep(250);
  const byButton = await exitState();
  auditExit('button', byButton);
  await page.screenshot({ path: path.join(shotsDir, 'exit-button.jpg'), type: 'jpeg', quality: 82 });

  /* 2. Escape */
  await enterSurface();
  await page.keyboard.press('Escape');
  await waitExit();
  await sleep(250);
  const byEscape = await exitState();
  auditExit('escape', byEscape);
  await page.screenshot({ path: path.join(shotsDir, 'exit-escape.jpg'), type: 'jpeg', quality: 82 });

  /* 3. browser / mobile back (popstate) */
  await enterSurface();
  const urlBefore = page.url();
  await page.evaluate(() => history.back());
  await waitExit();
  await sleep(250);
  const byBack = await exitState();
  auditExit('back', byBack);
  if (!page.url().startsWith(server.base)) failures.push('back navigated away from the game instead of exiting the surface');
  await page.screenshot({ path: path.join(shotsDir, 'exit-back.jpg'), type: 'jpeg', quality: 82 });

  /* 4. single-flight: exiting from orbit is a no-op */
  const repeat = await page.evaluate(() => ({
    first: window.__ICOSA__.exitSurface(),
    second: window.__ICOSA__.exitSurface(),
    mode: window.__ICOSA__.controlMode().mode,
  }));
  if (repeat.first !== false || repeat.second !== false) failures.push('exitSurface() is not single-flight outside surface mode');
  if (repeat.mode !== 'orbit') failures.push('repeat exit changed the control mode');

  for (const err of consoleErrors) failures.push(`console error: ${err}`);
  finished = true;
  await finish({
    issue: 'CTL-04',
    paths: {
      button: { result: byButton.result, zoom: byButton.zoom, focus: byButton.activeFocus },
      escape: { result: byEscape.result, zoom: byEscape.zoom, focus: byEscape.activeFocus },
      back: { result: byBack.result, zoom: byBack.zoom, focus: byBack.activeFocus, stayedOnPage: true },
    },
    screenshots: ['media/ctl/exit-button.jpg', 'media/ctl/exit-escape.jpg', 'media/ctl/exit-back.jpg'],
    consoleErrors,
    failures,
  });
} catch (err) {
  finished = true;
  failures.push(`acceptance crashed: ${err && err.message ? err.message : String(err)}`);
  await finish({ issue: 'CTL-04', failures, serverLog: server.log().slice(-1200) });
} finally {
  await browser.close();
  await server.stop();
}
