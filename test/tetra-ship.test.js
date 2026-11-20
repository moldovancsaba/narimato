import test from 'node:test';
import assert from 'node:assert/strict';

import { TETRA_SHIP, drawTetraShip, projectTetraShip } from '../public/js/shared/tetra-ship.js';

test('tetra ship: exactly five tetrahedra, four vertices each, triangular faces only', () => {
  assert.equal(TETRA_SHIP.length, 5);
  for (const tet of TETRA_SHIP) {
    assert.equal(tet.verts.length, 4, `${tet.id} has four vertices`);
    for (const v of tet.verts) {
      assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
    }
  }
  const projected = projectTetraShip({ x: 100, y: 100, scale: 2, yaw: 0.7, pitch: -0.3, roll: 0.2 });
  assert.equal(projected.faces.length, 5 * 4, 'each tetra contributes four triangular faces');
  assert.equal(projected.points.length, 5 * 4, 'each tetra contributes four projected vertices');
  for (const face of projected.faces) {
    for (const point of [face.a, face.b, face.c]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    }
  }
  assert.ok(Number.isFinite(projected.engine.x) && Number.isFinite(projected.engine.y));
});

/* ------------------------------------------- EVT-02 measurable path snapshot */

/** Minimal deterministic CanvasRenderingContext2D recorder (no DOM, no pixels). */
function recordShipPaths(options) {
  const calls = { beginPath: 0, moveTo: 0, lineTo: 0, closePath: 0, fill: 0, stroke: 0, arc: 0, ellipse: 0 };
  const gradient = { addColorStop() {} };
  const ctx = {
    lineJoin: '',
    lineCap: '',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save() {},
    restore() {},
    beginPath() { calls.beginPath += 1; },
    moveTo() { calls.moveTo += 1; },
    lineTo() { calls.lineTo += 1; },
    closePath() { calls.closePath += 1; },
    fill() { calls.fill += 1; },
    stroke() { calls.stroke += 1; },
    arc() { calls.arc += 1; },
    ellipse() { calls.ellipse += 1; },
    createRadialGradient() { return gradient; },
    createLinearGradient() { return gradient; },
  };
  const model = drawTetraShip(ctx, options);
  return { calls, faces: model.faces.length, points: model.points.length };
}

test('tetra ship: deterministic path-count snapshot for two poses', () => {
  const relief = recordShipPaths({ x: 320, y: 240, scale: 1.4, yaw: 0.8, pitch: -0.35, roll: 0.25 });
  const alien = recordShipPaths({ x: 900, y: 300, scale: 2.1, yaw: 2.4, pitch: 0.15, roll: -0.4 });
  // Exactly one triangle path per tetra face, one shadow ellipse and two engine
  // circles: the snapshot makes a stray/extra path a test failure.
  assert.equal(relief.faces, 20);
  assert.equal(relief.calls.beginPath, 23);
  assert.equal(relief.calls.moveTo, 20);
  assert.equal(relief.calls.lineTo, 40);
  assert.equal(relief.calls.closePath, 20);
  assert.equal(relief.calls.fill, 23);
  assert.equal(relief.calls.stroke, 20);
  assert.equal(relief.calls.ellipse, 1);
  assert.equal(relief.calls.arc, 2);

  assert.deepEqual(alien.calls, relief.calls, 'path count is pose-independent');
  // Drawing twice with the same pose is byte-for-byte deterministic.
  assert.deepEqual(recordShipPaths({ x: 320, y: 240, scale: 1.4, yaw: 0.8, pitch: -0.35, roll: 0.25 }), relief);
  // A missing context is a safe no-op, not a crash.
  assert.equal(drawTetraShip(null, {}), null);
  assert.equal(drawTetraShip({}, {}), null);
});
