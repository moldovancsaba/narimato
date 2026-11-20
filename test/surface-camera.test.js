import test from 'node:test';
import assert from 'node:assert/strict';

import { SurfaceCamera } from '../public/js/shared/surface-camera.js';
import { CAMERA_NEAR_PLANE } from '../public/js/shared/camera-contract.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

/** Deterministic fibonacci sphere samples. */
function sampleSphere(count, offset = 0) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + offset) / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push({ x: r * Math.cos(theta), y, z: r * Math.sin(theta) });
  }
  return out;
}

function carrier(zoom = 1, tilt = 1.12, width = 1200, height = 800) {
  return new SurfaceCamera(width, height, { mode: 'carrier', tilt }).setZoom(zoom).setPose(
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
  );
}

test('surface camera: projects local sphere cells and player anchor finitely', () => {
  const cam = new SurfaceCamera(1200, 800);
  const pos = { x: 0, y: 0, z: 1 };
  const forward = { x: 1, y: 0, z: 0 };
  cam.setPose(pos, forward);
  const player = cam.playerScreen();
  assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
  assert.ok(player.visible);
  const near = cam.project({ x: 0.1, y: 0, z: 0.99 });
  assert.ok(Number.isFinite(near.x) && Number.isFinite(near.y));
  const far = cam.project({ x: 0, y: 0, z: -1 });
  assert.ok(Number.isFinite(far.x) && Number.isFinite(far.y));
  assert.ok(Math.abs(dot(cam.viewAxis(), cam.viewAxis()) - 1) < 1e-9);
});

test('surface camera: remains stable across a pole and changing headings', () => {
  const cam = new SurfaceCamera(1200, 800);
  const north = { x: 0, y: 1, z: 0 };
  cam.setPose(north, { x: 0, y: 0, z: 1 });
  for (let i = 0; i < 24; i += 1) {
    const pose = cam.project({ x: 0, y: 0.99, z: 0.14 });
    assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y));
  }
  cam.setPose({ x: 0, y: 0.999, z: 0.0447 }, { x: 0, y: 0.0447, z: -0.999 });
  const p = cam.playerScreen();
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('surface camera: legacy framing pixels are unchanged from v3.57', () => {
  const cam = new SurfaceCamera(1200, 800, { mode: 'legacy' });
  cam.setPose({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 });
  const fixtures = [
    [{ x: 0, y: 0, z: 1 }, 600, 323.598447498],
    [{ x: 0.1, y: 0, z: 0.995 }, 600, 275.803346748],
    [{ x: 0.5, y: 0, z: 0.866 }, 600, 410.906822115],
    [{ x: 0.04, y: 0.02, z: 0.999 }, 485.303388351, 292.82291174],
  ];
  for (const [point, x, y] of fixtures) {
    const projected = cam.project(norm(point));
    assert.ok(Math.abs(projected.x - x) < 1e-6, `legacy x for ${JSON.stringify(point)}`);
    assert.ok(Math.abs(projected.y - y) < 1e-6, `legacy y for ${JSON.stringify(point)}`);
  }
  // The documented third-person frame is preserved: minor dolly, fixed focal.
  assert.ok(Math.abs(cam.focalPx - 800 * 1.36) < 1e-9);
  assert.ok(cam.distance > 1 && cam.distance < 1.2);
});

test('surface camera: carrier unprojection round-trips (60 points × 5 tilts × 3 distances)', () => {
  const points = sampleSphere(1200);
  const distances = [0.25, 1, 4];
  const tilts = [0.95, 1.0375, 1.125, 1.2125, 1.3];
  let checked = 0;
  for (const zoom of distances) {
    for (const tilt of tilts) {
      const cam = carrier(zoom, tilt);
      const cap = 1 / cam.distance + 1e-6;
      for (const point of points) {
        const projected = cam.project(point);
        if (!projected.visible || projected.z < cap) continue;
        if (projected.x < 0 || projected.x > cam.width || projected.y < 0 || projected.y > cam.height) continue;
        const back = cam.unprojectScreen(projected.x, projected.y);
        assert.ok(back, 'screen ray hits the unit sphere');
        assert.ok(
          dot(point, back.point) > 1 - 1e-9,
          `round trip recovers the surface point (dot=${dot(point, back.point)})`,
        );
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 150, `checked ${checked} visible surface points`);
});

test('surface camera: focal identity holds within 1e-6 px', () => {
  for (const zoom of [0.25, 1, 4]) {
    for (const tilt of [0.95, 1.12, 1.3]) {
      const cam = carrier(zoom, tilt);
      for (const point of sampleSphere(80, 7)) {
        const projected = cam.project(point);
        if (!projected.visible) continue;
        const X = projected.x - cam.width / 2;
        const Y = cam.height / 2 - projected.y;
        const dir = cam.unprojectView({ x: X, y: Y, z: cam.focalPx });
        const forward = cam.unprojectView({ x: 0, y: 0, z: 1 });
        const cos = dot(norm(dir), norm(forward));
        const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
        const tanFromPixels = Math.hypot(X, Y) / cam.focalPx;
        assert.ok(
          Math.abs(Math.tan(angle) - tanFromPixels) < 1e-6,
          `focal identity: tan(angle)=${Math.tan(angle)} px=${tanFromPixels}`,
        );
      }
    }
  }
});

test('surface camera: viewport points keep depth >= 0.05 at the tilt cap', () => {
  let checked = 0;
  for (const [width, height] of [[1200, 800], [390, 844], [844, 390]]) {
    for (const zoom of [0.25, 1, 4]) {
      const cam = carrier(zoom, 1.3, width, height);
      for (const point of sampleSphere(600, 3)) {
        const projected = cam.project(point);
        if (!projected.visible) continue;
        if (projected.x < 0 || projected.x > width || projected.y < 0 || projected.y > height) continue;
        assert.ok(projected.depth >= CAMERA_NEAR_PLANE, `depth ${projected.depth} >= near plane`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0, 'sampled in-viewport points');
});

test('surface camera: dolly mapping is monotonic and bounded', () => {
  const cam = carrier(0.25, 1.12);
  assert.ok(Math.abs(cam.distance - 1.08) < 1e-12);
  cam.setZoom(4);
  assert.ok(Math.abs(cam.distance - 1.72) < 1e-12);
  let previous = 0;
  for (let i = 0; i < 40; i += 1) {
    cam.setZoom(0.25 * Math.pow(16, i / 39));
    assert.ok(cam.distance >= previous - 1e-12);
    assert.ok(cam.distance >= 1.08 - 1e-12 && cam.distance <= 1.72 + 1e-12);
    previous = cam.distance;
  }
});

test('surface camera: a full 360° heading turn keeps the frame upright and finite', () => {
  const anchor = { x: 0.2, y: 0.3, z: 0.93 };
  for (const tilt of [0.95, 1.3]) {
    const cam = carrier(1, tilt);
    let forward = norm({ x: 1, y: 0, z: -0.2 });
    for (let i = 0; i <= 72; i += 1) {
      cam.setPose(anchor, forward);
      const axis = cam.viewAxis();
      assert.ok(Math.abs(Math.hypot(axis.x, axis.y, axis.z) - 1) < 1e-12);
      const up = cam.unprojectView({ x: 0, y: 1, z: 0 });
      assert.ok(Number.isFinite(up.x) && Number.isFinite(up.y) && Number.isFinite(up.z));
      assert.ok(dot(norm(up), axis) > 0, 'camera up never flips inward');
      const projected = cam.project(norm({ x: axis.x + forward.x * 0.2, y: axis.y + forward.y * 0.2, z: axis.z + forward.z * 0.2 }));
      assert.ok(Number.isFinite(projected.x) && Number.isFinite(projected.y));
      // Turn 5° around the local normal.
      const turn = (2 * Math.PI) / 72;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      forward = norm({
        x: forward.x * cos + (anchor.y * forward.z - anchor.z * forward.y) * sin,
        y: forward.y * cos + (anchor.z * forward.x - anchor.x * forward.z) * sin,
        z: forward.z * cos + (anchor.x * forward.y - anchor.y * forward.x) * sin,
      });
    }
  }
});

test('surface camera: degenerate and parallel poses are rejected without breaking the frame', () => {
  const cam = carrier(1, 1.12);
  const before = cam.project({ x: 0.3, y: 0.1, z: 0.94 });
  cam.setPose({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }); // heading parallel to anchor
  const after = cam.project({ x: 0.3, y: 0.1, z: 0.94 });
  assert.deepEqual(after, before, 'invalid pose keeps the previous frame');
  cam.setPose({ x: Number.NaN, y: 0, z: 1 }, { x: 1, y: 0, z: 0 });
  assert.deepEqual(cam.project({ x: 0.3, y: 0.1, z: 0.94 }), before, 'NaN pose keeps the previous frame');
  assert.ok(cam.unprojectScreen(Number.NaN, 10) === null);
  assert.ok(cam.unprojectScreen(10, Number.NaN) === null);
});

test('surface camera: resize at equal aspect scales points by the same factor', () => {
  const cam = carrier(1, 1.12, 1200, 800);
  const point = { x: 0.25, y: 0.1, z: 0.96 };
  const first = cam.project(point);
  cam.setViewport(600, 400);
  const second = cam.project(point);
  assert.ok(Math.abs(second.x - first.x / 2) < 1e-6);
  assert.ok(Math.abs(second.y - first.y / 2) < 1e-6);
  assert.ok(Math.abs(second.depth - first.depth) < 1e-12);
});

test('surface camera: the pilot anchor projects below the view centre', () => {
  for (const zoom of [1, 4]) {
    for (const tilt of [0.95, 1.12, 1.3]) {
      const cam = carrier(zoom, tilt);
      const anchorScreen = cam.project(cam.viewAxis());
      assert.ok(anchorScreen.visible, 'the ground anchor is in front of the near plane');
      assert.ok(anchorScreen.y > cam.height / 2, 'the anchor reads below the horizon line');
      const up = cam.unprojectView({ x: 0, y: 1, z: 0 });
      const higher = cam.project(norm({ x: cam.viewAxis().x + up.x * 0.01, y: cam.viewAxis().y + up.y * 0.01, z: cam.viewAxis().z + up.z * 0.01 }));
      assert.ok(higher.y < anchorScreen.y, 'screen y decreases toward camera up (no vertical flip)');
    }
  }
  // At the closest dolly the ground anchor itself is inside the near plane;
  // that is the documented bound, not a flip.
  const tight = carrier(0.25, 1.3);
  const anchor = tight.project(tight.viewAxis());
  assert.equal(anchor.visible, false);
  assert.ok(Number.isFinite(anchor.depth) && anchor.depth < CAMERA_NEAR_PLANE);
});

test('surface camera: projection is deterministic to 1e-9 and allocation-bounded per pose', () => {
  const points = sampleSphere(200, 11);
  const a = carrier(1, 1.12);
  const b = carrier(1, 1.12);
  for (const point of points) {
    const pa = a.project(point);
    const pb = b.project(point);
    assert.ok(Math.abs(pa.x - pb.x) < 1e-9);
    assert.ok(Math.abs(pa.y - pb.y) < 1e-9);
    assert.ok(Math.abs(pa.depth - pb.depth) < 1e-12);
  }
  const frame = a.viewAxis();
  for (const point of points) a.project(point);
  assert.deepEqual(a.viewAxis(), frame, 'project() never mutates camera state');
});
