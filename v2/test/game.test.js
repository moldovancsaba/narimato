import test from 'node:test';
import assert from 'node:assert/strict';
import { canReset, clickTriangle, collectPlayer, createGame, publicState, resetIfComplete, tickRobots, TRIANGLE_LEVELS } from '../public/game-rules.js';

test('v2 rules: 20 level-1 leaves and 4 robots', () => {
  const game = createGame();
  const s = publicState(game);
  assert.equal(s.leaves.length, 20);
  assert.equal(s.leaves.every((l) => l.level === 1), true);
  assert.equal(s.robots.length, 4);
  assert.equal(s.player.target, 30);
  assert.equal(s.planetIndex, 1);
});

test('v2 rules: each actor clicks once; two distinct actors split into 4 children', () => {
  const game = createGame();
  const id = publicState(game).leaves[0].id;
  assert.equal(clickTriangle(game, 'player', id).ok, true);
  assert.equal(clickTriangle(game, 'player', id).ok, false);
  const second = clickTriangle(game, 'robot-x', id);
  assert.equal(second.ok, true);
  assert.equal(second.split, true);
  assert.equal(publicState(game).leaves.length, 23); // 19 + 4
  assert.equal(publicState(game).leaves.every((l) => l.clickedBy.length === 0), true);
});

test('v2 rules: level-4 triangle stays and becomes red for all after two actors', () => {
  const game = createGame();
  game.planets[0].leaves[0].level = TRIANGLE_LEVELS;
  game.planets[0].leaves[0].clickedBy = ['first'];
  const id = game.planets[0].leaves[0].id;
  const res = clickTriangle(game, 'second', id);
  assert.equal(res.ok, true);
  const leaf = publicState(game).leaves.find((l) => l.id === id);
  assert.equal(leaf.globallyRed, true);
  assert.equal(clickTriangle(game, 'third', id).ok, false);
});

test('v2 rules: reset when every leaf is level 4 and globally red; actor counts kept', () => {
  const game = createGame();
  for (const leaf of game.planets[0].leaves) { leaf.level = TRIANGLE_LEVELS; leaf.globallyRed = true; }
  game.player.count = 7;
  assert.equal(canReset(game.planets[0]), true);
  assert.equal(resetIfComplete(game), true);
  const s = publicState(game);
  assert.equal(s.leaves.length, 20);
  assert.equal(s.player.count, 7);
});

test('v2 rules: 30 player clicks leave planet; 3 planets wrap to 1 with fresh counts', () => {
  const game = createGame();
  assert.equal(game.player.planet, 0);
  // accelerate to 29, then click one green leaf
  game.player.count = 29;
  let leaf = publicState(game).leaves.find((l) => l.clickedBy.length === 0);
  let res = collectPlayer(game, leaf.id);
  assert.equal(res.cleared, true);
  assert.equal(publicState(game).planetIndex, 2);
  assert.equal(publicState(game).player.count, 0);
  // accelerate through planets 2 and 3
  game.player.count = 29;
  leaf = publicState(game).leaves.find((l) => l.clickedBy.length === 0);
  res = collectPlayer(game, leaf.id);
  assert.equal(res.cleared, true);
  assert.equal(publicState(game).planetIndex, 3);
  game.player.count = 29;
  leaf = publicState(game).leaves.find((l) => l.clickedBy.length === 0);
  res = collectPlayer(game, leaf.id);
  assert.equal(res.cleared, true);
  assert.equal(publicState(game).planetIndex, 1);
});

test('v2 rules: robot reaching 30 respawns on same planet', () => {
  const game = createGame();
  const before = publicState(game).robots[0].id;
  game.robots[0].count = 30;
  tickRobots(game);
  const after = publicState(game).robots[0];
  assert.notEqual(after.id, before);
  assert.ok(after.count <= 1);
  assert.equal(after.respawns, 1);
  assert.equal(publicState(game).planetIndex, 1);
});

test('v2 rules: full hierarchy 20 -> 80 -> 320 -> 1280 then reset to 20', () => {
  const game = createGame();
  const splitAll = (level) => {
    const leaves = publicState(game).leaves.filter((l) => l.level === level);
    for (const leaf of leaves) {
      clickTriangle(game, `split-a-${level}`, leaf.id);
      clickTriangle(game, `split-b-${level}`, leaf.id);
    }
  };
  splitAll(1);
  assert.equal(publicState(game).leaves.length, 80);
  splitAll(2);
  assert.equal(publicState(game).leaves.length, 320);
  splitAll(3);
  const level4 = publicState(game).leaves;
  assert.equal(level4.length, 1280);
  assert.equal(level4.every((l) => l.level === 4), true);
  game.player.count = 5;
  for (const leaf of level4) {
    clickTriangle(game, 'red-a', leaf.id);
    clickTriangle(game, 'red-b', leaf.id);
  }
  const after = publicState(game);
  assert.equal(after.leaves.length, 20);
  assert.equal(after.leaves.every((l) => l.level === 1), true);
  assert.equal(after.player.count, 5);
});
