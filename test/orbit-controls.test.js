import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera } from '../public/js/shared/geometry.js';
import { applyScreenDrag, applyArrowKey, beginTrackball, dragTrackball } from '../public/js/shared/orbit-controls.js';

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

test('shared virtual trackball: free rotation stays finite upside down', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  beginTrackball(cam, -200, 120, 360);
  dragTrackball(cam, 220, -180, 360);
  assert.ok(Math.abs(Math.hypot(cam._q.x, cam._q.y, cam._q.z, cam._q.w) - 1) < 1e-9);
  // Flip the view across the pole, then drag again.
  beginTrackball(cam, 0, -340, 360);
  dragTrackball(cam, 0, 340, 360);
  assert.ok(Math.abs(Math.hypot(cam._q.x, cam._q.y, cam._q.z, cam._q.w) - 1) < 1e-9);
  const pr = cam.project({ x: 0.1, y: 0.2, z: 0.97 });
  assert.ok(Number.isFinite(pr.x) && Number.isFinite(pr.y));
});

test('shared controls: vertical drag and arrow directions are direct', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  const p = { x: 0.1, y: 0.15, z: 0.98 };
  const before = cam.project(p);
  // Viewer passes negative screen Y into the trackball; a downward drag must move down.
  beginTrackball(cam, 0, 0, 360);
  dragTrackball(cam, 0, -160, 360);
  const after = cam.project(p);
  assert.ok(after.y > before.y, 'downward drag moves the surface down');

  const cam2 = new SphereCamera({ width: 1000, height: 800 });
  cam2.reset();
  const b2 = cam2.project(p);
  applyArrowKey(cam2, 'ArrowUp');
  const a2 = cam2.project(p);
  assert.ok(a2.y < b2.y, 'up cursor moves the view up');
});
