/** Verifies camera carrier behaviour: fixed radius, camera-only cursor keys, object-only mouse. */
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

const read = () => page.evaluate(() => {
  const v = window.__ICOSA_VIEW__;
  const axis = v.camera.viewAxis();
  return {
    q: v.camera._q,
    axis,
    distance: v.camera.distance,
    carrier: { x: axis.x * v.camera.distance, y: axis.y * v.camera.distance, z: axis.z * v.camera.distance },
    objectQ: v.objectQ(),
  };
});
const before = await read();
await page.keyboard.press('ArrowUp');
await delay(80);
const afterUp = await read();
for (let i = 0; i < 120; i += 1) await page.keyboard.press('ArrowUp');
await delay(120);
const afterLoop = await read();

const mouseRef = afterLoop;
await page.mouse.move(370, 458);
await page.mouse.down();
await page.mouse.move(490, 538, { steps: 20 });
await page.mouse.up();
await delay(180);
const afterMouse = await read();

const qNorm = (q) => Math.hypot(q.x, q.y, q.z, q.w);
const objDifferent = Math.hypot(afterMouse.objectQ.x - mouseRef.objectQ.x, afterMouse.objectQ.y - mouseRef.objectQ.y, afterMouse.objectQ.z - mouseRef.objectQ.z, afterMouse.objectQ.w - mouseRef.objectQ.w);
const camSame = Math.hypot(afterMouse.q.x - mouseRef.q.x, afterMouse.q.y - mouseRef.q.y, afterMouse.q.z - mouseRef.q.z, afterMouse.q.w - mouseRef.q.w);
const result = {
  beforeDistance: before.distance,
  afterUpDistance: afterUp.distance,
  afterLoopDistance: afterLoop.distance,
  beforeCarrierLength: Math.hypot(before.carrier.x, before.carrier.y, before.carrier.z),
  afterCarrierLength: Math.hypot(afterUp.carrier.x, afterUp.carrier.y, afterUp.carrier.z),
  qNorm: qNorm(afterLoop.q),
  objectChangedByMouse: objDifferent > 1e-6,
  cameraChangedByMouse: camSame > 1e-6,
  cameraDelta: camSame,

  errors,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
let failed = errors.length > 0;
if (Math.abs(result.beforeDistance - result.afterUpDistance) > 1e-12) failed = true;
if (Math.abs(result.beforeDistance - result.afterLoopDistance) > 1e-12) failed = true;
if (Math.abs(result.beforeCarrierLength - result.beforeDistance) > 1e-9) failed = true;
if (Math.abs(result.afterCarrierLength - result.afterUpDistance) > 1e-9) failed = true;
if (Math.abs(result.qNorm - 1) > 1e-9) failed = true;
if (!result.objectChangedByMouse) failed = true;
if (result.cameraChangedByMouse) failed = true;
if (failed) process.exitCode = 1;
