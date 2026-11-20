#!/usr/bin/env node
/**
 * NARIMATO — repository SSOT quality gate (issue SSOT-02).
 *
 * Rules:
 *   R1  relative link resolves to an existing file with exact path case
 *   R2  link anchor exists in the target markdown document
 *   R3  no local absolute path (/Users/, file://) leaks into documentation
 *   R4  issue keys match the canonical pattern and exist in docs/ISSUE_MAP.md
 *   R5  no unresolved placeholder token (TODO/TBD/FIXME/PLACEHOLDER/<sha>-style)
 *   R6  issue forms, ISSUE_TEMPLATE/config.yml and the PR template exist and are non-empty
 *
 * Usage:
 *   node scripts/check-docs.mjs             human summary on stderr, exit 0 | 1 | 2
 *   node scripts/check-docs.mjs --json      Report JSON on stdout, exit 0 | 1 | 2
 *   node scripts/check-docs.mjs --root .    explicit repository root
 *
 * Zero dependencies. The pure helpers are exported so tests avoid spawning a process.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const KEY_RE = /\b([A-Z][A-Z0-9]{1,4}-[0-9]{2,3})\b/g;
const PLACEHOLDER_RE = /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b|<(?:sha|commit|path|insert[^>]*)>|\bXXXX+\b/;
const REQUIRED_TEMPLATES = [
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
];
const ISSUE_MAP = 'docs/ISSUE_MAP.md';

/** Strip inline code spans so links and keys inside them are not parsed. */
export function stripInlineCode(line) {
  return line.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length));
}

/** Extract inline markdown links from a document, ignoring fenced code blocks. */
export function extractLinks(markdown) {
  const links = [];
  let inFence = false;
  const lines = String(markdown).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const text = stripInlineCode(line);
    LINK_RE.lastIndex = 0;
    let match;
    while ((match = LINK_RE.exec(text))) {
      links.push({ line: index + 1, text: match[1], target: match[2] });
    }
  }
  return links;
}

/** GitHub-style heading anchors: lowercase, punctuation stripped, spaces to hyphens, duplicates suffixed. */
export function slugifyHeadings(markdown) {
  const anchors = new Set();
  const seen = new Map();
  let inFence = false;
  for (const raw of String(markdown).split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    let slug = heading[2]
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    if (!slug) continue;
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    anchors.add(slug);
  }
  return anchors;
}

function isExternal(target) {
  return /^(?:https?:|mailto:|tel:|#)/.test(target);
}

/** Resolve a relative link target to a repo-relative path, or null when it escapes. */
function resolveTarget(fromFile, target) {
  const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
  if (!clean) return null;
  const absolute = path.resolve(path.dirname(path.join('/', fromFile)), clean).replace(/^\/+/, '');
  return absolute;
}

function existsExactCase(root, relativePath) {
  const parts = relativePath.split('/').filter((part) => part && part !== '.');
  let current = root;
  for (const part of parts) {
    if (part === '..') return false;
    let entries;
    try {
      entries = fs.readdirSync(current);
    } catch {
      return false;
    }
    if (!entries.includes(part)) return false;
    current = path.join(current, part);
  }
  return fs.existsSync(current);
}

/** Collect every markdown file under the root (excluding generated/media/node_modules trees). */
export function listMarkdownFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'media', 'data', 'coverage'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Check one document. `issueKeys` is the set of keys declared by docs/ISSUE_MAP.md.
 * Returns the findings for the file; line numbers are 1-based.
 */
export function checkDocument({ file, text, root, issueKeys = new Set() }) {
  const findings = [];
  const add = (rule, line, target, message) => {
    findings.push({ rule, file, line, target, message });
  };

  for (const link of extractLinks(text)) {
    const { target, line } = link;
    if (isExternal(target)) continue;
    if (/^file:/.test(target) || /\/Users\/|\\Users\\/.test(target)) {
      add('R3', line, target, 'local absolute path must not be linked from documentation');
      continue;
    }
    const resolved = resolveTarget(file, target);
    if (!resolved) continue;
    if (!existsExactCase(root, resolved)) {
      add('R1', line, target, 'link target does not exist (case-sensitive)');
      continue;
    }
    const anchor = target.split('#')[1];
    if (!anchor) continue;
    if (!resolved.endsWith('.md')) continue;
    const targetText = fs.readFileSync(path.join(root, resolved), 'utf8');
    const anchors = slugifyHeadings(targetText);
    if (!anchors.has(anchor.toLowerCase())) {
      add('R2', line, target, 'anchor not found in target document');
    }
  }

  if (PLACEHOLDER_RE.test(text)) {
    const lines = String(text).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (PLACEHOLDER_RE.test(stripInlineCode(line))) {
        add('R5', index + 1, '', 'unresolved placeholder token');
      }
    });
  }

  if (issueKeys.size) {
    const lines = String(text).split(/\r?\n/);
    lines.forEach((line, index) => {
      KEY_RE.lastIndex = 0;
      const text2 = stripInlineCode(line);
      let match;
      while ((match = KEY_RE.exec(text2))) {
        if (!issueKeys.has(match[1])) {
          add('R4', index + 1, match[1], 'issue key not present in docs/ISSUE_MAP.md');
        }
      }
    });
  }

  return findings;
}

/** R6: required forms/templates exist and are non-empty. */
export function checkTemplates(root) {
  const findings = [];
  for (const file of REQUIRED_TEMPLATES) {
    const full = path.join(root, file);
    if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
      findings.push({ rule: 'R6', file, line: 0, target: file, message: 'required template is missing or empty' });
    }
  }
  const formsDir = path.join(root, '.github/ISSUE_TEMPLATE');
  const forms = fs.existsSync(formsDir)
    ? fs.readdirSync(formsDir).filter((name) => name.endsWith('.yml') && name !== 'config.yml')
    : [];
  if (!forms.length) {
    findings.push({
      rule: 'R6',
      file: '.github/ISSUE_TEMPLATE',
      line: 0,
      target: '.github/ISSUE_TEMPLATE',
      message: 'no issue form found',
    });
  }
  return findings;
}

/** Read the declared issue keys from docs/ISSUE_MAP.md. */
export function readIssueKeys(root) {
  const mapFile = path.join(root, ISSUE_MAP);
  if (!fs.existsSync(mapFile)) return { keys: new Set(), missing: true };
  const keys = new Set(String(fs.readFileSync(mapFile, 'utf8')).match(KEY_RE) || []);
  return { keys, missing: false };
}

/** Run all rules. Pure except for filesystem reads; returns the contract `Report`. */
export function runCheck(root = DEFAULT_ROOT) {
  const files = listMarkdownFiles(root);
  const { keys, missing } = readIssueKeys(root);
  const findings = [];
  let links = 0;
  for (const absolute of files) {
    const file = path.relative(root, absolute).split(path.sep).join('/');
    const text = fs.readFileSync(absolute, 'utf8');
    links += extractLinks(text).length;
    findings.push(...checkDocument({ file, text, root, issueKeys: keys }));
  }
  findings.push(...checkTemplates(root));
  if (missing) {
    findings.push({
      rule: 'R4',
      file: ISSUE_MAP,
      line: 0,
      target: ISSUE_MAP,
      message: 'issue map is missing, so issue keys cannot be validated',
    });
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule) || a.target.localeCompare(b.target));
  return { ok: findings.length === 0, files: files.length, links, findings };
}

function parseArgs(argv) {
  const options = { json: false, root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--root') options.root = path.resolve(argv[index + 1] || DEFAULT_ROOT);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`docs:check — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.error('usage: node scripts/check-docs.mjs [--json] [--root <dir>]');
    return 2;
  }
  try {
    const report = runCheck(options.root);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const finding of report.findings) {
        const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
        console.error(`${location} [${finding.rule}] ${finding.target || '-'} -> ${finding.message}`);
      }
      console.error(
        report.ok
          ? `docs:check OK — ${report.files} markdown files, ${report.links} links, 0 findings`
          : `docs:check FAILED — ${report.files} markdown files, ${report.links} links, ${report.findings.length} finding(s)`
      );
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`docs:check INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}
