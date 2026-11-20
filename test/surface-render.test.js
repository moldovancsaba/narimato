import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSurfaceController } from '../public/js/surface-controller.js';
import { World } from '../public/js/world.js';
import { parseSurfaceRenderer, restoreOrbit, saveOrbit } from '../public/js/shared/view-state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function makeHarness() {
  const world = new World();
  world.setPlanetSeed(12345);
  const leaves = world.activeLeaves();
  let clock = 0;
  const poses = [];
  const huds = [];
  let harvests = 0;
  let exits = 0;
  const controller = createSurfaceController({
    getStartPoint: () => leaves[0].centroid,
    getLeaves: () => leaves,
    getPlanet: () => ({ name: 'MAGRATHEA', seed: 12345, depth: 2 }),
    getPlayers: () => [{ id: 'p_me', tag: 'ME', color: '#00f0ff' }],
    getMyPlayerId: () => 'p_me',
    getMyIndex: () => 0,
    getMaxDepth: () => 8,
    getSupplyCells: () => [],
    getPeers: () => [],
    onPose: (pose) => poses.push(pose),
    onHarvest: () => { harvests += 1; },
    onExit: () => { exits += 1; },
    onHud: (state) => huds.push(state),
    now: () => clock,
  });
  return {
    world,
    leaves,
    controller,
    tick(ms) {
      clock += ms;
      return controller.update(ms);
    },
    get harvests() { return harvests; },
    get exits() { return exits; },
    poses,
    huds,
  };
}

test('surface render: enter/exit state machine without a second render loop', () => {
  const h = makeHarness();
  assert.equal(h.controller.active, false);
  assert.equal(h.controller.start({ planetName: 'MAGRATHEA', seed: 12345, depth: 2 }), true);
  assert.equal(h.controller.active, true);
  assert.equal(h.controller.phase, 'landing');
  h.tick(500);
  assert.equal(h.controller.phase, 'landing', 'landing animation holds the walking phase');
  h.tick(1800);
  assert.equal(h.controller.phase, 'walking');
  assert.equal(h.controller.stop(), true);
  assert.equal(h.controller.phase, 'leaving');
  assert.equal(h.tick(300), false, 'exit animation is not instant');
  assert.equal(h.tick(1400), true, 'exit completes');
  assert.equal(h.controller.active, false);
  assert.equal(h.exits, 1, 'onExit fires once');
});

test('surface render: orbit camera is stored and restored exactly', () => {
  const camera = { yaw: 0.83, pitch: -0.41, zoom: 7.25, distance: 3.2 };
  const saved = saveOrbit(camera);
  assert.deepEqual(saved, { yaw: 0.83, pitch: -0.41, zoom: 7.25, distance: 3.2 });
  camera.yaw = 1.9;
  camera.pitch = 0.2;
  camera.zoom = 0.5;
  camera.distance = 2.1;
  assert.equal(restoreOrbit(camera, saved), true);
  assert.deepEqual(camera, { yaw: 0.83, pitch: -0.41, zoom: 7.25, distance: 3.2 });
  assert.equal(saveOrbit(null), null);
  assert.equal(restoreOrbit(null, saved), false);
  assert.equal(restoreOrbit(camera, null), false);
});

test('surface render: rollback flag selection fails closed to the single scene', () => {
  assert.equal(parseSurfaceRenderer(''), 'scene');
  assert.equal(parseSurfaceRenderer('?surface-renderer=overlay'), 'overlay');
  assert.equal(parseSurfaceRenderer('surface-renderer=overlay'), 'overlay');
  assert.equal(parseSurfaceRenderer('?surface-renderer=scene'), 'scene');
  assert.equal(parseSurfaceRenderer('?surface-renderer=bogus'), 'scene');
});

test('surface render: entities are mapped from the live world, not copied geometry', () => {
  const h = makeHarness();
  h.controller.start({ planetName: 'MAGRATHEA', seed: 12345, depth: 2 });
  h.tick(2400);
  const entities = h.controller.entities();
  const self = entities.find((entity) => entity.kind === 'self');
  assert.ok(self, 'self entity exists');
  assert.equal(self.playerId, 'p_me');
  assert.ok(Math.abs(Math.hypot(self.pos.x, self.pos.y, self.pos.z) - 1) < 1e-9, 'entity pos is a unit surface point');
  assert.equal(self.label, 'ME');
  const pin = entities.find((entity) => entity.kind === 'pin' && entity.variant === 'target');
  assert.ok(pin, 'target pin exists');
  assert.ok(pin.cellLabel, 'pin references the authoritative cell label');
  assert.equal(h.leaves.some((leaf) => leaf.label === pin.cellLabel), true, 'pin label resolves in the world');
  // Entities never carry a cell copy (a/b/c) — only the label + anchor point.
  for (const entity of entities) {
    assert.equal(Object.prototype.hasOwnProperty.call(entity, 'a'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(entity, 'b'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(entity, 'c'), false);
  }
});

test('surface render: controller owns only the local body and target pin (RND-07 moved peers/beams to the renderer)', () => {
  const world = new World();
  world.setPlanetSeed(9);
  const leaves = world.activeLeaves();
  const peers = [{
    playerId: 'p_peer',
    tag: 'PEER',
    color: '#ff2bd6',
    surface: { pos: { ...leaves[0].centroid }, heading: { x: 1, y: 0, z: 0 } },
  }];
  const controller = createSurfaceController({
    getStartPoint: () => leaves[0].centroid,
    getLeaves: () => leaves,
    getPlanet: () => ({ name: 'MAGRATHEA', seed: 9, depth: 2 }),
    getPlayers: () => [{ id: 'p_me', tag: 'ME' }, { id: 'p_peer', tag: 'PEER' }],
    getMyPlayerId: () => 'p_me',
    getMyIndex: () => 0,
    getMaxDepth: () => 8,
    getPeers: () => peers,
    now: () => 5000,
  });
  controller.start({ planetName: 'MAGRATHEA', seed: 9, depth: 2 });
  controller.update(2400);
  const entities = controller.entities();
  assert.deepEqual(entities.map((entity) => entity.kind).sort(), ['pin', 'self']);
  assert.equal(entities.some((entity) => entity.kind === 'peer'), false, 'peers are renderer-owned');
  assert.equal(entities.some((entity) => entity.kind === 'beam'), false, 'beams are renderer-owned');
  // No effect state remains in the controller (RND-07 §10).
  const source = fs.readFileSync(path.join(ROOT, 'public/js/surface-controller.js'), 'utf8');
  for (const banned of ['mineEffects', 'mineTotal', 'showMine', 'virtualPeerPosition']) {
    assert.equal(source.includes(banned), false, `surface-controller.js must not keep ${banned}`);
  }
  assert.equal(typeof controller.mineCount, 'undefined', 'no mine counter in the controller');
});

test('surface render: held movement keys advance the pilot along the sphere', () => {
  const h = makeHarness();
  h.controller.start({ planetName: 'MAGRATHEA', seed: 12345, depth: 2 });
  h.tick(2400);
  const start = h.controller.pose().pos;
  h.controller.hold('KeyW', true);
  for (let i = 0; i < 20; i += 1) h.tick(16);
  h.controller.hold('KeyW', false);
  const moved = h.controller.pose().pos;
  assert.ok(Math.abs(Math.hypot(moved.x, moved.y, moved.z) - 1) < 1e-9, 'position stays on the unit sphere');
  assert.ok(dot(moved, start) < 0.999999, 'the pilot moved across the surface');
  assert.ok(h.controller.travel > 0);
  assert.ok(h.huds.length > 0, 'surface readouts are pushed through the HUD path');
  assert.ok(h.huds.every((state) => typeof state.lapFraction === 'number'));
});

test('surface render: the controller owns no canvas, RAF loop or projection', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/js/surface-controller.js'), 'utf8');
  for (const banned of ['requestAnimationFrame(', 'getContext(', 'createElement(', 'new Path2D(', 'drawImage(']) {
    assert.equal(source.includes(banned), false, `surface-controller.js must not contain ${banned}`);
  }
  // One renderer instance remains the only owner of the planet canvas.
  const app = fs.readFileSync(path.join(ROOT, 'public/js/app.js'), 'utf8');
  assert.equal(app.includes("document.querySelectorAll('canvas#arena-canvas')"), true);
  assert.equal(app.includes('surface-mode.js'), false, 'the second renderer module is gone');
});
