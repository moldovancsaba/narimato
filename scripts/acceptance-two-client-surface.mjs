/**
 * Two-client surface acceptance: both humans see each other and the robot on
 * the same crust, and the robot publishes a server pose.
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node this
 */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

const browser = await chromium.launch({ headless: true });
const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
const pages = await Promise.all(contexts.map((context) => context.newPage()));
const errors = [];
for (const [i, page] of pages.entries()) {
  page.on('pageerror', (err) => errors.push(`p${i}: ${err.message}`));
  await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await delay(500);
  await page.fill('#tag-input', `DUO${i + 1}`);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
  await page.evaluate(() => window.__ICOSA__.surface());
  await delay(1800);
  await page.click('#btn-surface-exit').catch(() => {});
  // Re-enter after the initial landing animation so both have active poses.
  await delay(400);
  await page.evaluate(() => window.__ICOSA__.surface());
  await delay(1200);
}

const peers = [];
const robots = [];
for (const page of pages) {
  peers.push(await page.evaluate(() => window.__ICOSA__.surfacePeers()));
  robots.push(await page.evaluate(() => (window.__ICOSA__.state?.players || []).filter((p) => p.surface)));
}
const result = {
  peers: peers.map((list) => list.map((p) => p.tag)),
  robots: robots.map((list) => list.map((r) => ({ tag: r.tag, pos: r.surface?.pos }))),
  errors,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
