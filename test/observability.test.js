/**
 * Track B0 observability tests: /api/metrics shape + aggregates, SSE counters,
 * privacy (no tokens/tags/ids/hidden deposits), /api/telemetry whitelist,
 * body cap, same-origin and rate limiting, and the browser beacon module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { startServer } from '../server.js';
import { normalizeTelemetryPayload, normalizeRoute } from '../lib/metrics.js';
import { buildTelemetryPayload, createTelemetry } from '../public/js/telemetry.js';

async function makeObsServer(t, { config = {}, serverOptions = {} } = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'icosa-obs-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0, ...config },
    ...serverOptions,
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { handle, base: `http://127.0.0.1:${handle.port}` };
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function postTelemetry(base, payload, headers = {}) {
  return getJson(`${base}/api/telemetry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

async function openSse(base, token) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/events?token=${encodeURIComponent(token)}`, { signal: controller.signal });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  let first = null;
  const readFirst = (async () => {
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    const line = text.split('\n').find((entry) => entry.startsWith('data: '));
    if (line) first = JSON.parse(line.slice(6));
    // Keep the stream open in the background.
    try {
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      /* aborted */
    }
  })();
  void readFirst;
  for (let i = 0; i < 100 && !first; i += 1) await delay(10);
  return {
    first,
    close() {
      controller.abort();
    },
  };
}

// --------------------------------------------------------------- unit helpers

test('observability: telemetry whitelist + route normalisation primitives', () => {
  assert.equal(normalizeRoute('/api/join'), '/api/join');
  assert.equal(normalizeRoute('/api/state?token=x'), '/api/state');
  assert.equal(normalizeRoute('/api/unknown/deeper'), '/api/unknown');
  assert.equal(normalizeRoute('/'), 'static:/');
  assert.equal(normalizeRoute('/css/cyberpunk.css'), 'static');
  assert.equal(normalizeRoute(''), '/');

  const normalized = normalizeTelemetryPayload({
    webVitals: { lcp: 1234.5, cls: 'PII-STRING', inp: -5, ttfb: 999999999 },
    hud: { longTasks: 4, maxLongTask: 250 },
    audio: { firstWordMs: 320 },
    viewport: { width: 1280, height: 720, dpr: 100 },
    sessionMs: 9000,
    errors: { js: 2, network: 'x', unhandled: 1 },
    token: 'secret-token',
    tag: 'HACKER',
    playerId: 'p_secret',
    nested: { weird: true },
  });
  assert.equal(normalized.fields['webVitals.lcp'], 1234.5);
  assert.equal(normalized.fields['webVitals.cls'], undefined, 'strings are ignored');
  assert.equal(normalized.fields['webVitals.inp'], 0, 'clamped to >= 0');
  assert.equal(normalized.fields['webVitals.ttfb'], 60000, 'clamped to max');
  assert.equal(normalized.fields['viewport.dpr'], 10, 'dpr clamped');
  assert.equal(normalized.fields.sessionMs, 9000);
  assert.equal(normalized.fields['errors.network'], undefined);
  const serialized = JSON.stringify(normalized);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('HACKER'), false);
  assert.equal(serialized.includes('p_secret'), false);
});

test('observability: client telemetry module is node-safe and numeric-only', () => {
  const payload = buildTelemetryPayload({
    webVitals: { lcp: 100, cls: 0.1, inp: 22 },
    hud: { longTasks: 1, maxLongTask: 50 },
    audio: { firstWordMs: 280 },
    viewport: { width: 390, height: 844, dpr: 3 },
    sessionMs: 1234,
    errors: { js: 1 },
    token: 'nope',
    tag: 'NOPE',
  });
  assert.deepEqual(payload, {
    webVitals: { lcp: 100, cls: 0.1, inp: 22 },
    hud: { longTasks: 1, maxLongTask: 50 },
    audio: { firstWordMs: 280 },
    viewport: { width: 390, height: 844, dpr: 3 },
    sessionMs: 1234,
    errors: { js: 1 },
  });
  assert.equal(JSON.stringify(payload).includes('NOPE'), false);
  // No window/document -> safe no-op controller.
  const controller = createTelemetry({ win: null, doc: null, endpoint: '/api/telemetry' });
  assert.doesNotThrow(() => controller.install());
  assert.equal(controller.send('session'), false);
  assert.doesNotThrow(() => controller.markAudioFirstWord(100));
  assert.doesNotThrow(() => controller.recordError('js'));
  assert.equal(controller.getPayload().hud.longTasks, 0);
});

// ------------------------------------------------------------- /api/metrics

test('observability: /api/metrics exposes HTTP/process/SSE/planets/telemetry aggregates', async (t) => {
  const { base } = await makeObsServer(t);
  await getJson(`${base}/api/state`);
  await getJson(`${base}/api/leaderboard`);
  await getJson(`${base}/nope`); // static 404
  await getJson(`${base}/api/does-not-exist`); // API 404
  const join = await getJson(`${base}/api/join`, { method: 'POST', body: JSON.stringify({ tag: 'METRICS1' }) });
  assert.equal(join.status, 200);

  const res = await getJson(`${base}/api/metrics`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const metrics = res.json;
  assert.equal(metrics.ok, true);
  assert.equal(typeof metrics.generatedAt, 'number');
  assert.equal(typeof metrics.uptimeMs, 'number');
  assert.equal(typeof metrics.process.heapUsedBytes, 'number');
  assert.equal(typeof metrics.process.heapTotalBytes, 'number');
  assert.equal(typeof metrics.process.rssBytes, 'number');
  assert.equal(typeof metrics.http.requests, 'number');
  assert.ok(metrics.http.requests >= 6);
  assert.equal(metrics.http.errors, 0);
  assert.ok(metrics.http.clientErrors >= 2);
  for (const route of ['/api/state', '/api/leaderboard', '/api/join', 'static', '/api/does-not-exist']) {
    assert.ok(metrics.http.routes[route] >= 1, `route ${route} counted`);
  }
  assert.ok(metrics.http.statuses['200'] >= 1);
  assert.ok(metrics.http.statuses['404'] >= 1);
  assert.ok(metrics.http.latencyMs.count >= 1);
  for (const field of ['p50Ms', 'p95Ms', 'p99Ms', 'maxMs', 'avgMs', 'sumMs']) {
    assert.equal(typeof metrics.http.latencyMs[field], 'number');
  }
  assert.deepEqual(Object.keys(metrics.sse).sort(), ['active', 'byPlanet', 'closed', 'dropped', 'opened']);
  assert.equal(metrics.planets.length, 1);
  assert.deepEqual(Object.keys(metrics.planets[0]).sort(), [
    'breaks',
    'clicks',
    'depth',
    'faces',
    'index',
    'maxDepthReached',
    'name',
    'playersOnline',
    'playersTotal',
    'revision',
    'robots',
  ]);
  assert.equal(metrics.planets[0].index, 0);
  assert.equal(metrics.planets[0].playersOnline, 1);
  assert.equal(metrics.planets[0].robots, 0);
  assert.equal(typeof metrics.eventLoop.enabled, 'boolean');
  assert.equal(typeof metrics.eventLoopDelay.p95Ms, 'number');
  assert.equal(typeof metrics.telemetry.reports, 'number');
  assert.deepEqual(Object.keys(metrics.telemetry.aggregates), []);
});

test('observability: SSE counters track active/opened/closed and per-planet streams', async (t) => {
  const { base } = await makeObsServer(t);
  const join = await getJson(`${base}/api/join`, { method: 'POST', body: JSON.stringify({ tag: 'SSEOBS' }) });
  const token = join.json.token;

  const sse = await openSse(base, token);
  assert.equal(sse.first.type, 'snapshot');
  await delay(80);
  let metrics = (await getJson(`${base}/api/metrics`)).json;
  assert.ok(metrics.sse.opened >= 1);
  assert.ok(metrics.sse.active >= 1);
  assert.ok(metrics.sse.byPlanet['0'] && metrics.sse.byPlanet['0'].active >= 1);
  // SSE connections are counted as connections, not HTTP latency samples.
  assert.ok(metrics.http.routes['/api/events'] >= 1);

  sse.close();
  await delay(150);
  metrics = (await getJson(`${base}/api/metrics`)).json;
  assert.equal(metrics.sse.active, 0);
  assert.ok(metrics.sse.closed >= 1);
  assert.ok(metrics.sse.byPlanet['0'].closed >= 1);
  // SSE connections are counted as connections, not latency samples.
  assert.equal(metrics.http.latencyMs.count, metrics.http.finished - metrics.sse.closed);
});

test('observability: metrics never leak tokens, tags, player ids or hidden deposits', async (t) => {
  const { base, handle } = await makeObsServer(t, { config: { depositChance: 1, planetSeed: 424242 } });
  const join = await getJson(`${base}/api/join`, { method: 'POST', body: JSON.stringify({ tag: 'PRIVACY77' }) });
  assert.equal(join.status, 200);
  const playerId = join.json.player.id;
  const token = join.json.token;
  await getJson(`${base}/api/state?token=${token}`);
  const core = handle.manager.planetCore(0);
  const hiddenLabel = [...core.getLeafMap().values()].find((cell) => cell.resourceId && !cell.resourceFound)?.label;
  assert.ok(hiddenLabel);

  const metrics = await getJson(`${base}/api/metrics`);
  const text = metrics.text;
  assert.equal(text.includes(token), false, 'no tokens');
  assert.equal(text.includes('PRIVACY77'), false, 'no tags');
  assert.equal(text.includes(playerId), false, 'no player ids');
  assert.equal(text.includes('resourceId'), false, 'no deposits');
  assert.equal(text.includes('resourceFindClick'), false, 'no hidden discovery clicks');
  assert.equal(text.includes('hiddenDeposit'), false);
  assert.equal(text.includes('players"'), false, 'no raw player arrays');
  // Planet aggregates stay read-only counters.
  for (const planet of metrics.json.planets) {
    assert.equal(Object.prototype.hasOwnProperty.call(planet, 'players'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(planet, 'leaves'), false);
  }
});

// ------------------------------------------------------------- /api/telemetry

test('observability: /api/telemetry accepts whitelisted numeric metrics, clamps and aggregates', async (t) => {
  const { base } = await makeObsServer(t);
  let res = await postTelemetry(base, {
    webVitals: { lcp: 1234.5, cls: 0.1, inp: 20, ttfb: 150 },
    hud: { longTasks: 2, maxLongTask: 120 },
    audio: { firstWordMs: 280 },
    viewport: { width: 390, height: 844, dpr: 3 },
    sessionMs: 12_000,
    errors: { js: 1, network: 2, unhandled: 0 },
    token: 'SECRET-TOKEN',
    tag: 'PRIVATETAG',
    cookie: 'x',
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.ok(res.json.accepted >= 10);

  await postTelemetry(base, { webVitals: { lcp: 999_999_999 }, viewport: { dpr: 100 }, sessionMs: 500 });
  let aggregate = (await getJson(`${base}/api/telemetry`)).json.telemetry;
  assert.equal(aggregate.reports, 2);
  assert.equal(aggregate.aggregates['webVitals.lcp'].count, 2);
  assert.equal(aggregate.aggregates['webVitals.lcp'].max, 120_000, 'clamped to the schema maximum');
  assert.equal(aggregate.aggregates['viewport.dpr'].max, 10);
  assert.equal(JSON.stringify(aggregate).includes('SECRET-TOKEN'), false);
  assert.equal(JSON.stringify(aggregate).includes('PRIVATETAG'), false);

  const metrics = await getJson(`${base}/api/metrics`);
  assert.equal(metrics.json.telemetry.reports, 2);
  assert.ok(metrics.json.http.routes['/api/telemetry'] >= 3);

  // Unknown-only payloads are rejected from aggregation but accepted as a no-op request.
  res = await postTelemetry(base, { tag: 'SOMEONE', token: 'abc', random: { weird: 1 } });
  assert.equal(res.status, 200);
  assert.equal(res.json.accepted, 0);
  aggregate = (await getJson(`${base}/api/telemetry`)).json.telemetry;
  assert.equal(aggregate.rejected, 1);
});

test('observability: telemetry body cap, invalid JSON, same-origin and rate limiting', async (t) => {
  const { base } = await makeObsServer(t, { serverOptions: { telemetryRateLimit: { max: 2, windowMs: 60_000 } } });

  // Invalid JSON.
  let res = await getJson(`${base}/api/telemetry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'INVALID_JSON');

  // Cross-origin beacon rejected.
  res = await postTelemetry(base, { webVitals: { lcp: 100 } }, { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'CROSS_ORIGIN');

  // Oversized body rejected before touching the rate limit.
  const oversized = JSON.stringify({ webVitals: { lcp: 1 }, pad: 'x'.repeat(5000) });
  res = await getJson(`${base}/api/telemetry`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: oversized });
  assert.equal(res.status, 413);
  assert.equal(res.json.error, 'PAYLOAD_TOO_LARGE');

  // Two valid reports pass, the third is rate limited.
  res = await postTelemetry(base, { webVitals: { lcp: 10 } });
  assert.equal(res.status, 200);
  res = await postTelemetry(base, { webVitals: { lcp: 20 } });
  assert.equal(res.status, 200);
  res = await postTelemetry(base, { webVitals: { lcp: 30 } });
  assert.equal(res.status, 429);
  assert.equal(res.json.error, 'RATE_LIMITED');
  const aggregate = (await getJson(`${base}/api/telemetry`)).json.telemetry;
  assert.equal(aggregate.reports, 2);
});

test('observability: telemetry beacons do not change game state or expose hidden data', async (t) => {
  const { base } = await makeObsServer(t, { config: { depositChance: 1, planetSeed: 424242 } });
  const before = (await getJson(`${base}/api/state`)).json.state;
  await postTelemetry(base, { webVitals: { lcp: 42 }, sessionMs: 1000 });
  const after = (await getJson(`${base}/api/state`)).json.state;
  assert.equal(after.faces, before.faces);
  assert.equal(after.totalClicks, before.totalClicks);
  assert.equal(after.planetSeed, before.planetSeed);
  const metrics = (await getJson(`${base}/api/metrics`)).json;
  assert.equal(metrics.telemetry.reports, 1);
  assert.equal(metrics.sse.active, 0);
});
