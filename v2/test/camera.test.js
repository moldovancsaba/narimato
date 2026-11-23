import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, horizonAngle, horizonRow, phaseCamera } from '../public/camera.js';

const W = 1200;
const H = 800;

test('v2 camera: four approved distances and pitches', () => {
  assert.deepEqual(PHASES.map((p) => p.distance), [3.20, 2.10, 1.44, 1.04]);
  assert.deepEqual(PHASES.map((p) => p.pitchDeg), [0, 8, 23.5, 53.5]);
});

test('v2 camera: one camera instance per phase with the fixed landing rig', () => {
  for (const phase of PHASES) {
    const cam = phaseCamera(phase.id, W, H);
    assert.equal(cam.phase.id, phase.id);
    assert.equal(cam.distance, phase.distance);
    assert.ok(cam.origin.x === cam.origin.x && cam.origin.y === cam.origin.y && cam.origin.z === cam.origin.z);
    assert.ok(cam.basis && cam.basis.up && cam.basis.right && cam.basis.forward);
  }
});

test('v2 camera: L2-L4 pitch puts the geometric limb on the 10% row', () => {
  for (const phase of PHASES.slice(1)) {
    const cam = phaseCamera(phase.id, W, H);
    const focal = (H / 2) / Math.tan((50 * Math.PI) / 360);
    const targetAngle = Math.atan(((H / 2 - horizonRow(H)) / focal));
    const limb = horizonAngle(phase);
    assert.ok(Math.abs(limb - targetAngle) < 1e-2, `${phase.name} limb ${limb} target ${targetAngle}`);
  }
});

test('v2 camera: no zoom / FOV change across phases', () => {
  const focals = PHASES.map((p) => phaseCamera(p.id, W, H).focal);
  for (const f of focals) assert.ok(Math.abs(f - focals[0]) < 1e-9);
});
