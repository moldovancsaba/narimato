#!/usr/bin/env node
/** v2 pointer/cursor acceptance: cursor states + grabbed-point follow. */
import { chromium } from 'playwright';
import { startV2Server } from '../../v2/server.js';

const server = await startV2Server({ port: 0, quiet: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const cursor0 = await page.evaluate(() => window.__v2.cursor());
await page.mouse.move(600, 400);
const cursorHover = await page.evaluate(() => window.__v2.cursor());
await page.mouse.down();
const cursorDown = await page.evaluate(() => window.__v2.cursor());
await page.evaluate(() => { window.__grabbed = window.__v2.screenToSphere(600, 400, window.__v2.camera()); });
await page.mouse.move(780, 300, { steps: 12 });
await page.waitForTimeout(150);
const moved = await page.evaluate(() => {
  const p = window.__v2.camera().project(window.__grabbed);
  return { x: p.x, y: p.y };
});
await page.mouse.up();
const cursorUp = await page.evaluate(() => window.__v2.cursor());

await browser.close();
await server.close();
const err = Math.hypot(moved.x - 780, moved.y - 300);
const result = { cursor0, cursorHover, cursorDown, cursorUp, target: { x: 780, y: 300 }, projected: moved, errorPx: err, errors };
console.log(JSON.stringify(result, null, 2));
const ok = cursor0 === 'grab' && cursorHover === 'grab' && cursorDown === 'grabbing' && cursorUp === 'grab' && err < 12 && errors.length === 0;
console.log(ok ? 'PASS pointer/cursor acceptance' : 'FAIL pointer/cursor acceptance');
process.exitCode = ok ? 0 : 1;
