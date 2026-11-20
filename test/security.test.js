/**
 * SEC-01 — security hardening contract.
 *
 * Unit: mode resolution, exact-origin policy, CSP/header assembly with and
 * without ASSET_BASE_URL, proxy-aware client IP, path safety.
 * Integration (`startServer({ port: 0 })`): headers, cross-origin 403, join and
 * action rate limits, body caps, static dotfile/symlink denial, SSE per-IP
 * admission and per-token replacement, token-guessing resistance, IP-free abuse
 * counters, and the compat-mode rollback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { startServer, MAX_BODY_BYTES, TELEMETRY_BODY_BYTES } from '../server.js';
import {
  assetOrigin,
  buildCsp,
  buildSecurityHeaders,
  checkOrigin,
  checkTelemetryOrigin,
  clientIp,
  hasDotfileSegment,
  isPathInside,
  parseAllowedOrigins,
  requestIsHttps,
  resolveSecurityConfig,
  securityHeadersFor,
} from '../lib/security.js';

const EVIL_ORIGIN = 'https://evil.example';

function hostOf(base) {
  return base.replace(/^http:\/\//, '');
}

async function makeServer(t, { security = { mode: 'enforce' }, config = {}, serverOptions = {} } = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-sec-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    security,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0, ...config },
    ...serverOptions,
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { handle, base: `http://127.0.0.1:${handle.port}` };
}

async function request(base, pathname, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* plain text */
  }
  return { status: response.status, headers: response.headers, json, text };
}

/** Raw path request that bypasses URL normalisation (traversal probes). */
function rawRequest(base, pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const request = http.request({ host: url.hostname, port: url.port, path: pathname, method: 'GET' }, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

/** POST with a same-origin Origin header (enforce mode requires it for writes). */
async function postSameOrigin(base, pathname, body) {
  return request(base, pathname, { method: 'POST', body, headers: { origin: base } });
}

async function join(base, tag, extra = {}) {
  return request(base, '/api/join', {
    method: 'POST',
    body: { tag },
    headers: { origin: base, ...extra },
  });
}

async function openSse(base, token) {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/events?token=${encodeURIComponent(token)}`, { signal: controller.signal });
  let finished = response.status !== 200;
  let text = '';
  if (response.status === 200) {
    const reader = response.body.getReader();
    void (async () => {
      try {
        for (;;) {
          const { done } = await reader.read();
          if (done) {
            finished = true;
            break;
          }
        }
      } catch {
        finished = true;
      }
    })();
  } else {
    text = await response.text();
  }
  return {
    status: response.status,
    headers: response.headers,
    text,
    get finished() {
      return finished;
    },
    close() {
      if (!finished) controller.abort();
    },
  };
}

// --------------------------------------------------------------------- unit

test('security: mode resolution defaults to compat outside production and enforce in production', () => {
  assert.equal(resolveSecurityConfig({}).mode, 'compat');
  assert.equal(resolveSecurityConfig({ NODE_ENV: 'production' }).mode, 'enforce');
  assert.equal(resolveSecurityConfig({ SECURITY_MODE: 'enforce' }).mode, 'enforce');
  assert.equal(resolveSecurityConfig({ SECURITY_MODE: 'compat' }).mode, 'compat');
  assert.equal(resolveSecurityConfig({ SECURITY_MODE: 'nonsense' }).mode, 'compat', 'invalid mode falls back safely');
  assert.equal(resolveSecurityConfig({ NODE_ENV: 'production' }, { mode: 'compat' }).mode, 'compat', 'override wins');
  // compat disables headers by default; enforce enables them.
  assert.equal(resolveSecurityConfig({}).headers.enabled, false);
  assert.equal(resolveSecurityConfig({ NODE_ENV: 'production' }).headers.enabled, true);
  assert.equal(resolveSecurityConfig({ NODE_ENV: 'production' }, { headers: false }).headers.enabled, false);
});

test('security: limits derive from the click cooldown and stay env-configurable', () => {
  const fast = resolveSecurityConfig({ NODE_ENV: 'production', CLICK_COOLDOWN_MS: '40' });
  assert.equal(fast.limits.action.max, 50);
  assert.equal(fast.limits.actionIp.max, 200);
  assert.deepEqual([fast.limits.join.max, fast.limits.join.windowMs, fast.limits.join.burst], [10, 60_000, 10]);
  assert.deepEqual([fast.limits.telemetry.max, fast.limits.telemetry.windowMs], [30, 60_000]);
  assert.equal(fast.maxSsePerIp, 4);
  assert.equal(fast.maxSseGlobal, 2000);

  const slow = resolveSecurityConfig({}, { clickCooldownMs: 100 });
  assert.equal(slow.limits.action.max, 20);
  const custom = resolveSecurityConfig({ MAX_SSE_PER_IP: '2', MAX_SSE_GLOBAL: '10', TRUST_PROXY: '1' });
  assert.equal(custom.maxSsePerIp, 2);
  assert.equal(custom.maxSseGlobal, 10);
  assert.equal(custom.trustProxy, true);
  const overridden = resolveSecurityConfig({}, { limits: { join: { max: 3 } } });
  assert.equal(overridden.limits.join.max, 3);
  assert.equal(overridden.limits.join.burst, 3, 'burst tracks a partial max override');

  // SEC-01: every limit is env-configurable; explicit startServer options win.
  const envLimits = resolveSecurityConfig({
    SECURITY_MODE: 'enforce',
    LIMIT_JOIN_MAX: '200',
    LIMIT_JOIN_WINDOW_MS: '5000',
    LIMIT_ACTION_IP_MAX: '1000',
    LIMIT_ACTION_IP_BURST: '500',
    LIMIT_TELEMETRY_MAX: '90',
  });
  assert.equal(envLimits.limits.join.max, 200);
  assert.equal(envLimits.limits.join.windowMs, 5000);
  assert.equal(envLimits.limits.join.burst, 200, 'env max without burst keeps full-window credit');
  assert.equal(envLimits.limits.actionIp.max, 1000);
  assert.equal(envLimits.limits.actionIp.burst, 500);
  assert.equal(envLimits.limits.telemetry.max, 90);
  const optionWins = resolveSecurityConfig({ SECURITY_MODE: 'enforce', LIMIT_JOIN_MAX: '200' }, { limits: { join: { max: 5 } } });
  assert.equal(optionWins.limits.join.max, 5, 'startServer options override env');
});

test('security: origin policy is an exact scheme+host match (never a suffix or wildcard)', () => {
  const config = resolveSecurityConfig({ SECURITY_MODE: 'enforce' });
  assert.deepEqual(checkOrigin({ origin: 'https://game.example.com', host: 'game.example.com', method: 'GET', config }), {
    ok: true,
    mode: 'enforce',
  });
  assert.equal(checkOrigin({ origin: 'https://game.example.com', host: 'game.example.com', method: 'POST', config }).ok, true);
  assert.equal(checkOrigin({ origin: 'https://game.example.com.evil.example', host: 'game.example.com', method: 'POST', config }).ok, false);
  assert.equal(checkOrigin({ origin: 'http://game.example.com', host: 'game.example.com:443', method: 'POST', config }).ok, false);
  assert.equal(checkOrigin({ origin: 'null', host: 'game.example.com', method: 'POST', config }).ok, false);
  // Missing Origin: safe methods allowed, writes refused in enforce mode.
  assert.equal(checkOrigin({ origin: undefined, host: 'h', method: 'GET', config }).ok, true);
  assert.equal(checkOrigin({ origin: undefined, host: 'h', method: 'HEAD', config }).ok, true);
  assert.equal(checkOrigin({ origin: undefined, host: 'h', method: 'POST', config }).ok, false);

  const allowlisted = resolveSecurityConfig({ SECURITY_MODE: 'enforce', ALLOWED_ORIGINS: 'https://game.example.com, https://alt.example.com' });
  assert.deepEqual(allowlisted.allowedOrigins, ['https://game.example.com', 'https://alt.example.com']);
  assert.equal(checkOrigin({ origin: 'https://alt.example.com', host: 'anything', method: 'POST', config: allowlisted }).ok, true);
  assert.equal(checkOrigin({ origin: 'https://other.example.com', host: 'anything', method: 'POST', config: allowlisted }).ok, false);

  // compat allows everything except the telemetry same-origin check.
  const compat = resolveSecurityConfig({});
  assert.equal(checkOrigin({ origin: EVIL_ORIGIN, host: 'game.example.com', method: 'POST', config: compat }).ok, true);
  assert.equal(checkTelemetryOrigin({ origin: EVIL_ORIGIN, host: 'game.example.com' }).ok, false);
  assert.equal(checkTelemetryOrigin({ origin: undefined, host: 'game.example.com' }).ok, true);
  assert.deepEqual(parseAllowedOrigins('ftp://x, https://a.example, https://a.example/'), ['https://a.example']);
});

test('security: CSP is self-only plus the exact asset origin, with no wildcard', () => {
  const base = buildCsp({});
  for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'"]) {
    assert.ok(base.includes(directive), `CSP has ${directive}`);
  }
  assert.ok(base.includes("img-src 'self' data: blob:"));
  assert.ok(base.includes("connect-src 'self'"));
  assert.equal(base.includes('*'), false, 'no wildcard source');

  const withAssets = buildCsp({ assetBaseUrl: 'https://cdn.example.com/narimato/assets' });
  assert.ok(withAssets.includes("connect-src 'self' https://cdn.example.com"));
  assert.ok(withAssets.includes("media-src 'self' https://cdn.example.com"));
  assert.equal(withAssets.includes('/narimato/assets'), false, 'path is not a CSP source');
  assert.equal(withAssets.includes('*'), false);
  assert.equal(assetOrigin('https://cdn.example.com/x'), 'https://cdn.example.com');
  assert.equal(assetOrigin('/relative/path'), '');
  assert.equal(assetOrigin('nonsense'), '');

  const headers = buildSecurityHeaders({});
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Strict-Transport-Security'], undefined, 'no HSTS over HTTP');
  assert.match(buildSecurityHeaders({ https: true })['Strict-Transport-Security'], /max-age=31536000/);
  assert.deepEqual(securityHeadersFor(resolveSecurityConfig({}), {}), {}, 'compat sends no headers');
  const enforcedHeaders = securityHeadersFor(resolveSecurityConfig({ SECURITY_MODE: 'enforce' }), {});
  assert.ok(enforcedHeaders['Content-Security-Policy']);
});

test('security: proxy-aware IP and path-safety helpers', () => {
  const socketIp = { socket: { remoteAddress: '10.0.0.7' }, headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } };
  assert.equal(clientIp(socketIp, { trustProxy: false }), '10.0.0.7');
  assert.equal(clientIp(socketIp, { trustProxy: true }), '203.0.113.9');
  assert.equal(clientIp({ headers: {}, socket: {} }, {}), 'unknown');
  assert.equal(requestIsHttps({ socket: { encrypted: true }, headers: {} }), true);
  assert.equal(requestIsHttps({ socket: {}, headers: {} }, { trustProxy: false }), false);
  assert.equal(requestIsHttps({ socket: {}, headers: { 'x-forwarded-proto': 'https' } }, { trustProxy: true }), true);
  assert.equal(requestIsHttps({ socket: {}, headers: { 'x-forwarded-proto': 'http' } }, { trustProxy: true }), false);
  assert.equal(hasDotfileSegment('/.env'), true);
  assert.equal(hasDotfileSegment('/js/.hidden/app.js'), true);
  assert.equal(hasDotfileSegment('/js/app.js'), false);
  assert.equal(isPathInside('/srv/public', '/srv/public/js/app.js'), true);
  assert.equal(isPathInside('/srv/public', '/srv/public-evil/app.js'), false);
});

// ------------------------------------------------------------- integration

test('security: enforce mode sends CSP, Referrer-Policy, Permissions-Policy and X-Frame-Options on every response', async (t) => {
  const { base } = await makeServer(t);
  for (const pathname of ['/', '/nope', '/api/health']) {
    const res = await request(base, pathname);
    assert.ok(res.status > 0);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, `${pathname} has CSP`);
    assert.equal(csp.includes('*'), false, `${pathname} CSP has no wildcard`);
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.match(res.headers.get('permissions-policy') || '', /camera=\(\)/);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('strict-transport-security'), null, 'HSTS only over HTTPS');
  }
});

test('security: compat mode reproduces the pre-hardening surface (no headers, origin-open writes)', async (t) => {
  const { base } = await makeServer(t, { security: { mode: 'compat' } });
  const page = await request(base, '/');
  assert.equal(page.headers.get('content-security-policy'), null);
  assert.equal(page.headers.get('referrer-policy'), null);
  const joined = await request(base, '/api/join', { method: 'POST', body: { tag: 'COMPAT1' }, headers: { origin: EVIL_ORIGIN } });
  assert.equal(joined.status, 200, 'compat keeps current behaviour for state-changing routes');
  const clicked = await request(base, '/api/action', {
    method: 'POST',
    body: { token: joined.json.token, type: 'click', label: '1' },
    headers: { origin: EVIL_ORIGIN },
  });
  assert.notEqual(clicked.status, 403);
  // Telemetry keeps its same-origin check in every mode.
  const telemetry = await request(base, '/api/telemetry', {
    method: 'POST',
    body: { webVitals: { lcp: 10 } },
    headers: { origin: EVIL_ORIGIN },
  });
  assert.equal(telemetry.status, 403);
});

test('security: foreign-origin join/action are refused with 403 and counted without IP data', async (t) => {
  const { base } = await makeServer(t);
  const joinRes = await request(base, '/api/join', { method: 'POST', body: { tag: 'EVIL01' }, headers: { origin: EVIL_ORIGIN } });
  assert.equal(joinRes.status, 403);
  assert.equal(joinRes.json.error, 'CROSS_ORIGIN');
  const actionRes = await request(base, '/api/action', {
    method: 'POST',
    body: { token: 'whatever', type: 'click', label: '1' },
    headers: { origin: EVIL_ORIGIN },
  });
  assert.equal(actionRes.status, 403);

  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  assert.ok(metrics.security.crossOrigin >= 2);
  assert.equal(metrics.security.mode, 'enforce');
  assert.equal(JSON.stringify(metrics).includes('127.0.0.1'), false, 'metrics are IP-free');
});

test('security: the 11th join inside a minute is rate limited with Retry-After', async (t) => {
  const { base } = await makeServer(t);
  const statuses = [];
  for (let index = 0; index < 11; index += 1) {
    const res = await join(base, `JOIN${index}`);
    statuses.push(res.status);
    if (index === 10) {
      assert.equal(res.status, 429);
      assert.equal(res.json.error, 'RATE_LIMITED');
      assert.ok(res.json.retryAfterMs > 0);
      assert.ok(Number(res.headers.get('retry-after')) >= 1);
    }
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
  assert.deepEqual(statuses.slice(10), [429]);
  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  assert.ok(metrics.security.rateLimited >= 1);
});

test('security: body caps are enforced per route and counted', async (t) => {
  const { base } = await makeServer(t);
  const bigJoin = await postSameOrigin(base, '/api/join', { tag: 'BIG', pad: 'x'.repeat(MAX_BODY_BYTES + 1024) });
  assert.equal(bigJoin.status, 413);
  assert.equal(bigJoin.json.error, 'PAYLOAD_TOO_LARGE');
  const bigTelemetry = await request(base, '/api/telemetry', {
    method: 'POST',
    body: { webVitals: { lcp: 1 }, pad: 'x'.repeat(TELEMETRY_BODY_BYTES + 1024) },
    headers: { origin: base },
  });
  assert.equal(bigTelemetry.status, 413);
  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  assert.ok(metrics.security.bodyTooLarge >= 2);
});

test('security: per-token action limits stop scripted loops at the derived ceiling', async (t) => {
  const { base } = await makeServer(t, {
    security: { mode: 'enforce', limits: { action: { max: 2, windowMs: 60_000, burst: 2 }, actionIp: { max: 100, windowMs: 60_000, burst: 100 } } },
  });
  const joined = await join(base, 'ACTION1');
  const token = joined.json.token;
  const statuses = [];
  for (let index = 0; index < 3; index += 1) {
    const res = await postSameOrigin(base, '/api/action', { token, type: 'click', label: String(index + 1) });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('security: per-IP action limits bound many tokens from one address', async (t) => {
  const { base } = await makeServer(t, {
    security: { mode: 'enforce', limits: { actionIp: { max: 2, windowMs: 60_000, burst: 2 }, action: { max: 100, windowMs: 60_000, burst: 100 } } },
  });
  const first = await join(base, 'IPLIM1');
  const second = await join(base, 'IPLIM2');
  assert.equal((await postSameOrigin(base, '/api/action', { token: first.json.token, type: 'click', label: '1' })).status, 200);
  assert.equal((await postSameOrigin(base, '/api/action', { token: second.json.token, type: 'click', label: '1' })).status, 200);
  assert.equal((await postSameOrigin(base, '/api/action', { token: first.json.token, type: 'click', label: '1' })).status, 429);
});

test('security: the 5th SSE stream from one address is refused with a 30 s Retry-After', async (t) => {
  const { base } = await makeServer(t);
  const streams = [];
  for (let index = 0; index < 5; index += 1) {
    const joined = await join(base, `SSE${index}`);
    streams.push({ token: joined.json.token, sse: null });
  }
  for (let index = 0; index < 4; index += 1) {
    const sse = await openSse(base, streams[index].token);
    assert.equal(sse.status, 200, `stream ${index} admitted`);
    streams[index].sse = sse;
  }
  const refused = await openSse(base, streams[4].token);
  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get('retry-after'), '30');
  assert.equal(JSON.parse(refused.text).error, 'RATE_LIMITED');
  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  assert.ok(metrics.security.sseRefused >= 1);
  for (const stream of streams) stream.sse?.close();
});

test('security: a second stream for the same token replaces the first instead of refusing', async (t) => {
  const { base } = await makeServer(t);
  const joined = await join(base, 'REPLACE1');
  const first = await openSse(base, joined.json.token);
  assert.equal(first.status, 200);
  await delay(50);
  const second = await openSse(base, joined.json.token);
  assert.equal(second.status, 200, 'replacement is admitted even at the IP cap');
  for (let attempt = 0; attempt < 100 && !first.finished; attempt += 1) await delay(10);
  assert.equal(first.finished, true, 'the previous stream for that token is closed');
  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  assert.ok(metrics.security.sseReplaced >= 1);
  second.close();
});

test('security: the global SSE cap refuses additional streams', async (t) => {
  const { base } = await makeServer(t, { security: { mode: 'enforce', maxSsePerIp: 100, maxSseGlobal: 1 } });
  const first = await join(base, 'GLOBAL1');
  const second = await join(base, 'GLOBAL2');
  const stream = await openSse(base, first.json.token);
  assert.equal(stream.status, 200);
  const refused = await openSse(base, second.json.token);
  assert.equal(refused.status, 429);
  stream.close();
});

test('security: invalid-token attempts are counted and rate limited (token guessing resistance)', async (t) => {
  const { base } = await makeServer(t, {
    security: { mode: 'enforce', limits: { auth: { max: 3, windowMs: 60_000, burst: 3 } } },
  });
  const statuses = [];
  for (let index = 0; index < 4; index += 1) {
    const sse = await openSse(base, `guessed-token-${index}`);
    statuses.push(sse.status);
    sse.close();
  }
  assert.deepEqual(statuses, [401, 401, 401, 429]);
  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  assert.ok(metrics.security.authFailures >= 3);
  assert.ok(metrics.security.rateLimited >= 1);
});

test('security: static dotfiles, traversal and symlink escapes are denied and counted', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'narimato-sec-static-'));
  const publicDir = path.join(root, 'public');
  const outside = path.join(root, 'outside-secret.txt');
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>arena</title>');
  await writeFile(path.join(publicDir, '.env'), 'TOKEN=do-not-serve');
  await writeFile(outside, 'outside-secret');
  await symlink(outside, path.join(publicDir, 'leak.txt'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const { base } = await makeServer(t, { serverOptions: { publicDir } });
  assert.equal((await request(base, '/')).status, 200);
  assert.equal((await request(base, '/index.html')).status, 200);
  const dotfile = await request(base, '/.env');
  assert.equal(dotfile.status, 404);
  assert.equal(dotfile.text.includes('do-not-serve'), false);
  const symlinked = await request(base, '/leak.txt');
  assert.equal(symlinked.status, 404);
  assert.equal(symlinked.text.includes('outside-secret'), false);
  for (const attempt of ['/js/../../server.js', '/%2e%2e/server.js', '/..%2fserver.js']) {
    const raw = await rawRequest(base, attempt);
    assert.equal(raw.status, 404, `${attempt} is denied`);
    assert.equal(raw.body.includes('startServer'), false, `${attempt} leaks nothing`);
  }
  const metrics = await (await fetch(`${base}/api/metrics`)).json();
  // URL parsing neutralises some encoded probes before the static guard; the
  // guard still counts every probe it sees (dotfile, symlink, encoded ..).
  assert.ok(metrics.security.traversalBlocked >= 3, `dotfile, symlink and traversal probes are counted (got ${metrics.security.traversalBlocked})`);
});

test('security: symlink-escaped index directory is also refused', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'narimato-sec-static2-'));
  const publicDir = path.join(root, 'public');
  const outsideDir = path.join(root, 'outside');
  await mkdir(publicDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(path.join(outsideDir, 'index.html'), '<h1>outside</h1>');
  await symlink(outsideDir, path.join(publicDir, 'escaped'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const { base } = await makeServer(t, { serverOptions: { publicDir } });
  const res = await request(base, '/escaped/');
  assert.equal(res.status, 404);
  assert.equal(res.text.includes('outside'), false);
});
