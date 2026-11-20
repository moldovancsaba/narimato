import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera, baseIcosahedron } from '../public/js/shared/geometry.js';

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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('camera: the orbital six-vertex fixture projects to unchanged pixels', () => {
  const cam = new SphereCamera({ width: 1000, height: 800 });
  cam.reset();
  const { vertices } = baseIcosahedron();
  // Fixture captured from the v3.57 SphereCamera before the RND-01 contract
  // additions; the contract is additive, so these pixels must not move.
  const fixtures = [
    [0, 500, 63.54891256031959, 0.26673143668883115],
    [3, 776.3097608517276, 287.8476786561457, 0.6789799483683876],
    [4, 346.6401788651692, 305.599276082098, 0.9157642132566644],
    [7, 780.7903253703535, 541.6025493763109, -0.05184255484682626],
    [11, 585.1142032277764, 452.3920955367669, -0.9157642132566646],
  ];
  for (const [index, x, y, z] of fixtures) {
    const projected = cam.project(vertices[index]);
    assert.ok(Math.abs(projected.x - x) < 1e-9, `vertex ${index} x`);
    assert.ok(Math.abs(projected.y - y) < 1e-9, `vertex ${index} y`);
    assert.ok(Math.abs(projected.z - z) < 1e-12, `vertex ${index} z`);
    assert.equal(projected.visible, z > 0, `vertex ${index} visibility is the front hemisphere`);
  }
});

test('camera: no camera module depends on the retired v3.58 frame helpers', () => {
  const retired = /\b(lookFrame|frameProject|frameUnproject)\b/;
  for (const file of ['public/js/shared/surface-camera.js', 'public/js/shared/camera-contract.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(retired.test(source), false, `${file} references a retired v3.58 helper`);
  }
});
