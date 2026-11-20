#!/usr/bin/env node
/**
 * Repository SSOT checks:
 *  1. Every relative markdown link resolves to an existing file (no dangling doc links).
 *  2. docs/ISSUE_MAP.md and docs/issues.json agree on the issue-key index.
 *  3. The canonical version is consistent in package.json, index/icosahedron cache-bust
 *     query strings and the README version line.
 *
 * Zero dependencies. Run with `npm run docs:check`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checked = { files: 0, links: 0 };

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'media') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file) || '.';
}

const files = walk(root).filter((file) => !rel(file).startsWith('public/audio/'));
for (const file of files) {
  checked.files += 1;
  const text = fs.readFileSync(file, 'utf8');
  const linkRe = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = linkRe.exec(text))) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('http://') || raw.startsWith('https://')) {
      continue;
    }
    if (raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
    checked.links += 1;
    const target = raw.split('#')[0].split('?')[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) {
      failures.push(`${rel(file)}: dangling link -> ${raw}`);
    }
  }
}

// Issue index agreement.
const mapPath = path.join(root, 'docs/ISSUE_MAP.md');
const indexPath = path.join(root, 'docs/issues.json');
if (!fs.existsSync(mapPath)) {
  failures.push('docs/ISSUE_MAP.md is missing');
} else if (!fs.existsSync(indexPath)) {
  failures.push('docs/issues.json is missing');
} else {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const keys = (index.issues || []).map((issue) => issue.key);
  const map = fs.readFileSync(mapPath, 'utf8');
  for (const key of keys) {
    if (!new RegExp(`\\b${key}\\b`).test(map)) failures.push(`ISSUE_MAP.md does not mention ${key}`);
  }
  const mapped = [...map.matchAll(/\b([A-Z]{2,5}-\d{2})\b/g)].map((m) => m[1]);
  for (const key of new Set(mapped)) {
    if (!keys.includes(key)) failures.push(`ISSUE_MAP.md references unknown issue key ${key}`);
  }
  const expected = index.board;
  if (expected && !map.includes(expected)) failures.push('ISSUE_MAP.md does not link the board');
}

// Version consistency.
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
for (const page of ['public/index.html', 'public/icosahedron.html']) {
  const text = fs.readFileSync(path.join(root, page), 'utf8');
  const found = [...text.matchAll(/\?v=([0-9][^"'&\s]*)/g)].map((m) => m[1]);
  for (const value of found) {
    if (value !== version) failures.push(`${page}: cache-bust ?v=${value} != package.json ${version}`);
  }
}
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const readmeVersion = readme.match(/Version \*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*/);
if (readmeVersion && readmeVersion[1] !== version) {
  failures.push(`README.md version ${readmeVersion[1]} != package.json ${version}`);
}
const ssot = fs.readFileSync(path.join(root, 'docs/SSOT.md'), 'utf8');
if (!ssot.includes('projects/80')) failures.push('docs/SSOT.md does not link the delivery board');

if (failures.length) {
  console.error(`docs:check FAILED — ${failures.length} problem(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `docs:check OK — ${checked.files} markdown files, ${checked.links} local links, issue map and version consistent`
);
