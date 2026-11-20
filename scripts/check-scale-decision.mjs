#!/usr/bin/env node
/**
 * NARIMATO — OPS-05 decision-record consistency gate.
 *
 * Fails when the human decision record disagrees with the machine sources:
 * `observability/slo.json` (thresholds), `observability/scale-profile.json`
 * (rule references and watch ratio), or the measured capture. It also rejects a
 * record that claims a soak pass while the capture says the soak was not run.
 *
 * Usage:
 *   node scripts/check-scale-decision.mjs
 *   node scripts/check-scale-decision.mjs --json
 *   node scripts/check-scale-decision.mjs --root <checkout>
 *
 * Exit codes: 0 clean, 1 findings, 2 internal error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decide, loadProfile, loadRuleset, resolveThresholds } from './scale-gate.mjs';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
export const DECISION_FILE = 'docs/SHARDING_DECISION.md';
export const CAPTURE_FILE = 'observability/scale-capture-ops02.json';
export const PROFILE_FILE = 'observability/scale-profile.json';
export const RULES_FILE = 'observability/slo.json';

const REQUIRED_HEADINGS = [
  '## Current topology',
  '## Measured headroom',
  '## Trigger thresholds',
  '## Required evidence before any split',
  '## Capacity model',
  '## Migration outline',
  '## Rollback plan',
  '## Not now',
];

const REQUIRED_EVIDENCE_TERMS = ['120-minute soak', 'cache', 'egress', 'chaos', 'token', 'room ownership', 'rollback rehearsal'];

const THRESHOLD_UNITS = {
  httpP95Ms: 'ms',
  loopP95Ms: 'ms',
  droppedSse: '',
  errors: '',
  rssGrowthMiB: 'MiB',
};

const HEADROOM_ROWS = {
  'HTTP p95': 'httpP95Ms',
  'Event-loop p95': 'loopP95Ms',
  'RSS growth': 'rssGrowthMiB',
  'Dropped SSE': 'droppedSse',
  'Request errors': 'errors',
};

/** Find one `## heading` section body (up to the next `##`). */
export function section(markdown, heading) {
  const text = String(markdown || '');
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const rest = text.slice(start + heading.length);
  const next = /^## /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

export function parseDecisionBlock(markdown) {
  const match = /<!-- scale-decision:start -->([\s\S]*?)<!-- scale-decision:end -->/.exec(String(markdown || ''));
  if (!match) return null;
  const fence = /```json\s*([\s\S]*?)```/.exec(match[1]);
  if (!fence) return null;
  try {
    return JSON.parse(fence[1]);
  } catch {
    return null;
  }
}

function parseNumberCell(text) {
  const match = /^(-?\d+(?:\.\d+)?)\s*(ms|MiB)?$/.exec(String(text || '').trim());
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2] || '' };
}

function tableRows(body) {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2);
}

export function parseThresholdTable(markdown) {
  const rows = [];
  for (const cells of tableRows(section(markdown, '## Trigger thresholds'))) {
    const rule = /^`([^`]+)`$/.exec(cells[1] || '');
    const hard = parseNumberCell(cells[2]);
    const watch = parseNumberCell(cells[3]);
    if (!rule || !hard || !watch) continue;
    rows.push({ label: cells[0], ruleId: rule[1], hard: hard.value, hardUnit: hard.unit, watch: watch.value, watchUnit: watch.unit });
  }
  return rows;
}

export function parseHeadroomTable(markdown) {
  const rows = [];
  for (const cells of tableRows(section(markdown, '## Measured headroom'))) {
    const metric = HEADROOM_ROWS[cells[0]];
    if (!metric) continue;
    const measured = parseNumberCell(cells[1]);
    const slo = parseNumberCell(cells[2]);
    const headroom = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(cells[3] || '');
    if (!measured || !slo) continue;
    rows.push({ metric, measured: measured.value, measuredUnit: measured.unit, slo: slo.value, sloUnit: slo.unit, headroom: headroom ? Number(headroom[1]) : null });
  }
  return rows;
}

function close(left, right, tolerance = 0.11) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

/**
 * Verify a decision record against the machine sources.
 * Returns `{ ok, findings: [{code, message}], gate }`.
 */
export function verifyDecisionDocument({ markdown, ruleset, profile, capture, now = Date.now() }) {
  const findings = [];
  const add = (code, message) => findings.push({ code, message });
  const text = String(markdown || '');
  const thresholds = resolveThresholds(ruleset, profile);
  const gate = decide([capture], { thresholds, profile });
  const block = parseDecisionBlock(text);

  if (!block) {
    add('DECISION_BLOCK_MISSING', 'the `scale-decision` JSON block is missing or invalid');
  } else {
    if (block.decision !== 'NOT NOW') add('DECISION_MISMATCH', `decision is ${JSON.stringify(block.decision)}, expected "NOT NOW"`);
    if (block.verdict !== gate.verdict) add('VERDICT_MISMATCH', `record says ${block.verdict}, gate computes ${gate.verdict}`);
    if (block.capture !== CAPTURE_FILE) add('CAPTURE_PATH_MISMATCH', `capture path is ${block.capture}, expected ${CAPTURE_FILE}`);
    if (block.profile !== PROFILE_FILE) add('PROFILE_PATH_MISMATCH', `profile path is ${block.profile}, expected ${PROFILE_FILE}`);
    if (block.evidenceCommit !== capture.commit) add('EVIDENCE_COMMIT_MISMATCH', `evidence commit is ${block.evidenceCommit}, capture says ${capture.commit}`);
    if (block.owner !== profile.review?.ownerRole) add('OWNER_MISMATCH', `owner is ${block.owner}, profile says ${profile.review?.ownerRole}`);
    if (block.reviewDate !== profile.review?.reviewDate) add('REVIEW_DATE_MISMATCH', `review date is ${block.reviewDate}, profile says ${profile.review?.reviewDate}`);
  }

  const reviewTime = Date.parse(profile.review?.reviewDate || '');
  if (Number.isNaN(reviewTime)) add('REVIEW_DATE_INVALID', 'review date is not a parseable date');
  else if (reviewTime < now) add('REVIEW_OVERDUE', `review date ${profile.review.reviewDate} has passed; re-decide before relying on this record`);

  if (capture.soak && capture.soak.executed === false && !/not executed/i.test(text)) {
    add('SOAK_CLAIM', 'the capture records no soak result, so the record must say the soak was not executed');
  }

  for (const heading of REQUIRED_HEADINGS) {
    if (!text.includes(heading)) add('SECTION_MISSING', `missing required section: ${heading}`);
  }
  const lower = text.toLowerCase();
  for (const term of REQUIRED_EVIDENCE_TERMS) {
    if (!lower.includes(term)) add('EVIDENCE_TERM_MISSING', `required evidence term is missing: ${term}`);
  }

  const rows = parseThresholdTable(text);
  const metricByRule = Object.fromEntries(Object.entries(profile.sloRefs).map(([metric, rule]) => [rule, metric]));
  for (const [ruleId, metric] of Object.entries(metricByRule)) {
    const row = rows.find((entry) => entry.ruleId === ruleId);
    if (!row) {
      add('THRESHOLD_ROW_MISSING', `threshold table has no row for ${ruleId}`);
      continue;
    }
    const expected = thresholds[metric];
    const expectedWatch = expected > 0 ? expected * Number(profile.triggerRatio) : 0;
    if (!close(row.hard, expected, 1e-9)) add('THRESHOLD_DRIFT', `${ruleId} hard line is ${row.hard}, slo.json says ${expected}`);
    if (!close(row.watch, expectedWatch, 1e-6)) add('WATCH_DRIFT', `${ruleId} watch line is ${row.watch}, expected ${expectedWatch}`);
    if (row.hardUnit !== THRESHOLD_UNITS[metric]) add('THRESHOLD_UNIT_DRIFT', `${ruleId} unit is ${JSON.stringify(row.hardUnit)}, expected ${JSON.stringify(THRESHOLD_UNITS[metric])}`);
  }
  for (const row of rows) {
    if (!metricByRule[row.ruleId]) add('UNKNOWN_THRESHOLD_ROW', `threshold row ${row.ruleId} is not referenced by the profile`);
  }

  const headroomRows = parseHeadroomTable(text);
  for (const metric of ['httpP95Ms', 'loopP95Ms', 'rssGrowthMiB']) {
    const row = headroomRows.find((entry) => entry.metric === metric);
    if (!row) {
      add('HEADROOM_ROW_MISSING', `measured-headroom table has no row for ${metric}`);
      continue;
    }
    const measured = capture[metric];
    const slo = thresholds[metric];
    if (!close(row.measured, measured, 0.11)) add('MEASURED_DRIFT', `${metric} measured is ${row.measured}, capture says ${measured}`);
    if (!close(row.slo, slo, 1e-9)) add('HEADROOM_SLO_DRIFT', `${metric} SLO is ${row.slo}, slo.json says ${slo}`);
    if (row.headroom != null) {
      const expectedHeadroom = (1 - measured / slo) * 100;
      if (!close(row.headroom, expectedHeadroom, 0.11)) add('HEADROOM_DRIFT', `${metric} headroom is ${row.headroom}%, computed ${expectedHeadroom.toFixed(2)}%`);
    }
  }

  return { ok: findings.length === 0, findings, gate };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main(argv) {
  const options = { json: false, root: ROOT };
  try {
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg === '--json') options.json = true;
      else if (arg === '--root') options.root = path.resolve(argv[++index] || ROOT);
      else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
      else if (arg === '--help' || arg === '-h') {
        console.error('usage: node scripts/check-scale-decision.mjs [--json] [--root <checkout>]');
        return 2;
      } else throw new Error(`unknown argument: ${arg}`);
    }
    const markdown = fs.readFileSync(path.join(options.root, DECISION_FILE), 'utf8');
    const ruleset = loadRuleset(path.join(options.root, RULES_FILE));
    const profile = loadProfile(path.join(options.root, PROFILE_FILE));
    const capture = readJson(path.join(options.root, CAPTURE_FILE));
    const report = verifyDecisionDocument({ markdown, ruleset, profile, capture });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const finding of report.findings) console.error(`${finding.code} — ${finding.message}`);
      console.error(
        report.ok
          ? `check:scale OK — ${DECISION_FILE} agrees with ${RULES_FILE} and ${CAPTURE_FILE} (verdict ${report.gate.verdict})`
          : `check:scale FAILED — ${report.findings.length} finding(s)`
      );
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`check:scale INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}

export default { verifyDecisionDocument, parseDecisionBlock, parseThresholdTable, parseHeadroomTable };
