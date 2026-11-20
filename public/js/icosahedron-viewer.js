/**
 * Interactive spherical icosahedron with the game's quaternion camera physics.
 * Exactly 20 great-circle face edges; solid sphere; no stars/halo/HUD.
 */
import { SphereCamera, SPHERE_SCREEN_FRACTION, baseIcosahedron } from './shared/geometry.js';
import { beginTrackball, dragTrackball, applyArrowKey } from './shared/orbit-controls.js';

const canvas = document.getElementById('icosa-canvas');
const ctx = canvas.getContext('2d');
const width0 = window.innerWidth;
const height0 = window.innerHeight;
// Three independent transforms:
// objectCam = mouse-rotated object
// orbitCam  = cursor-keyed camera orbit around the object
// renderCam = composed view used only for projection
const objectCam = new SphereCamera(width0, height0);
const orbitCam = new SphereCamera(width0, height0);
const renderCam = new SphereCamera(width0, height0);
objectCam.reset();
orbitCam.reset();
renderCam.reset();
const { vertices, faces } = baseIcosahedron();

const qMul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const qNormalize = (q) => {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
};

let dpr = 1;
let W = 1;
let H = 1;
let raf = 0;
let last = performance.now();
let spin = { x: 0, y: 0 };
let pointer = null;
const pointers = new Map();
let pinch = 0;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  objectCam.setViewport(W, H);
  orbitCam.setViewport(W, H);
  renderCam.setViewport(W, H);
}
window.addEventListener('resize', resize);
resize();

function slerp(a, b, t) {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const theta = Math.acos(d) * t;
  const rx = b.x - a.x * d;
  const ry = b.y - a.y * d;
  const rz = b.z - a.z * d;
  const rl = Math.hypot(rx, ry, rz) || 1;
  const c = Math.cos(theta);
  const s = Math.sin(theta) / rl;
  return { x: a.x * c + rx * s, y: a.y * c + ry * s, z: a.z * c + rz * s };
}

function draw() {
  // Compose camera orbit with object rotation. Rendered view = orbit * object.
  renderCam._q = qNormalize(qMul(orbitCam._q, objectCam._q));
  renderCam.zoom = orbitCam.zoom;
  renderCam.width = W; renderCam.height = H;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * SPHERE_SCREEN_FRACTION * orbitCam.zoom;
  const sphere = ctx.createRadialGradient(cx - radius * 0.36, cy - radius * 0.36, radius * 0.08, cx, cy, radius);
  sphere.addColorStop(0, 'rgb(126,210,230)');
  sphere.addColorStop(0.68, 'rgb(57,132,162)');
  sphere.addColorStop(1, 'rgb(29,81,113)');
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(7,20,30,0.92)';
  ctx.lineWidth = 2.4;
  for (const [ia, ib, ic] of faces) {
    const a = vertices[ia];
    const b = vertices[ib];
    const c = vertices[ic];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= 30; i += 1) {
        const v = slerp(p, q, i / 30);
        const pr = renderCam.project(v);
        if (!pr.visible) { drawing = false; continue; }
        if (!drawing) { ctx.moveTo(pr.x, pr.y); drawing = true; }
        else ctx.lineTo(pr.x, pr.y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (!pointer) {
    if (Math.abs(spin.x) + Math.abs(spin.y) > 0.001) {
      objectCam.rotate(spin.x * dt, spin.y * dt);
      const decay = Math.exp(-5.5 * dt);
      spin.x *= decay;
      spin.y *= decay;
    }
  }
  draw();
  raf = requestAnimationFrame(frame);
}

function pointOf(event) {
  return { x: event.clientX - renderCam.width / 2, y: event.clientY - renderCam.height / 2 };
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    pointer = { id: event.pointerId, lastX: event.clientX, lastY: event.clientY, lastT: performance.now() };
    spin.x = 0; spin.y = 0;
    const p = pointOf(event);
    beginTrackball(objectCam, p.x, -p.y, Math.min(W, H) * 0.45);
  } else if (pointers.size === 2) {
    pointer = null;
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
    if (pinch > 0 && dist > 0) orbitCam.zoom = Math.max(0.55, Math.min(7, orbitCam.zoom * (dist / pinch)));
    pinch = dist;
    return;
  }
  if (!pointer || pointer.id !== event.pointerId) return;
  const p = pointOf(event);
  dragTrackball(objectCam, p.x, -p.y, Math.min(W, H) * 0.45);
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  pointer.lastT = performance.now();
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size === 0) pointer = null;
  else if (pointers.size === 1) {
    const [p] = [...pointers.values()];
    pointer = { id: [...pointers.keys()][0], lastX: p.x, lastY: p.y, lastT: performance.now() };
    pinch = 0;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (event) => { if (!canvas.hasPointerCapture?.(event.pointerId)) endPointer(event); });

window.addEventListener('keydown', (event) => {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (keys.includes(event.key)) {
    applyArrowKey(orbitCam, event.key);
    event.preventDefault();
  }
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  orbitCam.zoom = Math.max(0.55, Math.min(7, orbitCam.zoom * Math.exp(-event.deltaY * 0.0012)));
}, { passive: false });

requestAnimationFrame(frame);

window.__ICOSA_VIEW__ = { objectCam, orbitCam, renderCam, vertices, project: (v) => renderCam.project(v) };
