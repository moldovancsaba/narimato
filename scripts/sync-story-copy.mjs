#!/usr/bin/env node
/**
 * NARIMATO — story copy doc synchroniser (STR-02).
 *
 * Renders the marked blocks of GUIDE.md, GAMEPLAY.md and public/index.html from
 * `public/js/story-copy.js` so the game and the documents can never disagree.
 * The generator is the only writer of a marked block; prose outside the markers
 * is hand-written and untouched.
 *
 * Usage:
 *   node scripts/sync-story-copy.mjs --check   compare, exit 0 clean | 1 drift | 2 internal
 *   node scripts/sync-story-copy.mjs --write   regenerate every marked block
 *   node scripts/sync-story-copy.mjs --json    machine-readable report
 *   node scripts/sync-story-copy.mjs --root <dir>
 *
 * Zero dependencies. Pure helpers are exported so tests avoid subprocesses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docBlocks, GUIDE_STEPS, HELP_SECTIONS } from '../public/js/story-copy.js';
import { NARRATION } from '../public/js/narrative-data.js';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
export const VOICE_ROOT = 'public/audio/voice';
export const MARKER_PREFIX = 'story-copy';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function markerStart(id) {
  return `<!-- ${MARKER_PREFIX}:start ${id} -->`;
}

export function markerEnd(id) {
  return `<!-- ${MARKER_PREFIX}:end ${id} -->`;
}

/** The canonical internal text of a block, including the surrounding newlines. */
export function expectedInner(content, indent = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  const indented = lines.map((line) => (line.length ? `${indent}${line}` : '')).join('\n');
  return `\n${indented}\n${indent}`;
}

/** Leading whitespace of a block's start marker, so markers can live inside Markdown lists. */
export function markerIndent(text, block) {
  const pattern = new RegExp(`^([ \\t]*)${escapeRegExp(markerStart(block.id))}`, 'm');
  const match = pattern.exec(normalise(text));
  return match ? match[1] : '';
}

function normalise(text) {
  return String(text).replace(/\r\n/g, '\n');
}

/** Every block the copy module can render, grouped by target file (insertion order preserved). */
export function blocksByFile(context = {}) {
  const grouped = new Map();
  for (const block of docBlocks(context)) {
    if (!grouped.has(block.file)) grouped.set(block.file, []);
    grouped.get(block.file).push(block);
  }
  return grouped;
}

/** Inspect one block marker section without writing. */
export function inspectBlock(text, block) {
  const source = normalise(text);
  const start = markerStart(block.id);
  const end = markerEnd(block.id);
  const startCount = source.split(start).length - 1;
  const endCount = source.split(end).length - 1;
  if (startCount === 0 || endCount === 0) {
    return { found: false, count: Math.max(startCount, endCount), actual: null, reason: 'MISSING_MARKER' };
  }
  const pattern = new RegExp(`${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`, 'g');
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    return { found: false, count: matches.length, actual: null, reason: 'DUPLICATE_MARKER' };
  }
  return { found: true, count: 1, actual: matches[0][1], reason: null, indent: markerIndent(source, block) };
}

/** Replace one block's inner content, preserving the surrounding prose. */
export function replaceBlock(text, block) {
  const start = markerStart(block.id);
  const end = markerEnd(block.id);
  const source = normalise(text);
  const indent = markerIndent(source, block);
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, 'g');
  return source.replace(pattern, `${start}${expectedInner(block.content, indent)}${end}`);
}

/** Compare every block against its marked section. Returns the report contract. */
export function checkCopy(root = DEFAULT_ROOT, context = {}) {
  const grouped = blocksByFile(context);
  const differences = [];
  let files = 0;
  let blocks = 0;
  for (const [file, fileBlocks] of grouped) {
    files += 1;
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      for (const block of fileBlocks) {
        differences.push({ id: block.id, file, reason: 'MISSING_FILE', expected: block.content, actual: null });
      }
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    for (const block of fileBlocks) {
      blocks += 1;
      const state = inspectBlock(text, block);
      const expected = expectedInner(block.content, state.indent || '');
      if (!state.found) {
        differences.push({ id: block.id, file, reason: state.reason, expected, actual: null });
      } else if (state.actual !== expected) {
        differences.push({ id: block.id, file, reason: 'STALE_BLOCK', expected, actual: state.actual });
      }
    }
  }
  const findings = orphanFindings(root);
  return { ok: differences.length === 0 && findings.length === 0, files, blocks, differences, findings };
}

/** Rewrite every marked block. Returns what changed. */
export function writeCopy(root = DEFAULT_ROOT, context = {}) {
  const grouped = blocksByFile(context);
  const written = [];
  let files = 0;
  for (const [file, fileBlocks] of grouped) {
    files += 1;
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      throw new Error(`${file} is missing; cannot write story copy`);
    }
    const before = fs.readFileSync(full, 'utf8');
    let next = before;
    for (const block of fileBlocks) {
      const state = inspectBlock(next, block);
      if (!state.found && state.reason === 'DUPLICATE_MARKER') {
        throw new Error(`${file}: block "${block.id}" has ${state.count} marker pairs`);
      }
      const replaced = replaceBlock(next, block);
      if (replaced !== next) written.push({ id: block.id, file });
      next = replaced;
    }
    if (next !== before) {
      fs.writeFileSync(full, next);
    }
  }
  return { ok: true, files, blocks: [...grouped.values()].reduce((sum, list) => sum + list.length, 0), written, findings: orphanFindings(root) };
}

/**
 * Structural checks that are not doc blocks:
 *  - every cue id the copy module references exists in the narration script;
 *  - every audio cue directory entry has a cue in the narration script.
 */
export function orphanFindings(root = DEFAULT_ROOT) {
  const findings = [];
  const knownCueIds = new Set(Object.keys(NARRATION));
  const referenced = new Set([...GUIDE_STEPS.map((step) => step.cueId), ...HELP_SECTIONS.map((section) => section.voiceId)]);
  for (const cueId of referenced) {
    if (!knownCueIds.has(cueId)) {
      findings.push({ code: 'MISSING_CUE', cueId, message: `copy references unknown narration cue "${cueId}"` });
    }
  }
  const voiceRoot = path.join(root, VOICE_ROOT);
  if (fs.existsSync(voiceRoot)) {
    const orphanCues = new Set();
    for (const entry of fs.readdirSync(voiceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const clip of fs.readdirSync(path.join(voiceRoot, entry.name))) {
        const match = /^(.+)__s\d+\.m4a$/.exec(clip);
        if (!match) continue;
        if (!knownCueIds.has(match[1])) orphanCues.add(match[1]);
      }
    }
    for (const cueId of [...orphanCues].sort()) {
      findings.push({ code: 'ORPHAN_CLIP', cueId, message: `audio exists for retired cue "${cueId}"` });
    }
  }
  return findings;
}

function parseArgs(argv) {
  const options = { mode: 'check', json: false, root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.mode = 'check';
    else if (arg === '--write') options.mode = 'write';
    else if (arg === '--json') options.json = true;
    else if (arg === '--root') {
      options.root = path.resolve(argv[index + 1] || DEFAULT_ROOT);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

export function runCopyCheck(mode = 'check', options = {}) {
  const root = options.root || DEFAULT_ROOT;
  if (mode === 'write') return writeCopy(root);
  return checkCopy(root);
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`copy:check — ${error.message}`);
    return 2;
  }
  try {
    const report = runCopyCheck(options.mode, options);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report.ok ? 0 : 1;
    }
    for (const difference of report.differences || []) {
      console.error(`${difference.file}: "${difference.id}" ${difference.reason}`);
    }
    for (const finding of report.findings || []) {
      console.error(`${finding.code}: ${finding.message}`);
    }
    if (options.mode === 'write') {
      console.error(`copy: wrote ${report.written.length} block(s) across ${report.files} file(s)`);
      return report.ok ? 0 : 1;
    }
    console.error(
      report.ok
        ? `copy: clean (${report.blocks} blocks, 0 differences)`
        : `copy: ${report.differences.length} difference(s), ${report.findings.length} finding(s)`
    );
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`copy:check INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}
