/**
 * Interactive spherical icosahedron.
 * - Mouse drag: the grabbed SURFACE POINT follows the cursor exactly.
 * - Cursor keys: the camera carrier moves on a free orbit; Up continues up locally.
 * - Wheel/pinch: changes the carrier sphere radius (dolly).
 */
import { SphereCamera, SPHERE_SCREEN_FRACTION, CAMERA_DISTANCE, baseIcosahedron } from './shared/geometry.js';
import { unprojectSphere as unprojectSurface, shortestArcQuat } from './shared/sphere-interaction.js';

const canvas = document.getElementById('icosa-canvas');
const ctx = canvas.getContext('2d');
const { vertices, faces } = baseIcosahedron();

const W0 = window.innerWidth;
const H0 = window.innerHeight;
const camera = new SphereCamera(W0, H0);
camera.reset();
// Camera carrier sits on a hidden concentric sphere; zoom changes this radius.
let carrierDistance = CAMERA_DISTANCE;
const MIN_DISTANCE = 1.3;
const MAX_DISTANCE = 8.0;

// Object rotation (mouse) as a world-space quaternion.
let objectQ = { x: 0, y: 0, z: 0, w: 1 };

// Camera orbit is a free quaternion; cursor keys rotate it locally with no pole clamp.
const ORBIT_STEP = 28; // px passed to SphereCamera.rotate (0.006 rad/px)

let dpr = 1;
let W = 1;
let H = 1;
let raf = 0;
let pointer = null;
let grab = null; // { p0world, q0 }
const pointers = new Map();
let pinch = 0;

const qNorm = (q) => { const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; return { x: q.x/l, y: q.y/l, z: q.z/l, w: q.w/l }; };
const qMul = (a, b) => ({
  x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
  y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
  z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
  w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
});
const qAxisAngle = (axis, angle) => {
  const l = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const s = Math.sin(angle / 2);
  return { x: axis.x / l * s, y: axis.y / l * s, z: axis.z / l * s, w: Math.cos(angle / 2) };
};
const qRotateVec = (q, v) => {
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const vx = v.x, vy = v.y, vz = v.z;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return {
    x: vx + w * tx + (y * tz - z * ty),
    y: vy + w * ty + (z * tx - x * tz),
    z: vz + w * tz + (x * ty - y * tx),
  };
};
const vecSub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vecCross = (a, b) => ({ x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x });
const vecDot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
const vecNorm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x/l, y: v.y/l, z: v.z/l }; };
const vecAdd = (a, b) => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const vecMul = (a, k) => ({ x: a.x*k, y: a.y*k, z: a.z*k });

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  camera.setViewport(W, H);
}
window.addEventListener('resize', resize);
resize();

/** Screen point -> visible unit-sphere surface point. */
function unprojectSphere(xPx, yPx) {
  return unprojectSurface(camera, xPx, yPx, W, H);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const d = camera.distance;
  const radius = Math.min(W, H) * SPHERE_SCREEN_FRACTION * (d / Math.sqrt(Math.max(1e-6, d * d - 1)));
  const sphere = ctx.createRadialGradient(cx - radius * 0.36, cy - radius * 0.36, radius * 0.08, cx, cy, radius);
  sphere.addColorStop(0, 'rgb(126,210,230)');
  sphere.addColorStop(0.68, 'rgb(57,132,162)');
  sphere.addColorStop(1, 'rgb(29,81,113)');
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const camPos = vecMul(vecNorm(camera.viewAxis()), camera.distance);
  const drawFaces = [];
  for (let fi = 0; fi < faces.length; fi += 1) {
    const [ia, ib, ic] = faces[fi];
    const A = vecNorm(qRotateVec(objectQ, vertices[ia]));
    const B = vecNorm(qRotateVec(objectQ, vertices[ib]));
    const C = vecNorm(qRotateVec(objectQ, vertices[ic]));
    const centroid = vecNorm(vecAdd(vecAdd(A, B), C));
    let normal = vecNorm(vecCross(vecSub(B, A), vecSub(C, A)));
    if (vecDot(normal, centroid) < 0) normal = vecMul(normal, -1);
    // Back-face culling in world space; skip faces that cross the silhouette.
    if (vecDot(normal, vecSub(camPos, centroid)) <= 0) continue;
    if (!camera.project(A).visible || !camera.project(B).visible || !camera.project(C).visible) continue;
    const points = [];
    for (const [p, q] of [[A, B], [B, C], [C, A]]) {
      for (let i = 0; i < 32; i += 1) {
        const t = i / 32;
        const dot = Math.max(-1, Math.min(1, vecDot(p, q)));
        const theta = Math.acos(dot) * t;
        const sin = Math.sin(theta);
        const r = vecSub(q, vecMul(p, dot));
        const rl = Math.hypot(r.x, r.y, r.z) || 1;
        const v = vecNorm(vecAdd(vecMul(p, Math.cos(theta)), vecMul(r, sin / rl)));
        points.push(camera.project(v));
      }
    }
    const depth = camera.project(centroid).z;
    const light = 0.55 + 0.45 * Math.max(0, Math.min(1, vecDot(normal, vecNorm({ x: -0.35, y: 0.55, z: 0.76 }))));
    drawFaces.push({ points, depth, fi, light });
  }
  drawFaces.sort((a, b) => a.depth - b.depth);
  for (const face of drawFaces) {
    const r = Math.round(42 + 76 * face.light);
    const g = Math.round(106 + 100 * face.light);
    const b = Math.round(136 + 86 * face.light);
    ctx.beginPath();
    ctx.moveTo(face.points[0].x, face.points[0].y);
    for (let i = 1; i < face.points.length; i += 1) ctx.lineTo(face.points[i].x, face.points[i].y);
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,16,24,0.92)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Hard silhouette mask: no face fill or edge can exist outside the sphere.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function frame(now) {
  draw();
  raf = requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    pointer = { id: event.pointerId };
    const p0 = unprojectSphere(event.clientX, event.clientY);
    if (p0) grab = { p0, q0: { ...objectQ } };
  } else if (pointers.size === 2) {
    pointer = null;
    grab = null;
    const [p, q] = [...pointers.values()];
    pinch = Math.hypot(p.x - q.x, p.y - q.y);
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2) {
    const [p, q] = [...pointers.values()];
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (pinch > 0 && dist > 0) { carrierDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, carrierDistance * (dist / pinch))); camera.distance = carrierDistance; }
    pinch = dist;
    return;
  }
  if (!pointer || pointer.id !== event.pointerId || !grab) return;
  const p1 = unprojectSphere(event.clientX, event.clientY);
  if (!p1) return;
  // Shared tested shortest-arc rotation from grabbed point to cursor point.
  const delta = shortestArcQuat(grab.p0, p1);
  objectQ = qNorm(qMul(delta, grab.q0));
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  grab = null;
  if (pointers.size === 0) pointer = null;
  else if (pointers.size === 1) {
    const [id, p] = [...pointers.entries()][0];
    pointer = { id };
    pinch = 0;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (event) => {
  switch (event.key) {
    // Local quaternion orbit: same Up direction forever, loops over poles, no clamp.
    case 'ArrowLeft': camera.rotate(-ORBIT_STEP, 0); event.preventDefault(); break;
    case 'ArrowRight': camera.rotate(ORBIT_STEP, 0); event.preventDefault(); break;
    case 'ArrowUp': camera.rotate(0, ORBIT_STEP); event.preventDefault(); break;
    case 'ArrowDown': camera.rotate(0, -ORBIT_STEP); event.preventDefault(); break;
    default: break;
  }
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  carrierDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, carrierDistance * Math.exp(event.deltaY * 0.0012)));
  camera.distance = carrierDistance;
}, { passive: false });

window.__ICOSA_VIEW__ = { camera, objectQ: () => objectQ, vertices, unprojectSphere, project: (v) => camera.project(qRotateVec(objectQ, v)), orbit: () => ({ yaw: camera._yaw, pitch: camera._pitch, q: camera._q, viewAxis: camera.viewAxis() }), setObjectQ: (q) => { objectQ = qNorm(q); } };
