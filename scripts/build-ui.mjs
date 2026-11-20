#!/usr/bin/env node
/**
 * NARIMATO — dev-time GDS island build (issue UI-01).
 *
 * Pipeline:
 *   ui/src/main.jsx --vite--> public/ui/island.js + island.css (unminified)
 *     --esbuild minify--> deterministic island.js
 *     --remote-import strip + unused-component CSS prune + minify--> island.css
 *     --content hash--> manifest.json { version, builtAt, entries, bytes }
 *
 * The repository commits `public/ui/*`; the server and every runtime path serve
 * those files unchanged. This script needs `node_modules` (it is a devDependency
 * build); `npm start` never does.
 *
 * Usage:
 *   npm run build:ui           build and write the committed assets
 *   node scripts/build-ui.mjs  same
 *
 * Exit codes: 0 success, 1 budget/contract failure, 2 environment/build error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BUDGETS,
  ISLAND_DIR,
  ISLAND_FILES,
  collectUsedClassTokens,
  computeVersion,
  embedVersion,
  gzipSize,
  pruneCss,
  stripRemoteResources,
} from './lib/gds-assets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, ISLAND_DIR);
const JS_PATH = path.join(OUT_DIR, ISLAND_FILES.js);
const CSS_PATH = path.join(OUT_DIR, ISLAND_FILES.css);
const MANIFEST_PATH = path.join(OUT_DIR, ISLAND_FILES.manifest);

/** Commit timestamp recorded as `builtAt`; deterministic for a given HEAD. */
export function resolveBuiltAt(root = ROOT, env = process.env) {
  if (env.SOURCE_DATE_EPOCH && /^\d+$/.test(env.SOURCE_DATE_EPOCH)) {
    return new Date(Number(env.SOURCE_DATE_EPOCH) * 1000).toISOString();
  }
  const result = spawnSync('git', ['log', '-1', '--format=%cI'], { cwd: root, encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    const parsed = new Date(result.stdout.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  // No git (source tarball): a fixed epoch keeps the output deterministic.
  return '1970-01-01T00:00:00.000Z';
}

async function loadVite() {
  try {
    return await import('vite');
  } catch {
    console.error('build:ui — Vite is not installed. Run `npm ci` first; the runtime does not need it.');
    process.exit(2);
  }
}

async function main() {
  const vite = await loadVite();
  const builtAt = resolveBuiltAt();

  await vite.build({
    configFile: path.join(ROOT, 'ui/vite.config.mjs'),
    logLevel: 'error',
  });

  if (!fs.existsSync(JS_PATH) || !fs.existsSync(CSS_PATH)) {
    throw new Error(`Vite did not emit ${ISLAND_FILES.js} and ${ISLAND_FILES.css}`);
  }

  // Deterministic pass 1: one minification of the final concatenated bundle.
  const rawJs = fs.readFileSync(JS_PATH, 'utf8');
  const jsMinified = await vite.transformWithEsbuild(rawJs, ISLAND_FILES.js, {
    minify: true,
    format: 'esm',
    target: 'es2020',
    legalComments: 'none',
  });

  // Deterministic pass 2: no remote font/stylesheets, drop CSS for components
  // this bundle does not use, then minify.
  const rawCss = stripRemoteResources(fs.readFileSync(CSS_PATH, 'utf8'));
  const prunedCss = pruneCss(rawCss, collectUsedClassTokens(jsMinified.code));
  const cssMinified = await vite.transformWithEsbuild(prunedCss, ISLAND_FILES.css, {
    loader: 'css',
    minify: true,
    legalComments: 'none',
  });

  const version = computeVersion({ js: jsMinified.code, css: cssMinified.code });
  const js = embedVersion(jsMinified.code, version);
  const css = cssMinified.code;

  const bytes = {
    js: Buffer.byteLength(js),
    css: Buffer.byteLength(css),
    jsGzip: gzipSize(js),
    cssGzip: gzipSize(css),
  };

  const manifest = {
    version,
    builtAt,
    entries: { js: ISLAND_FILES.js, css: ISLAND_FILES.css },
    bytes,
  };

  fs.writeFileSync(JS_PATH, js);
  fs.writeFileSync(CSS_PATH, css);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const kib = (value) => `${(value / 1024).toFixed(2)} KiB`;
  console.log(`build:ui — ${ISLAND_FILES.js} ${kib(bytes.js)} (gzip ${kib(bytes.jsGzip)})`);
  console.log(`build:ui — ${ISLAND_FILES.css} ${kib(bytes.css)} (gzip ${kib(bytes.cssGzip)})`);
  console.log(`build:ui — version ${version} · builtAt ${builtAt}`);

  const findings = [];
  if (bytes.jsGzip > BUDGETS.jsGzip) findings.push(`js gzip ${kib(bytes.jsGzip)} > budget ${kib(BUDGETS.jsGzip)}`);
  if (bytes.cssGzip > BUDGETS.cssGzip) findings.push(`css gzip ${kib(bytes.cssGzip)} > budget ${kib(BUDGETS.cssGzip)}`);
  if (bytes.jsGzip > BUDGETS.jsGzipTarget) {
    console.log(`build:ui — js gzip is above the ${kib(BUDGETS.jsGzipTarget)} target but within the ${kib(BUDGETS.jsGzip)} hard budget`);
  }
  if (findings.length) {
    for (const finding of findings) console.error(`build:ui FAILED — ${finding}`);
    process.exit(1);
  }
  console.log('build:ui — OK');
}

main().catch((error) => {
  console.error(`build:ui INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
  process.exit(2);
});
