/**
 * NARIMATO — pure release-gate checks (REL-01).
 *
 * No I/O beyond the explicit `read*` helpers, no npm dependencies and no network.
 * `scripts/release-gate.mjs` orchestrates the gates; this module owns the
 * deterministic contracts it needs to be trustworthy:
 *
 *   - version equality across package.json, the cache-bust slots, README and the
 *     release-notes heading;
 *   - executed-versus-documented test counts (`<-- test-count:N -->` markers plus
 *     current-release prose);
 *   - external prerequisite validation (owner, issue, evidence, blocking flag);
 *   - the manifest schema, verdict/exit-code matrix and atomic report writing.
 *
 * Exit codes (documented in docs/RELEASE_EVIDENCE.md):
 *   0 GREEN · 1 RED gate · 2 preflight refusal · 3 missing dependency
 *   4 documented/executed test-count mismatch · 5 BLOCKED on external prerequisites
 */
import fs from 'node:fs';
import path from 'node:path';

export const EXIT_CODES = Object.freeze({
  GREEN: 0,
  RED: 1,
  PREFLIGHT: 2,
  MISSING_DEPENDENCY: 3,
  TEST_COUNT_MISMATCH: 4,
  BLOCKED: 5,
});

export const VERDICTS = Object.freeze(['GREEN', 'RED', 'BLOCKED']);

export const REQUIREMENT_STATUSES = Object.freeze(['open', 'blocked', 'satisfied']);

/** The gate order is a contract: dependencies run before the things that use them. */
export const GATE_ORDER = Object.freeze([
  'version',
  'tests',
  'test-count',
  'docs',
  'gds-build',
  'a11y',
  'single-scene',
  'two-client',
  'surface-truth',
  'load-chaos',
  'recovery',
  'rollback',
  'evidence',
]);

export const TEST_COUNT_MARKER_RE = /<!-- test-count:(\d+) -->(\d+)<!-- \/test-count -->/g;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parse the node:test TAP summary. Returns null when no summary is present. */
export function parseTapSummary(text) {
  const source = String(text || '');
  const pick = (field) => {
    const match = new RegExp(`^(?:#|\u2139) ${field} (\\d+)$`, 'm').exec(source);
    return match ? Number(match[1]) : null;
  };
  const tests = pick('tests');
  const pass = pick('pass');
  const fail = pick('fail');
  if (tests === null || pass === null || fail === null) return null;
  const duration = /^(?:#|\u2139) duration_ms ([\d.]+)$/m.exec(source);
  return { tests, pass, fail, durationMs: duration ? Number(duration[1]) : null };
}

/** Return the `## v<version>` section with absolute line numbers, or null. */
export function findReleaseSection(notes, version) {
  const text = String(notes || '');
  const headingRe = new RegExp(`^##\\s+v${escapeRegExp(version)}\\b.*$`, 'm');
  const match = headingRe.exec(text);
  if (!match) return null;
  const before = text.slice(0, match.index);
  const startLine = before.split('\n').length;
  const rest = text.slice(match.index + match[0].length);
  const next = /^##\s+/m.exec(rest);
  const body = next ? rest.slice(0, next.index) : rest;
  return {
    heading: match[0].replace(/^##\s+/, '').trim(),
    startLine,
    body,
    lines: body.split('\n'),
  };
}

function addClaim(claims, { file, line, value, kind, raw }) {
  if (!Number.isFinite(value)) return;
  const duplicate = claims.some((claim) => claim.file === file && claim.line === line && claim.value === value && claim.kind === kind);
  if (duplicate) return;
  claims.push({ file, line, claimed: value, kind, raw: String(raw || '').trim() });
}

/**
 * Extract every claim about the *current* executed suite from one document.
 *
 * Historical release-note entries are deliberately ignored: a v3.57.0 line saying
 * "116/116 tests" is evidence of that release, not a claim about this suite. Only
 * markers, current-release prose, and explicitly current-version-scoped lines are
 * checked.
 */
export function extractCountClaims({ file, text, version = null }) {
  const claims = [];
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    TEST_COUNT_MARKER_RE.lastIndex = 0;
    let marker;
    while ((marker = TEST_COUNT_MARKER_RE.exec(line))) {
      addClaim(claims, { file, line: lineNumber, value: Number(marker[1]), kind: 'marker-declared', raw: marker[0] });
      addClaim(claims, { file, line: lineNumber, value: Number(marker[2]), kind: 'marker-rendered', raw: marker[0] });
    }
    const prose = [
      [/currently runs (\d+) tests?/g, 'prose'],
      [/suite currently runs (\d+) tests?/g, 'prose'],
      [/node:test suite \((\d+) tests?\)/g, 'prose'],
      [/current suite total is (\d+)/g, 'prose'],
    ];
    for (const [pattern, kind] of prose) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line))) addClaim(claims, { file, line: lineNumber, value: Number(match[1]), kind, raw: line });
    }
    // "116/116 tests passed at the v3.57.0 delivery" is historical unless the
    // named version is the release being gated.
    const versioned = /(\d+)\s*\/\s*(\d+)\s+tests?[^\n]*?\bv(\d+\.\d+\.\d+)\b/.exec(line);
    if (versioned && version && versioned[3] === version) {
      addClaim(claims, { file, line: lineNumber, value: Number(versioned[1]), kind: 'versioned-current', raw: line });
      addClaim(claims, { file, line: lineNumber, value: Number(versioned[2]), kind: 'versioned-current', raw: line });
    }
  });

  if (version) {
    const section = findReleaseSection(text, version);
    if (section) {
      section.lines.forEach((line, index) => {
        const lineNumber = section.startLine + index;
        const ratio = /(\d+)\s*\/\s*(\d+)\s+tests?/g;
        let match;
        while ((match = ratio.exec(line))) {
          addClaim(claims, { file, line: lineNumber, value: Number(match[1]), kind: 'release-section', raw: line });
          addClaim(claims, { file, line: lineNumber, value: Number(match[2]), kind: 'release-section', raw: line });
        }
        const single = /(\d+)\s+tests?\b/g;
        while ((match = single.exec(line))) {
          addClaim(claims, { file, line: lineNumber, value: Number(match[1]), kind: 'release-section', raw: line });
        }
      });
    }
  }
  return claims;
}

/**
 * Compare executed counts with every documented claim.
 * Returns `{ok, findings}` where a finding is `{code, file, line, claimed, executed}`.
 */
export function verifyTestCounts({ claims = [], executed = null, fail = 0 } = {}) {
  const findings = [];
  if (!Number.isInteger(executed)) {
    findings.push({ code: 'NO_SUMMARY', message: 'node:test summary not found' });
    return { ok: false, findings };
  }
  if (fail > 0) findings.push({ code: 'TEST_FAILURE', fail });
  for (const claim of claims) {
    if (claim.claimed !== executed) {
      findings.push({
        code: 'COUNT_MISMATCH',
        file: claim.file,
        line: claim.line,
        claimed: claim.claimed,
        executed,
        kind: claim.kind,
      });
    }
  }
  return { ok: findings.length === 0, findings, claims };
}

function read(root, file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Version SSOT across the four release-visible places.
 * `package.json` is the declaration; the rest must equal it.
 */
export function checkVersionTriple({ root, version = null } = {}) {
  const findings = [];
  const pkgText = read(root, 'package.json');
  let declaration = version;
  if (pkgText === null) {
    findings.push({ code: 'PACKAGE_MISSING', file: 'package.json' });
  } else {
    try {
      declaration = JSON.parse(pkgText).version;
    } catch (error) {
      findings.push({ code: 'PACKAGE_INVALID', file: 'package.json', detail: error.message });
    }
  }
  if (version && declaration && version !== declaration) {
    findings.push({ code: 'VERSION_ARG_MISMATCH', claimed: version, declared: declaration });
  }

  const html = read(root, 'public/index.html');
  if (html === null) findings.push({ code: 'INDEX_MISSING', file: 'public/index.html' });
  else {
    const slots = [...html.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
    if (!slots.length) findings.push({ code: 'CACHE_BUST_MISSING', file: 'public/index.html' });
    for (const found of slots) {
      if (found !== declaration) findings.push({ code: 'CACHE_BUST_STALE', file: 'public/index.html', found, expected: declaration });
    }
  }

  const readme = read(root, 'README.md');
  if (readme === null) findings.push({ code: 'README_MISSING', file: 'README.md' });
  else {
    const match = /Version \*\*(\d+\.\d+\.\d+)\*\*/.exec(readme);
    if (!match) findings.push({ code: 'README_VERSION_MISSING', file: 'README.md' });
    else if (match[1] !== declaration) findings.push({ code: 'README_VERSION_STALE', file: 'README.md', found: match[1], expected: declaration });
  }

  const notes = read(root, 'RELEASE_NOTES.md');
  if (notes === null) findings.push({ code: 'NOTES_MISSING', file: 'RELEASE_NOTES.md' });
  else {
    const section = findReleaseSection(notes, declaration);
    if (!section) findings.push({ code: 'NOTES_HEADING_MISSING', file: 'RELEASE_NOTES.md', expected: `## v${declaration}` });
    const versions = [...notes.matchAll(/^##\s+v(\d+\.\d+\.\d+)\b/gm)].map((match) => match[1]);
    const newest = versions.sort(compareSemver).at(-1);
    if (newest && compareSemver(newest, declaration) > 0) {
      findings.push({ code: 'NOTES_NEWER_VERSION', file: 'RELEASE_NOTES.md', found: newest, expected: declaration });
    }
  }

  return {
    ok: findings.length === 0,
    declaration,
    slots: ['package.json', 'public/index.html', 'README.md', 'RELEASE_NOTES.md'],
    findings,
  };
}

/** SemVer ordering sufficient for release headings (pre-release sorts first). */
export function compareSemver(a, b) {
  const split = (value) => {
    const [core, pre] = String(value).split('-');
    return { core: core.split('.').map(Number), pre: pre ? pre.split('.') : null };
  };
  const left = split(a);
  const right = split(b);
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1;
  }
  if (!left.pre && !right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  const length = Math.max(left.pre.length, right.pre.length);
  for (let index = 0; index < length; index += 1) {
    const l = left.pre[index];
    const r = right.pre[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const lNum = /^\d+$/.test(l);
    const rNum = /^\d+$/.test(r);
    if (lNum && rNum) {
      if (Number(l) !== Number(r)) return Number(l) > Number(r) ? 1 : -1;
    } else if (lNum !== rNum) {
      return lNum ? -1 : 1;
    } else if (l !== r) {
      return l > r ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Validate `observability/release-prerequisites.json`: the only place the gate
 * learns that A11Y-02 / OPS-04 are still open. No network, no guessed status.
 */
export function validatePrerequisites(document) {
  const findings = [];
  if (!document || typeof document !== 'object') {
    return { ok: false, findings: [{ code: 'PREREQUISITES_INVALID', detail: 'document must be an object' }] };
  }
  const external = Array.isArray(document.external) ? document.external : null;
  const deferred = Array.isArray(document.deferred) ? document.deferred : [];
  if (!external) findings.push({ code: 'PREREQUISITES_INVALID', detail: 'external[] is required' });
  const seen = new Set();
  const checkRows = (rows, label, { blocking }) => {
    for (const row of rows || []) {
      const where = `${label}:${row && row.id ? row.id : '?'}`;
      if (!row || typeof row.id !== 'string' || !/^[A-Z][A-Z0-9-]+$/.test(row.id)) {
        findings.push({ code: 'PREREQUISITE_ID', where });
        continue;
      }
      if (seen.has(row.id)) findings.push({ code: 'PREREQUISITE_DUPLICATE', where });
      seen.add(row.id);
      if (!Number.isInteger(row.issue) || row.issue <= 0) findings.push({ code: 'PREREQUISITE_ISSUE', where });
      if (typeof row.owner !== 'string' || !row.owner.trim()) findings.push({ code: 'PREREQUISITE_OWNER', where });
      if (!REQUIREMENT_STATUSES.includes(row.status)) findings.push({ code: 'PREREQUISITE_STATUS', where, found: row.status });
      if (typeof row.title !== 'string' || !row.title.trim()) findings.push({ code: 'PREREQUISITE_TITLE', where });
      if (typeof row.requiredEvidence !== 'string' || !row.requiredEvidence.trim()) findings.push({ code: 'PREREQUISITE_EVIDENCE', where });
      if (blocking && row.blocksRelease !== true) findings.push({ code: 'PREREQUISITE_BLOCKING', where });
      if (row.status === 'satisfied' && !String(row.evidence || '').trim()) findings.push({ code: 'PREREQUISITE_SATISFIED_EVIDENCE', where });
      if (row.status !== 'satisfied' && String(row.evidence || '').trim()) findings.push({ code: 'PREREQUISITE_UNEARNED_EVIDENCE', where });
    }
  };
  checkRows(external, 'external', { blocking: true });
  checkRows(deferred, 'deferred', { blocking: false });
  return { ok: findings.length === 0, findings, external: external || [], deferred };
}

/** Verdict: any red gate wins; otherwise unmet blocking prerequisites mean BLOCKED. */
export function verdictFor({ gates = [], prerequisites = { external: [] } } = {}) {
  if (gates.some((gate) => gate.status === 'fail' || gate.ok === false)) return 'RED';
  const unmet = (prerequisites.external || []).filter((row) => row.blocksRelease !== false && row.status !== 'satisfied');
  if (unmet.length) return 'BLOCKED';
  return 'GREEN';
}

/** Exit code matrix. Preflight/dependency/count classes are more specific than RED. */
export function exitCodeFor({ verdict, preflight = false, missingDependency = false, countMismatch = false } = {}) {
  if (preflight) return EXIT_CODES.PREFLIGHT;
  if (missingDependency) return EXIT_CODES.MISSING_DEPENDENCY;
  if (countMismatch) return EXIT_CODES.TEST_COUNT_MISMATCH;
  if (verdict === 'RED') return EXIT_CODES.RED;
  if (verdict === 'BLOCKED') return EXIT_CODES.BLOCKED;
  return EXIT_CODES.GREEN;
}

const REQUIRED_MANIFEST_FIELDS = ['schemaVersion', 'version', 'commit', 'tag', 'generatedAt', 'gates', 'testCount', 'verdict', 'exitCode'];
const REQUIRED_GATE_FIELDS = ['id', 'name', 'command', 'status', 'durationMs', 'evidence'];

/** Structural validation of the durable manifest contract. */
export function validateManifest(manifest) {
  const findings = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, findings: [{ code: 'MANIFEST_OBJECT' }] };
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) findings.push({ code: 'MANIFEST_FIELD', field });
  }
  if (!Array.isArray(manifest.gates)) findings.push({ code: 'MANIFEST_GATES' });
  else {
    for (const [index, gate] of manifest.gates.entries()) {
      for (const field of REQUIRED_GATE_FIELDS) {
        if (gate[field] === undefined || gate[field] === null) findings.push({ code: 'MANIFEST_GATE_FIELD', index, field });
      }
      if (gate.status && !['pass', 'fail', 'skip'].includes(gate.status)) {
        findings.push({ code: 'MANIFEST_GATE_STATUS', index, found: gate.status });
      }
      if (typeof gate.ok !== 'boolean') findings.push({ code: 'MANIFEST_GATE_OK', index });
    }
  }
  if (manifest.verdict && !VERDICTS.includes(manifest.verdict)) findings.push({ code: 'MANIFEST_VERDICT', found: manifest.verdict });
  if (manifest.exitCode !== undefined && !Object.values(EXIT_CODES).includes(manifest.exitCode)) {
    findings.push({ code: 'MANIFEST_EXIT_CODE', found: manifest.exitCode });
  }
  if (!manifest.testCount || !Number.isInteger(manifest.testCount.executed)) {
    findings.push({ code: 'MANIFEST_TEST_COUNT' });
  }
  if (!Array.isArray(manifest.externalPrerequisites)) findings.push({ code: 'MANIFEST_PREREQUISITES' });
  return { ok: findings.length === 0, findings };
}

/** Strip bearer strings, token assignments and UUIDs from tails/report text. */
export function scrubSecrets(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(token|authorization|secret|password)\b\s*[=:]\s*["']?[^\s"']+/gi, '$1=[redacted]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]')
    .replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, '[secret]');
}

function atomicWrite(file, content) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const fd = fs.openSync(temporary, 'w');
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temporary, file);
}

/** Write the machine-readable manifest and human summary atomically. */
export function writeArtifacts({ dir, manifest, markdown = null } = {}) {
  if (!dir) throw new Error('writeArtifacts requires a directory');
  const manifestFile = path.join(dir, 'release-manifest.json');
  const reportFile = path.join(dir, 'release-report.md');
  atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  atomicWrite(reportFile, markdown || renderSummary(manifest));
  return { manifestFile, reportFile };
}

const VERDICT_LABEL = {
  GREEN: 'GREEN — releasable',
  RED: 'RED — a code gate failed',
  BLOCKED: 'BLOCKED — code gates green, external prerequisites open',
};

/** Markdown a human can paste into a PR without opening the JSON. */
export function renderSummary(manifest) {
  const rows = (manifest.gates || [])
    .map((gate) => `| ${gate.id} | ${gate.status.toUpperCase()} | ${gate.ok ? 'ok' : 'FAIL'} | ${Math.round(gate.durationMs)} ms | \`${gate.command}\` |`)
    .join('\n');
  const external = (manifest.externalPrerequisites || [])
    .map((row) => `| ${row.id} | #${row.issue} | ${row.owner} | ${row.status} | ${row.blocksRelease ? 'yes' : 'no'} | ${row.requiredEvidence || ''} |`)
    .join('\n');
  const deferred = (manifest.deferredPrerequisites || [])
    .map((row) => `| ${row.id} | #${row.issue} | ${row.owner} | ${row.status} | ${row.requiredEvidence || ''} |`)
    .join('\n');
  const tests = manifest.testCount || {};
  const rollback = manifest.rollback || {};
  return `# NARIMATO release gate — v${manifest.version}

**Verdict: ${VERDICT_LABEL[manifest.verdict] || manifest.verdict}** · exit \`${manifest.exitCode}\` · commit \`${manifest.commit}\` · tag \`${manifest.tag}\`

Generated ${manifest.generatedAt} in ${Math.round((manifest.durationMs || 0) / 1000)} s.

## Gates

| Gate | Status | Result | Duration | Command |
|---|---|---|---|---|
${rows}

## Test count

- Executed: **${tests.executed ?? '—'}** tests, ${tests.pass ?? '—'} pass, ${tests.fail ?? '—'} fail.
- Documented claims checked: ${tests.claimsChecked ?? '—'}; mismatches: ${tests.mismatches ?? '—'}.

## External prerequisites (blocking)

| ID | Issue | Owner | Status | Blocks | Required evidence |
|---|---|---|---|---|---|
${external || '| — | — | — | — | — | — |'}

## Separate release prerequisites (not part of the fast gate)

| ID | Issue | Owner | Status | Required evidence |
|---|---|---|---|---|
${deferred || '| — | — | — | — | — |'}

## Rollback

- Previous tag: \`${rollback.previousTag ?? '—'}\`
- Drill: ${rollback.drillOk ? 'PASS' : 'FAIL'} · RTO ${rollback.rtoMinutes ?? '—'} min · schema ${rollback.schema ?? '—'}

## Artifacts

- Manifest: \`${manifest.artifacts?.manifest ?? 'release-manifest.json'}\`
- Human report: \`${manifest.artifacts?.report ?? 'release-report.md'}\`
- Gate logs: \`${manifest.artifacts?.logs ?? 'logs/'}\`

${manifest.notes ? `${manifest.notes}\n` : ''}`;
}
