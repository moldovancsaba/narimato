import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera } from '../public/js/shared/geometry.js';

test('camera: direct screen drag keeps its direction', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  const p = { x: 0.15, y: 0.15, z: 0.97 };
  const before = cam.project(p);
  cam.rotate(100, 0);
  const afterX = cam.project(p);
  assert.ok(afterX.x > before.x, 'drag right moves the surface right');

  const cam2 = new SphereCamera({ width: 1000, height: 800 });
  cam2.reset();
  const before2 = cam2.project(p);
  cam2.rotate(0, 100);
  const afterY = cam2.project(p);
  assert.ok(afterY.y > before2.y, 'drag down moves the surface down');
});

test('camera: direction survives crossing the pole', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  cam.pitch = Math.PI / 2 - 0.002;
  const p = { x: 0.2, y: 0.95, z: 0.2 };
  const before = cam.project(p);
  cam.rotate(30, 0);
  const after = cam.project(p);
  assert.ok(Number.isFinite(after.x) && Number.isFinite(after.y));
  assert.ok(Math.abs(after.x - before.x) > 0.5, 'rotation still moves the pole view');
});
