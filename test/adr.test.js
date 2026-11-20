import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADR_DIR = path.join(REPO_ROOT, 'docs/adr');
const ACCEPTED_STATUS = new Set(['Proposed', 'Accepted', 'Superseded', 'Rejected']);
const KEY_RE = /\b[A-Z][A-Z0-9]{1,4}-[0-9]{2,3}\b/g;
const NUMBER_RE = /^(\d{4})-[a-z0-9-]+\.md$/;

/** Parse an ADR document into its metadata and section headings. */
export function parseAdr(file, text) {
  const name = path.basename(file);
  const numberMatch = NUMBER_RE.exec(name);
  if (!numberMatch) return { error: 'BAD_FILENAME' };
  const number = numberMatch[1];
  const titleMatch = /^#\s+(ADR-\d{4}):\s+(.+)$/m.exec(text);
  if (!titleMatch) return { error: 'NO_TITLE' };
  const read = (field) => {
    const match = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(text);
    return match ? match[1].trim() : null;
  };
  const keys = (read('keys') || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  return {
    file,
    name,
    number,
    id: titleMatch[1],
    title: titleMatch[2].trim(),
    status: read('status'),
    date: read('date'),
    supersedes: read('supersedes'),
    supersededBy: read('superseded_by'),
    keys,
    sections: [...text.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim()),
  };
}

/** Validate parsed ADRs plus index coverage and key existence. Returns a list of problems. */
export function validateAdrs(adrs, { indexRows = [], issueKeys = new Set() } = {}) {
  const problems = [];
  const numbers = new Set();
  for (const adr of adrs) {
    if (adr.error) {
      problems.push(`${adr.file}: ${adr.error}`);
      continue;
    }
    if (adr.id !== `ADR-${adr.number}`) problems.push(`${adr.file}: id ${adr.id} != ADR-${adr.number}`);
    if (!ACCEPTED_STATUS.has(adr.status)) problems.push(`${adr.file}: invalid status ${adr.status}`);
    if (!adr.date || !/^\d{4}-\d{2}-\d{2}$/.test(adr.date)) problems.push(`${adr.file}: invalid date ${adr.date}`);
    if (adr.status === 'Superseded' && (!adr.supersededBy || adr.supersededBy === 'none')) {
      problems.push(`${adr.file}: Superseded requires superseded_by`);
    }
    if (adr.status === 'Accepted' && adr.keys.length === 0) problems.push(`${adr.file}: Accepted requires keys`);
    if (adr.status === 'Accepted' && adr.supersededBy && adr.supersededBy !== 'none') {
      problems.push(`${adr.file}: Accepted cannot be superseded`);
    }
    for (const key of adr.keys) {
      if (!issueKeys.has(key)) problems.push(`${adr.file}: key ${key} is not in docs/ISSUE_MAP.md`);
    }
    for (const section of ['Context', 'Decision', 'Consequences', 'Alternatives considered', 'Links']) {
      if (!adr.sections.includes(section)) problems.push(`${adr.file}: missing section ${section}`);
    }
    if (numbers.has(adr.number)) problems.push(`${adr.file}: duplicate number ${adr.number}`);
    numbers.add(adr.number);
  }
  const indexNumbers = indexRows.map((row) => row.number);
  for (const adr of adrs) {
    if (adr.error) continue;
    if (!indexNumbers.includes(adr.number)) problems.push(`${adr.file}: missing from docs/adr/README.md index`);
  }
  const ordered = [...indexNumbers].sort();
  if (JSON.stringify(indexNumbers) !== JSON.stringify(ordered)) {
    problems.push('docs/adr/README.md index is not in number order');
  }
  for (const number of new Set(indexNumbers)) {
    if (indexNumbers.filter((value) => value === number).length > 1) problems.push(`index: duplicate row ${number}`);
  }
  return problems;
}

function parseIndexRows(readme) {
  return [...readme.matchAll(/^\|\s*\[(\d{4})\]\(([^)]+)\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|$/gm)].map(
    (match) => ({
      number: match[1],
      target: match[2].trim(),
      title: match[3].trim(),
      status: match[4].trim(),
      keys: match[5].trim(),
    })
  );
}

function loadRepoAdrs() {
  const files = fs
    .readdirSync(ADR_DIR)
    .filter((name) => NUMBER_RE.test(name))
    .sort();
  return files.map((name) => parseAdr(name, fs.readFileSync(path.join(ADR_DIR, name), 'utf8')));
}

function repoIssueKeys() {
  const map = fs.readFileSync(path.join(REPO_ROOT, 'docs/ISSUE_MAP.md'), 'utf8');
  return new Set(map.match(KEY_RE) || []);
}

function fixtureDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-adr-'));
  fs.mkdirSync(path.join(dir, 'docs/adr'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'docs/adr/README.md'),
    ['# Index', '', '| Number | Title | Status | Keys |', '|---|---|---|---|', ...files.map((file) => file.indexRow)].join('\n')
  );
  for (const file of files) fs.writeFileSync(path.join(dir, 'docs/adr', file.name), file.text);
  return dir;
}

test('the repository ADR set is valid and indexed', () => {
  const adrs = loadRepoAdrs();
  assert.equal(adrs.length, 6);
  const rows = parseIndexRows(fs.readFileSync(path.join(ADR_DIR, 'README.md'), 'utf8'));
  const problems = validateAdrs(adrs, { indexRows: rows, issueKeys: repoIssueKeys() });
  assert.deepEqual(problems, []);
});

test('validateAdrs catches id/filename mismatch, bad status and missing keys', () => {
  const text = [
    '# ADR-0007: Example decision',
    '',
    'status: Accepted',
    'date: 2026-11-20',
    'supersedes: none',
    'superseded_by: none',
    'keys: SSOT-01',
    '',
    '## Context',
    '## Decision',
    '## Consequences',
    '## Alternatives considered',
    '## Links',
  ].join('\n');
  const mismatched = parseAdr('0007-example.md', text.replace('ADR-0007', 'ADR-0008'));
  const problems = validateAdrs([mismatched], {
    indexRows: [{ number: '0007' }],
    issueKeys: new Set(['SSOT-01']),
  });
  assert.ok(problems.some((problem) => problem.includes('id ADR-0008')));
  const badStatus = parseAdr('0007-example.md', text.replace('status: Accepted', 'status: Maybe'));
  assert.ok(validateAdrs([badStatus], { indexRows: [{ number: '0007' }], issueKeys: new Set(['SSOT-01']) }).some((p) => p.includes('invalid status')));
  const missingKey = parseAdr('0007-example.md', text);
  assert.ok(
    validateAdrs([missingKey], { indexRows: [{ number: '0007' }], issueKeys: new Set() }).some((p) =>
      p.includes('key SSOT-01')
    )
  );
});

test('validateAdrs enforces superseded_by, duplicate numbers and index coverage', () => {
  const base = (id, number, status, extra = '') =>
    [
      `# ADR-${id}: decision ${id}`,
      '',
      `status: ${status}`,
      'date: 2026-11-20',
      'supersedes: none',
      'superseded_by: none',
      `keys: SSOT-01`,
      extra,
      '## Context',
      '## Decision',
      '## Consequences',
      '## Alternatives considered',
      '## Links',
    ].join('\n');
  const superseded = parseAdr('0008-decision.md', base('0008', '0008', 'Superseded'));
  assert.ok(
    validateAdrs([superseded], { indexRows: [{ number: '0008' }], issueKeys: new Set(['SSOT-01']) }).some((p) =>
      p.includes('Superseded requires')
    )
  );
  const first = parseAdr('0009-one.md', base('0009', '0009', 'Accepted'));
  const second = parseAdr('0009-two.md', base('0009', '0009', 'Accepted'));
  const problems = validateAdrs([first, second], { indexRows: [{ number: '0009' }], issueKeys: new Set(['SSOT-01']) });
  assert.ok(problems.some((problem) => problem.includes('duplicate number')));
  const uncovered = validateAdrs([first], { indexRows: [], issueKeys: new Set(['SSOT-01']) });
  assert.ok(uncovered.some((problem) => problem.includes('missing from docs/adr/README.md')));
});

test('fixture root with an invalid ADR index fails validation', () => {
  const dir = fixtureDir([
    {
      name: '0010-wrong-title.md',
      text: [
        '# ADR-0011: Wrong',
        'status: Accepted',
        'date: 2026-11-20',
        'supersedes: none',
        'superseded_by: none',
        'keys: SSOT-01',
        '## Context',
        '## Decision',
        '## Consequences',
        '## Alternatives considered',
        '## Links',
      ].join('\n'),
      indexRow: '| [0010](0010-wrong-title.md) | Wrong | Accepted | SSOT-01 |',
    },
  ]);
  const adr = parseAdr('0010-wrong-title.md', fs.readFileSync(path.join(dir, 'docs/adr/0010-wrong-title.md'), 'utf8'));
  assert.ok(validateAdrs([adr], { indexRows: [{ number: '0010' }], issueKeys: new Set(['SSOT-01']) }).length > 0);
});
