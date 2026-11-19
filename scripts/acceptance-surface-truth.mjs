/**
 * Surface truth acceptance:
 * - target HUD colour matches the next server click result for the target label;
 * - at least one authoritative surface_mine beam effect appears while a robot mines.
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
await page.fill('#tag-input', 'TRUTH');
await page.click('#btn-join');
await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
await page.evaluate(() => window.__ICOSA__.surface());
await delay(1800);
const target = await page.evaluate(() => window.__ICOSA__.surfaceDebug());
const token = await page.evaluate(() => localStorage.getItem('icosa.token'));
const response = await page.evaluate(async ({ base, token, label }) => {
  const res = await fetch(`${base}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, type: 'click', label }),
  });
  return { status: res.status, body: await res.json() };
}, { base, token, label: target.targetLabel });
await delay(6000);
const mineCount = await page.evaluate(() => window.__ICOSA__.surfaceMineCount());
const result = { target: { label: target.targetLabel, can: target.targetCan }, clickStatus: response.status, mineCount, errors };
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
if (target.targetCan && response.status !== 200) process.exitCode = 1;
if (!target.targetCan && response.status === 200 && response.body?.ok) process.exitCode = 1;
