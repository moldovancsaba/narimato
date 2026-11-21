/**
 * Carrier camera (approved spherical control model): cursor object-follow,
 * parallel-transport carrier, fixed-focal radius dolly and pole continuity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CarrierCamera } from '../public/js/shared/carrier-camera.js';

const W = 1200;
const H = 800;

function camera() {
  const cam = new CarrierCamera(W, H);
  cam.setPose({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
  cam.setDistance(1.35);
  return cam;
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

test('carrier camera: the grabbed surface point stays under the cursor', () => {
  const cam = camera();
  const p0 = cam.unprojectScreen(600, 400);
  assert.ok(p0, 'cursor over the sphere unprojects');
  assert.ok(cam.beginDrag(600, 400));
  assert.ok(cam.dragTo(700, 450));
  cam.endDrag();
  const p1 = cam.unprojectScreen(700, 450);
  assert.ok(p1, 'new cursor position still on the sphere');
  assert.ok(dot(p0, p1) > 0.9999, `point follow error ${Math.acos(Math.min(1, dot(p0, p1)))} rad`);
});

test('carrier camera: dragging over the pole stays continuous and finite', () => {
  const cam = camera();
  const q = cam.objectQ;
  cam.beginDrag(600, 500);
  for (let y = 500; y >= -200; y -= 35) {
    cam.dragTo(600, y);
    assert.ok([cam.objectQ.x, cam.objectQ.y, cam.objectQ.z, cam.objectQ.w].every(Number.isFinite), 'quaternion stays finite across the pole');
    assert.ok(Math.abs(Math.hypot(cam.objectQ.x, cam.objectQ.y, cam.objectQ.z, cam.objectQ.w) - 1) < 1e-9);
  }
  cam.endDrag();
  assert.notEqual(cam.objectQ, q, 'the object actually rotated');
  assert.ok(Number.isFinite(cam.viewAxis().x) && Number.isFinite(cam.viewAxis().y) && Number.isFinite(cam.viewAxis().z));
});

test('carrier camera: dolly changes radius with fixed focal and clamps', () => {
  const cam = camera();
  const focal = cam.focalPx;
  const before = cam.distance;
  cam.dolly(0.8);
  assert.ok(cam.distance < before, 'scroll in reduces carrier radius');
  assert.equal(cam.focalPx, focal, 'focal length is fixed');
  cam.dolly(1 / 0.8);
  assert.ok(Math.abs(cam.distance - before) < 1e-9);
  for (let i = 0; i < 50; i += 1) cam.dolly(0.5);
  assert.equal(cam.distance, cam.minDistance);
  for (let i = 0; i < 50; i += 1) cam.dolly(2);
  assert.equal(cam.distance, cam.maxDistance);
});

test('carrier camera: held at the pilot anchor, front projection centred', () => {
  const cam = camera();
  const p = cam.project({ x: 0, y: 0, z: 1 });
  assert.ok(p.visible);
  assert.ok(Math.abs(p.x - W / 2) < 1e-6 && Math.abs(p.y - H / 2) < 1e-6, 'the anchor projects to the screen centre');
  const pose = { x: 0.2, y: 0.3, z: 0.9327379 };
  cam.setPose(pose, { x: 1, y: 0, z: 0 });
  const centred = cam.project(pose);
  assert.ok(Math.abs(centred.x - W / 2) < 1e-6 && Math.abs(centred.y - H / 2) < 1e-6, 'the held camera follows the pilot');
  assert.ok(cam.viewAxis().z > 0);
});
