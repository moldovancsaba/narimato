/**
 * CTL-02 acceptance: pole continuity and visibility.
 *
 * Holds each arrow for 400 frames while the carrier crosses both poles, samples
 * `renderStats()`, and screenshots every quarter turn. Requires:
 *   emptyFrames === 0, visCount > 0 on every sampled frame, finite view axis,
 *   console-error-free, and at least 2% of the canvas above the backdrop
 *   luminance in every screenshot.
 *
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-pole-continuity.mjs
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

/** Fraction of canvas pixels clearly brighter than the backdrop. */
async function coverage() {
  return page.evaluate(() => {
    const canvas = document.getElementById('arena-canvas');
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let lit = 0;
    let total = 0;
    const stride = 16;
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const i = (y * width + x) * 4;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        total += 1;
        if (lum > 46) lit += 1;
      }
    }
    return total ? lit / total : 0;
  });
}

const samples = [];
try {
  // Suppress the auto-opened new-pilot guide so the canvas owns the viewport.
  await page.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  await page.goto(`${server.base}/?gds=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.fill('#tag-input', 'POLE');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);

  // Cross the north pole, then cross back south, sampling every quarter turn.
  const sequence = [
    ['ArrowUp', 0],
    ['ArrowUp', 1],
    ['ArrowUp', 2],
    ['ArrowUp', 3],
    ['ArrowDown', 4],
    ['ArrowDown', 5],
    ['ArrowDown', 6],
    ['ArrowDown', 7],
  ];
  for (const [key, quarter] of sequence) {
    await page.keyboard.down(key);
    const sample = await page.evaluate(() => new Promise((resolve) => {
      let frames = 0;
      let minVisible = Infinity;
      let maxEmpty = 0;
      let finite = true;
      const step = () => {
        const stats = window.__ICOSA__.renderStats();
        const axis = window.__ICOSA__.camera.viewAxis();
        minVisible = Math.min(minVisible, stats.visCount);
        maxEmpty = Math.max(maxEmpty, stats.emptyFrames);
        if (!Number.isFinite(axis.x) || !Number.isFinite(axis.y) || !Number.isFinite(axis.z)) finite = false;
        frames += 1;
        if (frames >= 100) resolve({ frames, minVisible, maxEmpty, finite });
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }));
    await page.keyboard.up(key);
    const shot = path.join(shotsDir, `pole-q${quarter}.jpg`);
    await page.screenshot({ path: shot, fullPage: false, type: 'jpeg', quality: 82 });
    const cover = await coverage();
    samples.push({
      key,
      quarter,
      frames: sample.frames,
      minVisible: sample.minVisible,
      emptyFrames: sample.maxEmpty,
      finite: sample.finite,
      coverage: Number(cover.toFixed(4)),
      screenshot: path.relative(ROOT, shot),
    });
    if (sample.maxEmpty > 0) failures.push(`${key} q${quarter}: ${sample.maxEmpty} empty frames`);
    if (sample.minVisible <= 0) failures.push(`${key} q${quarter}: no face drawn in at least one frame`);
    if (!sample.finite) failures.push(`${key} q${quarter}: non-finite view axis`);
    if (cover < 0.02) failures.push(`${key} q${quarter}: planet coverage ${(cover * 100).toFixed(2)}% is below 2%`);
  }

  for (const err of consoleErrors) failures.push(`console error: ${err}`);
  finished = true;
  await finish({
    issue: 'CTL-02',
    samples,
    screenshots: samples.map((sample) => sample.screenshot),
    consoleErrors,
    failures,
  });
} catch (err) {
  finished = true;
  failures.push(`acceptance crashed: ${err && err.message ? err.message : String(err)}`);
  await finish({ issue: 'CTL-02', samples, failures, serverLog: server.log().slice(-1200) });
} finally {
  await browser.close();
  await server.stop();
}
