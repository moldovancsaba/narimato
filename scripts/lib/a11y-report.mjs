/**
 * NARIMATO — accessible-report and suppression ledger helpers (A11Y-01).
 *
 * Pure functions only: no Playwright, no browser, no filesystem. `scripts/a11y-gate.mjs`
 * passes the collected findings through here, and `test/a11y-report.test.js` /
 * `test/a11y-suppression.test.js` exercise the same code with zero dependencies.
 *
 * The shape mirrors the GDS accessibility test layer (`@sovereignsquad/gds-a11y`)
 * for findings and suppressions, with one deliberate extension: the gate report
 * is multi-surface and versioned, so a failure names both the surface and the
 * selector while still being readable by the GDS helpers.
 */

export const A11Y_SCHEMA_VERSION = '1.1.0';
export const A11Y_LEDGER_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_MAX_EXPIRY_DAYS = 90;

export const SEVERITY_RANK = Object.freeze({ minor: 1, moderate: 2, serious: 3, critical: 4 });

/**
 * True when a console/page error is an expected interaction outcome (e.g. the
 * surface probe's own 409 on a contested cell). Patterns are per-surface and
 * explicit: anything not listed still fails the gate.
 */
export function isAllowedRuntimeError(text, patterns = []) {
  const message = String(text || '');
  return patterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(message) : String(pattern) === message
  );
}
export const STATUS_RANK = Object.freeze({ pass: 0, warning: 1, incomplete: 2, failure: 3 });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_SUPPRESSION_FIELDS = Object.freeze(['id', 'reason', 'owner', 'expiresAt', 'replacementPath']);

/** One finding. `status` is never `pass`: a passing check produces no finding. */
export function createFinding({
  check,
  id = '',
  surface,
  selector = 'document',
  expected = '',
  actual = '',
  severity = 'serious',
  status = 'failure',
  message = '',
  helpUrl = '',
  suggestedGdsReplacement = '',
} = {}) {
  if (!check || !surface) throw new TypeError('finding requires check and surface');
  if (!(severity in SEVERITY_RANK)) throw new TypeError(`unknown severity: ${severity}`);
  if (!['warning', 'failure', 'incomplete', 'suppressed'].includes(status)) {
    throw new TypeError(`unknown finding status: ${status}`);
  }
  return {
    id: String(id || check),
    check: String(check),
    surface: String(surface),
    selector: String(selector || 'document'),
    expected: String(expected || ''),
    actual: String(actual || ''),
    severity,
    status,
    message: String(message || `${check} failed on ${surface}`),
    helpUrl: String(helpUrl || ''),
    suggestedGdsReplacement: String(suggestedGdsReplacement || ''),
  };
}

/** Parse a `YYYY-MM-DD` date as the end of that UTC day. */
export function expiryInstant(value) {
  if (!ISO_DATE.test(String(value || ''))) return null;
  const instant = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function isExpired(value, now = new Date()) {
  const instant = expiryInstant(value);
  return instant === null || instant.getTime() < now.getTime();
}

export function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Validate one ledger entry. Returns `{ ok, errors, suppression }`.
 * Owner, reason, expiry and replacement path are mandatory: a suppression is a
 * tracked decision, not a silent mute. An expiry beyond `maxExpiryDays` is
 * rejected so a waiver cannot be effectively permanent.
 */
export function validateSuppression(entry, { now = new Date(), maxExpiryDays = DEFAULT_MAX_EXPIRY_DAYS } = {}) {
  const errors = [];
  const suppression = entry && typeof entry === 'object' ? entry : {};
  for (const field of REQUIRED_SUPPRESSION_FIELDS) {
    if (!String(suppression[field] || '').trim()) errors.push(`missing ${field}`);
  }
  const instant = expiryInstant(suppression.expiresAt);
  if (!instant) {
    errors.push('expiresAt must be YYYY-MM-DD');
  } else {
    const days = daysBetween(now, instant);
    if (days < 0) errors.push(`expired on ${suppression.expiresAt}`);
    if (days > maxExpiryDays) errors.push(`expiry ${suppression.expiresAt} exceeds the ${maxExpiryDays}-day policy`);
  }
  return { ok: errors.length === 0, errors, suppression };
}

/**
 * Validate a ledger file payload. Returns `{ suppressions, findings }` where
 * findings are gate-level metadata failures under the `suppression-policy` check.
 */
export function loadSuppressionLedger(payload, options = {}) {
  const now = options.now || new Date();
  const maxExpiryDays = Number.isFinite(payload && payload.policy && payload.policy.maxExpiryDays)
    ? payload.policy.maxExpiryDays
    : DEFAULT_MAX_EXPIRY_DAYS;
  const entries = payload && Array.isArray(payload.suppressions) ? payload.suppressions : [];
  const suppressions = [];
  const findings = [];
  for (const entry of entries) {
    const result = validateSuppression(entry, { now, maxExpiryDays });
    if (result.ok) {
      suppressions.push({ ...result.suppression });
      continue;
    }
    findings.push(
      createFinding({
        check: 'suppression-policy',
        surface: 'ledger',
        selector: String((entry && entry.selector) || 'document'),
        expected: 'id, reason, owner, expiresAt (<= policy window), replacementPath',
        actual: result.errors.join('; '),
        severity: 'critical',
        status: 'failure',
        message: `Suppression ${entry && entry.id ? entry.id : '<unknown>'} is invalid: ${result.errors.join('; ')}.`,
      }),
    );
  }
  return { suppressions, findings, maxExpiryDays };
}

function suppressionMatches(finding, suppression) {
  if (suppression.id !== finding.id && suppression.id !== finding.check) return false;
  if (suppression.selector && suppression.selector !== finding.selector) return false;
  if (suppression.route && suppression.route !== finding.surface) return false;
  return true;
}

/**
 * Apply live suppressions to findings. Mirrors the GDS helper semantics:
 * an expired suppression never hides a finding; the finding is annotated so a
 * lapsed waiver surfaces as a failure. Returns new arrays and the audit data
 * the gate needs for `--strict-suppressions`.
 */
export function applySuppressions(findings, suppressions = [], { now = new Date() } = {}) {
  const applied = [];
  const expired = [];
  const used = new Set();
  const output = findings.map((finding) => {
    const suppression = suppressions.find((candidate) => suppressionMatches(finding, candidate));
    if (!suppression) return finding;
    used.add(suppression);
    if (isExpired(suppression.expiresAt, now)) {
      expired.push(suppression);
      return {
        ...finding,
        status: 'failure',
        message: `${finding.message} Suppression ${suppression.id} expired on ${suppression.expiresAt}.`,
      };
    }
    applied.push({ ...suppression, finding: { check: finding.check, surface: finding.surface, selector: finding.selector } });
    return { ...finding, status: 'suppressed', suppression: { ...suppression } };
  });
  const unused = suppressions.filter((suppression) => !used.has(suppression));
  return { findings: output, applied, expired, unused };
}

function surfaceStatus(findings) {
  const active = findings.filter((finding) => finding.status !== 'suppressed');
  if (active.some((finding) => finding.status === 'failure')) return 'failure';
  if (active.some((finding) => finding.status === 'incomplete')) return 'incomplete';
  if (active.some((finding) => finding.status === 'warning')) return 'warning';
  return 'pass';
}

function sortFindings(findings) {
  return [...findings].sort(
    (a, b) =>
      String(a.surface).localeCompare(String(b.surface)) ||
      String(a.check).localeCompare(String(b.check)) ||
      String(a.selector).localeCompare(String(b.selector)) ||
      String(a.message).localeCompare(String(b.message)),
  );
}

export function summarize(findings) {
  const summary = { pass: 0, warning: 0, failure: 0, incomplete: 0, suppressed: 0, total: 0 };
  for (const finding of findings) {
    summary.total += 1;
    if (finding.status in summary) summary[finding.status] += 1;
  }
  return summary;
}

/** Assemble the versioned, deterministic gate report. */
export function assembleReport({
  engine,
  commit = '',
  mode = 'full',
  surfaces = [],
  findings = [],
  suppressions = [],
  suppressionAudit = { applied: [], expired: [], unused: [] },
  expectedRuntimeErrors = [],
  startedAt = '',
  finishedAt = new Date().toISOString(),
  durationMs = 0,
} = {}) {
  const normalizedSurfaces = surfaces.map((surface) => {
    const surfaceFindings = sortFindings(findings.filter((finding) => finding.surface === surface.id));
    return {
      id: surface.id,
      route: surface.route,
      viewport: surface.viewport,
      reducedMotion: surface.reducedMotion || 'no-preference',
      status: surfaceStatus(surfaceFindings),
      summary: summarize(surfaceFindings),
      findings: surfaceFindings,
    };
  });
  const summary = summarize(findings);
  const status =
    summary.failure > 0
      ? 'failure'
      : summary.incomplete > 0
        ? 'incomplete'
        : summary.warning > 0
          ? 'warning'
          : 'pass';
  return {
    schemaVersion: A11Y_SCHEMA_VERSION,
    generatedAt: finishedAt,
    startedAt,
    durationMs,
    commit: String(commit || ''),
    engine,
    mode,
    status,
    summary,
    expectedRuntimeErrors: [...new Set(expectedRuntimeErrors)].sort(),
    suppressions: suppressions.map((suppression) => ({ ...suppression })),
    suppressionAudit: {
      applied: suppressionAudit.applied.map((item) => ({ ...item })),
      expired: suppressionAudit.expired.map((item) => ({ ...item })),
      unused: suppressionAudit.unused.map((item) => ({ ...item })),
    },
    surfaces: normalizedSurfaces,
    findings: sortFindings(findings),
  };
}
