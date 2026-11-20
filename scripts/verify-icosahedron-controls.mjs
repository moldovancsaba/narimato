/**
 * Confirms the two required behaviours numerically:
 *  1. A mouse-dragged surface point follows the cursor (error < 0.01 px).
 *  2. Cursor Up moves the camera straight down its fixed-radius orbit.
 */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(`${base}/icosahedron.html`, { waitUntil: 'networkidle' });
await delay(400);

// 1) Point follows the mouse exactly.
const start = await page.evaluate(() => {
  const pr = window.__ICOSA_VIEW__.project(window.__ICOSA_VIEW__.vertices[4]);
  return { x: pr.x, y: pr.y };
});
const target = { x: start.x + 120, y: start.y + 80 };
await page.mouse.move(start.x, start.y);
await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 25 });
await page.mouse.up();
await delay(250);
const follow = await page.evaluate(() => {
  const pr = window.__ICOSA_VIEW__.project(window.__ICOSA_VIEW__.vertices[4]);
  return { x: pr.x, y: pr.y };
});
const errX = Math.abs(follow.x - target.x);
const errY = Math.abs(follow.y - target.y);

// 2) Cursor Up: camera descends along the orbit, no horizontal drift.
const beforeOrbit = await page.evaluate(() => window.__ICOSA_VIEW__.orbit());
await page.keyboard.press('ArrowUp');
await delay(150);
const afterOrbit = await page.evaluate(() => window.__ICOSA_VIEW__.orbit());

const result = { errX, errY, beforeOrbit, afterOrbit, errors };
console.log(JSON.stringify(result, null, 2));
await browser.close();

let failed = false;
if (errors.length) failed = true;
if (errX > 0.01 || errY > 0.01) failed = true;
if (Math.abs(afterOrbit.yaw - beforeOrbit.yaw) > 1e-9) failed = true;
if (!(afterOrbit.pitch < beforeOrbit.pitch)) failed = true;
if (failed) process.exitCode = 1;
