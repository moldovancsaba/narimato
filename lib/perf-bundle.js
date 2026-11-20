/**
 * NARIMATO — first-load and lazy-island bundle measurement (PERF-01).
 *
 * The game has no bundler: `public/index.html` loads one ES module entry and
 * the browser fetches the static import graph. The GDS island build (M1) will
 * emit lazy chunks; this module measures both without adding a dependency.
 *
 * Rules:
 *   - `bundleKibGzip` = entry script(s) + their static import graph, gzipped
 *     at level 9. PERF-01's 180 KiB budget is a JavaScript budget; the
 *     stylesheet is reported separately as `cssKibGzip`.
 *   - each lazy island = one emitted `islands/*.js` (or `public/ui/island.js`)
 *     file plus its own static imports, measured independently. The first
 *     committed GDS island uses M1's 180 KiB build budget; every additional
 *     lazy island gets PERF-01's 60 KiB budget;
 *   - only `public/` and the optional `dist/` build output are read.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const DEFAULT_HTML = 'public/index.html';
export const ISLAND_DIRS = ['public/ui', 'public/js/islands', 'public/islands', 'dist/islands'];
const PRIMARY_ISLAND = 'public/ui/island.js';
const ASSET_RE = /(?:src|href)=["']([^"']+)["']/g;
// Static graph only: dynamic `import()` is a lazy island, not first load.
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

function toRepoPath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function resolveAsset(root, fromFile, specifier) {
  if (typeof specifier !== 'string' || !specifier) return null;
  if (/^(?:https?:|data:|mailto:|tel:|#)/.test(specifier)) return null;
  const clean = specifier.split('?')[0].split('#')[0];
  if (!clean) return null;
  let candidate;
  if (clean.startsWith('/')) {
    // Site-absolute paths map to `public/`.
    candidate = path.join(root, 'public', clean.slice(1));
  } else {
    candidate = path.resolve(path.dirname(fromFile), clean);
  }
  if (!candidate.startsWith(root + path.sep) && candidate !== root) return null;
  return candidate;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Gzip size in KiB, rounded to two decimals. */
export function gzipKib(file) {
  const bytes = fs.readFileSync(file);
  return Math.round((zlib.gzipSync(bytes, { level: 9 }).length / 1024) * 100) / 100;
}

/** Parse local `<script src>` and stylesheet `<link href>` from the HTML shell. */
export function parseHtmlAssets(html, root, htmlFile) {
  const scripts = [];
  const styles = [];
  ASSET_RE.lastIndex = 0;
  let match;
  while ((match = ASSET_RE.exec(String(html || '')))) {
    const specifier = match[1];
    if (!/\.(?:m?js|css)(?:\?|$)/.test(specifier)) continue;
    const resolved = resolveAsset(root, htmlFile, specifier);
    if (!resolved) continue;
    if (/\.css(?:\?|$)/.test(specifier)) styles.push(resolved);
    else scripts.push(resolved);
  }
  return { scripts: [...new Set(scripts)], styles: [...new Set(styles)] };
}

/** Collect the static module graph rooted at one JS file. */
export function collectModuleGraph(root, entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readText(file);
    if (!text) continue;
    IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = IMPORT_RE.exec(text))) {
      const resolved = resolveAsset(root, file, match[1]);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen];
}

function measureFiles(files) {
  let bytes = 0;
  const entries = [];
  for (const file of files) {
    try {
      const kib = gzipKib(file);
      bytes += kib;
      entries.push({ file, kib });
    } catch {
      // A missing file is a build problem, not a measurement crash.
    }
  }
  return { kib: Math.round(bytes * 100) / 100, files: entries };
}

/** List lazy-island entry files emitted by the GDS build (none before M1). */
export function findIslands(root) {
  const found = [];
  for (const dir of ISLAND_DIRS) {
    const absolute = path.join(root, dir);
    let entries = [];
    try {
      entries = fs.readdirSync(absolute, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !/\.m?js$/.test(entry.name)) continue;
      // public/ui also holds the CSS and manifest; only JS is an island here.
      found.push(path.join(absolute, entry.name));
    }
  }
  return [...new Set(found)];
}

/**
 * Measure the first load and every lazy island.
 * @returns {{firstLoadKibGzip:number, jsKibGzip:number, cssKibGzip:number,
 *   modules:string[], styles:string[], islands:Array<{name:string,kib:number}>,
 *   overBudget:string[]}}
 */
export function measureBundle({ root = process.cwd(), html = DEFAULT_HTML, islandBudgetKib = 60, primaryIslandBudgetKib = 180, firstLoadBudgetKib = 180, tolerance = 0.02 } = {}) {
  const htmlFile = path.resolve(root, html);
  const source = readText(htmlFile) || '';
  const parsed = parseHtmlAssets(source, root, htmlFile);
  const jsFiles = [];
  for (const script of parsed.scripts) {
    for (const file of collectModuleGraph(root, script)) {
      if (file.endsWith('.js')) jsFiles.push(file);
    }
  }
  const uniqueJs = [...new Set(jsFiles)];
  const js = measureFiles(uniqueJs);
  const css = measureFiles(parsed.styles);
  const firstLoad = Math.round((js.kib + css.kib) * 100) / 100;
  const islands = findIslands(root).map((file) => {
    const graph = collectModuleGraph(root, file);
    const measured = measureFiles(graph);
    return {
      name: toRepoPath(root, file),
      file: toRepoPath(root, file),
      kib: measured.kib,
      modules: graph.map((entry) => toRepoPath(root, entry)),
    };
  });
  const overBudget = [];
  const bundleKibGzip = js.kib;
  if (bundleKibGzip > firstLoadBudgetKib * (1 + tolerance)) overBudget.push(`bundle ${bundleKibGzip} KiB > ${firstLoadBudgetKib} KiB`);
  let primaryIslandKibGzip = 0;
  for (const island of islands) {
    const isPrimary = island.name === PRIMARY_ISLAND || (!primaryIslandKibGzip && island === islands[0]);
    const limit = isPrimary ? primaryIslandBudgetKib : islandBudgetKib;
    if (isPrimary) primaryIslandKibGzip = island.kib;
    if (island.kib > limit * (1 + tolerance)) overBudget.push(`${island.name} ${island.kib} KiB > ${limit} KiB`);
  }
  return {
    bundleKibGzip,
    firstLoadKibGzip: firstLoad,
    jsKibGzip: js.kib,
    cssKibGzip: css.kib,
    modules: uniqueJs.map((file) => toRepoPath(root, file)),
    styles: parsed.styles.map((file) => toRepoPath(root, file)),
    islands,
    islandCount: islands.length,
    primaryIslandKibGzip,
    firstLoadBudgetKib,
    islandBudgetKib,
    primaryIslandBudgetKib,
    overBudget,
  };
}

export default { measureBundle, gzipKib, parseHtmlAssets, collectModuleGraph, findIslands };
