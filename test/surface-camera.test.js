import test from 'node:test';
import assert from 'node:assert/strict';

import { SurfaceCamera } from '../public/js/shared/surface-camera.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

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
