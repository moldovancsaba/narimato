/** Solid spherical icosahedron: same 20 faces, edges projected as great-circle arcs. */
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
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, W, H);

  const rotY = 0.55, rotX = 0.28;
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const rotate = (v) => {
    const x1 = v.x * cy - v.z * sy;
    const z1 = v.x * sy + v.z * cy;
    const y1 = v.y * cx - z1 * sx;
    const z2 = v.y * sx + z1 * cx;
    const l = Math.hypot(x1, y1, z2) || 1;
    return { x: x1 / l, y: y1 / l, z: z2 / l };
  };
  const verts = vertices.map(rotate);
  const scale = W * 0.36;
  const project = (v) => ({ x: W / 2 + v.x * scale, y: H / 2 - v.y * scale, z: v.z });
  const slerp = (a, b, t) => {
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
    const theta = Math.acos(dot) * t;
    const sin = Math.sin(theta);
    const rx = b.x - a.x * dot, ry = b.y - a.y * dot, rz = b.z - a.z * dot;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const c = Math.cos(theta), s = sin / rl;
    return { x: a.x * c + (rx / rl) * sin, y: a.y * c + (ry / rl) * sin, z: a.z * c + (rz / rl) * sin };
  };
  const tris = [];
  for (const [ia, ib, ic] of faces) {
    const A = verts[ia], B = verts[ib], C = verts[ic];
    const ux = B.x - A.x, uy = B.y - A.y, uz = B.z - A.z;
    const vx = C.x - A.x, vy = C.y - A.y, vz = C.z - A.z;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nz <= 0) continue; // hidden back faces removed entirely
    const len = Math.hypot(nx, ny, nz) || 1;
    const light = Math.max(0.24, (nx * -0.35 + ny * 0.5 + nz * 0.79) / len);
    const points = [];
    for (const [p, q] of [[A, B], [B, C], [C, A]]) {
      for (let i = 0; i < 28; i += 1) points.push(project(slerp(p, q, i / 28)));
    }
    tris.push({ points, light, z: (A.z + B.z + C.z) / 3 });
  }
  // Solid sphere base under the 20 spherical faces; silhouette is a clean circle.
  const sphereFill = ctx.createRadialGradient(W/2 - scale*.35, H/2 - scale*.35, scale*.1, W/2, H/2, scale);
  sphereFill.addColorStop(0, 'rgb(120,205,225)');
  sphereFill.addColorStop(0.7, 'rgb(56,130,160)');
  sphereFill.addColorStop(1, 'rgb(28,80,112)');
  ctx.fillStyle = sphereFill;
  ctx.beginPath();
  ctx.arc(W/2, H/2, scale, 0, Math.PI*2);
  ctx.fill();

  // Clip to the sphere silhouette so great-circle face arcs cannot protrude.
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, scale, 0, Math.PI * 2);
  ctx.clip();
  tris.sort((a, b) => a.z - b.z);
  ctx.strokeStyle = 'rgba(7,20,30,0.92)';
  ctx.lineWidth = 2.6;
  for (const tri of tris) {
    // Draw only arc segments on the front hemisphere; no hidden/back edges.
    ctx.beginPath();
    let drawing = false;
    for (const point of tri.points) {
      if (point.z < 0) { drawing = false; continue; }
      if (!drawing) { ctx.moveTo(point.x, point.y); drawing = true; }
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
  ctx.restore();
  return canvas.toDataURL('image/png');
});
await fs.mkdir('media', { recursive: true });
await fs.writeFile('media/icosahedron-sphere.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(JSON.stringify({ file: 'media/icosahedron-sphere.png', errors }));
await browser.close();
if (errors.length) process.exitCode = 1;
