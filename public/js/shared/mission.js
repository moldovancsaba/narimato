/**
 * NARIMATO — escape mission.
 *
 * The pilot is stranded in ICOSA-9's gravity well: fuel and thrusters are
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

export function planetName(index) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  return `ICOSA-${9 + i}`;
}

export const ESCAPE_MISSION = Object.freeze({
  id: 'escape',
  name: 'ESCAPE PROTOCOL',
  tagline: 'FUEL EMPTY // GRAVITY CAPTURE',
  briefing:
    'The wormhole dropped you into ICOSA-9\'s gravity well with empty tanks. Mine the required ores to rebuild the drive and break orbit.',
  objectives: Object.freeze([
    Object.freeze({
      id: 'fuel',
      name: 'FUEL RODS',
      hint: 'Reactor fuel for the burn that breaks gravity.',
      items: Object.freeze([{ resourceId: 'uranium', need: 3 }]),
    }),
    Object.freeze({
      id: 'hull',
      name: 'HULL PLATES',
      hint: 'Patch the wormhole damage before atmospheric entry.',
      items: Object.freeze([
        { resourceId: 'silver', need: 5 },
        { resourceId: 'gold', need: 2 },
      ]),
    }),
    Object.freeze({
      id: 'warp',
      name: 'WARP CORE',
      hint: 'Palladium lattice to re-open a controlled wormhole.',
      items: Object.freeze([{ resourceId: 'palladium', need: 1 }]),
    }),
  ]),
});

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

/**
 * Deeper planets demand a bigger refit. Planet 0 is the current opening
 * mission; each escape adds fuel/hull/warp requirements so progression is
 * always meaningful.
 */
export function missionForPlanet(index) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  if (i === 0) return ESCAPE_MISSION;
  const fuel = 3 + i * 2;
  const silver = 5 + i * 3;
  const gold = 2 + i;
  const palladium = 1 + i;
  return Object.freeze({
    id: `escape-${i}`,
    name: i === 1 ? 'DEEP-SPACE REFIT' : `DEEP-SPACE REFIT ${i + 1}`,
    tagline: i === 1 ? 'HULL DAMAGED // EMERGENCY LANDING' : 'STORM DAMAGE // REBUILD AGAIN',
    briefing:
      'The space storm wrecked your drive. This planet is deeper and richer, but you need a bigger refit to leave.',
    objectives: Object.freeze([
      Object.freeze({
        id: 'fuel',
        name: 'FUEL RODS',
        hint: 'A longer burn is needed out of this gravity well.',
        items: Object.freeze([{ resourceId: 'uranium', need: fuel }]),
      }),
      Object.freeze({
        id: 'hull',
        name: 'HULL PLATES',
        hint: 'Repair the storm damage before the next launch.',
        items: Object.freeze([
          { resourceId: 'silver', need: silver },
          { resourceId: 'gold', need: gold },
        ]),
      }),
      Object.freeze({
        id: 'warp',
        name: 'WARP CORE',
        hint: 'A stronger palladium lattice for the next jump.',
        items: Object.freeze([{ resourceId: 'palladium', need: palladium }]),
      }),
    ]),
  });
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
