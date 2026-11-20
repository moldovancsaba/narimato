#!/usr/bin/env node
/**
 * NARIMATO — 200% zoom / reflow evidence for the migrated surfaces (UI-02…UI-05).
 *
 * 200% browser zoom halves the CSS viewport: 720×450 for a 1440×900 desktop and
 * 360×225 for a 720×450 window. This harness checks the same DOM at those
 * viewports: no horizontal page overflow, the join action reachable, the HUD
 * dock reachable and the overlay close control reachable.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from '../server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media/gds/migration');
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE || '/tmp/dsh-pw/node_modules/playwright';
const failures = [];
const check = (ok, label) => {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures.push(label);
    console.error(`  ✗ ${label}`);
  }
};

async function loadChromium() {
  const target = path.isAbsolute(PLAYWRIGHT_MODULE) || PLAYWRIGHT_MODULE.startsWith('.')
    ? pathToFileURL(path.resolve(PLAYWRIGHT_MODULE, 'index.mjs')).href
    : PLAYWRIGHT_MODULE;
  const mod = await import(target);
  return mod.chromium || (mod.default && mod.default.chromium);
}

let server = null;
let dataDir = '';
try {
  fs.mkdirSync(MEDIA, { recursive: true });
  dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'narimato-zoom-'));
  server = await startServer({ port: 0, host: '127.0.0.1', dataDir, quiet: true, config: { bots: 0 } });
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  for (const [width, height, name] of [[720, 450, 'desktop-200'], [360, 225, 'mobile-200']]) {
    console.log(`\n[zoom] ${name} ${width}x${height}`);
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message || error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('icosa.guideSeen', '1');
      } catch {
        /* private mode */
      }
    });
    await page.goto(`${server.url}/?intro=0&gds=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tag-input', { timeout: 15000 });
    const landingOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    check(landingOverflow === 0, `${name} landing: no horizontal reflow`);
    await page.screenshot({ path: path.join(MEDIA, `zoom-${name}-landing.png`) });
    const tag = `Z${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
    await page.fill('#tag-input', tag);
    await page.click('#btn-join');
    await page.waitForSelector('#tag-input', { state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    if (await page.locator('#btn-landing-brief-start').isVisible().catch(() => false)) {
      await page.evaluate(() => document.getElementById('btn-landing-brief-start')?.click());
      await page.waitForTimeout(300);
    }
    const hudOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    check(hudOverflow === 0, `${name} HUD: no horizontal reflow`);
    const dockReachable = await page.evaluate(() => {
      const button = document.getElementById('gds-btn-mission');
      if (!button) return false;
      button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rect = button.getBoundingClientRect();
      return rect.width >= 44 && rect.height >= 44 && rect.bottom <= window.innerHeight + 1 && rect.top >= -1;
    });
    check(dockReachable, `${name} HUD: dock control reachable`);
    await page.screenshot({ path: path.join(MEDIA, `zoom-${name}-hud.png`) });
    check(errors.length === 0, `${name}: no console errors (${errors.slice(0, 2).join(' | ') || 'clean'})`);
    await context.close();
  }
  await browser.close();
} catch (error) {
  console.error(error);
  failures.push(String(error && error.message ? error.message : error));
} finally {
  if (server) await server.close();
  if (dataDir) await fs.promises.rm(dataDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\nverify-ui-zoom FAILED — ${failures.length} finding(s)`);
  process.exitCode = 1;
} else {
  console.log('\nverify-ui-zoom OK — 200% zoom screenshots in media/gds/migration/');
}
