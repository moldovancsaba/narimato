/**
 * Incident visual acceptance: each of the four incidents opens its overlay and
 * paints a non-empty effect canvas (five-tetra ship / sun / alien visuals).
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
await page.fill('#tag-input', 'EVENTS');
await page.click('#btn-join');
await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
await delay(800);
const kinds = ['meteor', 'nuclear', 'solar', 'alien'];
const results = [];
for (const kind of kinds) {
  await page.evaluate((k) => window.__ICOSA__.incident(k, `${k.toUpperCase()} TEST`, `${k} visual test`, 'test'), kind);
  await delay(350);
  results.push(await page.evaluate((k) => {
    const title = (document.getElementById('meteor-title') || document.getElementById('interlude-title'));
    const canvas = document.getElementById('meteor-fx') || document.getElementById('interlude-fx');
    let pixels = 0;
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, Math.max(1, canvas.width), Math.max(1, canvas.height)).data;
      for (let i = 3; i < data.length; i += 40) if (data[i] > 0) pixels += 1;
    }
    return { kind: k, title: title ? title.textContent : '', pixels };
  }, kind));
  await delay(2700);
}
console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
if (errors.length || results.some((r) => !r.pixels)) process.exitCode = 1;
