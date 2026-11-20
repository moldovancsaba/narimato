/** Visual acceptance: captures orbit/zoom/upside-down shots and validates canvas coverage. */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const out = 'media';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(`${base}/icosahedron.html`, { waitUntil: 'networkidle' });
await delay(400);

async function stats() {
  return page.evaluate(() => {
    const c = document.getElementById('icosa-canvas');
    return {
      center: window.__ICOSA_VIEW__.pixel(Math.floor(c.width / 2), Math.floor(c.height / 2)),
      corner: window.__ICOSA_VIEW__.pixel(2, 2),
      colored: window.__ICOSA_VIEW__.coloredPixels(),
    };
  });
}
const shots = {};
const distanceBefore = await page.evaluate(() => window.__ICOSA_VIEW__.carrier().distance);
await page.screenshot({ path: `${out}/icosa-view-default.png` });
shots.default = await stats();
await page.mouse.move(600, 600);
await page.mouse.wheel(0, -900);
await delay(300);
await page.screenshot({ path: `${out}/icosa-view-close.png` });
shots.close = await stats();
const distanceAfter = await page.evaluate(() => window.__ICOSA_VIEW__.carrier().distance);
for (let i = 0; i < 80; i += 1) await page.keyboard.press('ArrowUp');
await delay(300);
await page.screenshot({ path: `${out}/icosa-view-upside.png` });
shots.upside = await stats();
const carrier = await page.evaluate(() => window.__ICOSA_VIEW__.carrier());
console.log(JSON.stringify({ shots, distanceBefore, distanceAfter, carrier, errors }, null, 2));
await browser.close();
let failed = errors.length > 0;
if (shots.default.colored < 10000) failed = true;
if (shots.default.corner[0] > 30) failed = true;
// Close dolly legitimately fills the whole viewport, so the corner is sphere.
if (shots.close.colored < 500000) failed = true;
if (shots.upside.colored < 500000) failed = true;
if (!(distanceAfter < distanceBefore)) failed = true;
if (Math.abs(Math.hypot(carrier.pos.x, carrier.pos.y, carrier.pos.z) - 1) > 1e-9) failed = true;
if (failed) process.exitCode = 1;
