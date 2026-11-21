import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkLedger,
  formatFindings,
  parseClaimTables,
  parseEvidence,
  validateClaims,
} from '../lib/claim-ledger.js';

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-ledger-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.mkdirSync(path.join(root, 'media'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/ISSUE_MAP.md'), '| [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |\n');
  fs.writeFileSync(path.join(root, 'test/world.test.js'), '// evidence\n');
  fs.writeFileSync(path.join(root, 'media/run.png'), 'png\n');
  fs.writeFileSync(path.join(root, 'scripts.mjs'), '// script\n');
  return root;
}

function table(rows) {
  return ['| Claim | Status | Evidence | Note |', '|---|---|---|---|', ...rows].join('\n');
}

test('parseClaimTables accepts Claim/Capability headers and typed evidence', () => {
  const markdown = [
    '| Capability | Status | Evidence | Note |',
    '|---|---|---|---|',
    '| Two-client surface | LIVE | `test:test/world.test.js`, `script:scripts.mjs` | proof |',
    '| Edge delivery | PLANNED | `issue:#13` | credentials absent |',
  ].join('\n');
  const claims = parseClaimTables(markdown, 'README.md');
  assert.equal(claims.length, 2);
  assert.equal(claims[0].status, 'LIVE');
  assert.deepEqual(claims[0].evidence.map((ref) => ref.kind), ['test', 'script']);
  assert.equal(claims[0].line, 3);
});

test('parseEvidence handles empty and unknown references', () => {
  assert.deepEqual(parseEvidence('—'), []);
  assert.equal(parseEvidence('commit:abc1234')[0].kind, 'commit');
  assert.equal(parseEvidence('nonsense')[0].kind, 'unknown');
});

test('a valid ledger has full evidenced LIVE coverage', () => {
  const root = tempRoot();
  const result = checkLedger({
    files: [
      {
        file: 'README.md',
        text: table([
          '| World authority | LIVE | `test:test/world.test.js` | server-owned |',
          '| Device gate | PLANNED | `issue:#13` | future work |',
          '| Soak | PARTIAL | `issue:#13` | 120 min run remains |',
        ]),
      },
    ],
    root,
    checkGit: false,
  });
  assert.equal(result.ok, true, formatFindings(result.findings));
  assert.equal(result.summary.byStatus.LIVE, 1);
  assert.equal(result.summary.evidencedCoverage, 1);
});

test('invalid status and LIVE without evidence exit 1 and 2', () => {
  const root = tempRoot();
  const invalid = checkLedger({
    files: [{ file: 'README.md', text: table(['| Thing | SHIPPED | `test:test/world.test.js` | now |']) }],
    root,
    checkGit: false,
  });
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.findings[0].code, 'INVALID_STATUS');

  const noEvidence = checkLedger({
    files: [{ file: 'README.md', text: table(['| Thing | LIVE | — | now |']) }],
    root,
    checkGit: false,
  });
  assert.equal(noEvidence.exitCode, 2);
  assert.equal(noEvidence.findings[0].code, 'LIVE_NO_EVIDENCE');
});

test('planned material described with a shipping verb exits 4', () => {
  const root = tempRoot();
  const result = checkLedger({
    files: [{ file: 'README.md', text: table(['| Edge CDN | PLANNED | `issue:#13` | ships through the edge now |']) }],
    root,
    checkGit: false,
  });
  assert.equal(result.exitCode, 4);
  assert.equal(result.findings[0].code, 'PLANNED_AS_LIVE');
});

test('a broken relative link exits 3 and an unresolved evidence path exits 2', () => {
  const root = tempRoot();
  const brokenLink = checkLedger({
    files: [{ file: 'README.md', text: table(['| Thing | LIVE | `test:test/world.test.js` | see [missing](media/nope.png) |']) }],
    root,
    checkGit: false,
  });
  assert.equal(brokenLink.exitCode, 3);
  assert.equal(brokenLink.findings[0].code, 'BROKEN_LINK');

  const unresolved = checkLedger({
    files: [{ file: 'README.md', text: table(['| Thing | LIVE | `test:test/absent.test.js` | proof |']) }],
    root,
    checkGit: false,
  });
  assert.equal(unresolved.exitCode, 2);
  assert.equal(unresolved.findings[0].code, 'UNRESOLVED_EVIDENCE');
});

test('the highest-severity exit code wins when classes are mixed', () => {
  const root = tempRoot();
  const result = validateClaims({
    claims: [
      { file: 'README.md', line: 1, text: 'Edge', status: 'PLANNED', statusText: 'PLANNED', evidence: [], note: 'ships' },
      { file: 'README.md', line: 2, text: 'Thing', status: null, statusText: 'NOPE', evidence: [], note: '' },
    ],
    root,
    checkGit: false,
  });
  assert.equal(result.exitCode, 4);
});

test('checkLedger reports file:line for every violation', () => {
  const root = tempRoot();
  const result = checkLedger({
    files: [{ file: 'README.md', text: table(['| Thing | LIVE | `test:test/absent.test.js` | proof |']) }],
    root,
    checkGit: false,
  });
  const lines = formatFindings(result.findings);
  assert.match(lines, /^README\.md:3 \[UNRESOLVED_EVIDENCE\]/);
});
