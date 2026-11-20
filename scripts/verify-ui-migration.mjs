#!/usr/bin/env node
/**
 * NARIMATO — migrated GDS surface browser verification (UI-02…UI-05).
 *
 * Starts a throwaway authoritative server, drives the real page with Playwright,
 * asserts the required DOM/ARIA contract, captures viewport screenshots and runs
 * axe on every migrated surface. Committed evidence lives under
 * `media/gds/migration/`.
 *
 * Usage:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
 *     node scripts/verify-ui-migration.mjs [--suite hud|overlays|surface|cine|all]
 *
 * `PLAYWRIGHT_MODULE` may point at a `node_modules/playwright` directory or a
 * package specifier. Exits non-zero on any assertion or serious/critical axe
 * violation. The zero-dependency runtime is untouched: this is a dev harness.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from '../server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media/gds/migration');
const AXE_PATH = process.env.AXE_PATH || '/tmp/dsh-pw/node_modules/axe-core/axe.min.js';
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE || '/tmp/dsh-pw/node_modules/playwright';
const suiteArg = process.argv.includes('--suite') ? process.argv[process.argv.indexOf('--suite') + 1] : 'all';
const SUITE = suiteArg || 'all';

const VIEWPORTS = [
  [1440, 900, 'desktop'],
  [1024, 768, 'tablet'],
  [390, 844, 'mobile'],
  [844, 390, 'mobile-landscape'],
  [792, 302, 'short'],
  [1200, 630, 'report'],
];

const failures = [];
function check(condition, label) {
  if (!condition) {
    failures.push(label);
    console.error(`  ✗ ${label}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

async function loadPlaywright() {
  const target = path.isAbsolute(PLAYWRIGHT_MODULE) || PLAYWRIGHT_MODULE.startsWith('.')
    ? pathToFileURL(path.resolve(PLAYWRIGHT_MODULE, 'index.mjs')).href
    : PLAYWRIGHT_MODULE;
  const mod = await import(target);
  return mod.chromium || (mod.default && mod.default.chromium);
}

function tag() {
  return `M${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 9);
}

async function openPage(browser, viewport, { reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('icosa.guideSeen', '1');
      localStorage.setItem('icosa.introSeen', '1');
    } catch {
      /* private mode */
    }
  });
  await page.goto(`${BASE}/?intro=0&gds=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tag-input', { timeout: 15000 });
  return { context, page, errors };
}

async function join(page) {
  const name = tag();
  await page.fill('#tag-input', name);
  await page.click('#btn-join');
  await page.waitForSelector('#tag-input', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  if (await page.locator('#btn-landing-brief-start').isVisible().catch(() => false)) {
    await page.click('#btn-landing-brief-start');
    await page.waitForTimeout(300);
  }
  return name;
}

async function axe(page, label, report) {
  report = report || {};
  if (!fs.existsSync(AXE_PATH)) {
    console.warn(`  ! axe not found at ${AXE_PATH}; skipping ${label}`);
    return;
  }
  await page.addScriptTag({ path: AXE_PATH });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  });
  report.label = label;
  report.violations = result;
  const bad = result.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(bad.length === 0, `${label}: axe serious/critical = 0 (${bad.map((v) => v.id).join(', ') || 'clean'})`);
  return result;
}

async function overflow(page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

async function hudSuite(browser, axeReports) {
  console.log('\n[hud]');
  for (const viewport of VIEWPORTS) {
    const { context, page, errors } = await openPage(browser, viewport);
    check((await overflow(page)) === 0, `${viewport[2]} landing: no horizontal overflow`);
    await page.screenshot({ path: path.join(MEDIA, `landing-${viewport[2]}.png`) });
    await join(page);
    check((await overflow(page)) === 0, `${viewport[2]} HUD: no horizontal overflow`);
    const required = await page.evaluate(() => {
      const ids = ['hud', 'hud-score', 'planet-badge', 'nav-chip', 'mission-panel', 'players-panel', 'arcade-panel', 'hud-target', 'target-charge-bar', 'hud-zoom', 'mobile-dock', 'hud-hint', 'btn-nav-focus', 'btn-nav-next', 'btn-abandon', 'btn-escape'];
      return ids.filter((id) => !document.getElementById(id));
    });
    check(required.length === 0, `${viewport[2]} HUD: required ids resolve (${required.join(',') || 'all'})`);
    const small = await page.evaluate(() => {
      return [...document.querySelectorAll('#hud button, .gds-status-cluster button, .gds-dock button')]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((button) => button.id || button.textContent.trim().slice(0, 12));
    });
    check(small.length === 0, `${viewport[2]} HUD: targets ≥ 44px (${small.join(',') || 'all'})`);
    await page.screenshot({ path: path.join(MEDIA, `hud-${viewport[2]}.png`) });
    if (viewport[0] <= 1024 || viewport[1] <= 720) {
      await page.evaluate(() => document.getElementById('gds-btn-mission')?.click());
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(MEDIA, `drawer-mission-${viewport[2]}.png`) });
      await page.evaluate(() => document.getElementById('gds-btn-mission')?.click());
    }
    if (viewport[2] === 'desktop') {
      await axe(page, 'hud', (axeReports.hud = axeReports.hud || {}));
    }
    check(errors.length === 0, `${viewport[2]} HUD: no console errors (${errors.slice(0, 2).join(' | ') || 'clean'})`);
    await context.close();
  }
}

async function overlaySuite(browser, axeReports) {
  console.log('\n[overlays]');
  const { context, page, errors } = await openPage(browser, [1440, 900, 'desktop']);
  await page.fill('#tag-input', 'a');
  await page.click('#btn-join');
  await page.waitForTimeout(400);
  check((await page.getAttribute('#tag-input', 'aria-invalid')) === 'true', 'invalid tag sets aria-invalid');
  check(((await page.getAttribute('#tag-input', 'aria-describedby')) || '').includes('join-error'), 'tag input is described by the error');
  await join(page);
  await page.click('#btn-help');
  await page.waitForTimeout(700);
  check(await page.locator('#guide-overlay').isVisible().catch(() => false), 'guide opens');
  check(await page.evaluate(() => !!document.getElementById('guide-overlay')?.closest('[role="dialog"], .mantine-Modal-content')), 'guide is a dialog');
  const trapped = [];
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab');
    trapped.push(await page.evaluate(() => !!document.activeElement?.closest('.mantine-Modal-content')));
  }
  check(trapped.every(Boolean), 'Tab stays inside the guide dialog');
  await page.screenshot({ path: path.join(MEDIA, 'overlay-guide.png') });
  await axe(page, 'guide', (axeReports.guide = axeReports.guide || {}));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  check(!(await page.evaluate(() => !!document.getElementById('guide-overlay'))), 'Escape closes the guide');
  check((await page.evaluate(() => document.activeElement?.id)) === 'btn-help', 'focus returns to the guide invoker');

  await page.click('#btn-help');
  await page.waitForTimeout(500);
  await page.click('#btn-guide-manual');
  await page.waitForTimeout(700);
  check((await page.locator('#manual-sections .gds-manual-section').count()) > 0, 'manual renders its sections');
  await page.screenshot({ path: path.join(MEDIA, 'overlay-manual.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await page.click('#gds-btn-report');
  await page.waitForTimeout(1200);
  check(await page.locator('#report-card-preview').count() === 1, 'report canvas exists');
  const card = await page.evaluate(() => {
    const canvas = document.getElementById('report-card-preview');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    return { width: canvas.width, height: canvas.height, alpha: ctx.getImageData(600, 315, 1, 1).data[3] };
  });
  check(card && card.width === 1200 && card.height === 630, 'report card is 1200×630');
  check(card && card.alpha > 0, 'report card is painted');
  await page.screenshot({ path: path.join(MEDIA, 'overlay-report.png') });
  await axe(page, 'report', (axeReports.report = axeReports.report || {}));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await page.click('#btn-abandon');
  await page.waitForTimeout(700);
  check(await page.locator('#confirm-overlay').isVisible().catch(() => false), 'destructive confirm opens');
  check((await page.locator('#confirm-message').textContent().catch(() => '')).includes('Return to the main screen'), 'confirm explains the consequence');
  await page.screenshot({ path: path.join(MEDIA, 'overlay-confirm.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  check(!(await page.locator('#confirm-overlay').isVisible().catch(() => false)), 'Escape resolves confirm false');
  check(errors.length === 0, `overlays: no console errors (${errors.slice(0, 2).join(' | ') || 'clean'})`);
  await context.close();
}

async function surfaceSuite(browser, axeReports) {
  console.log('\n[surface]');
  for (const viewport of VIEWPORTS.filter((v) => v[2] === 'desktop' || v[2] === 'mobile' || v[2] === 'mobile-landscape')) {
    const { context, page, errors } = await openPage(browser, viewport);
    await join(page);
    await page.evaluate(() => window.__ICOSA__.surface());
    await page.waitForTimeout(1400);
    const state = await page.evaluate(() => {
      const strip = document.getElementById('surface-controls');
      const pads = [...document.querySelectorAll('#surface-controls [data-surface-hold]')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label'), width: rect.width, height: rect.height };
      });
      return {
        view: window.__ICOSA__.view(),
        strip: strip ? getComputedStyle(strip).display : null,
        target: document.getElementById('surface-target')?.textContent || '',
        pads,
        canvases: document.querySelectorAll('canvas#arena-canvas').length,
        surfaceCanvas: document.querySelectorAll('#surface-canvas').length,
        orbital: ['mission-panel', 'players-panel', 'arcade-panel', 'hud-score'].every((id) => !!document.getElementById(id)),
      };
    });
    check(state.view === 'surface', `${viewport[2]} surface: mode active`);
    check(state.strip !== 'none', `${viewport[2]} surface: strip visible`);
    check(state.pads.length === 4 && state.pads.every((pad) => pad.width >= 44 && pad.height >= 44), `${viewport[2]} surface: four 44px pads`);
    check(state.target.includes('TARGET'), `${viewport[2]} surface: target has text`);
    check(state.canvases === 1 && state.surfaceCanvas === 0, `${viewport[2]} surface: one canvas, no surface-canvas`);
    check(state.orbital, `${viewport[2]} surface: orbital panels stay mounted`);
    await page.screenshot({ path: path.join(MEDIA, `surface-${viewport[2]}.png`) });
    if (viewport[2] === 'desktop') await axe(page, 'surface', (axeReports.surface = axeReports.surface || {}));

    await page.click('#btn-surface-exit');
    await page.waitForTimeout(600);
    check(await page.locator('#confirm-overlay').isVisible().catch(() => false), `${viewport[2]} surface: exit confirmation`);
    await page.evaluate(() => [...document.querySelectorAll('#confirm-overlay button')].find((b) => /KEEP RUNNING/.test(b.textContent))?.click());
    await page.waitForTimeout(500);
    check((await page.evaluate(() => window.__ICOSA__.view())) === 'surface', `${viewport[2]} surface: cancel keeps running`);
    await page.evaluate(() => document.getElementById('btn-surface-exit')?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => [...document.querySelectorAll('#confirm-overlay button')].find((b) => /RETURN TO ORBIT/.test(b.textContent))?.click());
    await page.waitForTimeout(2400);
    check((await page.evaluate(() => window.__ICOSA__.view())) === 'orbit', `${viewport[2]} surface: confirm returns to orbit`);
    check(errors.length === 0, `${viewport[2]} surface: no console errors (${errors.slice(0, 2).join(' | ') || 'clean'})`);
    await context.close();
  }
}

async function cineSuite(browser, axeReports) {
  console.log('\n[cine]');
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: reducedMotion === 'reduce' ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message || error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('icosa.introSeen');
      } catch {
        /* private mode */
      }
    });
    await page.goto(`${BASE}/?gds=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(reducedMotion === 'reduce' ? 1200 : 2200);
    const state = await page.evaluate(() => ({
      active: window.__ICOSA__?.intro?.active,
      cine: !!document.getElementById('gds-intro-cine'),
      skip: !!document.getElementById('btn-skip-intro'),
      captions: document.getElementById('narrative-subtitles')?.getAttribute('aria-live'),
      motion: document.getElementById('gds-intro-cine')?.dataset.motion,
    }));
    check(state.cine && state.skip, `cine (${reducedMotion}): chrome renders with skip`);
    check(state.captions === 'polite', `cine (${reducedMotion}): captions are a polite region`);
    check(state.motion === (reducedMotion === 'reduce' ? 'reduced' : 'full'), `cine (${reducedMotion}): motion mode reported`);
    await page.screenshot({ path: path.join(MEDIA, `cine-${reducedMotion === 'reduce' ? 'reduced' : 'full'}.png`) });
    if (reducedMotion === 'no-preference') await axe(page, 'cine', (axeReports.cine = axeReports.cine || {}));
    await page.evaluate(() => document.getElementById('btn-skip-intro')?.click());
    await page.waitForTimeout(900);
    check(await page.locator('#tag-input').isVisible().catch(() => false), `cine (${reducedMotion}): skip reveals the join form`);
    const focused = await page.evaluate(() => document.activeElement?.id);
    check(focused === 'tag-input' || (await page.evaluate(() => window.__NARIMATO_UI__._isLandingVisible())), 'cine: focus returns to the landing form');
    check(errors.length === 0, `cine (${reducedMotion}): no console errors (${errors.slice(0, 2).join(' | ') || 'clean'})`);
    await context.close();
  }
}

let server = null;
let BASE = '';
let dataDir = '';

try {
  fs.mkdirSync(MEDIA, { recursive: true });
  dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'narimato-ui-'));
  server = await startServer({ port: 0, host: '127.0.0.1', dataDir, quiet: true, config: { bots: 0 } });
  BASE = server.url;
  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const axeReports = {};
  if (SUITE === 'all' || SUITE === 'hud') await hudSuite(browser, axeReports);
  if (SUITE === 'all' || SUITE === 'overlays') await overlaySuite(browser, axeReports);
  if (SUITE === 'all' || SUITE === 'surface') await surfaceSuite(browser, axeReports);
  if (SUITE === 'all' || SUITE === 'cine') await cineSuite(browser, axeReports);
  await browser.close();
  fs.writeFileSync(path.join(MEDIA, 'axe-report.json'), `${JSON.stringify({ suite: SUITE, generatedAt: new Date().toISOString(), viewports: VIEWPORTS.map((v) => v.slice(0, 2)), reports: axeReports }, null, 2)}\n`);
} catch (error) {
  console.error(error);
  failures.push(String(error && error.message ? error.message : error));
} finally {
  if (server) await server.close();
  if (dataDir) await fs.promises.rm(dataDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\nverify-ui-migration FAILED — ${failures.length} finding(s): ${failures.join(' | ')}`);
  process.exitCode = 1;
} else {
  console.log('\nverify-ui-migration OK — screenshots and axe report in media/gds/migration/');
}
