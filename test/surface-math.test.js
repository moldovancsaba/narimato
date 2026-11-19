import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceSurface, tangentAt, turnSurface } from '../public/js/surface-mode.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (v) => Math.hypot(v.x, v.y, v.z);

test('surface movement: forward travel crosses a pole without flipping or stopping', () => {
  // Near the north pole, heading across it.
  let up = { x: 0, y: 0.999, z: 0.0447 };
  let forward = tangentAt(up, { x: 0, y: 1, z: 0 });
  const start = { ...up };
  for (let i = 0; i < 30; i += 1) {
    const next = advanceSurface(up, forward, 0.02);
    up = next.up;
    forward = next.forward;
    assert.ok(Number.isFinite(up.x) && Number.isFinite(up.y) && Number.isFinite(up.z));
    assert.ok(Number.isFinite(forward.x) && Number.isFinite(forward.y) && Number.isFinite(forward.z));
    assert.ok(Math.abs(len(up) - 1) < 1e-9, 'position remains on sphere');
    assert.ok(Math.abs(dot(up, forward)) < 1e-9, 'forward stays tangent');
    assert.ok(Math.abs(len(forward) - 1) < 1e-9, 'forward remains normalized');
  }
  assert.ok(up.y < start.y, 'crossed the pole to the other side');
});

test('surface movement: turning around the local normal stays tangent and normalized', () => {
  const up = { x: 0.2, y: 0.9, z: 0.1 };
  let forward = tangentAt(up, { x: 0, y: 0, z: 1 });
  for (let i = 0; i < 12; i += 1) {
    forward = turnSurface(forward, up, 0.2);
    assert.ok(Math.abs(dot(up, forward)) < 1e-9);
    assert.ok(Math.abs(len(forward) - 1) < 1e-9);
  }
});
