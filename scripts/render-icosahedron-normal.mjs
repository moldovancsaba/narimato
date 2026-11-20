/** Clean solid icosahedron: 20 faces, opaque, backface-culled, no hidden edges. */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
await delay(400);

const dataUrl = await page.evaluate(async () => {
  const { baseIcosahedron } = await import('/js/shared/geometry.js');
  const { vertices, faces } = baseIcosahedron();
  const W = 1200, H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080b16';
  ctx.fillRect(0, 0, W, H);

  const rotY = 0.55, rotX = 0.28;
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const rotate = (v) => {
    const x1 = v.x * cy - v.z * sy;
    const z1 = v.x * sy + v.z * cy;
    const y1 = v.y * cx - z1 * sx;
    const z2 = v.y * sx + z1 * cx;
    return { x: x1, y: y1, z: z2 };
  };
  const scale = W * 0.32;
  const project = (v) => ({ x: W / 2 + v.x * scale, y: H / 2 - v.y * scale, z: v.z });
  const rotated = vertices.map(rotate);
  const tris = [];
  for (const [ia, ib, ic] of faces) {
    const a = rotated[ia], b = rotated[ib], c = rotated[ic];
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nz <= 0) continue; // backface cull: no hidden triangles/edges
    const len = Math.hypot(nx, ny, nz) || 1;
    const light = Math.max(0.22, (nx * -0.35 + ny * 0.55 + nz * 0.76) / len);
    const z = (a.z + b.z + c.z) / 3;
    tris.push({ a: project(a), b: project(b), c: project(c), z, light });
  }
  tris.sort((p, q) => p.z - q.z);
  for (const tri of tris) {
    const r = Math.round(38 + 90 * tri.light);
    const g = Math.round(92 + 130 * tri.light);
    const b = Math.round(118 + 120 * tri.light);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.moveTo(tri.a.x, tri.a.y);
    ctx.lineTo(tri.b.x, tri.b.y);
    ctx.lineTo(tri.c.x, tri.c.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,14,24,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
});
await fs.mkdir('media', { recursive: true });
await fs.writeFile('media/icosahedron-normal.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(JSON.stringify({ file: 'media/icosahedron-normal.png', errors }));
await browser.close();
if (errors.length) process.exitCode = 1;
