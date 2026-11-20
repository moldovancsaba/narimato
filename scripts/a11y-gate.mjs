#!/usr/bin/env node
/**
 * NARIMATO — A11Y-01 GDS accessibility gate.
 *
 * One deterministic command per engine across every migrated GDS surface:
 *
 *   axe serious/critical = 0   (GDS `runGdsAxeScan`)
 *   expected tab order         (GDS `expectGdsTabOrder` + real Tab walk)
 *   focus trap / restore       (GDS `expectGdsFocusTrap` + Tab cycle + Escape)
 *   contrast                   (GDS `runGdsContrastGate` + WCAG luminance text sweep)
 *   200 % zoom                 (halved CSS viewport, no overflow, actions reachable)
 *   reduced motion             (Playwright media emulation, incident poster, cine copy)
 *   GDS ownership + 44 px      (every control inside a governed surface root)
 *
 * Usage:
 *   node scripts/a11y-gate.mjs --engine=chromium|webkit|both --out=artifacts/a11y
 *     [--only=<surface-id,...>] [--strict-suppressions] [--screenshots=<dir>]
 *     [--port=4397]
 *
 * Exit codes: 0 clean · 1 findings, incomplete checks or expired/unused suppressions ·
 * 2 infrastructure error (missing Playwright/axe, no free port, browser missing).
 *
 * Playwright and axe-core are devDependencies. `PLAYWRIGHT_MODULE` and `AXE_PATH`
 * may point at an existing installation without changing package.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startServer } from '../server.js';
import { SURFACES, selectSurfaces } from '../public/js/a11y-surfaces.js';
import {
  A11Y_SCHEMA_VERSION,
  applySuppressions,
  assembleReport,
  createFinding,
  loadSuppressionLedger,
} from './lib/a11y-report.mjs';
import { runAxe } from './a11y/checks/axe.mjs';
import { runTabOrder } from './a11y/checks/tab-order.mjs';
import { runFocusTrap } from './a11y/checks/focus-trap.mjs';
import { runContrast } from './a11y/checks/contrast.mjs';
import { runZoom } from './a11y/checks/zoom.mjs';
import { runOwnership } from './a11y/checks/gds-ownership.mjs';
import { runReducedMotion } from './a11y/checks/motion.mjs';
import { readCommit } from './lib/git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const options = {
    engine: 'both',
    out: path.join(ROOT, 'artifacts/a11y'),
    only: '',
    strictSuppressions: false,
    screenshots: '',
    port: Number(process.env.NARIMATO_A11Y_PORT || 4397),
    ledger: path.join(ROOT, 'a11y-suppressions.json'),
  };
  for (const arg of argv) {
    if (arg.startsWith('--engine=')) options.engine = arg.slice('--engine='.length);
    else if (arg === '--engine') throw new Error('use --engine=chromium|webkit|both');
    else if (arg.startsWith('--out=')) options.out = path.resolve(ROOT, arg.slice('--out='.length));
    else if (arg.startsWith('--only=')) options.only = arg.slice('--only='.length);
    else if (arg === '--strict-suppressions') options.strictSuppressions = true;
    else if (arg.startsWith('--screenshots=')) options.screenshots = path.resolve(ROOT, arg.slice('--screenshots='.length));
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice('--port='.length));
    else if (arg.startsWith('--ledger=')) options.ledger = path.resolve(ROOT, arg.slice('--ledger='.length));
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!['chromium', 'webkit', 'both'].includes(options.engine)) {
    throw new Error(`invalid --engine: ${options.engine} (chromium|webkit|both)`);
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error(`invalid --port: ${options.port}`);
  }
  return options;
}

function loadPlaywright() {
  const specifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
  try {
    return require(specifier);
  } catch (error) {
    throw new Error(
      `Playwright is required for a11y:gate but was not found (${specifier}). ` +
        'Run `npm ci` and `npx playwright install --with-deps chromium webkit`, or set PLAYWRIGHT_MODULE. ' +
        `Original error: ${error.message}`,
    );
  }
}

function resolveAxe() {
  const candidates = [
    process.env.AXE_PATH,
    path.join(ROOT, 'node_modules/axe-core/axe.min.js'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    return require.resolve('axe-core/axe.min.js');
  } catch (error) {
    throw new Error(
      `axe-core is required for a11y:gate but was not found. Run \`npm ci\`, or set AXE_PATH to axe.min.js. Original error: ${error.message}`,
    );
  }
}

async function loadLedger(options) {
  const empty = { suppressions: [], findings: [], maxExpiryDays: 90 };
  if (!fs.existsSync(options.ledger)) return empty;
  try {
    const raw = JSON.parse(await readFile(options.ledger, 'utf8'));
    const now = new Date();
    const loaded = loadSuppressionLedger(raw, { now });
    return { ...loaded, path: options.ledger };
  } catch (error) {
    return {
      ...empty,
      findings: [
        createFinding({
          check: 'suppression-policy',
          id: 'suppression-ledger-unreadable',
          surface: 'ledger',
          selector: 'a11y-suppressions.json',
          expected: 'valid JSON with a suppressions array',
          actual: error.message,
          severity: 'critical',
          status: 'failure',
          message: `Suppression ledger is unreadable: ${error.message}`,
        }),
      ],
    };
  }
}

async function startA11yServer(options) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-a11y-'));
  let lastError = null;
  for (let port = options.port; port <= options.port + 10; port += 1) {
    try {
      const handle = await startServer({
        port,
        host: '127.0.0.1',
        dataDir,
        quiet: true,
        config: { eventTrigger: true, depositChance: 1, bots: 0, clickCooldownMs: 0, saveDebounceMs: 10 },
      });
      return { handle, dataDir, port };
    } catch (error) {
      lastError = error;
      if (error && error.code !== 'EADDRINUSE') break;
    }
  }
  await rm(dataDir, { recursive: true, force: true });
  throw new Error(`could not start the a11y server on ports ${options.port}-${options.port + 10}: ${lastError ? lastError.message : 'unknown error'}`);
}

const SETTLE_MS = 350;
async function settle(page) {
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await delay(SETTLE_MS);
}

let tagSequence = 0;
const nextTag = () => `A11Y${String((tagSequence += 1)).padStart(2, '0')}`;

async function runSurface(browser, engine, surface, contextOptions) {
  const { base, axeSource, screenshotDir } = contextOptions;
  const findings = [];
  const context = await browser.newContext({
    viewport: surface.viewport,
    deviceScaleFactor: 1,
    reducedMotion: surface.reducedMotion,
  });
  if (axeSource) await context.addInitScript({ content: axeSource });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('icosa.guideSeen', '1');
      localStorage.setItem('icosa.introSeen', '1');
    } catch {
      /* private mode */
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`PAGE ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    await page.goto(`${base}${surface.route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForFunction(() => window.__NARIMATO_GDS__?.status?.().booted === true, null, { timeout: 30_000 });
    await settle(page);
    if (surface.setup) await surface.setup(page, { tag: nextTag, base });
    await settle(page);

    const checks = [
      ['axe', () => runAxe(page, surface)],
      ['tab-order', () => runTabOrder(page, surface, { walkTabs: engine === 'chromium' })],
      ['contrast', () => runContrast(page, surface)],
      ['zoom', () => runZoom(page, surface)],
      ['gds-ownership', () => runOwnership(page, surface, { root: ROOT })],
    ];
    for (const [name, check] of checks) {
      try {
        findings.push(...(await check()));
      } catch (error) {
        findings.push(
          createFinding({
            check: name,
            id: `${name}-incomplete`,
            surface: surface.id,
            selector: 'document',
            expected: 'check runs to completion',
            actual: error.message,
            severity: 'serious',
            status: 'incomplete',
            message: `${name} could not complete: ${error.message}`,
          }),
        );
      }
    }
    if (screenshotDir) {
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, `${engine}-${surface.id}.jpg`), type: 'jpeg', quality: 82 });
    }
    // Focus trap runs last because Escape dismisses the dialog.
    try {
      findings.push(...(await runFocusTrap(page, surface)));
    } catch (error) {
      findings.push(
        createFinding({
          check: 'focus-trap',
          id: 'focus-trap-incomplete',
          surface: surface.id,
          selector: surface.dialog || 'document',
          expected: 'focus-trap check runs to completion',
          actual: error.message,
          severity: 'serious',
          status: 'incomplete',
          message: `focus-trap could not complete: ${error.message}`,
        }),
      );
    }
    if (errors.length) {
      for (const message of [...new Set(errors)].slice(0, 5)) {
        findings.push(
          createFinding({
            check: 'runtime',
            id: 'page-error',
            surface: surface.id,
            selector: 'window',
            expected: 'no page or console errors',
            actual: message,
            severity: 'serious',
            status: 'failure',
            message,
          }),
        );
      }
    }
  } catch (error) {
    findings.push(
      createFinding({
        check: 'setup',
        id: 'surface-incomplete',
        surface: surface.id,
        selector: 'document',
        expected: `surface ${surface.id} is reachable`,
        actual: error.message,
        severity: 'critical',
        status: 'incomplete',
        message: `Surface ${surface.id} could not be audited: ${error.message}`,
      }),
    );
  } finally {
    await context.close();
  }
  return findings;
}

function aggregateReports(reports) {
  const summary = { pass: 0, warning: 0, failure: 0, incomplete: 0, suppressed: 0, total: 0 };
  for (const report of reports) {
    for (const key of Object.keys(summary)) summary[key] += report.summary[key] || 0;
  }
  const status = summary.failure
    ? 'failure'
    : summary.incomplete
      ? 'incomplete'
      : summary.warning
        ? 'warning'
        : 'pass';
  return { summary, status };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`a11y:gate — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.log('node scripts/a11y-gate.mjs --engine=chromium|webkit|both --out=artifacts/a11y [--only=id] [--strict-suppressions] [--screenshots=dir]');
    return 0;
  }

  let playwright;
  let axePath;
  try {
    playwright = loadPlaywright();
    axePath = resolveAxe();
  } catch (error) {
    console.error(`a11y:gate — ${error.message}`);
    return 2;
  }
  const axeSource = fs.readFileSync(axePath, 'utf8');

  let surfaces;
  try {
    surfaces = selectSurfaces(options.only);
  } catch (error) {
    console.error(`a11y:gate — ${error.message}`);
    return 2;
  }
  if (!surfaces.length) {
    console.error('a11y:gate — no surfaces selected');
    return 2;
  }

  const ledger = await loadLedger(options);
  const commit = readCommit(ROOT);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const engines = options.engine === 'both' ? ['chromium', 'webkit'] : [options.engine];
  const reports = [];
  let server = null;
  let dataDir = null;

  try {
    server = await startA11yServer(options);
    dataDir = server.dataDir;
    console.log(`a11y:gate — ${server.handle.url} (${surfaces.length} surface(s), engines: ${engines.join(', ')})`);
    for (const engine of engines) {
      const browserType = playwright[engine];
      if (!browserType) {
        throw new Error(`engine "${engine}" is not exported by the Playwright build`);
      }
      let browser;
      try {
        browser = await browserType.launch({ headless: true });
      } catch (error) {
        throw new Error(
          `could not launch ${engine}: ${error.message}. Install browsers with \`npx playwright install --with-deps ${engine}\`.`,
        );
      }
      const engineFindings = [];
      try {
        for (const surface of surfaces) {
          console.log(`  ${engine}/${surface.id}`);
          engineFindings.push(
            ...(await runSurface(browser, engine, surface, {
              base: server.handle.url,
              axeSource,
              screenshotDir: options.screenshots,
            })),
          );
        }
        for (const surface of surfaces) {
          if (!surface.motion) continue;
          engineFindings.push(
            ...(await runReducedMotion(browser, surface, { base: server.handle.url, axeSource })),
          );
        }
        if (engine !== 'chromium') {
          engineFindings.push(
            createFinding({
              check: 'tab-order',
              id: 'tab-walk-platform',
              surface: 'gate',
              selector: 'document',
              expected: 'a real Tab walk where the browser exposes button tabbing',
              actual: `${engine} uses the programmatic GDS tab-order assertion`,
              severity: 'minor',
              status: 'warning',
              message: `${engine} does not tab to buttons under its default keyboard policy; the gate uses the GDS expectGdsTabOrder assertion for this engine. Chromium runs the real Tab walk.`,
            }),
          );
        }
      } finally {
        await browser.close();
      }

      const applied = applySuppressions(engineFindings, ledger.suppressions, { now: new Date() });
      const findings = [...applied.findings];
      if (ledger.findings.length) findings.push(...ledger.findings);
      for (const suppression of applied.expired) {
        findings.push(
          createFinding({
            check: 'suppression-policy',
            id: 'suppression-expired',
            surface: suppression.route || 'ledger',
            selector: suppression.selector || 'document',
            expected: `owner ${suppression.owner} re-validates before ${suppression.expiresAt}`,
            actual: 'expired',
            severity: 'serious',
            status: 'failure',
            message: `Suppression ${suppression.id} expired on ${suppression.expiresAt}.`,
          }),
        );
      }
      for (const suppression of applied.unused) {
        const expired = new Date(`${suppression.expiresAt}T23:59:59.999Z`).getTime() < Date.now();
        const status = expired || options.strictSuppressions ? 'failure' : 'warning';
        findings.push(
          createFinding({
            check: 'suppression-policy',
            id: expired ? 'suppression-expired-unused' : 'suppression-unused',
            surface: suppression.route || 'ledger',
            selector: suppression.selector || 'document',
            expected: 'the suppressed rule still fires, or the entry is removed',
            actual: 'no finding matched',
            severity: expired ? 'serious' : 'minor',
            status,
            message: `Suppression ${suppression.id} matched no finding${expired ? ' and is expired' : ''}.`,
          }),
        );
      }

      const report = assembleReport({
        engine,
        commit,
        mode: surfaces.length === SURFACES.length ? 'full' : 'partial',
        surfaces,
        findings,
        suppressions: ledger.suppressions,
        suppressionAudit: applied,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      });
      reports.push(report);
      const filename = path.join(options.out, `report-${engine}.json`);
      await mkdir(options.out, { recursive: true });
      await writeFile(filename, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      const verdict = report.summary.failure || report.summary.incomplete ? 'failure' : report.summary.warning ? 'warning' : 'pass';
      console.log(
        `a11y: ${report.status === 'pass' ? 'clean' : report.status} (${engine}, ${surfaces.length} surfaces, ` +
          `${report.summary.failure} failure, ${report.summary.warning} warning, ${report.summary.incomplete} incomplete, ` +
          `${report.summary.suppressed} suppressed) -> ${verdict}`,
      );
      for (const finding of report.findings.filter((entry) => entry.status === 'failure' || entry.status === 'incomplete').slice(0, 40)) {
        console.error(`  - ${finding.surface} ${finding.check} ${finding.selector}: expected ${finding.expected}; actual ${finding.actual}`);
      }
    }

    const aggregate = aggregateReports(reports);
    const combined = {
      schemaVersion: A11Y_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      startedAt,
      durationMs: Date.now() - started,
      commit,
      mode: surfaces.length === SURFACES.length ? 'full' : 'partial',
      engine: options.engine,
      status: aggregate.status,
      summary: aggregate.summary,
      engines: reports,
      suppressions: ledger.suppressions,
      suppressionAudit: {
        applied: reports.flatMap((report) => report.suppressionAudit.applied),
        expired: reports.flatMap((report) => report.suppressionAudit.expired),
        unused: reports.flatMap((report) => report.suppressionAudit.unused),
      },
    };
    await mkdir(options.out, { recursive: true });
    await writeFile(path.join(options.out, 'report.json'), `${JSON.stringify(combined, null, 2)}\n`, 'utf8');
    const failing = aggregate.status === 'failure' || aggregate.status === 'incomplete' || reports.some((report) => report.summary.failure || report.summary.incomplete);
    return failing ? 1 : 0;
  } catch (error) {
    console.error(`a11y:gate — infrastructure error: ${error.message}`);
    await mkdir(options.out, { recursive: true }).catch(() => {});
    const failure = {
      schemaVersion: A11Y_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      commit,
      engine: options.engine,
      status: 'incomplete',
      error: error.message,
      summary: { pass: 0, warning: 0, failure: 0, incomplete: 1, suppressed: 0, total: 1 },
      findings: [
        createFinding({
          check: 'infrastructure',
          id: 'gate-incomplete',
          surface: 'gate',
          selector: 'browser',
          expected: 'browser and axe available',
          actual: error.message,
          severity: 'critical',
          status: 'incomplete',
          message: error.message,
        }),
      ],
    };
    await writeFile(path.join(options.out, 'report.json'), `${JSON.stringify(failure, null, 2)}\n`, 'utf8').catch(() => {});
    return 2;
  } finally {
    if (server && server.handle) await server.handle.close().catch(() => {});
    if (dataDir) await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }
}

process.exitCode = await main();
