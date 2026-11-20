import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMERA_CONTRACT_VERSION,
  CAMERA_MEMBERS,
  CAMERA_NEAR_PLANE,
  SURFACE_DOLLY_FAR,
  SURFACE_DOLLY_NEAR,
  SURFACE_TILT_MAX,
  SURFACE_TILT_MIN,
  assertCameraView,
  cameraModeReport,
  dollyDistance,
  dollyTForZoom,
  focalPxFor,
  isCameraView,
  parseSurfaceCameraMode,
  tiltRad,
  zoomToDistance,
} from '../public/js/shared/camera-contract.js';
import { SphereCamera } from '../public/js/shared/geometry.js';
import { SurfaceCamera } from '../public/js/shared/surface-camera.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

function sampleSphere(count) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push({ x: r * Math.cos(theta), y, z: r * Math.sin(theta) });
  }
  return out;
}

const CAMERAS = [
  ['SphereCamera', () => new SphereCamera({ width: 1200, height: 800 }).reset()],
  ['SurfaceCamera legacy', () => new SurfaceCamera(1200, 800, { mode: 'legacy' }).setPose({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 })],
  ['SurfaceCamera carrier', () => new SurfaceCamera(1200, 800, { mode: 'carrier' }).setPose({ x: 0.2, y: 0.3, z: 0.93 }, { x: 1, y: 0, z: -0.2 })],
];

test('camera contract: version, member list and near-plane are declared', () => {
  assert.equal(CAMERA_CONTRACT_VERSION, 1);
  assert.ok(Array.isArray(CAMERA_MEMBERS));
  for (const member of ['project', 'unprojectView', 'viewAxis', 'unprojectScreen', 'setViewport', 'width', 'height', 'zoom', 'distance', 'focalPx', 'nearPlane']) {
    assert.ok(CAMERA_MEMBERS.includes(member), `member ${member} declared`);
  }
  assert.equal(CAMERA_NEAR_PLANE, 0.05);
});

test('camera contract: focal identity helper is positive for every viewport', () => {
  for (const [w, h] of [[1200, 800], [390, 844], [844, 390], [320, 320]]) {
    const focal = focalPxFor(w, h);
    assert.ok(Number.isFinite(focal) && focal > 0);
    assert.equal(focal, Math.max(w, h) * 0.5);
  }
});

test('camera contract: dolly curve is monotonic with the documented endpoints', () => {
  assert.ok(Math.abs(dollyDistance(0) - SURFACE_DOLLY_NEAR) < 1e-12);
  assert.ok(Math.abs(dollyDistance(1) - SURFACE_DOLLY_FAR) < 1e-12);
  assert.equal(dollyTForZoom(0.25), 0);
  assert.equal(dollyTForZoom(0.5), 0);
  assert.equal(dollyTForZoom(1), 0.5);
  assert.equal(dollyTForZoom(4), 1);
  let previous = 0;
  for (let i = 0; i <= 20; i += 1) {
    const d = dollyDistance(i / 20);
    assert.ok(d >= previous, 'radius never decreases as dolly parameter grows');
    previous = d;
  }
  assert.ok(zoomToDistance(0.25) < zoomToDistance(1));
  assert.ok(zoomToDistance(1) < zoomToDistance(4));
  assert.ok(Math.abs(zoomToDistance(0.25) - 1.08) < 1e-12);
  assert.ok(Math.abs(zoomToDistance(4) - 1.72) < 1e-12);
});

test('camera contract: tilt is clamped to the proven carrier bound', () => {
  assert.equal(tiltRad(0.1), SURFACE_TILT_MIN);
  assert.equal(tiltRad(9), SURFACE_TILT_MAX);
  assert.equal(tiltRad(Number.NaN), 1.12);
  assert.ok(tiltRad(1.1) === 1.1);
});

test('camera contract: the surface-camera flag defaults to legacy', () => {
  assert.equal(parseSurfaceCameraMode(''), 'legacy');
  assert.equal(parseSurfaceCameraMode('?surface-camera=legacy'), 'legacy');
  assert.equal(parseSurfaceCameraMode('surface-camera=carrier'), 'carrier');
  assert.equal(parseSurfaceCameraMode('?surface-camera=CARRIER'), 'carrier');
  assert.equal(parseSurfaceCameraMode('?surface-camera=bogus'), 'legacy');
  assert.deepEqual(cameraModeReport('legacy'), { surface: 'legacy', contractVersion: 1 });
  assert.deepEqual(cameraModeReport('carrier'), { surface: 'carrier', contractVersion: 1 });
});

test('camera contract: both production cameras satisfy assertCameraView', () => {
  for (const [label, make] of CAMERAS) {
    const camera = make();
    assert.ok(isCameraView(camera), `${label} satisfies the contract`);
    assert.equal(assertCameraView(camera), camera, 'assert returns the camera unchanged');
  }
});

test('camera contract: malformed cameras are rejected with a contract error', () => {
  assert.throws(() => assertCameraView(null), /not an object/);
  assert.throws(() => assertCameraView({}), /missing function project/);
  const base = new SurfaceCamera(100, 100, { mode: 'carrier' });
  const missingScreen = Object.create(base);
  Object.defineProperty(missingScreen, 'unprojectScreen', { value: undefined });
  assert.throws(() => assertCameraView(missingScreen), /unprojectScreen/);
  const brokenNumber = Object.create(base);
  Object.defineProperty(brokenNumber, 'width', { value: Number.NaN });
  assert.throws(() => assertCameraView(brokenNumber), /width/);
  const brokenAxis = Object.create(base);
  Object.defineProperty(brokenAxis, 'viewAxis', { value: () => ({ x: 1, y: 1, z: 0 }) });
  assert.throws(() => assertCameraView(brokenAxis), /unit length/);
});

test('camera contract: project().z equals dot(point, viewAxis()) on every camera', () => {
  const points = sampleSphere(1000);
  for (const [label, make] of CAMERAS) {
    const camera = make();
    const axis = camera.viewAxis();
    assert.ok(Math.abs(Math.hypot(axis.x, axis.y, axis.z) - 1) < 1e-12, `${label} axis unit`);
    const before = camera.project(points[0]);
    for (const point of points) {
      const projected = camera.project(point);
      assert.ok(
        Math.abs(projected.z - dot(point, axis)) < 1e-12,
        `${label}: z is the front-hemisphere coordinate`,
      );
      assert.ok(Number.isFinite(projected.depth), `${label}: depth is finite`);
    }
    const after = camera.project(points[0]);
    assert.deepEqual(after, before, `${label}: project() is pure`);
  }
});

test('camera contract: unprojectView is an orthonormal inverse', () => {
  for (const [label, make] of CAMERAS) {
    const camera = make();
    for (const unit of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]) {
      const world = camera.unprojectView(unit);
      assert.ok(Math.abs(Math.hypot(world.x, world.y, world.z) - 1) < 1e-12, `${label}: unit preserved`);
    }
    const ex = camera.unprojectView({ x: 1, y: 0, z: 0 });
    const ey = camera.unprojectView({ x: 0, y: 1, z: 0 });
    const ez = camera.unprojectView({ x: 0, y: 0, z: 1 });
    assert.ok(Math.abs(dot(ex, ey)) < 1e-12, `${label}: basis orthogonal`);
    assert.ok(Math.abs(dot(ex, ez)) < 1e-12, `${label}: basis orthogonal`);
    assert.ok(Math.abs(dot(ey, ez)) < 1e-12, `${label}: basis orthogonal`);
  }
});

test('camera contract: orbital screen inverse recovers visible vertices', () => {
  const camera = new SphereCamera({ width: 1200, height: 900 }).reset();
  const cap = 1 / camera.distance + 1e-6;
  let checked = 0;
  for (const point of sampleSphere(300)) {
    const projected = camera.project(point);
    if (!projected.visible) continue;
    // Only the cap actually visible from a finite-distance camera round-trips:
    // a front-hemisphere point beyond the tangent is occluded by the near face.
    if (projected.z < cap) continue;
    if (projected.x < 0 || projected.x > camera.width || projected.y < 0 || projected.y > camera.height) continue;
    const back = camera.unprojectScreen(projected.x, projected.y);
    assert.ok(back, 'ray hits the sphere');
    assert.ok(Math.abs(dot(point, back.point) - 1) < 1e-9, 'recovered the visible sphere point');
    checked += 1;
  }
  assert.ok(checked > 50, `checked ${checked} visible vertices`);
});

test('camera contract: setViewport updates width/height and keeps the pose', () => {
  const camera = new SurfaceCamera(1200, 800, { mode: 'carrier' }).setPose({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 });
  const axisBefore = camera.viewAxis();
  camera.setViewport(390, 844);
  assert.equal(camera.width, 390);
  assert.equal(camera.height, 844);
  assert.deepEqual(camera.viewAxis(), axisBefore);
  assert.ok(isCameraView(camera));
});
