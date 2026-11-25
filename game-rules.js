/** NARIMATO v2 — server-authoritative simple game state. */

export const TRIANGLE_COUNT = 80; // one-subdivision icosahedron surface faces
export const BREAK_LEVELS = 3;
export const PLAYER_TARGET = 30; // 10 triangles x 3 breaking levels
export const ROBOT_COUNT = 4;
export const ROBOT_TARGET = 5;

const clone = (v) => JSON.parse(JSON.stringify(v));

export function createGame(seed = 20261123) {
  const game = { seed, planetIndex: 1, triangles: [], player: { collected: 0, target: PLAYER_TARGET }, robots: [], robotSeq: 0 };
  resetPlanet(game);
  return game;
}

function resetPlanet(game) {
  game.triangles = Array.from({ length: TRIANGLE_COUNT }, (_, id) => ({ id, level: BREAK_LEVELS, mined: false }));
  game.player.collected = 0;
  game.robots = Array.from({ length: ROBOT_COUNT }, (_, i) => newRobot(game, i));
}

function newRobot(game, slot) {
  game.robotSeq += 1;
  return { id: game.robotSeq, slot, collected: 0, target: ROBOT_TARGET, respawns: 0 };
}

export function collectTriangle(game, id) {
  const triangle = game.triangles.find((t) => t.id === Number(id));
  if (!triangle || triangle.mined) return { ok: false, error: 'triangle-unavailable' };
  if (game.player.collected >= PLAYER_TARGET) return { ok: false, error: 'planet-complete' };
  triangle.level -= 1;
  triangle.mined = triangle.level <= 0;
  game.player.collected += 1;
  const cleared = game.player.collected >= PLAYER_TARGET;
  if (cleared) { game.planetIndex += 1; resetPlanet(game); }
  return { ok: true, triangleId: triangle.id, level: Math.max(0, triangle.level), collected: game.player.collected, cleared, planetIndex: game.planetIndex };
}

export function tickRobots(game) {
  for (let slot = 0; slot < game.robots.length; slot += 1) {
    const robot = game.robots[slot];
    robot.collected += 1;
    if (robot.collected >= robot.target) {
      const respawns = robot.respawns + 1;
      const fresh = newRobot(game, slot);
      fresh.respawns = respawns;
      game.robots[slot] = fresh;
    }
  }
  return publicState(game);
}

export function publicState(game) {
  return clone(game);
}
