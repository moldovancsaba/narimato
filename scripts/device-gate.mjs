#!/usr/bin/env node
/**
 * NARIMATO — real-device accessibility gate (A11Y-02).
 *
 * The gate is deliberately split from the headless A11Y-01 checks:
 *
 *   --plan      print the fixed 20-row matrix for one commit
 *   --template  print a ledger skeleton for one commit (not evidence)
 *   --check     validate a completed ledger and compute the sign-off predicate
 *
 * A completed ledger is produced only by a human run on the listed physical
 * devices. Headless CI can run `--plan` and the unit tests, but it cannot sign
 * the gate: the evidence files, the two independent approvals and the device
 * captures are external artefacts.
 *
 * Ledger location (default):
 *   media/a11y/device-gate/<short-sha>/EVIDENCE.json
 *
 * Exit codes:
 *   0  pass: 20/20 rows pass, no open blocker, two approvals, fresh evidence
 *   1  blocked: ledger exists but is incomplete, failed, expired or mismatched
 *   2  usage or internal error
 *   3  ledger missing — the gate is not signed
 *
 * Zero dependencies. Pure helpers are exported so tests do not spawn a process.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

export const SCHEMA_VERSION = '1.0.0';
export const DEFAULT_MAX_AGE_DAYS = 30;
export const MIN_APPROVALS = 2;
export const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
export const EXIT = Object.freeze({
  PASS: 0,
  BLOCKED: 1,
  USAGE: 2,
  LEDGER_MISSING: 3,
});

const FULL_COMMIT_RE = /^[0-9a-f]{40}$/i;
const DEFECT_RE = /^https:\/\/github\.com\/moldovancsaba\/narimato\/issues\/[1-9]\d*$/;
const DEFECT_TITLE_RE = /^\[Device\]\[[^\]]+\]\s+\S/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.mp4',
  '.mov',
  '.m4a',
  '.wav',
  '.txt',
  '.log',
  '.json',
  '.pdf',
]);

/**
 * The five fixed targets. `assistiveTech` is the expected reader for the
 * screen-reader row; iPadOS is keyboard-only because VoiceOver on iPad is the
 * same engine as iPhone but the issue requires a separate keyboard journey.
 */
export const TARGETS = Object.freeze([
  Object.freeze({
    id: 'iphone-safari',
    label: 'iPhone Safari',
    os: 'iOS 17+',
    browser: 'Safari',
    viewports: Object.freeze(['390x844', '844x390']),
    assistiveTech: 'VoiceOver',
    srScript: 'SR-IPHONE-VO',
  }),
  Object.freeze({
    id: 'android-chrome',
    label: 'Android Chrome',
    os: 'Android 13+',
    browser: 'Chrome',
    viewports: Object.freeze(['412x915', '915x412']),
    assistiveTech: 'TalkBack',
    srScript: 'SR-ANDROID-TALKBACK',
  }),
  Object.freeze({
    id: 'ipad-safari',
    label: 'iPad Safari',
    os: 'iPadOS 17+',
    browser: 'Safari',
    viewports: Object.freeze(['1024x768', '768x1024']),
    assistiveTech: 'Keyboard-only',
    srScript: 'SR-IPAD-KEYBOARD',
  }),
  Object.freeze({
    id: 'windows-nvda',
    label: 'Windows Chrome + NVDA',
    os: 'Windows 11',
    browser: 'Chrome',
    viewports: Object.freeze(['1440x900']),
    assistiveTech: 'NVDA',
    srScript: 'SR-WINDOWS-NVDA',
  }),
  Object.freeze({
    id: 'macos-voiceover',
    label: 'macOS Safari + VoiceOver',
    os: 'macOS 14+',
    browser: 'Safari',
    viewports: Object.freeze(['1440x900']),
    assistiveTech: 'VoiceOver',
    srScript: 'SR-MACOS-VO',
  }),
]);

/** Four rows per target = the fixed 20-row matrix. */
const ROW_CHECKS = Object.freeze([
  Object.freeze({
    key: 'boot',
    title: 'Boot, join and captions',
    script: 'DEV-BOOT',
    criterion:
      'Intro skip (?intro=0), join, HUD top row, short briefing and captions render; no primary action is clipped at the target viewports.',
  }),
  Object.freeze({
    key: 'sr',
    title: 'Assistive-technology reading order',
    script: null,
    criterion:
      'The target screen-reader script passes: planet badge, mission, cargo, target inspector, captions, manual, escape CTA and the incident dialog are announced in a usable order with no focus trap.',
  }),
  Object.freeze({
    key: 'zoom-motion',
    title: '200% zoom, reduced motion and daylight contrast',
    script: 'DEV-ZOOM-MOTION',
    criterion:
      '200% text zoom keeps every primary action reachable; prefers-reduced-motion loses no information; muted HUD labels stay legible in direct daylight.',
  }),
  Object.freeze({
    key: 'audio-overlay',
    title: 'Autoplay, interruption and short-screen overlays',
    script: 'DEV-AUDIO-OVERLAY',
    criterion:
      'First narration is gesture-gated, a call/route interruption recovers with captions intact, and the report overlay plus notch/home-indicator insets clear system gestures.',
  }),
]);

/** Deterministic plan rows. The order is target-major, then boot/sr/zoom/audio. */
export function expectedRows() {
  return TARGETS.flatMap((target) =>
    ROW_CHECKS.map((check) => ({
      id: `${target.id}/${check.key}`,
      target: target.id,
      targetLabel: target.label,
      title: `${target.label} — ${check.title}`,
      script: check.key === 'sr' ? target.srScript : check.script,
      criterion: check.criterion,
      viewports: [...target.viewports],
      device: {
        model: '',
        os: target.os,
        browser: target.browser,
        assistiveTech: check.key === 'sr' ? target.assistiveTech : 'none',
      },
    })),
  );
}

export function isFullCommit(value) {
  return typeof value === 'string' && FULL_COMMIT_RE.test(value.trim());
}

function shortCommit(commit) {
  return (typeof commit === 'string' ? commit.trim().toLowerCase() : '').slice(0, 7);
}

/** Plan for one commit. `commit` may be short for display; check requires full. */
export function buildPlan(commit) {
  const value = typeof commit === 'string' ? commit.trim() : '';
  return {
    schemaVersion: SCHEMA_VERSION,
    command: 'plan',
    commit: value,
    shortCommit: shortCommit(value),
    targets: TARGETS.length,
    rows: expectedRows(),
  };
}

/**
 * A ledger skeleton. `template: true` makes `--check` reject it: a template is
 * not evidence and must never be signed by copying it into place.
 */
export function buildTemplate(commit) {
  const value = typeof commit === 'string' ? commit.trim().toLowerCase() : '';
  return {
    template: true,
    schemaVersion: SCHEMA_VERSION,
    instructions: [
      'Copy this file to media/a11y/device-gate/<short-sha>/EVIDENCE.json.',
      'Remove "template", fill runDate/gameUrl/executor/approvals, then run every row on the listed physical target.',
      'A pass or fail row needs at least one evidence file under the same commit directory and a capturedAt date.',
      'A fail row also needs an absolute GitHub defect URL and a [Device][Surface] title.',
      'A blocked row needs a reason and keeps the gate blocked.',
      'Validate with: node scripts/device-gate.mjs --check --commit=<full-sha>',
    ],
    commit: value,
    runDate: '',
    gameUrl: '',
    executor: { name: '', role: '' },
    approvals: [],
    rows: expectedRows().map((row) => ({
      id: row.id,
      target: row.target,
      script: row.script,
      criterion: row.criterion,
      viewports: row.viewports,
      device: { ...row.device },
      verdict: 'blocked',
      capturedAt: '',
      evidence: [],
      notes: '',
      defect: null,
      defectTitle: null,
      reason: 'not executed — fill after the device run',
    })),
  };
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toUtcDay(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (DATE_RE.test(text)) return parseIsoDate(text);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate a parsed ledger. Returns a deterministic report; never throws for
 * malformed evidence. `root` resolves evidence paths and `now` makes the
 * freshness check testable without freezing the process clock.
 */
export function evaluateLedger(ledger, options = {}) {
  const {
    commit = '',
    now = new Date(),
    maxAgeDays = DEFAULT_MAX_AGE_DAYS,
    root = DEFAULT_ROOT,
    expected = expectedRows(),
  } = options;

  const findings = [];
  const add = (code, message, extra = {}) => findings.push({ code, message, ...extra });
  const rows = [];

  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    add('SCHEMA_INVALID', 'ledger must be a JSON object');
    return buildReport({ ledger, findings, rows, expected, commit, maxAgeDays });
  }

  if (ledger.template === true) {
    add('TEMPLATE_NOT_EVIDENCE', 'this is the template skeleton; copy it and record a real run');
  }
  if (ledger.schemaVersion !== SCHEMA_VERSION) {
    add('SCHEMA_VERSION', `schemaVersion must be ${SCHEMA_VERSION}`);
  }

  const expectedCommit = isFullCommit(commit) ? commit.trim().toLowerCase() : '';
  if (!expectedCommit) {
    add('COMMIT_ARGUMENT_INVALID', '--commit must be the full 40-character commit SHA');
  }
  const ledgerCommit = typeof ledger.commit === 'string' ? ledger.commit.trim().toLowerCase() : '';
  if (!isFullCommit(ledgerCommit)) {
    add('COMMIT_INVALID', 'ledger.commit must be the full 40-character commit SHA');
  } else if (expectedCommit && ledgerCommit !== expectedCommit) {
    add('COMMIT_MISMATCH', `ledger commit ${ledgerCommit.slice(0, 7)} does not match ${expectedCommit.slice(0, 7)}`);
  }

  const referenceCommit = expectedCommit || ledgerCommit;
  const commitShort = referenceCommit ? referenceCommit.slice(0, 7) : '';
  const today = toUtcDay(now);
  if (!today) add('CLOCK_INVALID', 'now must be a valid date');

  const runDate = parseIsoDate(ledger.runDate);
  if (!runDate) {
    add('RUN_DATE_INVALID', 'runDate must be a real YYYY-MM-DD date');
  } else if (today) {
    if (runDate.getTime() > today.getTime()) add('RUN_DATE_FUTURE', 'runDate is in the future');
    if (daysBetween(runDate, today) > maxAgeDays) {
      add('RUN_DATE_EXPIRED', `runDate is older than ${maxAgeDays} days`);
    }
  }

  if (!isNonEmptyString(ledger.gameUrl)) {
    add('GAME_URL_INVALID', 'gameUrl is required');
  } else {
    try {
      const url = new URL(ledger.gameUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        add('GAME_URL_INVALID', 'gameUrl must be http(s)');
      } else if (url.username || url.password) {
        add('GAME_URL_INVALID', 'gameUrl must not carry credentials');
      }
    } catch {
      add('GAME_URL_INVALID', 'gameUrl must be an absolute URL');
    }
  }

  if (!ledger.executor || typeof ledger.executor !== 'object' || Array.isArray(ledger.executor)) {
    add('EXECUTOR_MISSING', 'executor name and role are required');
  } else {
    if (!isNonEmptyString(ledger.executor.name)) add('EXECUTOR_MISSING', 'executor.name is required');
    if (!isNonEmptyString(ledger.executor.role)) add('EXECUTOR_MISSING', 'executor.role is required');
  }

  const approvals = Array.isArray(ledger.approvals) ? ledger.approvals : [];
  if (!Array.isArray(ledger.approvals)) {
    add('APPROVALS_MISSING', 'approvals must be an array');
  }
  if (approvals.length < MIN_APPROVALS) {
    add('APPROVALS_MISSING', `at least ${MIN_APPROVALS} approvals are required`);
  }
  const approvalNames = new Set();
  let independentApproval = false;
  for (const [index, approval] of approvals.entries()) {
    const label = `approvals[${index}]`;
    if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
      add('APPROVAL_INVALID', `${label} must be an object`);
      continue;
    }
    if (!isNonEmptyString(approval.name)) {
      add('APPROVAL_INVALID', `${label}.name is required`);
    } else {
      const key = approval.name.trim().toLowerCase();
      if (approvalNames.has(key)) add('APPROVAL_DUPLICATE', `${label}.name duplicates another approval`);
      approvalNames.add(key);
    }
    if (!isNonEmptyString(approval.role)) add('APPROVAL_INVALID', `${label}.role is required`);
    if (typeof approval.executed !== 'boolean') {
      add('APPROVAL_INVALID', `${label}.executed must be true or false`);
    } else if (approval.executed === false) {
      independentApproval = true;
    }
    const date = parseIsoDate(approval.date);
    if (!date) {
      add('APPROVAL_DATE_INVALID', `${label}.date must be a real YYYY-MM-DD date`);
    } else if (today) {
      if (date.getTime() > today.getTime()) add('APPROVAL_FUTURE', `${label}.date is in the future`);
      if (runDate && date.getTime() < runDate.getTime()) {
        add('APPROVAL_BEFORE_RUN', `${label}.date is before the runDate`);
      }
    }
  }
  if (approvals.length >= MIN_APPROVALS && !independentApproval) {
    add('APPROVAL_INDEPENDENT_MISSING', 'one approver must not have executed the run');
  }

  const expectedById = new Map(expected.map((row) => [row.id, row]));
  const seen = new Map();
  const evidencePaths = new Set();
  const ledgerRows = Array.isArray(ledger.rows) ? ledger.rows : [];
  if (!Array.isArray(ledger.rows)) add('ROWS_MISSING', 'rows must be an array');

  for (const row of ledgerRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !isNonEmptyString(row.id)) {
      add('ROW_INVALID', 'every row must be an object with an id');
      continue;
    }
    if (seen.has(row.id)) {
      add('ROW_DUPLICATE', `row ${row.id} appears more than once`, { row: row.id });
      continue;
    }
    seen.set(row.id, row);
    const expectedRow = expectedById.get(row.id);
    if (!expectedRow) {
      add('ROW_UNKNOWN', `row ${row.id} is not part of the fixed matrix`, { row: row.id });
      continue;
    }
    const rowFindings = [];
    const rowAdd = (code, message, extra = {}) => {
      rowFindings.push({ code, message, row: row.id, ...extra });
    };

    if (row.target !== expectedRow.target) {
      rowAdd('ROW_TARGET_MISMATCH', `target must be ${expectedRow.target}`);
    }
    if (row.script !== expectedRow.script) {
      rowAdd('ROW_SCRIPT_MISMATCH', `script must be ${expectedRow.script}`);
    }
    if (!isNonEmptyString(row.criterion)) {
      rowAdd('ROW_CRITERION_MISSING', 'criterion is required');
    }
    const rowViewports = Array.isArray(row.viewports) ? row.viewports : [];
    if (
      rowViewports.length !== expectedRow.viewports.length ||
      expectedRow.viewports.some((viewport) => !rowViewports.includes(viewport))
    ) {
      rowAdd('VIEWPORTS_MISMATCH', `viewports must be ${expectedRow.viewports.join(', ')}`);
    }

    const verdicts = new Set(['pass', 'fail', 'blocked']);
    if (!verdicts.has(row.verdict)) {
      rowAdd('VERDICT_INVALID', 'verdict must be pass, fail or blocked');
    }

    if (!row.device || typeof row.device !== 'object' || Array.isArray(row.device)) {
      rowAdd('DEVICE_MISSING', 'device model, os and browser are required');
    } else {
      for (const field of ['model', 'os', 'browser']) {
        if (!isNonEmptyString(row.device[field])) rowAdd('DEVICE_MISSING', `device.${field} is required`);
      }
      const expectedOs = expectedRow.device.os.split(' ')[0].toLowerCase();
      const actualOs = typeof row.device.os === 'string' ? row.device.os.toLowerCase() : '';
      if (actualOs && !actualOs.includes(expectedOs)) {
        rowAdd('DEVICE_OS_MISMATCH', `device.os must name ${expectedRow.device.os}`);
      }
      const expectedBrowser = expectedRow.device.browser.toLowerCase();
      const actualBrowser = typeof row.device.browser === 'string' ? row.device.browser.toLowerCase() : '';
      if (actualBrowser && !actualBrowser.includes(expectedBrowser)) {
        rowAdd('DEVICE_BROWSER_MISMATCH', `device.browser must name ${expectedRow.device.browser}`);
      }
      if (expectedRow.script.startsWith('SR-')) {
        const expectedTech = expectedRow.device.assistiveTech.toLowerCase();
        const actualTech = typeof row.device.assistiveTech === 'string' ? row.device.assistiveTech.toLowerCase() : '';
        if (!actualTech || !actualTech.includes(expectedTech)) {
          rowAdd('DEVICE_ASSISTIVE_TECH_MISMATCH', `device.assistiveTech must name ${expectedRow.device.assistiveTech}`);
        }
      }
    }

    const capturedAt = parseIsoDate(row.capturedAt);
    if (!capturedAt) {
      rowAdd('CAPTURED_AT_INVALID', 'capturedAt must be a real YYYY-MM-DD date');
    } else if (today) {
      if (capturedAt.getTime() > today.getTime()) rowAdd('CAPTURED_AT_FUTURE', 'capturedAt is in the future');
      if (runDate && capturedAt.getTime() < runDate.getTime()) {
        rowAdd('CAPTURED_BEFORE_RUN', 'capturedAt is before the runDate');
      }
      if (daysBetween(capturedAt, today) > maxAgeDays) {
        rowAdd('CAPTURED_AT_EXPIRED', `capturedAt is older than ${maxAgeDays} days`);
      }
    }

    const evidence = Array.isArray(row.evidence) ? row.evidence : [];
    if (!Array.isArray(row.evidence)) rowAdd('EVIDENCE_MISSING', 'evidence must be an array');
    if ((row.verdict === 'pass' || row.verdict === 'fail') && evidence.length === 0) {
      rowAdd('EVIDENCE_MISSING', `${row.verdict} row needs at least one evidence file`);
    }
    let rowBytes = 0;
    for (const entry of evidence) {
      if (!isNonEmptyString(entry)) {
        rowAdd('EVIDENCE_PATH_INVALID', 'evidence entries must be non-empty strings');
        continue;
      }
      const normalized = path.posix.normalize(entry.replace(/\\/g, '/'));
      if (
        path.posix.isAbsolute(normalized) ||
        normalized.startsWith('../') ||
        normalized === '..' ||
        normalized.includes('\0')
      ) {
        rowAdd('EVIDENCE_PATH_INVALID', `evidence path must be repository-relative: ${entry}`);
        continue;
      }
      const requiredPrefix = `media/a11y/device-gate/${commitShort}/`;
      if (!commitShort || !normalized.startsWith(requiredPrefix)) {
        rowAdd('EVIDENCE_OUTSIDE_COMMIT', `evidence must live under ${requiredPrefix || 'the commit directory'}`);
        continue;
      }
      if (evidencePaths.has(normalized)) {
        rowAdd('EVIDENCE_REUSED', `evidence file is reused: ${normalized}`);
      } else {
        evidencePaths.add(normalized);
      }
      const extension = path.posix.extname(normalized).toLowerCase();
      if (!EVIDENCE_EXTENSIONS.has(extension)) {
        rowAdd('EVIDENCE_TYPE_INVALID', `unsupported evidence type: ${extension || '(none)'}`);
      }
      const absolute = path.resolve(root, ...normalized.split('/'));
      try {
        const stat = fs.statSync(absolute);
        if (!stat.isFile()) {
          rowAdd('EVIDENCE_NOT_FOUND', `evidence is not a file: ${normalized}`);
        } else {
          rowBytes += stat.size;
        }
      } catch {
        rowAdd('EVIDENCE_NOT_FOUND', `evidence file is missing: ${normalized}`);
      }
    }
    if (rowBytes > MAX_EVIDENCE_BYTES) {
      rowAdd('EVIDENCE_TOO_LARGE', `row evidence exceeds ${MAX_EVIDENCE_BYTES} bytes`);
    }

    if (row.verdict === 'fail') {
      if (!isNonEmptyString(row.defect)) {
        rowAdd('DEFECT_MISSING', 'fail row needs a linked GitHub defect issue');
      } else if (!DEFECT_RE.test(row.defect.trim())) {
        rowAdd('DEFECT_INVALID', 'defect must be an absolute moldovancsaba/narimato issue URL');
      }
      if (!isNonEmptyString(row.defectTitle)) {
        rowAdd('DEFECT_TITLE_MISSING', 'fail row needs a [Device][Surface] defect title');
      } else if (!DEFECT_TITLE_RE.test(row.defectTitle.trim())) {
        rowAdd('DEFECT_TITLE_INVALID', 'defectTitle must start with [Device][Surface]');
      }
    } else if (row.verdict === 'pass' && row.defect) {
      rowAdd('DEFECT_ON_PASS', 'a passing row cannot carry an open defect link');
    }
    if (row.verdict === 'blocked') {
      if (!isNonEmptyString(row.reason)) rowAdd('BLOCKED_REASON_MISSING', 'blocked row needs a reason');
      rowAdd('ROW_BLOCKED', 'blocked row keeps the gate blocked');
    }
    if (row.verdict === 'fail') {
      rowAdd('ROW_FAILED', 'failing row keeps the gate blocked');
    }

    findings.push(...rowFindings);
    rows.push({
      id: row.id,
      target: row.target,
      script: row.script,
      verdict: row.verdict,
      capturedAt: row.capturedAt,
      evidence: evidence.length,
    });
  }

  for (const expectedRow of expected) {
    if (!seen.has(expectedRow.id)) {
      add('ROW_MISSING', `row ${expectedRow.id} has no evidence record`, { row: expectedRow.id });
    }
  }

  return buildReport({ ledger, findings, rows, expected, commit: referenceCommit, maxAgeDays });
}

function buildReport({ ledger, findings, rows, expected, commit, maxAgeDays }) {
  const pass = rows.filter((row) => row.verdict === 'pass').length;
  const fail = rows.filter((row) => row.verdict === 'fail').length;
  const blocked = rows.filter((row) => row.verdict === 'blocked').length;
  const approvals = Array.isArray(ledger?.approvals) ? ledger.approvals.length : 0;
  const ok = findings.length === 0 && rows.length === expected.length && pass === expected.length;
  return {
    ok,
    status: ok ? 'pass' : 'blocked',
    code: ok ? 'PASS' : 'BLOCKED',
    commit: commit || '',
    shortCommit: commit ? commit.slice(0, 7) : '',
    runDate: ledger?.runDate || '',
    maxAgeDays,
    expectedRows: expected.length,
    targets: TARGETS.length,
    approvals,
    summary: {
      rows: rows.length,
      pass,
      fail,
      blocked,
      openDefects: fail,
      findings: findings.length,
    },
    findings,
    rows,
  };
}

export function formatReport(report) {
  if (report.ok) {
    return `device-gate: pass (${report.summary.pass}/${report.expectedRows} rows, 0 open blockers, ${report.approvals} approvals) — commit ${report.shortCommit}\n`;
  }
  const lines = [
    `device-gate: blocked — ${report.summary.findings} finding(s) (${report.summary.pass}/${report.expectedRows} rows pass, ${report.summary.fail} fail, ${report.summary.blocked} blocked) — commit ${report.shortCommit || '(none)'}`,
  ];
  for (const finding of report.findings) {
    const row = finding.row ? ` [${finding.row}]` : '';
    lines.push(`  ${finding.code}${row}: ${finding.message}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    mode: null,
    commit: '',
    ledger: '',
    root: DEFAULT_ROOT,
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    now: new Date(),
    json: false,
    help: false,
  };
  const take = (index, name) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan' || arg === '--check' || arg === '--template') {
      if (options.mode && options.mode !== arg.slice(2)) throw new Error('choose one of --plan, --template or --check');
      options.mode = arg.slice(2);
    } else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--commit') { options.commit = take(index, '--commit'); index += 1; }
    else if (arg.startsWith('--commit=')) options.commit = arg.slice('--commit='.length);
    else if (arg === '--ledger') { options.ledger = take(index, '--ledger'); index += 1; }
    else if (arg.startsWith('--ledger=')) options.ledger = arg.slice('--ledger='.length);
    else if (arg === '--root') { options.root = path.resolve(take(index, '--root')); index += 1; }
    else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice('--root='.length));
    else if (arg === '--max-age-days') { options.maxAgeDays = Number(take(index, '--max-age-days')); index += 1; }
    else if (arg.startsWith('--max-age-days=')) options.maxAgeDays = Number(arg.slice('--max-age-days='.length));
    else if (arg === '--now') { options.now = new Date(take(index, '--now')); index += 1; }
    else if (arg.startsWith('--now=')) options.now = new Date(arg.slice('--now='.length));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.maxAgeDays) || options.maxAgeDays < 0 || !Number.isInteger(options.maxAgeDays)) {
    throw new Error('--max-age-days must be a non-negative integer');
  }
  if (Number.isNaN(options.now.getTime())) throw new Error('--now must be a valid ISO date/time');
  return options;
}

function defaultLedgerPath(root, commit) {
  return path.join(root, 'media/a11y/device-gate', shortCommit(commit), 'EVIDENCE.json');
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`device-gate: ${error.message}`);
    return EXIT.USAGE;
  }
  if (options.help) {
    console.log('usage: node scripts/device-gate.mjs --plan|--template|--check --commit=<full-sha> [--ledger <file>] [--json]');
    console.log('  --plan       print the fixed 20-row matrix for the commit');
    console.log('  --template   print a ledger skeleton (not evidence)');
    console.log('  --check      validate a completed ledger; 0 pass, 1 blocked, 3 missing');
    return EXIT.PASS;
  }
  if (!options.mode) {
    console.error('device-gate: choose --plan, --template or --check');
    return EXIT.USAGE;
  }
  if (!options.commit.trim()) {
    console.error('device-gate: --commit is required');
    return EXIT.USAGE;
  }

  if (options.mode === 'plan') {
    const plan = buildPlan(options.commit);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      console.log(`device-gate: plan — ${plan.rows.length} rows, ${plan.targets} targets, commit ${plan.shortCommit || plan.commit}`);
      for (const row of plan.rows) {
        console.log(`${row.id.padEnd(34)} ${row.script.padEnd(22)} ${row.viewports.join(',')}  ${row.criterion}`);
      }
    }
    return EXIT.PASS;
  }

  if (options.mode === 'template') {
    const template = buildTemplate(options.commit);
    process.stdout.write(`${JSON.stringify(template, null, 2)}\n`);
    return EXIT.PASS;
  }

  const ledgerPath = options.ledger
    ? path.resolve(options.root, options.ledger)
    : defaultLedgerPath(options.root, options.commit);
  let raw;
  try {
    raw = fs.readFileSync(ledgerPath, 'utf8');
  } catch {
    const message = `device-gate: LEDGER_MISSING — ${ledgerPath} (the real-device gate is not signed)`;
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ ok: false, status: 'blocked', code: 'LEDGER_MISSING', ledger: ledgerPath }, null, 2)}\n`);
    }
    console.error(message);
    return EXIT.LEDGER_MISSING;
  }

  let ledger;
  try {
    ledger = JSON.parse(raw);
  } catch (error) {
    console.error(`device-gate: LEDGER_INVALID — ${ledgerPath}: ${error.message}`);
    return EXIT.BLOCKED;
  }

  const report = evaluateLedger(ledger, {
    commit: options.commit,
    now: options.now,
    maxAgeDays: options.maxAgeDays,
    root: options.root,
  });
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(formatReport(report));
  if (!report.ok) {
    if (!options.json) {
      for (const finding of report.findings) {
        process.stderr.write(`device-gate: ${finding.code}${finding.row ? ` [${finding.row}]` : ''} — ${finding.message}\n`);
      }
    }
    return EXIT.BLOCKED;
  }
  return EXIT.PASS;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}
