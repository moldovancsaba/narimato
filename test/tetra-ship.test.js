import test from 'node:test';
import assert from 'node:assert/strict';

import { TETRA_SHIP, projectTetraShip } from '../public/js/shared/tetra-ship.js';

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
