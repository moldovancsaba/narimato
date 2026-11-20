import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera, baseIcosahedron } from '../public/js/shared/geometry.js';
import { unprojectSphere, shortestArcQuat, carrierFrame, carrierProject, carrierUnproject, moveCarrier } from '../public/js/shared/sphere-interaction.js';

const apply = (q, v) => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};

test('sphere interaction: unproject recovers the visible surface point', () => {
  const cam = new SphereCamera({ width: 1200, height: 1200 });
  cam.reset();
  const { vertices } = baseIcosahedron();
  for (const index of [3, 4, 8, 9]) {
    const v = vertices[index];
    const project = cam.project(v);
    if (!project.visible) continue;
    const back = unprojectSphere(cam, project.x, project.y, 1200, 1200);
    assert.ok(back);
    const err = Math.hypot(back.x - v.x, back.y - v.y, back.z - v.z);
    assert.ok(err < 1e-9, `vertex ${index} recovered, err=${err}`);
  }
});

test('sphere interaction: shortest arc maps the grabbed point to the target', () => {
  const raw0 = { x: 0.2, y: 0.1, z: 0.97 };
  const raw1 = { x: -0.25, y: 0.35, z: 0.9 };
  const n0 = Math.hypot(raw0.x, raw0.y, raw0.z);
  const n1 = Math.hypot(raw1.x, raw1.y, raw1.z);
  const p0 = { x: raw0.x / n0, y: raw0.y / n0, z: raw0.z / n0 };
  const p1 = { x: raw1.x / n1, y: raw1.y / n1, z: raw1.z / n1 };
  const q = shortestArcQuat(p0, p1);
  const moved = apply(q, p0);
  const err = Math.hypot(moved.x - p1.x, moved.y - p1.y, moved.z - p1.z);
  assert.ok(err < 1e-9, `point maps to target, err=${err}`);
});

test('camera orbit: Up remains finite for a full loop and does not change distance', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  const distance = cam.distance;
  for (let i = 0; i < 360; i += 1) {
    cam.rotate(0, 28);
    const q = cam._q;
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-9);
    const axis = cam.viewAxis();
    assert.ok(Number.isFinite(axis.x) && Number.isFinite(axis.y) && Number.isFinite(axis.z));
  }
  assert.equal(cam.distance, distance, 'cursor orbit does not change carrier radius');
});

test('carrier pane: Up/Down/Left/Right always move along the current local tangent', () => {
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  let frame = carrierFrame({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
  for (let i = 0; i < 200; i += 1) {
    const old = frame;
    frame = moveCarrier(frame, 0, 1, 0.12);
    const delta = { x: frame.pos.x - old.pos.x, y: frame.pos.y - old.pos.y, z: frame.pos.z - old.pos.z };
    assert.ok(dot(delta, old.up) > 0, `Up step ${i} moved along local Up`);
    assert.ok(Math.abs(dot(frame.pos, frame.up)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(frame.pos.x, frame.pos.y, frame.pos.z) - 1) < 1e-9);
    assert.ok(Math.abs(Math.hypot(frame.up.x, frame.up.y, frame.up.z) - 1) < 1e-9);
  }
  let r = carrierFrame({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
  for (let i = 0; i < 80; i += 1) {
    const old = r;
    r = moveCarrier(r, 1, 0, 0.12);
    const delta = { x: r.pos.x - old.pos.x, y: r.pos.y - old.pos.y, z: r.pos.z - old.pos.z };
    assert.ok(dot(delta, old.right) > 0, `Right step ${i} moved along local Right`);
  }
});

test('carrier projection and unprojection recover a visible surface point', () => {
  const frame = carrierFrame({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
  const focal = 480 * 3.2;
  const v = { x: 0.2, y: 0.1, z: 0.97 };
  const n = Math.hypot(v.x, v.y, v.z);
  const unit = { x: v.x / n, y: v.y / n, z: v.z / n };
  const s = carrierProject(3.2, focal, frame, unit);
  const back = carrierUnproject(3.2, focal, frame, 600 + s.x, 600 + s.y, 1200, 1200);
  assert.ok(back);
  const err = Math.hypot(back.x - unit.x, back.y - unit.y, back.z - unit.z);
  assert.ok(err < 1e-9, `carrier ray recovers point, err=${err}`);
});
