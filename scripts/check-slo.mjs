#!/usr/bin/env node
/**
 * NARIMATO — SLO checker (OPS-01).
 *
 * Reads one `/api/metrics` snapshot, evaluates `observability/slo.json` and
 * prints one line per rule plus a PASS summary. Zero dependencies: `fetch` and
 * `node:` built-ins only.
 *
 * Usage:
 *   node scripts/check-slo.mjs                        check BASE_URL (default http://127.0.0.1:4173)
 *   node scripts/check-slo.mjs --base-url <url>       explicit target
 *   node scripts/check-slo.mjs --only=http-p95        run a single rule (repeatable)
 *   node scripts/check-slo.mjs --json                 machine-readable report on stdout
 *   node scripts/check-slo.mjs --rules <file>         alternate ruleset file
 *   node scripts/check-slo.mjs --timeout-ms <ms>      fetch timeout (default 5000)
 *
 * Exit codes: 0 healthy, 1 threshold breach, 2 missing rule path (contract
 * break), 3 server unreachable. Output never includes tokens, tags, player ids
 * or hidden deposits — only rule ids, values and thresholds.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateRules, exitCodeFor, formatResult, loadRuleset } from '../lib/slo.js';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
export const DEFAULT_RULESET = path.join(DEFAULT_ROOT, 'observability', 'slo.json');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';

export function parseArgs(argv) {
  const options = { baseUrl: process.env.BASE_URL || DEFAULT_BASE_URL, rules: DEFAULT_RULESET, only: [], json: false, timeoutMs: 5000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--base-url') {
      options.baseUrl = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length);
    else if (arg === '--rules') {
      options.rules = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--rules=')) options.rules = arg.slice('--rules='.length);
    else if (arg === '--only') {
      options.only.push(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--only=')) options.only.push(arg.slice('--only='.length));
    else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg.startsWith('-')) throw new Error(`unknown argument: ${arg}`);
    else options.baseUrl = arg;
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number');
  return options;
}

/** Fetch `/api/metrics`; resolves `{ ok, status, snapshot }`, never throws. */
export async function fetchMetrics(baseUrl, timeoutMs = 5000) {
  const url = new URL('/api/metrics', baseUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return { ok: false, status: response.status, url };
    return { ok: true, status: response.status, url, snapshot: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, url, error: error?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

function printHuman(report, exitCode) {
  for (const entry of report.results) console.log(formatResult(entry));
  const passed = report.results.filter((entry) => entry.state !== 'breach' && entry.state !== 'missing-path').length;
  const total = report.results.length;
  if (exitCode === 0) console.log(`PASS ${passed}/${total}`);
  else if (exitCode === 1) {
    const breaches = report.results.filter((entry) => entry.state === 'breach');
    console.log(`FAIL ${breaches.length}/${total} — ${breaches.map((entry) => entry.id).join(', ')}`);
  } else {
    const missing = report.results.filter((entry) => entry.state === 'missing-path');
    console.log(`FAIL ${missing.length}/${total} — missing path: ${missing.map((entry) => entry.id).join(', ')}`);
  }
}

export async function runCheck(options) {
  const ruleset = loadRuleset(options.rules);
  let rules = ruleset.rules;
  if (options.only.length) {
    const unknown = options.only.filter((id) => !rules.some((rule) => rule.id === id));
    if (unknown.length) throw new Error(`--only refers to unknown rule(s): ${unknown.join(', ')}`);
    rules = rules.filter((rule) => options.only.includes(rule.id));
  }
  const fetched = await fetchMetrics(options.baseUrl, options.timeoutMs);
  if (!fetched.ok) {
    return {
      ok: false,
      exitCode: 3,
      unreachable: fetched.url,
      reason: fetched.status ? `HTTP ${fetched.status}` : fetched.error || 'unreachable',
      results: [],
    };
  }
  const snapshot = fetched.snapshot || {};
  const results = evaluateRules(rules, snapshot, { uptimeMs: snapshot.uptimeMs });
  const exitCode = exitCodeFor(results);
  return {
    ok: exitCode === 0,
    exitCode,
    baseUrl: options.baseUrl,
    generatedAt: snapshot.generatedAt,
    uptimeMs: snapshot.uptimeMs,
    metricsVersion: snapshot.metricsVersion,
    results,
  };
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`check:slo — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.error('usage: node scripts/check-slo.mjs [--base-url <url>] [--rules <file>] [--only=<id>] [--json] [--timeout-ms <ms>]');
    return 0;
  }
  let report;
  try {
    report = await runCheck(options);
  } catch (error) {
    // Ruleset/usage errors are a contract problem (2), never a threshold breach.
    console.error(`check:slo — ${error?.message || error}`);
    return 2;
  }
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return report.exitCode;
  }
  if (report.exitCode === 3) {
    console.error(`unreachable: ${report.unreachable}`);
    return 3;
  }
  printHuman(report, report.exitCode);
  return report.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = await main(process.argv.slice(2));
}

export default { runCheck, fetchMetrics, parseArgs };
