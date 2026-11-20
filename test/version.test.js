import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  APP_SLOTS,
  compareSemver,
  inspectSlot,
  scanVersion,
  fixVersion,
  bumpVersion,
  readDeclaration,
  readAudioDeclaration,
} from '../scripts/check-version.mjs';

function fixtureRoot({ version = '3.57.0', audio = '3.16.0', voice = '3.16.0', edge = '3.16.0', omitDocs = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-version-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('package.json', JSON.stringify({ name: 'narimato', version }, null, 2));
  write(
    'public/index.html',
    [
      `<link rel="stylesheet" href="/css/cyberpunk.css?v=${version}" />`,
      `<span>v${version} // THE WAY BACK</span>`,
      `<script type="module" src="/js/app.js?v=${version}"></script>`,
    ].join('\n')
  );
  write('public/icosahedron.html', `<script type="module" src="/js/icosahedron-viewer.js?v=${version}"></script>`);
  write('README.md', `Version **${version}** · MIT\n`);
  write('public/js/narrator.js', `const AUDIO_VERSION = '${audio}';\n`);
  if (!omitDocs) {
    write('VOICE.md', `Assets are served versioned (\`?v=${voice}\`) with immutable cache headers.\n`);
    write('EDGE_DEPLOYMENT.md', `Audio URLs are versioned: \`/audio/voice/x.m4a?v=${edge}\`.\n`);
  }
  return root;
}

test('compareSemver orders releases and pre-releases', () => {
  assert.equal(compareSemver('1.2.3', '1.2.3'), 0);
  assert.equal(compareSemver('1.2.3', '1.2.4'), -1);
  assert.equal(compareSemver('1.3.0', '1.2.9'), 1);
  assert.equal(compareSemver('1.2.3-alpha', '1.2.3'), -1);
  assert.equal(compareSemver('1.2.3-alpha.1', '1.2.3-alpha.2'), -1);
  assert.equal(compareSemver('1.2.3-alpha.10', '1.2.3-alpha.9'), 1);
  assert.throws(() => compareSemver('1.2', '1.2.3'), /invalid semver/);
});

test('readDeclaration and readAudioDeclaration return the declared versions', () => {
  const root = fixtureRoot({ version: '4.1.0', audio: '3.20.1' });
  assert.equal(readDeclaration(root), '4.1.0');
  assert.equal(readAudioDeclaration(root), '3.20.1');
});

test('inspectSlot distinguishes zero, one and many matches', () => {
  const root = fixtureRoot();
  const slot = { file: 'README.md', pattern: /(Version \*\*)(\d+\.\d+\.\d+)(\*\*)/g, label: 'readme' };
  assert.equal(inspectSlot(root, slot, '3.57.0').error, null);
  assert.equal(inspectSlot(root, slot, '3.58.0').error, 'STALE');
  assert.equal(inspectSlot(root, { ...slot, pattern: /(NOPE)(\d+\.\d+\.\d+)/g }, '3.57.0').error, 'MISSING_SLOT');
  fs.appendFileSync(path.join(root, 'README.md'), 'Version **3.57.0** again\n');
  assert.equal(inspectSlot(root, slot, '3.57.0').error, 'AMBIGUOUS_SLOT');
});

test('scanVersion reports stale slots and skips optional missing documents', () => {
  const root = fixtureRoot({ version: '3.57.0', voice: '3.6.0', edge: '3.6.0' });
  const report = scanVersion(root);
  assert.equal(report.ok, false);
  assert.equal(report.declaration, '3.57.0');
  assert.equal(report.audioDeclaration, '3.16.0');
  const stale = report.results.filter((result) => !result.ok).map((result) => result.slot.file);
  assert.deepEqual(stale.sort(), ['EDGE_DEPLOYMENT.md', 'VOICE.md']);
  const optionalRoot = fixtureRoot({ omitDocs: true });
  assert.equal(scanVersion(optionalRoot).ok, true);
});

test('fixVersion rewrites stale slots and refuses ambiguous ones', () => {
  const root = fixtureRoot({ voice: '3.6.0', edge: '3.6.0' });
  const fixed = fixVersion(root);
  assert.equal(fixed.ok, true);
  assert.equal(fixed.fixed.length, 2);
  assert.equal(scanVersion(root).ok, true);
  assert.match(fs.readFileSync(path.join(root, 'VOICE.md'), 'utf8'), /\?v=3\.16\.0/);

  const ambiguous = fixtureRoot();
  fs.appendFileSync(path.join(ambiguous, 'README.md'), 'Version **3.57.0** again\n');
  const blocked = fixVersion(ambiguous);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blockers.some((blocker) => blocker.error === 'AMBIGUOUS_SLOT'));
});

test('bumpVersion rejects downgrades and bump+fix moves every app slot', () => {
  const root = fixtureRoot();
  assert.throws(() => bumpVersion('3.57.0', root), /refusing downgrade/);
  assert.throws(() => bumpVersion('3.56.9', root), /refusing downgrade/);
  const bumped = bumpVersion('3.58.0', root);
  assert.equal(bumped.ok, true);
  assert.equal(readDeclaration(root), '3.58.0');
  assert.equal(scanVersion(root).ok, true);
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /\?v=3\.58\.0/);
  assert.match(html, /v3\.58\.0 \/\/ THE WAY BACK/);
});
