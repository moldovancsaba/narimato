import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseLog, readMarker, verifyCounts, MARKERS, MARKER_RE } from '../scripts/test-count.mjs';

function fixtureRoot(readme, architecture) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-count-'));
  fs.writeFileSync(path.join(root, 'README.md'), readme);
  fs.writeFileSync(path.join(root, 'ARCHITECTURE.md'), architecture);
  return root;
}

const SUMMARY = ['# tests 135', '# suites 0', '# pass 135', '# fail 0', '# cancelled 0', '# duration_ms 1234.5'].join('\n');

test('parseLog reads the node:test summary', () => {
  assert.deepEqual(parseLog(SUMMARY), { tests: 135, pass: 135, fail: 0, durationMs: 1234.5 });
});

test('parseLog accepts the human reporter summary format', () => {
  const human = ['\u2139 tests 135', '\u2139 pass 135', '\u2139 fail 0', '\u2139 duration_ms 99.5'].join('\n');
  assert.deepEqual(parseLog(human), { tests: 135, pass: 135, fail: 0, durationMs: 99.5 });
});

test('parseLog returns null without a summary', () => {
  assert.equal(parseLog('some unrelated output'), null);
  assert.equal(parseLog('# tests 12\n# pass 12'), null);
});

test('parseLog preserves failures so the gate can fail', () => {
  const counts = parseLog('# tests 10\n# pass 9\n# fail 1');
  assert.equal(counts.fail, 1);
});

test('verifyCounts passes with matching markers', () => {
  const marker = '<!-- test-count:135 -->135<!-- /test-count -->';
  const root = fixtureRoot(`# Readme\n${marker}`, `# Architecture\n${marker}`);
  const report = verifyCounts(root, { tests: 135, pass: 135, fail: 0 });
  assert.equal(report.ok, true);
});

test('verifyCounts detects a stale marker', () => {
  const root = fixtureRoot(
    '<!-- test-count:116 -->116<!-- /test-count -->',
    '<!-- test-count:116 -->116<!-- /test-count -->'
  );
  const report = verifyCounts(root, { tests: 135, pass: 135, fail: 0 });
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === 'STALE' && finding.file === 'README.md'));
});

test('verifyCounts rejects a mismatch between declared and rendered marker numbers', () => {
  const root = fixtureRoot(
    '<!-- test-count:135 -->116<!-- /test-count -->',
    '<!-- test-count:135 -->135<!-- /test-count -->'
  );
  const state = readMarker(root, 'README.md');
  assert.equal(state.invalid, true);
  assert.ok(verifyCounts(root, { tests: 135, pass: 135, fail: 0 }).findings.some((f) => f.code === 'NO_MARKER'));
});

test('verifyCounts fails on test failure and missing summary', () => {
  const root = fixtureRoot('<!-- test-count:1 -->1<!-- /test-count -->', '<!-- test-count:1 -->1<!-- /test-count -->');
  assert.equal(verifyCounts(root, { tests: 1, pass: 0, fail: 1 }).ok, false);
  assert.equal(verifyCounts(root, null).ok, false);
});

test('marker contract is stable for both tracked files', () => {
  assert.deepEqual(MARKERS.map((marker) => marker.file), ['README.md', 'ARCHITECTURE.md']);
  assert.match('<!-- test-count:42 -->42<!-- /test-count -->', MARKER_RE);
});
