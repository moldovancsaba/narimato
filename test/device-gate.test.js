import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  DEFAULT_MAX_AGE_DAYS,
  EXIT,
  buildPlan,
  buildTemplate,
  evaluateLedger,
  expectedRows,
} from '../scripts/device-gate.mjs';

const SCRIPT = path.resolve('scripts/device-gate.mjs');
const FIXTURES = path.resolve('test/fixtures/device-gate');
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const SHORT = COMMIT.slice(0, 7);
const NOW = '2026-11-21T12:00:00Z';

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-device-gate-'));
}

function evidencePath(root, relative) {
  const full = path.resolve(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, 'fixture capture');
  return full;
}

function materialize(root, ledger) {
  for (const row of ledger.rows || []) {
    for (const entry of row.evidence || []) evidencePath(root, entry);
  }
}

function writeLedger(root, ledger, relative = `media/a11y/device-gate/${SHORT}/EVIDENCE.json`) {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(ledger, null, 2)}\n`);
  return full;
}

function run(root, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args, `--root=${root}`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: '' },
  });
}

function evaluate(ledger, overrides = {}) {
  return evaluateLedger(ledger, {
    commit: COMMIT,
    now: new Date(NOW),
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    root: overrides.root || tempRoot(),
    ...overrides,
  });
}

test('the plan is a fixed 20-row matrix across five targets', () => {
  const plan = buildPlan(COMMIT);
  assert.equal(plan.rows.length, 20);
  assert.equal(plan.targets, 5);
  assert.equal(plan.shortCommit, SHORT);
  assert.equal(new Set(plan.rows.map((row) => row.id)).size, 20);
  assert.deepEqual(
    [...new Set(plan.rows.map((row) => row.target))].sort(),
    ['android-chrome', 'ipad-safari', 'iphone-safari', 'macos-voiceover', 'windows-nvda'],
  );
  const iphone = plan.rows.filter((row) => row.target === 'iphone-safari');
  assert.deepEqual(iphone[0].viewports, ['390x844', '844x390']);
  assert.equal(iphone.find((row) => row.id.endsWith('/sr')).script, 'SR-IPHONE-VO');
  for (const row of plan.rows) assert.ok(row.criterion.length > 30);
});

test('the template is explicitly not evidence and has every matrix row', () => {
  const template = buildTemplate(COMMIT);
  assert.equal(template.template, true);
  assert.equal(template.rows.length, expectedRows().length);
  const report = evaluate(template);
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === 'TEMPLATE_NOT_EVIDENCE'));
});

test('the committed template stays in sync with the fixed matrix', () => {
  const template = JSON.parse(
    fs.readFileSync(path.resolve('docs/device-gate/EVIDENCE.template.json'), 'utf8'),
  );
  assert.equal(template.template, true);
  assert.deepEqual(
    template.rows.map((row) => row.id),
    expectedRows().map((row) => row.id),
  );
  assert.deepEqual(
    template.rows.map((row) => row.script),
    expectedRows().map((row) => row.script),
  );
});

test('a complete pass ledger signs the gate', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.equal(report.ok, true, JSON.stringify(report.findings, null, 2));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.pass, 20);
  assert.equal(report.summary.findings, 0);
  assert.equal(report.approvals, 2);
  assert.equal(report.commit, COMMIT);
});

test('--check exits 0 for a complete pass ledger at the default path', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  materialize(root, ledger);
  writeLedger(root, ledger);
  const result = run(root, ['--check', `--commit=${COMMIT}`, `--now=${NOW}`]);
  assert.equal(result.status, EXIT.PASS, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /device-gate: pass \(20\/20 rows/);
});

test('--check exits 3 when the ledger is absent and never reports a pass', () => {
  const root = tempRoot();
  const result = run(root, ['--check', `--commit=${COMMIT}`, `--now=${NOW}`]);
  assert.equal(result.status, EXIT.LEDGER_MISSING);
  assert.match(result.stderr, /LEDGER_MISSING/);
  assert.doesNotMatch(result.stdout, /device-gate: pass/);
});

test('an empty ledger is invalid, not a pass', () => {
  const report = evaluate(fixture('missing.json'));
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === 'SCHEMA_VERSION'));
  assert.ok(report.findings.some((finding) => finding.code === 'ROW_MISSING'));
});

test('an incomplete ledger reports missing coverage, evidence, defect and approvals', () => {
  const root = tempRoot();
  const ledger = fixture('incomplete.json');
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.equal(report.ok, false);
  const codes = new Set(report.findings.map((finding) => finding.code));
  assert.ok(codes.has('ROW_MISSING'));
  assert.ok(codes.has('EVIDENCE_MISSING'));
  assert.ok(codes.has('DEFECT_MISSING'));
  assert.ok(codes.has('APPROVALS_MISSING'));
  assert.ok(codes.has('ROW_FAILED'));
  assert.equal(report.summary.fail, 1);
});

test('rows must cover the documented viewports, OS and browser', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  ledger.rows[0].viewports = ['390x844'];
  ledger.rows[1].device.os = 'Android 13';
  ledger.rows[1].device.browser = 'Chrome';
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  const codes = new Set(report.findings.map((finding) => finding.code));
  assert.ok(codes.has('VIEWPORTS_MISMATCH'));
  assert.ok(codes.has('DEVICE_OS_MISMATCH'));
  assert.ok(codes.has('DEVICE_BROWSER_MISMATCH'));
});

test('an expired row fails freshness and blocks sign-off', () => {
  const root = tempRoot();
  const ledger = fixture('expired.json');
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === 'CAPTURED_AT_EXPIRED'));
  assert.ok(report.findings.some((finding) => finding.code === 'CAPTURED_BEFORE_RUN'));
});

test('--check exits 1 for an expired row', () => {
  const root = tempRoot();
  const ledger = fixture('expired.json');
  materialize(root, ledger);
  writeLedger(root, ledger);
  const result = run(root, ['--check', `--commit=${COMMIT}`, `--now=${NOW}`]);
  assert.equal(result.status, EXIT.BLOCKED, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /CAPTURED_AT_EXPIRED/);
});

test('a blocked row is recorded with a reason and still blocks the gate', () => {
  const root = tempRoot();
  const ledger = fixture('blocked.json');
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === 'ROW_BLOCKED'));
  assert.equal(report.summary.blocked, 1);
});

test('a blocked row without a reason is invalid', () => {
  const root = tempRoot();
  const ledger = fixture('blocked.json');
  const row = ledger.rows.find((entry) => entry.verdict === 'blocked');
  row.reason = '';
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.ok(report.findings.some((finding) => finding.code === 'BLOCKED_REASON_MISSING'));
});

test('commit provenance must match the full SHA', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  ledger.commit = 'ffffffffffffffffffffffffffffffffffffffff';
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === 'COMMIT_MISMATCH'));

  const shortReport = evaluate(fixture('pass.json'), { root, commit: SHORT });
  assert.ok(shortReport.findings.some((finding) => finding.code === 'COMMIT_ARGUMENT_INVALID'));
});

test('two distinct approvals are required, one from a non-executor', () => {
  const root = tempRoot();
  const duplicate = fixture('pass.json');
  duplicate.approvals[1].name = duplicate.approvals[0].name;
  materialize(root, duplicate);
  let report = evaluate(duplicate, { root });
  assert.ok(report.findings.some((finding) => finding.code === 'APPROVAL_DUPLICATE'));

  const allExecuted = fixture('pass.json');
  allExecuted.approvals[1].executed = true;
  report = evaluate(allExecuted, { root });
  assert.ok(report.findings.some((finding) => finding.code === 'APPROVAL_INDEPENDENT_MISSING'));

  const future = fixture('pass.json');
  future.approvals[0].date = '2027-01-01';
  report = evaluate(future, { root });
  assert.ok(report.findings.some((finding) => finding.code === 'APPROVAL_FUTURE'));
});

test('evidence must stay inside the commit directory, exist and not be reused', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  materialize(root, ledger);
  ledger.rows[0].evidence = ['media/a11y/device-gate/fffffff/iphone.jpg'];
  ledger.rows[1].evidence = [`media/a11y/device-gate/${SHORT}/missing.jpg`];
  ledger.rows[2].evidence = [ledger.rows[3].evidence[0]];
  const report = evaluate(ledger, { root });
  const codes = new Set(report.findings.map((finding) => finding.code));
  assert.ok(codes.has('EVIDENCE_OUTSIDE_COMMIT'));
  assert.ok(codes.has('EVIDENCE_NOT_FOUND'));
  assert.ok(codes.has('EVIDENCE_REUSED'));
});

test('a fail row requires an absolute defect issue and a [Device][Surface] title', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  const row = ledger.rows[0];
  row.verdict = 'fail';
  row.defect = 'not-a-link';
  row.defectTitle = 'clipped HUD';
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  const codes = new Set(report.findings.map((finding) => finding.code));
  assert.ok(codes.has('DEFECT_INVALID'));
  assert.ok(codes.has('DEFECT_TITLE_INVALID'));
  assert.ok(codes.has('ROW_FAILED'));

  row.defect = 'https://github.com/moldovancsaba/narimato/issues/99';
  row.defectTitle = '[Device][HUD] clipped HUD at 200% zoom';
  const valid = evaluate(ledger, { root });
  assert.ok(!valid.findings.some((finding) => finding.code === 'DEFECT_INVALID'));
  assert.ok(!valid.findings.some((finding) => finding.code === 'DEFECT_TITLE_INVALID'));
  assert.equal(valid.ok, false);
});

test('a pass row cannot carry a defect link', () => {
  const root = tempRoot();
  const ledger = fixture('pass.json');
  ledger.rows[0].defect = 'https://github.com/moldovancsaba/narimato/issues/99';
  materialize(root, ledger);
  const report = evaluate(ledger, { root });
  assert.ok(report.findings.some((finding) => finding.code === 'DEFECT_ON_PASS'));
});

test('--plan prints 20 rows and --json is machine-readable', () => {
  const root = tempRoot();
  const human = run(root, ['--plan', `--commit=${COMMIT}`]);
  assert.equal(human.status, EXIT.PASS);
  assert.match(human.stdout, /20 rows, 5 targets/);
  assert.equal(human.stdout.trim().split('\n').length, 21);

  const json = run(root, ['--plan', `--commit=${COMMIT}`, '--json']);
  assert.equal(json.status, EXIT.PASS);
  const plan = JSON.parse(json.stdout);
  assert.equal(plan.rows.length, 20);
});

test('--check --json reports the blocked contract without a false pass', () => {
  const root = tempRoot();
  const result = run(root, ['--check', `--commit=${COMMIT}`, `--now=${NOW}`, '--json']);
  assert.equal(result.status, EXIT.LEDGER_MISSING);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.code, 'LEDGER_MISSING');
});
