/**
 * NARIMATO — low-data procedural planet surface.
 *
 * RESEARCH / DESIGN
 * -----------------
 * A whole planet must not ship as textures or heightmaps. We store ONE 32-bit
 * seed and derive everything from seeded 3D value noise sampled at the unit
 * direction of each triangle. Because the noise domain is the 3D ball (not an
 * equirectangular image), there are no seams or pole pinching; the same
 * function runs identically in the browser and on the Node server.
 *
 *   p  = unit direction of a cell centroid
 *   q  = p domain-warped by low-frequency noise (avoids blobby noise look)
 *   elevation = fBm(q) centred around sea level + ridged noise for mountains
 *   latitude  = asin(p.y)
 *   temperature = equator-to-pole gradient, lapse rate with elevation, + noise
 *   moisture  = second fBm
 *   biome     = lookup over (elevation, temperature, moisture)
 *
 * This is the same "sphere SDF + Perlin/noise, sampled by an icosphere" approach
 * used by procedural planet renderers, plus the biome/climate split used by
 * world generators (see PLANET_RESEARCH.md for sources). Cost is ~10 noise
 * evaluations per triangle, cached by cell label on the client, and zero
 * texture/asset bandwidth: seed only.
 *
 * Resources are placed by geology: orogenic/hydrothermal ores follow mountains
 * and ridges, placers follow coasts, evaporites/voidglass follow deserts, etc.
 * Deep ocean / ocean surface cells have NO mineable surface deposits (they may
 * be under kilometres of water), so they cannot be mined from the top layer.
 */

export const SEA_LEVEL = 0.1;
export const PLANET_VERSION = 2;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** FNV-1a style seed normalizer: numeric or string seed -> uint32. */
export function seedFrom(value) {
  if (Number.isFinite(value)) return Number(value) >>> 0;
  const text = String(value == null ? '' : value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hash3(seed, ix, iy, iz) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (ix | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (iy | 0), 0x165667b1);
  h = Math.imul(h ^ (iz | 0), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Seeded trilinear 3D value noise in [0,1]. */
export function noise3(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const tz = smooth(z - zi);
  const c000 = hash3(seed, xi, yi, zi);
  const c100 = hash3(seed, xi + 1, yi, zi);
  const c010 = hash3(seed, xi, yi + 1, zi);
  const c110 = hash3(seed, xi + 1, yi + 1, zi);
  const c001 = hash3(seed, xi, yi, zi + 1);
  const c101 = hash3(seed, xi + 1, yi, zi + 1);
  const c011 = hash3(seed, xi, yi + 1, zi + 1);
  const c111 = hash3(seed, xi + 1, yi + 1, zi + 1);
  const x00 = lerp(c000, c100, tx);
  const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx);
  const x11 = lerp(c011, c111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

/** Fractal Brownian motion over 3D value noise, normalized to [0,1]. */
export function fbm(x, y, z, seed, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * noise3(x * freq + 17.1 * o, y * freq - 9.7 * o, z * freq + 4.3 * o, seed);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

const latOf = (p) => Math.asin(Math.max(-1, Math.min(1, p.y)));

/** Biomes: colour, geology and surface-mineable resource weighting. */
export const BIOMES = Object.freeze({
  deep_ocean: {
    id: 'deep_ocean', name: 'DEEP OCEAN', color: '#061a33', mineable: false, depositChance: 0, weights: {},
  },
  ocean: {
    id: 'ocean', name: 'OCEAN', color: '#0a3552', mineable: false, depositChance: 0, weights: {},
  },
  coast: {
    id: 'coast', name: 'COAST', color: '#126b70', mineable: true, depositChance: 0.18,
    weights: { gold: 3, silver: 4, palladium: 1 },
  },
  plains: {
    id: 'plains', name: 'PLAINS', color: '#2b6b4b', mineable: true, depositChance: 0.25,
    weights: { silver: 4, gold: 2, uranium: 2, voidglass: 1 },
  },
  forest: {
    id: 'forest', name: 'FOREST', color: '#1c533f', mineable: true, depositChance: 0.2,
    weights: { silver: 3, uranium: 2, voidglass: 1 },
  },
  desert: {
    id: 'desert', name: 'DESERT', color: '#8b7138', mineable: true, depositChance: 0.24,
    weights: { gold: 4, voidglass: 2, aetherium: 1, silver: 2 },
  },
  hills: {
    id: 'hills', name: 'HILLS', color: '#59634f', mineable: true, depositChance: 0.36,
    weights: { gold: 3, silver: 3, uranium: 2, palladium: 2, iridium: 1 },
  },
  mountain: {
    id: 'mountain', name: 'MOUNTAIN', color: '#6b6a68', mineable: true, depositChance: 0.44,
    weights: { gold: 3, silver: 2, palladium: 2, iridium: 2, myrthil: 1, adamantium: 1, uranium: 1 },
  },
  peak: {
    id: 'peak', name: 'PEAK', color: '#a6b6c8', mineable: true, depositChance: 0.5,
    weights: { iridium: 3, myrthil: 2, aetherium: 1, adamantium: 1, neutronium: 0.3 },
  },
  ice: {
    id: 'ice', name: 'ICE CAP', color: '#c9e7f5', mineable: true, depositChance: 0.16,
    weights: { iridium: 2, aetherium: 2, neutronium: 0.4, silver: 1 },
  },
});

/**
 * Deterministic terrain sample for a unit direction.
 * @returns {{seed:number,elevation:number,temperature:number,moisture:number,
 *            latitude:number,longitude:number,biome:object}}
 */
export function terrainAt(seedValue, point) {
  const seed = seedFrom(seedValue);
  const p = { x: point.x, y: point.y, z: point.z };
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    return { seed, elevation: 0, temperature: 0.5, moisture: 0.5, latitude: 0, longitude: 0, biome: BIOMES.ocean };
  }
  // Domain warp gives continents irregular, non-blobby outlines.
  const wx = p.x + 0.42 * (noise3(p.x * 1.6 + 11.3, p.y * 1.6 + 5.1, p.z * 1.6 - 7.7, seed ^ 0x9e3779b1) - 0.5);
  const wy = p.y + 0.42 * (noise3(p.x * 1.6 - 3.9, p.y * 1.6 + 21.7, p.z * 1.6 + 2.2, seed ^ 0x85ebca6b) - 0.5);
  const wz = p.z + 0.42 * (noise3(p.x * 1.6 + 7.5, p.y * 1.6 - 12.4, p.z * 1.6 + 9.9, seed ^ 0xc2b2ae35) - 0.5);

  const continent = fbm(wx * 1.75 + 31.7, wy * 1.75 - 12.3, wz * 1.75 + 5.9, seed, 5);
  const ridge = 1 - Math.abs(2 * fbm(wx * 3.4 - 8.1, wy * 3.4 + 17.2, wz * 3.4 - 4.6, seed ^ 0x27d4eb2d, 4) - 1);
  let elevation = (continent - 0.5) * 1.9 + (ridge - 0.55) * 0.6;
  elevation = Math.max(-1, Math.min(1, elevation));

  const lat = latOf(p);
  const latitude = lat * (180 / Math.PI);
  const longitude = Math.atan2(p.z, p.x) * (180 / Math.PI);
  const tempNoise = (noise3(p.x * 2.3 + 3.1, p.y * 2.3 - 8.4, p.z * 2.3 + 6.7, seed ^ 0x165667b1) - 0.5) * 0.1;
  let temperature = 1 - Math.abs(lat) / (Math.PI / 2) * 1.12;
  temperature -= Math.max(0, elevation) * 0.55;
  temperature = clamp01(temperature + tempNoise);

  const moistNoise = fbm(wx * 2.2 + 14.4, wy * 2.2 - 3.3, wz * 2.2 + 8.8, seed ^ 0x9e3779b9, 4);
  let moisture = clamp01(moistNoise * 1.15 - Math.max(0, elevation) * 0.18 + 0.05);

  let biome;
  // Polar ice shelving can sit on shallow water; deep ocean stays ocean.
  if (temperature < 0.17 && elevation > -0.32) biome = BIOMES.ice;
  else if (elevation < -0.16) biome = BIOMES.deep_ocean;
  else if (elevation < SEA_LEVEL) biome = BIOMES.ocean;
  else if (elevation < SEA_LEVEL + 0.045) biome = BIOMES.coast;
  else if (elevation > 0.6) biome = BIOMES.peak;
  else if (elevation > 0.36) biome = BIOMES.mountain;
  else if (elevation > 0.2) biome = BIOMES.hills;
  else if (moisture < 0.42 && temperature > 0.46) biome = BIOMES.desert;
  else if (moisture > 0.58) biome = BIOMES.forest;
  else biome = BIOMES.plains;

  return { seed, elevation, temperature, moisture, latitude, longitude, biome };
}

/** Terrain colour with a little elevation/temperature shading for the renderer. */
export function terrainColor(terrain) {
  if (!terrain || !terrain.biome) return '#2b6b4b';
  const base = terrain.biome.color;
  return base;
}

/** Weighted resource choice from a biome's geology. */
export function weightedResourceForBiome(biome, random = Math.random) {
  if (!biome || !biome.mineable) return null;
  const ids = Object.keys(biome.weights);
  if (!ids.length) return null;
  let total = 0;
  for (const id of ids) total += biome.weights[id];
  let r = clamp01(Number(random())) * total;
  for (const id of ids) {
    r -= biome.weights[id];
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

/**
 * Roll a hidden surface deposit for a cell according to its geology.
 * Deep ocean/ocean cells return null (their resources are too deep to mine
 * from the top layer). `random` must return [0,1); used twice (chance + type).
 */
export function rollTerrainDeposit(terrain, random = Math.random) {
  if (!terrain || !terrain.biome || !terrain.biome.mineable) return null;
  if (clamp01(Number(random())) >= terrain.biome.depositChance) return null;
  const id = weightedResourceForBiome(terrain.biome, random);
  return id || null;
}

/** Human-readable geoscience hint used by the UI. */
export function terrainSummary(terrain) {
  if (!terrain || !terrain.biome) return null;
  return {
    biome: terrain.biome.id,
    name: terrain.biome.name,
    color: terrain.biome.color,
    elevation: terrain.elevation,
    temperature: terrain.temperature,
    moisture: terrain.moisture,
    mineable: terrain.biome.mineable,
    depositChance: terrain.biome.depositChance,
  };
}
