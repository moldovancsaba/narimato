/**
 * Orbital supply focus: a supply event focuses/zooms the camera to the impact.
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node this
 */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
await delay(500);
await page.fill('#tag-input', 'SUPPLY');
await page.click('#btn-join');
await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
await delay(800);
const before = await page.evaluate(() => ({ zoom: window.__ICOSA__.camera.zoom, label: window.__ICOSA__.leavesSnapshot()[0][0] }));
await page.evaluate((label) => window.__ICOSA__.supplyEvent({ impactLabel: label, cells: [], message: 'TEST DROP' }), before.label);
await delay(1400);
const after = await page.evaluate(() => ({ zoom: window.__ICOSA__.camera.zoom }));
console.log(JSON.stringify({ before, after, errors }, null, 2));
await browser.close();
if (errors.length || after.zoom <= before.zoom) process.exitCode = 1;
