#!/usr/bin/env node
/**
 * v2 camera acceptance: measure the first surface row (planet top / horizon) at all four steps.
 * Target: Step 1 planet top 25%; Steps 2–4 horizon 25% ±1% of viewport height.
 * Run against the local authoritative v2 server: node scripts/acceptance/v2-camera-horizon.mjs
 */
import { chromium } from 'playwright';
import { startV2Server } from '../../v2/server.js';

const rows = [];
const server = await startV2Server({ port: 0, quiet: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

for (let step = 0; step < 4; step += 1) {
  await page.goto(`http://127.0.0.1:${server.port}/?phase=${step}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400 + step * 250);
  const measurement = await page.evaluate(() => {
    const planet = document.getElementById('planet-canvas');
    const overlay = document.getElementById('game-canvas');
    const W = planet.width, H = planet.height;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const ctx = off.getContext('2d');
    ctx.drawImage(planet, 0, 0, W, H);
    ctx.drawImage(overlay, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    let first = null;
    let centerSurface = 0;
    for (let y = 0; y < H; y += 1) {
      let n = 0;
      for (let x = 0; x < W; x += 4) {
        const i = (y * W + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (g > r + 10 && g > 40 && b > g * 0.5) n += 1;
      }
      if (first === null && n > 4) first = y;
      if (y === Math.floor(H * 0.5) && n > W / 6) centerSurface += n;
    }
    return { firstRowPct: first === null ? null : (first / H) * 100, centerSurface };
  });
  rows.push({ step, ...measurement });
}

await browser.close();
await server.close();
console.log(JSON.stringify({ rows, errors }, null, 2));

const expected = [25, 25, 25, 25];
let failures = 0;
for (let i = 0; i < rows.length; i += 1) {
  const value = rows[i].firstRowPct;
  const ok = value !== null && Math.abs(value - expected[i]) <= 1;
  console.log(`step ${i + 1}: first surface row ${value === null ? 'not found' : value.toFixed(2) + '%'} ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failures += 1;
}
if (errors.length) failures += 1;
process.exitCode = failures ? 1 : 0;
