import test from 'node:test';
import assert from 'node:assert/strict';

import { World } from '../public/js/world.js';
import { baseIcosahedron, childTriangles } from '../public/js/shared/geometry.js';
import {
  LiveSurfaceStore,
  MAX_LEVEL,
  TRIANGLE_BUDGET,
  buildLiveSurface,
  hashTriangles,
  levelForLeaf,
  quantizeRgb,
} from '../public/js/shared/live-surface-mesh.js';

const colour = () => ({ r: 40, g: 90, b: 60 });

function baseLeaves() {
  const { vertices, faces } = baseIcosahedron();
  return faces.slice(0, 20).map(([ia, ib, ic], index) => ({
    label: String(index + 1),
    a: vertices[ia],
    b: vertices[ib],
    c: vertices[ic],
    depth: 0,
    ownerIndex: -1,
    terrainRgb: { r: 40, g: 90, b: 60 },
  }));
}

function splitLeaf(leaf) {
  return childTriangles(leaf.a, leaf.b, leaf.c).map((tri, index) => ({
    ...leaf,
    label: `${leaf.label}.${index + 1}`,
    a: tri.a,
    b: tri.b,
    c: tri.c,
    depth: (leaf.depth || 0) + 1,
  }));
}

test('live mesh: world revision is monotonic and resets only through reset', () => {
  const world = new World();
  const start = world.revision;
  assert.ok(Number.isInteger(start) && start >= 0);
  const labs = world.activeLeaves().map((leaf) => leaf.label);
  world.applyCell(labs[0], 0, 1, 0);
  const afterCell = world.revision;
  assert.ok(afterCell > start, 'a cell event bumps the revision');
  world.applyCell(labs[1], 0, 1, 0);
  assert.ok(world.revision > afterCell, 'strictly increasing');
  const beforeBreak = world.revision;
  world.applyBreak(labs[2], null);
  assert.ok(world.revision > beforeBreak, 'a break bumps the revision');
  const beforeResource = world.revision;
  world.applyResource(world.activeLeaves()[0].label, 'gold');
  assert.ok(world.revision > beforeResource, 'a resource event bumps the revision');
  const beforeReset = world.revision;
  world.reset();
  assert.equal(world.revision, 0, 'reset is the only reset');
  assert.ok(beforeReset > 0);
});

test('live mesh: subdivision level follows the documented edge formula', () => {
  const [leaf] = baseLeaves();
  // Edge halves on each 4-way split: 63.4°, 31.7°, 15.9°, 7.9°, 4.0°, 2.0°.
  // L = clamp(ceil(log2(e / 0.055)), 0, 4) → 4, 4, 3, 2, 1, 0.
  const expected = [4, 4, 3, 2, 1, 0];
  let level = [leaf];
  for (let depth = 0; depth < expected.length; depth += 1) {
    for (const node of level) assert.equal(levelForLeaf(node), expected[depth], `depth ${depth}`);
    level = level.flatMap((node) => splitLeaf(node));
  }
  assert.equal(levelForLeaf(null), 0);
  assert.equal(levelForLeaf({ a: { x: 1, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 1, y: 0, z: 0 } }), 0, 'zero edge stays at level 0');
  assert.ok(MAX_LEVEL === 4);
});

test('live mesh: colour buckets are quantised to 4 bits per channel', () => {
  assert.deepEqual(quantizeRgb({ r: 250, g: 3, b: 129 }), { key: (240 << 8) | (0 << 4) | 128, r: 240, g: 0, b: 128, fill: 'rgb(240,0,128)' });
  assert.equal(quantizeRgb(null).fill, 'rgb(32,80,112)');
});

test('live mesh: identical inputs produce an identical buffer hash across 50 runs', () => {
  const leaves = baseLeaves();
  const first = buildLiveSurface({ leaves, revision: 7, seed: 42, colourOf: colour });
  for (let i = 0; i < 49; i += 1) {
    const again = buildLiveSurface({ leaves, revision: 7, seed: 42, colourOf: colour });
    assert.equal(again.hash, first.hash, `run ${i} identical hash`);
    assert.equal(again.triangleCount, first.triangleCount);
    assert.equal(again.triangles.length, first.triangles.length);
  }
  assert.equal(first.hash, hashTriangles(first.triangles));
});

test('live mesh: triangle budget is clamped by lowering the largest level', () => {
  const leaf = baseLeaves()[0];
  const leaves = [leaf, ...splitLeaf(leaf), ...splitLeaf(leaf)];
  const forced = buildLiveSurface({ leaves, revision: 1, seed: 1, colourOf: colour, levelOf: () => MAX_LEVEL });
  assert.ok(forced.triangleCount <= TRIANGLE_BUDGET, `triangle count ${forced.triangleCount} <= budget`);
  assert.ok(forced.triangleCount > 0);
  const levelsSum = forced.levelCounts.reduce((sum, count, level) => sum + count * 4 ** level, 0);
  assert.equal(levelsSum, forced.triangleCount, 'level counts explain the triangle total');
  // Budget is a hard cap at 6000 for the documented worst case.
  const wide = buildLiveSurface({ leaves: baseLeaves(), revision: 1, seed: 1, colourOf: colour, levelOf: () => MAX_LEVEL, budget: 6000 });
  assert.ok(wide.triangleCount <= 6000);
});

test('live mesh: buckets index contiguous runs of triangles', () => {
  const leaves = baseLeaves().slice(0, 4);
  leaves[0].terrainRgb = { r: 250, g: 10, b: 10 };
  leaves[1].terrainRgb = { r: 250, g: 10, b: 10 };
  leaves[2].terrainRgb = { r: 10, g: 250, b: 10 };
  leaves[3].terrainRgb = { r: 10, g: 10, b: 250 };
  const mesh = buildLiveSurface({ leaves, revision: 1, seed: 1, colourOf: (leaf) => leaf.terrainRgb, levelOf: () => 0 });
  assert.equal(mesh.buckets.length, 3, 'identical colours share a bucket');
  let cursor = 0;
  for (const bucket of mesh.buckets) {
    assert.equal(bucket.start, cursor, 'bucket starts where the previous run ended');
    cursor += bucket.count;
  }
  assert.equal(cursor, mesh.triangleCount);
  assert.equal(mesh.triangles.length, mesh.triangleCount * 9);
  assert.equal(mesh.buckets[0].count, 2, 'two leaves share the red bucket');
});

test('live mesh: a break adds the documented triangle delta for a fixed level', () => {
  const leaf = baseLeaves()[0];
  const children = splitLeaf(leaf);
  const parent = buildLiveSurface({ leaves: [leaf], revision: 1, seed: 1, colourOf: colour, levelOf: () => 2 });
  const broken = buildLiveSurface({ leaves: children, revision: 2, seed: 1, colourOf: colour, levelOf: () => 2 });
  const perLeaf = 4 ** 2;
  assert.equal(broken.triangleCount - parent.triangleCount, 4 * perLeaf - perLeaf);
  assert.equal(broken.triangleCount - parent.triangleCount, 3 * perLeaf);
});

test('live mesh: degenerate leaves are skipped and reported, never drawn', () => {
  const [leaf] = baseLeaves();
  const mesh = buildLiveSurface({
    leaves: [{ ...leaf, b: { ...leaf.a }, c: { ...leaf.a } }],
    revision: 1,
    seed: 1,
    colourOf: colour,
    levelOf: () => 1,
  });
  assert.equal(mesh.triangleCount, 0);
  assert.ok(mesh.skipped > 0, 'degenerate triangles counted');
  const mixed = buildLiveSurface({ leaves: [leaf, { ...leaf, b: { ...leaf.a }, c: { ...leaf.a } }], revision: 1, seed: 1, colourOf: colour, levelOf: () => 0 });
  assert.equal(mixed.triangleCount, 1);
  assert.equal(mixed.skipped, 1);
});

test('live mesh: the store skips unchanged revisions with zero rebuild work', () => {
  const store = new LiveSurfaceStore({ colourOf: colour });
  const leaves = baseLeaves();
  assert.equal(store.setInput({ leaves, revision: 3, seed: 5 }), true);
  assert.equal(store.prepare(0), true);
  const built = store.stats();
  assert.equal(built.triangleCount, undefined);
  assert.equal(built.revision, 3);
  assert.ok(built.triangles > 0);
  assert.equal(built.rebuilds, 1);
  assert.equal(store.setInput({ leaves, revision: 3, seed: 5 }), false, 'no-op snapshot');
  assert.equal(store.prepare(0), false, 'nothing to rebuild');
  const skipped = store.stats();
  assert.equal(skipped.skipped, 1);
  assert.equal(skipped.rebuilds, 1, 'no rebuild for an unchanged revision');
  assert.equal(skipped.hash, built.hash);
  assert.equal(store.setInput({ leaves, revision: 4, seed: 5 }), true, 'revision change queues a rebuild');
  assert.equal(store.setInput({ leaves, revision: 4, seed: 6 }), true, 'seed change queues a rebuild');
  store.prepare();
  assert.equal(store.stats().seed, 6);
  store.invalidate();
  assert.equal(store.setInput({ leaves, revision: 4, seed: 6 }), true, 'theme invalidation forces a rebuild');
});

test('live mesh: owner tint changes the bucket through the shared colour function', () => {
  const leaves = baseLeaves().slice(0, 1);
  const unowned = buildLiveSurface({
    leaves,
    revision: 1,
    seed: 1,
    colourOf: (leaf) => (leaf.ownerIndex >= 0 ? { r: 255, g: 0, b: 255 } : { r: 0, g: 255, b: 0 }),
    levelOf: () => 0,
  });
  const owned = buildLiveSurface({
    leaves: [{ ...leaves[0], ownerIndex: 0 }],
    revision: 2,
    seed: 1,
    colourOf: (leaf) => (leaf.ownerIndex >= 0 ? { r: 255, g: 0, b: 255 } : { r: 0, g: 255, b: 0 }),
    levelOf: () => 0,
  });
  assert.equal(unowned.buckets[0].fill, 'rgb(0,240,0)');
  assert.equal(owned.buckets[0].fill, 'rgb(240,0,240)');
});

test('live mesh: rebuild happens once per frame and coalesces a break storm', () => {
  const store = new LiveSurfaceStore({ colourOf: colour });
  const leaves = baseLeaves();
  store.setInput({ leaves, revision: 1, seed: 1 });
  store.setInput({ leaves, revision: 2, seed: 1 });
  store.setInput({ leaves, revision: 3, seed: 1 });
  assert.equal(store.prepare(), true);
  assert.equal(store.stats().revision, 3, 'last input wins');
  assert.equal(store.stats().rebuilds, 1);
  assert.equal(store.prepare(), false);
});
