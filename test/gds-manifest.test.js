/**
 * NARIMATO — GDS island manifest and build-contract tests (issue UI-01).
 *
 * Zero dependencies: these run on a checkout with no `node_modules`, exactly like
 * the rest of the suite. They prove the committed output contract, the GDS-only
 * source rules, deploy safety, and that the static server serves the island with
 * the right MIME type and `no-store`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer } from '../server.js';
import {
  BUDGETS,
  ISLAND_FILES,
  VERSION_LENGTH,
  VERSION_SENTINEL,
  collectUsedClassTokens,
  computeVersion,
  embedVersion,
  gzipSize,
  inspectAssetText,
  inspectIndexHtml,
  inspectIslandSources,
  measureAssets,
  normalizeVersion,
  pruneCss,
  stripRemoteResources,
  validateManifest,
} from '../scripts/lib/gds-assets.mjs';
import { readIslandSources } from '../scripts/verify-gds-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const indexHtml = read('public/index.html');
const assets = {
  js: read(`public/ui/${ISLAND_FILES.js}`),
  css: read(`public/ui/${ISLAND_FILES.css}`),
};
const manifest = JSON.parse(read(`public/ui/${ISLAND_FILES.manifest}`));

test('manifest: committed manifest satisfies the island contract', () => {
  const findings = validateManifest(manifest, assets);
  assert.deepEqual(findings, [], `manifest findings: ${JSON.stringify(findings)}`);
});

test('manifest: version is the content hash of the two assets', () => {
  assert.match(manifest.version, new RegExp(`^[0-9a-f]{${VERSION_LENGTH}}$`));
  const normalized = normalizeVersion(assets.js, manifest.version);
  assert.equal(computeVersion({ js: normalized, css: assets.css }), manifest.version);
  // The final version literal replaced the build-time sentinel and survives minification.
  assert.equal(assets.js.includes(JSON.stringify(manifest.version)), true);
  assert.equal(assets.js.includes(JSON.stringify(VERSION_SENTINEL)), false);
});

test('manifest: builtAt is an ISO commit timestamp', () => {
  assert.equal(Number.isNaN(Date.parse(manifest.builtAt)), false);
  assert.match(manifest.builtAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('manifest: asset byte counts match the committed files', () => {
  assert.equal(manifest.bytes.js, Buffer.byteLength(assets.js));
  assert.equal(manifest.bytes.css, Buffer.byteLength(assets.css));
  assert.equal(manifest.bytes.jsGzip, gzipSize(assets.js));
  assert.equal(manifest.bytes.cssGzip, gzipSize(assets.css));
});

test('budgets: island JavaScript stays within the 180 KiB gzip hard budget', () => {
  const measured = measureAssets(assets);
  assert.ok(measured.gzip.js > 0);
  assert.ok(
    measured.gzip.js <= BUDGETS.jsGzip,
    `js gzip ${measured.gzip.js} B exceeds the ${BUDGETS.jsGzip} B budget`
  );
});

test('budgets: island CSS stays within the 40 KiB gzip hard budget', () => {
  const measured = measureAssets(assets);
  assert.ok(measured.gzip.css > 0);
  assert.ok(
    measured.gzip.css <= BUDGETS.cssGzip,
    `css gzip ${measured.gzip.css} B exceeds the ${BUDGETS.cssGzip} B budget`
  );
});

test('index.html: one #gds-root, one GDS stylesheet, game entry preserved', () => {
  assert.deepEqual(inspectIndexHtml(indexHtml), []);
  for (const id of ['tag-input', 'btn-escape', 'manual-sections', 'report-card-preview']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `#${id} must stay queryable`);
  }
  assert.equal(indexHtml.includes('/js/gds-boot.js'), true);
});

test('ui/src: exactly one GdsProvider, one React root, GDS-only imports', () => {
  const sources = readIslandSources(ROOT);
  assert.ok(Object.keys(sources).length >= 4);
  assert.deepEqual(inspectIslandSources(sources), []);
  const all = Object.values(sources).join('\n');
  assert.equal((all.match(/<GdsProvider\b/g) || []).length, 1);
  assert.equal((all.match(/createRoot\s*\(/g) || []).length, 1);
  assert.equal(all.includes('@mantine/'), false);
});

test('assets: no eval, no remote fonts or resource loads, no bare imports', () => {
  assert.deepEqual(inspectAssetText(assets), []);
  assert.equal(assets.css.includes('@import'), false);
  assert.equal(/https?:\/\//.test(assets.css), false);
});

test('pruneCss: keeps global rules, drops rules only for unused component classes', () => {
  const css =
    '@media (min-width: 40em){.m_aaaaaaaa{padding:0}.m_bbbbbbbb{color:red}}' +
    ':root{--kept:1}' +
    '.gds-paper{color:blue}' +
    '.m_cccccccc{display:none}';
  const pruned = pruneCss(css, new Set(['m_aaaaaaaa']));
  assert.equal(pruned.includes('.m_aaaaaaaa'), true);
  assert.equal(pruned.includes('m_bbbbbbbb'), false);
  assert.equal(pruned.includes(':root'), true);
  assert.equal(pruned.includes('.gds-paper'), true);
  assert.equal(pruned.includes('m_cccccccc'), false);
  assert.equal(pruned.includes('@media'), true);
});

test('pruneCss: drops a nested at-rule when every nested rule is unused', () => {
  const pruned = pruneCss('@media print{.m_aaaaaaaa{display:none}}', new Set());
  assert.equal(pruned, '');
});

test('stripRemoteResources: removes the GDS remote font import', () => {
  const css = '@import url("https://fonts.googleapis.com/css2?family=Inter");\n:root{color:red}';
  const stripped = stripRemoteResources(css);
  assert.equal(stripped.includes('fonts.googleapis'), false);
  assert.equal(stripped.includes(':root'), true);
});

test('collectUsedClassTokens: reads the hashed component classes out of the bundle', () => {
  const tokens = collectUsedClassTokens('x class "m_77c9d27d" y "mantine-Button-root"');
  assert.equal(tokens.has('m_77c9d27d'), true);
  assert.equal(tokens.has('mantine-Button-root'), true);
});

test('embedVersion/normalizeVersion: sentinel round-trips without touching other content', () => {
  const sentinel = JSON.stringify(VERSION_SENTINEL);
  const version = '0123456789abc';
  const source = `const version=${sentinel};const other="keep";`;
  const embedded = embedVersion(source, version);
  assert.equal(embedded.includes(JSON.stringify(version)), true);
  assert.equal(normalizeVersion(embedded, version), source);
  assert.throws(() => embedVersion('no sentinel here', version), /sentinel/);
});

test('validateManifest: rejects a wrong version and a broken budget', () => {
  const bogus = {
    ...manifest,
    version: 'fffffffffffffff',
    bytes: { ...manifest.bytes, jsGzip: BUDGETS.jsGzip + 1 },
  };
  const codes = validateManifest(bogus, assets).map((finding) => finding.code);
  assert.ok(codes.includes('VERSION_MISMATCH'));
});

test('inspectIndexHtml: flags a duplicate mount host and a missing stylesheet', () => {
  const codes = inspectIndexHtml('<html><body><div id="gds-root"></div><div id="gds-root"></div></body></html>').map(
    (finding) => finding.code
  );
  assert.ok(codes.includes('GDS_ROOT_COUNT'));
  assert.ok(codes.includes('GDS_STYLESHEET_COUNT'));
  assert.ok(codes.includes('GDS_BOOT_ENTRY'));
});

test('inspectIslandSources: flags a second provider and a direct Mantine import', () => {
  const codes = inspectIslandSources({
    'ui/src/bad.jsx': "import { Button } from '@mantine/core';\n<GdsProvider/><GdsProvider/>\ncreateRoot(a);createRoot(b);",
  }).map((finding) => finding.code);
  assert.ok(codes.includes('PROVIDER_COUNT'));
  assert.ok(codes.includes('ROOT_COUNT'));
  assert.ok(codes.includes('MANTINE_DIRECT'));
});

test('static server: island assets serve with the right MIME type and no-store', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-gds-serve-'));
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { clickCooldownMs: 40, saveDebounceMs: 20, bots: 0, depositChance: 0 },
  });
  t.after(async () => {
    await handle.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${handle.port}`;

  const js = await fetch(`${base}/ui/island.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /^text\/javascript/);
  assert.equal(js.headers.get('cache-control'), 'no-store');
  assert.equal(await js.text(), assets.js);

  const css = await fetch(`${base}/ui/island.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /^text\/css/);
  assert.equal(css.headers.get('cache-control'), 'no-store');
  assert.equal(await css.text(), assets.css);

  const servedManifest = await fetch(`${base}/ui/manifest.json`);
  assert.equal(servedManifest.status, 200);
  assert.match(servedManifest.headers.get('content-type'), /^application\/json/);
  assert.equal(servedManifest.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await servedManifest.json(), manifest);

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /href="\/ui\/island\.css"/);
});
