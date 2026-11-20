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
    const ctx = c.getContext('2d');
    const center = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    const corner = ctx.getImageData(2, 2, 1, 1).data;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 25 || data[i + 1] > 35 || data[i + 2] > 45) colored += 1;
    }
    return { center: [...center], corner: [...corner], colored };
  });
}
const shots = {};
const distanceBefore = await page.evaluate(() => window.__ICOSA_VIEW__.camera.distance);
await page.screenshot({ path: `${out}/icosa-view-default.png` });
shots.default = await stats();
await page.mouse.wheel(0, -900);
await delay(300);
await page.screenshot({ path: `${out}/icosa-view-close.png` });
shots.close = await stats();
const distanceAfter = await page.evaluate(() => window.__ICOSA_VIEW__.camera.distance);
for (let i = 0; i < 80; i += 1) await page.keyboard.press('ArrowUp');
await delay(300);
await page.screenshot({ path: `${out}/icosa-view-upside.png` });
shots.upside = await stats();
const orbit = await page.evaluate(() => window.__ICOSA_VIEW__.orbit());
console.log(JSON.stringify({ shots, distanceBefore, distanceAfter, orbit, errors }, null, 2));
await browser.close();
let failed = errors.length > 0;
for (const key of ['default', 'close', 'upside']) {
  if (shots[key].colored < 10000) failed = true;
  if (shots[key].corner[0] > 30) failed = true;
}
if (!(distanceAfter < distanceBefore)) failed = true;
if (Math.abs(Math.hypot(orbit.q.x, orbit.q.y, orbit.q.z, orbit.q.w) - 1) > 1e-9) failed = true;
if (failed) process.exitCode = 1;
