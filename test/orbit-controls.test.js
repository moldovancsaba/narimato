import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera } from '../public/js/shared/geometry.js';
import { applyScreenDrag, applyArrowKey } from '../public/js/shared/orbit-controls.js';

test('shared drag: dragging right moves the surface right', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  const p = { x: 0.15, y: 0.15, z: 0.97 };
  const before = cam.project(p);
  applyScreenDrag(cam, 100, 0);
  const after = cam.project(p);
  assert.ok(after.x > before.x, 'surface follows the pointer');
});

test('shared arrows: right arrow rotates explicitly', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  const before = cam._q.y;
  applyArrowKey(cam, 'ArrowRight');
  assert.notEqual(cam._q.y, before);
});
