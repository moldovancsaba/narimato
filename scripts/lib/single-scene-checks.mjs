/**
 * NARIMATO — single-scene acceptance helpers (RND-06).
 *
 * Pure, dependency-free logic shared by `scripts/verify-single-scene.mjs` and
 * `test/single-scene-guard.test.js`: the report schema, deterministic
 * thresholds and the static repository guard. Keeping the math here means the
 * unit suite proves the acceptance rules without launching a browser.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Report contract version; bump only when the report shape changes. */
export const REPORT_VERSION = 1;

/** Browser/pixel thresholds from issue RND-06 §12. */
export const THRESHOLDS = Object.freeze({
  /** Maximum per-channel difference between the same cell in both phases. */
  maxChannelDelta: 6,
  /** 95th percentile frame time budget (60 Hz). */
  p95FrameMs: 16.7,
  /** A frame slower than this counts as dropped (2 × 16.7). */
  droppedFrameMs: 33.4,
  /** Maximum dropped-frame ratio. */
  droppedRatio: 0.05,
  /** Minimum cells that must be visible in both phases for parity. */
  minParityCells: 5,
  /** Cells sampled for the parity check. */
  paritySamples: 25,
  /** 600 measured frames for the budget. */
  frameSamples: 600,
  /** Suite wall-clock budget in seconds. */
  suiteBudgetS: 90,
});

/** The six M2 checks the report must contain, in review order. */
export const REQUIRED_CHECKS = Object.freeze([
  'one-renderer',
  'no-surface-canvas',
  'camera-only',
  'cell-parity',
  'hud-identity',
  'frame-budget',
]);

/** Symbols a single-scene regression must never reintroduce in `public/`. */
export const FORBIDDEN_PUBLIC_PATTERNS = Object.freeze([
  { id: 'surface-canvas', pattern: /surface-canvas/g },
  { id: 'drawAvatar', pattern: /\bdrawAvatar\s*\(/g },
  { id: 'setPlanetSurface', pattern: /\bsetPlanetSurface\s*\(/g },
  { id: 'surface-mode.js', pattern: /surface-mode\.js/g },
]);

/** Max absolute channel difference between two `[r,g,b]` samples. */
export function maxChannelDelta(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 3 || b.length < 3) return Infinity;
  let delta = 0;
  for (let i = 0; i < 3; i += 1) {
    const left = Number(a[i]);
    const right = Number(b[i]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return Infinity;
    delta = Math.max(delta, Math.abs(left - right));
  }
  return delta;
}

/**
 * 95th percentile with nearest-rank selection: `sorted[floor(0.95·n) - 1]`.
 * Empty input returns Infinity so a missing measurement fails closed.
 */
export function percentile(values, fraction = 0.95) {
  if (!Array.isArray(values) || !values.length) return Infinity;
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return Infinity;
  const k = Math.min(1, Math.max(0, Number(fraction) || 0.95));
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(k * sorted.length) - 1));
  return sorted[index];
}

/** Ratio of frames slower than `droppedFrameMs`. */
export function droppedRatio(frames, thresholdMs = THRESHOLDS.droppedFrameMs) {
  if (!Array.isArray(frames) || !frames.length) return Infinity;
  let dropped = 0;
  for (const frame of frames) {
    if (!(Number(frame) <= thresholdMs)) dropped += 1;
  }
  return dropped / frames.length;
}

/** Deterministic evenly-spaced subset (keeps first/last, no randomness). */
export function sampleEvenly(items, count) {
  const list = Array.isArray(items) ? items : [];
  const want = Math.max(0, Math.min(list.length, Math.trunc(Number(count) || 0)));
  if (!want) return [];
  if (want >= list.length) return list.slice();
  const out = [];
  for (let i = 0; i < want; i += 1) {
    out.push(list[Math.round((i * (list.length - 1)) / (want - 1))]);
  }
  return out;
}

/**
 * Build a report skeleton. `artifacts` are repo-relative paths (never absolute,
 * so a report can be committed as evidence).
 */
export function createReport({ version = '0.0.0', startedAt = null } = {}) {
  return {
    ok: false,
    reportVersion: REPORT_VERSION,
    version,
    startedAt,
    finishedAt: null,
    durationMs: null,
    checks: [],
    artifacts: [],
    errors: [],
  };
}

/** Append one check and return it. */
export function addCheck(report, id, ok, observed = null, detail = null) {
  const check = { id, ok: !!ok, observed };
  if (detail !== null && detail !== undefined) check.detail = detail;
  report.checks.push(check);
  return check;
}

/** Validate a report object against the documented schema. */
export function validateReport(report) {
  const problems = [];
  if (!report || typeof report !== 'object') return { ok: false, problems: ['report is not an object'] };
  if (typeof report.ok !== 'boolean') problems.push('ok must be a boolean');
  if (report.reportVersion !== REPORT_VERSION) problems.push('reportVersion mismatch');
  if (typeof report.version !== 'string' || !report.version) problems.push('version must be a non-empty string');
  if (!Array.isArray(report.checks)) problems.push('checks must be an array');
  else {
    for (const [index, check] of report.checks.entries()) {
      if (!check || typeof check !== 'object') { problems.push(`checks[${index}] is not an object`); continue; }
      if (typeof check.id !== 'string' || !check.id) problems.push(`checks[${index}].id must be a string`);
      if (typeof check.ok !== 'boolean') problems.push(`checks[${index}].ok must be a boolean`);
      if (!('observed' in check)) problems.push(`checks[${index}].observed is required`);
    }
  }
  if (!Array.isArray(report.artifacts)) problems.push('artifacts must be an array');
  else if (report.artifacts.some((entry) => typeof entry !== 'string' || path.isAbsolute(entry) || entry.includes('\\'))) {
    problems.push('artifacts must be repo-relative POSIX paths');
  }
  if (!Array.isArray(report.errors)) problems.push('errors must be an array');
  for (const id of REQUIRED_CHECKS) {
    if (Array.isArray(report.checks) && !report.checks.some((check) => check && check.id === id)) {
      problems.push(`missing required check ${id}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/** All failing checks (or an empty list). */
export function failedChecks(report) {
  if (!report || !Array.isArray(report.checks)) return [];
  return report.checks.filter((check) => !check || check.ok !== true);
}

/** One-line reviewer verdict used by the suite's final output. */
export function summarise(report) {
  const failed = failedChecks(report);
  if (!report || !report.ok || failed.length) {
    return `FAIL single-scene // ${failed.map((check) => check.id).join(', ') || 'report not ok'}`;
  }
  const p95 = report.checks.find((check) => check.id === 'frame-budget');
  const p95Text = p95 && p95.observed && Number.isFinite(p95.observed.p95Ms) ? `p95 ${p95.observed.p95Ms.toFixed(1)} ms` : 'p95 n/a';
  return `PASS single-scene // ${p95Text} // ${report.artifacts.length} artifacts`;
}

const READ_SKIP_DIRS = new Set(['node_modules', '.git', 'media', 'dist']);

function walkFiles(root, dir, files) {
  const absolute = path.join(root, dir);
  let entries;
  try {
    entries = fs.readdirSync(absolute, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (READ_SKIP_DIRS.has(entry.name)) continue;
      walkFiles(root, relative, files);
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
}

/**
 * Static guard over `public/` (and optionally extra roots): every forbidden
 * single-scene symbol must be absent. `.html`/`.js`/`.css`/`.mjs` are scanned.
 * @returns {{ok:boolean, findings:Array<{file:string,line:number,symbol:string,text:string}>}}
 */
export function scanRepository(root, roots = ['public']) {
  const files = [];
  for (const dir of roots) walkFiles(root, dir, files);
  const scannable = files.filter((file) => /\.(?:js|mjs|html|css|json)$/i.test(file));
  const findings = [];
  for (const relative of scannable) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, relative), 'utf8');
    } catch (_) {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (const forbidden of FORBIDDEN_PUBLIC_PATTERNS) {
      forbidden.pattern.lastIndex = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        forbidden.pattern.lastIndex = 0;
        if (!forbidden.pattern.test(line)) continue;
        findings.push({ file: relative, line: index + 1, symbol: forbidden.id, text: line.trim().slice(0, 160) });
      }
    }
  }
  return { ok: findings.length === 0, findings };
}

/** True when the parsed query forces `intro=0` (the suite's boot contract). */
export function forcesIntroOff(search) {
  const raw = String(search == null ? '' : search);
  const query = raw.startsWith('?') ? raw.slice(1) : raw;
  try {
    const params = new URLSearchParams(query);
    return params.get('intro') === '0';
  } catch (_) {
    return false;
  }
}
