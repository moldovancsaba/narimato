/**
 * OPS-05 — sharding decision gate and decision-record consistency.
 *
 * Covers the four verdicts and their exit codes, the watch/hard boundaries,
 * non-production and window caps, the two-capture rule, stale commits, counter
 * resets, and drift between docs/SHARDING_DECISION.md and observability/slo.json.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PROFILE,
  DEFAULT_RULES,
  VERDICT_EXIT,
  classifyCapture,
  decide,
  loadProfile,
  loadRuleset,
  resolveThresholds,
  validateCapture,
} from '../scripts/scale-gate.mjs';
import {
  DECISION_FILE,
  parseDecisionBlock,
  parseHeadroomTable,
  parseThresholdTable,
  verifyDecisionDocument,
} from '../scripts/check-scale-decision.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = loadRuleset(DEFAULT_RULES);
const PROFILE = loadProfile(DEFAULT_PROFILE);
const THRESHOLDS = resolveThresholds(RULES, PROFILE);
const CAPTURE_FILE = path.join(ROOT, 'observability', 'scale-capture-ops02.json');
const GATE = path.join(ROOT, 'scripts', 'scale-gate.mjs');
const CHECK = path.join(ROOT, 'scripts', 'check-scale-decision.mjs');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fixture(name) {
  return path.join(ROOT, 'test', 'fixtures', name);
}

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
}

function numbers(value, out = []) {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) for (const entry of value) numbers(entry, out);
  else if (value && typeof value === 'object') for (const entry of Object.values(value)) numbers(entry, out);
  return out;
}

test('scale gate: the profile references existing slo.json rules and duplicates no SLO number', () => {
  for (const [metric, ruleId] of Object.entries(PROFILE.sloRefs)) {
    assert.ok(Number.isFinite(THRESHOLDS[metric]), `${metric} must resolve from ${ruleId}`);
  }
  const sloNumbers = new Set(Object.values(THRESHOLDS).filter((value) => Number.isFinite(value) && value > 1));
  for (const value of numbers(PROFILE)) {
    assert.equal(sloNumbers.has(value), false, `profile duplicates an SLO threshold value: ${value}`);
  }
  assert.equal(PROFILE.triggerRatio > 0 && PROFILE.triggerRatio < 1, true);
  assert.equal(PROFILE.independentCaptures, 2);
});

test('scale gate: the committed OPS-02 capture is HOLD and below the watch line', () => {
  const capture = readJson(CAPTURE_FILE);
  const result = decide([capture], { thresholds: THRESHOLDS, profile: PROFILE });
  assert.equal(result.verdict, 'HOLD');
  assert.equal(result.exitCode, VERDICT_EXIT.HOLD);
  assert.equal(capture.production, false, 'the measured capture is non-production');
  assert.equal(capture.soak.executed, false, 'the 120-minute soak is not executed');
  assert.ok(result.results[0].ratios.http < PROFILE.triggerRatio);
  assert.ok(result.results[0].ratios.loop < PROFILE.triggerRatio);
  assert.ok(result.results[0].ratios.rss < PROFILE.triggerRatio);
});

test('scale gate: watch starts at the trigger ratio and hard breach starts above the SLO', () => {
  const hold = readJson(fixture('scale-hold.json'));
  const watchLine = {
    ...hold,
    loopP95Ms: THRESHOLDS.loopP95Ms * PROFILE.triggerRatio,
  };
  assert.equal(classifyCapture(watchLine, { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'WATCH');
  assert.equal(classifyCapture({ ...hold, httpP95Ms: THRESHOLDS.httpP95Ms }, { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'WATCH');
  assert.equal(classifyCapture({ ...hold, httpP95Ms: THRESHOLDS.httpP95Ms + 1 }, { thresholds: THRESHOLDS, profile: PROFILE }).rawVerdict, 'SPLIT');
  assert.equal(classifyCapture({ ...hold, droppedSse: THRESHOLDS.droppedSse + 1 }, { thresholds: THRESHOLDS, profile: PROFILE }).rawVerdict, 'SPLIT');
  assert.equal(classifyCapture({ ...hold, errors: THRESHOLDS.errors + 1 }, { thresholds: THRESHOLDS, profile: PROFILE }).rawVerdict, 'SPLIT');
  assert.equal(classifyCapture({ ...hold, rssGrowthMiB: THRESHOLDS.rssGrowthMiB + 1 }, { thresholds: THRESHOLDS, profile: PROFILE }).rawVerdict, 'SPLIT');
});

test('scale gate: non-production and short-window breaches cannot authorize a split', () => {
  const split = readJson(fixture('scale-split-a.json'));
  const nonProduction = classifyCapture({ ...split, production: false }, { thresholds: THRESHOLDS, profile: PROFILE });
  assert.equal(nonProduction.rawVerdict, 'SPLIT');
  assert.equal(nonProduction.verdict, 'WATCH');
  const short = classifyCapture({ ...split, durationMinutes: PROFILE.minimumSustainedMinutes - 1 }, { thresholds: THRESHOLDS, profile: PROFILE });
  assert.equal(short.verdict, 'MORE_EVIDENCE');
  const reset = classifyCapture({ ...split, durationMinutes: 15, uptimeMs: 60_000 }, { thresholds: THRESHOLDS, profile: PROFILE });
  assert.equal(reset.verdict, 'MORE_EVIDENCE');
});

test('scale gate: SPLIT requires two independent production captures at launch concurrency', () => {
  const a = readJson(fixture('scale-split-a.json'));
  const b = readJson(fixture('scale-split-b.json'));
  assert.equal(decide([a], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
  assert.equal(decide([a, { ...b, durationMinutes: 1 }], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
  assert.equal(decide([a, { ...b, production: false }], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
  assert.equal(decide([a, { ...b, clients: 100, sseClients: 40 }], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
  assert.equal(decide([a, { ...b, id: a.id }], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
  const split = decide([a, b], { thresholds: THRESHOLDS, profile: PROFILE });
  assert.equal(split.verdict, 'SPLIT');
  assert.equal(split.exitCode, VERDICT_EXIT.SPLIT);
});

test('scale gate: missing fields, stale commits and counter resets fail closed', () => {
  assert.ok(validateCapture({}).length > 0);
  const hold = readJson(fixture('scale-hold.json'));
  assert.equal(decide([{ ...hold, hardware: '' }], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
  const stale = decide([hold], { thresholds: THRESHOLDS, profile: PROFILE, commit: 'f06360e' });
  assert.equal(stale.verdict, 'MORE_EVIDENCE');
  assert.ok(stale.reasons.some((reason) => reason.includes('not the review commit')));
  assert.equal(decide([hold], { thresholds: THRESHOLDS, profile: PROFILE, commit: 'deadbee123' }).verdict, 'HOLD');
  assert.equal(decide([], { thresholds: THRESHOLDS, profile: PROFILE }).verdict, 'MORE_EVIDENCE');
});

test('scale gate CLI: four verdicts map to exit codes 0, 1, 2 and 3', () => {
  const hold = runNode(GATE, ['--capture', fixture('scale-hold.json')]);
  assert.equal(hold.status, 0);
  assert.match(hold.stdout, /HOLD/);

  const watch = runNode(GATE, ['--capture', fixture('scale-watch.json')]);
  assert.equal(watch.status, 1);
  assert.match(watch.stdout, /WATCH/);

  const split = runNode(GATE, ['--captures', `${fixture('scale-split-a.json')},${fixture('scale-split-b.json')}`]);
  assert.equal(split.status, 2);
  assert.match(split.stdout, /SPLIT/);

  const more = runNode(GATE, ['--capture', fixture('scale-split-a.json')]);
  assert.equal(more.status, 3);
  assert.match(more.stdout, /MORE_EVIDENCE/);
});

test('check:scale: the committed decision record agrees with slo.json, the profile and the capture', () => {
  const markdown = fs.readFileSync(path.join(ROOT, DECISION_FILE), 'utf8');
  const capture = readJson(CAPTURE_FILE);
  const report = verifyDecisionDocument({ markdown, ruleset: RULES, profile: PROFILE, capture });
  assert.deepEqual(report.findings, []);
  assert.equal(report.gate.verdict, 'HOLD');

  const block = parseDecisionBlock(markdown);
  assert.equal(block.decision, 'NOT NOW');
  assert.equal(block.evidenceCommit, capture.commit);
  assert.equal(parseThresholdTable(markdown).length, Object.keys(PROFILE.sloRefs).length);
  assert.deepEqual(
    parseHeadroomTable(markdown).map((row) => row.metric).sort(),
    Object.keys(PROFILE.sloRefs).sort()
  );

  const cli = runNode(CHECK, []);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stderr, /check:scale OK/);
});

test('check:scale: threshold, watch, measured and verdict drift are findings', () => {
  const markdown = fs.readFileSync(path.join(ROOT, DECISION_FILE), 'utf8');
  const capture = readJson(CAPTURE_FILE);
  const thresholdRow = `| HTTP p95 | \`${PROFILE.sloRefs.httpP95Ms}\` | ${THRESHOLDS.httpP95Ms} ms | ${THRESHOLDS.watch.httpP95Ms} ms |`;
  const headroomRow = `| HTTP p95 | ${capture.httpP95Ms} ms | ${THRESHOLDS.httpP95Ms} ms | ${((1 - capture.httpP95Ms / THRESHOLDS.httpP95Ms) * 100).toFixed(1)} % |`;
  assert.ok(markdown.includes(thresholdRow), 'the committed table row must be parseable');
  assert.ok(markdown.includes(headroomRow), 'the committed headroom row must be parseable');

  const drifted = markdown
    .replace(thresholdRow, thresholdRow.replace(`${THRESHOLDS.httpP95Ms} ms`, `${THRESHOLDS.httpP95Ms + 1} ms`))
    .replace(headroomRow, headroomRow.replace(`${capture.httpP95Ms} ms`, `${capture.httpP95Ms + 1} ms`))
    .replace(`"verdict": "HOLD"`, '"verdict": "SPLIT"')
    .replace(`"owner": "${PROFILE.review.ownerRole}"`, '"owner": "someone-else"')
    .replace(`"reviewDate": "${PROFILE.review.reviewDate}"`, '"reviewDate": "2026-01-01"');
  const report = verifyDecisionDocument({ markdown: drifted, ruleset: RULES, profile: PROFILE, capture });
  const codes = new Set(report.findings.map((finding) => finding.code));
  for (const code of ['THRESHOLD_DRIFT', 'MEASURED_DRIFT', 'VERDICT_MISMATCH', 'OWNER_MISMATCH', 'REVIEW_DATE_MISMATCH']) {
    assert.ok(codes.has(code), `expected ${code}; got ${[...codes].join(', ')}`);
  }
});

test('check:scale: a claimed soak pass and a missing section are rejected', () => {
  const markdown = fs.readFileSync(path.join(ROOT, DECISION_FILE), 'utf8');
  const capture = readJson(CAPTURE_FILE);
  const claimed = markdown
    .replace('not executed', 'passed')
    .replace('## Rollback plan', '## Restore notes');
  const report = verifyDecisionDocument({ markdown: claimed, ruleset: RULES, profile: PROFILE, capture });
  const codes = new Set(report.findings.map((finding) => finding.code));
  assert.ok(codes.has('SOAK_CLAIM'), `expected SOAK_CLAIM; got ${[...codes].join(', ')}`);
  assert.ok(codes.has('SECTION_MISSING'), `expected SECTION_MISSING; got ${[...codes].join(', ')}`);
});

test('check:scale: the threshold table covers every profile rule exactly once', () => {
  const markdown = fs.readFileSync(path.join(ROOT, DECISION_FILE), 'utf8');
  const rows = parseThresholdTable(markdown);
  assert.deepEqual(
    rows.map((row) => row.ruleId).sort(),
    Object.values(PROFILE.sloRefs).sort()
  );
  for (const row of rows) {
    assert.ok(Number.isFinite(row.hard));
    assert.ok(Number.isFinite(row.watch));
  }
  const capture = readJson(CAPTURE_FILE);
  const report = verifyDecisionDocument({ markdown, ruleset: RULES, profile: PROFILE, capture });
  assert.equal(report.ok, true);
  assert.equal(report.findings.length, 0);
});
