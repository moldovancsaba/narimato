/**
 * NARIMATO — escape mission.
 *
 * The pilot is stranded in the first world's gravity well: fuel and thrusters are
 * empty. Mining the listed ores rebuilds the drive. Progress is derived from a
 * pilot's persistent per-resource inventory (`oreCounts` from the server), so
 * it survives reloads. No gameplay is blocked while incomplete — the mission is
 * the story objective layered over the arcade.
 */

import { resourceById } from './resources.js';

/** Planet progression: first planet is 2 levels deep, next one 3, etc. (capped for playability). */
export const START_PLANET_INDEX = 0;
export const MAX_PLANET_DEPTH = 8;

export function planetDepth(index) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  return Math.min(2 + i, MAX_PLANET_DEPTH);
}

/** Cultural planet-name catalog: each world references a different universe. */
export const PLANET_CATALOG = Object.freeze([
  { name: 'MAGRATHEA', source: "HITCHHIKER'S GUIDE" },
  { name: 'TATOOINE', source: 'STAR WARS' },
  { name: 'ASGARD', source: 'MARVEL' },
  { name: 'KRYPTON', source: 'DC' },
  { name: 'ARRAKIS', source: 'DUNE' },
  { name: 'VOGSPHERE', source: "HITCHHIKER'S GUIDE" },
  { name: 'CORUSCANT', source: 'STAR WARS' },
  { name: 'XANDAR', source: 'MARVEL' },
  { name: 'OA', source: 'DC' },
  { name: 'CALADAN', source: 'DUNE' },
  { name: 'BETELGEUSE FIVE', source: "HITCHHIKER'S GUIDE" },
  { name: 'HOTH', source: 'STAR WARS' },
  { name: 'VORMIR', source: 'MARVEL' },
  { name: 'APOKOLIPS', source: 'DC' },
  { name: 'GALLIFREY', source: 'DOCTOR WHO' },
  { name: 'DAGOBAH', source: 'STAR WARS' },
  { name: 'SAKAAR', source: 'MARVEL' },
  { name: 'MOGO', source: 'DC' },
  { name: 'TRANTOR', source: 'FOUNDATION' },
  { name: 'KRIKKIT', source: "HITCHHIKER'S GUIDE" },
  { name: 'NABOO', source: 'STAR WARS' },
  { name: 'KNOWHERE', source: 'MARVEL' },
  { name: 'THANAGAR', source: 'DC' },
  { name: 'SOLARIS', source: 'SOLARIS' },
  { name: 'DAMOGRAN', source: "HITCHHIKER'S GUIDE" },
  { name: 'MUSTAFAR', source: 'STAR WARS' },
  { name: 'NIDAVELLIR', source: 'MARVEL' },
  { name: 'RANN', source: 'DC' },
  { name: 'PANDORA', source: 'AVATAR' },
  { name: 'GOLGAFRINCHAM', source: "HITCHHIKER'S GUIDE" },
  { name: 'BESPIN', source: 'STAR WARS' },
  { name: 'TITAN', source: 'MARVEL' },
  { name: 'COLU', source: 'DC' },
  { name: 'LV-426', source: 'ALIEN' },
  { name: 'URSA MINOR BETA', source: "HITCHHIKER'S GUIDE" },
  { name: 'ENDOR', source: 'STAR WARS' },
  { name: 'EGO', source: 'MARVEL' },
  { name: 'DAXAM', source: 'DC' },
  { name: 'CYBERTRON', source: 'TRANSFORMERS' },
  { name: 'ALDERAAN', source: 'STAR WARS' },
  { name: 'CONTRAXIA', source: 'MARVEL' },
  { name: 'CZARNIA', source: 'DC' },
  { name: 'VULCAN', source: 'STAR TREK' },
  { name: 'KAMINO', source: 'STAR WARS' },
  { name: 'MORAG', source: 'MARVEL' },
  { name: 'NEW GENESIS', source: 'DC' },
  { name: 'ROMULUS', source: 'STAR TREK' },
  { name: 'YAVIN 4', source: 'STAR WARS' },
  { name: 'QO\'NOS', source: 'STAR TREK' },
  { name: 'GEONOSIS', source: 'STAR WARS' },
  { name: 'KREE-LAR', source: 'MARVEL' },
  { name: 'BAJOR', source: 'STAR TREK' },
  { name: 'CARDASSIA', source: 'STAR TREK' },
  { name: 'KASHYYYK', source: 'STAR WARS' },
  { name: 'MON CALA', source: 'STAR WARS' },
  { name: 'SKARO', source: 'DOCTOR WHO' },
  { name: 'ETERNIA', source: 'MASTERS OF THE UNIVERSE' },
  { name: 'ALTAIR IV', source: 'FORBIDDEN PLANET' },
  { name: 'GIDEI PRIME', source: 'DUNE' },
  { name: 'TERMINUS', source: 'FOUNDATION' },
  { name: 'GETHSEMANI', source: 'DUNE' },
  { name: 'POLYPHEMUS', source: 'AVATAR' },
  { name: 'MIDGARD', source: 'NORSE MYTH' },
  { name: 'OLYMPUS', source: 'GREEK MYTH' },
  { name: 'SHANGRI-LA', source: 'LOST HORIZON' },
  { name: 'ZION', source: 'THE MATRIX' },
  { name: 'MARS', source: 'OUR SOLAR SYSTEM' },
  { name: 'EUROPA', source: 'OUR SOLAR SYSTEM' },
]);

function catalogEntry(index) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  const entry = PLANET_CATALOG[i % PLANET_CATALOG.length];
  const cycle = Math.floor(i / PLANET_CATALOG.length);
  return {
    name: cycle > 0 ? `${entry.name} ${cycle + 1}` : entry.name,
    source: entry.source,
  };
}

export function planetName(index) {
  return catalogEntry(index).name;
}

export function planetSource(index) {
  return catalogEntry(index).source;
}

/** Deterministic per-planet/per-seed mission RNG (mulberry32 over a mixed seed). */
function missionSeed(planetSeed, index, salt = 0) {
  let h = (Number(planetSeed) >>> 0) ^ Math.imul((Number(index) || 0) + 1, 0x9e3779b1) ^ salt;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Category pools: each objective draws its materials from exactly one pool. */
export const MISSION_POOLS = Object.freeze({
  fuel: Object.freeze(['uranium', 'aetherium', 'neutronium']),
  hull: Object.freeze(['silver', 'gold', 'iridium', 'adamantium']),
  warp: Object.freeze(['palladium', 'myrthil', 'voidglass']),
});

/** Materials rare enough that every refit should demand at least one. */
export const RARE_RESOURCES = Object.freeze([
  'iridium',
  'voidglass',
  'myrthil',
  'aetherium',
  'adamantium',
  'neutronium',
]);

const RARE_SET = new Set(RARE_RESOURCES);

/** True when a resource id is one of the rare mission materials. */
export function isRareResource(resourceId) {
  return RARE_SET.has(String(resourceId));
}

const MISSION_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'fuel',
    name: 'FUEL RODS',
    hint: 'The burn that gets us off this rock.',
    pool: MISSION_POOLS.fuel,
  }),
  Object.freeze({
    id: 'hull',
    name: 'HULL PLATES',
    hint: 'Patch the wounds before we fly again.',
    pool: MISSION_POOLS.hull,
  }),
  Object.freeze({
    id: 'warp',
    name: 'WARP CORE',
    hint: 'A rare lattice to bend space one more time.',
    pool: MISSION_POOLS.warp,
  }),
]);

const INITIAL_MISSION_UNITS = 3;
const MAX_EXTRA_UNITS_PER_PLANET = 3;

/**
 * Cumulative unit total for a planet: 3 at planet 0, then +0..3 random units
 * for every deeper planet on the way (deterministic from the planet seed).
 */
export function missionUnitTotal(index, planetSeed = 0) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  let total = INITIAL_MISSION_UNITS;
  for (let step = 1; step <= i; step += 1) {
    const rng = makeRng(missionSeed(planetSeed, step, 0x51ed2701));
    total += Math.floor(rng() * (MAX_EXTRA_UNITS_PER_PLANET + 1));
  }
  return total;
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function missionBriefing(index) {
  if (index === 0) {
    return `The wormhole dropped us into ${planetName(0)}'s gravity well with empty tanks. The ship is hurt. Find what she needs in the crust, and we'll try for home.`;
  }
  return `The jump left ${planetName(index)}'s surface scarred and your drive half-dead. Mine the local ores to refit and break orbit again.`;
}

/**
 * Deterministically generated procedural mission for a planet.
 *
 * - Planet 0 always needs exactly 3 units: one material (need 1) in each of
 *   FUEL RODS / HULL PLATES / WARP CORE.
 * - Every deeper planet adds a cumulative random 0..3 units to the total.
 * - Materials are seed-random picks from the category pools (no duplicates in
 *   one mission); spare units become extra units and sometimes extra resource
 *   types, so every planet's refit feels different.
 */
export function missionForPlanet(index, planetSeed = 0) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  const seed = Number.isFinite(planetSeed) ? planetSeed >>> 0 : 0;
  const total = missionUnitTotal(i, seed);
  const rng = makeRng(missionSeed(seed, i, 0x9e3779b1));

  const used = new Set();
  const objectives = MISSION_CATEGORIES.map((category) => {
    let choices = category.pool.filter((id) => !used.has(id));
    if (i === 0) {
      // Planet 0 is the minimal tutorial refit: exactly 3 units with exactly
      // one rare material, always the WARP CORE.
      const rareOnly = category.id === 'warp';
      choices = choices.filter((id) => isRareResource(id) === rareOnly);
      if (!choices.length) choices = category.pool.filter((id) => isRareResource(id) === rareOnly && !used.has(id));
    }
    const resourceId = choices.length ? choices[Math.floor(rng() * choices.length)] : category.pool[0];
    used.add(resourceId);
    return {
      id: category.id,
      name: category.name,
      hint: category.hint,
      items: [{ resourceId, need: 1 }],
    };
  });

  let remaining = Math.max(0, total - INITIAL_MISSION_UNITS);
  let guard = 0;
  while (remaining > 0 && guard < 10_000) {
    guard += 1;
    const objectiveIndex = Math.floor(rng() * objectives.length);
    const objective = objectives[objectiveIndex];
    const category = MISSION_CATEGORIES[objectiveIndex];
    const extraChoices = category.pool.filter((id) => !used.has(id));
    // Sometimes add a whole new resource type, otherwise charge an existing one.
    const addType = extraChoices.length > 0 && rng() < 0.35;
    if (addType) {
      const resourceId = extraChoices[Math.floor(rng() * extraChoices.length)];
      used.add(resourceId);
      objective.items.push({ resourceId, need: 1 });
    } else {
      const item = objective.items[Math.floor(rng() * objective.items.length)];
      item.need += 1;
    }
    remaining -= 1;
  }

  // Guarantee at least one rare material per refit. Prefer the WARP CORE
  // objective (planet 0 already guarantees exactly one via the restricted picks
  // above, so this only kicks in for deeper planets whose seed rolled no rares).
  const allItems = objectives.flatMap((objective) => objective.items);
  if (!allItems.some((item) => isRareResource(item.resourceId))) {
    const warp = objectives.find((objective) => objective.id === 'warp');
    const warpPool = MISSION_POOLS.warp;
    const rareChoices = warpPool.filter((id) => !used.has(id));
    if (warp && rareChoices.length) {
      const replacement = rareChoices[Math.floor(rng() * rareChoices.length)];
      const target = warp.items.find((item) => !isRareResource(item.resourceId)) || warp.items[0];
      used.delete(target.resourceId);
      target.resourceId = replacement;
      used.add(replacement);
    }
  }

  const mission = {
    id: i === 0 ? 'escape' : `escape-${i}`,
    planetIndex: i,
    name: i === 0 ? 'THE WAY BACK' : `THE NEXT BURN ${i + 1}`,
    tagline: i === 0 ? 'FUEL EMPTY // GRAVITY HAS US' : 'WOUNDED AGAIN // WE GO ON',
    briefing: missionBriefing(i),
    objectives,
  };
  return deepFreeze(mission);
}

/**
 * Frozen compatibility example: planet 0's mission at the default seed 0.
 * Prefer missionForPlanet(index, planetSeed) everywhere (server derives from
 * the core's persisted planetSeed; the client from `state.planetSeed`).
 */
export const ESCAPE_MISSION = missionForPlanet(0, 0);

const RESOURCE_IDS = new Set(['silver', 'gold', 'uranium', 'palladium', 'iridium', 'voidglass', 'myrthil', 'aetherium', 'adamantium', 'neutronium']);

/** Keep only known resource ids with finite non-negative integer counts. */
export function sanitizeOreCounts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!RESOURCE_IDS.has(id)) continue;
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    if (count > 0) out[id] = count;
  }
  return out;
}

/**
 * Derive mission progress from a pilot's ore inventory.
 * @returns {{id, name, ready, have, need, ratio, objectives:Array}}
 */
export function missionProgress(oreCounts, mission = ESCAPE_MISSION) {
  const counts = sanitizeOreCounts(oreCounts);
  let have = 0;
  let need = 0;
  const objectives = mission.objectives.map((objective) => {
    const items = objective.items.map((item) => {
      const resource = resourceById(item.resourceId);
      const owned = counts[item.resourceId] || 0;
      have += Math.min(owned, item.need);
      need += item.need;
      return {
        resourceId: item.resourceId,
        name: resource ? resource.name : item.resourceId.toUpperCase(),
        glyph: resource ? resource.glyph : '?',
        color: resource ? resource.color : '#c9d6e5',
        value: resource ? resource.value : 0,
        need: item.need,
        have: owned,
        done: owned >= item.need,
      };
    });
    return {
      id: objective.id,
      name: objective.name,
      hint: objective.hint,
      items,
      done: items.every((item) => item.done),
      progress: items.reduce((sum, item) => sum + Math.min(item.have, item.need), 0) /
        Math.max(1, items.reduce((sum, item) => sum + item.need, 0)),
    };
  });
  return {
    id: mission.id,
    name: mission.name,
    planetIndex: mission.planetIndex,
    ready: objectives.every((objective) => objective.done),
    have,
    need,
    ratio: need ? have / need : 0,
    objectives,
  };
}

/** Flat resource requirement list for compact briefings/tooltips. */
export function missionOreList(mission = ESCAPE_MISSION) {
  const seen = new Set();
  const out = [];
  for (const objective of mission.objectives) {
    for (const item of objective.items) {
      if (seen.has(item.resourceId)) continue;
      seen.add(item.resourceId);
      const resource = resourceById(item.resourceId);
      out.push({
        resourceId: item.resourceId,
        name: resource ? resource.name : item.resourceId.toUpperCase(),
        glyph: resource ? resource.glyph : '?',
        color: resource ? resource.color : '#c9d6e5',
        need: mission.objectives
          .flatMap((entry) => entry.items)
          .filter((entry) => entry.resourceId === item.resourceId)
          .reduce((sum, entry) => sum + entry.need, 0),
      });
    }
  }
  return out;
}
