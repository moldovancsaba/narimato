#!/usr/bin/env node
/**
 * NARIMATO — OPS-05 sharding decision gate.
 *
 * Reads a measured capture plus the OPS-05 profile and the OPS-01 SLO ruleset,
 * then prints HOLD, WATCH, SPLIT or MORE_EVIDENCE. It never mutates a running
 * system and never starts a shard: SPLIT only authorises a design.
 *
 * Threshold values are resolved from `observability/slo.json` at run time. This
 * file contains no HTTP/loop/RSS threshold literals.
 *
 * Usage:
 *   node scripts/scale-gate.mjs --capture observability/scale-capture-ops02.json
 *   node scripts/scale-gate.mjs --captures capture-a.json,capture-b.json
 *   node scripts/scale-gate.mjs --capture capture.json --commit <sha>
 *   node scripts/scale-gate.mjs --capture capture.json --json
 *
 * Exit codes: 0 HOLD, 1 WATCH, 2 SPLIT, 3 MORE_EVIDENCE.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flattenRules } from './perf-gate.mjs';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
export const DEFAULT_RULES = path.join(ROOT, 'observability', 'slo.json');
export const DEFAULT_PROFILE = path.join(ROOT, 'observability', 'scale-profile.json');

export const VERDICT_EXIT = Object.freeze({ HOLD: 0, WATCH: 1, SPLIT: 2, MORE_EVIDENCE: 3 });

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadRuleset(file = DEFAULT_RULES) {
  const document = readJson(file);
  if (!document || !Array.isArray(document.rules)) throw new Error(`${file}: rules[] is required`);
  return document;
}

export function loadProfile(file = DEFAULT_PROFILE) {
  const profile = readJson(file);
  if (!profile || typeof profile !== 'object') throw new Error(`${file}: profile must be an object`);
  if (!profile.sloRefs || typeof profile.sloRefs !== 'object' || !Object.keys(profile.sloRefs).length) {
    throw new Error(`${file}: sloRefs must be a non-empty {metric: ruleId} map`);
  }
  const ratio = Number(profile.triggerRatio);
  if (!(ratio > 0 && ratio < 1)) throw new Error(`${file}: triggerRatio must be between 0 and 1`);
  if (!Number.isInteger(profile.launchConcurrency?.clients) || profile.launchConcurrency.clients < 1) {
    throw new Error(`${file}: launchConcurrency.clients must be a positive integer`);
  }
  if (!Number.isInteger(profile.launchConcurrency?.sseClients) || profile.launchConcurrency.sseClients < 0) {
    throw new Error(`${file}: launchConcurrency.sseClients must be a non-negative integer`);
  }
  if (!(Number(profile.minimumSustainedMinutes) > 0)) throw new Error(`${file}: minimumSustainedMinutes must be positive`);
  if (!(Number(profile.soakMinutes) > 0)) throw new Error(`${file}: soakMinutes must be positive`);
  if (!Number.isInteger(profile.independentCaptures) || profile.independentCaptures < 2) {
    throw new Error(`${file}: independentCaptures must be an integer >= 2`);
  }
  return profile;
}

/**
 * Resolve every `sloRefs` rule id against the OPS-01 ruleset and derive the
 * watch lines. A missing rule is a contract error, never a silent zero.
 */
export function resolveThresholds(ruleset, profile) {
  const available = flattenRules(ruleset);
  const resolved = {};
  for (const [metric, ruleId] of Object.entries(profile.sloRefs)) {
    const value = available[ruleId];
    if (!Number.isFinite(value)) throw new Error(`profile: threshold ${metric} references unknown rule ${ruleId}`);
    resolved[metric] = value;
  }
  const ratio = Number(profile.triggerRatio);
  return {
    ...resolved,
    triggerRatio: ratio,
    watch: {
      httpP95Ms: resolved.httpP95Ms * ratio,
      loopP95Ms: resolved.loopP95Ms * ratio,
      rssGrowthMiB: resolved.rssGrowthMiB * ratio,
    },
  };
}

/** Schema validation for one capture. Returns an array of human-readable problems. */
export function validateCapture(capture) {
  const problems = [];
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) return ['capture must be an object'];
  for (const field of ['id', 'commit', 'hardware', 'recordedAt']) {
    if (typeof capture[field] !== 'string' || !capture[field].trim()) problems.push(`${field} must be a non-empty string`);
  }
  if (typeof capture.production !== 'boolean') problems.push('production must be a boolean');
  if (!Number.isFinite(capture.durationMinutes) || capture.durationMinutes <= 0) {
    problems.push('durationMinutes must be a positive number');
  }
  if (!Number.isInteger(capture.clients) || capture.clients < 1) problems.push('clients must be a positive integer');
  if (!Number.isInteger(capture.sseClients) || capture.sseClients < 0) problems.push('sseClients must be a non-negative integer');
  if (Number.isInteger(capture.clients) && Number.isInteger(capture.sseClients) && capture.sseClients > capture.clients) {
    problems.push('sseClients cannot exceed clients');
  }
  for (const field of ['httpP95Ms', 'loopP95Ms', 'droppedSse', 'errors', 'rssGrowthMiB']) {
    if (!Number.isFinite(capture[field]) || capture[field] < 0) problems.push(`${field} must be a non-negative number`);
  }
  if (typeof capture.recordedAt === 'string' && Number.isNaN(Date.parse(capture.recordedAt))) {
    problems.push('recordedAt must be a parseable date');
  }
  if (capture.uptimeMs !== undefined && (!Number.isFinite(capture.uptimeMs) || capture.uptimeMs <= 0)) {
    problems.push('uptimeMs must be a positive number when present');
  }
  return problems;
}

function metricEntries(capture, thresholds) {
  return [
    { metric: 'httpP95Ms', unit: 'ms', observed: capture.httpP95Ms, threshold: thresholds.httpP95Ms },
    { metric: 'loopP95Ms', unit: 'ms', observed: capture.loopP95Ms, threshold: thresholds.loopP95Ms },
    { metric: 'droppedSse', unit: '', observed: capture.droppedSse, threshold: thresholds.droppedSse },
    { metric: 'errors', unit: '', observed: capture.errors, threshold: thresholds.errors },
    { metric: 'rssGrowthMiB', unit: 'MiB', observed: capture.rssGrowthMiB, threshold: thresholds.rssGrowthMiB },
  ];
}

/**
 * Classify one capture before cross-capture confirmation.
 * `rawVerdict` is the severity the capture alone shows; `verdict` applies the
 * non-production cap and the minimum sustained window.
 */
export function classifyCapture(capture, { thresholds, profile }) {
  const problems = validateCapture(capture);
  if (problems.length) {
    return { id: capture?.id, capture, rawVerdict: 'MORE_EVIDENCE', verdict: 'MORE_EVIDENCE', problems, reasons: problems, breaches: [], watch: [], ratios: {} };
  }
  if (capture.uptimeMs !== undefined && capture.uptimeMs < capture.durationMinutes * 60000) {
    const reason = `uptimeMs ${capture.uptimeMs} is shorter than the ${capture.durationMinutes}-minute capture (counters reset mid-run)`;
    return { id: capture.id, capture, rawVerdict: 'MORE_EVIDENCE', verdict: 'MORE_EVIDENCE', problems: [reason], reasons: [reason], breaches: [], watch: [], ratios: {} };
  }

  const breaches = [];
  const watch = [];
  for (const entry of metricEntries(capture, thresholds)) {
    const ruleId = profile.sloRefs[entry.metric];
    if (entry.observed > entry.threshold) {
      breaches.push({ ...entry, ruleId, kind: 'hard' });
    } else if (entry.metric === 'httpP95Ms' || entry.metric === 'loopP95Ms') {
      if (entry.observed >= thresholds.watch[entry.metric]) {
        watch.push({ ...entry, ruleId, kind: 'watch', watchLine: thresholds.watch[entry.metric] });
      }
    } else if (entry.metric === 'rssGrowthMiB' && entry.observed >= thresholds.watch.rssGrowthMiB) {
      watch.push({ ...entry, ruleId, kind: 'watch', watchLine: thresholds.watch.rssGrowthMiB });
    }
  }

  const ratios = {
    http: capture.httpP95Ms / thresholds.httpP95Ms,
    loop: capture.loopP95Ms / thresholds.loopP95Ms,
    rss: capture.rssGrowthMiB / thresholds.rssGrowthMiB,
  };
  const reasons = [
    ...breaches.map((entry) => `${entry.metric} ${entry.observed}${entry.unit ? ` ${entry.unit}` : ''} exceeds ${entry.threshold}${entry.unit ? ` ${entry.unit}` : ''} (${entry.ruleId})`),
    ...watch.map((entry) => `${entry.metric} ${entry.observed}${entry.unit ? ` ${entry.unit}` : ''} is at or above the ${entry.watchLine}${entry.unit ? ` ${entry.unit}` : ''} watch line (${entry.ruleId})`),
  ];

  let rawVerdict = 'HOLD';
  if (breaches.length) rawVerdict = 'SPLIT';
  else if (watch.length) rawVerdict = 'WATCH';

  let verdict = rawVerdict;
  if (rawVerdict === 'SPLIT' && !capture.production) {
    verdict = 'WATCH';
    reasons.push('non-production capture: a split cannot be authorised from laptop or synthetic evidence');
  } else if (rawVerdict === 'SPLIT' && capture.durationMinutes < profile.minimumSustainedMinutes) {
    verdict = 'MORE_EVIDENCE';
    reasons.push(`split evidence requires at least ${profile.minimumSustainedMinutes} sustained minutes; capture is ${capture.durationMinutes}`);
  }

  return { id: capture.id, capture, rawVerdict, verdict, problems: [], reasons, breaches, watch, ratios };
}

function sameCommit(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  return left === right || (left.length >= 7 && right.startsWith(left)) || (right.length >= 7 && left.startsWith(right));
}

function outcome(verdict, { results = [], reasons = [] } = {}) {
  return { verdict, exitCode: VERDICT_EXIT[verdict], reasons, results };
}

/**
 * Final decision across one or more independent captures.
 * A SPLIT requires `independentCaptures` distinct, production, sustained
 * captures at the profile launch concurrency. Anything less is MORE_EVIDENCE.
 */
export function decide(captures, { thresholds, profile, commit = null } = {}) {
  if (!Array.isArray(captures) || !captures.length) {
    return outcome('MORE_EVIDENCE', { reasons: ['no capture supplied'] });
  }
  const results = captures.map((capture) => classifyCapture(capture, { thresholds, profile }));

  if (commit) {
    const stale = results.filter((result) => !sameCommit(result.capture?.commit, commit));
    if (stale.length) {
      return outcome('MORE_EVIDENCE', {
        results,
        reasons: stale.map((result) => `capture ${result.id || '(unnamed)'} was recorded at ${result.capture?.commit || 'unknown'}, not the review commit ${commit}`),
      });
    }
  }

  const blocked = results.filter((result) => result.verdict === 'MORE_EVIDENCE');
  if (blocked.length) {
    return outcome('MORE_EVIDENCE', { results, reasons: blocked.flatMap((result) => result.reasons) });
  }

  const candidates = results.filter((result) => result.verdict === 'SPLIT');
  if (candidates.length) {
    const launch = profile.launchConcurrency;
    const qualifying = candidates.filter((result) => {
      const capture = result.capture;
      return (
        capture.production === true &&
        capture.durationMinutes >= profile.minimumSustainedMinutes &&
        capture.clients === launch.clients &&
        capture.sseClients === launch.sseClients
      );
    });
    const unique = new Set(qualifying.map((result) => result.id));
    if (unique.size >= profile.independentCaptures) {
      return outcome('SPLIT', {
        results,
        reasons: [`${unique.size} independent production captures at ${launch.clients}/${launch.sseClients} confirm the breach`],
      });
    }
    const reasons = [
      `SPLIT needs ${profile.independentCaptures} independent production captures of at least ${profile.minimumSustainedMinutes} minutes at ${launch.clients} clients / ${launch.sseClients} SSE; found ${unique.size}.`,
      ...candidates.flatMap((result) => result.reasons),
    ];
    return outcome('MORE_EVIDENCE', { results, reasons });
  }

  if (results.some((result) => result.verdict === 'WATCH')) {
    return outcome('WATCH', { results, reasons: results.flatMap((result) => result.reasons) });
  }
  return outcome('HOLD', { results, reasons: [] });
}

/** Plain-text operator output; no colour-only status. */
export function renderVerdict(result) {
  const lines = [];
  if (result.verdict === 'HOLD') {
    lines.push('HOLD — single process within the SLO thresholds; no split.');
  } else if (result.verdict === 'WATCH') {
    lines.push('WATCH — at least one metric is at or above the watch line; no split authorised.');
  } else if (result.verdict === 'SPLIT') {
    lines.push('SPLIT — measured breach confirmed by independent production captures; open the sharding design, do not deploy a split.');
  } else {
    lines.push('MORE_EVIDENCE — the gate cannot decide; collect the missing evidence and re-run.');
  }
  for (const entry of result.results || []) {
    const capture = entry.capture || {};
    const ratio = entry.ratios || {};
    const loop = capture.loopP95Ms;
    lines.push(
      `  ${capture.id || '(unnamed)'} [${capture.commit || 'no-commit'}, ${capture.durationMinutes || '?'} min, ${capture.clients ?? '?'}/${capture.sseClients ?? '?'}, ${capture.production ? 'production' : 'non-production'}] ` +
        `HTTP p95 ${capture.httpP95Ms ?? '?'} ms (${ratio.http != null ? `${(ratio.http * 100).toFixed(1)}%` : '?'} of SLO), ` +
        `loop p95 ${loop ?? '?'} ms (${ratio.loop != null ? `${(ratio.loop * 100).toFixed(1)}%` : '?'} of SLO), ` +
        `dropped SSE ${capture.droppedSse ?? '?'}, errors ${capture.errors ?? '?'}, RSS +${capture.rssGrowthMiB ?? '?'} MiB (${ratio.rss != null ? `${(ratio.rss * 100).toFixed(1)}%` : '?'} of SLO)`
    );
  }
  for (const reason of result.reasons || []) lines.push(`  - ${reason}`);
  if (result.verdict === 'HOLD') {
    lines.push('  Next: keep the single process; re-run `npm run gate:load` and this gate on the release commit.');
  } else if (result.verdict === 'WATCH') {
    lines.push('  Next: collect a sustained production-like capture at the launch concurrency; do not start a split.');
  } else if (result.verdict === 'SPLIT') {
    lines.push('  Next: store both captures and follow docs/SHARDING_DECISION.md; a split needs a design, migration and rollback rehearsal.');
  } else {
    lines.push('  Next: supply the missing capture(s) in the message above and re-run this command.');
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = { captures: [], profile: DEFAULT_PROFILE, rules: DEFAULT_RULES, commit: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--capture') options.captures.push(argv[++index]);
    else if (arg.startsWith('--capture=')) options.captures.push(arg.slice(10));
    else if (arg === '--captures') options.captures.push(...String(argv[++index] || '').split(',').filter(Boolean));
    else if (arg.startsWith('--captures=')) options.captures.push(...arg.slice(11).split(',').filter(Boolean));
    else if (arg === '--profile') options.profile = path.resolve(argv[++index] || DEFAULT_PROFILE);
    else if (arg.startsWith('--profile=')) options.profile = path.resolve(arg.slice(10));
    else if (arg === '--rules') options.rules = path.resolve(argv[++index] || DEFAULT_RULES);
    else if (arg.startsWith('--rules=')) options.rules = path.resolve(arg.slice(8));
    else if (arg === '--commit') options.commit = argv[++index];
    else if (arg.startsWith('--commit=')) options.commit = arg.slice(9);
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const entry of options.captures) {
    if (!entry) throw new Error('--capture requires a file path');
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`scale-gate — ${error.message}`);
    return 3;
  }
  if (options.help || !options.captures.length) {
    console.error('usage: node scripts/scale-gate.mjs --capture <file> [--capture <file>] [--profile <file>] [--rules <file>] [--commit <sha>] [--json]');
    return 3;
  }
  try {
    const ruleset = loadRuleset(options.rules);
    const profile = loadProfile(options.profile);
    const thresholds = resolveThresholds(ruleset, profile);
    const captures = options.captures.map((file) => readJson(path.resolve(file)));
    const result = decide(captures, { thresholds, profile, commit: options.commit });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(renderVerdict(result));
    }
    return result.exitCode;
  } catch (error) {
    console.error(`scale-gate — ${error && error.message ? error.message : error}`);
    return 3;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}

export default {
  loadRuleset,
  loadProfile,
  resolveThresholds,
  validateCapture,
  classifyCapture,
  decide,
  renderVerdict,
  VERDICT_EXIT,
};
