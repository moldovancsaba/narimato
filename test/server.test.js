/**
 * NARIMATO — INFINITE GRID server HTTP/SSE integration tests.
 *
 * Starts the real server on ephemeral ports with a throwaway DATA_DIR. Covers
 * SPEC_INFINITE §2: join/409s, click action (claim/reinforce, break via SSE),
 * state/world/leaderboard/health shapes, no round/timer fields, static serving
 * + traversal safety, body caps, 404s, and full persistence across a restart.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

import { startServer, MAX_BODY_BYTES } from '../server.js';
import { WorldCore, POSE_STATES, STEP_RAD, ROUTE_MAX_ARC, SUPPLY_MIN_SEPARATION_RAD } from '../lib/world-core.js';
import {
  robotTargetForOnlineHumans,
  randomEscapeDestination,
  SUPPLY_MIN_AGE_MS,
  SUPPLY_MESSAGE,
} from '../lib/planet-manager.js';
import { PLANET_VERSION, terrainAt } from '../public/js/shared/planet.js';
import { missionForPlanet, missionProgress, planetDepth, planetName } from '../public/js/shared/mission.js';

const PACKAGE_VERSION = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Flat ore inventory that exactly satisfies a generated mission. */
function oreCountsForMission(mission) {
  const counts = {};
  for (const objective of mission.objectives) {
    for (const item of objective.items) counts[item.resourceId] = (counts[item.resourceId] || 0) + item.need;
  }
  return counts;
}

/** Grant a pilot exactly enough ore for its current planet's generated mission. */
function grantMission(core, token, planetIndex = 0) {
  const mission = missionForPlanet(planetIndex, core.planetSeed);
  const pilot = core.findByToken(token);
  pilot.oreCounts = oreCountsForMission(mission);
  return mission;
}

async function makeServer(t, config = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'icosa-http-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { clickCooldownMs: 40, saveDebounceMs: 20, bots: 0, depositChance: 0, ...config },
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { handle, dataDir, base: `http://127.0.0.1:${handle.port}` };
}

/** Server with an injectable fake clock: deterministic pose rate limits and TTLs. */
async function makeClockServer(t, config = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'icosa-clock-'));
  const clock = {
    t: 1_700_000_000_000,
    now() {
      return this.t;
    },
    advance(ms) {
      this.t += ms;
      return this.t;
    },
  };
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    now: () => clock.t,
    config: { clickCooldownMs: 0, saveDebounceMs: 20, bots: 0, depositChance: 0, ...config },
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { handle, dataDir, base: `http://127.0.0.1:${handle.port}`, clock };
}

/** Place a robot on a known leaf and make that leaf its route target (SRV-03). */
function aimRobotAtLeaf(core, robot, label, now = Date.now()) {
  const cell = core.getLeafMap().get(label);
  core._applyRobotPose(robot, cell.centroid, null, 'idle', now);
  robot.route = {
    playerId: robot.playerId,
    seed: 1,
    serial: robot.serial,
    waypoints: [{ leaf: label, pos: { ...cell.centroid }, arriveAt: now }],
    index: 0,
    state: 'idle',
    stateSince: now,
    stateUntil: now + 1_000_000,
    intent: { kind: 'mine', leaf: label },
    replans: 0,
    plannedAt: now,
    lastTickAt: now,
  };
  robot.nextClickAt = now;
  return cell;
}

async function postJson(base, pathname, body) {
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error path */
  }
  return { status: res.status, json, headers: res.headers };
}

async function getJson(base, pathname) {
  const res = await fetch(`${base}${pathname}`);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function waitFor(fn, { timeout = 5000, interval = 20 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await delay(interval);
  }
  throw new Error(`waitFor timed out${lastError ? `: ${lastError.message}` : ''}`);
}

/** Minimal SSE client: collects parsed `data:` JSON payloads. */
async function openSse(base, token) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/events?token=${encodeURIComponent(token)}`, {
    headers: { accept: 'text/event-stream' },
    signal: controller.signal,
  });
  if (res.status !== 200) throw new Error(`unexpected SSE status ${res.status}`);
  const events = [];
  const decoder = new TextDecoder();
  let buffer = '';
  const reader = res.body.getReader();
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              events.push(JSON.parse(line.slice(6)));
            } catch {
              /* ignore malformed frames */
            }
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();
  await waitFor(() => (events.length > 0 ? true : null), { timeout: 3000 });
  return {
    res,
    events,
    waitForEvent(type, predicate = () => true, { timeout = 5000, from = 0 } = {}) {
      return waitFor(
        () => {
          for (let i = from; i < events.length; i += 1) {
            if (events[i].type === type && predicate(events[i])) return events[i];
          }
          return null;
        },
        { timeout, interval: 10 },
      );
    },
    async close() {
      controller.abort();
      await pump.catch(() => {});
    },
  };
}

/** Raw path request (bypasses fetch/URL path normalisation). */
function rawRequest(base, rawPath, method = 'GET') {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, path: rawPath, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Build a legacy (pre-multi-planet) DATA_DIR with a deep-ish tree + players. */
async function makeLegacyWorld(dir) {
  const clock = () => 1_700_000_000_000;
  const core = new WorldCore({
    dataDir: dir,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0, planetSeed: 424242 },
    now: clock,
    autoSave: false,
    quiet: true,
  });
  const a = core.join({ tag: 'ALPHA' });
  const b = core.join({ tag: 'BETA' });
  // Contest a base cell 8x to make a deeper tree (23 leaves), then give ALPHA a
  // score/ore CV that satisfies the escape mission.
  const tokens = [a.token, b.token];
  for (let i = 0; i < 8; i += 1) core.click({ token: tokens[i % 2], type: 'click', label: '3' });
  const alpha = core.players.find((player) => player.tag === 'ALPHA');
  const mission = missionForPlanet(0, core.planetSeed);
  const missionCounts = oreCountsForMission(mission);
  alpha.score = 500;
  alpha.ores = 2;
  alpha.oreValue = 180;
  alpha.oreCounts = { ...missionCounts };
  await core.flush();
  return { a, b, clock, mission, missionCounts };
}

// ---------------------------------------------------------------------- HTTP

test('HTTP: join, click flow, state/world/leaderboard/health, static safety and 404s', async (t) => {
  const { base } = await makeServer(t, { clickCooldownMs: 200 });

  // Health + empty world before anyone joins.
  let res = await getJson(base, '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.appVersion, PACKAGE_VERSION);
  assert.equal(res.json.playersOnline, 0);
  assert.equal(res.json.faces, 20);
  assert.equal(res.json.maxDepthReached, 0);
  assert.equal(res.json.totalClicks, 0);
  assert.equal(typeof res.json.uptimeMs, 'number');
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');

  res = await getJson(base, '/api/state');
  assert.equal(res.status, 200);
  const state = res.json.state;
  assert.deepEqual(Object.keys(state).sort(), [
    'arcade',
    'createdAt',
    'faces',
    'humansOnline',
    'maxDepth',
    'maxDepthReached',
    'planetDepth',
    'planetIndex',
    'planetLevels',
    'planetName',
    'planetSeed',
    'planetSource',
    'players',
    'resources',
    'serverTime',
    'terrainVersion',
    'threshold',
    'totalBreaks',
    'totalClicks',
  ]);
  assert.equal(state.faces, 20);
  assert.equal(state.threshold, 4, 'planet 0 is the tutorial: breaks at 4');
  assert.equal(state.maxDepth, 1, 'planet 0 has 2 levels (20 + 80): one break generation');
  assert.equal(state.planetIndex, 0);
  assert.equal(state.planetDepth, 2);
  assert.equal(state.planetLevels, 2);
  assert.equal(state.planetName, planetName(0));
  assert.equal('leaves' in res.json, false, '/api/state must not ship leaves');
  assert.equal('phase' in state, false);
  assert.equal('roundNumber' in state, false);

  res = await getJson(base, '/api/world');
  assert.equal(res.status, 200);
  assert.equal(res.json.leaves.length, 20);
  assert.deepEqual(res.json.leaves[0], ['1', -1, 0, null, -1]);
  assert.equal(res.json.state.faces, 20);

  res = await getJson(base, '/api/leaderboard');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.leaderboard, []);

  // Join validation.
  res = await postJson(base, '/api/join', { tag: 'a' });
  assert.equal(res.status, 409);
  assert.equal(res.json.ok, false);
  assert.equal(res.json.error, 'INVALID_TAG');

  res = await postJson(base, '/api/join', { tag: 'neo' });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.match(res.json.token, /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(res.json.player).sort(), ['color', 'id', 'tag']);
  assert.equal(res.json.player.tag, 'NEO');
  assert.equal(res.json.leaves.length, 20);
  assert.equal(res.json.state.players.length, 1);
  assert.equal(res.json.state.players[0].online, true);
  const { token, player } = res.json;

  res = await postJson(base, '/api/join', { tag: 'NEO' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'TAG_IN_USE');
  const second = await postJson(base, '/api/join', { tag: 'TRINITY' });
  assert.equal(second.status, 200);

  // Landing state includes both players; owner indexes are their array indexes.
  res = await getJson(base, '/api/state');
  assert.equal(res.json.state.players.length, 2);
  assert.equal(res.json.state.players[0].tag, 'NEO');
  assert.equal(res.json.state.players[1].tag, 'TRINITY');

  // Click: claim.
  res = await postJson(base, '/api/action', { token, type: 'click', label: '9' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, {
    ok: true,
    label: '9',
    cell: ['9', 0, 1, null, 0],
    points: 10,
    kind: 'claim',
    score: 10,
    broke: false,
  });

  let world = (await getJson(base, '/api/world')).json;
  assert.deepEqual(world.leaves.find(([label]) => label === '9'), ['9', 0, 1, null, 0]);
  res = await getJson(base, '/api/state');
  assert.equal(res.json.state.totalClicks, 1);
  assert.equal(res.json.state.players[0].score, 10);
  assert.equal(res.json.state.players[0].facesHeld, 1);
  res = await getJson(base, '/api/health');
  assert.equal(res.json.totalClicks, 1);
  assert.equal(res.json.playersOnline, 2);
  res = await getJson(base, '/api/leaderboard');
  assert.equal(res.json.leaderboard.length, 2);
  assert.equal(res.json.leaderboard[0].tag, 'NEO');
  assert.equal(res.json.leaderboard[0].score, 10);

  // Own-cell lock: the owner cannot re-charge their own cell until contested.
  await delay(210); // clear the 200ms click cooldown first
  res = await postJson(base, '/api/action', { token, type: 'click', label: '9' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'OWN_CELL_LOCKED');
  res = await postJson(base, '/api/action', { token: second.json.token, type: 'click', label: '9' });
  assert.equal(res.status, 200);
  assert.equal(res.json.kind, 'steal');
  res = await postJson(base, '/api/action', { token, type: 'click', label: '9' });
  assert.equal(res.status, 200);
  assert.equal(res.json.kind, 'steal');

  // Click errors.
  res = await postJson(base, '/api/action', { token: 'nope', type: 'click', label: '9' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'NOT_JOINED');
  res = await postJson(base, '/api/action', { token, type: 'click', label: '1.5' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'INVALID_LABEL');
  res = await postJson(base, '/api/action', { token, type: 'click', label: '20.1' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'NOT_A_LEAF');
  res = await postJson(base, '/api/action', { token, type: 'click', label: '8' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'COOLDOWN');
  res = await postJson(base, '/api/action', { token, type: 'ping' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'INVALID_ACTION');

  // SSE requires a valid token.
  res = await getJson(base, '/api/events');
  assert.equal(res.status, 401);
  assert.equal(res.json.ok, false);
  res = await getJson(base, '/api/events?token=not-a-token');
  assert.equal(res.status, 401);

  // Methods.
  res = await getJson(base, '/api/join');
  assert.equal(res.status, 405);
  assert.equal(res.json.error, 'METHOD_NOT_ALLOWED');

  // Static serving: correct MIME + no-store, geometry module available.
  let staticRes = await fetch(`${base}/js/shared/geometry.js`);
  assert.equal(staticRes.status, 200);
  assert.match(staticRes.headers.get('content-type'), /^text\/javascript/);
  assert.equal(staticRes.headers.get('cache-control'), 'no-store');
  assert.match(await staticRes.text(), /export function buildMesh/);

  // Path traversal attempts are rejected and don't leak server files.
  for (const attempt of ['/../server.js', '/js/../../server.js', '/%2e%2e/server.js']) {
    const raw = await rawRequest(base, attempt);
    assert.equal(raw.status, 404, `${attempt} should 404`);
    assert.ok(!raw.body.includes('startServer'), `${attempt} must not leak server.js`);
  }

  // Unknown routes: JSON for /api/*, plain text otherwise; no /r share pages.
  res = await getJson(base, '/api/unknown');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.json.error, 'NOT_FOUND');
  res = await fetch(`${base}/definitely-missing.txt`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  res = await fetch(`${base}/r/anything`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /^text\/plain/);

  // Body cap + invalid JSON.
  res = await postJson(base, '/api/join', { tag: 'X'.repeat(MAX_BODY_BYTES + 100) });
  assert.equal(res.status, 413);
  assert.equal(res.json.error, 'PAYLOAD_TOO_LARGE');
  res = await postJson(base, '/api/join', '{not json');
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'INVALID_JSON');
});

// --------------------------------------------------------------- SSE + world

test('SSE + break: snapshot/cell/break/state frames, isolated split, no round events', async (t) => {
  const { base } = await makeServer(t, { clickCooldownMs: 5, saveDebounceMs: 10 });
  const aJoin = await postJson(base, '/api/join', { tag: 'ALPHA' });
  const bJoin = await postJson(base, '/api/join', { tag: 'BETA' });
  assert.equal(aJoin.status, 200);
  assert.equal(bJoin.status, 200);
  const aToken = aJoin.json.token;
  const bToken = bJoin.json.token;
  const bId = bJoin.json.player.id;
  const bIndex = 1;

  const sse = await openSse(base, aToken);
  t.after(async () => {
    await sse.close();
  });

  const snapshot = await sse.waitForEvent('snapshot');
  assert.equal(snapshot.state.faces, 20);
  assert.equal(snapshot.state.threshold, 4, 'first planet is the tutorial');
  assert.equal(snapshot.state.maxDepth, 1, 'first planet is 2 levels (20+80)');
  assert.equal(snapshot.state.players.length, 2);
  assert.equal(snapshot.leaves.length, 20);
  assert.deepEqual(snapshot.leaves[0], ['1', -1, 0, null, -1]);

  // The own-cell lock forces an alternating contest; the tutorial planet
  // breaks after 4 clicks, with the break landing on click 4.
  const aId = aJoin.json.player.id;
  const clickTokens = [bToken, aToken];
  const clicks = [];
  for (let i = 0; i < 4; i += 1) {
    const res = await postJson(base, '/api/action', { token: clickTokens[i % 2], type: 'click', label: '7' });
    assert.equal(res.status, 200, `click ${i + 1} should succeed (${clicks[i - 1]?.error || 'ok'})`);
    clicks.push(res.json);
    assert.equal(res.json.broke, i === 3, `break only on the 4th click (click ${i + 1})`);
    await delay(10);
  }
  assert.equal(clicks[0].kind, 'claim');
  assert.equal(clicks[0].points, 10);
  for (let i = 1; i < 3; i += 1) {
    assert.equal(clicks[i].kind, 'steal');
    assert.equal(clicks[i].points, 15);
  }
  assert.equal(clicks[3].kind, 'steal');
  assert.equal(clicks[3].points, 15 + 50);
  assert.deepEqual(clicks[3].cell, ['7', 0, 4, null, 0]);
  assert.deepEqual(
    clicks[3].children.map(([label]) => label),
    ['7.1', '7.2', '7.3', '7.4'],
  );

  // SSE: exactly the click cell frames + one break frame, no round/timer frames.
  const cellFrames = () =>
    sse.events.filter((event) => event.type === 'cell').slice(0, 4);
  await waitFor(() => (sse.events.filter((event) => event.type === 'cell').length >= 4 ? true : null), {
    timeout: 3000,
  });
  const cells = cellFrames();
  assert.deepEqual(cells.map((event) => event.kind), ['claim', 'steal', 'steal', 'steal']);
  assert.equal(cells[3].broke, true);
  assert.equal(cells[3].playerId, aId);
  assert.equal(cells[3].points, 15);

  const breakFrame = await sse.waitForEvent('break', () => true, { timeout: 3000 });
  assert.equal(breakFrame.label, '7');
  assert.equal(breakFrame.depth, 0);
  assert.equal(breakFrame.byPlayerId, aId);
  assert.equal(breakFrame.points, 50);
  assert.deepEqual(
    breakFrame.children.map(([label, owner, count]) => [label, owner, count]),
    [
      ['7.1', 0, 0],
      ['7.2', 0, 0],
      ['7.3', 0, 0],
      ['7.4', 0, 0],
    ],
  );

  // No round/lobby/surge frames exist in infinite mode.
  await delay(150);
  const seenTypes = new Set(sse.events.map((event) => event.type));
  for (const type of seenTypes) {
    assert.ok(['snapshot', 'state', 'cell', 'break', 'toast'].includes(type), `unexpected SSE frame: ${type}`);
  }
  assert.equal(seenTypes.has('phase'), false);
  assert.equal(seenTypes.has('roundStart'), false);
  assert.equal(seenTypes.has('surge'), false);

  // Periodic state frame reflects the break within ~1s.
  const stateFrame = await sse.waitForEvent('state', (event) => event.state.totalClicks >= 4, {
    timeout: 2500,
  });
  assert.equal(stateFrame.state.faces, 23);
  assert.equal(stateFrame.state.totalBreaks, 1);
  assert.equal(stateFrame.state.maxDepthReached, 1);
  assert.equal(stateFrame.state.players[0].breaks, 1);
  assert.equal(stateFrame.state.players[0].score, 80);
  assert.equal(stateFrame.state.players[1].score, 25);

  // World: exactly 4 children replaced one leaf; every other base cell untouched.
  const world = (await getJson(base, '/api/world')).json;
  assert.equal(world.state.faces, 23);
  assert.equal(world.leaves.length, 23);
  const byLabel = new Map(world.leaves.map(([label, owner, count]) => [label, [owner, count]]));
  assert.equal(byLabel.has('7'), false);
  for (const label of ['7.1', '7.2', '7.3', '7.4']) {
    assert.deepEqual(byLabel.get(label), [0, 0]);
  }
  for (let i = 1; i <= 20; i += 1) {
    const label = String(i);
    if (label === '7') continue;
    assert.deepEqual(byLabel.get(label), [-1, 0], `base cell ${label} must be untouched`);
  }
  const health = (await getJson(base, '/api/health')).json;
  assert.equal(health.faces, 23);
  assert.equal(health.maxDepthReached, 1);
  assert.equal(health.totalClicks, 4);
  assert.equal(health.playersOnline, 2);

  // Cross-player clicks: B contests A's inherited child (owner switch + stats).
  const steal = await postJson(base, '/api/action', { token: bToken, type: 'click', label: '7.2' });
  assert.equal(steal.status, 200);
  assert.equal(steal.json.kind, 'steal');
  assert.equal(steal.json.points, 15);
  assert.deepEqual(steal.json.cell, ['7.2', 1, 1, null, 1]);
  const afterSteal = (await getJson(base, '/api/state')).json.state;
  assert.equal(afterSteal.players[1].score, 40);
  assert.equal(afterSteal.players[1].facesHeld, 1);
  assert.equal(afterSteal.players[0].facesHeld, 3);
  const leaderboard = (await getJson(base, '/api/leaderboard')).json.leaderboard;
  assert.equal(leaderboard[0].tag, 'ALPHA');
  assert.equal(leaderboard[0].score, 80);
  assert.equal(leaderboard[0].breaks, 1);
});

// ------------------------------------------------------ persistence/restart

test('persistence: world, players, tokens and arcade survive a server restart', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'icosa-restart-'));
  t.after(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });
  const config = { clickCooldownMs: 5, saveDebounceMs: 10, bots: 0, depositChance: 0 };

  const first = await startServer({ port: 0, host: '127.0.0.1', dataDir, quiet: true, config });
  const firstBase = `http://127.0.0.1:${first.port}`;
  const a = await postJson(firstBase, '/api/join', { tag: 'ALPHA' });
  const b = await postJson(firstBase, '/api/join', { tag: 'BETA' });
  // Alternating contest (own-cell lock) breaks cell 15 on the tutorial 4th click.
  const contestTokens = [b.json.token, a.json.token];
  for (let i = 0; i < 4; i += 1) {
    const res = await postJson(firstBase, '/api/action', { token: contestTokens[i % 2], type: 'click', label: '15' });
    assert.equal(res.status, 200);
    await delay(8);
  }
  await postJson(firstBase, '/api/action', { token: a.json.token, type: 'click', label: '1' });
  const beforeWorld = (await getJson(firstBase, '/api/world')).json;
  const beforeBoard = (await getJson(firstBase, '/api/leaderboard')).json.leaderboard;
  assert.equal(beforeWorld.state.faces, 23);
  assert.equal(beforeWorld.state.totalClicks, 5);
  await first.close();

  // Reboot on the same DATA_DIR.
  const second = await startServer({ port: 0, host: '127.0.0.1', dataDir, quiet: true, config });
  const secondBase = `http://127.0.0.1:${second.port}`;
  try {
    const afterWorld = (await getJson(secondBase, '/api/world')).json;
    assert.deepEqual(afterWorld.leaves, beforeWorld.leaves, 'the whole adaptive tree is restored');
    assert.equal(afterWorld.state.faces, 23);
    assert.equal(afterWorld.state.totalClicks, 5);
    assert.equal(afterWorld.state.totalBreaks, 1);
    assert.equal(afterWorld.state.maxDepthReached, 1);
    assert.equal(afterWorld.state.players.length, 2);
    assert.equal(afterWorld.state.players[0].tag, 'ALPHA');
    assert.equal(afterWorld.state.players[1].tag, 'BETA');
    assert.equal(afterWorld.state.players[0].breaks, 1, 'A landed the breaking click');
    assert.equal(afterWorld.state.players[0].score, 90); // 80 contest + 10 for cell "1"
    assert.equal(afterWorld.state.players[1].score, 25);
    assert.deepEqual((await getJson(secondBase, '/api/leaderboard')).json.leaderboard, beforeBoard);

    // The persisted token reconnects to the same persistent player index.
    const reconnect = await postJson(secondBase, '/api/join', { tag: 'ALPHA', token: a.json.token });
    assert.equal(reconnect.status, 200);
    assert.equal(reconnect.json.player.id, a.json.player.id);
    const state = (await getJson(secondBase, '/api/state')).json.state;
    assert.equal(state.players[0].online, true);
    assert.equal(state.players[1].online, false, 'unconnected players boot offline');

    // Clicking a persisted child label works and keeps the owner index stable.
    const steal = await postJson(secondBase, '/api/action', {
      token: b.json.token,
      type: 'click',
      label: '15.3',
    });
    // B was offline; clicking with a valid token still works (HTTP auth) and
    // contests A's inherited child (children are locked for the breaker A).
    assert.equal(steal.status, 200);
    assert.equal(steal.json.kind, 'steal');
    assert.equal(steal.json.points, 15);
    assert.equal(steal.json.cell[1], 1);
    const finalWorld = (await getJson(secondBase, '/api/world')).json;
    assert.equal(finalWorld.state.faces, 23);
    const leaf153 = finalWorld.leaves.find(([label]) => label === '15.3');
    assert.deepEqual(leaf153, ['15.3', 1, 1, null, 1]);
  } finally {
    await second.close();
  }
});

// ------------------------------------------------------------- mining layer

test('HTTP/SSE mining: terrain deposits hidden, mineable cells mine once (5-slot leaves)', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 0, depositChance: 1, planetSeed: 424242 });
  const a = await postJson(base, '/api/join', { tag: 'ALPHA' });
  const b = await postJson(base, '/api/join', { tag: 'BETA' });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);

  let world = (await getJson(base, '/api/world')).json;
  let state = (await getJson(base, '/api/state')).json.state;
  assert.equal(state.planetSeed, 424242);
  assert.equal(state.terrainVersion, PLANET_VERSION);
  assert.equal(state.resources.length, 10);
  assert.equal(world.leaves.length, 20);
  // Hidden: Leaf[3] null everywhere; ocean cells have no hidden deposit at all.
  for (const leaf of world.leaves) assert.equal(leaf.length, 5), assert.equal(leaf[3], null);
  const terrainOf = (label) => {
    const leaf = world.leaves.find(([l]) => l === label);
    return terrainAt(state.planetSeed, { x: leaf === undefined ? 0 : 0, y: 0, z: 0 });
  };
  void terrainOf;
  // Pick a mineable leaf and an ocean leaf from the API world (centroids are not
  // shipped, so use the server's terrain through the shared function on the
  // known base mesh centroids).
  const { buildMesh } = await import('../public/js/shared/geometry.js');
  const baseFaces = buildMesh(0).faces;
  const labelTerrain = new Map(baseFaces.map((face) => [face.label, terrainAt(state.planetSeed, face.centroid)]));
  const mineableLabel = [...labelTerrain].find(([, terrain]) => terrain.biome.mineable)[0];
  const oceanLabel = [...labelTerrain].find(([, terrain]) => !terrain.biome.mineable)[0];
  assert.ok(mineableLabel && oceanLabel);
  const guaranteedCell = handle.manager.planetCore(0).getLeafMap().get(mineableLabel);
  guaranteedCell.resourceFindClick = 1;
  const expectedMineResourceId = guaranteedCell.resourceId;

  const sse = await openSse(base, a.json.token);
  t.after(async () => {
    await sse.close();
  });
  await sse.waitForEvent('snapshot');

  // Ocean: claim works, no ore, no resource frame.
  const oceanClick = await postJson(base, '/api/action', { token: b.json.token, type: 'click', label: oceanLabel });
  assert.equal(oceanClick.status, 200);
  assert.equal(oceanClick.json.kind, 'claim');
  assert.equal(oceanClick.json.resource, undefined);
  assert.equal(oceanClick.json.points, 10);
  assert.deepEqual(oceanClick.json.cell, [oceanLabel, 1, 1, null, 1]);
  await delay(60); // clear the click cooldown between B's two clicks

  // Mineable: mine once, value + biome resource id, immediate SSE frame.
  const click = await postJson(base, '/api/action', { token: b.json.token, type: 'click', label: mineableLabel });
  assert.equal(click.status, 200);
  const resource = click.json.resource;
  assert.ok(resource);
  assert.equal(resource.id, expectedMineResourceId, 'mined the cell\'s authoritative hidden deposit');
  assert.equal(click.json.points, 10 + resource.value);
  assert.deepEqual(click.json.cell, [mineableLabel, 1, 1, resource.id, 1]);
  world = (await getJson(base, '/api/world')).json;
  assert.deepEqual(
    world.leaves.find(([label]) => label === mineableLabel),
    [mineableLabel, 1, 1, resource.id, 1],
  );
  state = (await getJson(base, '/api/state')).json.state;
  assert.equal(state.players[1].ores, 1);
  assert.equal(state.players[1].oreValue, resource.value);
  assert.deepEqual(state.players[1].oreCounts, { [resource.id]: 1 }, 'state exposes per-resource inventory');
  const frame = await sse.waitForEvent('resource', () => true, { timeout: 3000 });
  assert.deepEqual(frame, {
    type: 'resource',
    label: mineableLabel,
    resource,
    playerId: b.json.player.id,
    points: resource.value,
  });
  // Only the mined deposit is revealed; no other hidden ids leak.
  assert.deepEqual(
    world.leaves.filter((leaf) => leaf[3] !== null).map(([label]) => label).sort(),
    [mineableLabel],
  );
  // Own-cell lock rejection mines nothing.
  await delay(60);
  const locked = await postJson(base, '/api/action', { token: b.json.token, type: 'click', label: mineableLabel });
  assert.equal(locked.status, 409);
  assert.equal(locked.json.error, 'OWN_CELL_LOCKED');
  assert.equal((await getJson(base, '/api/state')).json.state.players[1].ores, 1);
});

// ------------------------------------------------------- multi-planet server

test('multi-planet: first-boot migration preserves pilots, resets planet 0 grid to depth 2', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'icosa-mp-mig-'));
  const legacy = await makeLegacyWorld(dataDir);
  t.after(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const server1 = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0 },
  });
  const base1 = `http://127.0.0.1:${server1.port}`;
  try {
    const state = (await getJson(base1, '/api/state')).json.state;
    assert.equal(state.planetIndex, 0);
    assert.equal(state.planetDepth, 2);
    assert.equal(state.planetName, planetName(0));
    assert.equal(state.maxDepth, 1, 'first planet = 2 levels = 20+80');
    assert.equal(state.faces, 20, 'migration resets the old deep tree to a fresh 2-level grid');
    assert.equal(state.maxDepthReached, 0);
    assert.equal(state.players.length, 2, 'pilots are preserved');
    const alphaState = state.players.find((player) => player.tag === 'ALPHA');
    assert.equal(alphaState.score, 500);
    assert.equal(alphaState.ores, 2);
    assert.equal(alphaState.oreValue, 180);
    // Old token reconnects to the same preserved pilot.
    const rejoin = await postJson(base1, '/api/join', { tag: 'ALPHA', token: legacy.a.token });
    assert.equal(rejoin.status, 200);
    assert.equal(rejoin.json.player.id, legacy.a.player.id);
    assert.equal(rejoin.json.planetIndex, 0);
    // Registry was initialised with token -> planet 0.
    const registry = JSON.parse(await readFile(path.join(dataDir, 'planets', 'registry.json'), 'utf8'));
    assert.equal(registry.tokens[legacy.a.token], 0);

    // Escape: the destination is random among the next five planets.
    const escape = await postJson(base1, '/api/action', { token: legacy.a.token, type: 'escape' });
    assert.equal(escape.status, 200);
    assert.equal(escape.json.ok, true);
    const dest = escape.json.planetIndex;
    assert.ok(Number.isInteger(dest) && dest >= 1 && dest <= 5, `destination +1..+5, got ${dest}`);
    assert.equal(escape.json.planetDepth, planetDepth(dest));
    assert.equal(escape.json.planetLevels, planetDepth(dest));
    assert.equal(escape.json.planetName, planetName(dest));
    assert.ok(Array.isArray(escape.json.story.lines) && escape.json.story.lines.length >= 2);
    assert.equal(escape.json.player.id, legacy.a.player.id);
    assert.equal(escape.json.player.tag, 'ALPHA');
    const carried = escape.json.state.players.find((player) => player.id === escape.json.player.id);
    assert.equal(carried.score, 500, 'score is carried between planets');
    assert.deepEqual(carried.oreCounts, legacy.missionCounts, 'ore inventory is carried');
    assert.equal(carried.ores, 2);
    // The destination mission is generated from that planet's own seed.
    assert.deepEqual(escape.json.mission, missionForPlanet(dest, escape.json.state.planetSeed));
    assert.equal(escape.json.mission.objectives.length, 3);

    // Routing by token: pilot is on the random destination, the other stays on planet 0.
    const pilotView = (await getJson(base1, `/api/state?token=${legacy.a.token}`)).json.state;
    assert.equal(pilotView.planetIndex, dest);
    assert.equal(pilotView.planetDepth, planetDepth(dest));
    assert.equal(pilotView.planetLevels, planetDepth(dest));
    assert.equal(pilotView.planetName, planetName(dest));
    const observerView = (await getJson(base1, `/api/state?token=${legacy.b.token}`)).json.state;
    assert.equal(observerView.planetIndex, 0);
    const pilotWorld = (await getJson(base1, `/api/world?token=${legacy.a.token}`)).json;
    assert.equal(pilotWorld.state.planetIndex, dest);
    assert.equal(pilotWorld.leaves.length, 20);
    // The old clone is offline on planet 0.
    const planet0View = (await getJson(base1, '/api/state')).json.state;
    assert.equal(planet0View.players.find((player) => player.id === legacy.a.player.id).online, false);

    const leakBefore = escape.json.leaves;
    const destination = dest;
    await server1.close();

    // Reboot: planets + registry persist; no second migration/reset.
    const server2 = await startServer({
      port: 0,
      host: '127.0.0.1',
      dataDir,
      quiet: true,
      config: { bots: 0, depositChance: 0, clickCooldownMs: 0 },
    });
    const base2 = `http://127.0.0.1:${server2.port}`;
    try {
      const back = (await getJson(base2, `/api/state?token=${legacy.a.token}`)).json.state;
      assert.equal(back.planetIndex, destination);
      assert.equal(back.planetDepth, planetDepth(destination));
      assert.equal(back.planetName, planetName(destination));
      const worldBack = (await getJson(base2, `/api/world?token=${legacy.a.token}`)).json;
      assert.deepEqual(worldBack.leaves, leakBefore);
      const stillZero = (await getJson(base2, '/api/state')).json.state;
      assert.equal(stillZero.planetIndex, 0);
      assert.equal(stillZero.faces, 20);
    } finally {
      await server2.close();
    }
  } finally {
    if (server1.server.listening) await server1.close();
  }
});

test('multi-planet: meteor reset + rooms + escape routing', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 0, depositChance: 1, clickCooldownMs: 0, planetSeed: 424242 });
  const miner = await postJson(base, '/api/join', { tag: 'MINER1' });
  const observer = await postJson(base, '/api/join', { tag: 'OBSERV2' });
  assert.equal(miner.status, 200);
  assert.equal(observer.status, 200);
  const minerSse = await openSse(base, miner.json.token);
  const observerSse = await openSse(base, observer.json.token);
  t.after(async () => {
    await minerSse.close();
    await observerSse.close();
  });
  await minerSse.waitForEvent('snapshot');
  await observerSse.waitForEvent('snapshot');

  // No meteor at boot.
  assert.equal(minerSse.events.some((event) => event.type === 'incident' || event.type === 'meteor'), false);

  // Mine every hidden deposit on planet 0 (hidden labels via the server handle).
  const core0 = handle.manager.planetCore(0);
  const hidden = [];
  const seedBefore = core0.planetSeed;
  for (const cell of core0.getLeafMap().values()) {
    if (cell.resourceId && !cell.resourceFound) {
      cell.resourceFindClick = 1; // deterministic mining for the meteor test
      hidden.push(cell.label);
    }
  }
  assert.ok(hidden.length > 0);
  for (const label of hidden) {
    const res = await postJson(base, '/api/action', { token: miner.json.token, type: 'click', label });
    assert.equal(res.status, 200, `click ${label}`);
    // Incidents may now fire as soon as the refit is complete, before every
    // unrelated deposit is gone. Stop clicking stale labels once the server
    // has actually reseeded the planet.
    if (minerSse.events.some((event) => event.type === 'incident') || core0.planetSeed !== seedBefore) break;
  }
  const meteorMiner = await minerSse.waitForEvent('incident', (event) => event.type === 'incident', { timeout: 3000 });
  assert.equal(meteorMiner.planetIndex, 0);
  assert.ok(['meteor', 'nuclear', 'solar', 'alien'].includes(meteorMiner.kind));
  assert.match(meteorMiner.message, /NEW RESOURCES|NEW DEPOSITS|RESEEDED|MATERIALS/);
  assert.ok(typeof meteorMiner.description === 'string' && meteorMiner.description.length > 20);
  await observerSse.waitForEvent('incident', (event) => event.type === 'incident', { timeout: 3000 });
  const afterMeteor = (await getJson(base, '/api/world')).json;
  assert.notEqual(afterMeteor.state.planetSeed, seedBefore, 'meteor resamples the planet');
  assert.equal(afterMeteor.leaves.length, 20);
  assert.ok(afterMeteor.leaves.every((leaf) => leaf[1] === -1), 'grid reset clears ownership');
  assert.equal(afterMeteor.state.players.length, 2, 'players survive the meteor');

  // Grant the (new, post-incident) generated mission and escape MINER1.
  const minerPlayer = core0.findByToken(miner.json.token);
  minerPlayer.oreCounts = oreCountsForMission(missionForPlanet(0, core0.planetSeed));
  const escape = await postJson(base, '/api/action', { token: miner.json.token, type: 'escape' });
  assert.equal(escape.status, 200);
  const dest = escape.json.planetIndex;
  assert.ok(dest >= 1 && dest <= 5, `destination +1..+5, got ${dest}`);
  assert.equal(escape.json.planetName, planetName(dest));
  assert.equal(escape.json.planetDepth, planetDepth(dest));
  // The carried ore can already satisfy the destination refit; the first click
  // would then legitimately fire a meteor and reseed the grid while this test
  // asserts room isolation. Clear it so the isolation assertions observe the
  // click itself (mission/incident behaviour is covered by its own tests).
  handle.manager.planetCore(dest).findByToken(miner.json.token).oreCounts = {};
  // Old-room stream for the escaped token was closed by the server.
  await delay(80);
  const minerSse2 = await openSse(base, miner.json.token);
  t.after(async () => {
    await minerSse2.close();
  });
  const snap2 = await minerSse2.waitForEvent('snapshot');
  assert.equal(snap2.state.planetIndex, dest);
  assert.equal(snap2.state.planetDepth, planetDepth(dest));

  // A click on the destination planet is only broadcast to its room.
  const observerCellsBefore = observerSse.events.filter((event) => event.type === 'cell').length;
  const click = await postJson(base, '/api/action', { token: miner.json.token, type: 'click', label: '1' });
  assert.equal(click.status, 200);
  const cellFrame = await minerSse2.waitForEvent('cell', () => true, { timeout: 3000 });
  assert.equal(cellFrame.cell[0], '1');
  await delay(200);
  const observerCellsAfter = observerSse.events.filter((event) => event.type === 'cell').length;
  assert.equal(observerCellsAfter, observerCellsBefore, 'rooms are isolated');
  const planet0World = (await getJson(base, `/api/world?token=${observer.json.token}`)).json;
  assert.equal(planet0World.state.planetIndex, 0);
  assert.equal(planet0World.leaves.length, 20);
  const destWorld = (await getJson(base, `/api/world?token=${miner.json.token}`)).json;
  assert.equal(destWorld.state.planetIndex, dest);
  assert.equal(destWorld.leaves.find(([label]) => label === '1')[1], 0);
});


test('planet levels: first planet breaks exactly once (20 → 80) and stops', async (t) => {
  const { base } = await makeServer(t, { clickCooldownMs: 0, saveDebounceMs: 10 });
  const a = await postJson(base, '/api/join', { tag: 'BREAKA' });
  const b = await postJson(base, '/api/join', { tag: 'BREAKB' });
  const tokens = [a.json.token, b.json.token];
  // Alternate operators to satisfy the contest lock and break cell 1.
  for (let i = 0; i < 4; i += 1) {
    const res = await postJson(base, '/api/action', { token: tokens[i % 2], type: 'click', label: '1' });
    assert.equal(res.status, 200, `click ${i}`);
  }
  const world = (await getJson(base, '/api/world')).json;
  assert.equal(world.leaves.length, 23, 'one base cell broke into four: 20 + 3 = 23 leaves');
  assert.equal(world.leaves.filter((l) => l[0].startsWith('1.')).length, 4);
  // First planet is only 2 levels deep: children (D1) must not break again.
  const child = world.leaves.find((l) => l[0] === '1.1');
  for (let i = 0; i < 4; i += 1) {
    const res = await postJson(base, '/api/action', { token: tokens[i % 2], type: 'click', label: child[0] });
    assert.equal(res.status, 200, `child click ${i}`);
  }
  const world2 = (await getJson(base, '/api/world')).json;
  assert.equal(world2.leaves.length, 23, 'D1 children do not break on the 2-level first planet');
  assert.equal(world2.state.maxDepthReached, 1);
});

// ------------------------------------------------------- dynamic robot staffing

test('robot staffing: per-planet targets, immediate displacement/replacement, independence', async (t) => {
  assert.equal(robotTargetForOnlineHumans(0), 1);
  assert.equal(robotTargetForOnlineHumans(1), 2);
  assert.equal(robotTargetForOnlineHumans(2), 1);
  assert.equal(robotTargetForOnlineHumans(3), 0);
  assert.equal(robotTargetForOnlineHumans(4), 0);

  const { base, handle } = await makeServer(t, {
    bots: 1,
    depositChance: 0,
    clickCooldownMs: 0,
    planetSeed: 424242,
  });
  const manager = handle.manager;
  const delayForStaffing = () => delay(250);

  const a = await postJson(base, '/api/join', { tag: 'HUMAN_A' });
  const b = await postJson(base, '/api/join', { tag: 'HUMAN_B' });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  await delayForStaffing();
  const p0 = manager.planetCore(0);
  assert.equal(p0.onlineHumanCount(), 2);
  assert.equal(p0.robotInfos().length, 1, '2 humans -> 1 robot');

  // A third human displaces the robot immediately.
  const c = await postJson(base, '/api/join', { tag: 'HUMAN_C' });
  assert.equal(c.status, 200);
  await delayForStaffing();
  assert.equal(p0.onlineHumanCount(), 3);
  assert.equal(p0.robotInfos().length, 0, '3+ humans -> 0 robots');

  // A human leaving drops the scene below 3 -> replacement robot IMMEDIATELY.
  const cSse = await openSse(base, c.json.token);
  await cSse.close();
  await delayForStaffing();
  assert.equal(p0.onlineHumanCount(), 2);
  assert.equal(p0.robotInfos().length, 1, 'human leave -> robot spawned without a gap');

  // A escapes to a random destination: planet 0 loses a human (1 -> 2 robots)
  // while the destination (1 human) wants 2 robots — independent scenes.
  grantMission(p0, a.json.token, 0);
  const escA = await postJson(base, '/api/action', { token: a.json.token, type: 'escape' });
  assert.equal(escA.status, 200);
  const destA = escA.json.planetIndex;
  assert.ok(destA >= 1 && destA <= 5, `destination +1..+5, got ${destA}`);
  await delayForStaffing();
  const pDestA = manager.planetCore(destA);
  assert.equal(p0.onlineHumanCount(), 1);
  assert.equal(p0.robotInfos().length, 2, 'planet 0 re-staffed to 2 robots for 1 human');
  assert.equal(pDestA.onlineHumanCount(), 1);
  assert.equal(pDestA.robotInfos().length, 2, 'destination independently staffed to 2 robots for its 1 human');
  assert.equal(
    p0.robotInfos().some((robot) => pDestA.robotInfos().some((other) => other.playerId === robot.playerId)),
    false,
    'planets have separate robot scenes',
  );

  // B escapes too; planet 0 becomes empty (1 ambient robot); destination staffing
  // depends on whether B landed on the same or another planet.
  grantMission(p0, b.json.token, 0);
  const escB = await postJson(base, '/api/action', { token: b.json.token, type: 'escape' });
  assert.equal(escB.status, 200);
  const destB = escB.json.planetIndex;
  assert.ok(destB >= 1 && destB <= 5);
  await delayForStaffing();
  assert.equal(p0.onlineHumanCount(), 0);
  assert.equal(p0.robotInfos().length, 1, 'empty planet keeps exactly 1 ambient robot');
  if (destB === destA) {
    assert.equal(pDestA.onlineHumanCount(), 2);
    assert.equal(pDestA.robotInfos().length, 1, '2 humans on the destination -> 1 robot (excess displaced)');
  } else {
    const pDestB = manager.planetCore(destB);
    assert.equal(pDestA.onlineHumanCount(), 1);
    assert.equal(pDestA.robotInfos().length, 2);
    assert.equal(pDestB.onlineHumanCount(), 1);
    assert.equal(pDestB.robotInfos().length, 2);
  }

  // Robots are not counted as humans anywhere (wire players have no bot flag).
  assert.equal(p0.onlineHumanCount() + p0.robotInfos().length <= p0.players.length, true);
  const state0 = (await getJson(base, '/api/state')).json.state;
  assert.equal(state0.planetIndex, 0);
  assert.equal(state0.players.some((player) => Object.prototype.hasOwnProperty.call(player, 'bot')), false);
});

// ------------------------------------------- procedural missions/destinations

test('missions: escape destination is random among the next five planets (+1..+5)', () => {
  assert.equal(randomEscapeDestination(0, () => 0), 1);
  assert.equal(randomEscapeDestination(0, () => 0.1999), 1);
  assert.equal(randomEscapeDestination(0, () => 0.2), 2);
  assert.equal(randomEscapeDestination(0, () => 0.4), 3);
  assert.equal(randomEscapeDestination(0, () => 0.6), 4);
  assert.equal(randomEscapeDestination(0, () => 0.8), 5);
  assert.equal(randomEscapeDestination(0, () => 0.999999), 5);
  assert.equal(randomEscapeDestination(7, () => 0), 8);
  assert.equal(randomEscapeDestination(7, () => 0.999999), 12);
  for (const index of [0, 1, 5, 20]) {
    for (let i = 0; i < 20; i += 1) {
      const next = randomEscapeDestination(index, () => i / 20);
      assert.ok(next >= index + 1 && next <= index + 5, 'never backwards, at most +5');
    }
  }
});

test('missions: server-side missions follow each planet\'s seed and are completable', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 0, depositChance: 0, clickCooldownMs: 0, planetSeed: 424242 });
  const a = await postJson(base, '/api/join', { tag: 'MISSION1' });
  assert.equal(a.status, 200);
  const core0 = handle.manager.planetCore(0);
  const mission0 = missionForPlanet(0, core0.planetSeed);
  const state0 = (await getJson(base, '/api/state')).json.state;
  assert.equal(state0.planetSeed, core0.planetSeed);
  assert.equal(mission0.objectives.length, 3);
  const grant = await postJson(base, '/api/action', { token: a.json.token, type: 'click', label: '1' });
  assert.equal(grant.status, 200);
  const counts = oreCountsForMission(mission0);
  core0.findByToken(a.json.token).oreCounts = counts;
  assert.equal(missionProgress(counts, mission0).ready, true);
  const escape = await postJson(base, '/api/action', { token: a.json.token, type: 'escape' });
  assert.equal(escape.status, 200);
  assert.equal(escape.json.mission.planetIndex, escape.json.planetIndex);
  const destCore = handle.manager.planetCore(escape.json.planetIndex);
  assert.deepEqual(escape.json.mission, missionForPlanet(escape.json.planetIndex, destCore.planetSeed));
});

test('static: ASSET_BASE_URL rewrites the narration asset base meta tag', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'icosa-assetbase-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { bots: 0 },
    assetBaseUrl: 'https://cdn.example.com/narimato/',
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  const res = await fetch(`http://127.0.0.1:${handle.port}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<meta name="narimato-asset-base" content="https:\/\/cdn\.example\.com\/narimato" \/>/);
  await fetch(`http://127.0.0.1:${handle.port}/audio/voice/george/help-story__s1.m4a`);
});

// ------------------------------------------------------- surface presence

test('surface: pose and leave broadcasts reach every human in the planet room', async (t) => {
  const { base } = await makeServer(t, { bots: 0, planetSeed: 424242 });
  const joinA = await postJson(base, '/api/join', { tag: 'SURFA' });
  const joinB = await postJson(base, '/api/join', { tag: 'SURFB' });
  const tokenA = joinA.json.token;
  const tokenB = joinB.json.token;
  const sseA = await openSse(base, tokenA);
  const sseB = await openSse(base, tokenB);
  t.after(async () => {
    await sseA.close();
    await sseB.close();
  });
  await Promise.all([sseA.waitForEvent('snapshot'), sseB.waitForEvent('snapshot')]);

  const pose = { x: 0, y: 0, z: 1 };
  const res = await postJson(base, '/api/action', { token: tokenA, type: 'surface', pos: pose, heading: 1.2, moving: true });
  assert.equal(res.status, 200);
  const [frameA, frameB] = await Promise.all([
    sseA.waitForEvent('surface', (event) => event.playerId === joinA.json.player.id, { timeout: 3000 }),
    sseB.waitForEvent('surface', (event) => event.playerId === joinA.json.player.id, { timeout: 3000 }),
  ]);
  assert.deepEqual(frameA.pos, pose);
  assert.deepEqual(frameB.pos, pose);
  assert.equal(frameB.tag, 'SURFA');
  assert.equal(frameB.moving, true);
  assert.equal(JSON.stringify(frameB).includes(tokenA), false);
  assert.equal(typeof frameA.leaf, 'string');
  assert.ok(frameA.rev >= 1);
  assert.equal(frameA.rev, frameB.rev, 'one revision reaches every client');
  assert.equal(frameA.leaf, res.json.leaf, 'response and frame name the same leaf');
  assert.deepEqual(frameA.heading, res.json.heading);
  assert.equal(typeof frameA.bearingRad, 'number');
  assert.ok(frameA.bearingRad >= 0 && frameA.bearingRad < Math.PI * 2);
  assert.equal(frameA.state, 'walk');

  // state (not only the transient frame) carries the authoritative surface pose.
  const posedState = (await getJson(base, '/api/state')).json.state;
  const posedPlayer = posedState.players.find((player) => player.id === joinA.json.player.id);
  assert.deepEqual(posedPlayer.surface.pos, pose);
  assert.equal(posedPlayer.surface.rev, res.json.rev);
  assert.equal(posedPlayer.surface.leaf, res.json.leaf);

  const leave = await postJson(base, '/api/action', { token: tokenA, type: 'surface_leave' });
  assert.equal(leave.status, 200);
  const leaveB = await sseB.waitForEvent('surface_leave', (event) => event.playerId === joinA.json.player.id, { timeout: 3000 });
  assert.equal(leaveB.playerId, joinA.json.player.id);
  assert.equal(leaveB.reason, 'leave');
  const leftState = (await getJson(base, '/api/state')).json.state;
  assert.equal(leftState.players.find((player) => player.id === joinA.json.player.id).surface, undefined);
});

// ------------------------------------------------------- emergency supply

test('supply: gated by pilot age, places missing mission units as first-click deposits (repeatable after the 120s stuck window)', async (t) => {
  const { base, handle } = await makeServer(t, {
    bots: 0,
    depositChance: 1,
    clickCooldownMs: 0,
    planetSeed: 424242,
  });
  const join = await postJson(base, '/api/join', { tag: 'SUPPLY1' });
  assert.equal(join.status, 200);
  const token = join.json.token;
  const playerId = join.json.player.id;
  const core0 = handle.manager.planetCore(0);
  const mission = missionForPlanet(0, core0.planetSeed);
  const requiredUnits = mission.objectives.flatMap((objective) => objective.items).reduce((sum, item) => sum + item.need, 0);

  // Too early: rejected with the remaining wait, nothing placed.
  const hiddenBefore = core0.hiddenDepositCount();
  let res = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'SUPPLY_NOT_READY');
  assert.ok(res.json.readyInMs > 0);
  assert.equal(core0.hiddenDepositCount(), hiddenBefore);

  // Simulate a pilot older than 120 s (the server checks player.createdAt).
  const player = core0.findByToken(token);
  player.createdAt = Date.now() - SUPPLY_MIN_AGE_MS - 10_000;

  // A discovered deposit must never be overwritten by the drop.
  const foundCell = [...core0.getLeafMap().values()].find(
    (cell) => cell.resourceId && !cell.resourceFound && terrainAt(core0.planetSeed, cell.centroid).biome.mineable,
  );
  foundCell.resourceFindClick = 1;
  const mine = await postJson(base, '/api/action', { token, type: 'click', label: foundCell.label });
  assert.equal(mine.status, 200);
  assert.ok(mine.json.resource);

  const sse = await openSse(base, token);
  t.after(async () => {
    await sse.close();
  });
  await sse.waitForEvent('snapshot');

  res = await postJson(base, '/api/action', { token, type: 'supply', label: foundCell.label });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.message, SUPPLY_MESSAGE);
  assert.equal(res.json.planetIndex, 0);
  assert.equal(typeof res.json.impactLabel, 'string');
  const missingUnits = mission.objectives
    .flatMap((objective) => objective.items)
    .flatMap((item) => Array.from({ length: Math.max(0, item.need - (player.oreCounts?.[item.resourceId] || 0)) }, () => item.resourceId))
    .sort();
  assert.equal(res.json.cells.length, missingUnits.length, 'one deposit per still-missing mission unit');
  assert.ok(res.json.cells.length >= 1 && res.json.cells.length <= requiredUnits);
  assert.deepEqual(
    res.json.cells.map((cell) => cell.resourceId).sort(),
    missingUnits,
  );
  for (const cell of res.json.cells) assert.equal(Object.keys(cell).sort().join(','), 'label,resourceId');
  // Deposit materials are public resource objects; one entry per distinct id.
  assert.equal(res.json.resources.length, new Set(res.json.cells.map((cell) => cell.resourceId)).size);
  for (const resource of res.json.resources) assert.deepEqual(Object.keys(resource).sort(), ['color', 'glyph', 'id', 'name', 'value']);
  // No ore is auto-added by the drop.
  assert.equal((await getJson(base, '/api/state')).json.state.players.find((entry) => entry.id === playerId).ores, 1);
  // First successful click mines the supplied unit (resourceFindClick = 1).
  const first = res.json.cells[0];
  const suppliedCell = core0.getLeafMap().get(first.label);
  assert.equal(suppliedCell.resourceId, first.resourceId);
  assert.equal(suppliedCell.resourceFound, false);
  assert.equal(suppliedCell.resourceFindClick, 1);
  const click = await postJson(base, '/api/action', { token, type: 'click', label: first.label });
  assert.equal(click.status, 200);
  assert.equal(click.json.resource.id, first.resourceId, 'first click mines the supplied deposit');
  // The discovered deposit above was untouched by the drop.
  assert.equal(res.json.cells.some((cell) => cell.label === foundCell.label), false, 'no discovered deposit overwritten');

  // Event shape in the planet room (no tokens/tags).
  const frame = await sse.waitForEvent('supply', () => true, { timeout: 3000 });
  assert.equal(frame.impactLabel, res.json.impactLabel);
  assert.deepEqual(frame.cells, res.json.cells);
  assert.deepEqual(frame.resources, res.json.resources);
  assert.equal(frame.message, SUPPLY_MESSAGE);
  assert.equal(frame.playerId, playerId);
  assert.deepEqual(Object.keys(frame).sort(), ['cells', 'impactLabel', 'message', 'playerId', 'resources', 'type']);
  assert.equal(JSON.stringify(frame).includes(token), false);

  // Repeatable, but only after another 120-second cooldown.
  res = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'SUPPLY_NOT_READY');
  assert.ok(res.json.readyInMs > 0);
  player.supplyDropAt = Date.now() - SUPPLY_MIN_AGE_MS - 1000;
  res = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(res.status, 200, 'a stuck pilot gets another drop after the cooldown');
  assert.ok(res.json.cells.length >= 1);
});

test('supply: broadcast reaches every human client in the planet room', async (t) => {
  const { base, handle } = await makeServer(t, {
    bots: 0,
    depositChance: 1,
    clickCooldownMs: 0,
    planetSeed: 424242,
  });
  const joinA = await postJson(base, '/api/join', { tag: 'SUPPLYA' });
  const joinB = await postJson(base, '/api/join', { tag: 'SUPPLYB' });
  assert.equal(joinA.status, 200);
  assert.equal(joinB.status, 200);
  const tokenA = joinA.json.token;
  const tokenB = joinB.json.token;
  const core0 = handle.manager.planetCore(0);
  const playerA = core0.findByToken(tokenA);
  playerA.createdAt = Date.now() - SUPPLY_MIN_AGE_MS - 10_000;

  const sseA = await openSse(base, tokenA);
  const sseB = await openSse(base, tokenB);
  t.after(async () => {
    await sseA.close();
    await sseB.close();
  });
  await Promise.all([sseA.waitForEvent('snapshot'), sseB.waitForEvent('snapshot')]);

  const res = await postJson(base, '/api/action', { token: tokenA, type: 'supply' });
  assert.equal(res.status, 200);
  assert.ok(res.json.cells.length >= 1);

  const [frameA, frameB] = await Promise.all([
    sseA.waitForEvent('supply', () => true, { timeout: 3000 }),
    sseB.waitForEvent('supply', () => true, { timeout: 3000 }),
  ]);
  assert.deepEqual(frameA.cells, res.json.cells);
  assert.deepEqual(frameB.cells, res.json.cells);
  assert.equal(frameA.impactLabel, frameB.impactLabel);
  assert.equal(JSON.stringify(frameB).includes(tokenA), false);
  assert.equal(JSON.stringify(frameB).includes(tokenB), false);

  // Every human can harvest the shared drop, not just the pilot who called it.
  const supplied = res.json.cells[0];
  const mineB = await postJson(base, '/api/action', { token: tokenB, type: 'click', label: supplied.label });
  assert.equal(mineB.status, 200);
  assert.equal(mineB.json.resource.id, supplied.resourceId);
});

test('supply: rejected when the refit is already complete, and available again on a new planet', async (t) => {
  const { base, handle } = await makeServer(t, {
    bots: 0,
    depositChance: 1,
    clickCooldownMs: 0,
    planetSeed: 424242,
  });
  const join = await postJson(base, '/api/join', { tag: 'SUPPLY2' });
  const token = join.json.token;
  const core0 = handle.manager.planetCore(0);
  const player = core0.findByToken(token);
  player.createdAt = Date.now() - SUPPLY_MIN_AGE_MS - 1000;

  // Mission complete -> MISSION_COMPLETE.
  player.oreCounts = oreCountsForMission(missionForPlanet(0, core0.planetSeed));
  let res = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'MISSION_COMPLETE');

  // Escape to a random destination, then the next planet's drop is available again.
  const escape = await postJson(base, '/api/action', { token, type: 'escape' });
  assert.equal(escape.status, 200);
  const dest = escape.json.planetIndex;
  const destCore = handle.manager.planetCore(dest);
  const destPlayer = destCore.findByToken(token);
  destPlayer.createdAt = Date.now() - SUPPLY_MIN_AGE_MS - 1000;
  assert.deepEqual(destPlayer.suppliedPlanets || [], []);
  res = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(res.status, 200);
  assert.equal(res.json.planetIndex, dest);
  assert.ok(res.json.cells.length >= 1);
  assert.deepEqual(destPlayer.suppliedPlanets, [dest]);
  // A second drop is possible only after the repeat cooldown.
  const again = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'SUPPLY_NOT_READY');
  destPlayer.supplyDropAt = Date.now() - SUPPLY_MIN_AGE_MS - 1000;
  const repeat = await postJson(base, '/api/action', { token, type: 'supply' });
  assert.equal(repeat.status, 200);
  assert.ok(repeat.json.cells.length >= 1);
});


// --------------------------------------------- SRV-01 surface authority (HTTP)

test('surface: invalid poses and the 60 ms rate limit reject without mutating state', async (t) => {
  const { base, handle, clock } = await makeClockServer(t);
  const join = await postJson(base, '/api/join', { tag: 'RATE1' });
  assert.equal(join.status, 200);
  const token = join.json.token;
  const playerId = join.json.player.id;
  const core = handle.manager.planetCore(0);

  for (const pos of [
    { x: 'not-a-number', y: 0, z: 1 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0.01 },
    { x: 0, y: 0, z: 12 },
  ]) {
    const res = await postJson(base, '/api/action', { token, type: 'surface', pos, moving: true });
    assert.equal(res.status, 409, `rejects ${JSON.stringify(pos)}`);
    assert.equal(res.json.error, 'INVALID_POSE');
  }
  const invalidState = await postJson(base, '/api/action', {
    token,
    type: 'surface',
    pos: { x: 0, y: 0, z: 1 },
    state: 'dance',
  });
  assert.equal(invalidState.status, 409);
  assert.equal(invalidState.json.error, 'INVALID_STATE');
  assert.equal(core.poseCount, 0, 'no rejected request created a pose');
  assert.equal(core.poseRev, 0);
  assert.equal((await getJson(base, '/api/state')).json.state.players[0].surface, undefined);

  const first = await postJson(base, '/api/action', {
    token,
    type: 'surface',
    pos: { x: 0, y: 0, z: 1 },
    heading: 0.4,
    moving: true,
  });
  assert.equal(first.status, 200);
  assert.ok(first.json.rev >= 1);
  assert.equal(typeof first.json.leaf, 'string');
  assert.equal(typeof first.json.updatedAt, 'number');

  clock.advance(59);
  const limited = await postJson(base, '/api/action', { token, type: 'surface', pos: { x: 0, y: 0, z: 1 }, moving: true });
  assert.equal(limited.status, 409);
  assert.equal(limited.json.error, 'POSE_RATE_LIMIT');
  assert.equal(core.poseRev, first.json.rev, 'rejection never advances the revision');
  assert.equal(core.getPose(playerId).rev, first.json.rev);
  assert.equal(core.getPose(playerId).updatedAt, first.json.updatedAt, 'last sample survives a rejection');

  clock.advance(1);
  const second = await postJson(base, '/api/action', { token, type: 'surface', pos: { x: 0, y: 0, z: 1 }, moving: true });
  assert.equal(second.status, 200);
  assert.ok(second.json.rev > first.json.rev, 'rev is monotonic');
});

test('surface: TTL expiry broadcasts one surface_leave with reason expire', async (t) => {
  const { base, handle, clock } = await makeClockServer(t);
  const join = await postJson(base, '/api/join', { tag: 'TTL1' });
  const token = join.json.token;
  const playerId = join.json.player.id;
  const sse = await openSse(base, token);
  t.after(async () => {
    await sse.close();
  });
  await sse.waitForEvent('snapshot');
  const res = await postJson(base, '/api/action', { token, type: 'surface', pos: { x: 0, y: 0, z: 1 }, moving: true });
  assert.equal(res.status, 200);
  await sse.waitForEvent('surface', (event) => event.playerId === playerId, { timeout: 3000 });

  const stateFrom = sse.events.length;
  clock.advance(5_001);
  handle.app.pump();
  const leave = await sse.waitForEvent('surface_leave', (event) => event.playerId === playerId, { timeout: 3000 });
  assert.equal(leave.reason, 'expire');
  const state = (await getJson(base, '/api/state')).json.state;
  assert.equal(state.players.find((player) => player.id === playerId).surface, undefined, 'state clears within 5 s of silence');
  assert.equal(handle.manager.planetCore(0).getPose(playerId), null);
  const clearedFrame = await sse.waitForEvent(
    'state',
    (event) => !event.state.players.find((player) => player.id === playerId)?.surface,
    { timeout: 3000, from: stateFrom },
  );
  assert.equal(clearedFrame.state.players.find((player) => player.id === playerId).surface, undefined);

  const leavesBefore = sse.events.filter((event) => event.type === 'surface_leave').length;
  handle.app.pump();
  await delay(150);
  assert.equal(sse.events.filter((event) => event.type === 'surface_leave').length, leavesBefore, 'exactly one leave');
});

test('surface: SSE disconnect clears the pose for the room', async (t) => {
  const { base } = await makeServer(t, { bots: 0 });
  const joinA = await postJson(base, '/api/join', { tag: 'DISA' });
  const joinB = await postJson(base, '/api/join', { tag: 'DISB' });
  const sseA = await openSse(base, joinA.json.token);
  const sseB = await openSse(base, joinB.json.token);
  t.after(async () => {
    await sseA.close();
    await sseB.close();
  });
  await Promise.all([sseA.waitForEvent('snapshot'), sseB.waitForEvent('snapshot')]);
  const posed = await postJson(base, '/api/action', {
    token: joinA.json.token,
    type: 'surface',
    pos: { x: 0, y: 0.1, z: 1 },
    moving: true,
  });
  assert.equal(posed.status, 200);
  await sseB.waitForEvent('surface', (event) => event.playerId === joinA.json.player.id, { timeout: 3000 });

  const leavePromise = sseB.waitForEvent('surface_leave', (event) => event.playerId === joinA.json.player.id, { timeout: 6000 });
  await sseA.close();
  const leave = await leavePromise;
  assert.equal(leave.reason, 'disconnect');
  await waitFor(async () => {
    const state = (await getJson(base, '/api/state')).json.state;
    return state.players.find((player) => player.id === joinA.json.player.id).surface === undefined;
  });
});

test('surface: room isolation keeps poses on their own planet', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 0, planetSeed: 424242 });
  const joinA = await postJson(base, '/api/join', { tag: 'ROOMA' });
  const joinB = await postJson(base, '/api/join', { tag: 'ROOMB' });
  const core0 = handle.manager.planetCore(0);
  const sseB = await openSse(base, joinB.json.token);
  t.after(async () => {
    await sseB.close();
  });
  await sseB.waitForEvent('snapshot');

  grantMission(core0, joinA.json.token, 0);
  const escape = await postJson(base, '/api/action', { token: joinA.json.token, type: 'escape' });
  assert.equal(escape.status, 200);
  const destination = escape.json.planetIndex;
  const sseA = await openSse(base, joinA.json.token);
  t.after(async () => {
    await sseA.close();
  });
  await sseA.waitForEvent('snapshot');

  const marker = sseB.events.length;
  const posed = await postJson(base, '/api/action', {
    token: joinA.json.token,
    type: 'surface',
    pos: { x: 0, y: 0.2, z: 1 },
    moving: true,
  });
  assert.equal(posed.status, 200);
  assert.equal(posed.json.planetIndex, destination);
  await sseA.waitForEvent('surface', (event) => event.playerId === joinA.json.player.id, { timeout: 3000 });
  await delay(400);

  const leaked = sseB.events.slice(marker).filter((event) => event.type === 'surface' || event.type === 'surface_leave');
  assert.deepEqual(leaked, [], 'the old planet room never receives the other planet pose');
  const planet0State = (await getJson(base, '/api/state')).json.state;
  assert.equal(planet0State.players.find((player) => player.id === joinA.json.player.id).surface, undefined);
  const destinationCore = handle.manager.planetCore(destination);
  assert.ok(destinationCore.getPose(joinA.json.player.id), 'the pose lives on the destination planet');
  assert.equal(destinationCore.getPose(joinA.json.player.id).leaf, posed.json.leaf);
});

// --------------------------------------------- SRV-02 robot routing (SSE)

test('robot routing: surface frames advance along planned waypoints', async (t) => {
  const { base, handle, clock } = await makeClockServer(t, { bots: 1, clickCooldownMs: 0 });
  // Deterministic pumping: one robot tick and one frame flush per fake 100 ms.
  if (handle.app._pumpTimer) clearInterval(handle.app._pumpTimer);
  handle.app._pumpTimer = null;
  const join = await postJson(base, '/api/join', { tag: 'ROUTE1' });
  const sse = await openSse(base, join.json.token);
  t.after(async () => {
    await sse.close();
  });
  await sse.waitForEvent('snapshot');
  const core = handle.manager.planetCore(0);
  const robot = await waitFor(() => core._robots[0] || null, { timeout: 5000 });
  const from = sse.events.length;
  for (let tick = 0; tick < 160; tick += 1) {
    clock.advance(100);
    handle.app.pump();
  }
  await delay(200); // let the SSE reader drain the frames written above
  const frames = sse.events
    .slice(from)
    .filter((event) => event.type === 'surface' && event.playerId === robot.playerId);
  assert.ok(frames.length >= 60, `captured ${frames.length} robot surface frames`);
  let travelled = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const a = frames[index - 1].pos;
    const b = frames[index].pos;
    const angle = Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z)));
    assert.ok(angle <= 2 * STEP_RAD + 1e-6, `no teleport between frames (${angle} <= ${2 * STEP_RAD})`);
    travelled += angle;
    assert.ok(frames[index].rev >= frames[index - 1].rev, 'revision never rewinds');
  }
  assert.ok(travelled > 0.05, `the robot walks along its route (${travelled} rad)`);
  for (const frame of frames) {
    assert.ok(Number.isFinite(frame.rev) && frame.rev > 0);
    assert.ok(Math.abs(Math.hypot(frame.pos.x, frame.pos.y, frame.pos.z) - 1) < 1e-9);
    assert.ok(POSE_STATES.includes(frame.state), `closed state vocabulary, got ${frame.state}`);
    assert.equal(JSON.stringify(frame).includes(join.token), false, 'tokens never enter frames');
  }
});

// --------------------------------------------- SRV-03 surface_mine ordering

test('surface_mine ordering: cell frame precedes the beam frame', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 1, clickCooldownMs: 0 });
  const join = await postJson(base, '/api/join', { tag: 'MINE1' });
  const sse = await openSse(base, join.json.token);
  t.after(async () => {
    await sse.close();
  });
  await sse.waitForEvent('snapshot');
  const core = handle.manager.planetCore(0);
  const robot = await waitFor(() => core._robots[0] || null, { timeout: 5000 });
  const label = core.getLeaves().find(([leafLabel, owner]) => owner !== robot.index)[0];
  const from = sse.events.length;
  aimRobotAtLeaf(core, robot, label, Date.now());
  core._robotClick(robot, Date.now());
  handle.app.pump();

  const mine = await sse.waitForEvent('surface_mine', (event) => event.playerId === robot.playerId, { timeout: 3000, from });
  const batch = sse.events.slice(from);
  const mineIndex = batch.indexOf(mine);
  assert.ok(mineIndex >= 0);
  const cellIndex = batch.findIndex(
    (event, index) => index < mineIndex && event.type === 'cell' && event.cell[0] === mine.label,
  );
  assert.ok(cellIndex >= 0, 'the changed cell frame precedes the beam in the drained batch');
  assert.equal(mine.label, label, 'the beam names the cell under the robot pose');
  assert.equal(core.resolveLeaf(core.getPose(robot.playerId).pos).label, mine.label);
  assert.ok('resourceId' in mine && 'points' in mine && 'kind' in mine && 'broke' in mine, 'additive beam contract');
});

// --------------------------------------------- SRV-04 supply focus (SSE)

test('supply focus: two clients receive placements and both mine on first click', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 0, depositChance: 1, clickCooldownMs: 0, planetSeed: 424242 });
  const joinA = await postJson(base, '/api/join', { tag: 'SUPFOCA' });
  const joinB = await postJson(base, '/api/join', { tag: 'SUPFOCB' });
  const core0 = handle.manager.planetCore(0);
  core0.findByToken(joinA.json.token).createdAt = Date.now() - SUPPLY_MIN_AGE_MS - 10_000;
  const sseA = await openSse(base, joinA.json.token);
  const sseB = await openSse(base, joinB.json.token);
  t.after(async () => {
    await sseA.close();
    await sseB.close();
  });
  await Promise.all([sseA.waitForEvent('snapshot'), sseB.waitForEvent('snapshot')]);

  const res = await postJson(base, '/api/action', { token: joinA.json.token, type: 'supply' });
  assert.equal(res.status, 200);
  assert.equal(res.json.placements.length, 2, 'one placement per online human');
  const placedIds = new Set(res.json.placements.map((placement) => placement.playerId));
  assert.ok(placedIds.has(joinA.json.player.id) && placedIds.has(joinB.json.player.id));
  const labels = new Set(res.json.cells.map((cell) => cell.label));
  for (const placement of res.json.placements) {
    assert.ok(labels.has(placement.leaf), 'placement sits inside a supply cell');
    assert.equal(core0.resolveLeaf(placement.pos).label, placement.leaf);
    assert.ok(Math.abs(Math.hypot(placement.pos.x, placement.pos.y, placement.pos.z) - 1) < 1e-9);
    assert.ok(Math.abs(placement.heading.x * placement.pos.x + placement.heading.y * placement.pos.y + placement.heading.z * placement.pos.z) < 1e-9);
  }
  for (let i = 0; i < res.json.placements.length; i += 1) {
    for (let j = i + 1; j < res.json.placements.length; j += 1) {
      const a = res.json.placements[i].pos;
      const b = res.json.placements[j].pos;
      assert.ok(a.x * b.x + a.y * b.y + a.z * b.z < Math.cos(SUPPLY_MIN_SEPARATION_RAD), 'placements keep separation');
    }
  }

  const [frameA, frameB] = await Promise.all([
    sseA.waitForEvent('supply_focus', () => true, { timeout: 3000 }),
    sseB.waitForEvent('supply_focus', () => true, { timeout: 3000 }),
  ]);
  assert.equal(frameA.impactLabel, res.json.impactLabel);
  assert.deepEqual(frameA.placements, res.json.placements);
  assert.deepEqual(frameB.placements, res.json.placements);
  assert.equal(frameA.rev, res.json.rev);
  assert.equal(frameB.rev, res.json.rev);
  assert.equal(frameA.expiresAt, res.json.expiresAt);
  assert.ok(frameA.expiresAt > Date.now());
  assert.equal(JSON.stringify(frameB).includes(joinA.json.token), false);
  assert.equal(JSON.stringify(frameB).includes(joinB.json.token), false);

  // Every pilot was actually relocated in the authoritative state.
  const state = (await getJson(base, '/api/state')).json.state;
  for (const placement of res.json.placements) {
    const player = state.players.find((entry) => entry.id === placement.playerId);
    assert.deepEqual(player.surface.pos, placement.pos);
    assert.equal(player.surface.leaf, placement.leaf);
  }

  // Both humans can harvest the marked cells on their first click.
  const firstCell = res.json.cells[0];
  const mineB = await postJson(base, '/api/action', { token: joinB.json.token, type: 'click', label: firstCell.label });
  assert.equal(mineB.status, 200);
  assert.equal(mineB.json.resource.id, firstCell.resourceId, 'first click mines the supplied unit');
});

test('supply focus: join during the TTL returns the same placements', async (t) => {
  const { base, handle } = await makeServer(t, { bots: 0, depositChance: 1, clickCooldownMs: 0, planetSeed: 424242 });
  const joinA = await postJson(base, '/api/join', { tag: 'SUPJOINA' });
  const core0 = handle.manager.planetCore(0);
  core0.findByToken(joinA.json.token).createdAt = Date.now() - SUPPLY_MIN_AGE_MS - 10_000;

  const res = await postJson(base, '/api/action', { token: joinA.json.token, type: 'supply' });
  assert.equal(res.status, 200);
  assert.equal(res.json.placements.length, 1);

  const late = await postJson(base, '/api/join', { tag: 'SUPJOINC' });
  assert.equal(late.status, 200);
  assert.ok(late.json.focus, 'the join response carries the advisory focus');
  assert.deepEqual(late.json.focus.placements, res.json.placements, 'same placements inside the TTL');
  assert.equal(late.json.focus.rev, res.json.rev);
  assert.equal(late.json.focus.expiresAt, res.json.expiresAt);

  // The late joiner can mine the marked cells on its first click.
  const firstCell = res.json.cells[0];
  const mine = await postJson(base, '/api/action', { token: late.json.token, type: 'click', label: firstCell.label });
  assert.equal(mine.status, 200);
  assert.equal(mine.json.resource.id, firstCell.resourceId);
});
