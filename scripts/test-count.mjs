#!/usr/bin/env node
/**
 * NARIMATO — generated test-count SSOT (issue QA-01).
 *
 * Markers in README.md and ARCHITECTURE.md:
 *   <!-- test-count:135 -->135<!-- /test-count -->
 *
 * Usage:
 *   node scripts/test-count.mjs                 run the suite, verify markers
 *   node scripts/test-count.mjs --log <file>    verify markers against a captured TAP log
 *   node scripts/test-count.mjs --print         run the suite and print counts JSON
 *   node scripts/test-count.mjs --json          verify and print the report JSON
 *   node scripts/test-count.mjs --root <dir>    explicit repository root
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

export const MARKERS = [
  { file: 'README.md', name: 'README' },
  { file: 'ARCHITECTURE.md', name: 'ARCHITECTURE' },
];
export const MARKER_RE = /<!-- test-count:(\d+) -->(\d+)<!-- \/test-count -->/;

/** Parse the node:test TAP summary into a TestCount, or null when no summary is present. */
export function parseLog(text) {
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

/** Read one marker's rendered value; returns {found, invalid}. */
export function readMarker(root, file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return { found: null, invalid: true, file };
  const text = fs.readFileSync(full, 'utf8');
  const match = MARKER_RE.exec(text);
  if (!match) return { found: null, invalid: true, file };
  return { found: Number(match[2]), declared: Number(match[1]), invalid: Number(match[2]) !== Number(match[1]), file };
}

/**
 * Verify counts against the documented markers. Returns a report:
 * { ok, counts, findings: [{code, file, ...}] }
 */
export function verifyCounts(root, counts) {
  const findings = [];
  if (!counts) findings.push({ code: 'NO_SUMMARY', detail: 'node:test summary not found' });
  else if (counts.fail > 0) findings.push({ code: 'TEST_FAILURE', value: counts.fail });
  else {
    for (const marker of MARKERS) {
      const state = readMarker(root, marker.file);
      if (state.invalid) {
        findings.push({ code: 'NO_MARKER', file: marker.file });
      } else if (state.found !== counts.tests) {
        findings.push({ code: 'STALE', file: marker.file, found: state.found, expected: counts.tests });
      }
    }
  }
  return { ok: findings.length === 0, counts, findings };
}

function testFiles(root) {
  return fs
    .readdirSync(path.join(root, 'test'))
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => path.join(root, 'test', name));
}

/** Run the suite in a child process and return the raw TAP text. */
export function runSuite(root) {
  const result = spawnSync(process.execPath, ['--test', ...testFiles(root)], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function parseArgs(argv) {
  const options = { mode: 'check', json: false, root: DEFAULT_ROOT, log: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--print') options.mode = 'print';
    else if (arg === '--json') options.json = true;
    else if (arg === '--log') {
      options.log = argv[index + 1];
      if (!options.log) throw new Error('--log requires a file');
      index += 1;
    } else if (arg === '--root') {
      options.root = path.resolve(argv[index + 1] || DEFAULT_ROOT);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`test:count — ${error.message}`);
    return 2;
  }
  try {
    const text = options.log ? fs.readFileSync(options.log, 'utf8') : runSuite(options.root);
    const counts = parseLog(text);
    if (!counts) {
      console.error('test:count — node:test summary not found (NO_SUMMARY)');
      return 1;
    }
    if (options.mode === 'print') {
      process.stdout.write(`${JSON.stringify(counts)}\n`);
      return counts.fail > 0 ? 1 : 0;
    }
    const report = verifyCounts(options.root, counts);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const finding of report.findings) {
        if (finding.code === 'STALE') {
          console.error(`${finding.file}: marker ${finding.found} != executed suite ${finding.expected}`);
        } else if (finding.code === 'NO_MARKER') {
          console.error(`${finding.file}: no <!-- test-count:N --> marker`);
        } else if (finding.code === 'TEST_FAILURE') {
          console.error(`suite has ${finding.value} failing test(s)`);
        } else {
          console.error(finding.detail);
        }
      }
      console.error(
        report.ok ? `test:count OK — ${counts.tests} tests (${counts.pass} pass, ${counts.fail} fail)` : 'test:count FAILED'
      );
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`test:count INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}
