/**
 * NARIMATO — executable SLO ruleset (OPS-01).
 *
 * The thresholds live in `observability/slo.json`; this module is the only
 * place that knows how to resolve a rule path, compare a value and suppress
 * false alerts during warm-up. It is intentionally dependency-free and pure so
 * `scripts/check-slo.mjs` and the contract test share exactly one evaluator.
 *
 * Rule contract (see `observability/README` in OBSERVABILITY.md § SLO ruleset):
 *   {
 *     id, path, op: 'lt'|'lte'|'gt'|'gte'|'eq', threshold,
 *     windowMs, severity: 'warn'|'page', owner, runbook,
 *     requires?: { path, op, threshold },
 *     derived?: 'ratePerMinuteFromBoot'
 *   }
 *
 * `path` supports dotted keys plus bracketed keys that themselves contain dots,
 * e.g. `telemetry.aggregates["audio.firstWordMs"].avg`. A wildcard segment `[]`
 * resolves to an array and is used by `requires` (e.g. `planets[].playersOnline`).
 *
 * Evaluation states:
 *   pass         value satisfies the rule
 *   breach       value violates the rule (exit 1 from check-slo)
 *   warming      uptime < rule.windowMs, so the window has no signal yet
 *   waiting      an optional `requires` precondition is not met (rule inactive)
 *   missing-path a documented rule path no longer resolves (exit 2 — contract break)
 */
import fs from 'node:fs';

/** Supported comparison operators (exposed so tests/checker print the same set). */
export const OPS = Object.freeze({
  lt: (value, threshold) => value < threshold,
  lte: (value, threshold) => value <= threshold,
  gt: (value, threshold) => value > threshold,
  gte: (value, threshold) => value >= threshold,
  eq: (value, threshold) => value === threshold,
});

export const OPERATORS = Object.freeze(Object.keys(OPS));
export const SEVERITIES = Object.freeze(['warn', 'page']);
export const WINDOW_MIN_MS = 120_000;
export const WINDOW_MAX_MS = 3_600_000;

const MIB = 1024 * 1024;

/** Split a dotted/bracketed rule path into segments. */
export function parseRulePath(pathValue) {
  if (typeof pathValue !== 'string' || !pathValue.trim()) return [];
  const segments = [];
  const pattern = /([^.[\]]+)|\[\s*(?:"([^"]*)"|'([^']*)'|([^\]]*))\s*\]/g;
  let match;
  while ((match = pattern.exec(pathValue))) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
      continue;
    }
    const inner = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4];
    // `[]` is the wildcard segment; `["key"]`/`['key']`/`[key]` is a literal key.
    segments.push(inner === undefined || inner === '' ? '[]' : String(inner).trim());
  }
  return segments;
}

/**
 * Resolve a rule path inside a snapshot.
 * Returns `undefined` when any segment is absent. `[]` produces an array of the
 * remaining values (wildcard), or `undefined` when the array is empty/missing.
 */
export function resolvePath(snapshot, pathValue) {
  const segments = parseRulePath(pathValue);
  if (!segments.length) return undefined;
  const walk = (node, index) => {
    if (index >= segments.length) return node;
    const segment = segments[index];
    if (segment === '[]') {
      if (!Array.isArray(node)) return undefined;
      const rest = [];
      for (const item of node) {
        const value = walk(item, index + 1);
        if (value !== undefined) rest.push(value);
      }
      return rest.length ? rest : undefined;
    }
    if (node === null || typeof node !== 'object') return undefined;
    return walk(node[segment], index + 1);
  };
  return walk(snapshot, 0);
}

/** Compare a resolved value (or wildcard array) against {op, threshold}. */
export function compareValue(value, rule) {
  if (value === undefined) return undefined;
  const op = OPS[rule.op];
  if (!op) return undefined;
  if (Array.isArray(value)) return value.some((entry) => typeof entry === 'number' && op(entry, rule.threshold));
  if (typeof value !== 'number') return undefined;
  return op(value, rule.threshold);
}

/** RSS growth in bytes per minute from the boot baseline; negative rates report 0. */
export function rssGrowthBytesPerMinute(snapshot, uptimeMs) {
  const rss = snapshot && snapshot.process && snapshot.process.rssBytes;
  const boot = snapshot && snapshot.process && snapshot.process.bootRssBytes;
  if (typeof rss !== 'number' || typeof boot !== 'number') return undefined;
  if (!Number.isFinite(uptimeMs) || uptimeMs <= 0) return 0;
  const rate = (rss - boot) / (uptimeMs / 60_000);
  return rate < 0 ? 0 : rate;
}

/** Resolve the value a rule compares; derived rules may compute from several fields. */
export function ruleValue(rule, snapshot, { uptimeMs = 0 } = {}) {
  if (rule.derived === 'ratePerMinuteFromBoot') return rssGrowthBytesPerMinute(snapshot, uptimeMs);
  return resolvePath(snapshot, rule.path);
}

/**
 * Evaluate every rule against one `/api/metrics` snapshot.
 * Returns one entry per rule, in ruleset order:
 *   { id, state, value?, threshold, op, severity, owner, runbook, path, reason? }
 */
export function evaluateRules(rules, snapshot, { uptimeMs = 0 } = {}) {
  const list = Array.isArray(rules) ? rules : [];
  const uptime = Number.isFinite(uptimeMs) ? Math.max(0, uptimeMs) : 0;
  return list.map((rule) => {
    const base = {
      id: rule.id,
      path: rule.path,
      op: rule.op,
      threshold: rule.threshold,
      windowMs: rule.windowMs,
      severity: rule.severity,
      owner: rule.owner,
      runbook: rule.runbook,
      state: 'pass',
    };
    if (rule.requires) {
      const required = resolvePath(snapshot, rule.requires.path);
      const ok = compareValue(required, rule.requires);
      if (!ok) return { ...base, state: 'waiting', reason: 'requires-not-met' };
    }
    if (uptime < rule.windowMs) return { ...base, state: 'warming', reason: 'warm-up' };
    const value = ruleValue(rule, snapshot, { uptimeMs: uptime });
    if (typeof value !== 'number' || !Number.isFinite(value)) return { ...base, state: 'missing-path' };
    return { ...base, value, state: OPS[rule.op](value, rule.threshold) ? 'pass' : 'breach' };
  });
}

/** Validate a parsed ruleset object. Returns `{ ok, errors }`. */
export function validateRuleset(ruleset) {
  const errors = [];
  const add = (message) => errors.push(message);
  if (!ruleset || typeof ruleset !== 'object' || Array.isArray(ruleset)) {
    return { ok: false, errors: ['ruleset must be an object'] };
  }
  if (ruleset.version !== 1) add('version must be 1');
  if (!Array.isArray(ruleset.rules) || ruleset.rules.length === 0) add('rules must be a non-empty array');
  const ids = new Set();
  (ruleset.rules || []).forEach((rule, index) => {
    const where = `rules[${index}]`;
    if (!rule || typeof rule !== 'object') {
      add(`${where} must be an object`);
      return;
    }
    if (typeof rule.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id)) add(`${where}.id must be kebab-case`);
    else if (ids.has(rule.id)) add(`${where}.id "${rule.id}" is duplicated`);
    else ids.add(rule.id);
    if (typeof rule.path !== 'string' || !rule.path.trim()) add(`${where}.path must be a non-empty string`);
    if (!OPERATORS.includes(rule.op)) add(`${where}.op must be one of ${OPERATORS.join(', ')}`);
    if (typeof rule.threshold !== 'number' || !Number.isFinite(rule.threshold)) add(`${where}.threshold must be a finite number`);
    if (!Number.isInteger(rule.windowMs) || rule.windowMs < WINDOW_MIN_MS || rule.windowMs > WINDOW_MAX_MS) {
      add(`${where}.windowMs must be an integer in [${WINDOW_MIN_MS}, ${WINDOW_MAX_MS}]`);
    }
    if (!SEVERITIES.includes(rule.severity)) add(`${where}.severity must be one of ${SEVERITIES.join(', ')}`);
    if (typeof rule.owner !== 'string' || !rule.owner.trim()) add(`${where}.owner must be a non-empty string`);
    if (typeof rule.runbook !== 'string' || !rule.runbook.startsWith('#') || rule.runbook.length < 2) {
      add(`${where}.runbook must be a markdown anchor like "#http-p95"`);
    }
    if (rule.requires) {
      if (typeof rule.requires.path !== 'string' || !rule.requires.path.trim()) add(`${where}.requires.path must be a non-empty string`);
      if (!OPERATORS.includes(rule.requires.op)) add(`${where}.requires.op must be one of ${OPERATORS.join(', ')}`);
      if (typeof rule.requires.threshold !== 'number' || !Number.isFinite(rule.requires.threshold)) {
        add(`${where}.requires.threshold must be a finite number`);
      }
    }
    if (rule.derived !== undefined && rule.derived !== 'ratePerMinuteFromBoot') add(`${where}.derived is unsupported`);
  });
  return { ok: errors.length === 0, errors };
}

/** Load and validate the ruleset file. Throws an Error with a stable `.code`. */
export function loadRuleset(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    const err = new Error(`cannot read SLO ruleset ${file}: ${error?.message || error}`);
    err.code = 'RULESET_UNREADABLE';
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const err = new Error(`SLO ruleset ${file} is not valid JSON: ${error?.message || error}`);
    err.code = 'RULESET_INVALID';
    throw err;
  }
  const validation = validateRuleset(parsed);
  if (!validation.ok) {
    const err = new Error(`SLO ruleset ${file} is invalid:\n  - ${validation.errors.join('\n  - ')}`);
    err.code = 'RULESET_INVALID';
    throw err;
  }
  return parsed;
}

/**
 * Exit-code contract for `scripts/check-slo.mjs`:
 *   0 healthy (pass/warming/waiting, no breach)
 *   1 threshold breach
 *   2 missing rule path (contract break)
 *   3 server unreachable
 */
export function exitCodeFor(results) {
  if (results.some((entry) => entry.state === 'missing-path')) return 2;
  if (results.some((entry) => entry.state === 'breach')) return 1;
  return 0;
}

/** Format one human-readable checker line (words only, no colour). */
export function formatResult(entry) {
  const label = entry.state === 'pass' ? 'PASS' : entry.state === 'breach' ? 'FAIL' : entry.state.toUpperCase();
  const valueText = typeof entry.value === 'number' ? formatValue(entry.value) : '-';
  const suffix =
    entry.state === 'warming'
      ? `(warming — window ${Math.round(entry.windowMs / 60000)} min not elapsed)`
      : entry.state === 'waiting'
        ? '(waiting — precondition not met)'
        : entry.state === 'missing-path'
          ? `(missing path ${entry.path})`
          : `(${entry.op} ${formatValue(entry.threshold)}; ${entry.severity}, owner ${entry.owner}, runbook ${entry.runbook})`;
  return `${label.padEnd(5)} ${entry.id.padEnd(17)} ${valueText.padStart(12)}  ${suffix}`;
}

/** Round for display: bytes become MiB, everything else keeps 2 decimals. */
export function formatValue(value) {
  if (!Number.isFinite(value)) return 'NaN';
  if (Math.abs(value) >= MIB) return `${(value / MIB).toFixed(2)}MiB`;
  return `${Math.round(value * 100) / 100}`;
}

export default { evaluateRules, validateRuleset, loadRuleset, exitCodeFor, resolvePath, compareValue };
