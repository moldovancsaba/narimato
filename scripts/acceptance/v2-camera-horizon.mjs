#!/usr/bin/env node
/**
 * v2 camera acceptance: project the sphere tangent rim and measure the top limb row.
 * Step 1 expected planet top 25%; Steps 2–4 horizon 25% ±1%.
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
  await page.waitForTimeout(1200 + step * 150);
  const row = await page.evaluate(() => {
    const cam = window.__v2.camera();
    const P = cam.origin, H = window.innerHeight;
    const d = Math.hypot(P.x, P.y, P.z);
    const axis = { x: P.x / d, y: P.y / d, z: P.z / d };
    const helper = Math.abs(axis.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    let u = { x: axis.y * helper.z - axis.z * helper.y, y: axis.z * helper.x - axis.x * helper.z, z: axis.x * helper.y - axis.y * helper.x };
    const ul = Math.hypot(u.x, u.y, u.z) || 1;
    u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
    const v = { x: axis.y * u.z - axis.z * u.y, y: axis.z * u.x - axis.x * u.z, z: axis.x * u.y - axis.y * u.x };
    const t = d > 1 ? 1 / d : 1;
    const rim = d > 1 ? Math.sqrt(1 - 1 / (d * d)) : 0;
    let minY = Infinity;
    for (let i = 0; i < 720; i += 1) {
      const a = (i / 720) * Math.PI * 2;
      const p = { x: axis.x * t + rim * (Math.cos(a) * u.x + Math.sin(a) * v.x), y: axis.y * t + rim * (Math.cos(a) * u.y + Math.sin(a) * v.y), z: axis.z * t + rim * (Math.cos(a) * u.z + Math.sin(a) * v.z) };
      const pr = cam.project(p);
      if (pr.visible && pr.depth > 0 && pr.y < minY) minY = pr.y;
    }
    return (minY / H) * 100;
  });
  rows.push({ step, topPct: row });
}

await browser.close();
await server.close();
console.log(JSON.stringify({ rows, errors }, null, 2));
const expected = [25, 25, 25, 25];
let failures = 0;
for (let i = 0; i < rows.length; i += 1) {
  const ok = Math.abs(rows[i].topPct - expected[i]) <= 1;
  console.log(`step ${i + 1}: top limb ${rows[i].topPct.toFixed(2)}% ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failures += 1;
}
if (errors.length) failures += 1;
process.exitCode = failures ? 1 : 0;
