import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  EXIT,
  evaluatePreflight,
  isNonProductionHost,
  parseConfig,
} from '../scripts/cdn-preflight.mjs';

const SCRIPT = path.resolve('scripts/cdn-preflight.mjs');
const FIXTURES = path.resolve('test/fixtures/cdn');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function evaluate(name) {
  const data = fixture(name);
  return evaluatePreflight({
    config: parseConfig(data.config),
    observations: data.observations,
  });
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ASSET_BASE_URL: '',
      GAME_ORIGIN: '',
      ASSET_VERIFY_ORIGIN: '',
      ...env,
    },
  });
}

test('non-production hostnames are loopback, private, reserved or documentation names', () => {
  for (const host of [
    'localhost',
    'app.localhost',
    'cdn.local',
    'edge.test',
    'cdn.invalid',
    'cdn.example',
    'cdn.example.com',
    'example.com',
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
    '192.0.2.10',
    '198.51.100.10',
    '203.0.113.10',
    '::1',
    'fd00::1',
    'fe80::1',
  ]) {
    assert.equal(isNonProductionHost(host), true, `${host} must be rejected`);
  }
  for (const host of ['cdn.narimato.dev', 'edge.narimato.com']) {
    assert.equal(isNonProductionHost(host), false, `${host} must be accepted`);
  }
});

test('a missing hostname or origin exits with the prerequisite code', () => {
  const config = parseConfig({});
  assert.equal(config.ok, false);
  assert.equal(config.code, 'PREREQUISITES_MISSING');
  assert.match(config.message, /credentials\/hostname missing/);
});

test('a non-production hostname is never an activation candidate', () => {
  const local = parseConfig({ baseUrl: 'https://localhost:8443/narimato', originUrl: 'https://game.narimato.dev' });
  assert.equal(local.ok, false);
  assert.equal(local.code, 'NON_PRODUCTION_HOST');
  assert.match(local.message, /credentials\/hostname missing/);

  const example = parseConfig({ baseUrl: 'https://cdn.example.com/narimato', originUrl: 'https://game.narimato.dev' });
  assert.equal(example.code, 'NON_PRODUCTION_HOST');
});

test('configuration requires HTTPS, no embedded credentials and no query string', () => {
  assert.equal(parseConfig({ baseUrl: 'http://cdn.narimato.dev', originUrl: 'https://game.narimato.dev' }).code, 'CONFIG_INVALID');
  assert.equal(
    parseConfig({ baseUrl: 'https://user:pass@cdn.narimato.dev', originUrl: 'https://game.narimato.dev' }).code,
    'CONFIG_INVALID',
  );
  assert.equal(
    parseConfig({ baseUrl: 'https://cdn.narimato.dev/narimato?token=redacted', originUrl: 'https://game.narimato.dev' }).code,
    'CONFIG_INVALID',
  );
  assert.equal(
    parseConfig({ baseUrl: 'https://cdn.narimato.dev/narimato', originUrl: 'http://game.narimato.dev' }).code,
    'CONFIG_INVALID',
  );
});

test('a valid config normalises the base and keeps the exact origin', () => {
  const config = parseConfig({
    baseUrl: 'https://cdn.narimato.dev/narimato/',
    originUrl: 'https://game.narimato.dev/',
  });
  assert.equal(config.ok, true);
  assert.equal(config.base, 'https://cdn.narimato.dev/narimato');
  assert.equal(config.origin, 'https://game.narimato.dev');
  assert.equal(config.host, 'cdn.narimato.dev');
});

test('a healthy edge passes every preflight check', () => {
  const report = evaluate('healthy.json');
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.status, 'pass');
  assert.equal(report.code, 'OK');
  assert.deepEqual(report.failures, []);
  const ids = report.checks.map((check) => check.id);
  for (const id of ['dns', 'audio-status', 'audio-mime', 'audio-cache', 'cors-allow-origin', 'accept-ranges', 'range-status', 'html-no-store', 'api-no-store']) {
    assert.ok(ids.includes(id), `${id} must be checked`);
  }
});

test('wrong cache headers fail closed and name the check', () => {
  const report = evaluate('wrong-cache.json');
  assert.equal(report.ok, false);
  assert.deepEqual(report.failures, ['audio-cache']);
});

test('missing CORS and range support fails every related check', () => {
  const report = evaluate('missing-cors-range.json');
  assert.equal(report.ok, false);
  for (const id of [
    'cors-allow-origin',
    'cors-expose-content-range',
    'cors-vary-origin',
    'accept-ranges',
    'range-status',
    'content-range',
  ]) {
    assert.ok(report.failures.includes(id), `${id} must fail; got ${report.failures.join(',')}`);
  }
});

test('cacheable HTML or API responses fail the no-store checks', () => {
  const report = evaluate('cacheable-html-api.json');
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes('html-no-store'));
  assert.ok(report.failures.includes('api-no-store'));
});

test('an origin-only edge may answer 404 and still pass the no-store class', () => {
  const data = fixture('healthy.json');
  data.observations.html = { status: 403, headers: {} };
  data.observations.api = { status: 405, headers: {} };
  const report = evaluatePreflight({ config: parseConfig(data.config), observations: data.observations });
  assert.equal(report.ok, true);
});

test('evaluating a missing config returns the prerequisite result, never a pass', () => {
  const report = evaluatePreflight({ config: parseConfig({}), observations: {} });
  assert.equal(report.ok, false);
  assert.equal(report.code, 'PREREQUISITES_MISSING');
  assert.equal(report.status, 'blocked');
  assert.match(report.message, /credentials\/hostname missing/);
});

test('--no arguments exits 3 with an explicit credentials/hostname message', () => {
  const result = run([]);
  assert.equal(result.status, EXIT.PREREQUISITES, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /PREREQUISITES_MISSING/);
  assert.match(result.stderr, /credentials\/hostname missing/);
  assert.doesNotMatch(result.stdout, /PASS/);
});

test('a localhost base is rejected with exit 3 before any request', () => {
  const result = run(['--base=https://localhost:8443/narimato', '--origin=https://game.narimato.dev']);
  assert.equal(result.status, EXIT.PREREQUISITES);
  assert.match(result.stderr, /NON_PRODUCTION_HOST/);
  assert.match(result.stderr, /credentials\/hostname missing/);
});

test('a real hostname without the game origin still exits 3', () => {
  const result = run(['--base=https://cdn.narimato.dev/narimato']);
  assert.equal(result.status, EXIT.PREREQUISITES);
  assert.match(result.stderr, /credentials\/hostname missing/);
});

test('an invalid scheme exits 3 with CONFIG_INVALID', () => {
  const result = run(['--base=http://cdn.narimato.dev/narimato', '--origin=https://game.narimato.dev']);
  assert.equal(result.status, EXIT.PREREQUISITES);
  assert.match(result.stderr, /CONFIG_INVALID/);
});

test('--json still reports the prerequisite failure and exit code 3', () => {
  const result = run(['--json']);
  assert.equal(result.status, EXIT.PREREQUISITES);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.code, 'PREREQUISITES_MISSING');
  assert.match(report.message, /credentials\/hostname missing/);
});

test('--help is side-effect free', () => {
  const result = run(['--help']);
  assert.equal(result.status, EXIT.PASS);
  assert.match(result.stdout, /cdn-preflight/);
});
