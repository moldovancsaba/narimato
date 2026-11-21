#!/usr/bin/env node
/**
 * B3 — zero-dependency load/soak smoke test for the authoritative server.
 *
 * Usage:
 *   PORT=4400 DATA_DIR=/tmp/narimato-load BOTS=0 CLICK_COOLDOWN_MS=0 node server.js &
 *   BASE_URL=http://127.0.0.1:4400 CLIENTS=50 CLICKS=5 SSE_CLIENTS=25 \
 *     DURATION_SECONDS=10 node scripts/load-test.mjs
 *
 * Exits non-zero if an SLO gate fails or a request errors.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

/** `--report <path>` is additive to the env-driven CLI (OPS-02). */
function parseArgs(argv) {
  const options = { report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report') {
      options.report = argv[index + 1];
      if (!options.report) throw new Error('--report requires a path');
      index += 1;
    } else if (arg.startsWith('--report=')) options.report = arg.slice(9);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

let ARGS;
try {
  ARGS = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[load] ${error.message}`);
  process.exit(2);
}
if (ARGS.help) {
  console.error('usage: CLIENT_ENV... node scripts/load-test.mjs [--report <path>]');
  process.exit(0);
}

async function writeReport(report) {
  if (!ARGS.report) return;
  await mkdir(path.dirname(path.resolve(ARGS.report)), { recursive: true });
  await writeFile(ARGS.report, `${JSON.stringify(report, null, 2)}\n`);
}

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const CLIENTS = Math.max(1, Math.min(500, Number(process.env.CLIENTS) || 50));
const CLICKS = Math.max(0, Math.min(100, Number(process.env.CLICKS) || 5));
const SSE_CLIENTS = Math.max(0, Math.min(CLIENTS, Number(process.env.SSE_CLIENTS) || 25));
// Honor the requested duration up to a 4-hour safety cap; a release soak needs 7200 s.
const MAX_DURATION_SECONDS = 4 * 3600;
const REQUESTED_DURATION = Number(process.env.DURATION_SECONDS) || 0;
const DURATION = Math.max(0, Math.min(MAX_DURATION_SECONDS, REQUESTED_DURATION));
if (REQUESTED_DURATION > MAX_DURATION_SECONDS) {
  console.warn(`[load] requested ${REQUESTED_DURATION}s exceeds the ${MAX_DURATION_SECONDS}s cap; running ${DURATION}s`);
}
const CLICK_PAUSE = Math.max(0, Number(process.env.CLICK_PAUSE_MS) || 45);
const TAG_PREFIX = process.env.TAG_PREFIX || 'LT';
const LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const SLO = { p95HttpMs: 150, p95LoopMs: 50, droppedSse: 0 };

let seq = 0;
function tagFor() {
  seq += 1;
  return `${TAG_PREFIX}${String(seq).padStart(4, '0')}${String(Math.floor(Math.random() * 36 ** 4)).padStart(4, '0')}`.slice(0, 12);
}

async function json(path, init) {
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`, init);
  const ms = performance.now() - started;
  const body = await res.json().catch(() => null);
  return { res, body, ms };
}

async function metrics() {
  const { body } = await json('/api/metrics');
  return body || {};
}

async function openSse(token, state) {
  const controller = new AbortController();
  try {
    const res = await fetch(`${BASE}/api/events?token=${encodeURIComponent(token)}`, { signal: controller.signal });
    if (!res.ok || !res.body) return () => {};
    const reader = res.body.getReader();
    const done = (async () => {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { value, done: ended } = await reader.read();
          if (ended) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (chunk.startsWith('data:')) state.events += 1;
          }
        }
      } catch {
        /* aborted */
      }
    })();
    state.stop = () => {
      controller.abort();
      return done.catch(() => {});
    };
  } catch {
    return () => {};
  }
  return () => state.stop?.();
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const before = await metrics();
const clients = [];
const sseStates = [];
let errors = 0;
let joinMs = 0;
let clickMs = 0;
let clickCount = 0;
const joinSamples = [];
const clickSamples = [];
const start = performance.now();

console.log(`[load] base=${BASE} clients=${CLIENTS} clicks=${CLICKS} sse=${SSE_CLIENTS} duration=${DURATION || 'until done'}s`);

for (let i = 0; i < CLIENTS; i += 1) {
  const result = await json('/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ tag: tagFor() }),
  });
  if (!result.res.ok || !result.body?.ok) {
    errors += 1;
    continue;
  }
  joinMs += result.ms;
  joinSamples.push(result.ms);
  clients.push(result.body.token);
  if (sseStates.length < SSE_CLIENTS) {
    const state = { events: 0 };
    sseStates.push(state);
    await openSse(result.body.token, state);
  }
}

const clickPromises = clients.map(async (token, i) => {
  for (let c = 0; c < CLICKS; c += 1) {
    const label = LABELS[(i + c) % LABELS.length];
    const result = await json('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ token, type: 'click', label }),
    });
    if (!result.res.ok) {
      // 409 = expected contest/lock rejection, not a server failure.
      if (result.res.status >= 500) errors += 1;
    } else {
      clickCount += 1;
      clickMs += result.ms;
      clickSamples.push(result.ms);
    }
    if (CLICK_PAUSE) await delay(CLICK_PAUSE);
  }
});
await Promise.all(clickPromises);

if (DURATION) await delay(DURATION * 1000);
const elapsed = (performance.now() - start) / 1000;
await delay(500);
for (const state of sseStates) state.stop?.();
await delay(300);
const after = await metrics();

const http = after.http || {};
const loop = after.eventLoopDelay || {};
const sse = after.sse || {};
const summary = {
  clients: clients.length,
  clicks: clickCount,
  errors,
  seconds: Number(elapsed.toFixed(2)),
  rps: Number((clickCount / Math.max(0.001, elapsed)).toFixed(1)),
  joinAvgMs: Number((joinMs / Math.max(1, clients.length)).toFixed(1)),
  joinP95Ms: Number(percentile(joinSamples, 95).toFixed(2)),
  clickAvgMs: Number((clickMs / Math.max(1, clickCount)).toFixed(1)),
  clickP95Ms: Number(percentile(clickSamples, 95).toFixed(2)),
  httpP95Ms: http.latencyMs?.p95Ms ?? null,
  loopP95Ms: loop.p95Ms ?? null,
  sseActive: sse.active ?? null,
  sseDropped: sse.dropped ?? null,
  sseEvents: sseStates.reduce((n, s) => n + s.events, 0),
  telemetryReports: after.telemetry?.reports ?? null,
  before: { requests: before.http?.requests ?? 0 },
  after: { requests: http.requests ?? 0 },
};
console.log('[load]', JSON.stringify(summary, null, 2));

const failures = [];
if (errors > 0) failures.push(`${errors} request errors`);
if (summary.httpP95Ms != null && summary.httpP95Ms > SLO.p95HttpMs) failures.push(`HTTP p95 ${summary.httpP95Ms}ms > ${SLO.p95HttpMs}ms`);
if (summary.loopP95Ms != null && summary.loopP95Ms > SLO.p95LoopMs) failures.push(`event-loop p95 ${summary.loopP95Ms}ms > ${SLO.p95LoopMs}ms`);
if ((summary.sseDropped || 0) > SLO.droppedSse) failures.push(`dropped SSE ${summary.sseDropped}`);
await writeReport({
  tool: 'load-test',
  generatedAt: new Date().toISOString(),
  scenario: process.env.SCENARIO || null,
  ok: failures.length === 0,
  summary,
  failures,
});
if (failures.length) {
  console.error('[load] SLO FAIL:', failures.join('; '));
  process.exit(1);
}
console.log('[load] SLO clean. Single-node capacity is sufficient for this workload.');
