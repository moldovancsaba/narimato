/**
 * NARIMATO — release claim ledger (REL-02).
 *
 * A closed vocabulary turns release prose into something a machine can distrust:
 *
 *   LIVE        shipped; at least one resolvable evidence reference
 *   PARTIAL     shipped conditionally; the note names what remains
 *   PLANNED     not shipped; future tense, never a shipping verb in present tense
 *   NOT_STARTED not begun; no evidence required beyond the owning issue
 *
 * Evidence references are typed (`test:path`, `script:path`, `commit:sha`,
 * `screenshot:path`, `smoke:path`, `issue:#N`) and resolved locally: files and
 * `git cat-file` for commits, `docs/ISSUE_MAP.md` for issues. No network calls.
 *
 * Exit codes (CLI contract, documented in docs/RELEASE_EVIDENCE.md):
 *   0 valid · 1 invalid status/row · 2 unresolved evidence · 3 broken link
 *   4 planned capability described as live
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const CLAIM_STATUSES = Object.freeze(['LIVE', 'PARTIAL', 'PLANNED', 'NOT_STARTED']);
export const EVIDENCE_KINDS = Object.freeze(['commit', 'test', 'script', 'screenshot', 'smoke', 'issue']);

/** Present-tense shipping claims that must never describe a planned capability. */
export const SHIPPING_TENSE_RE = /\b(ships|is live|delivers|supports now|now supports|works today|available now|is available|runs live)\b/i;
const NEGATED_RE = /\b(not|never|isn't|is not|no longer|pending|planned|future|until|blocked)\b/i;
const STATUS_CELL_RE = /^(?:\*\*|`)?(LIVE|PARTIAL|PLANNED|NOT_STARTED)(?:\*\*|`)?$/i;
const HEADER_RE = /^\|\s*(claim|capability|statement)\s*\|\s*status\s*\|\s*evidence\s*\|\s*note\s*\|$/i;
const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

export const FINDING_CODES = Object.freeze({
  INVALID_STATUS: 1,
  INVALID_ROW: 1,
  PARTIAL_NO_NOTE: 1,
  UNRESOLVED_EVIDENCE: 2,
  LIVE_NO_EVIDENCE: 2,
  UNKNOWN_EVIDENCE_KIND: 2,
  EVIDENCE_PATH_ESCAPE: 2,
  BROKEN_LINK: 3,
  PLANNED_AS_LIVE: 4,
});

/** Split a markdown table row into cells, keeping escaped pipes out of the split. */
export function splitRow(line) {
  const trimmed = String(line).trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
    } else if (character === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function cleanCell(cell) {
  return String(cell || '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

/** Parse evidence cell into typed references; `—`/empty yields an empty array. */
export function parseEvidence(cell) {
  const text = cleanCell(cell);
  if (!text || /^[—–-]$/.test(text)) return [];
  return text
    .split(/[,;]|\s+(?=[a-z]+:|issue:)/i)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const separator = token.indexOf(':');
      if (separator <= 0) return { kind: 'unknown', ref: token, raw: token };
      return {
        kind: token.slice(0, separator).toLowerCase(),
        ref: token.slice(separator + 1).trim(),
        raw: token,
      };
    });
}

/**
 * Parse every claim table in a Markdown document.
 * Header: `| Claim | Status | Evidence | Note |` (Claim may be Capability/Statement).
 */
export function parseClaimTables(markdown, file = '') {
  const lines = String(markdown || '').split('\n');
  const claims = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!HEADER_RE.test(lines[index].trim())) continue;
    let rowIndex = index + 1;
    // Markdown separator row: |---|---|...
    if (!/^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(lines[rowIndex] || '')) continue;
    rowIndex += 1;
    for (; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex].trim();
      if (!line.startsWith('|')) break;
      const cells = splitRow(line);
      if (cells.length < 4) continue;
      const text = cleanCell(cells[0]);
      const statusText = cleanCell(cells[1]).toUpperCase();
      if (!text || /^[—–-]$/.test(text) || /^claim$/i.test(text)) continue;
      const statusMatch = STATUS_CELL_RE.exec(statusText);
      claims.push({
        file,
        line: rowIndex + 1,
        text,
        status: statusMatch ? statusMatch[1].toUpperCase() : null,
        statusText,
        evidence: parseEvidence(cells[2]),
        note: cleanCell(cells[3]),
      });
    }
    index = rowIndex - 1;
  }
  return claims;
}

function isExternalTarget(target) {
  return /^(?:https?:|mailto:|tel:|#)/.test(target);
}

function resolveRelative(root, fromFile, target) {
  const clean = decodeURIComponent(String(target).split('#')[0].split('?')[0]);
  if (!clean) return null;
  return path.resolve(path.dirname(path.join(root, fromFile)), clean);
}

function insideRoot(root, absolute) {
  const relative = absolute.slice(root.length).replace(/^[/\\]+/, '');
  return !relative.split(/[/\\]/).includes('..');
}

/** Resolve one typed evidence reference. Returns `{ok, code?, detail?}`. */
export function resolveEvidence(ref, { root, repo = root, git = null } = {}) {
  const { kind } = ref;
  const value = String(ref.ref || '').trim();
  if (!EVIDENCE_KINDS.includes(kind)) return { ok: false, code: 'UNKNOWN_EVIDENCE_KIND', detail: `unknown evidence kind "${kind}"` };
  if (kind === 'commit') {
    if (!/^[0-9a-f]{7,40}$/i.test(value)) return { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: `invalid commit sha "${value}"` };
    const checker = git || defaultGit;
    const result = checker(['cat-file', '-e', `${value}^{commit}`], repo);
    return result.status === 0
      ? { ok: true }
      : { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: `commit ${value} does not exist in ${repo}` };
  }
  if (kind === 'issue') {
    const number = String(value).replace(/^#/, '');
    const mapFile = `${root}/docs/ISSUE_MAP.md`;
    let map;
    try {
      map = defaultReadFile(mapFile);
    } catch {
      return { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: 'docs/ISSUE_MAP.md is missing' };
    }
    return new RegExp(`/issues/${number}(?:\\)|\\b)`).test(map)
      ? { ok: true }
      : { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: `issue #${number} is not in docs/ISSUE_MAP.md` };
  }
  if (/^https?:/.test(value)) {
    return { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: 'external URLs are not fetched; name a local artifact instead' };
  }
  const absolute = resolveRelative(root, 'README.md', value);
  if (!absolute || !insideRoot(root, absolute)) return { ok: false, code: 'EVIDENCE_PATH_ESCAPE', detail: `path escapes the repository: ${value}` };
  try {
    const stat = defaultStat(absolute);
    return stat && stat.isFile() ? { ok: true } : { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: `${value} does not exist` };
  } catch {
    return { ok: false, code: 'UNRESOLVED_EVIDENCE', detail: `${value} does not exist` };
  }
}

const defaultReadFile = (file) => fs.readFileSync(file, 'utf8');
const defaultStat = (file) => fs.statSync(file);
const defaultGit = (args, cwd) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

function addFinding(findings, code, claim, detail) {
  findings.push({
    code,
    exitCode: FINDING_CODES[code] || 1,
    file: claim.file,
    line: claim.line,
    status: claim.status,
    detail,
  });
}

/** Check markdown links inside a claim row (notes may link evidence). */
function checkClaimLinks(claim, root, findings) {
  for (const match of `${claim.text} ${claim.note}`.matchAll(LINK_RE)) {
    const target = match[2];
    if (isExternalTarget(target)) continue;
    const absolute = resolveRelative(root, claim.file, target);
    if (!absolute || !insideRoot(root, absolute) || !fs.existsSync(absolute)) {
      addFinding(findings, 'BROKEN_LINK', claim, `link target does not resolve: ${target}`);
    }
  }
}

/**
 * Validate parsed claims against the repository.
 * Returns `{ok, findings, claims, summary, exitCode}`.
 */
export function validateClaims({ claims = [], root = process.cwd(), repo = root, git = null, checkGit = true } = {}) {
  const findings = [];
  const byStatus = Object.fromEntries(CLAIM_STATUSES.map((status) => [status, 0]));
  let live = 0;
  let evidencedLive = 0;

  for (const claim of claims) {
    checkClaimLinks(claim, root, findings);
    if (!claim.status) {
      addFinding(findings, 'INVALID_STATUS', claim, `status "${claim.statusText}" is not LIVE|PARTIAL|PLANNED|NOT_STARTED`);
      continue;
    }
    byStatus[claim.status] += 1;
    if (claim.status === 'LIVE') {
      live += 1;
      if (claim.evidence.length === 0) addFinding(findings, 'LIVE_NO_EVIDENCE', claim, 'LIVE claim has no evidence reference');
    }
    if (claim.status === 'PARTIAL' && !claim.note) {
      addFinding(findings, 'PARTIAL_NO_NOTE', claim, 'PARTIAL claim must name what remains in the Note column');
    }
    const plannedText = `${claim.text} ${claim.note}`;
    if ((claim.status === 'PLANNED' || claim.status === 'NOT_STARTED') && SHIPPING_TENSE_RE.test(plannedText)) {
      const match = SHIPPING_TENSE_RE.exec(plannedText);
      if (!NEGATED_RE.test(plannedText)) {
        addFinding(findings, 'PLANNED_AS_LIVE', claim, `planned capability uses present-tense shipping verb "${match[0]}"`);
      }
    }
    let resolvedEvidence = 0;
    for (const evidence of claim.evidence) {
      const result = resolveEvidence(evidence, { root, repo, git: checkGit ? git : (() => ({ status: 0 })) });
      if (result.ok) resolvedEvidence += 1;
      else addFinding(findings, result.code, claim, `${evidence.raw}: ${result.detail}`);
    }
    if (claim.status === 'LIVE' && resolvedEvidence > 0) evidencedLive += 1;
  }

  const exitCode = findings.reduce((highest, finding) => Math.max(highest, finding.exitCode), 0);
  return {
    ok: findings.length === 0,
    findings,
    claims,
    exitCode,
    summary: {
      total: claims.length,
      live,
      evidencedLive,
      evidencedCoverage: live ? evidencedLive / live : 1,
      stale: findings.filter((finding) => finding.code === 'UNRESOLVED_EVIDENCE' || finding.code === 'BROKEN_LINK').length,
      byStatus,
    },
  };
}

/** Resolve a whole ledger from `[{file,text}]` documents. */
export function checkLedger({ files = [], root = process.cwd(), repo = root, git = null, checkGit = true } = {}) {
  const claims = files.flatMap(({ file, text }) => parseClaimTables(text, file));
  return validateClaims({ claims, root, repo, git, checkGit });
}

/** One line per violation, `file:line [CODE] detail`. */
export function formatFindings(findings) {
  return findings.map((finding) => `${finding.file}:${finding.line} [${finding.code}] ${finding.detail}`).join('\n');
}

export default {
  CLAIM_STATUSES,
  EVIDENCE_KINDS,
  parseClaimTables,
  parseEvidence,
  resolveEvidence,
  validateClaims,
  checkLedger,
  formatFindings,
};
