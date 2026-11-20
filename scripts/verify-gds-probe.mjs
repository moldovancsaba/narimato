#!/usr/bin/env node
/**
 * NARIMATO — GDS proof-surface browser probe (issue UI-01).
 *
 * Dev-only evidence harness. It starts a throwaway server, opens `?gds=proof` at
 * the four viewports the issue names (1440x900, 1024x768, 390x844, 792x302),
 * proves the five states, the single provider/root, the GDS stylesheet count, the
 * keyboard dialog + focus restore, the retry announcement and a 200% zoom pass,
 * and writes screenshots under `media/gds/`.
 *
 * Playwright is not a runtime dependency:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/verify-gds-probe.mjs
 *
 * Exits 0 when Playwright is unavailable (matching the repository's other dev-only
 * audits), 1 on a failed check, 2 on an internal error.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'playwright';
const ENGINE = process.env.PLAYWRIGHT_ENGINE || 'chromium';
const PORT = Number(process.env.NARIMATO_GDS_PROBE_PORT || 4397);
const BASE = `http://127.0.0.1:${PORT}`;
const PACKAGE_VERSION = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const SHOT_DIR = path.join(ROOT, 'media/gds');
const VIEWPORTS = [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 1024, height: 768, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile' },
  { width: 792, height: 302, label: 'short' },
];

let chromium;
let webkit;
let firefox;
try {
  ({ chromium, webkit, firefox } = require(PLAYWRIGHT));
} catch {
  console.error(`[gds-probe] Playwright not found at "${PLAYWRIGHT}"; skipping dev-only probe.`);
  process.exit(0);
}

const failures = [];
const check = (condition, label) => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-gds-probe-'));
const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, BOTS: '0' },
  stdio: 'ignore',
});
for (let index = 0; index < 100; index += 1) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {
    /* wait for the server */
  }
  await delay(150);
}

const engine = { chromium, webkit, firefox }[ENGINE] || chromium;
const browser = await engine.launch({ headless: true });

async function openProof(viewport, contextOptions = {}) {
  const context = await browser.newContext({ viewport, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${BASE}/?gds=proof&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-gds-proof-ready="true"]', { timeout: 15000 });
  await delay(400);
  return { context, page, errors };
}

const scrollButtonIntoView = (page, name) =>
  page.evaluate((label) => {
    const root = document.getElementById('gds-root');
    const button = [...root.querySelectorAll('button')].find((candidate) =>
      (candidate.innerText || '').trim().toLowerCase().includes(label)
    );
    if (!button) return { found: false };
    button.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = button.getBoundingClientRect();
    return {
      found: true,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
      visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
    };
  }, name.toLowerCase());

try {
  await mkdir(SHOT_DIR, { recursive: true });

  for (const viewport of VIEWPORTS) {
    console.log(`\n[gds-probe] ${viewport.label} ${viewport.width}x${viewport.height}`);
    const { context, page, errors } = await openProof({ width: viewport.width, height: viewport.height });

    const states = await page.evaluate(() =>
      [...document.querySelectorAll('[data-gds-proof-state]')].map((node) =>
        node.getAttribute('data-gds-proof-state')
      )
    );
    check(
      ['loading', 'empty', 'error', 'disabled', 'success'].every((state) => states.includes(state)),
      `five required states rendered (${states.length})`
    );

    const status = await page.evaluate(() => window.__NARIMATO_GDS__ && window.__NARIMATO_GDS__.status());
    check(Boolean(status && status.booted), 'island reports booted');
    check(Boolean(status && status.providerCount === 1), 'exactly one GdsProvider');
    check(Boolean(status && status.rootCount === 1), 'exactly one React root');
    check(Boolean(status && status.surface === 'proof'), 'proof surface mounted');

    const stylesheets = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href'))
    );
    check(stylesheets.filter((href) => href === '/ui/island.css').length === 1, 'one compiled GDS stylesheet');
    check(
      stylesheets.includes(`/css/cyberpunk.css?v=${PACKAGE_VERSION}`),
      'legacy app stylesheet preserved'
    );

    const rootCount = await page.evaluate(() => document.querySelectorAll('#gds-root').length);
    check(rootCount === 1, 'one #gds-root host');
    const canvas = await page.evaluate(() => Boolean(document.getElementById('arena-canvas')));
    check(canvas, 'game canvas still present');

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    check(overflow.scroll <= overflow.client + 1, `no horizontal page overflow (${overflow.scroll}/${overflow.client})`);

    const reach = await scrollButtonIntoView(page, 'retry island boot');
    check(reach.found && reach.visible, 'retry action reachable inside the viewport');

    const liveRegion = await page.evaluate(() => {
      const node = document.querySelector('[data-gds-announcer]');
      return node ? { role: node.getAttribute('role'), live: node.getAttribute('aria-live') } : null;
    });
    check(Boolean(liveRegion && liveRegion.role === 'status' && liveRegion.live === 'polite'), 'polite live region present');

    check(errors.length === 0, `no console or page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);

    await page.screenshot({ path: path.join(SHOT_DIR, `proof-${viewport.label}.png`), fullPage: false });
    await context.close();
  }

  // Keyboard journey: retry announcement + dialog Escape with focus restore.
  console.log('\n[gds-probe] keyboard journey');
  {
    const { context, page, errors } = await openProof({ width: 1440, height: 900 });
    const retry = page.getByRole('button', { name: /retry island boot/i });
    await retry.focus();
    await page.keyboard.press('Enter');
    await delay(700);
    const announcement = await page.locator('[data-gds-announcer]').innerText();
    check(/retry succeeded/i.test(announcement), `retry announced (${announcement.trim().slice(0, 60)})`);
    check((await page.getByText('Recovered', { exact: false }).count()) > 0, 'recovered success state rendered');

    const abandon = page.getByRole('button', { name: /abandon run \(demo\)/i });
    await abandon.focus();
    await page.keyboard.press('Enter');
    await delay(400);
    const dialog = page.getByRole('dialog').first();
    check((await dialog.count()) === 1, 'confirm dialog opens');
    check((await dialog.getAttribute('aria-modal')) === 'true', 'confirm dialog is modal');
    await page.keyboard.press('Escape');
    await delay(500);
    const restored = await page.evaluate(() =>
      (document.activeElement && (document.activeElement.innerText || document.activeElement.textContent || ''))
        .trim()
        .slice(0, 40)
    );
    check(/abandon run/i.test(restored), `focus restored to the invoker (${restored})`);

    // 200% zoom: nothing clipped horizontally and the retry action stays reachable.
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    await delay(300);
    const zoom = await page.evaluate(() => {
      const root = document.getElementById('gds-root');
      const retryButton = [...root.querySelectorAll('button')].find((button) =>
        /retry island boot/i.test(button.innerText)
      );
      retryButton.scrollIntoView({ block: 'center', behavior: 'instant' });
      const rect = retryButton.getBoundingClientRect();
      return {
        rootScroll: root.scrollWidth,
        rootClient: root.clientWidth,
        visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });
    check(zoom.rootScroll <= zoom.rootClient + 1, '200% zoom keeps the surface free of horizontal overflow');
    check(zoom.visible, '200% zoom keeps the retry action reachable');
    await page.evaluate(() => {
      document.body.style.zoom = '1';
    });
    check(errors.length === 0, `keyboard journey without page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);
    await context.close();
  }

  // Reduced motion is detected and reflected in the operator status.
  console.log('\n[gds-probe] reduced motion');
  {
    const { context, page } = await openProof({ width: 1440, height: 900 }, { reducedMotion: 'reduce' });
    const status = await page.evaluate(() => window.__NARIMATO_GDS__.status());
    check(status.reducedMotion === true, 'prefers-reduced-motion is detected and reported');
    await context.close();
  }
} catch (error) {
  console.error(`[gds-probe] INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
  failures.push('internal error');
} finally {
  await browser.close();
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n[gds-probe] FAILED — ${failures.length} check(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\n[gds-probe] clean — screenshots in media/gds/`);
}
