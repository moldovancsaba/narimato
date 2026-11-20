#!/usr/bin/env node
/**
 * NARIMATO — OPS-02 reproducible load / soak / chaos gate.
 *
 * One command runs a committed scenario from `observability/load-scenarios.json`
 * against an ephemeral server (random port, temp DATA_DIR, SECURITY_MODE=enforce)
 * and writes machine-readable artifacts plus a pasteable summary.
 *
 * Usage:
 *   npm run gate:load -- --only=smoke
 *   node scripts/perf-gate.mjs --only=smoke,load,chaos
 *   node scripts/perf-gate.mjs --only=soak --out artifacts/gate/soak
 *   node scripts/perf-gate.mjs --dry-run
 *
 * Exit codes: 0 gate pass/flaky, 1 gate fail, 2 usage/scenario error.
 * Thresholds are resolved from the OPS-01 ruleset; this file only names rule
 * ids. The generators keep their CLIs and write `--report <path>` JSON.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
export const DEFAULT_SCENARIOS = path.join(ROOT, 'observability', 'load-scenarios.json');
export const DEFAULT_RULES = path.join(ROOT, 'observability', 'slo.json');
export const DEFAULT_OUT = path.join(ROOT, 'artifacts', 'gate');
export const REQUIRED_SCENARIOS = Object.freeze(['smoke', 'load', 'soak', 'chaos']);
const GATE_LATENCY_KEYS = new Set(['httpP95Ms', 'loopP95Ms', 'joinP95Ms', 'clickP95Ms']);
const MI_BYTES = 1024 * 1024;

function readJson(file) {
  return readFile(file, 'utf8').then((text) => JSON.parse(text));
}

/** Read the committed scenario file. */
export async function loadScenarios(file = DEFAULT_SCENARIOS) {
  const document = await readJson(file);
  if (!document || !Array.isArray(document.scenarios)) throw new Error(`${file}: scenarios[] is required`);
  return document;
}

/** Read the OPS-01 ruleset (the only mutable threshold source). */
export async function loadRuleset(file = DEFAULT_RULES) {
  const document = await readJson(file);
  if (!document || !Array.isArray(document.rules)) throw new Error(`${file}: rules[] is required`);
  return document;
}

/** Flatten `rules` and the `gate` extension into `{id: threshold}`. */
export function flattenRules(ruleset) {
  const thresholds = Object.create(null);
  for (const rule of ruleset && Array.isArray(ruleset.rules) ? ruleset.rules : []) {
    if (!rule || typeof rule.id !== 'string') continue;
    thresholds[rule.id] = Number(rule.threshold);
  }
  const gate = ruleset && ruleset.gate && typeof ruleset.gate === 'object' ? ruleset.gate : {};
  for (const [key, value] of Object.entries(gate)) {
    thresholds[`gate.${key}`] = Number(value);
  }
  return thresholds;
}

/**
 * Resolve a scenario's `{metric: ruleId}` map against the ruleset.
 * A missing or non-numeric rule is a contract error, never a silent 0.
 */
export function resolveThresholds(scenario, ruleset) {
  const available = flattenRules(ruleset);
  const resolved = {};
  const declared = scenario && scenario.thresholds && typeof scenario.thresholds === 'object' ? scenario.thresholds : {};
  for (const [metric, ruleId] of Object.entries(declared)) {
    if (ruleId === null) {
      resolved[metric] = null;
      continue;
    }
    const value = available[ruleId];
    if (!Number.isFinite(value)) throw new Error(`scenario ${scenario.id}: threshold ${metric} references unknown rule ${ruleId}`);
    resolved[metric] = value;
  }
  return resolved;
}

/** Schema validation for one scenario. Returns an array of problems. */
export function validateScenario(scenario, { ruleset } = {}) {
  const problems = [];
  if (!scenario || typeof scenario !== 'object') return ['scenario must be an object'];
  if (typeof scenario.id !== 'string' || !scenario.id) problems.push('id must be a non-empty string');
  if (!['load-test', 'chaos'].includes(scenario.generator)) problems.push('generator must be "load-test" or "chaos"');
  if (!Number.isInteger(scenario.repeat) || ![1, 3].includes(scenario.repeat)) problems.push('repeat must be 1 or 3');
  if (!Number.isFinite(scenario.timeoutSeconds) || scenario.timeoutSeconds <= 0) problems.push('timeoutSeconds must be positive');
  if (scenario.generator === 'load-test') {
    if (!Number.isInteger(scenario.clients) || scenario.clients < 1 || scenario.clients > 500) problems.push('clients must be 1..500');
    if (!Number.isInteger(scenario.sseClients) || scenario.sseClients < 0) problems.push('sseClients must be >= 0');
    if (Number.isInteger(scenario.sseClients) && Number.isInteger(scenario.clients) && scenario.sseClients > scenario.clients) {
      problems.push('sseClients cannot exceed clients');
    }
    if (!Number.isInteger(scenario.clicks) || scenario.clicks < 0) problems.push('clicks must be >= 0');
    if (!Number.isFinite(scenario.durationSeconds) || scenario.durationSeconds < 0) problems.push('durationSeconds must be >= 0');
    if (!Number.isFinite(scenario.clickPauseMs) || scenario.clickPauseMs < 0) problems.push('clickPauseMs must be >= 0');
  }
  if (!scenario.thresholds || typeof scenario.thresholds !== 'object' || !Object.keys(scenario.thresholds).length) {
    problems.push('thresholds must be a non-empty {metric: ruleId} map');
  } else if (ruleset) {
    try {
      resolveThresholds(scenario, ruleset);
    } catch (error) {
      problems.push(error.message);
    }
  }
  return problems;
}

/** RSS end-state growth in MiB (never negative). */
export function rssGrowthMiB(before, after) {
  const startRaw = before && before.process ? before.process.rssBytes : null;
  const endRaw = after && after.process ? after.process.rssBytes : null;
  const start = Number(startRaw);
  const end = Number(endRaw);
  if (startRaw === null || endRaw === null || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round(((end - start) / MI_BYTES) * 100) / 100);
}

/** Remove token/tag/player-identity fields from anything about to be stored. */
export function redactArtifact(value, seen = new WeakSet()) {
  if (Array.isArray(value)) return value.map((entry) => redactArtifact(entry, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/^(?:token|tokens|tag|tags|playerId|playerTag|authorization|cookie|set-cookie|ip|remoteAddress)$/i.test(key)) continue;
    out[key] = redactArtifact(entry, seen);
  }
  return out;
}

function failure(metric, kind, observed, threshold, detail = '') {
  return { metric, kind, observed, threshold, detail };
}

/**
 * Evaluate one generator run against the resolved thresholds.
 * `latencyOnly` is the flake policy input: only latency metrics may qualify
 * for the 2-of-3 pass rule; correctness always needs every run.
 */
export function evaluateRun({ scenario, thresholds, before, after, summary, bodies = null }) {
  const failures = [];
  const isChaos = scenario.generator === 'chaos';
  if (isChaos) {
    for (const message of Array.isArray(summary && summary.failures) ? summary.failures : ['chaos report missing']) {
      failures.push(failure('chaos', 'correctness', message, null, String(message)));
    }
    if (thresholds.reconnectMs != null && summary && Number.isFinite(summary.reconnectMaxMs) && summary.reconnectMaxMs > thresholds.reconnectMs) {
      failures.push(failure('reconnectMs', 'correctness', summary.reconnectMaxMs, thresholds.reconnectMs, 'chaos reconnect exceeded the 5 s hint'));
    }
    return { failures, latencyOnly: false };
  }

  if (!after || !after.http || !after.eventLoopDelay) {
    failures.push(failure('metrics', 'correctness', null, null, 'post-run /api/metrics missing'));
    return { failures, latencyOnly: false };
  }

  const httpP95 = Number(after.http.latencyMs && after.http.latencyMs.p95Ms);
  if (thresholds.httpP95Ms != null && Number.isFinite(httpP95) && httpP95 > thresholds.httpP95Ms) {
    failures.push(failure('httpP95Ms', 'latency', httpP95, thresholds.httpP95Ms));
  }
  const loopP95 = Number(after.eventLoopDelay.p95Ms);
  if (thresholds.loopP95Ms != null && Number.isFinite(loopP95) && loopP95 > thresholds.loopP95Ms) {
    failures.push(failure('loopP95Ms', 'latency', loopP95, thresholds.loopP95Ms));
  }
  const beforeDropped = Number(before && before.sse && before.sse.dropped) || 0;
  const afterDropped = Number(after.sse && after.sse.dropped) || 0;
  const dropped = Math.max(0, afterDropped - beforeDropped);
  if (thresholds.droppedSse != null && dropped > thresholds.droppedSse) {
    failures.push(failure('droppedSse', 'correctness', dropped, thresholds.droppedSse));
  }
  const stats = summary && summary.summary && typeof summary.summary === 'object' ? summary.summary : summary;
  const beforeErrors = Number(before && before.http && before.http.errors) || 0;
  const afterErrors = Number(after.http && after.http.errors) || 0;
  const reportErrors = Number(stats && stats.errors) || 0;
  const errors = reportErrors + Math.max(0, afterErrors - beforeErrors);
  if (thresholds.errors != null && errors > thresholds.errors) {
    failures.push(failure('errors', 'correctness', errors, thresholds.errors));
  }
  if (thresholds.joinP95Ms != null && Number.isFinite(stats && stats.joinP95Ms) && stats.joinP95Ms > thresholds.joinP95Ms) {
    failures.push(failure('joinP95Ms', 'latency', stats.joinP95Ms, thresholds.joinP95Ms));
  }
  if (thresholds.clickP95Ms != null && Number.isFinite(stats && stats.clickP95Ms) && stats.clickP95Ms > thresholds.clickP95Ms) {
    failures.push(failure('clickP95Ms', 'latency', stats.clickP95Ms, thresholds.clickP95Ms));
  }
  if (thresholds.rssGrowthMiB != null) {
    const growth = rssGrowthMiB(before, after);
    if (growth != null && growth > thresholds.rssGrowthMiB) {
      failures.push(failure('rssGrowthMiB', 'correctness', growth, thresholds.rssGrowthMiB));
    }
  }
  if (bodies) {
    const sizes = [bodies.state, bodies.world].filter((entry) => entry && Number.isFinite(entry.bytes));
    const largest = sizes.length ? Math.max(...sizes.map((entry) => entry.bytes)) : 0;
    if (thresholds.responseBodyMiB != null && largest > thresholds.responseBodyMiB * MI_BYTES) {
      failures.push(failure('responseBodyMiB', 'correctness', Math.round((largest / MI_BYTES) * 100) / 100, thresholds.responseBodyMiB));
    }
  }
  return { failures, latencyOnly: failures.every((entry) => entry.kind === 'latency') };
}

/**
 * Gate verdict from per-run results.
 * - pass: every run is clean;
 * - flaky: repeat 3, only latency failures, at least 2 clean runs;
 * - fail: any correctness failure or fewer than 2 clean runs.
 */
export function verdictFor(runs) {
  if (!Array.isArray(runs) || !runs.length) return 'fail';
  const clean = runs.filter((run) => run && Array.isArray(run.failures) && run.failures.length === 0).length;
  const correctness = runs.some((run) => Array.isArray(run.failures) && run.failures.some((entry) => entry.kind !== 'latency'));
  if (correctness) return 'fail';
  if (clean === runs.length) return 'pass';
  if (runs.length >= 3 && clean >= 2) return 'flaky';
  return 'fail';
}

function formatRow(row) {
  return `| ${row.scenario} | ${row.run}/${row.repeat} | ${row.verdict} | ${row.httpP95Ms ?? '—'} | ${row.loopP95Ms ?? '—'} | ${row.droppedSse ?? '—'} | ${row.errors ?? '—'} | ${row.joinP95Ms ?? '—'} | ${row.clickP95Ms ?? '—'} | ${row.rssGrowthMiB ?? '—'} | ${row.reconnectMaxMs ?? '—'} |`;
}

/** Plain-markdown operator table; the report is a document, not a DOM UI. */
export function renderSummaryMarkdown({ generatedAt, scenarios, verdict, runs, artifacts }) {
  const lines = [
    '# NARIMATO performance gate',
    '',
    `- Generated: ${generatedAt}`,
    `- Scenarios: ${scenarios.join(', ')}`,
    `- Verdict: **${verdict.toUpperCase()}**`,
    `- Artifacts: ${artifacts}`,
    '',
    '| Scenario | Run | Verdict | HTTP p95 ms | Loop p95 ms | Dropped SSE | Errors | Join p95 ms | Click p95 ms | RSS growth MiB | Reconnect ms |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of runs) lines.push(formatRow(row));
  lines.push('');
  const failures = runs.flatMap((row) => (row.failures || []).map((entry) => `- ${row.scenario} run ${row.run}: ${entry.metric} ${entry.observed} > ${entry.threshold ?? '—'} (${entry.kind})`));
  if (failures.length) {
    lines.push('## Failures', '', ...failures, '');
  } else {
    lines.push('No threshold failures.', '');
  }
  lines.push('Thresholds: `observability/slo.json`; scenarios: `observability/load-scenarios.json`.');
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = { only: [], dryRun: false, out: DEFAULT_OUT, scenarios: DEFAULT_SCENARIOS, rules: DEFAULT_RULES, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--only=')) options.only.push(...arg.slice(7).split(',').filter(Boolean));
    else if (arg === '--only') options.only.push(...String(argv[index + 1] || '').split(',').filter(Boolean)), (index += 1);
    else if (arg.startsWith('--out=')) options.out = path.resolve(arg.slice(6));
    else if (arg === '--out') options.out = path.resolve(argv[index + 1] || DEFAULT_OUT), (index += 1);
    else if (arg.startsWith('--scenarios=')) options.scenarios = path.resolve(arg.slice(12));
    else if (arg === '--scenarios') options.scenarios = path.resolve(argv[index + 1] || DEFAULT_SCENARIOS), (index += 1);
    else if (arg.startsWith('--rules=')) options.rules = path.resolve(arg.slice(8));
    else if (arg === '--rules') options.rules = path.resolve(argv[index + 1] || DEFAULT_RULES), (index += 1);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function selectScenarios(document, only) {
  const all = document.scenarios;
  const ids = only.length ? [...new Set(only)] : all.map((scenario) => scenario.id);
  const unknown = ids.filter((id) => !all.some((scenario) => scenario.id === id));
  if (unknown.length) throw new Error(`unknown scenario(s): ${unknown.join(', ')}`);
  return all.filter((scenario) => ids.includes(scenario.id));
}

/** Common env for every ephemeral server; limits stay tunable from scenarios. */
function serverEnv(document, scenario) {
  const defaults = document.defaults && document.defaults.serverEnv && typeof document.defaults.serverEnv === 'object' ? document.defaults.serverEnv : {};
  const overrides = scenario.serverEnv && typeof scenario.serverEnv === 'object' ? scenario.serverEnv : {};
  return {
    SECURITY_MODE: 'enforce',
    BOTS: '0',
    CLICK_COOLDOWN_MS: '0',
    LIMIT_JOIN_MAX: '1000',
    LIMIT_JOIN_WINDOW_MS: '60000',
    LIMIT_JOIN_BURST: '1000',
    LIMIT_ACTION_IP_MAX: '200000',
    LIMIT_ACTION_IP_BURST: '200000',
    MAX_SSE_PER_IP: '500',
    MAX_SSE_GLOBAL: '5000',
    ...defaults,
    ...overrides,
  };
}

function tail(value, limit = 4000) {
  const text = String(value || '');
  return text.length > limit ? text.slice(-limit) : text;
}

function spawnServer({ cwd, env }) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd,
    env: { ...process.env, ...env, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  let settled = false;
  const ready = new Promise((resolve, reject) => {
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const onData = (chunk) => {
      log += chunk;
      const match = /url:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(log);
      if (match) finish(resolve, match[1]);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => {
      log += chunk;
    });
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code, signal) => finish(reject, new Error(`server exited before ready (code=${code} signal=${signal})\n${tail(log)}`)));
    const timer = setTimeout(() => finish(reject, new Error(`server did not start within 10 s\n${tail(log)}`)), 10000);
    timer.unref?.();
  });
  return {
    child,
    ready,
    getLog: () => log,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      const exited = new Promise((resolve) => child.once('exit', resolve));
      const forced = setTimeout(() => child.kill('SIGKILL'), 5000);
      forced.unref?.();
      await Promise.race([exited, delay(6000)]);
      clearTimeout(forced);
    },
  };
}

function runProcess({ cwd, args, env, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, signal: null, timedOut, stdout, stderr: `${stderr}\n${error.message}`, error: error.message });
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stdout, stderr });
    });
  });
}

async function readReport(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function bodySizes(baseUrl) {
  const out = {};
  for (const [key, route] of [['state', '/api/state'], ['world', '/api/world']]) {
    try {
      const response = await fetch(`${baseUrl}${route}`, { headers: { accept: 'application/json' } });
      if (!response.ok) {
        out[key] = { status: response.status, bytes: null };
        continue;
      }
      const bytes = (await response.arrayBuffer()).byteLength;
      out[key] = { status: response.status, bytes };
    } catch (error) {
      out[key] = { status: 0, bytes: null, error: error?.name || 'unreachable' };
    }
  }
  return out;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function generatorEnv(scenario, baseUrl) {
  return {
    BASE_URL: baseUrl,
    CLIENTS: String(scenario.clients ?? 10),
    CLICKS: String(scenario.clicks ?? 0),
    SSE_CLIENTS: String(scenario.sseClients ?? 0),
    DURATION_SECONDS: String(scenario.durationSeconds ?? 0),
    CLICK_PAUSE_MS: String(scenario.clickPauseMs ?? 0),
    TAG_PREFIX: `GATE${String(scenario.id || 'x').toUpperCase().slice(0, 3)}`,
    SCENARIO: scenario.id,
  };
}

async function runLoadScenario({ document, scenario, ruleset, outDir }) {
  const thresholds = resolveThresholds(scenario, ruleset);
  const runs = [];
  for (let run = 1; run <= scenario.repeat; run += 1) {
    console.log(`scenario ${scenario.id} run ${run}/${scenario.repeat}`);
    const dataDir = await mkdtemp(path.join(os.tmpdir(), `narimato-gate-${scenario.id}-`));
    const reportFile = path.join(dataDir, 'generator-report.json');
    let server = null;
    const startedAt = Date.now();
    try {
      server = spawnServer({ cwd: ROOT, env: { ...serverEnv(document, scenario), DATA_DIR: dataDir } });
      const baseUrl = await server.ready;
      const before = await fetch(`${baseUrl}/api/metrics`).then((response) => response.json()).catch(() => null);
      const result = await runProcess({
        cwd: ROOT,
        args: ['scripts/load-test.mjs', '--report', reportFile],
        env: generatorEnv(scenario, baseUrl),
        timeoutMs: Math.max(10000, Number(scenario.timeoutSeconds) * 1000),
      });
      const summary = await readReport(reportFile);
      const after = await fetch(`${baseUrl}/api/metrics`).then((response) => response.json()).catch(() => null);
      const bodies = await bodySizes(baseUrl);
      const evaluation = evaluateRun({ scenario, thresholds, before, after, summary, bodies });
      if (!summary) {
        evaluation.failures.push(failure('generator', 'correctness', null, null, `generator report missing (exit ${result.code}${result.timedOut ? ', timed out' : ''})`));
      } else if (result.timedOut) {
        evaluation.failures.push(failure('generator', 'correctness', null, null, 'generator exceeded its scenario timeout'));
      }
      const row = {
        scenario: scenario.id,
        run,
        repeat: scenario.repeat,
        verdict: evaluation.failures.length ? 'FAIL' : 'PASS',
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        thresholds,
        before: before || null,
        after: after || null,
        summary: summary || null,
        bodies,
        failures: evaluation.failures,
        generatorExit: { code: result.code, signal: result.signal, timedOut: result.timedOut },
        stderrTail: result.code ? tail(result.stderr) : undefined,
      };
      runs.push(row);
    } catch (error) {
      runs.push({
        scenario: scenario.id,
        run,
        repeat: scenario.repeat,
        verdict: 'FAIL',
        failures: [failure('harness', 'correctness', null, null, error?.message || String(error))],
        stderrTail: tail(server?.getLog?.()),
      });
    } finally {
      await server?.stop();
      await rm(dataDir, { recursive: true, force: true });
    }
    await delay(500);
  }
  const verdict = verdictFor(runs);
  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    scenario: {
      id: scenario.id,
      generator: scenario.generator,
      clients: scenario.clients,
      sseClients: scenario.sseClients,
      clicks: scenario.clicks,
      durationSeconds: scenario.durationSeconds,
      clickPauseMs: scenario.clickPauseMs,
      repeat: scenario.repeat,
    },
    thresholds,
    verdict,
    runs,
  };
  await writeFile(path.join(outDir, `${scenario.id}.json`), `${JSON.stringify(redactArtifact(artifact), null, 2)}\n`);
  return { scenario, runs, verdict };
}

async function runChaosScenario({ document, scenario, ruleset, outDir }) {
  const thresholds = resolveThresholds(scenario, ruleset);
  const runs = [];
  for (let run = 1; run <= scenario.repeat; run += 1) {
    console.log(`scenario ${scenario.id} run ${run}/${scenario.repeat}`);
    const dataDir = await mkdtemp(path.join(os.tmpdir(), `narimato-gate-${scenario.id}-`));
    const reportFile = path.join(dataDir, 'generator-report.json');
    const startedAt = Date.now();
    try {
      const port = await freePort();
      const result = await runProcess({
        cwd: ROOT,
        args: ['scripts/chaos-test.mjs', '--report', reportFile],
        env: { ...generatorEnv(scenario, `http://127.0.0.1:${port}`), NARIMATO_CHAOS_PORT: String(port) },
        timeoutMs: Math.max(10000, Number(scenario.timeoutSeconds) * 1000),
      });
      const summary = await readReport(reportFile);
      const evaluation = evaluateRun({ scenario, thresholds, before: null, after: null, summary });
      if (!summary) {
        evaluation.failures.push(failure('generator', 'correctness', null, null, `chaos report missing (exit ${result.code}${result.timedOut ? ', timed out' : ''})`));
      } else if (result.timedOut) {
        evaluation.failures.push(failure('generator', 'correctness', null, null, 'chaos test exceeded its scenario timeout'));
      }
      runs.push({
        scenario: scenario.id,
        run,
        repeat: scenario.repeat,
        verdict: evaluation.failures.length ? 'FAIL' : 'PASS',
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        thresholds,
        summary: summary || null,
        failures: evaluation.failures,
        generatorExit: { code: result.code, signal: result.signal, timedOut: result.timedOut },
        stderrTail: result.code ? tail(result.stderr) : undefined,
      });
    } catch (error) {
      runs.push({
        scenario: scenario.id,
        run,
        repeat: scenario.repeat,
        verdict: 'FAIL',
        failures: [failure('harness', 'correctness', null, null, error?.message || String(error))],
      });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  }
  const verdict = verdictFor(runs);
  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    scenario: { id: scenario.id, generator: scenario.generator, clients: scenario.clients, sseClients: scenario.sseClients, repeat: scenario.repeat },
    thresholds,
    verdict,
    runs,
  };
  await writeFile(path.join(outDir, `${scenario.id}.json`), `${JSON.stringify(redactArtifact(artifact), null, 2)}\n`);
  return { scenario, runs, verdict };
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`perf-gate — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.error('usage: node scripts/perf-gate.mjs [--only=smoke|load|soak|chaos] [--dry-run] [--out=dir] [--scenarios=file] [--rules=file]');
    return 0;
  }
  let document;
  let ruleset;
  let scenarios;
  try {
    document = await loadScenarios(options.scenarios);
    ruleset = await loadRuleset(options.rules);
    scenarios = selectScenarios(document, options.only);
    const required = new Set(document.scenarios.map((scenario) => scenario.id));
    const missing = REQUIRED_SCENARIOS.filter((id) => !required.has(id));
    if (missing.length) throw new Error(`scenario file is missing: ${missing.join(', ')}`);
    for (const scenario of document.scenarios) {
      const problems = validateScenario(scenario, { ruleset });
      if (problems.length) throw new Error(`scenario ${scenario.id}: ${problems.join('; ')}`);
    }
  } catch (error) {
    console.error(`perf-gate — ${error.message}`);
    return 2;
  }

  if (options.dryRun) {
    for (const scenario of scenarios) {
      const thresholds = resolveThresholds(scenario, ruleset);
      console.log(`plan ${scenario.id}: ${scenario.generator} clients=${scenario.clients ?? '—'} sse=${scenario.sseClients ?? '—'} clicks=${scenario.clicks ?? '—'} duration=${scenario.durationSeconds ?? '—'}s repeat=${scenario.repeat} thresholds=${JSON.stringify(thresholds)}`);
    }
    console.log('dry run: nothing started, no artifacts written');
    return 0;
  }

  await mkdir(options.out, { recursive: true });
  const results = [];
  for (const scenario of scenarios) {
    const result = scenario.generator === 'chaos'
      ? await runChaosScenario({ document, scenario, ruleset, outDir: options.out })
      : await runLoadScenario({ document, scenario, ruleset, outDir: options.out });
    results.push(result);
  }

  const runs = results.flatMap((result) => result.runs);
  const verdict = verdictFor(runs);
  const generatedAt = new Date().toISOString();
  const summary = {
    version: 1,
    generatedAt,
    verdict,
    scenarios: results.map((result) => result.scenario.id),
    artifacts: options.out,
    thresholdsSource: options.rules,
    scenariosSource: options.scenarios,
    runs: runs.map((row) => ({
      scenario: row.scenario,
      run: row.run,
      repeat: row.repeat,
      verdict: row.verdict,
      failures: row.failures || [],
      httpP95Ms: row.after?.http?.latencyMs?.p95Ms ?? null,
      loopP95Ms: row.after?.eventLoopDelay?.p95Ms ?? null,
      droppedSse: row.after?.sse?.dropped ?? null,
      errors: (row.summary?.summary || row.summary)?.errors ?? null,
      joinP95Ms: (row.summary?.summary || row.summary)?.joinP95Ms ?? null,
      clickP95Ms: (row.summary?.summary || row.summary)?.clickP95Ms ?? null,
      rssGrowthMiB: row.before && row.after ? rssGrowthMiB(row.before, row.after) : null,
      reconnectMaxMs: row.summary?.reconnectMaxMs ?? null,
    })),
  };
  await writeFile(path.join(options.out, 'summary.json'), `${JSON.stringify(redactArtifact(summary), null, 2)}\n`);
  const markdown = renderSummaryMarkdown({
    generatedAt,
    scenarios: summary.scenarios,
    verdict,
    runs: summary.runs.map((row) => ({ ...row, httpP95Ms: row.httpP95Ms, perRun: row.repeat })),
    artifacts: options.out,
  });
  await writeFile(path.join(options.out, 'summary.md'), markdown);

  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else {
    for (const row of summary.runs) {
      console.log(`| ${row.scenario} | ${row.run}/${row.repeat} | ${row.verdict} | ${row.httpP95Ms ?? '—'} | ${row.loopP95Ms ?? '—'} | ${row.droppedSse ?? '—'} | ${row.errors ?? '—'} | ${row.joinP95Ms ?? '—'} | ${row.clickP95Ms ?? '—'} | ${row.rssGrowthMiB ?? '—'} | ${row.reconnectMaxMs ?? '—'} |`);
    }
    if (verdict === 'pass') console.log(`GATE PASS — ${summary.runs.length} run(s); artifacts: ${options.out}`);
    else if (verdict === 'flaky') console.log(`GATE FLAKY — latency-only failure(s); artifacts: ${options.out}`);
    else console.log(`GATE FAIL — artifacts: ${options.out}`);
  }
  return verdict === 'fail' ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = await main(process.argv.slice(2));
}

export default {
  loadScenarios,
  loadRuleset,
  flattenRules,
  resolveThresholds,
  validateScenario,
  evaluateRun,
  verdictFor,
  rssGrowthMiB,
  redactArtifact,
  renderSummaryMarkdown,
};
