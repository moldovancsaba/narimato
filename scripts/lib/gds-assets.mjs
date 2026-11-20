/**
 * NARIMATO — GDS island asset contracts (issue UI-01).
 *
 * Pure, dependency-free helpers shared by `scripts/build-ui.mjs`,
 * `scripts/verify-gds-build.mjs` and the node:test suite. Nothing here imports
 * Vite, esbuild, React or a DOM: the gate must run on a checkout with no
 * `node_modules`, exactly like the rest of the server suite.
 */
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';

/** Committed island output directory (served by the static handler as-is). */
export const ISLAND_DIR = 'public/ui';
export const ISLAND_FILES = Object.freeze({
  js: 'island.js',
  css: 'island.css',
  manifest: 'manifest.json',
});

/** Hard budgets from issue #7 §12. Units are bytes. */
export const BUDGETS = Object.freeze({
  jsGzip: 180 * 1024,
  jsGzipTarget: 140 * 1024,
  cssGzip: 40 * 1024,
});

/** `version = sha256(sorted(assets))[0..15]`. */
export const VERSION_LENGTH = 15;
/** Placeholder in the Vite output; replaced by the content hash at build time. */
export const VERSION_SENTINEL = '__GDS_ISLAND_VERSION__';

/** Relative-tolerance used when re-measuring committed gzip bytes. */
export const GZIP_TOLERANCE = 0.02;

export const REQUIRED_IDS = Object.freeze(['tag-input', 'btn-escape', 'manual-sections', 'report-card-preview']);

const ALLOWED_IMPORT_PREFIXES = Object.freeze([
  '@sovereignsquad/gds',
  '@sovereignsquad/gds-theme',
  'react',
  'react-dom',
]);

export function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

/**
 * Content version of the two island assets.
 *
 * The version string is embedded in the JavaScript, so hashing the raw file would
 * be self-referential. The caller therefore passes the JavaScript with the
 * version sentinel (`normalizeVersion`) and the same normalized input is used by
 * the verifier.
 */
export function computeVersion({ js, css }) {
  const parts = [`island.css:${css}`, `island.js:${js}`].sort();
  return sha256Hex(parts.join('\n')).slice(0, VERSION_LENGTH);
}

export function gzipSize(value) {
  return zlib.gzipSync(Buffer.from(value)).length;
}

export function measureAssets({ js, css }) {
  return {
    bytes: { js: Buffer.byteLength(js), css: Buffer.byteLength(css) },
    gzip: { js: gzipSize(js), css: gzipSize(css) },
  };
}

/** Replace the final version literal with the build sentinel (for re-hashing). */
export function normalizeVersion(js, version) {
  const quoted = JSON.stringify(version);
  const sentinel = JSON.stringify(VERSION_SENTINEL);
  if (!js.includes(quoted)) return js;
  return js.split(quoted).join(sentinel);
}

/** Replace the build sentinel with the final version literal. */
export function embedVersion(js, version) {
  const quoted = JSON.stringify(version);
  const sentinel = JSON.stringify(VERSION_SENTINEL);
  if (!js.includes(sentinel)) throw new Error(`island.js is missing the ${VERSION_SENTINEL} sentinel`);
  return js.split(sentinel).join(quoted);
}

/** Remove remote stylesheet/font imports (no third-party runtime request, no remote fonts). */
export function stripRemoteResources(css) {
  return css.replace(/@import\s+(?:url\(\s*)?["']?https?:\/\/[^;]*?;\s*/g, '');
}

/** Class tokens that a component library resolves at runtime, collected from the JS bundle. */
export function collectUsedClassTokens(js) {
  const used = new Set();
  for (const match of js.matchAll(/\bm_[0-9a-z]{5,8}\b/g)) used.add(match[0]);
  for (const match of js.matchAll(/\bmantine-[A-Za-z0-9_-]+/g)) used.add(match[0]);
  return used;
}

const CLASS_TOKEN_RE = /\.(m_[0-9a-z]{5,8}|mantine-[A-Za-z0-9_-]+)/g;
const NESTED_AT_RULES = new Set(['@media', '@supports', '@container', '@layer', '@scope', '@starting-style']);

/** Split a CSS stylesheet into top-level statements and blocks. */
function splitCssBlocks(text) {
  const blocks = [];
  let index = 0;
  let depth = 0;
  let blockStart = -1;

  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) index += 1;
    if (index >= text.length) break;
    const start = index;
    let cursor = index;
    let quote = null;
    for (; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (quote) {
        if (char === '\\') cursor += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '/' && text[cursor + 1] === '*') {
        const end = text.indexOf('*/', cursor + 2);
        cursor = end === -1 ? text.length : end + 1;
        continue;
      }
      if (char === '{' || char === ';') break;
    }
    if (cursor >= text.length || text[cursor] === ';') {
      blocks.push({ kind: 'statement', raw: text.slice(start, Math.min(cursor + 1, text.length)) });
      index = cursor + 1;
      continue;
    }
    blockStart = cursor;
    let nest = 0;
    quote = null;
    let close = blockStart;
    for (; close < text.length; close += 1) {
      const char = text[close];
      if (quote) {
        if (char === '\\') close += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '/' && text[close + 1] === '*') {
        const end = text.indexOf('*/', close + 2);
        close = end === -1 ? text.length : end + 1;
        continue;
      }
      if (char === '{') nest += 1;
      else if (char === '}') {
        nest -= 1;
        if (nest === 0) break;
      }
    }
    blocks.push({
      kind: 'block',
      prelude: text.slice(start, blockStart).trim(),
      raw: text.slice(start, close + 1),
    });
    index = close + 1;
  }
  return blocks;
}

/**
 * Drop rules that only target class names absent from the final JS bundle.
 *
 * Mantine ships the CSS for every component in one stylesheet; this island uses a
 * handful. Rules without a component class token (resets, tokens, `:root`,
 * our own island CSS) are always kept. This is what keeps the CSS budget honest
 * without forking or weakening the mandated GDS stylesheet import.
 */
export function pruneCss(css, usedTokens) {
  const isUsed = (prelude) => {
    let found = false;
    CLASS_TOKEN_RE.lastIndex = 0;
    let match;
    while ((match = CLASS_TOKEN_RE.exec(prelude))) {
      found = true;
      if (usedTokens.has(match[1])) return true;
    }
    return found ? false : true;
  };

  const processBlocks = (blocks) => {
    const kept = [];
    for (const block of blocks) {
      if (block.kind === 'statement') {
        kept.push(block.raw);
        continue;
      }
      const atName = (block.prelude.match(/^@[\w-]+/) || [''])[0];
      if (NESTED_AT_RULES.has(atName)) {
        const open = block.raw.indexOf('{');
        const inner = block.raw.slice(open + 1, -1);
        const nested = processBlocks(splitCssBlocks(inner));
        if (nested.length) kept.push(`${block.prelude}{${nested.join('')}}`);
        continue;
      }
      if (atName) {
        kept.push(block.raw);
        continue;
      }
      if (isUsed(block.prelude)) kept.push(block.raw);
    }
    return kept;
  };

  return processBlocks(splitCssBlocks(css)).join('');
}

/** Manifest/asset contract findings. Returns [] when everything holds. */
export function validateManifest(manifest, assets) {
  const findings = [];
  const expect = (condition, code, detail) => {
    if (!condition) findings.push({ code, detail });
  };

  if (!manifest || typeof manifest !== 'object') return [{ code: 'MANIFEST_MISSING', detail: 'manifest.json is not an object' }];
  expect(typeof manifest.version === 'string' && /^[0-9a-f]{15}$/.test(manifest.version), 'MANIFEST_VERSION', `version must be 15 hex chars, got ${manifest.version}`);
  expect(typeof manifest.builtAt === 'string' && !Number.isNaN(Date.parse(manifest.builtAt)), 'MANIFEST_BUILT_AT', `builtAt must be an ISO timestamp, got ${manifest.builtAt}`);
  expect(manifest.entries && manifest.entries.js === ISLAND_FILES.js, 'MANIFEST_ENTRY_JS', 'entries.js must be island.js');
  expect(manifest.entries && manifest.entries.css === ISLAND_FILES.css, 'MANIFEST_ENTRY_CSS', 'entries.css must be island.css');
  const bytes = manifest.bytes || {};
  for (const key of ['js', 'css', 'jsGzip', 'cssGzip']) {
    expect(Number.isInteger(bytes[key]) && bytes[key] > 0, 'MANIFEST_BYTES', `bytes.${key} must be a positive integer`);
  }

  const measured = measureAssets(assets);
  const normalized = normalizeVersion(assets.js, manifest.version);
  const version = computeVersion({ js: normalized, css: assets.css });
  expect(manifest.version === version, 'VERSION_MISMATCH', `manifest version ${manifest.version} != recomputed ${version}`);
  expect(bytes.js === measured.bytes.js, 'BYTES_JS', `bytes.js ${bytes.js} != ${measured.bytes.js}`);
  expect(bytes.css === measured.bytes.css, 'BYTES_CSS', `bytes.css ${bytes.css} != ${measured.bytes.css}`);

  const gzipOk = (recorded, measuredValue, label) =>
    expect(
      Math.abs(recorded - measuredValue) <= Math.max(64, measuredValue * GZIP_TOLERANCE),
      'GZIP_MEASUREMENT',
      `${label} gzip ${recorded} != measured ${measuredValue}`
    );
  gzipOk(bytes.jsGzip, measured.gzip.js, 'js');
  gzipOk(bytes.cssGzip, measured.gzip.css, 'css');

  expect(measured.gzip.js <= BUDGETS.jsGzip, 'BUDGET_JS', `js gzip ${measured.gzip.js} > ${BUDGETS.jsGzip}`);
  expect(measured.gzip.css <= BUDGETS.cssGzip, 'BUDGET_CSS', `css gzip ${measured.gzip.css} > ${BUDGETS.cssGzip}`);

  return findings;
}

/** `index.html` mount contract findings. */
export function inspectIndexHtml(html) {
  const findings = [];
  const push = (condition, code, detail) => {
    if (!condition) findings.push({ code, detail });
  };
  const count = (pattern) => (String(html).match(pattern) || []).length;

  push(count(/id="gds-root"/g) === 1, 'GDS_ROOT_COUNT', '#gds-root must appear exactly once');
  push(count(/rel="stylesheet"\s+href="\/ui\/island\.css"/g) === 1, 'GDS_STYLESHEET_COUNT', 'the compiled GDS stylesheet link must appear exactly once');
  push(count(/href="\/ui\/island\.css"/g) === 1, 'GDS_STYLESHEET_COUNT', 'only one island stylesheet referrer is allowed');
  push(count(/<script type="module" src="\/js\/app\.js/g) === 1, 'APP_ENTRY', 'the game entry script must stay exactly once');
  push(count(/<script type="module" src="\/js\/gds-boot\.js/g) === 1, 'GDS_BOOT_ENTRY', 'the GDS boot script must be present exactly once');

  const stylesheetAt = html.indexOf('/ui/island.css');
  const appStylesAt = html.indexOf('/css/cyberpunk.css');
  push(stylesheetAt !== -1 && appStylesAt !== -1 && stylesheetAt < appStylesAt, 'GDS_STYLESHEET_ORDER', 'the GDS stylesheet must load before the app stylesheet');

  const appScriptAt = html.indexOf('/js/app.js');
  const bootScriptAt = html.indexOf('/js/gds-boot.js');
  push(bootScriptAt !== -1 && appScriptAt !== -1 && appScriptAt < bootScriptAt, 'GDS_BOOT_ORDER', 'the island boot must load after the game entry');

  for (const id of REQUIRED_IDS) {
    push(new RegExp(`id="${id}"`).test(html), 'REQUIRED_ID', `#${id} must remain queryable`);
  }

  return findings;
}

/** GDS-only source rules: one provider, one root, no parallel library. */
export function inspectIslandSources(sources) {
  const findings = [];
  const entries = Object.entries(sources || {});
  const all = entries.map(([, content]) => content).join('\n');
  const push = (condition, code, detail) => {
    if (!condition) findings.push({ code, detail });
  };

  push((all.match(/<GdsProvider\b/g) || []).length === 1, 'PROVIDER_COUNT', 'exactly one <GdsProvider> may appear in ui/src');
  push((all.match(/createRoot\s*\(/g) || []).length === 1, 'ROOT_COUNT', 'exactly one createRoot() may appear in ui/src');
  push(!/MantineProvider/.test(all), 'MANTINE_PROVIDER', 'a second Mantine provider is forbidden');
  push(!/dangerouslySetInnerHTML/.test(all), 'RAW_HTML', 'dangerouslySetInnerHTML is forbidden in the island');
  push(!/style=\{\{/.test(all), 'INLINE_STYLE', 'use GDS token props instead of inline style objects');
  push(!/#[0-9a-fA-F]{3,8}\b/.test(all.replace(/\/\*[\s\S]*?\*\//g, '')), 'RAW_HEX', 'use GDS tokens instead of raw hex colors');

  const forbiddenPackages = [
    'react-bootstrap',
    'bootstrap',
    'tailwindcss',
    '@emotion/',
    'styled-components',
    '@chakra-ui/',
    '@mui/',
    'antd',
    '@radix-ui/',
    'lucide-react',
    'react-icons',
  ];
  const specifierRe = /(?:from|import)\s*["']([^"']+)["']/g;
  let match;
  while ((match = specifierRe.exec(all))) {
    const specifier = match[1];
    if (specifier.startsWith('.')) continue;
    const allowed = ALLOWED_IMPORT_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`));
    push(allowed, 'FORBIDDEN_IMPORT', `ui/src imports "${specifier}"`);
    for (const forbidden of forbiddenPackages) {
      push(!specifier.startsWith(forbidden), 'PARALLEL_LIBRARY', `ui/src imports "${specifier}"`);
    }
    push(!specifier.startsWith('@mantine/'), 'MANTINE_DIRECT', `ui/src imports "${specifier}" directly`);
    push(!specifier.startsWith('@tabler/'), 'ICON_PACK', `ui/src imports "${specifier}" directly`);
  }
  push(!/@mantine\//.test(all), 'MANTINE_DIRECT', 'direct @mantine/* imports are forbidden');
  push(!/@tabler\//.test(all), 'ICON_PACK', 'direct @tabler/* imports are forbidden');

  return findings;
}

/** Deploy-safety findings on the built assets. */
export function inspectAssetText({ js, css }) {
  const findings = [];
  const push = (condition, code, detail) => {
    if (!condition) findings.push({ code, detail });
  };

  push(!/\beval\s*\(/.test(js), 'EVAL', 'island.js must not contain eval()');
  push(!/\bnew\s+Function\s*\(/.test(js), 'NEW_FUNCTION', 'island.js must not contain new Function()');
  push(!/\bdocument\.write\s*\(/.test(js), 'DOCUMENT_WRITE', 'island.js must not use document.write()');
  // GDS ships a font-lane loader whose source mentions the Google Fonts URL, but
  // nothing is requested at page load: the mandated stylesheet is the only place a
  // remote font could load from, and that import is stripped by the build.
  push(!/fonts\.googleapis\.com/.test(css), 'REMOTE_FONT', 'island.css must not request a remote font');
  push(!/url\(\s*["']?https?:\/\//.test(css), 'REMOTE_CSS_URL', 'island.css must not reference remote URLs');
  push(!/@import\s+(?:url\(\s*)?["']?https?:\/\//.test(css), 'REMOTE_CSS_IMPORT', 'island.css must not import remote stylesheets');
  push(!/\bsrc\s*=\s*["']https?:\/\//.test(js), 'REMOTE_SCRIPT', 'island.js must not inject remote scripts');
  push(!/\bhref\s*=\s*["']https?:\/\//.test(js), 'REMOTE_LINK', 'island.js must not inject remote stylesheet links');
  push(!/\bfetch\s*\(\s*["'`]https?:\/\//.test(js), 'REMOTE_FETCH', 'island.js must not fetch remote URLs');

  // No module imports survive bundling: a bare import would be a partial deploy risk.
  const importStatements = js.match(/(?:^|[\n;{}])\s*import\s*(?:\(|[{*"'])/g) || [];
  push(importStatements.length === 0, 'BARE_IMPORT', 'island.js must be a self-contained module with no import statements');
  push(!/\bimport\.meta\b/.test(js), 'IMPORT_META', 'island.js must not depend on import.meta');

  return findings;
}

/** Render findings as a readable summary. */
export function formatFindings(findings) {
  return findings.map((finding) => `  ${finding.code}: ${finding.detail}`).join('\n');
}
