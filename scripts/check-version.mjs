#!/usr/bin/env node
/**
 * NARIMATO — version SSOT checker (issue SSOT-03).
 *
 * One declaration (`package.json.version`) drives every app-lineage slot; the audio
 * lineage is declared once by the generated `AUDIO_VERSION` in
 * `public/js/audio-version.js` (package version + content hash) and validated
 * separately. Zero dependencies.
 *
 * Usage:
 *   node scripts/check-version.mjs              check, exit 0 | 1 | 2
 *   node scripts/check-version.mjs --json       report JSON on stdout
 *   node scripts/check-version.mjs --fix        rewrite stale slots to the declarations
 *   node scripts/check-version.mjs --bump 3.58.0  bump package.json, then fix
 *   node scripts/check-version.mjs --root <dir>  explicit repository root
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Slots owned by the app lineage. `g`-flagged patterns make duplicate detection possible. */
export const APP_SLOTS = [
  {
    file: 'public/index.html',
    label: 'stylesheet cache-bust',
    pattern: /(\/css\/cyberpunk\.css\?v=)(\d+\.\d+\.\d+)/g,
    template: '$1__VERSION__',
  },
  {
    file: 'public/index.html',
    label: 'app entry cache-bust',
    pattern: /(\/js\/app\.js\?v=)(\d+\.\d+\.\d+)/g,
    template: '$1__VERSION__',
  },
  {
    file: 'public/index.html',
    label: 'visible version label',
    pattern: /(v)(\d+\.\d+\.\d+)( \/\/ THE WAY BACK)/g,
    template: '$1__VERSION__$3',
  },
  {
    file: 'public/icosahedron.html',
    label: 'viewer cache-bust',
    pattern: /(\/js\/icosahedron-viewer\.js\?v=)(\d+\.\d+\.\d+)/g,
    template: '$1__VERSION__',
  },
  {
    file: 'README.md',
    label: 'README status line',
    pattern: /(Version \*\*)(\d+\.\d+\.\d+)(\*\*)/g,
    template: '$1__VERSION__$3',
  },
];

/** Slots owned by the audio lineage; the narrator declaration is the source of truth. */
export const AUDIO_DECLARATION = {
  file: 'public/js/audio-version.js',
  pattern: /(export const AUDIO_VERSION = ')([^']+)(')/g,
};
export const AUDIO_SLOTS = [
  {
    file: 'VOICE.md',
    label: 'voice documentation example',
    pattern: /(\?v=)(\d+\.\d+\.\d+\+[0-9a-f]{8})/g,
    template: '$1__VERSION__',
    optional: true,
  },
  {
    file: 'EDGE_DEPLOYMENT.md',
    label: 'edge deployment example',
    pattern: /(\?v=)(\d+\.\d+\.\d+\+[0-9a-f]{8})/g,
    template: '$1__VERSION__',
    optional: true,
  },
];

function readText(root, file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

export function readDeclaration(root) {
  const text = readText(root, 'package.json');
  if (text === null) throw new Error('package.json is missing');
  const version = JSON.parse(text).version;
  if (!semverPattern.test(version)) throw new Error(`package.json version is not semver: ${version}`);
  return version;
}

export function readAudioDeclaration(root) {
  const text = readText(root, AUDIO_DECLARATION.file);
  if (text === null) throw new Error(`${AUDIO_DECLARATION.file} is missing`);
  const matches = [...text.matchAll(AUDIO_DECLARATION.pattern)];
  if (matches.length !== 1) throw new Error(`AUDIO_VERSION must appear exactly once, found ${matches.length}`);
  return matches[0][2];
}

/** Count, validate and compare one slot without writing. */
export function inspectSlot(root, slot, expected) {
  const text = readText(root, slot.file);
  if (text === null) {
    if (slot.optional) return { slot, found: null, ok: true, optional: true };
    return { slot, found: null, ok: false, error: 'MISSING_FILE' };
  }
  const matches = [...text.matchAll(slot.pattern)];
  if (matches.length !== 1) {
    return { slot, found: null, ok: false, error: matches.length === 0 ? 'MISSING_SLOT' : 'AMBIGUOUS_SLOT', count: matches.length };
  }
  const found = matches[0][2];
  return { slot, found, ok: found === expected, error: found === expected ? null : 'STALE' };
}

/** Compare two SemVer strings; returns -1, 0 or 1. Pre-release sorts before the release. */
export function compareSemver(a, b) {
  if (!semverPattern.test(a)) throw new Error(`invalid semver: ${a}`);
  if (!semverPattern.test(b)) throw new Error(`invalid semver: ${b}`);
  const split = (value) => {
    const [core, pre] = value.split('-');
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

/** Inspect the whole inventory without writing. */
export function scanVersion(root = DEFAULT_ROOT) {
  const declaration = readDeclaration(root);
  const audioDeclaration = readAudioDeclaration(root);
  const results = [
    ...APP_SLOTS.map((slot) => inspectSlot(root, slot, declaration)),
    ...AUDIO_SLOTS.map((slot) => inspectSlot(root, slot, audioDeclaration)),
  ];
  return { ok: results.every((result) => result.ok), declaration, audioDeclaration, slots: results.length, results };
}

/** Rewrite stale slots. Refuses to write when any slot is missing or ambiguous. */
export function fixVersion(root = DEFAULT_ROOT) {
  const declaration = readDeclaration(root);
  const audioDeclaration = readAudioDeclaration(root);
  const results = [
    ...APP_SLOTS.map((slot) => inspectSlot(root, slot, declaration)),
    ...AUDIO_SLOTS.map((slot) => inspectSlot(root, slot, audioDeclaration)),
  ];
  const blockers = results.filter((result) => !result.ok && result.error !== 'STALE');
  if (blockers.length) {
    return { ok: false, fixed: [], blockers: blockers.map((b) => ({ file: b.slot.file, label: b.slot.label, error: b.error })) };
  }
  const fixed = [];
  const writes = new Map();
  for (const result of results) {
    if (result.ok) continue;
    const expected = APP_SLOTS.includes(result.slot) ? declaration : audioDeclaration;
    const current = writes.get(result.slot.file) ?? readText(root, result.slot.file);
    const next = current.replace(result.slot.pattern, result.slot.template.replaceAll('__VERSION__', expected));
    writes.set(result.slot.file, next);
    fixed.push({ file: result.slot.file, label: result.slot.label, from: result.found, to: expected });
  }
  for (const [file, text] of writes) fs.writeFileSync(path.join(root, file), text);
  return { ok: true, fixed, blockers: [] };
}

/** Set `package.json.version` to a strictly newer SemVer, then fix slots. */
export function bumpVersion(next, root = DEFAULT_ROOT) {
  const declaration = readDeclaration(root);
  if (!semverPattern.test(next)) throw new Error(`invalid semver: ${next}`);
  if (compareSemver(next, declaration) <= 0) {
    throw new Error(`refusing downgrade or no-op: ${next} <= ${declaration}`);
  }
  const file = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.version = next;
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  const fixed = fixVersion(root);
  return { ok: fixed.ok, declaration: next, fixed: fixed.fixed, blockers: fixed.blockers };
}

function parseArgs(argv) {
  const options = { mode: 'check', json: false, root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--fix') options.mode = 'fix';
    else if (arg === '--bump') {
      options.mode = 'bump';
      options.next = argv[index + 1];
      if (!options.next) throw new Error('--bump requires a version');
      index += 1;
    } else if (arg === '--root') {
      options.root = path.resolve(argv[index + 1] || DEFAULT_ROOT);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

export function runVersionCheck(mode, options = {}) {
  const root = options.root || DEFAULT_ROOT;
  if (mode === 'bump') return bumpVersion(options.next, root);
  if (mode === 'fix') return fixVersion(root);
  const report = scanVersion(root);
  return {
    ok: report.ok,
    declaration: report.declaration,
    audioDeclaration: report.audioDeclaration,
    slots: report.slots,
    stale: report.results
      .filter((result) => !result.ok)
      .map((result) => ({ file: result.slot.file, label: result.slot.label, error: result.error, found: result.found, expected: APP_SLOTS.includes(result.slot) ? report.declaration : report.audioDeclaration })),
  };
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`check:version — ${error.message}`);
    return 2;
  }
  try {
    if (options.mode === 'bump') {
      const result = bumpVersion(options.next, options.root);
      if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else {
        for (const item of result.fixed) console.error(`${item.file}: ${item.label} ${item.from} -> ${item.to}`);
        console.error(result.ok ? `check:version bumped to ${result.declaration}` : 'check:version bump blocked');
      }
      return result.ok ? 0 : 1;
    }
    if (options.mode === 'fix') {
      const result = fixVersion(options.root);
      if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else {
        for (const item of result.fixed) console.error(`${item.file}: ${item.label} ${item.from} -> ${item.to}`);
        for (const blocker of result.blockers) console.error(`${blocker.file}: ${blocker.label} -> ${blocker.error}`);
        console.error(result.ok ? `check:version fixed ${result.fixed.length} slot(s)` : 'check:version fix blocked');
      }
      return result.ok ? 0 : 1;
    }
    const report = runVersionCheck('check', options);
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      for (const stale of report.stale) {
        console.error(`${stale.file}: ${stale.label} [${stale.error}] found ${stale.found ?? '-'} expected ${stale.expected}`);
      }
      console.error(
        report.ok
          ? `check:version OK — ${report.slots} slots, app ${report.declaration}, audio ${report.audioDeclaration}`
          : `check:version FAILED — ${report.stale.length} stale/unresolved slot(s)`
      );
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`check:version INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}
