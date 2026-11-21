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


/* ------------------------------------------------------------------ *
 * CTL-02: pole continuity, cull axis truth and frame bounds
 * ------------------------------------------------------------------ */

import { qMul, qNormalize, qFromAxis } from '../public/js/shared/geometry.js';
import { applyArrowTravelFrame } from '../public/js/shared/orbit-controls.js';
import { IcosaRenderer, NEAR_EPS, OVERSCAN } from '../public/js/renderer.js';
import { baseIcosahedron as icoFaces } from '../public/js/shared/geometry.js';

function rendererWithFaces(width = 1200, height = 900) {
  const renderer = new IcosaRenderer(null);
  renderer.width = width;
  renderer.height = height;
  const { vertices, faces: triples } = icoFaces();
  const faces = triples.map(([ia, ib, ic], index) => ({
    label: `f${index}`,
    a: vertices[ia],
    b: vertices[ib],
    c: vertices[ic],
    depth: 0,
    ownerIndex: -1,
    clicks: 0,
    lastClickIndex: -1,
  }));
  renderer.setFaces(faces);
  return renderer;
}

/** Count faces the front cull loop would actually project (the `_visCount` mirror). */
function visibleFaces(renderer, camera) {
  const W = renderer.width;
  const H = renderer.height;
  const R = Math.min(W, H) * 0.4 * (Number(camera.zoom) || 1);
  renderer._computeCameraFrame(camera, R);
  const Kx = renderer._Kx;
  const Ky = renderer._Ky;
  const Kz = renderer._Kz;
  const cosA = renderer._cosA;
  const sinA = renderer._sinA;
  let count = 0;
  for (const entry of renderer.faces) {
    const c = entry.centroid;
    const dotc = c.x * Kx + c.y * Ky + c.z * Kz;
    const ct = entry.cosTheta;
    const st = entry.sinTheta;
    if (dotc >= cosA * ct - sinA * st) {
      if (renderer._projectEntry(entry, camera, W, H)) count += 1;
    }
  }
  return count;
}

test('CTL-02: a 720-step two-pole loop never flips travel and never empties the view', () => {
  const camera = new SphereCamera({ width: 1200, height: 900 });
  camera.reset();
  const renderer = rendererWithFaces(1200, 900);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const upSteps = 400;
  for (let i = 0; i < 720; i += 1) {
    const key = i < upSteps ? 'ArrowUp' : 'ArrowDown';
    const oldPos = camera.viewAxis();
    const oldUp = camera.carrierUp();
    applyArrowTravelFrame(camera, new Set([key]), 0.05);
    const nextPos = camera.viewAxis();
    const delta = { x: nextPos.x - oldPos.x, y: nextPos.y - oldPos.y, z: nextPos.z - oldPos.z };
    const alongUp = dot(delta, oldUp);
    // Holding a key always moves along its own tangent (Up -> +up, Down -> -up);
    // the sign must never flip while the key is held, including across a pole.
    assert.ok(key === 'ArrowUp' ? alongUp > 0 : alongUp < 0, `step ${i} (${key}) travels along its tangent across the pole`);
    assert.ok(Math.abs(dot(nextPos, camera.carrierUp())) < 1e-9, `step ${i} carrier stays orthonormal`);
    assert.ok(Math.abs(Math.hypot(nextPos.x, nextPos.y, nextPos.z) - 1) < 1e-9);
    assert.ok(visibleFaces(renderer, camera) > 0, `step ${i} draws at least one face`);
  }
  assert.equal(renderer.frameStats().emptyFrames, 0);
});

test('CTL-02: both poles with five roll angles still draw at least 12 faces', () => {
  const renderer = rendererWithFaces(1200, 900);
  for (const pitch of [Math.PI / 2, -Math.PI / 2]) {
    for (const roll of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI]) {
      const camera = new SphereCamera({ width: 1200, height: 900 });
      const base = qFromAxis({ x: 1, y: 0, z: 0 }, pitch);
      const rolled = qMul(qNormalize(qFromAxis({ x: 0, y: 0, z: 1 }, roll)), base);
      camera.setOrientation(rolled);
      const axis = camera.viewAxis();
      assert.ok(Number.isFinite(axis.x) && Number.isFinite(axis.y) && Number.isFinite(axis.z));
      const count = visibleFaces(renderer, camera);
      assert.ok(count >= 12, `pitch=${pitch.toFixed(2)} roll=${roll.toFixed(2)} draws ${count} faces`);
    }
  }
});

test('CTL-02: culling has no Euler fallback and throws without viewAxis()', () => {
  const renderer = rendererWithFaces();
  assert.throws(() => renderer._computeCameraFrame({ distance: 3.2, yaw: 1, pitch: 1 }, 480), /viewAxis\(\) is required/);
  assert.throws(() => renderer._computeCameraFrame({ distance: 3.2, viewAxis: () => ({ x: NaN, y: 0, z: 1 }) }, 480), /finite unit axis/);
  const camera = new SphereCamera({ width: 1200, height: 900 });
  camera.reset();
  renderer._computeCameraFrame(camera, 480);
  const stats = renderer.frameStats();
  assert.equal(stats.axis.length, 3);
  assert.ok(Math.abs(Math.hypot(...stats.axis) - 1) < 1e-12);
});

test('CTL-02: projected samples are near-plane skipped and overscan clamped', () => {
  assert.equal(NEAR_EPS, 1e-3);
  assert.equal(OVERSCAN, 4);
  const renderer = new IcosaRenderer(null);
  renderer.width = 1000;
  renderer.height = 800;
  const bound = OVERSCAN * 1000;
  const makeEntry = () => ({ wx: new Float64Array([0.1, 0.2, 0.97, 0.2, 0.1, 0.9, 0.1, 0.1, 0.98]), n: 3, px: new Float64Array(3), py: new Float64Array(3), pz: new Float64Array(3), label: 'test' });
  const nearCamera = { distance: 3.2, project: () => ({ x: 1e12, y: -1e12, z: 1, depth: 0, visible: true }) };
  const nearEntry = makeEntry();
  assert.equal(renderer._projectEntry(nearEntry, nearCamera, 1000, 800), false, 'near samples are skipped');
  assert.equal(nearEntry.px[0], bound);
  assert.equal(nearEntry.py[0], -bound);
  assert.ok(renderer.frameStats().nearSkipped >= 3);
  assert.ok(renderer.frameStats().culled >= 1);

  const farCamera = { distance: 3.2, project: () => ({ x: 5e9, y: 5e9, z: 0.5, depth: 2.7, visible: true }) };
  const farEntry = makeEntry();
  assert.equal(renderer._projectEntry(farEntry, farCamera, 1000, 800), false, 'off-screen after clamping');
  assert.equal(farEntry.maxX, bound, 'unbounded coordinates are clamped');
  assert.ok(Number.isFinite(farEntry.sr));
});

test('CTL-02: frameStats exposes one read-only contraction of the counters', () => {
  const renderer = rendererWithFaces();
  const camera = new SphereCamera({ width: 1200, height: 900 });
  camera.reset();
  visibleFaces(renderer, camera);
  const stats = renderer.frameStats();
  assert.deepEqual(Object.keys(stats).sort(), ['axis', 'culled', 'emptyFrames', 'nearSkipped', 'visCount']);
  assert.equal(renderer.resetEmptyFrames(), renderer);
  assert.equal(renderer.frameStats().emptyFrames, 0);
});
