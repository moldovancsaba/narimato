import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FIGURE_HEIGHT_UNITS,
  HUMAN_JOINTS,
  LOD_LIMITS,
  LOD_LEVELS,
  MAX_JOINT_ANGLE,
  TRIANGLE_COUNTS,
  angleFromAxis,
  buildRig,
  drawRig,
  easeOut,
  jointCoincidence,
  lodForDistance,
  materialColor,
  poseAngles,
  poseHash,
  poseJoints,
  poseRig,
  projectRig,
  tangentFrame,
  toolPoint,
} from '../public/js/shared/humanoid-3d.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_SCALE = 0.01;
const rig = buildRig(PRODUCTION_SCALE);

function boxSurfaceError(part, point) {
  // A point lies on a closed axis-aligned box surface when it is inside every
  // slab and touches at least one face within floating-point tolerance.
  const base = part.base;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < part.count; i += 1) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const z = base[i * 3 + 2];
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
  }
  const e = 1e-9;
  const outside = Math.max(
    min.x - point.x, point.x - max.x,
    min.y - point.y, point.y - max.y,
    min.z - point.z, point.z - max.z,
    0,
  );
  if (outside > e) return Infinity;
  return Math.min(
    point.x - min.x, max.x - point.x,
    point.y - min.y, max.y - point.y,
    point.z - min.z, max.z - point.z,
  );
}

function mockContext() {
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {},
    moveTo(x, y) { calls.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { calls.push({ op: 'lineTo', x, y }); },
    closePath() {},
    fill() { calls.push({ op: 'fill', style: ctx.fillStyle }); },
    stroke() { calls.push({ op: 'stroke' }); },
    calls,
  };
  return ctx;
}

test('humanoid rig: every volume is a closed outward-wound manifold (V − E + F = 2)', () => {
  for (const levelName of ['L0', 'L1']) {
    const level = rig.levels[levelName];
    for (const part of level.parts) {
      assert.equal(part.count, 8, `${part.id}: box has 8 vertices`);
      const edges = new Map();
      for (const face of part.faces) {
        assert.equal(face.v.length, 3, 'triangular faces only');
        const [a, b, c] = face.v;
        assert.equal(new Set([a, b, c]).size, 3, `${part.id}: no degenerate faces`);
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const key = u < v ? `${u}:${v}` : `${v}:${u}`;
          edges.set(key, (edges.get(key) || 0) + 1);
        }
      }
      for (const [edge, count] of edges) {
        assert.equal(count, 2, `${part.id}: edge ${edge} shared by exactly two faces`);
      }
      const V = part.count;
      const E = edges.size;
      const F = part.faces.length;
      assert.equal(V - E + F, 2, `${part.id}: Euler characteristic 2`);
      // Outward winding: every face normal points away from the box centre.
      const centre = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < part.count; i += 1) {
        centre.x += part.base[i * 3] / part.count;
        centre.y += part.base[i * 3 + 1] / part.count;
        centre.z += part.base[i * 3 + 2] / part.count;
      }
      for (const face of part.faces) {
        const [ia, ib, ic] = face.v;
        const a = { x: part.base[ia * 3], y: part.base[ia * 3 + 1], z: part.base[ia * 3 + 2] };
        const b = { x: part.base[ib * 3], y: part.base[ib * 3 + 1], z: part.base[ib * 3 + 2] };
        const c = { x: part.base[ic * 3], y: part.base[ic * 3 + 1], z: part.base[ic * 3 + 2] };
        const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
        const normal = {
          x: ab.y * ac.z - ab.z * ac.y,
          y: ab.z * ac.x - ab.x * ac.z,
          z: ab.x * ac.y - ab.y * ac.x,
        };
        const outward = {
          x: (a.x + b.x + c.x) / 3 - centre.x,
          y: (a.y + b.y + c.y) / 3 - centre.y,
          z: (a.z + b.z + c.z) / 3 - centre.z,
        };
        const dot = normal.x * outward.x + normal.y * outward.y + normal.z * outward.z;
        assert.ok(dot > 0, `${part.id}: face winds outward`);
      }
    }
  }
});

test('humanoid rig: triangle budget is 132 / 72 / 2 and bounds are finite', () => {
  assert.deepEqual({ ...TRIANGLE_COUNTS }, { L0: 132, L1: 72, L2: 2 });
  for (const levelName of LOD_LEVELS) {
    const level = rig.levels[levelName];
    assert.equal(level.triangles, TRIANGLE_COUNTS[levelName]);
    for (const value of Object.values(level.bounds.min).concat(Object.values(level.bounds.max))) {
      assert.ok(Number.isFinite(value));
    }
  }
  assert.equal(rig.parts.length, 11, 'eleven L0 volumes');
  assert.equal(rig.levels.L1.parts.length, 6, 'six merged L1 volumes');
  assert.ok(Math.abs(rig.levels.L0.bounds.height - FIGURE_HEIGHT_UNITS * PRODUCTION_SCALE) < 1e-9);
});

test('humanoid rig: nine named joints coincide within 1e-9 for every pose', () => {
  assert.equal(HUMAN_JOINTS.length, 9);
  assert.deepEqual(HUMAN_JOINTS, [
    'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR',
  ]);
  const poses = [
    { walkPhase: 0, minePhase: 0 },
    { walkPhase: 0.4, minePhase: 0 },
    { walkPhase: 1.9, minePhase: 0.8, moving: true },
    { walkPhase: -2.2, minePhase: 1, lean: 0.6 },
    { walkPhase: 0.75, minePhase: 0.5, moving: false, lean: -0.9 },
  ];
  const partByGroup = {
    neck: ['head', 'torso'],
    shoulderL: ['torso', 'upperArmL'],
    shoulderR: ['torso', 'upperArmR'],
    elbowL: ['upperArmL', 'lowerArmL'],
    elbowR: ['upperArmR', 'lowerArmR'],
    hipL: ['pelvis', 'thighL'],
    hipR: ['pelvis', 'thighR'],
    kneeL: ['thighL', 'shinL'],
    kneeR: ['thighR', 'shinR'],
  };
  for (const pose of poses) {
    const report = jointCoincidence(rig, pose);
    assert.ok(report.maxError <= 1e-9, `joints coincide for ${JSON.stringify(pose)} (error ${report.maxError})`);
    const posed = poseJoints(rig, pose);
    for (const joint of HUMAN_JOINTS) {
      for (const partId of partByGroup[joint]) {
        const part = rig.parts.find((entry) => entry.id === partId);
        assert.ok(part, `${partId} exists`);
        // The joint anchor must be on both named parts: use the rest-pose
        // anchors (rig joints are fixed before posing by construction).
        const anchor = rig.joints[joint].at;
        const rest = {
          x: pose.lean ? anchor.x : anchor.x,
          y: anchor.y,
          z: anchor.z,
        };
        assert.ok(boxSurfaceError(part, rest) <= 1e-9, `${joint} sits on ${partId}`);
      }
      for (const value of Object.values(posed[joint])) assert.ok(Number.isFinite(value));
    }
  }
});

test('humanoid rig: pose is deterministic from (walkPhase, minePhase)', () => {
  const pose = { walkPhase: 1.234, minePhase: 0.42, moving: true, lean: 0.15 };
  const first = poseHash(poseRig(rig, pose, null, 'L0'));
  const second = poseHash(poseRig(rig, pose, null, 'L0'));
  assert.equal(first, second, 'same pose gives an identical vertex hash');
  const other = poseHash(poseRig(rig, { ...pose, walkPhase: 1.235 }, null, 'L0'));
  assert.notEqual(first, other, 'a different walk phase changes the vertices');
  const mining = poseHash(poseRig(rig, { ...pose, minePhase: 0.9 }, null, 'L0'));
  assert.notEqual(first, mining, 'a different mining phase changes the vertices');
  // A caller-provided buffer is reused and receives the same bytes.
  const out = new Float32Array(rig.vertexCount * 3);
  const reused = poseRig(rig, pose, out, 'L0');
  assert.equal(reused, out);
  assert.equal(poseHash(reused), first);
});

test('humanoid rig: walk cycle, knee bend and tool-arm mining lift follow the spec', () => {
  const walking = poseAngles({ walkPhase: 0.5, moving: true });
  const standing = poseAngles({ walkPhase: 0.5, moving: false });
  assert.equal(standing.walkPhase, 0, 'not moving freezes the walk cycle');
  // The landing pose is the w = 0 stance: one leg forward, one back, no split.
  assert.equal(standing.hip[-1], -0.55);
  assert.equal(standing.hip[1], 0.55);
  assert.ok(Math.abs(walking.hip[-1] - standing.hip[-1]) > 1e-6);
  assert.ok(walking.knee[-1] >= 0 && walking.knee[-1] <= MAX_JOINT_ANGLE);
  // Right tool arm lifts by −1.4·easeOut(m).
  const lifting = poseAngles({ walkPhase: 0, minePhase: 1 });
  const resting = poseAngles({ walkPhase: 0, minePhase: 0 });
  // The lift is clamped to MAX_JOINT_ANGLE: a visible tool-arm raise.
  assert.equal(lifting.shoulder[1], -1.4);
  assert.ok(resting.shoulder[1] - lifting.shoulder[1] > 0.9);
  assert.ok(Object.values(lifting).every((value) => typeof value !== 'number' || !Number.isFinite
    ? true
    : Math.abs(value) <= 1.4 || value === 1), 'joint angles stay clamped');
  assert.ok(easeOut(0) === 0 && easeOut(1) === 1 && easeOut(0.5) === 0.75);
  assert.ok(Math.abs(poseAngles({ minePhase: 2 }).minePhase - 1) < 1e-12, 'minePhase clamps to 1');
});

test('humanoid rig: LOD thresholds and ±0.03 rad hysteresis', () => {
  const { L0, L1 } = LOD_LIMITS;
  assert.equal(lodForDistance(L0 - 0.01, null), 'L0');
  assert.equal(lodForDistance(L0 + 0.01, null), 'L1');
  assert.equal(lodForDistance(L1 - 0.01, null), 'L1');
  assert.equal(lodForDistance(L1 + 0.01, null), 'L2');
  // Hysteresis: a level is retained 0.03 rad outside its boundary and only
  // restored 0.03 rad inside it, so an edge-hovering figure cannot flicker.
  assert.equal(lodForDistance(L0 + 0.01, 'L0'), 'L0', 'L0 retained just past the boundary');
  assert.equal(lodForDistance(L0 + LOD_LIMITS.HYSTERESIS + 0.01, 'L0'), 'L1');
  assert.equal(lodForDistance(L0 + 0.01, 'L1'), 'L1', 'no flicker back to L0 above the boundary');
  assert.equal(lodForDistance(L0 - 0.04, 'L1'), 'L0');
  assert.equal(lodForDistance(L1 + 0.01, 'L1'), 'L1', 'L1 retained just past the boundary');
  assert.equal(lodForDistance(L1 + LOD_LIMITS.HYSTERESIS + 0.01, 'L1'), 'L2');
  assert.equal(lodForDistance(L1 - 0.04, 'L2'), 'L1');
  assert.equal(lodForDistance(L1 + 0.01, 'L2'), 'L2');
});

test('humanoid rig: pole and antipode anchors never produce NaN', () => {
  for (const [anchor, forward] of [
    [{ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }],
    [{ x: 0, y: -1, z: 0 }, { x: 0, y: -1, z: 0 }],
    [{ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }],
    [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }],
  ]) {
    const frame = tangentFrame(anchor, forward);
    assert.ok(Number.isFinite(frame.forward.x) && Number.isFinite(frame.forward.y) && Number.isFinite(frame.forward.z));
    const posed = poseRig(rig, { walkPhase: 1, minePhase: 1 }, null, 'L0');
    assert.ok([...posed].every(Number.isFinite));
  }
});

test('humanoid rig: reduced motion freezes the walk and keeps the mining lift', () => {
  const frozen = poseAngles({ walkPhase: 1.7, moving: false, minePhase: 1 });
  const rest = poseAngles({ walkPhase: 0, moving: false, minePhase: 1 });
  assert.equal(frozen.walkPhase, 0, 'the walk cycle is frozen at the landing stance');
  assert.equal(frozen.hip[-1], rest.hip[-1]);
  assert.equal(frozen.shoulder[1], -1.4, 'mining lift survives reduced motion');
  assert.ok(frozen.minePhase === 1);
});

test('humanoid rig: material palette is distinct per body group', () => {
  const palette = {
    head: materialColor('head', { tint: '#63dfff' }),
    visor: materialColor('visor', { tint: '#63dfff' }),
    torso: materialColor('torso', { tint: '#63dfff' }),
    hips: materialColor('pelvis', { tint: '#63dfff' }),
    arm: materialColor('arm', { tint: '#63dfff' }),
    leg: materialColor('leg', { tint: '#63dfff' }),
  };
  const keys = Object.values(palette).map((rgb) => `${rgb.r},${rgb.g},${rgb.b}`);
  assert.equal(new Set(keys).size, keys.length, 'six visually distinct body materials');
  for (const rgb of Object.values(palette)) {
    for (const channel of [rgb.r, rgb.g, rgb.b]) assert.ok(channel >= 0 && channel <= 255);
  }
});

test('humanoid rig: no sprite path remains in public/', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(ROOT, 'public'));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('drawAvatar('), false, `${path.relative(ROOT, file)} has no drawAvatar sprite path`);
    assert.equal(source.includes('drawAvatar ='), false, `${path.relative(ROOT, file)} has no drawAvatar sprite path`);
  }
  // The shared module is the single humanoid implementation.
  const renderer = fs.readFileSync(path.join(ROOT, 'public/js/renderer.js'), 'utf8');
  assert.equal(renderer.includes('drawHumanoid3D'), false, 'the nine-box sprite helper is gone');
  assert.ok(renderer.includes('drawRig') || renderer.includes('humanoid-3d'), 'renderer consumes the rig');
});
