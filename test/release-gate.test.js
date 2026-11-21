import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  EXIT_CODES,
  checkVersionTriple,
  exitCodeFor,
  extractCountClaims,
  parseTapSummary,
  renderSummary,
  validateManifest,
  validatePrerequisites,
  verdictFor,
  verifyTestCounts,
  writeArtifacts,
} from '../lib/release-checks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-release-gate-'));
}

function write(root, file, text) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

test('parseTapSummary reads the node:test TAP totals', () => {
  const text = ['# tests 543', '# suites 0', '# pass 543', '# fail 0', '# duration_ms 5045.8'].join('\n');
  assert.deepEqual(parseTapSummary(text), { tests: 543, pass: 543, fail: 0, durationMs: 5045.8 });
  assert.equal(parseTapSummary('no summary'), null);
});

test('extractCountClaims checks markers, current-release prose and ignores history', () => {
  const notes = [
    '## v3.58.0 — release',
    '- 543/543 tests.',
    '## v3.57.0 — old',
    '- 116/116 tests passed at the v3.57.0 delivery.',
  ].join('\n');
  const claims = extractCountClaims({ file: 'RELEASE_NOTES.md', text: notes, version: '3.58.0' });
  assert.ok(claims.some((claim) => claim.claimed === 543 && claim.kind === 'release-section'));
  assert.ok(!claims.some((claim) => claim.claimed === 116), 'historical counts must not be current claims');

  const readme = 'The node:test suite currently runs <!-- test-count:543 -->543<!-- /test-count --> tests.';
  const markerClaims = extractCountClaims({ file: 'README.md', text: readme, version: '3.58.0' });
  assert.deepEqual(
    markerClaims.map((claim) => claim.claimed).sort((a, b) => a - b),
    [543, 543]
  );
});

test('verifyTestCounts fails on a documented/executed mismatch and on a red suite', () => {
  const mismatch = verifyTestCounts({
    executed: 543,
    fail: 0,
    claims: [{ file: 'ARCHITECTURE.md', line: 3, claimed: 542, kind: 'prose' }],
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.findings[0].code, 'COUNT_MISMATCH');
  assert.equal(mismatch.findings[0].claimed, 542);
  assert.equal(mismatch.findings[0].executed, 543);

  const red = verifyTestCounts({ executed: 543, fail: 1, claims: [] });
  assert.equal(red.ok, false);
  assert.equal(red.findings[0].code, 'TEST_FAILURE');
});

test('checkVersionTriple validates package, cache-bust, README and notes heading', () => {
  const root = tempRoot();
  write(root, 'package.json', JSON.stringify({ version: '3.58.0' }));
  write(root, 'public/index.html', '<link href="/css/cyberpunk.css?v=3.58.0"><script src="/js/app.js?v=3.58.0"></script>');
  write(root, 'README.md', 'Version **3.58.0** · status');
  write(root, 'RELEASE_NOTES.md', '## v3.58.0 — release\n\n## v3.57.0 — old');
  const ok = checkVersionTriple({ root, version: '3.58.0' });
  assert.equal(ok.ok, true, JSON.stringify(ok.findings));
  assert.equal(ok.declaration, '3.58.0');

  write(root, 'public/index.html', '<script src="/js/app.js?v=3.57.0"></script>');
  const stale = checkVersionTriple({ root, version: '3.58.0' });
  assert.equal(stale.ok, false);
  assert.ok(stale.findings.some((finding) => finding.code === 'CACHE_BUST_STALE'));
});

test('prerequisite validation requires owner, issue, evidence and a blocking flag', () => {
  const valid = {
    external: [
      { id: 'A11Y-02', issue: 13, owner: 'accessibility-lead', status: 'open', blocksRelease: true, title: 'Device gate', requiredEvidence: 'captures' },
    ],
    deferred: [
      { id: 'SOAK', issue: 39, owner: 'platform-ops', status: 'open', blocksRelease: false, title: 'Soak', requiredEvidence: 'summary.json' },
    ],
  };
  assert.equal(validatePrerequisites(valid).ok, true);
  const broken = validatePrerequisites({ external: [{ id: 'OPS-04', issue: 41, owner: '', status: 'ready', blocksRelease: true }] });
  assert.equal(broken.ok, false);
  assert.ok(broken.findings.some((finding) => finding.code === 'PREREQUISITE_OWNER'));
  assert.ok(broken.findings.some((finding) => finding.code === 'PREREQUISITE_STATUS'));
});

test('verdict and exit codes follow the documented matrix', () => {
  const passing = { gates: [{ status: 'pass', ok: true }], external: [] };
  const open = { external: [{ id: 'A11Y-02', issue: 13, owner: 'a11y', status: 'open', blocksRelease: true }] };
  assert.equal(verdictFor(passing), 'GREEN');
  assert.equal(verdictFor({ gates: [{ status: 'pass', ok: true }], prerequisites: open }), 'BLOCKED');
  assert.equal(verdictFor({ gates: [{ status: 'fail', ok: false }], prerequisites: open }), 'RED');

  assert.equal(exitCodeFor({ verdict: 'GREEN' }), EXIT_CODES.GREEN);
  assert.equal(exitCodeFor({ verdict: 'RED' }), EXIT_CODES.RED);
  assert.equal(exitCodeFor({ verdict: 'RED', preflight: true }), EXIT_CODES.PREFLIGHT);
  assert.equal(exitCodeFor({ verdict: 'RED', missingDependency: true }), EXIT_CODES.MISSING_DEPENDENCY);
  assert.equal(exitCodeFor({ verdict: 'RED', countMismatch: true }), EXIT_CODES.TEST_COUNT_MISMATCH);
  assert.equal(exitCodeFor({ verdict: 'BLOCKED' }), EXIT_CODES.BLOCKED);
});

test('manifest validation and atomic artifact writing produce the report contract', () => {
  const dir = tempRoot();
  const manifest = {
    schemaVersion: 1,
    version: '3.58.0',
    commit: '8d79afa',
    tag: 'v3.58.0',
    generatedAt: new Date().toISOString(),
    durationMs: 1234,
    gates: [{ id: 'tests', name: 'suite', command: 'node --test', status: 'pass', ok: true, durationMs: 10, evidence: 'x' }],
    testCount: { executed: 543, pass: 543, fail: 0, claimsChecked: 4, mismatches: 0 },
    externalPrerequisites: [{ id: 'A11Y-02', issue: 13, owner: 'a11y', status: 'open', blocksRelease: true, requiredEvidence: 'captures' }],
    deferredPrerequisites: [],
    verdict: 'BLOCKED',
    exitCode: EXIT_CODES.BLOCKED,
    artifacts: { manifest: 'release-manifest.json', report: 'release-report.md', logs: 'logs' },
  };
  assert.equal(validateManifest(manifest).ok, true);
  const written = writeArtifacts({ dir, manifest });
  assert.equal(fs.existsSync(written.manifestFile), true);
  assert.equal(fs.existsSync(written.reportFile), true);
  const parsed = JSON.parse(fs.readFileSync(written.manifestFile, 'utf8'));
  assert.equal(parsed.verdict, 'BLOCKED');
  const report = fs.readFileSync(written.reportFile, 'utf8');
  assert.match(report, /BLOCKED/);
  assert.match(report, /A11Y-02/);
  assert.match(report, /120-minute soak|Separate release prerequisites/);

  const invalid = validateManifest({ ...manifest, verdict: 'MAYBE' });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.findings.some((finding) => finding.code === 'MANIFEST_VERDICT'));
});

test('renderSummary names the failing gate before anything else', () => {
  const markdown = renderSummary({
    version: '3.58.0',
    commit: 'abc1234',
    tag: 'v3.58.0',
    generatedAt: new Date().toISOString(),
    durationMs: 1000,
    verdict: 'RED',
    exitCode: 1,
    gates: [{ id: 'tests', status: 'fail', ok: false, durationMs: 5, command: 'node --test' }],
    testCount: { executed: 543, pass: 542, fail: 1 },
    externalPrerequisites: [],
    deferredPrerequisites: [],
    rollback: {},
    artifacts: {},
  });
  assert.match(markdown, /Verdict: RED/);
  assert.match(markdown, /\| tests \| FAIL \|/);
});

test('release gate --dry-run is a zero-side-effect report contract', () => {
  const result = spawnSync(process.execPath, ['scripts/release-gate.mjs', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.mode, 'dry-run');
  assert.match(plan.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(plan.gates.slice(0, 3), ['prerequisites', 'version', 'tests']);
  assert.ok(plan.gates.includes('surface-truth'));
  assert.ok(plan.gates.includes('rollback'));
  assert.match(plan.soak, /separate release prerequisite/);
  assert.ok(Array.isArray(plan.externalPrerequisites));
  assert.ok(plan.externalPrerequisites.some((row) => row.id === 'A11Y-02' && row.owner));
});
