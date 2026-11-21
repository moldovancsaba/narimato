#!/usr/bin/env node
/**
 * NARIMATO — CDN / edge activation preflight (OPS-04).
 *
 * This checker is intentionally fail-closed. It validates a *real* HTTPS CDN
 * hostname only; without a production hostname and the game origin it exits 3
 * with an explicit "credentials/hostname missing" result. A silent pass is
 * never possible.
 *
 * It checks configuration, DNS and the edge response headers for the immutable
 * audio class plus the no-store classes that must never be edge-cached. It is
 * read-only and performs no activation.
 *
 * Usage:
 *   node scripts/cdn-preflight.mjs --base https://cdn.example.net/narimato \
 *     --origin https://game.example.net
 *
 *   ASSET_BASE_URL=https://cdn.example.net/narimato \
 *     GAME_ORIGIN=https://game.example.net node scripts/cdn-preflight.mjs
 *
 * Exit codes:
 *   0  pass: real host, DNS resolved, every header check passed
 *   1  fail: one or more checks failed (details name the URL)
 *   2  usage or internal error
 *   3  prerequisites missing: no hostname/credentials, invalid config or a
 *      non-production host — no checks were run and this is not a pass
 *
 * Zero dependencies. Pure helpers are exported so tests use fixtures instead of
 * the network; the CLI is the only path that performs DNS or HTTPS requests.
 */
import fs from 'node:fs';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

export const EXIT = Object.freeze({
  PASS: 0,
  FAIL: 1,
  USAGE: 2,
  PREREQUISITES: 3,
});

export const AUDIO_PATH = '/audio/voice/george/help-story__s1.m4a';
export const HTML_PATH = '/index.html';
export const API_PATH = '/api/health';
export const IMMUTABLE_MAX_AGE = 31_536_000;
export const PREREQUISITE_MESSAGE =
  'credentials/hostname missing — set ASSET_BASE_URL or --base to a real HTTPS CDN hostname and GAME_ORIGIN or --origin to the exact game origin; no checks were run and this is not a pass';

const RESERVED_SUFFIXES = Object.freeze([
  '.localhost',
  '.local',
  '.test',
  '.invalid',
  '.example',
  '.example.com',
  '.example.net',
  '.example.org',
]);

const RESERVED_EXACT = new Set(['localhost', 'example.com', 'example.net', 'example.org']);

/** True for loopback, private, link-local, reserved and documentation hostnames. */
export function isNonProductionHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (RESERVED_EXACT.has(host)) return true;
  if (RESERVED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const octets = host.split('.').map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast and reserved
    if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1
    if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
    return false;
  }
  if (ipVersion === 6) {
    if (host === '::' || host === '::1') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // unique-local
    if (/^fe[89ab][0-9a-f]:/.test(host)) return true; // link-local
    return false;
  }
  return false;
}

function configFailure(code, message) {
  return { ok: false, code, message };
}

/**
 * Validate the activation configuration without touching the network.
 * Returns `{ok:true, base, origin, host, basePath}` or `{ok:false, code, message}`.
 */
export function parseConfig({ baseUrl = '', originUrl = '' } = {}) {
  const rawBase = String(baseUrl || '').trim();
  const rawOrigin = String(originUrl || '').trim();
  if (!rawBase) return configFailure('PREREQUISITES_MISSING', PREREQUISITE_MESSAGE);
  if (!rawOrigin) {
    return configFailure(
      'PREREQUISITES_MISSING',
      `${PREREQUISITE_MESSAGE} (the exact game origin is also required for CORS)`,
    );
  }

  let base;
  try {
    base = new URL(rawBase);
  } catch {
    return configFailure('CONFIG_INVALID', `asset base is not a valid URL: ${rawBase}`);
  }
  if (base.protocol !== 'https:') {
    return configFailure('CONFIG_INVALID', 'asset base must use HTTPS; HTTP is not an activation candidate');
  }
  if (base.username || base.password) {
    return configFailure('CONFIG_INVALID', 'asset base must not carry embedded credentials');
  }
  if (base.search || base.hash) {
    return configFailure('CONFIG_INVALID', 'asset base must not carry a query string or fragment');
  }
  if (isNonProductionHost(base.hostname)) {
    return configFailure(
      'NON_PRODUCTION_HOST',
      `${PREREQUISITE_MESSAGE} (non-production CDN hostname: ${base.hostname})`,
    );
  }
  const basePath = base.pathname.replace(/\/+$/, '');
  const normalizedBase = `${base.origin}${basePath}`;

  let origin;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return configFailure('CONFIG_INVALID', `game origin is not a valid URL: ${rawOrigin}`);
  }
  if (origin.protocol !== 'https:') {
    return configFailure('CONFIG_INVALID', 'game origin must use HTTPS');
  }
  if (origin.username || origin.password) {
    return configFailure('CONFIG_INVALID', 'game origin must not carry embedded credentials');
  }
  if (origin.search || origin.hash) {
    return configFailure('CONFIG_INVALID', 'game origin must not carry a query string or fragment');
  }
  if (isNonProductionHost(origin.hostname)) {
    return configFailure(
      'NON_PRODUCTION_HOST',
      `${PREREQUISITE_MESSAGE} (non-production game origin: ${origin.hostname})`,
    );
  }

  return {
    ok: true,
    base: normalizedBase,
    origin: origin.origin,
    host: base.hostname,
    basePath,
  };
}

function header(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] ?? '') : '';
}

function tokenList(value) {
  return String(value || '')
    .toLowerCase()
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

function hasDirective(value, directive) {
  return String(value || '')
    .toLowerCase()
    .split(',')
    .some((part) => part.trim().startsWith(directive));
}

function maxAge(value) {
  const match = /(?:^|;|\s)max-age=(\d+)/i.exec(String(value || ''));
  return match ? Number(match[1]) : null;
}

function checkAudio(observation, origin, add) {
  if (!observation || observation.error) {
    add('audio', false, observation?.error ? `audio request failed: ${observation.error}` : 'audio response was not collected');
    return;
  }
  const statusOk = observation.status === 200;
  add('audio-status', statusOk, `expected HTTP 200, received ${observation.status ?? 'none'}`, observation.url);
  add('audio-no-redirect', !(observation.status >= 300 && observation.status < 400), `redirect not allowed (status ${observation.status ?? 'none'})`, observation.url);

  const contentType = header(observation.headers, 'content-type').toLowerCase();
  add('audio-mime', contentType.startsWith('audio/mp4'), `expected audio/mp4, received ${contentType || '(none)'}`, observation.url);

  const cacheControl = header(observation.headers, 'cache-control');
  const age = maxAge(cacheControl);
  const cacheOk =
    hasDirective(cacheControl, 'public') &&
    hasDirective(cacheControl, 'immutable') &&
    age !== null &&
    age >= IMMUTABLE_MAX_AGE;
  add(
    'audio-cache',
    cacheOk,
    `expected public, max-age>=${IMMUTABLE_MAX_AGE}, immutable; received ${cacheControl || '(none)'}`,
    observation.url,
  );

  const allowOrigin = header(observation.headers, 'access-control-allow-origin').trim();
  const corsOk = allowOrigin !== '' && allowOrigin !== '*' && allowOrigin.toLowerCase() === origin.toLowerCase();
  add('cors-allow-origin', corsOk, `expected ${origin} (never *); received ${allowOrigin || '(none)'}`, observation.url);

  const expose = header(observation.headers, 'access-control-expose-headers');
  const exposeOk = tokenList(expose).includes('content-range') || tokenList(expose).includes('*');
  add('cors-expose-content-range', exposeOk, `expected Content-Range in Access-Control-Expose-Headers; received ${expose || '(none)'}`, observation.url);

  const vary = tokenList(header(observation.headers, 'vary'));
  add('cors-vary-origin', vary.includes('origin') || vary.includes('*'), `expected Vary: Origin so a cached ACAO cannot cross origins; received ${header(observation.headers, 'vary') || '(none)'}`, observation.url);

  const acceptRanges = tokenList(header(observation.headers, 'accept-ranges'));
  add('accept-ranges', acceptRanges.includes('bytes'), `expected Accept-Ranges: bytes; received ${header(observation.headers, 'accept-ranges') || '(none)'}`, observation.url);
}

function checkRange(observation, add) {
  if (!observation || observation.error) {
    add('range', false, observation?.error ? `range request failed: ${observation.error}` : 'range response was not collected');
    return;
  }
  add('range-status', observation.status === 206, `expected HTTP 206, received ${observation.status ?? 'none'}`, observation.url);
  const contentRange = header(observation.headers, 'content-range');
  add(
    'content-range',
    /^bytes 0-1023\/\d+$/i.test(contentRange.trim()),
    `expected Content-Range: bytes 0-1023/<total>; received ${contentRange || '(none)'}`,
    observation.url,
  );
  const length = header(observation.headers, 'content-length');
  add(
    'range-length',
    length === '' || Number(length) <= 1024,
    `range response body must be at most 1024 bytes; received Content-Length ${length || '(none)'}`,
    observation.url,
  );
}

function checkNoStoreClass(id, observation, add) {
  if (!observation || observation.error) {
    add(id, false, observation?.error ? `${id} request failed: ${observation.error}` : `${id} response was not collected`);
    return;
  }
  if ([403, 404, 405].includes(observation.status)) {
    add(id, true, `edge does not serve this class (HTTP ${observation.status}); origin-only is acceptable`, observation.url);
    return;
  }
  if (observation.status !== 200) {
    add(id, false, `expected 200 with no-store, 403/404/405 for an origin-only class, or a bypass; received ${observation.status}`, observation.url);
    return;
  }
  const cacheControl = header(observation.headers, 'cache-control');
  add(id, hasDirective(cacheControl, 'no-store'), `expected Cache-Control: no-store; received ${cacheControl || '(none)'}`, observation.url);
}

/**
 * Evaluate a completed observation set. Pure: tests supply fixtures shaped like
 * `{dns:{ok,addresses}, audio:{status,headers}, range:{status,headers},
 * html:{status,headers}, api:{status,headers}}`.
 */
export function evaluatePreflight({ config, observations } = {}) {
  if (!config || config.ok !== true) {
    return {
      ok: false,
      status: 'blocked',
      code: config?.code || 'PREREQUISITES_MISSING',
      message: config?.message || PREREQUISITE_MESSAGE,
      checks: [],
      failures: [config?.code || 'PREREQUISITES_MISSING'],
      config: config || null,
    };
  }

  const checks = [];
  const add = (id, ok, detail, url = '') => checks.push({ id, ok: Boolean(ok), detail, url });

  const dnsObservation = observations?.dns;
  add(
    'dns',
    dnsObservation?.ok === true && Array.isArray(dnsObservation.addresses) && dnsObservation.addresses.length > 0,
    dnsObservation?.ok
      ? `resolved ${dnsObservation.addresses.length} address(es)`
      : `DNS lookup failed: ${dnsObservation?.error || 'no observation'}`,
    '',
  );

  checkAudio(observations?.audio, config.origin, add);
  checkRange(observations?.range, add);
  checkNoStoreClass('html-no-store', observations?.html, add);
  checkNoStoreClass('api-no-store', observations?.api, add);

  const failures = checks.filter((check) => !check.ok).map((check) => check.id);
  const ok = failures.length === 0;
  return {
    ok,
    status: ok ? 'pass' : 'fail',
    code: ok ? 'OK' : 'CHECKS_FAILED',
    base: config.base,
    origin: config.origin,
    checkedAt: new Date().toISOString(),
    checks,
    failures,
  };
}

export function formatReport(report) {
  if (report.ok) {
    return `cdn-preflight: PASS — ${report.checks.length} checks, base ${report.base}, origin ${report.origin}\n`;
  }
  const lines = [
    `cdn-preflight: FAIL — ${report.failures.length} check(s) failed`,
    `  base ${report.base || '(none)'} · origin ${report.origin || '(none)'}`,
  ];
  for (const check of report.checks) {
    if (!check.ok) lines.push(`  [FAIL] ${check.id}${check.url ? ` (${check.url})` : ''}: ${check.detail}`);
  }
  return `${lines.join('\n')}\n`;
}

function readAudioVersion(root) {
  try {
    const text = fs.readFileSync(path.join(root, 'public/js/audio-version.js'), 'utf8');
    const match = /AUDIO_VERSION\s*=\s*'([^']+)'/.exec(text);
    return match ? match[1] : '0.0.0+00000000';
  } catch {
    return '0.0.0+00000000';
  }
}

async function request(url, init, timeoutMs) {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: '*/*',
        'User-Agent': 'narimato-cdn-preflight/1.0',
        ...(init.headers || {}),
      },
    });
    const headers = Object.fromEntries(response.headers.entries());
    // Consume or cancel the tiny body so the process can exit cleanly.
    try {
      await response.body?.cancel();
    } catch {
      /* body already closed */
    }
    return { url, status: response.status, headers };
  } catch (error) {
    return { url, error: error?.cause?.code || error?.name || error?.message || 'fetch-failed' };
  }
}

async function collectObservations(config, { root, timeoutMs }) {
  const audioVersion = readAudioVersion(root);
  const headers = { Origin: config.origin };
  const base = config.base;
  const observations = {};

  try {
    const addresses = await dns.lookup(config.host, { all: true });
    observations.dns = { ok: addresses.length > 0, addresses: addresses.map((entry) => entry.address) };
  } catch (error) {
    observations.dns = { ok: false, error: error?.code || error?.message || 'lookup-failed' };
  }

  observations.audio = await request(`${base}${AUDIO_PATH}?v=${audioVersion}`, {
    method: 'HEAD',
    headers,
  }, timeoutMs);
  observations.range = await request(`${base}${AUDIO_PATH}?v=${audioVersion}`, {
    method: 'GET',
    headers: { ...headers, Range: 'bytes=0-1023' },
  }, timeoutMs);
  observations.html = await request(`${base}${HTML_PATH}`, { method: 'GET', headers }, timeoutMs);
  observations.api = await request(`${base}${API_PATH}`, { method: 'GET', headers }, timeoutMs);
  return observations;
}

function parseArgs(argv) {
  const options = {
    base: '',
    origin: '',
    timeoutMs: 10_000,
    root: DEFAULT_ROOT,
    json: false,
    help: false,
  };
  const take = (index, name) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--base') { options.base = take(index, '--base'); index += 1; }
    else if (arg.startsWith('--base=')) options.base = arg.slice('--base='.length);
    else if (arg === '--origin') { options.origin = take(index, '--origin'); index += 1; }
    else if (arg.startsWith('--origin=')) options.origin = arg.slice('--origin='.length);
    else if (arg === '--timeout-ms') { options.timeoutMs = Number(take(index, '--timeout-ms')); index += 1; }
    else if (arg.startsWith('--timeout-ms=')) options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg === '--root') { options.root = path.resolve(take(index, '--root')); index += 1; }
    else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice('--root='.length));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 120_000) {
    throw new Error('--timeout-ms must be between 1 and 120000');
  }
  return options;
}

function printPrerequisite(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  console.error(`cdn-preflight: ${report.code} — ${report.message || PREREQUISITE_MESSAGE}`);
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`cdn-preflight: ${error.message}`);
    return EXIT.USAGE;
  }
  if (options.help) {
    console.log('usage: node scripts/cdn-preflight.mjs --base <https-cdn-url> --origin <https-game-origin> [--json]');
    console.log('  Missing hostname/origin exits 3 with "credentials/hostname missing"; it never passes silently.');
    return EXIT.PASS;
  }

  const baseUrl = options.base || process.env.ASSET_BASE_URL || '';
  const originUrl = options.origin || process.env.GAME_ORIGIN || process.env.ASSET_VERIFY_ORIGIN || '';
  const config = parseConfig({ baseUrl, originUrl });
  if (!config.ok) {
    printPrerequisite({ ok: false, status: 'blocked', code: config.code, message: config.message }, options.json);
    return EXIT.PREREQUISITES;
  }

  let observations;
  try {
    observations = await collectObservations(config, { root: options.root, timeoutMs: options.timeoutMs });
  } catch (error) {
    console.error(`cdn-preflight: INTERNAL_ERROR — ${error?.message || error}`);
    return EXIT.USAGE;
  }

  const report = evaluatePreflight({ config, observations });
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (report.ok) process.stdout.write(formatReport(report));
  else process.stderr.write(formatReport(report));
  return report.ok ? EXIT.PASS : EXIT.FAIL;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`cdn-preflight: INTERNAL_ERROR — ${error?.stack || error}`);
    process.exitCode = EXIT.USAGE;
  });
}
