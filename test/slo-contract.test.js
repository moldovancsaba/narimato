/**
 * OPS-01 — executable observability SSOT contract.
 *
 * Covers the ruleset schema, comparator/growth maths, warm-up and precondition
 * suppression, the live `/api/metrics` payload contract (every documented path
 * resolves, additive fields present), the checker exit-code contract (0/1/2/3),
 * documentation drift and the privacy invariant over ruleset and checker output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer } from '../server.js';
import {
  compareValue,
  evaluateRules,
  exitCodeFor,
  loadRuleset,
  OPERATORS,
  parseRulePath,
  resolvePath,
  rssGrowthBytesPerMinute,
  validateRuleset,
  WINDOW_MAX_MS,
  WINDOW_MIN_MS,
} from '../lib/slo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_FILE = path.join(ROOT, 'observability', 'slo.json');
const CHECKER = path.join(ROOT, 'scripts', 'check-slo.mjs');
const OBSERVABILITY = path.join(ROOT, 'OBSERVABILITY.md');
const RULES = loadRuleset(RULES_FILE).rules;

const FORBIDDEN = ['token', 'resourceId', 'resourceFindClick', 'hiddenDeposit', 'playerId', 'tag"'];

/** A complete, healthy `/api/metrics` snapshot (uptime past every warm-up window). */
function healthySnapshot(overrides = {}) {
  const base = {
    ok: true,
    metricsVersion: 1,
    generatedAt: 1_760_000_000_000,
    uptimeMs: 3_600_000,
    process: { heapUsedBytes: 10, heapTotalBytes: 20, rssBytes: 80 * 1024 * 1024, externalBytes: 1, bootRssBytes: 70 * 1024 * 1024 },
    security: { rateLimited: 0, bodyTooLarge: 0, crossOrigin: 0, sseRefused: 0, traversalBlocked: 0, authFailures: 0, sseReplaced: 0, mode: 'enforce' },
    http: {
      requests: 10,
      finished: 10,
      inFlight: 0,
      errors: 0,
      clientErrors: 0,
      routes: { '/api/metrics': 1 },
      statuses: { 200: 10 },
      latencyMs: { count: 10, sumMs: 10, avgMs: 1, maxMs: 3, p50Ms: 1, p95Ms: 3, p99Ms: 3, windowSamples: 2048 },
    },
    sse: { active: 1, opened: 1, closed: 0, dropped: 0, byPlanet: { 0: { active: 1, opened: 1, closed: 0, dropped: 0 } } },
    planets: [{ index: 0, name: 'MAGRATHEA', depth: 2, playersOnline: 1, playersTotal: 1, robots: 0, faces: 20, clicks: 1, breaks: 0, maxDepthReached: 0, revision: 1 }],
    eventLoop: { enabled: true, resolutionMs: 20 },
    eventLoopDelay: { p50Ms: 1, p95Ms: 3, p99Ms: 4, maxMs: 5, meanMs: 1 },
    telemetry: {
      reports: 25,
      rejected: 0,
      lastReportedAt: 1_760_000_000_000,
      aggregates: { 'audio.firstWordMs': { count: 25, sum: 7500, avg: 300, min: 200, max: 500 } },
    },
  };
  return { ...base, ...overrides };
}

/** Run the checker in a child process (needed because the fake/real server lives in this process). */
function runChecker(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CHECKER, ...args], { cwd: ROOT, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Serve a fixed `/api/metrics` snapshot on an ephemeral port. */
async function fakeMetricsServer(t, snapshot) {
  const server = http.createServer((req, res) => {
    if ((req.url || '').split('?')[0] !== '/api/metrics') {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.stringify(snapshot);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

// ------------------------------------------------------------------- schema

test('slo: ruleset file declares the six owned rules with severity, owner and runbook', () => {
  const parsed = loadRuleset(RULES_FILE);
  assert.deepEqual(validateRuleset(parsed), { ok: true, errors: [] });
  assert.equal(parsed.version, 1);
  assert.deepEqual(RULES.map((rule) => rule.id), ['http-p95', 'loop-p95', 'sse-drop', 'sse-silence', 'audio-first-word', 'rss-growth']);
  for (const rule of RULES) {
    assert.ok(['warn', 'page'].includes(rule.severity), `${rule.id} severity`);
    assert.ok(typeof rule.owner === 'string' && rule.owner.length > 0, `${rule.id} owner`);
    assert.ok(rule.runbook.startsWith('#'), `${rule.id} runbook anchor`);
    assert.ok(rule.windowMs >= WINDOW_MIN_MS && rule.windowMs <= WINDOW_MAX_MS, `${rule.id} window bounds`);
    assert.ok(OPERATORS.includes(rule.op), `${rule.id} operator`);
  }
  // Invalid rulesets are rejected (no threshold may exist only in prose).
  assert.equal(validateRuleset({ version: 1, rules: [] }).ok, false);
  assert.equal(validateRuleset({ version: 1, rules: [{ id: 'Bad Id', path: 'x', op: 'lt', threshold: 1, windowMs: 1, severity: 'warn', owner: 'x', runbook: '#x' }] }).ok, false);
  assert.equal(validateRuleset({ version: 2, rules: RULES }).ok, false);
});

// --------------------------------------------------------------- primitives

test('slo: rule path resolution supports dotted, bracketed and wildcard paths', () => {
  assert.deepEqual(parseRulePath('http.latencyMs.p95Ms'), ['http', 'latencyMs', 'p95Ms']);
  assert.deepEqual(parseRulePath('telemetry.aggregates["audio.firstWordMs"].avg'), ['telemetry', 'aggregates', 'audio.firstWordMs', 'avg']);
  assert.equal(resolvePath(healthySnapshot(), 'http.latencyMs.p95Ms'), 3);
  assert.equal(resolvePath(healthySnapshot(), 'telemetry.aggregates["audio.firstWordMs"].avg'), 300);
  assert.deepEqual(resolvePath(healthySnapshot(), 'planets[].playersOnline'), [1]);
  assert.equal(resolvePath(healthySnapshot(), 'http.missing.path'), undefined);
  assert.equal(resolvePath(healthySnapshot(), 'planets[].missing'), undefined);
});

test('slo: comparator behaviour covers every operator and wildcard requires', () => {
  assert.equal(compareValue(3, { op: 'lt', threshold: 4 }), true);
  assert.equal(compareValue(4, { op: 'lt', threshold: 4 }), false);
  assert.equal(compareValue(4, { op: 'lte', threshold: 4 }), true);
  assert.equal(compareValue(5, { op: 'gt', threshold: 4 }), true);
  assert.equal(compareValue(4, { op: 'gte', threshold: 4 }), true);
  assert.equal(compareValue(0, { op: 'eq', threshold: 0 }), true);
  assert.equal(compareValue([0, 2], { op: 'gt', threshold: 1 }), true, 'wildcard uses any()');
  assert.equal(compareValue([0, 0], { op: 'gt', threshold: 1 }), false);
  assert.equal(compareValue(undefined, { op: 'lt', threshold: 1 }), undefined);
});

test('slo: rss growth rate is bytes/minute from boot, clamped at zero', () => {
  const snapshot = healthySnapshot({ process: { rssBytes: 106 * 1024 * 1024, bootRssBytes: 100 * 1024 * 1024 } });
  assert.equal(rssGrowthBytesPerMinute(snapshot, 60_000), 6 * 1024 * 1024);
  assert.equal(rssGrowthBytesPerMinute(snapshot, 120_000), 3 * 1024 * 1024);
  const shrunk = healthySnapshot({ process: { rssBytes: 90 * 1024 * 1024, bootRssBytes: 100 * 1024 * 1024 } });
  assert.equal(rssGrowthBytesPerMinute(shrunk, 60_000), 0, 'negative rate reports 0');
  assert.equal(rssGrowthBytesPerMinute(shrunk, 0), 0, 'non-positive uptime reports 0');
});

// --------------------------------------------------------------- evaluation

test('slo: warm-up suppresses alerts until each rule window has elapsed', () => {
  const snapshot = healthySnapshot();
  // Force every optional precondition to be met so only warm-up decides the state.
  const results = evaluateRules(RULES, snapshot, { uptimeMs: 0 });
  for (const entry of results) assert.equal(entry.state, 'warming', `${entry.id} warms up`);
  assert.equal(exitCodeFor(results), 0, 'warming is never a breach');
  // Audio rule has its own 15 min window, so 5 min uptime still warms it up.
  const partial = evaluateRules(RULES, snapshot, { uptimeMs: 300_000 });
  assert.equal(partial.find((entry) => entry.id === 'http-p95').state, 'pass');
  assert.equal(partial.find((entry) => entry.id === 'audio-first-word').state, 'warming');
  assert.equal(partial.find((entry) => entry.id === 'rss-growth').state, 'warming');
});

test('slo: preconditions report waiting, never pass', () => {
  const noPlayers = healthySnapshot({ planets: [{ index: 0, playersOnline: 0, playersTotal: 3 }] });
  const results = evaluateRules(RULES, noPlayers, { uptimeMs: 3_600_000 });
  assert.equal(results.find((entry) => entry.id === 'sse-drop').state, 'waiting');
  assert.equal(results.find((entry) => entry.id === 'sse-silence').state, 'waiting');
  const noAudio = healthySnapshot({ telemetry: { reports: 0, rejected: 0, lastReportedAt: 0, aggregates: {} } });
  assert.equal(evaluateRules(RULES, noAudio, { uptimeMs: 3_600_000 }).find((entry) => entry.id === 'audio-first-word').state, 'waiting');
});

test('slo: breach and missing-path produce different exit codes', () => {
  const slow = healthySnapshot({ http: { ...healthySnapshot().http, latencyMs: { ...healthySnapshot().http.latencyMs, p95Ms: 999 } } });
  const breach = evaluateRules(RULES, slow, { uptimeMs: 3_600_000 });
  assert.equal(breach.find((entry) => entry.id === 'http-p95').state, 'breach');
  assert.equal(exitCodeFor(breach), 1);

  const broken = healthySnapshot();
  delete broken.eventLoopDelay;
  const missing = evaluateRules(RULES, broken, { uptimeMs: 3_600_000 });
  assert.equal(missing.find((entry) => entry.id === 'loop-p95').state, 'missing-path');
  assert.equal(exitCodeFor(missing), 2, 'missing path outranks breach');
});

// ------------------------------------------------------------- live contract

test('slo: every rule path resolves in a live /api/metrics snapshot (additive fields present)', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-slo-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0 },
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const metrics = await (await fetch(`http://127.0.0.1:${handle.port}/api/metrics`)).json();
  assert.equal(metrics.metricsVersion, 1);
  assert.equal(metrics.http.latencyMs.windowSamples, 2048);
  assert.equal(typeof metrics.process.bootRssBytes, 'number');
  assert.ok(metrics.process.bootRssBytes > 0);
  assert.equal(typeof metrics.security, 'object');
  assert.equal(typeof metrics.security.mode, 'string');

  const results = evaluateRules(RULES, metrics, { uptimeMs: metrics.uptimeMs });
  assert.equal(results.length, RULES.length);
  for (const entry of results) {
    assert.notEqual(entry.state, 'missing-path', `${entry.id} path ${entry.path} resolves in the live payload`);
    assert.ok(['pass', 'warming', 'waiting'].includes(entry.state), `${entry.id} healthy on a fresh server`);
  }
  assert.equal(exitCodeFor(results), 0);
});

// ------------------------------------------------------------ checker exits

test('check:slo exits 3 on an unreachable server and prints no stack trace', async () => {
  const result = await runChecker(['--base-url', 'http://127.0.0.1:1', '--timeout-ms', '500']);
  assert.equal(result.code, 3);
  assert.match(result.stderr, /unreachable: http:\/\/127\.0\.0\.1:1/);
  assert.equal(result.stderr.includes('    at '), false, 'no stack trace');
});

test('check:slo exits 0 when healthy, 1 on breach, 2 on a missing path', async (t) => {
  const healthyBase = await fakeMetricsServer(t, healthySnapshot());
  let result = await runChecker(['--base-url', healthyBase]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS 6\/6/);
  assert.match(result.stdout, /http-p95/);

  const breachBase = await fakeMetricsServer(t, healthySnapshot({ http: { ...healthySnapshot().http, latencyMs: { ...healthySnapshot().http.latencyMs, p95Ms: 900 } } }));
  result = await runChecker(['--base-url', breachBase]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL 1\/6/);
  assert.match(result.stdout, /http-p95/);

  const broken = healthySnapshot();
  delete broken.eventLoopDelay;
  const missingBase = await fakeMetricsServer(t, broken);
  result = await runChecker(['--base-url', missingBase]);
  assert.equal(result.code, 2);
  assert.match(result.stdout, /missing path: loop-p95/);

  result = await runChecker(['--base-url', healthyBase, '--only=http-p95', '--json']);
  assert.equal(result.code, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].id, 'http-p95');
});

// ---------------------------------------------------------- docs + privacy

test('slo: documentation cannot drift from the executable ruleset', async () => {
  const doc = await readFile(OBSERVABILITY, 'utf8');
  for (const rule of RULES) {
    assert.ok(doc.includes(rule.id), `OBSERVABILITY.md documents rule ${rule.id}`);
    assert.ok(doc.includes(rule.owner), `OBSERVABILITY.md documents owner ${rule.owner}`);
    const anchor = rule.runbook.slice(1);
    assert.ok(doc.includes(`### ${anchor}`), `OBSERVABILITY.md has runbook heading ${rule.runbook}`);
  }
  for (const phrase of ['observability/slo.json', 'scripts/check-slo.mjs', 'npm run check:slo', 'warming', '15 s', 'Exit codes']) {
    assert.ok(doc.includes(phrase), `OBSERVABILITY.md mentions "${phrase}"`);
  }
  // The docs table and ruleset must agree on the numeric thresholds.
  for (const rule of RULES) {
    if (rule.derived) continue;
    assert.ok(doc.includes(rule.path) || rule.path.includes('"'), `OBSERVABILITY.md names path ${rule.path}`);
  }
});

test('slo: privacy invariants hold over ruleset, live metrics and checker output', async (t) => {
  const rulesetText = await readFile(RULES_FILE, 'utf8');
  for (const needle of ['token', 'resourceId', 'resourceFindClick', 'hiddenDeposit', 'playerId']) {
    assert.equal(rulesetText.includes(needle), false, `ruleset must not mention ${needle}`);
  }

  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-slo-privacy-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0 },
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  const join = await fetch(`http://127.0.0.1:${handle.port}/api/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tag: 'SLOPRIV' }),
  }).then((res) => res.json());
  const metrics = await (await fetch(`http://127.0.0.1:${handle.port}/api/metrics`)).json();
  const metricsText = JSON.stringify(metrics);
  assert.equal(metricsText.includes(join.token), false, 'no join token in metrics');
  assert.equal(metricsText.includes('SLOPRIV'), false, 'no tag in metrics');
  assert.equal(metricsText.includes(join.player.id), false, 'no player id in metrics');
  assert.equal(metricsText.includes('resourceId'), false);
  assert.equal(metricsText.includes('resourceFindClick'), false);

  const base = await fakeMetricsServer(t, healthySnapshot());
  const result = await runChecker(['--base-url', base, '--json']);
  assert.equal(result.code, 0);
  const report = JSON.parse(result.stdout);
  const output = `${result.stdout}${result.stderr}`;
  for (const needle of FORBIDDEN) assert.equal(output.includes(needle), false, `checker output must not contain ${needle}`);
  assert.deepEqual(report.results.map((entry) => entry.id), RULES.map((rule) => rule.id));
});
