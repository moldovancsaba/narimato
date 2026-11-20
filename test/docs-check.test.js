import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  extractLinks,
  slugifyHeadings,
  checkDocument,
  checkTemplates,
  readIssueKeys,
  runCheck,
} from '../scripts/check-docs.mjs';

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-docs-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, '.github/ISSUE_TEMPLATE'), { recursive: true });
  return root;
}

function write(root, file, text) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

test('extractLinks skips fences and inline code and keeps line numbers', () => {
  const markdown = [
    'intro [ok](ARCHITECTURE.md) end',
    '```md',
    '[ignored](missing.md)',
    '```',
    'inline `[also ignored](nope.md)` text',
    '[titled](GUIDE.md "title")',
  ].join('\n');
  const links = extractLinks(markdown);
  assert.deepEqual(
    links.map((link) => [link.line, link.target]),
    [
      [1, 'ARCHITECTURE.md'],
      [6, 'GUIDE.md'],
    ]
  );
});

test('slugifyHeadings lowercases, strips punctuation and suffixes duplicates', () => {
  const anchors = slugifyHeadings(['# Stack', '## Configuration!', '## Configuration!', '### A/B (test)'].join('\n'));
  assert.ok(anchors.has('stack'));
  assert.ok(anchors.has('configuration'));
  assert.ok(anchors.has('configuration-1'));
  assert.ok(anchors.has('ab-test'));
});

test('checkDocument reports R1 for a missing or case-mismatched link', () => {
  const root = fixtureRoot();
  write(root, 'Real.md', '# Real');
  const missing = checkDocument({ file: 'README.md', text: '[x](Missing.md)', root });
  assert.equal(missing[0].rule, 'R1');
  const caseMismatch = checkDocument({ file: 'README.md', text: '[x](real.md)', root });
  assert.equal(caseMismatch[0].rule, 'R1');
  const ok = checkDocument({ file: 'README.md', text: '[x](Real.md)', root });
  assert.equal(ok.length, 0);
});

test('checkDocument reports R2 when an anchor does not exist', () => {
  const root = fixtureRoot();
  write(root, 'Target.md', '# Configuration settings');
  const findings = checkDocument({ file: 'README.md', text: '[x](Target.md#configuration)', root });
  assert.equal(findings[0].rule, 'R2');
  const ok = checkDocument({ file: 'README.md', text: '[x](Target.md#configuration-settings)', root });
  assert.equal(ok.length, 0);
});

test('checkDocument reports R3 for local absolute paths', () => {
  const root = fixtureRoot();
  const findings = checkDocument({ file: 'README.md', text: '[x](/Users/someone/secret.md)', root });
  assert.equal(findings[0].rule, 'R3');
  const fileUrl = checkDocument({ file: 'README.md', text: '[x](file:///etc/passwd)', root });
  assert.equal(fileUrl[0].rule, 'R3');
});

test('checkDocument reports R4 for unknown issue keys and accepts mapped keys', () => {
  const root = fixtureRoot();
  const findings = checkDocument({
    file: 'README.md',
    text: 'Tracking SSOT-01 and SSOT-99.',
    root,
    issueKeys: new Set(['SSOT-01']),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'R4');
  assert.equal(findings[0].target, 'SSOT-99');
});

test('checkDocument reports R5 placeholder tokens but not HTML comments', () => {
  const root = fixtureRoot();
  const findings = checkDocument({ file: 'README.md', text: 'TODO: fill this in', root });
  assert.equal(findings[0].rule, 'R5');
  const comment = checkDocument({ file: 'README.md', text: '<!-- delivery-ssot:start -->', root });
  assert.equal(comment.length, 0);
});

test('checkTemplates reports R6 when required forms are missing', () => {
  const root = fixtureRoot();
  const findings = checkTemplates(root);
  assert.ok(findings.every((finding) => finding.rule === 'R6'));
  assert.ok(findings.length >= 2);
  write(root, '.github/ISSUE_TEMPLATE/config.yml', 'blank_issues_enabled: false\n');
  write(root, '.github/ISSUE_TEMPLATE/engineering_issue.yml', 'name: Issue\n');
  write(root, '.github/PULL_REQUEST_TEMPLATE.md', '## Issue\n');
  assert.equal(checkTemplates(root).length, 0);
});

test('readIssueKeys and runCheck agree on the clean fixture tree', () => {
  const root = fixtureRoot();
  write(root, 'docs/ISSUE_MAP.md', '| Key |\n| SSOT-01 |\n');
  write(root, 'README.md', '# Readme\n\nSee [map](docs/ISSUE_MAP.md). Tracking SSOT-01.\n');
  write(root, '.github/ISSUE_TEMPLATE/config.yml', 'blank_issues_enabled: false\n');
  write(root, '.github/ISSUE_TEMPLATE/engineering_issue.yml', 'name: Issue\n');
  write(root, '.github/PULL_REQUEST_TEMPLATE.md', '## Issue\n');
  const keys = readIssueKeys(root).keys;
  assert.ok(keys.has('SSOT-01'));
  const report = runCheck(root);
  assert.equal(report.ok, true, JSON.stringify(report.findings));
  assert.equal(report.files, 3); // README, issue map, PR template
});
