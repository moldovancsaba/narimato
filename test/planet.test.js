import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIOMES,
  PLANET_VERSION,
  SEA_LEVEL,
  seedFrom,
  noise3,
  fbm,
  terrainAt,
  terrainColor,
  terrainSummary,
  weightedResourceForBiome,
  rollTerrainDeposit,
} from '../public/js/shared/planet.js';
import { RESOURCES, resourceById } from '../public/js/shared/resources.js';
import { latLonToVec, buildMesh } from '../public/js/shared/geometry.js';

const SEED = 0xa1b2c3d4;

function spherePoint(lat, lon) {
  return latLonToVec(lat, lon);
}

test('planet: deterministic low-data terrain from one seed', () => {
  assert.equal(seedFrom(SEED), seedFrom(SEED));
  assert.notEqual(seedFrom('MAGRATHEA'), seedFrom('TATOOINE'));
  assert.equal(PLANET_VERSION, 2);
  assert.ok(SEA_LEVEL > 0 && SEA_LEVEL < 0.3);

  const p = spherePoint(12.3, 47.1);
  const a = terrainAt(SEED, p);
  const b = terrainAt(SEED, p);
  assert.deepEqual(a, b, 'same seed+point must be identical (client/server parity)');
  assert.ok(a.elevation >= -1 && a.elevation <= 1);
  assert.ok(a.temperature >= 0 && a.temperature <= 1);
  assert.ok(a.moisture >= 0 && a.moisture <= 1);
  assert.ok(a.biome && BIOMES[a.biome.id]);
  assert.ok(Number.isInteger(a.seed));
  assert.ok(terrainColor(a).startsWith('#'));
  assert.equal(terrainSummary(a).mineable, a.biome.mineable);

  const other = terrainAt(0x12345678, p);
  assert.ok(
    Math.abs(other.elevation - a.elevation) > 1e-6 ||
      Math.abs(other.moisture - a.moisture) > 1e-6 ||
      other.biome.id !== a.biome.id,
    'different seed produces a different planet'
  );
});

test('planet: noise and fbm are bounded and deterministic', () => {
  for (const [x, y, z] of [[0, 0, 0], [1.2, -3.4, 5.6], [9.9, 2.2, -0.4]]) {
    const n = noise3(x, y, z, SEED);
    assert.ok(n >= 0 && n <= 1);
    assert.equal(n, noise3(x, y, z, SEED));
    const f = fbm(x, y, z, SEED);
    assert.ok(f >= 0 && f <= 1);
  }
});

test('planet: both poles are ice caps and oceans exist', () => {
  for (const seed of [SEED, 0x0, 0xdeadbeef, 0x11111111]) {
    const north = terrainAt(seed, spherePoint(90, 0));
    const south = terrainAt(seed, spherePoint(-90, 0));
    assert.equal(north.biome.id, 'ice', `north pole ice for seed ${seed}`);
    assert.equal(south.biome.id, 'ice', `south pole ice for seed ${seed}`);
  }
});

test('planet: biome distribution includes oceans, hills, mountains and ice', () => {
  const counts = new Map();
  let mineable = 0;
  const samples = 6000;
  for (let i = 0; i < samples; i += 1) {
    const y = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    const t = terrainAt(SEED, { x: r * Math.cos(a), y, z: r * Math.sin(a) });
    counts.set(t.biome.id, (counts.get(t.biome.id) || 0) + 1);
    if (t.biome.mineable) mineable += 1;
  }
  const pct = (id) => ((counts.get(id) || 0) / samples) * 100;
  assert.ok(pct('ocean') + pct('deep_ocean') > 10, 'meaningful oceans');
  assert.ok(pct('ice') > 2, 'ice caps');
  assert.ok(pct('hills') + pct('mountain') + pct('peak') > 8, 'relief');
  assert.ok(mineable / samples > 0.25, 'mineable land');
  assert.ok(counts.size >= 6, `biome variety (${counts.size})`);
});

test('planet: resource geology is biome-weighted; oceans cannot be surface-mined', () => {
  const ocean = terrainAt(SEED, spherePoint(30, 0));
  // Find an actual ocean sample if that latitude is land for this seed.
  let sea = null;
  for (let lat = -80; lat <= 80 && !sea; lat += 5) {
    for (let lon = 0; lon < 360 && !sea; lon += 15) {
      const t = terrainAt(SEED, spherePoint(lat, lon));
      if (!t.biome.mineable) sea = t;
    }
  }
  assert.ok(sea, 'found an ocean/deep-ocean cell');
  assert.equal(sea.biome.mineable, false);
  assert.equal(rollTerrainDeposit(sea, () => 0), null, 'never a surface deposit underwater');
  assert.equal(weightedResourceForBiome(sea.biome, () => 0), null);

  let land = null;
  for (let lat = -80; lat <= 80 && !land; lat += 5) {
    for (let lon = 0; lon < 360 && !land; lon += 15) {
      const t = terrainAt(SEED, spherePoint(lat, lon));
      if (t.biome.mineable) land = t;
    }
  }
  assert.ok(land, 'found mineable land');
  assert.ok(RESOURCES.some((r) => r.id === weightedResourceForBiome(land.biome, () => 0.5)));
  if (land.biome.depositChance > 0) {
    const id = rollTerrainDeposit(land, () => 0);
    assert.ok(resourceById(id), `terrain deposit is a catalog resource (${id})`);
    assert.equal(rollTerrainDeposit(land, () => 0.999999), null, 'chance miss possible');
  }
  assert.ok(ocean && ocean.biome);
});

test('planet: terrain is stable across the actual icosphere mesh', () => {
  const mesh = buildMesh(2);
  for (const face of mesh.faces.slice(0, 50)) {
    const t = terrainAt(SEED, face.centroid);
    assert.ok(t.biome);
    assert.deepEqual(t, terrainAt(SEED, face.centroid));
  }
});
