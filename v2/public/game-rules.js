/** NARIMATO v2 — authoritative triangle/actor/planet rules (see docs/TRIANGLE_RULES.md). */
import { baseIcosahedron } from './geometry.js';

export const TRIANGLE_LEVELS = 4;
export const PLAYER_TARGET = 30;
export const ROBOT_TARGET = 30;
export const ROBOT_COUNT = 4;
export const PLANET_COUNT = 3;

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const vkey = (v) => `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;

function makePlanet(index) {
  const base = baseIcosahedron();
  const planet = {
    index,
    vertices: base.vertices.map((v) => ({ ...v })),
    vertexKeys: new Map(),
    leaves: [],
    nextLeafId: 0,
  };
  base.vertices.forEach((v) => planet.vertexKeys.set(vkey(v), true));
  planet.leaves = base.faces.map((face) => newLeaf(planet, 1, face));
  return planet;
}

function newLeaf(planet, level, v) {
  const leaf = { id: planet.nextLeafId++, level, v: [...v], clickedBy: [], globallyRed: false };
  planet.leaves.push(leaf);
  return leaf;
}

function addVertex(planet, v) {
  const n = norm(v);
  const key = vkey(n);
  if (planet.vertexKeys.has(key)) {
    const i = planet.vertices.findIndex((x) => vkey(x) === key);
    if (i >= 0) return i;
  }
  planet.vertexKeys.set(key, true);
  planet.vertices.push(n);
  return planet.vertices.length - 1;
}

function midpoint(planet, ai, bi) {
  const a = planet.vertices[ai], b = planet.vertices[bi];
  return addVertex(planet, { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
}

function splitLeaf(planet, leaf) {
  const [a, b, c] = leaf.v;
  const ab = midpoint(planet, a, b);
  const bc = midpoint(planet, b, c);
  const ca = midpoint(planet, c, a);
  planet.leaves = planet.leaves.filter((x) => x.id !== leaf.id);
  const next = leaf.level + 1;
  newLeaf(planet, next, [a, ab, ca]);
  newLeaf(planet, next, [ab, b, bc]);
  newLeaf(planet, next, [ca, bc, c]);
  newLeaf(planet, next, [ab, bc, ca]);
}

export function createGame(seed = 20261126) {
  const game = { seed, player: { planet: 0, count: 0, target: PLAYER_TARGET }, robots: [], planets: [], robotSeq: 0 };
  game.planets[0] = makePlanet(0);
  game.robots = makeRobots(game);
  return game;
}

function makeRobots(game) {
  return Array.from({ length: ROBOT_COUNT }, (_, slot) => {
    game.robotSeq += 1;
    return { id: `robot-${game.robotSeq}`, slot, count: 0, target: ROBOT_TARGET, respawns: 0 };
  });
}

function currentPlanet(game) { return game.planets[game.player.planet]; }

function resetLeaves(planet) {
  const fresh = makePlanet(planet.index);
  planet.vertices = fresh.vertices;
  planet.vertexKeys = fresh.vertexKeys;
  planet.leaves = fresh.leaves;
  planet.nextLeafId = fresh.nextLeafId;
}

export function canReset(planet) {
  return planet.leaves.length > 0 && planet.leaves.every((l) => l.level === TRIANGLE_LEVELS && l.globallyRed);
}

function maybeReset(planet) {
  if (!canReset(planet)) return false;
  resetLeaves(planet);
  return true;
}

/**
 * One click by any actor. Returns {ok, error?, split?, reset?, removed?, leaf}.
 * The caller is responsible for actor-specific counts.
 */
export function resetIfComplete(game) {
  return maybeReset(currentPlanet(game));
}

export function clickTriangle(game, actorId, triangleId) {
  const planet = currentPlanet(game);
  const leaf = planet.leaves.find((l) => l.id === Number(triangleId));
  if (!leaf) return { ok: false, error: 'triangle-unavailable' };
  if (leaf.globallyRed) return { ok: false, error: 'triangle-red-for-all' };
  if (leaf.clickedBy.includes(actorId)) return { ok: false, error: 'already-clicked-by-actor' };
  leaf.clickedBy.push(actorId);
  let split = false;
  if (leaf.clickedBy.length >= 2) {
    if (leaf.level < TRIANGLE_LEVELS) {
      splitLeaf(planet, leaf);
      split = true;
    } else {
      leaf.globallyRed = true;
    }
  }
  const reset = maybeReset(planet);
  return { ok: true, leafId: leaf.id, level: leaf.level, split, globallyRed: leaf.globallyRed, reset };
}

export function collectPlayer(game, triangleId) {
  if (game.player.count >= PLAYER_TARGET) return { ok: false, error: 'already-complete' };
  const res = clickTriangle(game, 'player', triangleId);
  if (!res.ok) return { ...res, state: publicState(game) };
  game.player.count += 1;
  let cleared = false;
  if (game.player.count >= PLAYER_TARGET) {
    leavePlanet(game);
    cleared = true;
  }
  return { ...res, collected: game.player.count, cleared, state: publicState(game) };
}

function leavePlanet(game) {
  const target = (game.player.planet + 1) % PLANET_COUNT;
  game.planets[target] = makePlanet(target);
  game.player.planet = target;
  game.player.count = 0;
  game.robots = makeRobots(game);
}

/** Server tick: each robot clicks once; on 30 it respawns on the same planet. */
export function tickRobots(game) {
  const planet = currentPlanet(game);
  let reset = false;
  for (let slot = 0; slot < game.robots.length; slot += 1) {
    let robot = game.robots[slot];
    if (robot.count >= ROBOT_TARGET) {
      const respawns = robot.respawns + 1;
      game.robotSeq += 1;
      robot = { id: `robot-${game.robotSeq}`, slot, count: 0, target: ROBOT_TARGET, respawns };
      game.robots[slot] = robot;
    }
    const eligible = planet.leaves.filter((l) => !l.globallyRed && !l.clickedBy.includes(robot.id));
    if (!eligible.length) continue;
    const leaf = eligible[Math.floor(Math.random() * eligible.length)];
    const res = clickTriangle(game, robot.id, leaf.id);
    if (res.ok) {
      robot.count += 1;
      if (res.reset) reset = true;
    }
  }
  return { reset, state: publicState(game) };
}

export function publicState(game) {
  const planet = currentPlanet(game);
  return {
    seed: game.seed,
    planetIndex: game.player.planet + 1,
    planetCount: PLANET_COUNT,
    player: { count: game.player.count, target: PLAYER_TARGET, actor: 'player' },
    robots: game.robots.map((r) => ({ id: r.id, count: r.count, target: r.target, respawns: r.respawns })),
    vertices: planet.vertices,
    leaves: planet.leaves.map((l) => ({ id: l.id, level: l.level, v: l.v, clickedBy: l.clickedBy, globallyRed: l.globallyRed })),
  };
}
