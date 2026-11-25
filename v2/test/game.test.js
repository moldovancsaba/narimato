import test from 'node:test';
import assert from 'node:assert/strict';
import { BREAK_LEVELS, PLAYER_TARGET, ROBOT_COUNT, ROBOT_TARGET, collectTriangle, createGame, tickRobots } from '../server/game.js';

test('v2 game: planet starts with 1280 surface triangles, 3 levels and 4 robots', () => {
  const game = createGame();
  assert.equal(game.planetIndex, 1);
  assert.equal(game.triangles.length, 1280);
  assert.equal(game.triangles[0].level, BREAK_LEVELS);
  assert.equal(game.robots.length, ROBOT_COUNT);
  assert.equal(game.player.target, PLAYER_TARGET);
});

test('v2 game: a triangle needs three breaks and then cannot be collected again', () => {
  const game = createGame();
  for (let i = 0; i < BREAK_LEVELS; i += 1) assert.equal(collectTriangle(game, 0).ok, true);
  assert.equal(game.player.collected, 3);
  assert.equal(game.triangles[0].mined, true);
  assert.equal(collectTriangle(game, 0).ok, false);
});

test('v2 game: 30 collected breaks clears the planet and starts the next one', () => {
  const game = createGame();
  for (let id = 0; id < 10; id += 1) for (let i = 0; i < BREAK_LEVELS; i += 1) collectTriangle(game, id);
  assert.equal(game.planetIndex, 2);
  assert.equal(game.player.collected, 0);
  assert.equal(game.triangles.every((t) => t.level === BREAK_LEVELS), true);
});

test('v2 game: robots collect; on target a new robot respawns', () => {
  const game = createGame();
  const first = game.robots[0];
  for (let i = 0; i < ROBOT_TARGET; i += 1) tickRobots(game);
  const current = game.robots[0];
  assert.notEqual(current.id, first.id);
  assert.equal(current.collected, 0);
  assert.equal(current.respawns, 1);
  assert.equal(game.robots.length, ROBOT_COUNT);
});
