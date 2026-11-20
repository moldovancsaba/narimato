import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera, qMul, qNormalize, qFromAxis } from '../public/js/shared/geometry.js';
import {
  beginSurfaceDrag,
  dragSurfaceTo,
  applySurfaceArc,
  applyArrowTravel,
  applyArrowTravelFrame,
  normalizeMode,
  toggleMode,
  modeLabel,
  modeAnnouncement,
  KEY_RATE_RAD_S,
  SHIFT_BOOST,
  MAX_STEP_DT,
  ARROW_TANGENTS,
} from '../public/js/shared/orbit-controls.js';

const W = 1200;
const H = 900;

function freshCamera() {
  const cam = new SphereCamera({ width: W, height: H });
  cam.reset();
  return cam;
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

/* ------------------------------------------------------------------ *
 * CTL-01: one sign table
 * ------------------------------------------------------------------ */

test('orbit input: all four arrows follow the inverse sign table', () => {
  const probe = { x: 0.12, y: 0.16, z: 0.98 };
  const cases = [
    ['ArrowRight', (before, after) => after.x < before.x - 0.5],
    ['ArrowLeft', (before, after) => after.x > before.x + 0.5],
    ['ArrowUp', (before, after) => after.y > before.y + 0.5],
    ['ArrowDown', (before, after) => after.y < before.y - 0.5],
  ];
  for (const [key, expect] of cases) {
    const cam = freshCamera();
    const before = cam.project(probe);
    applyArrowTravel(cam, key, MAX_STEP_DT);
    const after = cam.project(probe);
    assert.equal(expect(before, after), true, `${key} sign (Δx=${(after.x - before.x).toFixed(2)}, Δy=${(after.y - before.y).toFixed(2)})`);
  }
  assert.deepEqual(Object.keys(ARROW_TANGENTS).sort(), ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']);
});

test('orbit input: arrow travel is inverse to the absolute pointer drag', () => {
  const probe = { x: 0.12, y: 0.16, z: 0.98 };
  // Drag: pointer right -> grabbed surface moves right.
  const dragCam = freshCamera();
  const dragStart = dragCam.project(probe);
  const drag = beginSurfaceDrag(dragCam, W / 2, H / 2, W, H);
  assert.ok(drag && drag.start, 'drag starts on the sphere');
  dragSurfaceTo(dragCam, drag, W / 2 + 120, H / 2);
  const dragAfter = dragCam.project(probe);
  assert.ok(dragAfter.x > dragStart.x + 20, 'drag right moves the surface right');
  // Arrow: right arrow travels the carrier right, so the surface moves left.
  const arrowCam = freshCamera();
  const arrowStart = arrowCam.project(probe);
  applyArrowTravelFrame(arrowCam, new Set(['ArrowRight']), MAX_STEP_DT);
  const arrowAfter = arrowCam.project(probe);
  assert.ok(arrowAfter.x < arrowStart.x - 0.5, 'right arrow moves the surface left');
});

test('orbit input: Shift multiplies the travelled angle by SHIFT_BOOST', () => {
  const base = freshCamera();
  const start = base.viewAxis();
  applyArrowTravel(base, 'ArrowUp', MAX_STEP_DT, false);
  const plain = angleBetween(start, base.viewAxis());

  const boosted = freshCamera();
  applyArrowTravel(boosted, 'ArrowUp', MAX_STEP_DT, true);
  const fast = angleBetween(start, boosted.viewAxis());

  assert.ok(plain > 0);
  assert.ok(Math.abs(fast / plain - SHIFT_BOOST) < 1e-6, `ratio ${fast / plain} equals ${SHIFT_BOOST}`);
});

test('orbit input: the frame step is clamped to MAX_STEP_DT', () => {
  const clamped = freshCamera();
  const start = clamped.viewAxis();
  applyArrowTravel(clamped, 'ArrowLeft', 10); // a 10 s tab-switch frame
  const step = angleBetween(start, clamped.viewAxis());
  assert.ok(Math.abs(step - KEY_RATE_RAD_S * MAX_STEP_DT) < 1e-9);
  const noStep = freshCamera();
  const axis = noStep.viewAxis();
  applyArrowTravel(noStep, 'ArrowLeft', 0);
  applyArrowTravel(noStep, 'ArrowLeft', -1);
  assert.deepEqual(noStep.viewAxis(), axis, 'zero/negative dt changes nothing');
});

test('orbit input: absolute drag keeps the grabbed point under the pointer (25 steps)', () => {
  const cam = freshCamera();
  const startX = W / 2;
  const startY = H / 2;
  const drag = beginSurfaceDrag(cam, startX, startY, W, H);
  assert.ok(drag && drag.start);
  // The point the pointer grabbed at pointer-down.
  const grabbed = { ...drag.start };
  const dx = 120;
  const dy = 80;
  for (let step = 1; step <= 25; step += 1) {
    const x = startX + (dx * step) / 25;
    const y = startY + (dy * step) / 25;
    dragSurfaceTo(cam, drag, x, y);
    const projected = cam.project(grabbed);
    const err = Math.hypot(projected.x - x, projected.y - y);
    assert.ok(projected.visible, `step ${step}: grabbed point stays on the front hemisphere`);
    assert.ok(err < 1, `step ${step}: grabbed point within 1 px of pointer (err=${err.toFixed(3)})`);
  }
});

test('orbit input: the drag stays exact at roll and across the pole', () => {
  const roll = qNormalize(qMul(qFromAxis({ x: 0, y: 0, z: 1 }, Math.PI * 0.7), qFromAxis({ x: 1, y: 0, z: 0 }, Math.PI / 2 - 0.01)));
  const cam = freshCamera();
  cam.setOrientation(roll);
  const startX = W / 2;
  const startY = H / 2;
  const drag = beginSurfaceDrag(cam, startX, startY, W, H);
  // At a pole-facing view the centre ray can graze the silhouette; a nearby
  // grab point is used when the exact centre misses.
  const grab = drag && drag.start
    ? drag
    : beginSurfaceDrag(cam, startX - 40, startY - 40, W, H);
  assert.ok(grab && grab.start, 'a grab point exists near the pole');
  const grabbed = { ...grab.start };
  for (let step = 1; step <= 12; step += 1) {
    const x = startX - 40 - (60 * step) / 12;
    const y = startY - 40 + (30 * step) / 12;
    dragSurfaceTo(cam, grab, x, y);
    const projected = cam.project(grabbed);
    const err = Math.hypot(projected.x - x, projected.y - y);
    assert.ok(err < 1, `step ${step}: rolled/pole drag follows (err=${err.toFixed(3)})`);
    assert.ok(Number.isFinite(cam.viewAxis().x));
  }
});

test('orbit input: reverse mode mirrors the drag only', () => {
  const probe = { x: 0.12, y: 0.16, z: 0.98 };
  const cam = freshCamera();
  const before = cam.project(probe);
  const drag = beginSurfaceDrag(cam, W / 2, H / 2, W, H);
  drag.mode = 'reverse';
  dragSurfaceTo(cam, drag, W / 2 + 120, H / 2);
  const after = cam.project(probe);
  assert.ok(after.x < before.x - 20, 'reverse drag moves the surface opposite the pointer');
  // Arrows are unaffected by the polarity mode.
  const camA = freshCamera();
  const start = camA.project(probe);
  applyArrowTravelFrame(camA, new Set(['ArrowRight']), MAX_STEP_DT);
  assert.ok(camA.project(probe).x < start.x);
});

test('orbit input: a drag that starts off the sphere leaves the camera untouched', () => {
  const cam = freshCamera();
  const q0 = cam.viewQuaternion();
  const miss = beginSurfaceDrag(cam, 1, 1, W, H);
  assert.ok(miss, 'gesture is still tracked');
  assert.equal(miss.start, null, 'pointer missed the sphere');
  dragSurfaceTo(cam, miss, W / 2, H / 2);
  assert.deepEqual(cam.viewQuaternion(), q0);
});

test('orbit input: shortest-arc application keeps the object a unit quaternion', () => {
  const cam = freshCamera();
  const drag = beginSurfaceDrag(cam, W / 2, H / 2, W, H);
  const to = { x: drag.start.x + 0.4, y: drag.start.y, z: drag.start.z };
  const norm = Math.hypot(to.x, to.y, to.z);
  const target = { x: to.x / norm, y: to.y / norm, z: to.z / norm };
  applySurfaceArc(cam, drag.q0, drag.start, target, 'follow');
  const q = cam.viewQuaternion();
  assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-12);
});

test('orbit input: 10 000 seeded steps stay finite and unit', () => {
  let seed = 123456789;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  const cam = freshCamera();
  for (let i = 0; i < 10000; i += 1) {
    const key = keys[Math.floor(next() * keys.length)];
    if (next() < 0.5) applyArrowTravel(cam, key, next() * 0.2, next() < 0.3);
    else applyArrowTravelFrame(cam, new Set([key, next() < 0.3 ? keys[Math.floor(next() * 4)] : key]), next() * 0.2);
    if (i % 500 === 0) {
      const drag = beginSurfaceDrag(cam, W / 2, H / 2, W, H);
      if (drag && drag.start) dragSurfaceTo(cam, drag, W / 2 + (next() - 0.5) * 300, H / 2 + (next() - 0.5) * 300);
    }
    const q = cam.viewQuaternion();
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-9, `step ${i} unit quaternion`);
    const axis = cam.viewAxis();
    assert.ok(Number.isFinite(axis.x) && Number.isFinite(axis.y) && Number.isFinite(axis.z), `step ${i} finite axis`);
    const up = cam.carrierUp();
    assert.ok(Math.abs(axis.x * up.x + axis.y * up.y + axis.z * up.z) < 1e-9, `step ${i} orthonormal carrier`);
  }
});

test('orbit input: mode persists in the HUD vocabulary, not a toast', () => {
  assert.equal(normalizeMode('reverse'), 'reverse');
  assert.equal(normalizeMode('follow'), 'follow');
  assert.equal(normalizeMode('nonsense'), 'follow');
  assert.equal(normalizeMode(null), 'follow');
  assert.equal(toggleMode('follow'), 'reverse');
  assert.equal(toggleMode('reverse'), 'follow');
  assert.equal(modeLabel('follow'), 'DRAG: FOLLOW CURSOR');
  assert.equal(modeLabel('reverse'), 'DRAG: REVERSE');
  assert.match(modeAnnouncement('reverse'), /arrows unchanged/);
});
