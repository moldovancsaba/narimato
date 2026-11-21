import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IcosaRenderer } from '../public/js/renderer.js';
import { World } from '../public/js/world.js';
import * as humanoidRig from '../public/js/shared/humanoid-3d.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_FILES = ['public/js/app.js', 'public/js/surface-controller.js', 'public/js/renderer.js'];

function makeRenderer() {
  const renderer = new IcosaRenderer(null);
  const world = new World();
  world.setPlanetSeed(4242);
  const leaves = world.activeLeaves();
  // Renderer faces are the fixed tessellation (`~<leaf>.<i>`); one face per leaf
  // is enough to resolve labels and centroids in a headless test.
  const faces = leaves.map((leaf) => ({
    label: `~${leaf.label}.0`,
    a: leaf.a,
    b: leaf.b,
    c: leaf.c,
    centroid: leaf.centroid,
    depth: leaf.depth,
    ownerIndex: leaf.ownerIndex,
    clicks: leaf.clicks,
    lastClickIndex: leaf.lastClickIndex,
    terrain: null,
    resourceId: null,
  }));
  renderer.setFaces(faces);
  return { renderer, world, leaves };
}

function pose(leaf, updatedAt, x = 0) {
  return {
    playerId: 'p_robot',
    tag: 'ROBOT',
    color: '#a78bfa',
    surface: {
      pos: { x: leaf.centroid.x + x, y: leaf.centroid.y, z: leaf.centroid.z },
      heading: { x: 1, y: 0, z: 0 },
      state: 'walk',
      moving: true,
      updatedAt,
    },
  };
}

test('renderer surface api: the six RND-07 methods exist on IcosaRenderer', () => {
  const { renderer } = makeRenderer();
  for (const method of ['mineBeam', 'setPeers', 'removePeer', 'setSupplyMarkers', 'setResourcePins', 'clearSurfaceVisuals']) {
    assert.equal(typeof renderer[method], 'function', `${method} exists`);
  }
  assert.equal(typeof renderer.surfaceVisualStats, 'function');
  assert.equal(typeof renderer.avatarStats, 'function');
});

test('renderer surface api: a beam for a missing leaf is dropped and counted', () => {
  const { renderer, leaves } = makeRenderer();
  const before = renderer.surfaceVisualStats().droppedBeams;
  const ok = renderer.mineBeam({ playerId: 'p_robot', toLeaf: '99.99', startAt: 1000 });
  assert.equal(ok, false, 'no beam to a cell the server never named');
  assert.equal(renderer.surfaceVisualStats().droppedBeams, before + 1);
  assert.equal(renderer.beams.length, 0);
  // A live leaf is accepted and remembered.
  const accepted = renderer.mineBeam({
    playerId: 'p_robot',
    toLeaf: leaves[0].label,
    startAt: 1000,
    pos: leaves[0].centroid,
    kind: 'mine',
  });
  assert.equal(accepted, true);
  assert.equal(renderer.beams.length, 1);
  assert.equal(renderer.beams[0].toLeaf, leaves[0].label);
});

test('renderer surface api: peer interpolation clamps at the newest sample', () => {
  const { renderer, leaves } = makeRenderer();
  const target = leaves[2];
  const peer = {
    playerId: 'p_robot',
    tag: 'ROBOT',
    color: '#a78bfa',
    surface: {
      pos: { ...target.centroid },
      heading: { x: 1, y: 0, z: 0 },
      state: 'walk',
      moving: true,
      updatedAt: 1000,
    },
  };
  renderer.setPeers([peer], 1200);
  renderer.setPeers([pose(target, 1100)], 1200);
  const visual = renderer.peerVisuals.get('p_robot');
  assert.equal(visual.samples.length, 2);
  assert.deepEqual(visual.samples.map((sample) => sample.updatedAt), [1000, 1100]);
  // Render time 1200 − INTERP_DELAY_MS(120) = 1080 → between the samples.
  const middle = renderer.samplePeer(visual, 1200);
  assert.equal(middle.interpolated, true);
  // Far past the newest sample: hold it, never extrapolate.
  const held = renderer.samplePeer(visual, 9000);
  assert.equal(held.interpolated, false);
  assert.deepEqual(held.pos, visual.samples[visual.samples.length - 1].pos);
  // A single-sample peer never moves from the origin.
  renderer.setPeers([{ ...pose(target, 2000), playerId: 'p_single' }], 2000);
  const single = renderer.peerVisuals.get('p_single');
  const one = renderer.samplePeer(single, 2100);
  assert.equal(one.interpolated, false);
  assert.deepEqual(one.pos, single.samples[single.samples.length - 1].pos);
});

test('renderer surface api: out-of-order and duplicate poses never rewind the body', () => {
  const { renderer, leaves } = makeRenderer();
  const target = leaves[3];
  renderer.setPeers([pose(target, 2000)], 2000);
  renderer.setPeers([pose(target, 2100)], 2100);
  renderer.setPeers([pose(target, 2050)], 2100);
  renderer.setPeers([pose(target, 2050)], 2100);
  const visual = renderer.peerVisuals.get('p_robot');
  const times = visual.samples.map((sample) => sample.updatedAt);
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'samples stay in updatedAt order');
  assert.equal(new Set(times).size, times.length, 'duplicates are ignored');
  const newest = visual.samples[visual.samples.length - 1];
  const sample = renderer.samplePeer(visual, 5000);
  assert.deepEqual(sample.pos, newest.pos, 'holds the newest authoritative pose');
});

test('renderer surface api: mining lift starts within 150 ms of the surface_mine frame', () => {
  const { renderer, leaves } = makeRenderer();
  const target = leaves[4];
  renderer.setPeers([pose(target, 5000)], 5000);
  // Beam arrives at server time 5000 with the authoritative pose.
  renderer.setPeers([pose(target, 5000)], 5000);
  assert.equal(renderer.mineBeam({
    playerId: 'p_robot',
    toLeaf: target.label,
    startAt: 5000,
    kind: 'mine',
  }), true);
  assert.equal(renderer.peerMinePhase('p_robot', 5000), 0);
  const at150 = renderer.peerMinePhase('p_robot', 5150);
  assert.ok(at150 >= 0.95, `mining lift is visible 150 ms after the frame (phase ${at150})`);
  const later = renderer.peerMinePhase('p_robot', 5600);
  assert.ok(later >= 0 && later <= 1);
  // The beam TTL bounds the lift.
  assert.equal(renderer.peerMinePhase('p_robot', 7000), 0);
});

test('renderer surface api: resource pins ignore entries without a resourceId', () => {
  const { renderer, leaves } = makeRenderer();
  const live = leaves[0].label;
  const count = renderer.setResourcePins([
    { label: live },
    { label: live, resourceId: null },
    { label: '99.9', resourceId: 'gold' },
    { label: live, resourceId: 'gold' },
  ]);
  assert.equal(count, 1, 'only a live leaf with a non-null resourceId becomes a pin');
  assert.deepEqual(renderer.resourcePins, [{ label: live, resourceId: 'gold' }]);
});

test('renderer surface api: removePeer fades and clearSurfaceVisuals empties every collection', () => {
  const { renderer, leaves } = makeRenderer();
  renderer.setPeers([pose(leaves[5], 1000)], 1000);
  renderer.mineBeam({ playerId: 'p_robot', toLeaf: leaves[5].label, startAt: 1000 });
  renderer.setResourcePins([{ label: leaves[5].label, resourceId: 'gold' }]);
  renderer.setSupplyMarkers([{ label: leaves[6].label, resourceId: 'uranium' }]);
  assert.equal(renderer.removePeer('p_robot'), true);
  assert.equal(renderer.peerVisuals.get('p_robot').leaving, true);
  assert.equal(renderer.removePeer('p_missing'), false);
  renderer.clearSurfaceVisuals();
  assert.equal(renderer.peerVisuals.size, 0);
  assert.equal(renderer.beams.length, 0);
  assert.equal(renderer.resourcePins.length, 0);
  assert.equal(renderer.surfaceVisualStats().beams, 0);
});

test('renderer surface api: avatarStats reports the rig triangle budget and event sources', () => {
  const { renderer } = makeRenderer();
  // The rig is a lazy chunk (PERF-01): attach it as the app does on surface entry.
  assert.equal(renderer.setHumanoidModule(humanoidRig), true);
  const stats = renderer.avatarStats();
  assert.equal(stats.l0, humanoidRig.TRIANGLE_COUNTS.L0);
  assert.equal(stats.l1, humanoidRig.TRIANGLE_COUNTS.L1);
  assert.equal(stats.l2, humanoidRig.TRIANGLE_COUNTS.L2);
  assert.equal(stats.sources.rig, 'shared/humanoid-3d.js');
  assert.equal(stats.sources.peers, 'surface frames');
  assert.equal(stats.sources.mining, 'surface_mine frames');
});

test('renderer surface api: app.js forwards events instead of keeping visual state', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public/js/app.js'), 'utf8');
  assert.equal(app.includes('showMine'), false, 'app no longer calls the removed surface.showMine()');
  assert.ok(app.includes('setPeers'), 'app forwards surface frames to renderer.setPeers');
  assert.ok(app.includes('mineBeam'), 'app forwards surface_mine to renderer.mineBeam');
  assert.ok(app.includes('removePeer'), 'app forwards surface_leave to renderer.removePeer');
  for (const file of ROOT_FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(source.includes('mineEffects'), false, `${file} keeps no private effect list`);
    assert.equal(source.includes('mineTotal'), false, `${file} keeps no private mine counter`);
  }
});
