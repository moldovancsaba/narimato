import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REQUIRED_CHECKS,
  REPORT_VERSION,
  THRESHOLDS,
  createReport,
  droppedRatio,
  forcesIntroOff,
  maxChannelDelta,
  percentile,
  sampleEvenly,
  scanRepository,
  summarise,
  validateReport,
} from '../scripts/lib/single-scene-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function validReport() {
  const report = createReport({ version: '3.57.0', startedAt: new Date().toISOString() });
  for (const id of REQUIRED_CHECKS) report.checks.push({ id, ok: true, observed: { sample: true } });
  report.artifacts = ['media/single-scene/orbit.png', 'media/single-scene/surface.png'];
  report.ok = true;
  return report;
}

test('single-scene guard: thresholds match the issue contract', () => {
  assert.equal(THRESHOLDS.maxChannelDelta, 6);
  assert.equal(THRESHOLDS.p95FrameMs, 16.7);
  assert.equal(THRESHOLDS.droppedFrameMs, 33.4);
  assert.equal(THRESHOLDS.droppedRatio, 0.05);
  assert.equal(THRESHOLDS.frameSamples, 600);
  assert.deepEqual([...REQUIRED_CHECKS], [
    'one-renderer', 'no-surface-canvas', 'camera-only', 'cell-parity', 'hud-identity', 'frame-budget',
  ]);
});

test('single-scene guard: pixel delta helpers fail closed', () => {
  assert.equal(maxChannelDelta([10, 20, 30], [10, 20, 30]), 0);
  assert.equal(maxChannelDelta([10, 20, 30], [16, 14, 30]), 6);
  assert.equal(maxChannelDelta([10, 20, 30], [17, 20, 30]), 7);
  assert.equal(maxChannelDelta([0, 0, 0], [255, 255, 255]), 255);
  assert.equal(maxChannelDelta(null, [0, 0, 0]), Infinity);
  assert.equal(maxChannelDelta([NaN, 0, 0], [0, 0, 0]), Infinity);
});

test('single-scene guard: percentile uses nearest rank and fails closed', () => {
  assert.equal(percentile([], 0.95), Infinity);
  assert.equal(percentile([16, 8, 32, 4], 0.5), 8);
  assert.equal(percentile([16, 8, 32, 4], 0.95), 32);
  assert.equal(percentile([10, 10, 10], 0.95), 10);
  assert.equal(percentile([1, 2, 3], 1), 3);
});

test('single-scene guard: dropped ratio and 600-frame budget math', () => {
  const frames = new Array(600).fill(16);
  assert.equal(droppedRatio(frames), 0);
  assert.ok(droppedRatio([16, 34, 16, 16]) > 0);
  const slow = new Array(600).fill(20);
  for (let i = 0; i < 40; i += 1) slow[i] = 40;
  assert.ok(droppedRatio(slow) > 0.05, '40/600 slow frames exceed the dropped budget');
  assert.equal(droppedRatio([]), Infinity);
});

test('single-scene guard: sampling is deterministic and keeps the ends', () => {
  const values = Array.from({ length: 20 }, (_, index) => index);
  assert.deepEqual(sampleEvenly(values, 5), [0, 5, 10, 14, 19]);
  assert.deepEqual(sampleEvenly(values, 20), values);
  assert.deepEqual(sampleEvenly(values, 0), []);
  assert.deepEqual(sampleEvenly(values, 100), values);
  assert.deepEqual(sampleEvenly(values, 5), sampleEvenly(values, 5));
});

test('single-scene guard: report schema accepts a complete report and rejects damage', () => {
  const report = validReport();
  const validation = validateReport(report);
  assert.equal(validation.ok, true, validation.problems.join('; '));
  assert.equal(report.reportVersion, REPORT_VERSION);
  assert.deepEqual(report.checks.map((check) => check.id), [...REQUIRED_CHECKS]);

  const missing = validReport();
  missing.checks = missing.checks.filter((check) => check.id !== 'cell-parity');
  assert.equal(validateReport(missing).ok, false);

  const absolute = validReport();
  absolute.artifacts = ['/Users/someone/media/report.json'];
  assert.equal(validateReport(absolute).ok, false);

  assert.equal(validateReport(null).ok, false);
  assert.equal(validateReport({ ok: true }).ok, false);
  assert.equal(validateReport({ ...validReport(), ok: 'yes' }).ok, false);
});

test('single-scene guard: reviewer summary names failures, never hides them', () => {
  const report = validReport();
  report.checks.find((check) => check.id === 'frame-budget').observed = { p95Ms: 11.2 };
  report.artifacts = ['media/single-scene/orbit.png'];
  assert.match(summarise(report), /^PASS single-scene/);
  report.checks.find((check) => check.id === 'hud-identity').ok = false;
  assert.match(summarise(report), /^FAIL single-scene/);
  assert.match(summarise(report), /hud-identity/);
});

test('single-scene guard: repository scan finds every forbidden single-scene symbol', () => {
  const repo = scanRepository(ROOT);
  assert.equal(repo.ok, true, JSON.stringify(repo.findings.slice(0, 5)));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-guard-'));
  try {
    fs.mkdirSync(path.join(temporary, 'public', 'js'), { recursive: true });
    fs.writeFileSync(path.join(temporary, 'public', 'index.html'), '<canvas id="surface-canvas"></canvas>\n');
    fs.writeFileSync(path.join(temporary, 'public', 'js', 'app.js'), 'function drawAvatar() {}\nsetPlanetSurface(true);\n');
    const findings = scanRepository(temporary);
    assert.equal(findings.ok, false);
    const symbols = new Set(findings.findings.map((entry) => entry.symbol));
    assert.ok(symbols.has('surface-canvas'));
    assert.ok(symbols.has('drawAvatar'));
    assert.ok(symbols.has('setPlanetSurface'));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('single-scene guard: index.html has one planet canvas and no surface canvas', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  assert.equal((html.match(/id="arena-canvas"/g) || []).length, 1, 'exactly one planet canvas');
  assert.equal(html.includes('surface-canvas'), false);
  // The only other canvases are decorative FX / report layers, never a second
  // planet view.
  const ids = [...html.matchAll(/<canvas[\s\S]*?id="([^"]+)"/g)].map((match) => match[1]);
  const allowed = new Set(['arena-canvas', 'intro-fx', 'interlude-fx', 'meteor-fx', 'supply-fx', 'report-card-preview']);
  for (const id of ids) assert.ok(allowed.has(id), `unexpected canvas ${id}`);
  assert.equal(ids.filter((id) => id === 'arena-canvas').length, 1);
});

test('single-scene guard: the suite is wired into package.json and documents its harness', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['verify:single-scene'], 'node scripts/verify-single-scene.mjs');
  const source = fs.readFileSync(path.join(ROOT, 'scripts/verify-single-scene.mjs'), 'utf8');
  assert.ok(source.includes('PLAYWRIGHT_MODULE'), 'the harness hint is documented');
  assert.ok(source.includes('media/single-scene/report.json') || source.includes("'media', 'single-scene'"), 'the report path is documented');
  assert.ok(/exit codes/i.test(source), 'the exit-code contract is documented');
  assert.ok(source.includes('--self-test'), 'the mutation self-test is available');
  assert.equal(forcesIntroOff('?intro=0'), true);
  assert.equal(forcesIntroOff('intro=0&surface=1'), true);
  assert.equal(forcesIntroOff('?intro=1'), false);
  assert.equal(forcesIntroOff(''), false);
});

test('single-scene guard: committed acceptance report is machine-readable and green', () => {
  const file = path.join(ROOT, 'media', 'single-scene', 'report.json');
  assert.ok(fs.existsSync(file), 'media/single-scene/report.json is committed evidence');
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const validation = validateReport(report);
  assert.equal(validation.ok, true, validation.problems.join('; '));
  assert.equal(report.ok, true, 'the committed report is a passing run');
  const ids = new Set(report.checks.map((check) => check.id));
  for (const id of REQUIRED_CHECKS) assert.ok(ids.has(id), `${id} is present in the report`);
  for (const artifact of report.artifacts) {
    assert.ok(fs.existsSync(path.join(ROOT, artifact)), `${artifact} exists`);
  }
});
