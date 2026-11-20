#!/usr/bin/env node
/**
 * NARIMATO — GDS island contract gate (issue UI-01), run in CI as `npm run verify:ui`.
 *
 * Checks the committed contract without needing `node_modules`:
 *   - public/ui/{island.js,island.css,manifest.json} exist
 *   - manifest schema, content-hash version equality, byte counts, gzip budgets
 *   - index.html mount contract: one #gds-root, one GDS stylesheet (before app CSS),
 *     game entry preserved, required ids still queryable
 *   - ui/src rules: one <GdsProvider>, one createRoot, GDS-only imports, tokens
 *   - asset safety: no eval/new Function, no remote fonts/scripts/stylesheet imports,
 *     no surviving bare imports
 *
 * Usage:
 *   npm run verify:ui             human summary on stderr, exit 0 | 1 | 2
 *   node scripts/verify-gds-build.mjs --json
 *   node scripts/verify-gds-build.mjs --root <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ISLAND_DIR,
  ISLAND_FILES,
  formatFindings,
  inspectAssetText,
  inspectIndexHtml,
  inspectIslandSources,
  validateManifest,
} from './lib/gds-assets.mjs';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Read every ui/src file into { relativePath: content }. */
export function readIslandSources(root) {
  const sourceRoot = path.join(root, 'ui/src');
  const sources = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|css)$/.test(entry.name)) {
        sources[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
      }
    }
  };
  if (fs.existsSync(sourceRoot)) walk(sourceRoot);
  return sources;
}

/** Run every contract check. Returns {ok, findings, summary}. */
export function verify(root = DEFAULT_ROOT) {
  const findings = [];
  const outDir = path.join(root, ISLAND_DIR);
  const js = readIfExists(path.join(outDir, ISLAND_FILES.js));
  const css = readIfExists(path.join(outDir, ISLAND_FILES.css));
  const manifestText = readIfExists(path.join(outDir, ISLAND_FILES.manifest));
  const html = readIfExists(path.join(root, 'public/index.html'));

  for (const [name, content] of [
    [ISLAND_FILES.js, js],
    [ISLAND_FILES.css, css],
    [ISLAND_FILES.manifest, manifestText],
  ]) {
    if (content === null) findings.push({ code: 'ASSET_MISSING', detail: `${ISLAND_DIR}/${name} is missing — run npm run build:ui` });
  }
  if (html === null) findings.push({ code: 'INDEX_MISSING', detail: 'public/index.html is missing' });

  let manifest = null;
  if (manifestText !== null) {
    try {
      manifest = JSON.parse(manifestText);
    } catch (error) {
      findings.push({ code: 'MANIFEST_JSON', detail: `manifest.json is not valid JSON: ${error.message}` });
    }
  }

  if (js !== null && css !== null && manifest) {
    findings.push(...validateManifest(manifest, { js, css }));
  }
  if (js !== null && css !== null) {
    findings.push(...inspectAssetText({ js, css }));
  }
  if (html !== null) {
    findings.push(...inspectIndexHtml(html));
  }
  const sources = readIslandSources(root);
  if (Object.keys(sources).length === 0) {
    findings.push({ code: 'SOURCES_EMPTY', detail: 'ui/src is missing or empty' });
  } else {
    findings.push(...inspectIslandSources(sources));
  }

  const summary = {
    version: manifest && manifest.version,
    builtAt: manifest && manifest.builtAt,
    bytes: manifest && manifest.bytes,
    sourceFiles: Object.keys(sources).length,
  };
  return { ok: findings.length === 0, findings, summary };
}

function parseArgs(argv) {
  const options = { json: false, root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--root') {
      options.root = path.resolve(argv[index + 1] || DEFAULT_ROOT);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`verify:ui — ${error.message}`);
    return 2;
  }
  try {
    const report = verify(options.root);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (report.ok) {
      const { version, bytes } = report.summary;
      console.error(
        `verify:ui OK — version ${version} · js ${(bytes.jsGzip / 1024).toFixed(2)} KiB gzip ` +
          `(≤ 180 KiB) · css ${(bytes.cssGzip / 1024).toFixed(2)} KiB gzip (≤ 40 KiB)`
      );
    } else {
      console.error(`verify:ui FAILED — ${report.findings.length} finding(s)`);
      console.error(formatFindings(report.findings));
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`verify:ui INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = main(process.argv.slice(2));
}
