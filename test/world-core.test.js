/**
 * NARIMATO — INFINITE GRID world-core unit tests.
 *
 * Fake clock, no real waiting. Covers: config coercion, fresh world, persistent
 * identity/tokens, scoring (claim/steal/reinforce), individual cell breaking
 * with owner inheritance + break isolation, SURGE-free deep labels up to
 * MAX_DEPTH, depth cap, facesHeld bookkeeping, events, arcade, and atomic
 * save/load/reload (including corrupt-file fallback).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  WorldCore,
  normalizeConfig,
  resolveConfig,
  parseWorldLabel,
  breakBonus,
  randomPlayerColor,
  isHexColor,
  MIN_COLOR_CHANNEL_MAX,
  CLAIM_POINTS,
  STEAL_POINTS,
  REINFORCE_POINTS,
  DEFAULT_CONFIG,
} from '../lib/world-core.js';
import { buildMesh, childTriangles } from '../public/js/shared/geometry.js';
import { robotTargetForOnlineHumans } from '../lib/planet-manager.js';
import { missionForPlanet, missionProgress, planetDepth, planetName } from '../public/js/shared/mission.js';

/** Flat ore inventory that exactly satisfies a generated mission. */
function oreCountsForMission(mission) {
  const counts = {};
  for (const objective of mission.objectives) {
    for (const item of objective.items) counts[item.resourceId] = (counts[item.resourceId] || 0) + item.need;
  }
  return counts;
}
import { resourceById, rollDeposit, rollResource, RESOURCE_MARKET } from '../public/js/shared/resources.js';
import { PLANET_VERSION, terrainAt, weightedResourceForBiome, BIOMES } from '../public/js/shared/planet.js';

const T0 = 1_700_000_000_000;

function makeClock(start = T0) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
      return t;
    },
    set(value) {
      t = value;
      return t;
    },
  };
}

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'icosa-world-'));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

/** Small deterministic PRNG for robot timing/selection in tests. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function makeCore(t, { config = {}, dataDir = null, clock = null, rng = Math.random } = {}) {
  const dir = dataDir || (await tempDir(t));
  const theClock = clock || makeClock();
  const core = new WorldCore({
    dataDir: dir,
    config: { clickCooldownMs: 0, depositChance: 0, ...config },
    now: theClock.now,
    rng,
    autoSave: false,
    quiet: true,
  });
  t.after(async () => {
    await core.flush();
  });
  return { core, clock: theClock, dataDir: dir };
}

/** Assert a canonical #rrggbb colour that is not near-black (visible on the arena). */
function assertVisibleColor(color) {
  assert.match(color, /^#[0-9a-f]{6}$/, `colour ${color} must be #rrggbb`);
  const channels = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((hex) => parseInt(hex, 16));
  assert.ok(
    Math.max(...channels) >= MIN_COLOR_CHANNEL_MAX,
    `colour ${color} is too dark (max channel ${Math.max(...channels)} < ${MIN_COLOR_CHANNEL_MAX})`,
  );
}

const playerIndex = (core, id) => core.getState().players.findIndex((player) => player.id === id);

const terrainFor = (core, label) => terrainAt(core.planetSeed, core.getLeafMap().get(label).centroid);
const mineableLabels = (core) => core.getLeaves().map(([label]) => label).filter((label) => terrainFor(core, label).biome.mineable);
const oceanLabels = (core) => core.getLeaves().map(([label]) => label).filter((label) => !terrainFor(core, label).biome.mineable);

/** Deterministic tests: force hidden deposits to be mined on the first click. */
function forceFirstClickDeposits(core, labels = null) {
  const cells = labels ? labels.map((label) => core.getLeafMap().get(label)) : [...core.getLeafMap().values()];
  for (const cell of cells) {
    if (cell && cell.resourceId && !cell.resourceFound) cell.resourceFindClick = 1;
  }
}
function pickLabel(core, predicate) {
  for (const [label] of core.getLeaves()) {
    if (predicate(terrainFor(core, label), label)) return label;
  }
  return null;
}
const leafMap = (core) => new Map(core.getLeaves().map(([label, owner, clicks]) => [label, { owner, clicks }]));
const click = (core, token, label) => core.click({ token, label });

function clickTimes(core, token, label, times) {
  const results = [];
  for (let i = 0; i < times; i += 1) results.push(click(core, token, label));
  return results;
}

/**
 * Charge/contest one cell by alternating two players — required by the
 * own-cell lock (a single player can never charge their own cell twice).
 */
function contest(core, tokenA, tokenB, label, times) {
  const results = [];
  for (let i = 0; i < times; i += 1) results.push(click(core, i % 2 === 0 ? tokenA : tokenB, label));
  return results;
}

// -------------------------------------------------------------------- config

test('config: defaults, env overrides and coercion', () => {
  const defaults = resolveConfig({});
  assert.equal(defaults.port, 4173);
  assert.equal(defaults.host, '0.0.0.0');
  assert.ok(defaults.dataDir.endsWith(`${path.sep}data`));
  assert.equal(defaults.breakClicks, 8);
  assert.equal(defaults.maxDepth, 24);
  assert.equal(defaults.clickCooldownMs, 40);
  assert.equal(defaults.saveDebounceMs, 500);
  assert.equal(defaults.depositChance, null, 'biome geology drives deposits unless DEPOSIT_CHANCE overrides');
  assert.equal(defaults.planetSeed, null, 'random planet seed unless pinned');
  assert.equal(defaults.bots, 1, 'one robot online by default');
  assert.equal(defaults.botMinMs, 60_000);
  assert.equal(defaults.botMaxMs, 180_000);
  assert.equal(defaults.botGapMinMs, 3_000);
  assert.equal(defaults.botGapMaxMs, 10_000);
  assert.equal(defaults.botClickMinMs, 800);
  assert.equal(defaults.botClickMaxMs, 2_800);

  const cfg = resolveConfig({
    PORT: '0',
    HOST: '127.0.0.1',
    DATA_DIR: '/tmp/icosa-data',
    BREAK_CLICKS: '3',
    MAX_DEPTH: '5',
    CLICK_COOLDOWN_MS: '0',
    SAVE_DEBOUNCE_MS: '25',
  });
  assert.equal(cfg.port, 0);
  assert.equal(cfg.host, '127.0.0.1');
  assert.equal(cfg.dataDir, '/tmp/icosa-data');
  assert.equal(cfg.breakClicks, 3);
  assert.equal(cfg.maxDepth, 5);
  assert.equal(cfg.clickCooldownMs, 0);
  assert.equal(cfg.saveDebounceMs, 25);
  // BOTS=0 disables the robot; inverted min/max pairs are clamped in order.
  const botCfg = resolveConfig({
    BOTS: '0',
    BOT_MIN_MS: '100',
    BOT_MAX_MS: '50',
    BOT_GAP_MIN_MS: '10',
    BOT_GAP_MAX_MS: '5',
    BOT_CLICK_MIN_MS: '20',
    BOT_CLICK_MAX_MS: '10',
  });
  assert.equal(botCfg.bots, 0);
  assert.equal(botCfg.botMinMs, 100);
  assert.equal(botCfg.botMaxMs, 100);
  assert.equal(botCfg.botGapMinMs, 10);
  assert.equal(botCfg.botGapMaxMs, 10);
  assert.equal(botCfg.botClickMinMs, 20);
  assert.equal(botCfg.botClickMaxMs, 20);
  // DEPOSIT_CHANCE: explicit 0..1 float override; unset/invalid = terrain chance.
  assert.equal(resolveConfig({ DEPOSIT_CHANCE: '0' }).depositChance, 0);
  assert.equal(resolveConfig({ DEPOSIT_CHANCE: '0.5' }).depositChance, 0.5);
  assert.equal(resolveConfig({ DEPOSIT_CHANCE: '1' }).depositChance, 1);
  assert.equal(resolveConfig({ DEPOSIT_CHANCE: '-2' }).depositChance, 0);
  assert.equal(resolveConfig({ DEPOSIT_CHANCE: '5' }).depositChance, 1);
  assert.equal(resolveConfig({ DEPOSIT_CHANCE: 'nope' }).depositChance, null);
  assert.equal(resolveConfig({}, { depositChance: 1 }).depositChance, 1);
  assert.equal(resolveConfig({}, { planetSeed: 424242 }).planetSeed, 424242);
  assert.equal(resolveConfig({}, { planetSeed: -5 }).planetSeed, null);

  // Invalid values fall back; out-of-range values clamp.
  assert.equal(resolveConfig({ PORT: 'abc' }).port, 4173);
  assert.equal(resolveConfig({ PORT: '99999' }).port, 4173);
  assert.equal(resolveConfig({ PORT: ' 5000 ' }).port, 5000);
  assert.equal(resolveConfig({ BREAK_CLICKS: '0' }).breakClicks, 1);
  assert.equal(resolveConfig({ BREAK_CLICKS: 'x' }).breakClicks, 8);
  assert.equal(resolveConfig({ MAX_DEPTH: '-3' }).maxDepth, 0);
  assert.equal(resolveConfig({ MAX_DEPTH: '999' }).maxDepth, 32);
  assert.equal(resolveConfig({ CLICK_COOLDOWN_MS: 'nope' }).clickCooldownMs, 40);
  // Explicit overrides win over the environment; unknown keys are ignored.
  assert.equal(resolveConfig({ PORT: '5000' }, { port: 0 }).port, 0);
  assert.equal(resolveConfig({ BREAK_CLICKS: '9' }, { breakClicks: 2 }).breakClicks, 2);
  assert.equal(normalizeConfig({ nope: 1 }).port, DEFAULT_CONFIG.port);
  // Bonus formula and label grammar.
  assert.equal(breakBonus(0), 50);
  assert.equal(breakBonus(1), 60);
  assert.equal(breakBonus(8), 130);
  assert.deepEqual(parseWorldLabel('11'), { path: [11], label: '11', level: 0 });
  assert.deepEqual(parseWorldLabel('9.2'), { path: [9, 2], label: '9.2', level: 1 });
  assert.deepEqual(parseWorldLabel('1.2.3.4.1'), { path: [1, 2, 3, 4, 1], label: '1.2.3.4.1', level: 4 });
  for (const bad of ['', '0', '21', '1.0', '1.5', '11.4.5', 'a', '11..4', null, 42]) {
    assert.equal(parseWorldLabel(bad), null, `invalid label ${JSON.stringify(bad)}`);
  }
});

// ---------------------------------------------------------------- fresh world

test('fresh world: 20 unowned base leaves and no round/timer fields', async (t) => {
  const { core, clock } = await makeCore(t);
  const state = core.getState();
  assert.deepEqual(Object.keys(state).sort(), [
    'arcade',
    'createdAt',
    'faces',
    'maxDepth',
    'maxDepthReached',
    'planetSeed',
    'players',
    'resources',
    'serverTime',
    'terrainVersion',
    'threshold',
    'totalBreaks',
    'totalClicks',
  ]);
  assert.equal(state.serverTime, T0);
  assert.equal(state.threshold, 8);
  assert.equal(state.maxDepth, 24);
  assert.equal(state.maxDepthReached, 0);
  assert.equal(state.faces, 20);
  assert.equal(state.totalClicks, 0);
  assert.equal(state.totalBreaks, 0);
  assert.equal(state.createdAt, T0);
  assert.deepEqual(state.players, []);
  assert.deepEqual(state.arcade, []);
  assert.deepEqual(state.resources, RESOURCE_MARKET);
  assert.equal(state.resources.length, 10);
  assert.equal('phase' in state, false);
  assert.equal('roundNumber' in state, false);

  const leaves = core.getLeaves();
  assert.equal(leaves.length, 20);
  assert.equal(state.planetSeed, core.planetSeed);
  assert.equal(state.terrainVersion, PLANET_VERSION);
  assert.deepEqual(leaves.map(([label]) => label), Array.from({ length: 20 }, (_, i) => String(i + 1)));
  for (const leaf of leaves) {
    assert.equal(leaf.length, 5, 'Leaf wire is [label, owner, clicks, discoveredResourceId|null, lastClickIndex]');
    assert.equal(leaf[1], -1);
    assert.equal(leaf[2], 0);
    assert.equal(leaf[3], null, 'hidden deposits must never leak');
    assert.equal(leaf[4], -1, 'no clicks yet -> lastClickIndex -1');
  }
  assert.equal(core.health().faces, 20);
  assert.equal(core.health().playersOnline, 0);
  assert.equal(core.health().maxDepthReached, 0);
  assert.equal(core.health().totalClicks, 0);

  // No timers/rounds: time passing changes nothing and clicking still works.
  clock.advance(30 * 24 * 60 * 60 * 1000);
  const joined = core.join({ tag: 'NEO' });
  assert.equal(joined.ok, true);
  assert.equal(click(core, joined.token, '1').ok, true);
  assert.equal(core.getState().faces, 20);
});

// ------------------------------------------------------------------ identity

test('identity: tokens reconnect, tags stay unique, players are append-only', async (t) => {
  const { core } = await makeCore(t);
  for (const bad of [undefined, null, '', 'A', 'TOO_LONG_TAG_99', 'bad tag', 'héllo', 42]) {
    const res = core.join({ tag: bad });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'INVALID_TAG');
  }

  const first = core.join({ tag: ' neo ' });
  assert.equal(first.ok, true);
  assert.equal(first.player.tag, 'NEO');
  assert.equal(first.player.bot, undefined);
  assert.match(first.token, /^[0-9a-f-]{36}$/);
  assertVisibleColor(first.player.color);
  assert.equal(first.state.players.length, 1);
  assert.equal(first.state.players[0].online, true);
  assert.equal(first.state.players[0].score, 0);
  assert.equal(first.state.players[0].facesHeld, 0);
  assert.equal(first.state.players[0].clicks, 0);
  assert.equal(first.state.players[0].breaks, 0);
  assert.equal(first.state.players[0].claims, 0);
  assert.equal(first.state.players[0].steals, 0);
  assert.equal(first.leaves.length, 20);

  const reconnect = core.join({ tag: 'neo', token: first.token });
  assert.equal(reconnect.ok, true);
  assert.equal(reconnect.player.id, first.player.id);
  assert.equal(reconnect.token, first.token);
  assert.equal(core.getState().players.length, 1);
  assert.equal(playerIndex(core, first.player.id), 0);

  const tokenlessDup = core.join({ tag: 'neo' });
  assert.equal(tokenlessDup.ok, false);
  assert.equal(tokenlessDup.error, 'TAG_IN_USE');
  const otherTokenDup = core.join({ tag: 'NEO', token: '00000000-0000-4000-8000-000000000000' });
  assert.equal(otherTokenDup.ok, false);
  assert.equal(otherTokenDup.error, 'TAG_IN_USE');

  // A different tag with an existing token creates a SEPARATE identity; it must
  // not rename or inherit the token's previous player (color/score stay fresh).
  const fresh = core.join({ tag: 'morpheus', token: first.token });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.player.tag, 'MORPHEUS');
  assert.notEqual(fresh.player.id, first.player.id);
  assert.notEqual(fresh.token, first.token);
  assert.equal(fresh.player.color === first.player.color, false);
  assert.equal(core.getState().players[0].tag, 'NEO', 'old identity unchanged');
  assert.equal(core.getState().players[0].id, first.player.id);

  const second = core.join({ tag: 'TRINITY' });
  assert.equal(second.ok, true);
  assert.equal(playerIndex(core, second.player.id), 2);
  assert.notEqual(second.player.color, first.player.color);

  const renameClash = core.join({ tag: 'trinity', token: first.token });
  assert.equal(renameClash.ok, false);
  assert.equal(renameClash.error, 'TAG_IN_USE');

  // Unknown token + free tag appends a new player (stale tokens never bind).
  const third = core.join({ tag: 'NEO3', token: '11111111-1111-4111-8111-111111111111' });
  assert.equal(third.ok, true);
  assert.notEqual(third.token, '11111111-1111-4111-8111-111111111111');
  assert.equal(playerIndex(core, third.player.id), 3);
  assert.equal(core.getState().players.length, 4);

  // Online flags are tracked explicitly.
  assert.equal(core.setOnline(first.player.id, false), true);
  assert.equal(core.getState().players[0].online, false);
  assert.equal(core.onlineCount(), 3);
  assert.equal(core.setOnline(first.player.id, true), true);
  assert.equal(core.onlineCount(), 4);
  assert.equal(core.setOnline('nope', true), false);
});

// ------------------------------------------------------------------- scoring

// --------------------------------------------------------------- own-cell lock

test('own-cell lock: repeated own click rejected without mutation; contest unlocks', async (t) => {
  const { core } = await makeCore(t);
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });

  let res = click(core, a.token, '1');
  assert.deepEqual(res, {
    ok: true,
    label: '1',
    cell: ['1', 0, 1, null, 0],
    points: CLAIM_POINTS,
    kind: 'claim',
    score: 10,
    broke: false,
  });

  const leavesBefore = core.getLeaves();
  const stateBefore = core.getState();
  const revisionBefore = core.revision;
  res = click(core, a.token, '1');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'OWN_CELL_LOCKED');
  assert.match(res.message, /contest/i);
  assert.deepEqual(core.getLeaves(), leavesBefore);
  assert.equal(core.revision, revisionBefore);
  assert.deepEqual(core.getState().players, stateBefore.players);
  assert.equal(core.getState().totalClicks, 1);

  res = click(core, b.token, '1');
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'steal');
  assert.equal(res.points, STEAL_POINTS);
  assert.deepEqual(res.cell, ['1', 1, 2, null, 1]);
  assert.equal(click(core, b.token, '1').error, 'OWN_CELL_LOCKED');
  res = click(core, a.token, '1');
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'steal');
  assert.equal(res.points, STEAL_POINTS);

  const state = core.getState();
  assert.equal(state.totalClicks, 3);
  assert.equal(state.players[0].score, 25);
  assert.equal(state.players[0].facesHeld, 1);
  assert.equal(state.players[0].claims, 1);
  assert.equal(state.players[0].steals, 1);
  assert.equal(state.players[1].score, 15);
  assert.equal(state.players[1].facesHeld, 0);
  assert.equal(state.players[1].steals, 1);
  assert.deepEqual(leafMap(core).get('1'), { owner: 0, clicks: 3 });

  const cellEvents = core.drainEvents().filter((event) => event.type === 'cell');
  assert.deepEqual(cellEvents.map((event) => event.kind), ['claim', 'steal', 'steal']);
  assert.deepEqual(cellEvents.map((event) => event.points), [CLAIM_POINTS, STEAL_POINTS, STEAL_POINTS]);
});

test('own-cell lock: cooldown is validated before the lock rule', async (t) => {
  const { core, clock } = await makeCore(t, { config: { clickCooldownMs: 40 } });
  const a = core.join({ tag: 'ALPHA' });
  assert.equal(click(core, a.token, '2').ok, true);
  assert.equal(click(core, a.token, '2').error, 'COOLDOWN');
  clock.advance(41);
  const res = click(core, a.token, '2');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'OWN_CELL_LOCKED');
  assert.equal(core.getState().totalClicks, 1);
});

test('click scoring: claim and steal (reinforce contested away)', async (t) => {
  const { core } = await makeCore(t);
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });

  let res = click(core, a.token, '1');
  assert.deepEqual(res, {
    ok: true,
    label: '1',
    cell: ['1', 0, 1, null, 0],
    points: CLAIM_POINTS,
    kind: 'claim',
    score: 10,
    broke: false,
  });
  let state = core.getState();
  assert.equal(state.totalClicks, 1);
  assert.equal(state.players[0].facesHeld, 1);
  assert.equal(state.players[0].claims, 1);
  assert.equal(state.players[0].clicks, 1);
  assert.equal(core.leafCount, 20);

  res = click(core, b.token, '1');
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'steal');
  assert.equal(res.points, STEAL_POINTS);
  assert.equal(res.cell[1], 1);
  assert.equal(res.cell[2], 2);
  assert.equal(res.score, 15);
  state = core.getState();
  assert.equal(state.players[0].score, 10, 'victim score is untouched by a steal');
  assert.equal(state.players[0].facesHeld, 0);
  assert.equal(state.players[0].steals, 0);
  assert.equal(state.players[1].facesHeld, 1);
  assert.equal(state.players[1].steals, 1);
  assert.equal(state.totalClicks, 2);
  assert.deepEqual(leafMap(core).get('1'), { owner: 1, clicks: 2 });

  const events = core.drainEvents();
  assert.deepEqual(events.map((event) => event.type), ['cell', 'cell']);
  assert.deepEqual(events.map((event) => event.kind), ['claim', 'steal']);
  assert.deepEqual(events.map((event) => event.points), [CLAIM_POINTS, STEAL_POINTS]);
  assert.equal(events[1].playerId, b.player.id);
  assert.equal(events[1].broke, false);
});

test('click cooldown and validation errors never mutate the world', async (t) => {
  const { core, clock } = await makeCore(t, { config: { clickCooldownMs: 40 } });
  const a = core.join({ tag: 'ALPHA' });
  const before = { leaves: core.getLeaves(), state: core.getState(), revision: core.revision };

  assert.equal(click(core, 'bad-token', '1').error, 'NOT_JOINED');
  for (const bad of ['0', '21', '1.5', 'x', '1..2', '']) {
    assert.equal(click(core, a.token, bad).error, 'INVALID_LABEL', `label ${bad}`);
  }
  assert.equal(click(core, a.token, '20.1').error, 'NOT_A_LEAF');
  assert.equal(core.getLeaves().length, before.leaves.length);
  assert.equal(core.getState().totalClicks, 0);

  let res = click(core, a.token, '1');
  assert.equal(res.ok, true);
  assert.equal(res.points, 10);
  res = click(core, a.token, '2');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'COOLDOWN');
  assert.equal(core.getLeaves().length, 20);
  assert.equal(core.getState().totalClicks, 1);

  clock.advance(39);
  assert.equal(click(core, a.token, '2').error, 'COOLDOWN');
  clock.advance(1);
  res = click(core, a.token, '2');
  assert.equal(res.ok, true);
  assert.equal(res.points, 10);
  assert.equal(core.getState().totalClicks, 2);
});

// -------------------------------------------------------------------- breaks

test('threshold break: only that cell subdivides; children inherit owner and stay locked', async (t) => {
  const { core } = await makeCore(t);
  assert.equal(core.config.breakClicks, 8, 'default BREAK_CLICKS is 8');
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  const before = leafMap(core);
  const baseFace = buildMesh(0).faces.find((face) => face.label === '3');
  const expected = childTriangles(baseFace.a, baseFace.b, baseFace.c)
    .map((tri) => ({ label: `3.${tri.labelNumber}`, tri }))
    .sort((p, q) => Number(p.label.split('.')[1].replace(/[^0-9]/g, '')) - Number(q.label.split('.')[1]));

  // A single player cannot charge their own cell: alternate A/B clicks.
  const results = contest(core, a.token, b.token, '3', 8);
  for (let i = 0; i < 7; i += 1) {
    assert.equal(results[i].ok, true);
    assert.equal(results[i].broke, false, `click ${i + 1} must not break`);
  }
  const breaking = results[7];
  assert.equal(breaking.ok, true);
  assert.equal(breaking.broke, true);
  assert.equal(breaking.kind, 'steal');
  assert.equal(breaking.points, STEAL_POINTS + breakBonus(0));
  assert.deepEqual(
    breaking.children.map(([label]) => label),
    ['3.1', '3.2', '3.3', '3.4'],
  );
  assert.deepEqual(breaking.cell, ['3', 1, 8, null, 1]);

  const state = core.getState();
  assert.equal(state.faces, 23, 'one leaf became four');
  assert.equal(state.totalClicks, 8);
  assert.equal(state.totalBreaks, 1);
  assert.equal(state.maxDepthReached, 1);
  assert.equal(state.players[1].breaks, 1, 'the 8th clicker breaks the cell');
  assert.equal(state.players[1].facesHeld, 4);
  assert.equal(state.players[0].breaks, 0);
  assert.equal(state.players[0].facesHeld, 0);

  const after = leafMap(core);
  assert.equal(after.has('3'), false, 'broken parent is no longer a leaf');
  assert.equal(core.getLeaves().length, 23);
  for (const { label, tri } of expected) {
    assert.ok(after.has(label), `missing child ${label}`);
    assert.deepEqual(after.get(label), { owner: 1, clicks: 0 });
    const cell = core.getLeafMap().get(label);
    assert.deepEqual(cell.a, tri.a);
    assert.deepEqual(cell.b, tri.b);
    assert.deepEqual(cell.c, tri.c);
    // Fresh children count as already clicked by the breaker -> locked for them.
    assert.equal(cell.lastClickIndex, 1);
  }
  for (const [label, value] of before) {
    if (label === '3') continue;
    assert.deepEqual(after.get(label), value, `cell ${label} must be untouched`);
  }

  // Dead parent -> NOT_A_LEAF; breaker is locked out of the children, others may contest.
  assert.equal(click(core, a.token, '3').error, 'NOT_A_LEAF');
  assert.equal(click(core, b.token, '3.1').error, 'OWN_CELL_LOCKED');
  assert.equal(click(core, a.token, '3.1').ok, true);

  const events = core.drainEvents();
  const breakEvent = events.find((event) => event.type === 'break');
  assert.ok(breakEvent);
  assert.equal(breakEvent.label, '3');
  assert.equal(breakEvent.depth, 0);
  assert.equal(breakEvent.byPlayerId, b.player.id);
  assert.equal(breakEvent.points, breakBonus(0));
  assert.deepEqual(breakEvent.children.map(([label]) => label), ['3.1', '3.2', '3.3', '3.4']);
});

test('break at depth 1: bonus scales with depth and labels nest', async (t) => {
  const { core } = await makeCore(t);
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  assert.equal(contest(core, a.token, b.token, '5', 8)[7].broke, true);
  assert.equal(core.getState().maxDepthReached, 1);

  // Child 5.2 is owned by B (the breaker) and locked for B, so A starts the contest.
  const parentLabel = '5.2';
  const results = contest(core, a.token, b.token, parentLabel, 8);
  assert.equal(results[6].broke, false);
  const breaking = results[7];
  assert.equal(breaking.broke, true);
  assert.equal(breaking.points, STEAL_POINTS + breakBonus(1));
  assert.deepEqual(
    breaking.children.map(([label]) => label),
    ['5.2.1', '5.2.2', '5.2.3', '5.2.4'],
  );
  for (const [label, ownerIndex, clicks] of breaking.children) {
    assert.equal(ownerIndex, 1);
    assert.equal(clicks, 0);
    assert.equal(core.getLeafMap().get(label).lastClickIndex, 1);
  }
  const state = core.getState();
  assert.equal(state.maxDepthReached, 2);
  assert.equal(state.totalBreaks, 2);
  assert.equal(state.faces, 26);
  assert.equal(state.players[1].facesHeld, 7, '4 inherited leaves + 3 new leaves');
  const leaves = leafMap(core);
  assert.deepEqual(leaves.get('5.1'), { owner: 1, clicks: 0 });
  assert.deepEqual(leaves.get('5.3'), { owner: 1, clicks: 0 });
  assert.deepEqual(leaves.get('5.4'), { owner: 1, clicks: 0 });
  assert.equal(leaves.has('5.2'), false);
  assert.equal(click(core, b.token, '5.2.1').error, 'OWN_CELL_LOCKED');
  assert.equal(click(core, a.token, '5.2.1').ok, true);
});

test('MAX_DEPTH caps breaking: deep labels keep scoring but never split', async (t) => {
  const { core } = await makeCore(t, { config: { breakClicks: 2, maxDepth: 8 } });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  let label = '20';
  for (let depth = 0; depth < 8; depth += 1) {
    const first = click(core, a.token, label);
    assert.equal(first.ok, true, `click 1 at ${label}`);
    assert.equal(first.broke, false);
    const second = click(core, b.token, label);
    assert.equal(second.broke, true, `cell ${label} must break (depth ${depth})`);
    assert.equal(second.points, STEAL_POINTS + breakBonus(depth));
    label = `${label}.1`;
    assert.equal(parseWorldLabel(label).level, depth + 1);
  }
  assert.equal(label.split('.').length, 9, 'label has base + 8 child digits at MAX_DEPTH');
  let state = core.getState();
  assert.equal(state.maxDepthReached, 8);
  assert.equal(state.totalBreaks, 8);
  assert.equal(state.faces, 20 + 8 * 3);
  assert.equal(state.players[1].breaks, 8);

  // At MAX_DEPTH clicks keep scoring (via contest), but the cell never splits.
  const res1 = click(core, a.token, label);
  const res2 = click(core, b.token, label);
  assert.equal(res1.broke, false);
  assert.equal(res2.broke, false);
  assert.equal(res2.cell[2], 2);
  assert.equal('children' in res1, false);
  assert.equal('children' in res2, false);
  assert.equal(core.getState().faces, 20 + 8 * 3);
  assert.equal(core.getState().maxDepthReached, 8);
  assert.equal(core.getState().totalBreaks, 8);

  // Lower MAX_DEPTH: cells at the cap never break even at the threshold.
  const { core: shallow } = await makeCore(t, { config: { breakClicks: 2, maxDepth: 1 } });
  const s1 = shallow.join({ tag: 'ALPHA' });
  const s2 = shallow.join({ tag: 'BETA' });
  assert.equal(click(shallow, s1.token, '1').broke, false);
  assert.equal(click(shallow, s2.token, '1').broke, true);
  assert.equal(click(shallow, s1.token, '1.1').broke, false);
  const capped = click(shallow, s2.token, '1.1');
  assert.equal(capped.broke, false, 'depth-1 cell is at maxDepth and must not break');
  assert.equal(capped.cell[2], 2);
  assert.equal(shallow.getState().maxDepthReached, 1);
  assert.equal(shallow.getState().faces, 23);

  const { core: zero } = await makeCore(t, { config: { breakClicks: 2, maxDepth: 0 } });
  const z1 = zero.join({ tag: 'ALPHA' });
  const z2 = zero.join({ tag: 'BETA' });
  assert.equal(click(zero, z1.token, '1').broke, false);
  assert.equal(click(zero, z2.token, '1').broke, false);
  assert.equal(zero.getState().faces, 20);
  assert.equal(zero.getState().maxDepthReached, 0);
});

// --------------------------------------------------------------- persistence

test('persistence: players + tree survive a reload; lastClickIndex + indexes persist', async (t) => {
  const dataDir = await tempDir(t);
  const config = { breakClicks: 8, maxDepth: 8, clickCooldownMs: 0, saveDebounceMs: 10 };
  const clock = makeClock();
  const core = new WorldCore({ dataDir, config, now: clock.now, autoSave: false, quiet: true });

  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  // Contest cell '7' three times (A claim, B steal, A steal).
  assert.equal(click(core, a.token, '7').ok, true);
  assert.equal(click(core, b.token, '7').ok, true);
  assert.equal(click(core, a.token, '7').ok, true);
  assert.equal(click(core, a.token, '7').error, 'OWN_CELL_LOCKED');
  // Break cell '12' via alternating contest: B lands the 8th click.
  const results = contest(core, a.token, b.token, '12', 8);
  assert.equal(results[7].broke, true);

  const before = {
    state: JSON.parse(JSON.stringify(core.getState())),
    leaves: JSON.parse(JSON.stringify(core.getLeaves())),
  };
  await core.flush();

  const raw = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  assert.equal(raw.version, 2);
  assert.equal(raw.players.length, 2);
  assert.equal(raw.tree.length, 20);
  assert.equal(raw.totalClicks, 11);
  assert.equal(raw.totalBreaks, 1);
  assert.equal(raw.maxDepthReached, 1);
  const brokenRoot = raw.tree.find((node) => node.label === '12');
  assert.equal(brokenRoot.children.length, 4);
  assert.equal(brokenRoot.children[0].label, '12.1');
  assert.equal(brokenRoot.children[0].owner, 1);
  assert.equal(brokenRoot.children[0].lastClickIndex, 1, 'last click is persisted per cell');

  const reloaded = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  const afterState = reloaded.getState();
  assert.deepEqual(reloaded.getLeaves(), before.leaves);
  assert.deepEqual(
    afterState.players.map((player) => ({ ...player, online: false })),
    before.state.players.map((player) => ({ ...player, online: false })),
  );
  assert.equal(afterState.faces, before.state.faces);
  assert.equal(afterState.totalClicks, before.state.totalClicks);
  assert.equal(afterState.totalBreaks, before.state.totalBreaks);
  assert.equal(afterState.maxDepthReached, before.state.maxDepthReached);
  assert.equal(afterState.createdAt, before.state.createdAt);
  assert.deepEqual(afterState.arcade, before.state.arcade);
  assert.equal(afterState.players[0].facesHeld, before.state.players[0].facesHeld);
  // The lock rule survives a reload (owner still can't re-charge their own cell).
  assert.equal(reloaded.click({ token: b.token, label: '12.1' }).error, 'OWN_CELL_LOCKED');

  // Token reconnect resolves to the same persistent player index.
  const reconnect = reloaded.join({ tag: 'ALPHA', token: a.token });
  assert.equal(reconnect.ok, true);
  assert.equal(reconnect.player.id, a.player.id);
  assert.equal(playerIndex(reloaded, a.player.id), 0);

  // Append-only: a new player is appended and leaves keep stable owner indexes.
  const c = reloaded.join({ tag: 'GAMMA' });
  assert.equal(playerIndex(reloaded, c.player.id), 2);
  assert.deepEqual(reloaded.getLeaves(), before.leaves);
  assert.equal(click(reloaded, c.token, '1').cell[1], 2);

  await reloaded.flush();
  const twice = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  assert.equal(twice.getState().players.length, 3);
  assert.equal(twice.getState().totalClicks, before.state.totalClicks + 1);
  const leafOne = twice.getLeaves().find(([label]) => label === '1');
  assert.equal(leafOne[1], 2);
  assert.equal(twice.getLeafMap().get('1').lastClickIndex, 2);
});

test('persistence: missing/corrupt world files start fresh (players salvaged from bad tree)', async (t) => {
  // Absent file -> fresh world.
  const emptyDir = await tempDir(t);
  const fresh = await WorldCore.open({ dataDir: emptyDir, quiet: true, config: { clickCooldownMs: 0 } });
  assert.equal(fresh.getState().faces, 20);
  assert.equal(fresh.getState().players.length, 0);
  assert.deepEqual(fresh.getLeaves().map(([label]) => label), Array.from({ length: 20 }, (_, i) => String(i + 1)));

  // Garbage JSON -> fresh world.
  const garbageDir = await tempDir(t);
  await writeFile(path.join(garbageDir, 'world.json'), 'this is not json {', 'utf8');
  const garbage = await WorldCore.open({ dataDir: garbageDir, quiet: true });
  assert.equal(garbage.getState().faces, 20);
  assert.equal(garbage.getState().players.length, 0);

  // Tree corrupt but players valid -> players kept, grid reset to level 0.
  const salvageDir = await tempDir(t);
  const clock = makeClock();
  const seed = new WorldCore({ dataDir: salvageDir, config: { clickCooldownMs: 0 }, now: clock.now, autoSave: false, quiet: true });
  const a = seed.join({ tag: 'ALPHA' });
  seed.join({ tag: 'BETA' });
  clickTimes(seed, a.token, '1', 2);
  await seed.flush();
  const saved = JSON.parse(await readFile(path.join(salvageDir, 'world.json'), 'utf8'));
  saved.tree = saved.tree.slice(0, 3); // corrupt root list
  await writeFile(path.join(salvageDir, 'world.json'), JSON.stringify(saved), 'utf8');
  const salvaged = await WorldCore.open({ dataDir: salvageDir, quiet: true, config: { clickCooldownMs: 0 } });
  assert.equal(salvaged.getState().players.length, 2, 'valid players survive a corrupt tree');
  assert.equal(salvaged.getState().faces, 20, 'grid resets to level 0');
  assert.equal(salvaged.getLeaves().every(([, owner]) => owner === -1), true);
  assert.equal(salvaged.getState().players[0].facesHeld, 0, 'facesHeld recomputed');

  // Owner index out of range -> tree reset.
  const outOfRangeDir = await tempDir(t);
  const seed2 = new WorldCore({ dataDir: outOfRangeDir, config: { clickCooldownMs: 0 }, now: clock.now, autoSave: false, quiet: true });
  const b = seed2.join({ tag: 'ONLY' });
  assert.equal(click(seed2, b.token, '4').ok, true);
  await seed2.flush();
  const saved2 = JSON.parse(await readFile(path.join(outOfRangeDir, 'world.json'), 'utf8'));
  saved2.tree[3].owner = 99;
  await writeFile(path.join(outOfRangeDir, 'world.json'), JSON.stringify(saved2), 'utf8');
  const reset = await WorldCore.open({ dataDir: outOfRangeDir, quiet: true, config: { clickCooldownMs: 0 } });
  assert.equal(reset.getState().players.length, 1);
  assert.equal(reset.getState().faces, 20);
  assert.equal(reset.getLeaves().every(([, owner]) => owner === -1), true);
});

// -------------------------------------------------------------------- arcade

test('arcade: top 20 by score with stable entry shape', async (t) => {
  const { core, clock } = await makeCore(t);
  const tokens = [];
  for (let i = 0; i < 21; i += 1) {
    const joined = core.join({ tag: `P${i + 1}` });
    assert.equal(joined.ok, true);
    tokens.push(joined.token);
  }
  // First 20 players each claim one distinct base cell for 10 points.
  for (let i = 0; i < 20; i += 1) {
    clock.advance(1);
    assert.equal(click(core, tokens[i], String(i + 1)).ok, true);
  }
  const leaderboard = core.getLeaderboard(20);
  assert.equal(leaderboard.length, 20);
  for (const entry of leaderboard) {
    assert.deepEqual(Object.keys(entry).sort(), ['breaks', 'facesHeld', 'score', 'tag', 'updatedAt']);
    assert.equal(entry.score, 10);
    assert.equal(entry.facesHeld, 1);
    assert.equal(entry.breaks, 0);
    assert.equal(typeof entry.updatedAt, 'number');
  }
  const tags = leaderboard.map((entry) => entry.tag);
  assert.equal(tags.includes('P21'), false, '21st player (score 0) is outside the top 20');
  assert.equal(new Set(tags).size, 20);
  assert.deepEqual(core.getState().arcade, leaderboard);
});

// ------------------------------------------------------------------- storage

test('player colours: random visible 24-bit #rrggbb per player (no fixed palette)', async (t) => {
  // The generator itself always yields a canonical, visible colour.
  for (let i = 0; i < 100; i += 1) assertVisibleColor(randomPlayerColor());

  const { core } = await makeCore(t);
  const ids = new Set();
  const colors = new Set();
  const joined = [];
  // More players than the old 8-colour palette: with a palette, duplicates
  // would be forced. Random -> distinct/append-only per player.
  for (let i = 0; i < 12; i += 1) {
    const res = core.join({ tag: `OP${i}` });
    assert.equal(res.ok, true);
    assert.equal(ids.has(res.player.id), false, 'player ids are unique');
    ids.add(res.player.id);
    assertVisibleColor(res.player.color);
    colors.add(res.player.color);
    joined.push(res);
  }
  assert.equal(core.getState().players.length, 12);
  assert.equal(colors.size, 12, 'every new player gets a distinct random colour');
  assert.deepEqual(
    core.getState().players.map((player) => player.color),
    joined.map((res) => res.player.color),
    'state.players colours mirror join responses',
  );

  // Owners always refer to the same players array indexes.
  for (let i = 0; i < 12; i += 1) {
    const res = click(core, joined[i].token, String(i + 1));
    assert.equal(res.cell[1], i);
  }
  assert.deepEqual(
    core.getLeaderboard(20).map((entry) => entry.tag).sort(),
    Array.from({ length: 12 }, (_, i) => `OP${i}`).sort(),
  );
});

test('player colours: persisted colours survive reload verbatim, new players stay random', async (t) => {
  const dataDir = await tempDir(t);
  const clock = makeClock();
  const config = { clickCooldownMs: 0 };
  const core = new WorldCore({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  const colors = core.getState().players.map((player) => player.color);
  assert.equal(colors.length, 2);
  assert.notEqual(colors[0], colors[1]);
  for (const color of colors) assertVisibleColor(color);

  await core.flush();
  const saved = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  assert.deepEqual(saved.players.map((player) => player.color), colors, 'colours are persisted');

  // A dark-but-valid persisted colour is authoritative: reload must keep it
  // verbatim (the brightness guard only applies to newly generated colours).
  saved.players[0].color = '#123456';
  await writeFile(path.join(dataDir, 'world.json'), JSON.stringify(saved), 'utf8');
  const reloaded = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  assert.equal(reloaded.getState().players[0].color, '#123456');
  assert.equal(reloaded.join({ tag: 'ALPHA', token: a.token }).player.color, '#123456');
  assert.equal(reloaded.getState().players[1].color, colors[1]);
  assert.equal(reloaded.getState().players[1].tag, 'BETA');
  assert.ok(isHexColor(colors[0]) && isHexColor('#123456'));

  // Brand-new players (after reload) still get a fresh visible random colour,
  // distinct from the existing players' colours.
  const joined = [];
  for (let i = 0; i < 3; i += 1) {
    const res = reloaded.join({ tag: `NEW${i}` });
    assert.equal(res.ok, true);
    assertVisibleColor(res.player.color);
    joined.push(res.player.color);
  }
  const used = new Set([colors[0], colors[1], ...joined]);
  assert.equal(used.size, 2 + joined.length, 'new colours do not duplicate existing ones');
  assert.equal(reloaded.getState().players.length, 5);
  assert.equal(b.player.id, reloaded.getState().players[1].id);
  assert.equal(a.player.id, reloaded.getState().players[0].id);
});

// --------------------------------------------------------------------- robot

test('robot staffing rule: humans 1->2 robots, 2->1, 3+->0, 0->1 ambient', async (t) => {
  assert.equal(robotTargetForOnlineHumans(0), 1);
  assert.equal(robotTargetForOnlineHumans(1), 2);
  assert.equal(robotTargetForOnlineHumans(2), 1);
  assert.equal(robotTargetForOnlineHumans(3), 0);
  assert.equal(robotTargetForOnlineHumans(9), 0);

  const { core, clock } = await makeCore(t, {
    rng: mulberry32(0xb07),
    config: { bots: 1, botMinMs: 10_000, botMaxMs: 10_000, botClickMinMs: 50, botClickMaxMs: 50, clickCooldownMs: 0 },
  });
  const applyRule = () => {
    core.setRobotTarget(robotTargetForOnlineHumans(core.onlineHumanCount()));
    core.tick(clock.now());
  };

  // Empty planet: one ambient robot, spawned immediately on the first tick.
  applyRule();
  assert.equal(core.robotInfos().length, 1, 'humans=0 -> 1 ambient robot');
  assert.equal(core.onlineHumanCount(), 0, 'robots are not humans');

  const h1 = core.join({ tag: 'HUMAN1' });
  assert.equal(core.onlineHumanCount(), 1);
  applyRule();
  assert.equal(core.robotInfos().length, 2, 'humans=1 -> 2 robots');
  assert.equal(core.robotInfos().length + core.onlineHumanCount(), 3, 'scene keeps >=3 online players');

  const h2 = core.join({ tag: 'HUMAN2' });
  applyRule();
  assert.equal(core.robotInfos().length, 1, 'humans=2 -> 1 robot (excess displaced immediately)');

  const h3 = core.join({ tag: 'HUMAN3' });
  applyRule();
  assert.equal(core.robotInfos().length, 0, 'humans>=3 -> 0 robots');
  assert.equal(core.onlineHumanCount(), 3);

  // Humans leaving spawn replacements IMMEDIATELY (no gap).
  core.setOnline(h3.player.id, false);
  core.setOnline(h2.player.id, false);
  applyRule();
  assert.equal(core.onlineHumanCount(), 1);
  assert.equal(core.robotInfos().length, 2, 'human drop below 3 -> 2 robots instantly');
  assert.equal(new Set(core.getState().players.map((player) => player.id)).size, core.getState().players.length, 'all robot players join as real players');

  // BOTS=0 still disables robots entirely (manager would pass target 0).
  const { core: disabled } = await makeCore(t, { config: { bots: 0 } });
  disabled.join({ tag: 'HUMAN' });
  disabled.setRobotTarget(2);
  disabled.tick(0);
  assert.equal(disabled.robotInfos().length, 0);
});

test('robot staffing: multiple robots act independently, lifetimes replace immediately', async (t) => {
  const { core, clock } = await makeCore(t, {
    rng: mulberry32(0x51aff),
    config: { bots: 1, botMinMs: 400, botMaxMs: 400, botClickMinMs: 50, botClickMaxMs: 50, clickCooldownMs: 0 },
  });
  core.setRobotTarget(2);
  core.tick(clock.now());
  const first = core.robotInfos();
  assert.equal(first.length, 2);
  assert.equal(new Set(first.map((robot) => robot.playerId)).size, 2);

  // Both robots click on their own cadence.
  clock.advance(220);
  core.tick(clock.now());
  const robotStates = core.getState().players.filter((player) => first.some((robot) => robot.playerId === player.id));
  assert.ok(robotStates.length === 2);
  for (const robot of robotStates) assert.ok(robot.clicks > 0, `robot ${robot.tag} clicks independently`);

  // Lifetime expiry: both leave and replacements spawn in the SAME tick (no gap).
  const nextLeave = 400;
  clock.advance(Math.max(1, nextLeave));
  const events = core.tick(clock.now());
  const second = core.robotInfos();
  assert.equal(second.length, 2, 'replacements are immediate');
  assert.equal(
    core.getState().players.filter((player) => first.some((robot) => robot.playerId === player.id)).every((player) => !player.online),
    true,
    'old robots went offline',
  );
  assert.notEqual(second[0].playerId, first[0].playerId);
  assert.equal(events.some((event) => event.type === 'toast' && /LEFT/.test(event.message)), true);
  assert.equal(events.some((event) => event.type === 'toast' && /LINKED/.test(event.message)), true);
});

test('robot: contests (steals) human-owned cells so solo play cannot speed-run', async (t) => {
  // rng = 0 -> the robot picks the first active leaf ('1') every time.
  const { core, clock } = await makeCore(t, {
    rng: () => 0,
    config: { bots: 1, botGapMinMs: 10, botGapMaxMs: 10, botMinMs: 10_000, botMaxMs: 10_000, botClickMinMs: 10, botClickMaxMs: 10, clickCooldownMs: 0 },
  });
  const human = core.join({ tag: 'HUMAN' });
  assert.equal(click(core, human.token, '1').ok, true); // human owns cell 1, locked
  core.tick(clock.now()); // spawn immediately (no gap)
  clock.advance(11);
  core.tick(clock.now()); // first robot click
  const state = core.getState();
  assert.equal(state.players.length, 2);
  assert.equal(state.players[1].online, true);
  assert.ok(state.players[1].clicks >= 1);
  assert.ok(state.players[1].steals >= 1, 'robot contested a human-owned cell');
  const leaves = leafMap(core);
  assert.equal(leaves.get('1').owner, 1, 'human cell was flipped by the robot contest');
  // The human may now click it again (it was contested) via the normal steal path.
  assert.equal(click(core, human.token, '1').ok, true);
});

test('robot: BOTS=0 disables the robot entirely', async (t) => {
  const { core, clock } = await makeCore(t, { config: { bots: 0 } });
  core.join({ tag: 'HUMAN' });
  clock.advance(10 * 60 * 1000);
  core.tick(clock.now());
  assert.equal(core.getState().players.length, 1);
  assert.equal(core.robotInfo(), null);
  assert.equal(core.drainEvents().some((event) => event.type === 'toast'), false);
});

// -------------------------------------------------------------------- mining

// -------------------------------------------------------------------- mining

test('mining: terrain deposits hidden, only mineable biomes may hide ore', async (t) => {
  const { core } = await makeCore(t, { config: { depositChance: 1, planetSeed: 424242, bots: 0 } });
  assert.equal(core.getState().planetSeed, 424242);
  assert.equal(core.getState().terrainVersion, PLANET_VERSION);
  const mineable = mineableLabels(core);
  const oceans = oceanLabels(core);
  assert.ok(mineable.length > 0, 'planet has mineable land');
  assert.ok(oceans.length > 0, 'planet has oceans');
  for (const leaf of core.getLeaves()) {
    assert.equal(leaf.length, 5, 'Leaf wire has the lock slot');
    assert.equal(leaf[3], null, 'hidden deposits must never leak');
    const terrain = terrainFor(core, leaf[0]);
    if (terrain.biome.mineable) {
      assert.ok(core.getLeafMap().get(leaf[0]).resourceId, `${leaf[0]} (${terrain.biome.id}) should hide ore with DEPOSIT_CHANCE=1`);
    } else {
      assert.equal(core.getLeafMap().get(leaf[0]).resourceId, null, `${leaf[0]} (${terrain.biome.id}) is not surface-mineable`);
    }
  }
  assert.deepEqual(core.getState().resources, RESOURCE_MARKET);
  const a = core.join({ tag: 'ALPHA' });
  assert.equal(core.getState().players[0].ores, 0);
});

test('mining: first successful click mines once, resource follows biome weights', async (t) => {
  const { core } = await makeCore(t, { config: { depositChance: 1, planetSeed: 424242, bots: 0 } });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  const label = mineableLabels(core)[0];
  const terrain = terrainFor(core, label);
  const hidden = core.getLeafMap().get(label).resourceId;
  assert.ok(hidden);
  assert.ok(Object.keys(terrain.biome.weights).includes(hidden), `${hidden} must be in ${terrain.biome.id} weights`);
  forceFirstClickDeposits(core, [label]);
  let res = core.click({ token: a.token, label });
  assert.equal(res.ok, true);
  const resource = res.resource;
  assert.equal(resource.id, hidden);
  assert.equal(res.points, 10 + resource.value);
  assert.deepEqual(res.cell, [label, 0, 1, hidden, 0]);
  let state = core.getState();
  assert.equal(state.players[0].ores, 1);
  assert.equal(state.players[0].oreValue, resource.value);
  assert.deepEqual(state.players[0].oreCounts, { [resource.id]: 1 }, 'per-resource inventory increments');
  const frame = core.drainEvents().find((event) => event.type === 'resource');
  assert.deepEqual(frame, { type: 'resource', label, resource, playerId: a.player.id, points: resource.value });
  // Found forever: contest/steal then click again -> no second reward.
  assert.equal(core.getLeafMap().get(label).resourceFound, true);
  assert.equal(core.getLeafMap().get(label).foundByIndex, 0);
  assert.equal(core.click({ token: b.token, label }).resource, undefined);
  assert.equal(core.click({ token: a.token, label }).resource, undefined);
  assert.equal(core.getState().players[0].ores, 1);
  assert.equal(core.drainEvents().some((event) => event.type === 'resource'), false);
});

test('mining: ocean cells claim but never yield surface deposits', async (t) => {
  const { core } = await makeCore(t, { config: { depositChance: 1, planetSeed: 424242, bots: 0 } });
  const a = core.join({ tag: 'ALPHA' });
  const label = oceanLabels(core)[0];
  assert.ok(label);
  const terrain = terrainFor(core, label);
  assert.equal(terrain.biome.mineable, false);
  assert.equal(core.getLeafMap().get(label).resourceId, null);
  const res = core.click({ token: a.token, label });
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'claim');
  assert.equal(res.resource, undefined);
  assert.equal(res.points, 10);
  assert.deepEqual(res.cell, [label, 0, 1, null, 0]);
  assert.equal(core.getState().players[0].ores, 0);
  assert.equal(core.getState().players[0].oreValue, 0);
});

test('mining: rejected clicks (cooldown / own-cell lock) never mine', async (t) => {
  const { core, clock } = await makeCore(t, { config: { depositChance: 1, planetSeed: 424242, clickCooldownMs: 40, bots: 0 } });
  const a = core.join({ tag: 'ALPHA' });
  const first = mineableLabels(core)[0];
  const second = mineableLabels(core)[1];
  forceFirstClickDeposits(core, [first, second]);
  assert.equal(core.click({ token: a.token, label: first }).ok, true);
  const oresAfterFirst = core.getState().players[0].ores;
  assert.equal(core.click({ token: a.token, label: second }).error, 'COOLDOWN');
  assert.equal(core.getState().players[0].ores, oresAfterFirst);
  assert.equal(core.getLeafMap().get(second).resourceFound, false);
  clock.advance(41);
  assert.equal(core.click({ token: a.token, label: second }).ok, true);
  const ores = core.getState().players[0].ores;
  clock.advance(41);
  assert.equal(core.click({ token: a.token, label: second }).error, 'OWN_CELL_LOCKED');
  assert.equal(core.getState().players[0].ores, ores);
});

test('mining: break children roll fresh terrain deposits; DEPOSIT_CHANCE=0 creates none', async (t) => {
  const { core } = await makeCore(t, { config: { depositChance: 1, planetSeed: 424242, bots: 0 } });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  const label = mineableLabels(core)[0];
  const results = contest(core, a.token, b.token, label, 8);
  assert.equal(results[7].broke, true);
  for (const [childLabel] of results[7].children) {
    const terrain = terrainFor(core, childLabel);
    const cell = core.getLeafMap().get(childLabel);
    if (terrain.biome.mineable) assert.ok(cell.resourceId, `${childLabel} rolls a fresh deposit`);
    else assert.equal(cell.resourceId, null, `${childLabel} is ocean -> no deposit`);
    assert.equal(cell.resourceFound, false);
    assert.equal(core.getLeaves().find(([l]) => l === childLabel)[3], null, 'child deposit stays hidden');
  }
  // DEPOSIT_CHANCE=0: no deposits even on land.
  const { core: empty } = await makeCore(t, { config: { depositChance: 0, planetSeed: 424242, bots: 0 } });
  for (const [leafLabel] of empty.getLeaves()) {
    assert.equal(empty.getLeafMap().get(leafLabel).resourceId, null);
  }
  const human = empty.join({ tag: 'HUMAN' });
  const land = mineableLabels(empty)[0];
  const res = empty.click({ token: human.token, label: land });
  assert.equal(res.ok, true);
  assert.equal(res.resource, undefined);
  assert.equal(empty.getState().players[0].ores, 0);
});

test('mining: DEPOSIT_CHANCE override applies only to mineable biomes', async (t) => {
  const { core } = await makeCore(t, { config: { depositChance: 1, planetSeed: 424242, bots: 0 } });
  assert.equal(mineableLabels(core).length, 20 - oceanLabels(core).length);
  for (const label of mineableLabels(core)) {
    const resourceId = core.getLeafMap().get(label).resourceId;
    assert.ok(resourceId);
    assert.ok(Object.keys(terrainFor(core, label).biome.weights).includes(resourceId));
  }
  for (const label of oceanLabels(core)) assert.equal(core.getLeafMap().get(label).resourceId, null);
  // Unset override uses the biome geological chance (deterministic seed).
  const { core: terrain } = await makeCore(t, { config: { depositChance: null, planetSeed: 424242, bots: 0 } });
  assert.ok(terrain.getLeaves().some(([label]) => terrain.getLeafMap().get(label).resourceId));
  for (const label of oceanLabels(terrain)) assert.equal(terrain.getLeafMap().get(label).resourceId, null);
  // Shared planet helpers still expose the same weighted geology.
  assert.ok(Object.keys(BIOMES.mountain.weights).length > 0);
  assert.equal(weightedResourceForBiome(BIOMES.ocean, () => 0), null);
});

test('mining: discovered deposits + player ores persist across reload (backward compatible)', async (t) => {
  const dataDir = await tempDir(t);
  const config = { clickCooldownMs: 0, depositChance: 1, planetSeed: 424242, bots: 0 };
  const clock = makeClock();
  const core = new WorldCore({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  const a = core.join({ tag: 'ALPHA' });
  const label = mineableLabels(core)[0];
  forceFirstClickDeposits(core, [label]);
  const mined = core.click({ token: a.token, label });
  assert.ok(mined.resource);
  const value = mined.resource.value;
  await core.flush();
  const reloaded = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  assert.equal(reloaded.planetSeed, 424242);
  assert.equal(reloaded.getState().terrainVersion, PLANET_VERSION);
  assert.equal(reloaded.getState().players[0].ores, 1);
  assert.equal(reloaded.getState().players[0].oreValue, value);
  assert.deepEqual(
    reloaded.getLeaves().find(([l]) => l === label),
    [label, 0, 1, mined.resource.id, 0],
  );
  assert.equal(reloaded.getLeafMap().get(label).resourceFound, true);
  assert.equal(reloaded.getLeafMap().get(label).foundByIndex, 0);
  // Old world.json without resource fields / ores loads fine via terrain migration.
  const raw = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  const strip = (node) => {
    delete node.resourceId;
    delete node.resourceFound;
    delete node.foundByIndex;
    if (node.children) node.children.forEach(strip);
  };
  raw.tree.forEach(strip);
  delete raw.planetSeed;
  delete raw.terrainVersion;
  for (const player of raw.players) {
    delete player.ores;
    delete player.oreValue;
  }
  await writeFile(path.join(dataDir, 'world.json'), JSON.stringify(raw), 'utf8');
  const old = await WorldCore.open({
    dataDir,
    config: { ...config, depositChance: 0 },
    now: clock.now,
    autoSave: false,
    quiet: true,
  });
  assert.equal(old.planetSeed, 424242, 'config seed pins the migrated planet');
  assert.equal(old.getState().players[0].ores, 0);
  for (const [oldLabel] of old.getLeaves()) {
    assert.equal(old.getLeafMap().get(oldLabel).resourceId, null, 'override 0 migration leaves no deposits');
  }
  assert.equal(old.getState().terrainVersion, PLANET_VERSION);
});

test('mining: robot mines through the normal click path', async (t) => {
  const { core, clock } = await makeCore(t, {
    rng: mulberry32(0xbeef),
    config: {
      bots: 1,
      depositChance: 1,
      planetSeed: 424242,
      clickCooldownMs: 0,
      botGapMinMs: 10,
      botGapMaxMs: 10,
      botMinMs: 5000,
      botMaxMs: 5000,
      botClickMinMs: 50,
      botClickMaxMs: 50,
    },
  });
  forceFirstClickDeposits(core);
  core.tick(clock.now()); // spawn immediately
  clock.advance(1000);
  core.tick(clock.now()); // several robot clicks
  const robot = core.getState().players.find((player) => player.online);
  assert.ok(robot, 'robot is online');
  assert.ok(robot.clicks > 0, 'robot clicked');
  assert.ok(robot.ores >= 1, 'robot mined at least one deposit through click()');
  assert.ok(robot.oreValue >= 90);
});

test('migration: legacy world without planetSeed re-rolls hidden deposits, keeps found ore and players', async (t) => {
  const dataDir = await tempDir(t);
  const clock = makeClock();
  const seedConfig = { clickCooldownMs: 0, depositChance: 1, planetSeed: 111, bots: 0 };
  const seed = new WorldCore({ dataDir, config: seedConfig, now: clock.now, autoSave: false, quiet: true });
  const a = seed.join({ tag: 'ALPHA' });
  const foundLabel = mineableLabels(seed)[0];
  forceFirstClickDeposits(seed, [foundLabel]);
  const foundResource = seed.click({ token: a.token, label: foundLabel }).resource;
  const foundValue = foundResource.value;
  const score = seed.getState().players[0].score;
  await seed.flush();
  const raw = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  // Simulate a pre-planet world: no seed/version, and only the discovered
  // deposit fields remain explicit (hidden deposits are unknown to old files).
  delete raw.planetSeed;
  delete raw.terrainVersion;
  const stripHidden = (node) => {
    if (!node.resourceFound) {
      delete node.resourceId;
      delete node.resourceFound;
      delete node.foundByIndex;
    }
    if (node.children) node.children.forEach(stripHidden);
  };
  raw.tree.forEach(stripHidden);
  await writeFile(path.join(dataDir, 'world.json'), JSON.stringify(raw), 'utf8');

  const migrationConfig = { clickCooldownMs: 0, depositChance: 1, planetSeed: 777, bots: 0 };
  const migrated = await WorldCore.open({ dataDir, config: migrationConfig, now: clock.now, autoSave: false, quiet: true });
  assert.equal(migrated.planetSeed, 777, 'migration assigns the configured/random seed');
  assert.equal(migrated.getState().terrainVersion, PLANET_VERSION);
  // Found deposits and all player data are preserved.
  assert.deepEqual(
    migrated.getLeaves().find(([l]) => l === foundLabel),
    [foundLabel, 0, 1, foundResource.id, 0],
  );
  assert.equal(migrated.getLeafMap().get(foundLabel).resourceFound, true);
  assert.equal(migrated.getState().players[0].score, score);
  assert.equal(migrated.getState().players[0].ores, 1);
  assert.equal(migrated.getState().players[0].oreValue, foundValue);
  // Hidden deposits are re-rolled from the new terrain for active leaves only:
  // land gets deposits with override 1, ocean never does.
  for (const label of mineableLabels(migrated)) {
    if (label === foundLabel) continue;
    assert.ok(migrated.getLeafMap().get(label).resourceId, `${label} re-rolled from terrain`);
  }
  for (const label of oceanLabels(migrated)) {
    assert.equal(migrated.getLeafMap().get(label).resourceId, null, `${label} ocean has no surface deposit`);
  }
  assert.equal(migrated.getLeafMap().get(foundLabel).resourceId, foundResource.id);
  // Persisted: seed/version + re-rolled fields, so a reload (different chance)
  // does not re-roll again.
  await migrated.flush();
  const persisted = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  assert.equal(persisted.planetSeed, 777);
  assert.equal(persisted.terrainVersion, PLANET_VERSION);
  const reloaded = await WorldCore.open({
    dataDir,
    config: { clickCooldownMs: 0, depositChance: 0, planetSeed: 999, bots: 0 },
    now: clock.now,
    autoSave: false,
    quiet: true,
  });
  assert.equal(reloaded.planetSeed, 777, 'persisted seed wins over config on reload');
  for (const label of mineableLabels(reloaded)) {
    if (label === foundLabel) continue;
    const cell = reloaded.getLeafMap().get(label);
    assert.ok(cell.resourceId, `${label} keeps its migrated hidden deposit`);
  }
  assert.deepEqual(
    reloaded.getLeaves().find(([l]) => l === foundLabel),
    [foundLabel, 0, 1, foundResource.id, 0],
  );
});
test('robot callsigns are varied, creative and valid', async (t) => {
  const rng = mulberry32(0xc0ffee);
  const { core } = await makeCore(t, { rng });
  const names = [];
  for (let i = 0; i < 80; i += 1) {
    const tag = core._robotCallsign();
    names.push(tag);
    // Register the name so subsequent calls cannot duplicate it.
    core.players.push({ tag });
  }
  assert.equal(new Set(names).size, names.length, 'callsigns unique');
  for (const tag of names) {
    assert.match(tag, /^[A-Z0-9_-]{2,12}$/, `valid callsign: ${tag}`);
    assert.ok(tag.length <= 12);
  }
  const poetic = names.filter((n) => n.includes('_') && !n.startsWith('0X')).length;
  const hex = names.filter((n) => n.startsWith('0X')).length;
  const numbered = names.filter((n) => /\d/.test(n) && !n.startsWith('0X')).length;
  const bare = names.filter((n) => !n.includes('_') && !/\d/.test(n)).length;
  assert.ok(poetic >= 8, `poetic role names: ${poetic}`);
  assert.ok(hex >= 3, `hex handles: ${hex}`);
  assert.ok(numbered >= 6, `numbered handles: ${numbered}`);
  assert.ok(bare >= 1, `single-word frontier names: ${bare}`);
  // Not just the old four-letter-prefix + number generator.
  const oldStyle = names.filter((n) => /^[A-Z]{4,5}\d{1,2}$/.test(n)).length;
  assert.ok(oldStyle < names.length * 0.5, `old-style names not dominant (${oldStyle}/${names.length})`);
  assert.ok(names.some((n) => n.includes('SAINT') || n.includes('GHOST') || n.includes('MONK') || n.includes('PROPHET') || n.includes('WITCH')));
});

test('inventory: oreCounts tracks each resource id, persists, migrates and sanitizes', async (t) => {
  const dataDir = await tempDir(t);
  const clock = makeClock();
  const config = { clickCooldownMs: 0, depositChance: 1, planetSeed: 424242, bots: 0 };
  const core = new WorldCore({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  const a = core.join({ tag: 'ALPHA' });

  // Find two mineable cells with different hidden resource ids.
  let first = null;
  let second = null;
  for (const [label] of core.getLeaves()) {
    const terrain = terrainAt(core.planetSeed, core.getLeafMap().get(label).centroid);
    if (!terrain.biome.mineable) continue;
    const id = core.getLeafMap().get(label).resourceId;
    if (!first) first = { label, id };
    else if (id !== first.id) {
      second = { label, id };
      break;
    }
  }
  assert.ok(first && second, 'two distinct resource types available on this planet');
  forceFirstClickDeposits(core, [first.label, second.label]);
  const r1 = core.click({ token: a.token, label: first.label });
  const r2 = core.click({ token: a.token, label: second.label });
  assert.equal(r1.resource.id, first.id);
  assert.equal(r2.resource.id, second.id);

  let state = core.getState();
  const player = state.players[0];
  assert.deepEqual(Object.keys(player).sort(), [
    'breaks', 'claims', 'clicks', 'color', 'facesHeld', 'id', 'online',
    'oreCounts', 'oreValue', 'ores', 'score', 'steals', 'tag',
  ]);
  const expectedCounts = { [first.id]: 1 };
  expectedCounts[second.id] = (expectedCounts[second.id] || 0) + 1;
  assert.deepEqual(player.oreCounts, expectedCounts, 'two different ores count separately');
  assert.equal(player.ores, 2);
  assert.equal(player.oreValue, r1.resource.value + r2.resource.value);
  // Join response state also carries the inventory.
  const rejoin = core.join({ tag: 'ALPHA', token: a.token });
  assert.deepEqual(rejoin.state.players[0].oreCounts, expectedCounts);

  // Rejected clicks never increment inventory.
  clock.advance(0); // cooldown 0 -> own-cell lock on an already-clicked cell
  const locked = core.click({ token: a.token, label: first.label });
  assert.equal(locked.error, 'OWN_CELL_LOCKED');
  assert.deepEqual(core.getState().players[0].oreCounts, expectedCounts);

  // Persistence: oreCounts survives reload.
  await core.flush();
  const reloaded = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  assert.deepEqual(reloaded.getState().players[0].oreCounts, expectedCounts);
  assert.equal(reloaded.getState().players[0].ores, 2);

  // Old player entries without oreCounts migrate to {}, corrupt values sanitize.
  const raw = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  delete raw.players[0].oreCounts;
  raw.players.push({
    id: 'p_corrupt',
    tag: 'CORRUPT',
    color: '#00f0ff',
    token: '00000000-0000-4000-8000-000000000123',
    score: 5,
    clicks: 0,
    breaks: 0,
    claims: 0,
    steals: 0,
    ores: 3,
    oreValue: 100,
    oreCounts: { silver: 2, not_a_resource: 9, gold: -1, uranium: 'x', neutronium: 1.9 },
    createdAt: clock.now(),
    updatedAt: clock.now(),
  });
  await writeFile(path.join(dataDir, 'world.json'), JSON.stringify(raw), 'utf8');
  const migrated = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  const players = migrated.getState().players;
  assert.deepEqual(players[0].oreCounts, {}, 'missing inventory migrates to an empty object');
  assert.deepEqual(players[1].oreCounts, { silver: 2, neutronium: 1 }, 'unknown/negative/non-numeric entries are dropped');
  assert.ok(players[1].oreCounts.silver === 2);
});

// ------------------------------------------------------- planets / meteor API

test('planets: adoptPlayer, resetGrid, hiddenDepositCount and meteor transition', async (t) => {
  const { core } = await makeCore(t, { config: { bots: 0, depositChance: 1, planetSeed: 424242, clickCooldownMs: 0 } });
  const hiddenBefore = core.hiddenDepositCount();
  assert.ok(hiddenBefore > 0, 'depth-2 planet starts with hidden deposits');
  assert.equal(core.maybeMeteor(), null, 'no meteor while deposits remain (and never at boot)');

  const adopted = core.adoptPlayer({
    tag: 'PILOT',
    token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    color: '#123456',
    score: 777,
    ores: 6,
    oreValue: 1230,
    oreCounts: { uranium: 2, silver: 4 },
    id: 'p_carried',
  });
  assert.equal(adopted.ok, true);
  assert.deepEqual(adopted.player, { id: 'p_carried', tag: 'PILOT', color: '#123456' });
  assert.equal(adopted.token, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  const carried = core.getState().players.find((player) => player.id === 'p_carried');
  assert.equal(carried.score, 777, 'carried score');
  assert.deepEqual(carried.oreCounts, { uranium: 2, silver: 4 }, 'ore inventory is carried, not reset');
  assert.equal(carried.ores, 6);
  assert.equal(carried.oreValue, 1230);
  assert.equal(carried.online, true);
  const conflicted = core.adoptPlayer({ tag: 'PILOT', color: '#654321', score: 5 });
  assert.match(conflicted.player.tag, /^PILOT_2$/, 'tag conflicts get a suffix');

  // resetGrid: fresh 20-leaf grid, same players/scores/ores, new seed.
  const pilot = core.players.find((player) => player.tag === 'PILOT');
  pilot.ores = 4;
  pilot.oreValue = 360;
  pilot.oreCounts = { silver: 4 };
  core.resetGrid({ newSeed: 999 });
  assert.equal(core.planetSeed, 999);
  assert.equal(core.getLeaves().length, 20);
  assert.ok(core.getLeaves().every(([, owner, clicks]) => owner === -1 && clicks === 0));
  assert.equal(core.players.length, 2);
  assert.equal(pilot.score, 777);
  assert.equal(pilot.ores, 4);
  assert.deepEqual(pilot.oreCounts, { silver: 4 });
  assert.equal(pilot.facesHeld, 0);
  assert.equal(core.hiddenDepositCount() > 0, true, 'fresh grid rolls fresh hidden deposits');

  // Mine every hidden deposit, then maybeMeteor fires once and resets.
  forceFirstClickDeposits(core);
  const token = pilot.token;
  for (let guard = 0; guard < 100 && core.hiddenDepositCount() > 0; guard += 1) {
    const cell = [...core.getLeafMap().values()].find((entry) => entry.resourceId && !entry.resourceFound);
    assert.ok(cell);
    assert.equal(core.click({ token, label: cell.label }).ok, true);
  }
  assert.equal(core.hiddenDepositCount(), 0);
  const meteor = core.maybeMeteor();
  assert.ok(meteor && meteor.triggered);
  assert.equal(meteor.event.type, 'incident');
  assert.ok(['meteor', 'nuclear', 'solar', 'alien'].includes(meteor.event.kind));
  assert.ok(meteor.event.title);
  assert.match(meteor.event.message, /NEW RESOURCES|NEW DEPOSITS|RESEEDED/);
  assert.equal(core.getLeaves().length, 20);
  assert.equal(core.planetSeed === 999, false, 'new planet seed after the impact');
  assert.equal(core.players.length, 2, 'players survive the meteor');
  assert.equal(core.maybeMeteor(), null, 'no second meteor until new deposits are mined');
  assert.ok(core.hiddenDepositCount() > 0, 'new deposits armed on the reset grid');
});

// ------------------------------------------- carry inventory + discovery click

test('escape carry: adoptPlayer preserves the whole ore inventory (usable for the next mission)', async (t) => {
  const config = { bots: 0, depositChance: 0, planetSeed: 424242 };
  const { core } = await makeCore(t, { config });
  const a = core.join({ tag: 'PILOT' });
  const pilot = core.findByToken(a.token);
  const destinationMission = missionForPlanet(1, config.planetSeed);
  const missionCounts = oreCountsForMission(destinationMission);
  pilot.score = 900;
  pilot.ores = 18;
  pilot.oreValue = 3720;
  pilot.oreCounts = { ...missionCounts };
  core.setOnline(pilot.id, false); // ghost on the old planet keeps its inventory

  const next = await makeCore(t, { config });
  const adopted = next.core.adoptPlayer({
    tag: pilot.tag,
    token: pilot.token,
    color: pilot.color,
    score: pilot.score,
    ores: pilot.ores,
    oreValue: pilot.oreValue,
    oreCounts: pilot.oreCounts,
    id: pilot.id,
  });
  assert.equal(adopted.ok, true);
  const carried = next.core.getState().players[0];
  assert.equal(carried.id, pilot.id);
  assert.equal(carried.tag, 'PILOT');
  assert.equal(carried.score, 900);
  assert.deepEqual(carried.oreCounts, missionCounts, 'all ore carried');
  assert.equal(carried.ores, 18);
  assert.equal(carried.oreValue, 3720);
  // The carried inventory already satisfies the NEXT planet's refit mission.
  assert.equal(planetDepth(1), 3);
  assert.equal(planetName(1), 'TATOOINE');
  assert.equal(missionProgress(carried.oreCounts, destinationMission).ready, true, 'carried ore usable immediately');
  // The old planet's ghost keeps its own copy.
  const ghost = core.getState().players[0];
  assert.deepEqual(ghost.oreCounts, missionCounts);
  assert.equal(ghost.online, false);
});

test('discovery timing: random resourceFindClick in [1..breakClicks], hidden and per-cell', async (t) => {
  const { core } = await makeCore(t, { rng: mulberry32(0xd15c), config: { bots: 0, depositChance: 1, planetSeed: 424242 } });
  const hiddenCells = [...core.getLeafMap().values()].filter((cell) => cell.resourceId && !cell.resourceFound);
  assert.ok(hiddenCells.length > 3);
  const findClicks = new Set();
  for (const cell of hiddenCells) {
    assert.ok(Number.isInteger(cell.resourceFindClick), 'every deposit has a discovery click');
    assert.ok(cell.resourceFindClick >= 1 && cell.resourceFindClick <= core.config.breakClicks, 'findClick within threshold');
    findClicks.add(cell.resourceFindClick);
  }
  assert.ok(findClicks.size > 1, 'discovery click is random per cell, not always the first click');
  assert.ok(Math.max(...findClicks) > 1, 'some deposits need more than one click');
  // Never leaks on the wire (Leaf stays a 5-tuple without findClick).
  const wire = JSON.stringify({ leaves: core.getLeaves(), state: core.getState() });
  assert.equal(wire.includes('resourceFindClick'), false, 'discovery click is server-only');
  for (const leaf of core.getLeaves()) assert.equal(leaf.length, 5);
});

test('discovery timing: a deposit can require middle clicks; rejected clicks never advance it', async (t) => {
  const { core, clock } = await makeCore(t, { config: { bots: 0, depositChance: 1, planetSeed: 424242, clickCooldownMs: 40 } });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  const label = mineableLabels(core)[0];
  const cell = core.getLeafMap().get(label);
  const resourceId = cell.resourceId;
  cell.resourceFindClick = 4; // middle click for threshold 8

  assert.equal(core.click({ token: a.token, label }).resource, undefined); // click 1
  assert.equal(core.click({ token: a.token, label }).error, 'COOLDOWN'); // rejected: no click advance
  assert.equal(core.getLeafMap().get(label).clicks, 1, 'rejected click did not advance charge');
  clock.advance(41);
  assert.equal(core.click({ token: b.token, label }).resource, undefined); // click 2
  // Own-cell lock rejection must not advance charge either.
  clock.advance(41);
  assert.equal(core.click({ token: b.token, label }).error, 'OWN_CELL_LOCKED');
  assert.equal(core.getLeafMap().get(label).clicks, 2);
  clock.advance(41);
  assert.equal(core.click({ token: a.token, label }).resource, undefined); // click 3
  clock.advance(41);
  const mined = core.click({ token: b.token, label }); // click 4 -> discovery
  assert.equal(mined.ok, true);
  assert.equal(mined.resource.id, resourceId, 'deposit mined on the 4th successful click');
  assert.equal(mined.broke, false);
  const owner = core.getState().players.find((player) => player.id === b.player.id);
  assert.equal(owner.ores, 1);
});

test('discovery timing: last-click (break) discovery, break children get their own findClick', async (t) => {
  const { core } = await makeCore(t, { config: { bots: 0, depositChance: 1, planetSeed: 424242 } });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  const label = mineableLabels(core)[0];
  const cell = core.getLeafMap().get(label);
  const resourceId = cell.resourceId;
  cell.resourceFindClick = core.config.breakClicks; // only mined on the breaking click
  const results = contest(core, a.token, b.token, label, core.config.breakClicks);
  for (let i = 0; i < results.length - 1; i += 1) {
    assert.equal(results[i].resource, undefined, `click ${i + 1} before discovery click`);
  }
  const breaking = results[results.length - 1];
  assert.equal(breaking.broke, true);
  assert.equal(breaking.resource.id, resourceId, 'deposit mined on the last/break click');
  for (const [childLabel] of breaking.children) {
    const child = core.getLeafMap().get(childLabel);
    if (child && child.resourceId) {
      assert.ok(child.resourceFindClick >= 1 && child.resourceFindClick <= core.config.breakClicks, 'fresh child findClick');
    }
  }
  const miner = core.getState().players.find((player) => player.ores > 0);
  assert.ok(miner, 'breaker mined the last-click deposit');
  assert.equal(miner.ores, 1);
});

test('discovery timing: old deposits without resourceFindClick migrate to a random click and persist', async (t) => {
  const dataDir = await tempDir(t);
  const config = { bots: 0, depositChance: 1, planetSeed: 424242, clickCooldownMs: 0, saveDebounceMs: 10 };
  const clock = makeClock();
  const core = new WorldCore({ dataDir, config, now: clock.now, autoSave: false, quiet: true });
  core.join({ tag: 'ALPHA' });
  await core.flush();
  const raw = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  const strip = (node) => {
    delete node.resourceFindClick; // simulate a pre-findClick world
    if (node.children) node.children.forEach(strip);
  };
  raw.tree.forEach(strip);
  await writeFile(path.join(dataDir, 'world.json'), JSON.stringify(raw), 'utf8');

  const reloaded = await WorldCore.open({ dataDir, config, now: clock.now, autoSave: false, quiet: true, rng: mulberry32(0xabc) });
  const cells = [...reloaded.getLeafMap().values()].filter((cell) => cell.resourceId);
  assert.ok(cells.length > 0);
  const breakClicks = reloaded.config.breakClicks;
  for (const cell of cells) assert.ok(cell.resourceFindClick >= 1 && cell.resourceFindClick <= breakClicks);
  await reloaded.flush();
  const persisted = JSON.parse(await readFile(path.join(dataDir, 'world.json'), 'utf8'));
  const persistedFind = [];
  const walk = (node) => {
    if (node.resourceId) persistedFind.push(node.resourceFindClick);
    if (node.children) node.children.forEach(walk);
  };
  persisted.tree.forEach(walk);
  assert.ok(persistedFind.length > 0);
  for (const find of persistedFind) assert.ok(Number.isInteger(find) && find >= 1 && find <= breakClicks);
  // Guaranteed mission deposits also receive a discovery click.
  reloaded.resetGrid({ mission: missionForPlanet(0) });
  const guaranteed = [...reloaded.getLeafMap().values()].filter((cell) => cell.resourceId && !cell.resourceFound);
  assert.ok(guaranteed.length > 0);
  for (const cell of guaranteed) assert.ok(cell.resourceFindClick >= 1 && cell.resourceFindClick <= reloaded.config.breakClicks);
});
