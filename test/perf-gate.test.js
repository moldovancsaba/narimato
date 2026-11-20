/**
 * OPS-02 unit tests: committed scenario schema, ruleset threshold resolution,
 * flaky verdict policy, RSS growth, run evaluation and artifact redaction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RULES,
  DEFAULT_SCENARIOS,
  REQUIRED_SCENARIOS,
  evaluateRun,
  flattenRules,
  loadRuleset,
  loadScenarios,
  redactArtifact,
  resolveThresholds,
  rssGrowthMiB,
  validateScenario,
  verdictFor,
} from '../scripts/perf-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixtures() {
  const [document, ruleset] = await Promise.all([loadScenarios(DEFAULT_SCENARIOS), loadRuleset(DEFAULT_RULES)]);
  return { document, ruleset };
}

test('perf gate: four fixed scenarios with the documented numbers', async () => {
  const { document } = await fixtures();
  const byId = Object.fromEntries(document.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const id of REQUIRED_SCENARIOS) assert.ok(byId[id], `missing ${id}`);
  assert.equal(byId.smoke.clients, 30);
  assert.equal(byId.smoke.sseClients, 15);
  assert.equal(byId.smoke.clicks, 5);
  assert.equal(byId.smoke.durationSeconds, 10);
  assert.equal(byId.smoke.repeat, 1);
  assert.equal(byId.load.clients, 100);
  assert.equal(byId.load.sseClients, 40);
  assert.equal(byId.load.clicks, 5);
  assert.equal(byId.load.durationSeconds, 60);
  assert.equal(byId.load.repeat, 3);
  assert.equal(byId.soak.clients, 40);
  assert.equal(byId.soak.sseClients, 20);
  assert.equal(byId.soak.durationSeconds, 7200);
  assert.equal(byId.soak.repeat, 1);
  assert.equal(byId.chaos.generator, 'chaos');
  assert.equal(byId.chaos.clients, 10);
  assert.equal(byId.chaos.sseClients, 5);
  for (const scenario of document.scenarios) assert.deepEqual(validateScenario(scenario, { ruleset: await loadRuleset(DEFAULT_RULES) }), []);
});

test('perf gate: thresholds resolve from the OPS-01 ruleset, not duplicated constants', async () => {
  const { document, ruleset } = await fixtures();
  const smoke = document.scenarios.find((scenario) => scenario.id === 'smoke');
  const thresholds = resolveThresholds(smoke, ruleset);
  assert.equal(thresholds.httpP95Ms, 150);
  assert.equal(thresholds.loopP95Ms, 50);
  assert.equal(thresholds.droppedSse, 0);
  assert.equal(thresholds.errors, 0);
  assert.equal(thresholds.joinP95Ms, 25);
  assert.equal(thresholds.clickP95Ms, 75);
  assert.equal(thresholds.responseBodyMiB, 1);
  const soak = document.scenarios.find((scenario) => scenario.id === 'soak');
  assert.equal(resolveThresholds(soak, ruleset).rssGrowthMiB, 96);
  const chaos = document.scenarios.find((scenario) => scenario.id === 'chaos');
  assert.equal(resolveThresholds(chaos, ruleset).reconnectMs, 5000);
  const flat = flattenRules(ruleset);
  assert.equal(flat['http-p95'], 150);
  assert.equal(flat['gate.reconnectMs'], 5000);
  // Scenario files reference rule ids, never numeric thresholds.
  for (const scenario of document.scenarios) {
    for (const value of Object.values(scenario.thresholds)) {
      assert.equal(typeof value, 'string', `${scenario.id} must reference a rule id`);
    }
  }
});

test('perf gate: scenario validation rejects an unknown threshold and bad shape', async () => {
  const { ruleset } = await fixtures();
  const base = {
    id: 'smoke',
    generator: 'load-test',
    clients: 10,
    sseClients: 5,
    clicks: 1,
    durationSeconds: 1,
    clickPauseMs: 0,
    repeat: 1,
    timeoutSeconds: 60,
    thresholds: { httpP95Ms: 'not-a-rule' },
  };
  const unknown = validateScenario(base, { ruleset });
  assert.ok(unknown.some((problem) => problem.includes('unknown rule')));
  const bad = validateScenario({ ...base, generator: 'nope', repeat: 2, thresholds: {} }, { ruleset });
  assert.ok(bad.some((problem) => problem.includes('generator')));
  assert.ok(bad.some((problem) => problem.includes('repeat')));
  assert.ok(bad.some((problem) => problem.includes('thresholds')));
});

test('perf gate: flaky only accepts latency-only failure with 2 of 3 clean runs', () => {
  const clean = { failures: [] };
  const latency = { failures: [{ metric: 'httpP95Ms', kind: 'latency' }] };
  const correctness = { failures: [{ metric: 'errors', kind: 'correctness' }] };
  assert.equal(verdictFor([clean, clean, clean]), 'pass');
  assert.equal(verdictFor([latency, clean, clean]), 'flaky');
  assert.equal(verdictFor([clean, latency, clean]), 'flaky');
  assert.equal(verdictFor([latency, latency, clean]), 'fail');
  assert.equal(verdictFor([correctness, clean, clean]), 'fail');
  assert.equal(verdictFor([latency]), 'fail');
  assert.equal(verdictFor([]), 'fail');
});

test('perf gate: RSS growth is an end-state difference clamped at zero', () => {
  const before = { process: { rssBytes: 100 * 1024 * 1024 } };
  const after = { process: { rssBytes: 110 * 1024 * 1024 } };
  assert.equal(rssGrowthMiB(before, after), 10);
  assert.equal(rssGrowthMiB(after, before), 0);
  assert.equal(rssGrowthMiB(null, after), null);
});

function metrics({ p95 = 10, loop = 10, dropped = 0, errors = 0, rss = 100 } = {}) {
  return {
    process: { rssBytes: rss * 1024 * 1024 },
    http: { errors, latencyMs: { p95Ms: p95 } },
    eventLoopDelay: { p95Ms: loop },
    sse: { dropped },
  };
}

test('perf gate: run evaluation separates latency from correctness', async () => {
  const { document, ruleset } = await fixtures();
  const load = document.scenarios.find((scenario) => scenario.id === 'load');
  const thresholds = resolveThresholds(load, ruleset);
  const summary = { errors: 0, joinP95Ms: 5, clickP95Ms: 10 };
  const clean = evaluateRun({ scenario: load, thresholds, before: metrics(), after: metrics(), summary, bodies: { state: { bytes: 1000 }, world: { bytes: 1000 } } });
  assert.deepEqual(clean.failures, []);
  assert.equal(clean.latencyOnly, true);
  const slow = evaluateRun({ scenario: load, thresholds, before: metrics(), after: metrics({ p95: 500, loop: 60 }), summary });
  assert.deepEqual(slow.failures.map((entry) => entry.metric), ['httpP95Ms', 'loopP95Ms']);
  assert.equal(slow.latencyOnly, true);
  const broken = evaluateRun({ scenario: load, thresholds, before: metrics({ dropped: 1 }), after: metrics({ dropped: 3, errors: 2 }), summary: { ...summary, errors: 1 } });
  assert.equal(broken.latencyOnly, false);
  for (const metric of ['droppedSse', 'errors']) assert.ok(broken.failures.some((entry) => entry.metric === metric));
  const missing = evaluateRun({ scenario: load, thresholds, before: metrics(), after: null, summary });
  assert.equal(missing.failures[0].metric, 'metrics');
  assert.equal(missing.latencyOnly, false);
});

test('perf gate: soak RSS growth and response body limits are evaluated', async () => {
  const { document, ruleset } = await fixtures();
  const soak = document.scenarios.find((scenario) => scenario.id === 'soak');
  const thresholds = resolveThresholds(soak, ruleset);
  const result = evaluateRun({
    scenario: soak,
    thresholds,
    before: metrics({ rss: 100 }),
    after: metrics({ rss: 210 }),
    summary: { errors: 0, joinP95Ms: 5, clickP95Ms: 10 },
    bodies: { state: { bytes: 2 * 1024 * 1024 }, world: { bytes: 1000 } },
  });
  assert.ok(result.failures.some((entry) => entry.metric === 'rssGrowthMiB'));
  assert.ok(result.failures.some((entry) => entry.metric === 'responseBodyMiB'));
  assert.equal(result.latencyOnly, false);
});

test('perf gate: chaos evaluation fails lost players and slow reconnect', async () => {
  const { document, ruleset } = await fixtures();
  const chaos = document.scenarios.find((scenario) => scenario.id === 'chaos');
  const thresholds = resolveThresholds(chaos, ruleset);
  const ok = evaluateRun({ scenario: chaos, thresholds, before: null, after: null, summary: { failures: [], reconnectMaxMs: 24 } });
  assert.deepEqual(ok.failures, []);
  const lost = evaluateRun({ scenario: chaos, thresholds, before: null, after: null, summary: { failures: ['players lost after restart'], reconnectMaxMs: 8000 } });
  assert.equal(lost.latencyOnly, false);
  assert.equal(lost.failures.length, 2);
});

test('perf gate: artifacts redact tokens, tags and player identities', () => {
  const artifact = redactArtifact({
    scenario: { id: 'load' },
    token: 'secret',
    nested: { tags: ['LT01'], playerId: 'p_1', playerTag: 'LT01', ok: true },
    runs: [{ summary: { clients: 1, label: 'keep' }, authorization: 'Bearer x' }],
  });
  const text = JSON.stringify(artifact);
  assert.equal(text.includes('secret'), false);
  assert.equal(text.includes('p_1'), false);
  assert.equal(text.includes('LT01'), false);
  assert.equal(artifact.scenario.id, 'load');
  assert.equal(artifact.runs[0].summary.label, 'keep');
});
