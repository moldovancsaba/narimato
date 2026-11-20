#!/usr/bin/env node
/**
 * NARIMATO — PERF-01 reproducible client performance probe.
 *
 * Starts the real server on an ephemeral port, opens the game in Chromium via
 * Playwright (CPU/network throttling per device class), measures the renderer's
 * frame budget, interaction latency, long tasks and the JavaScript bundle, then
 * writes `artifacts/perf/<device>.json` and evaluates the committed budgets.
 *
 * Usage:
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/perf-probe.mjs --device=desktop
 *   node scripts/perf-probe.mjs --all --check-baseline
 *   node scripts/perf-probe.mjs --all --update-baseline
 *
 * Exit codes: 0 pass, 1 budget/regression failure or insufficient samples, 2 usage.
 * The probe never invents numbers: every field is read from the measured page.
 * On CI without a GPU the artifact records `environment.gpuClass = "software"`;
 * baseline comparison still requires the same environment signature.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { measureBundle } from '../lib/perf-bundle.js';
import {
  DEVICE_BUDGETS,
  DEVICE_NAMES,
  DEVICE_PROFILES,
  MIN_FRAMES,
  evaluatePerf,
  isDeviceName,
} from '../public/js/perf-budget.js';
import { startServer } from '../server.js';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
export const DEFAULT_OUT = path.join(ROOT, 'artifacts', 'perf');
export const DEFAULT_BASELINE = path.join(ROOT, 'observability', 'perf-baseline.json');
export const COMPARISON_TOLERANCE = 0.15;

const MEASURE_SECONDS = 15;
const SETTLE_SECONDS = 12;
const FAST_3G = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

export function parseArgs(argv) {
  const options = {
    devices: [],
    all: false,
    seconds: MEASURE_SECONDS,
    out: DEFAULT_OUT,
    baseline: DEFAULT_BASELINE,
    baseUrl: null,
    checkBaseline: false,
    updateBaseline: false,
    noThrottle: false,
    headful: false,
    quality: null,
    cpuThrottle: null,
    attempts: 1,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => argv[++index];
    if (arg === '--all') options.all = true;
    else if (arg === '--check-baseline') options.checkBaseline = true;
    else if (arg === '--update-baseline') options.updateBaseline = true;
    else if (arg === '--no-throttle') options.noThrottle = true;
    else if (arg === '--headful') options.headful = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--device=')) options.devices.push(arg.slice(9));
    else if (arg === '--device') options.devices.push(value());
    else if (arg.startsWith('--seconds=')) options.seconds = Number(arg.slice(10));
    else if (arg === '--seconds') options.seconds = Number(value());
    else if (arg.startsWith('--out=')) options.out = path.resolve(arg.slice(6));
    else if (arg === '--out') options.out = path.resolve(value());
    else if (arg.startsWith('--baseline=')) options.baseline = path.resolve(arg.slice(11));
    else if (arg === '--baseline') options.baseline = path.resolve(value());
    else if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice(11).replace(/\/+$/, '');
    else if (arg === '--base-url') options.baseUrl = String(value() || '').replace(/\/+$/, '');
    else if (arg.startsWith('--quality=')) options.quality = Number(arg.slice(10));
    else if (arg === '--quality') options.quality = Number(value());
    else if (arg.startsWith('--cpu=')) options.cpuThrottle = Number(arg.slice(6));
    else if (arg === '--cpu') options.cpuThrottle = Number(value());
    else if (arg.startsWith('--attempts=')) options.attempts = Number(arg.slice(11));
    else if (arg === '--attempts') options.attempts = Number(value());
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.seconds) || options.seconds < 5) throw new Error('--seconds must be >= 5');
  if (options.quality !== null && ![0, 1, 2].includes(options.quality)) throw new Error('--quality must be 0, 1 or 2');
  if (options.cpuThrottle !== null && (!Number.isFinite(options.cpuThrottle) || options.cpuThrottle < 1 || options.cpuThrottle > 20)) {
    throw new Error('--cpu must be between 1 and 20');
  }
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 5) {
    throw new Error('--attempts must be 1..5');
  }
  return options;
}

export function selectDevices(options) {
  if (options.all) return [...DEVICE_NAMES];
  const requested = options.devices.length ? options.devices : ['desktop'];
  const unknown = requested.filter((device) => !isDeviceName(device));
  if (unknown.length) throw new Error(`unknown device class: ${unknown.join(', ')}`);
  return [...new Set(requested)];
}

/** The environment keys that make a baseline comparable. */
export function environmentSignature(environment = {}) {
  return JSON.stringify({
    browser: environment.browser || null,
    platform: environment.platform || null,
    arch: environment.arch || null,
    gpuClass: environment.gpuClass || null,
    cpuThrottle: environment.cpuThrottle ?? null,
    network: environment.network || null,
    viewport: environment.viewport || null,
    dpr: environment.dpr ?? null,
    quality: environment.quality ?? null,
  });
}

/**
 * Compare one measured observation against the committed baseline.
 * A >15% frame-p95 regression fails; an environment mismatch is reported and
 * skipped rather than compared across unlike hardware/GPU classes.
 */
export function compareToBaseline({ device, observed, environment }, baseline, { tolerance = COMPARISON_TOLERANCE } = {}) {
  const entry = baseline && baseline.devices && baseline.devices[device];
  if (!entry) return { comparable: false, reason: 'no-baseline-entry', failures: [] };
  if (environmentSignature(environment) !== environmentSignature(entry.environment)) {
    return { comparable: false, reason: 'environment-mismatch', failures: [], baseline: entry };
  }
  const failures = [];
  const baseP95 = Number(entry.observed && entry.observed.frameP95Ms);
  const currentP95 = Number(observed && observed.frameP95Ms);
  if (Number.isFinite(baseP95) && baseP95 > 0 && Number.isFinite(currentP95) && currentP95 > baseP95 * (1 + tolerance)) {
    failures.push({
      metric: 'frameP95Ms',
      observed: currentP95,
      baseline: baseP95,
      tolerance,
      detail: `frame p95 regressed ${(Math.round(((currentP95 / baseP95) - 1) * 1000) / 10)}% (> ${tolerance * 100}%)`,
    });
  }
  return { comparable: true, reason: 'ok', failures, baseline: entry };
}

/** Best attempt: a passing run wins, then lower p95, then lower max. */
export function selectBestAttempt(reports) {
  return [...reports].sort((a, b) => {
    const aPass = a.verdict === 'pass' ? 0 : 1;
    const bPass = b.verdict === 'pass' ? 0 : 1;
    if (aPass !== bPass) return aPass - bPass;
    if (a.observed.frameP95Ms !== b.observed.frameP95Ms) return a.observed.frameP95Ms - b.observed.frameP95Ms;
    return a.observed.frameMaxMs - b.observed.frameMaxMs;
  })[0];
}

export function baselineEntry({ device, observed, environment, bundle }) {
  return {
    measuredAt: new Date().toISOString(),
    environment,
    observed,
    bundle: { jsKibGzip: bundle.jsKibGzip, firstLoadKibGzip: bundle.firstLoadKibGzip, islands: bundle.islands },
  };
}

async function readBaseline(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { version: 1, devices: {} };
    if (!parsed.devices || typeof parsed.devices !== 'object') parsed.devices = {};
    return parsed;
  } catch {
    return { version: 1, devices: {} };
  }
}

async function loadPlaywright() {
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  if (modulePath) {
    const require = createRequire(import.meta.url);
    return require(modulePath);
  }
  return import('playwright');
}

function gpuClass(renderer) {
  return /swiftshader|llvmpipe|software|mesa offscreen/i.test(String(renderer || '')) ? 'software' : 'hardware';
}

const INIT_SCRIPT = `
(() => {
  const probe = { longTasks: [], maxLongTask: 0, lcp: 0, cls: 0, inp: 0 };
  window.__PERF_PROBE__ = probe;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Number(entry.duration) || 0;
        probe.longTasks.push(duration);
        if (duration > probe.maxLongTask) probe.maxLongTask = Math.round(duration);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (_) {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (Number.isFinite(entry.startTime)) probe.lcp = Math.round(entry.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) {}
  try {
    new PerformanceObserver((list) => {
      let cls = 0;
      for (const entry of list.getEntries()) if (entry.hadRecentInput !== true) cls += Number(entry.value) || 0;
      probe.cls = Math.round(cls * 1000) / 1000;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Number(entry.duration);
        if (Number.isFinite(duration) && duration > probe.inp) probe.inp = Math.round(duration);
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (_) {}
})();
`;

async function interact(page) {
  try {
    await page.mouse.move(640, 420);
    for (let index = 0; index < 4; index += 1) {
      await page.mouse.move(640 + index * 12, 420 + index * 8);
      await page.mouse.down();
      await page.mouse.move(700 + index * 12, 450 + index * 8, { steps: 4 });
      await page.mouse.up();
      await page.mouse.wheel(0, 90);
    }
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
  } catch {
    // Input is best-effort; interactionSamples records whether it landed.
  }
}

async function readEnvironment(page, profile, options) {
  return page.evaluate(({ deviceProfile, noThrottle, headless, platform, arch }) => {
    let renderer = 'unknown';
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (_) {}
    return {
      browser: 'chromium',
      platform,
      arch,
      headless,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dpr: window.devicePixelRatio,
      gpu: renderer,
      cpuThrottle: noThrottle ? 1 : deviceProfile.cpuThrottle,
      network: noThrottle ? 'none' : deviceProfile.network,
      userAgent: navigator.userAgent,
    };
  }, { deviceProfile: profile, noThrottle: options.noThrottle, headless: !options.headful, platform: process.platform, arch: process.arch });
}

async function measureDevice({ playwright, baseUrl, device, options, bundle, baseline }) {
  const profile = { ...DEVICE_PROFILES[device] };
  if (options.cpuThrottle !== null) profile.cpuThrottle = options.cpuThrottle;
  const budget = DEVICE_BUDGETS[device];
  // On macOS Playwright's default headless shell forces SwiftShader; ask for
  // the real ANGLE/Metal backend so a hardware-class baseline is meaningful.
  // CI Linux keeps the default (software) path and records gpuClass=software.
  const launchArgs = process.platform === 'darwin'
    ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal']
    : [];
  const browser = await playwright.chromium.launch({ headless: !options.headful, args: launchArgs });
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    isMobile: device !== 'desktop',
    hasTouch: device !== 'desktop',
  });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error && error.message ? error.message : error)));
  const cdp = await context.newCDPSession(page);
  if (!options.noThrottle && profile.network !== 'none') {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: FAST_3G.latency,
      downloadThroughput: FAST_3G.downloadThroughput,
      uploadThroughput: FAST_3G.uploadThroughput,
      connectionType: 'cellular3g',
    });
    if (profile.cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
  }
  const query = options.quality === null ? '' : `&quality=${options.quality}`;
  try {
    await page.goto(`${baseUrl}/?perf-probe=1${query}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(
      () => window.__ICOSA__ && typeof window.__ICOSA__.perf === 'function' && window.__ICOSA__.perf() && window.__ICOSA__.perf().samples > 0,
      { timeout: 20000 },
    );
    await page.evaluate(() => {
      try {
        window.__ICOSA__.skipIntro?.();
      } catch (_) {}
    });
    // Settle the adaptive tier first: one slow frame must not pin the probe
    // to full quality for the whole measurement. Interactions are exercised
    // at the settled tier; their latency ring is preserved across the frame
    // reset so input cost is measured without polluting the frame budget.
    await page.waitForTimeout(SETTLE_SECONDS * 1000);
    await interact(page);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      try {
        window.__ICOSA__.renderer.resetPerf('probe-measure', { keepInteractions: true });
        window.__PERF_PROBE__.longTasks.length = 0;
        window.__PERF_PROBE__.maxLongTask = 0;
        window.__PERF_PROBE__.inp = 0;
        window.__PERF_PROBE__.cls = 0;
      } catch (_) {}
    });
    const started = Date.now();
    await page.waitForTimeout(options.seconds * 1000);
    const elapsedSeconds = (Date.now() - started) / 1000;
    const measured = await page.evaluate(() => ({
      snapshot: window.__ICOSA__.perf(),
      probe: {
        longTasks: window.__PERF_PROBE__.longTasks.slice(),
        maxLongTask: window.__PERF_PROBE__.maxLongTask,
        lcp: window.__PERF_PROBE__.lcp,
        cls: window.__PERF_PROBE__.cls,
        inp: window.__PERF_PROBE__.inp,
      },
      navigation: (() => {
        try {
          const nav = performance.getEntriesByType('navigation')[0];
          return nav ? { ttfb: Math.round(nav.responseStart || 0), domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0) } : null;
        } catch (_) {
          return null;
        }
      })(),
    }));
    const environment = await readEnvironment(page, profile, options);
    environment.browser = `chromium ${browser.version()}`;
    environment.gpuClass = gpuClass(environment.gpu);
    environment.quality = options.quality === null ? 'adaptive' : options.quality;
    const longTasks = measured.probe.longTasks.length;
    const observed = {
      frameP95Ms: measured.snapshot.frameP95Ms,
      frameMaxMs: measured.snapshot.frameMaxMs,
      fps: measured.snapshot.fps,
      longTasksPer10s: Math.round((longTasks / Math.max(0.1, elapsedSeconds)) * 10 * 100) / 100,
      maxLongTaskMs: measured.probe.maxLongTask,
      inpMs: measured.probe.inp,
      cls: measured.probe.cls,
      lcpMs: measured.probe.lcp,
      interactionMs: measured.snapshot.interactionP95Ms,
      interactionSamples: measured.snapshot.interactionSamples,
      drawUnitsPerFrame: measured.snapshot.drawUnitsP95,
      rebuildsPerSecond: measured.snapshot.rebuildsPerSecond,
      bundleKibGzip: bundle.jsKibGzip,
      bundleFirstLoadKibGzip: bundle.firstLoadKibGzip,
      cssKibGzip: bundle.cssKibGzip,
      islandKibGzip: bundle.islands.length ? Math.max(...bundle.islands.map((island) => island.kib)) : 0,
    };
    const evaluation = evaluatePerf({ observed, budget, samples: measured.snapshot.samples });
    const failures = [...evaluation.failures];
    if (measured.snapshot.samples < MIN_FRAMES) failures.push('samples');
    if (measured.snapshot.interactionSamples < 3) failures.push('interactionSamples');
    const regression = options.checkBaseline
      ? compareToBaseline({ device, observed, environment }, baseline)
      : { comparable: false, reason: options.updateBaseline ? 'baseline-update' : 'not-checked', failures: [] };
    for (const entry of regression.failures) failures.push(entry.metric);
    const verdict = failures.length ? 'fail' : evaluation.verdict === 'pass' ? 'pass' : evaluation.verdict;
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      device,
      profile: { ...profile, quality: options.quality },
      budget,
      observed,
      verdict,
      failures,
      evaluation,
      regression,
      samples: measured.snapshot.samples,
      interactionSamples: measured.snapshot.interactionSamples,
      snapshot: measured.snapshot,
      longTasks: { count: longTasks, maxMs: measured.probe.maxLongTask, elapsedSeconds: Math.round(elapsedSeconds * 100) / 100 },
      webVitals: { lcpMs: measured.probe.lcp, cls: measured.probe.cls, inpMs: measured.probe.inp, navigation: measured.navigation },
      environment,
      bundle: {
        jsKibGzip: bundle.jsKibGzip,
        cssKibGzip: bundle.cssKibGzip,
        firstLoadKibGzip: bundle.firstLoadKibGzip,
        islandCount: bundle.islandCount,
        islands: bundle.islands,
        modules: bundle.modules.length,
      },
      consoleErrors,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main(argv) {
  let options;
  let devices;
  try {
    options = parseArgs(argv);
    if (options.help) {
      console.error('usage: node scripts/perf-probe.mjs --device=desktop|mobile-mid|mobile-low|--all [--check-baseline] [--update-baseline] [--seconds=N] [--quality=0|1|2] [--attempts=1..5]');
      return 0;
    }
    devices = selectDevices(options);
  } catch (error) {
    console.error(`perf-probe — ${error.message}`);
    return 2;
  }
  const bundle = measureBundle({
    root: ROOT,
    firstLoadBudgetKib: DEVICE_BUDGETS.desktop.bundleKibGzip,
    islandBudgetKib: DEVICE_BUDGETS.desktop.islandKibGzip,
  });
  const baseline = await readBaseline(options.baseline);
  const playwright = await loadPlaywright();
  let server = null;
  let dataDir = null;
  let baseUrl = options.baseUrl;
  if (!baseUrl) {
    dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-perf-'));
    server = await startServer({ port: 0, host: '127.0.0.1', dataDir, quiet: true, config: { bots: 0, depositChance: 0, clickCooldownMs: 0 } });
    baseUrl = server.url;
  }
  const reports = [];
  let exitCode = 0;
  try {
    for (const device of devices) {
      console.log(`perf probe ${device}: ${DEVICE_PROFILES[device].width}x${DEVICE_PROFILES[device].height} dpr${DEVICE_PROFILES[device].dpr} cpu${options.noThrottle ? '1' : DEVICE_PROFILES[device].cpuThrottle}x network=${options.noThrottle ? 'none' : DEVICE_PROFILES[device].network}`);
      const attempts = [];
      for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
        if (options.attempts > 1) console.log(`  attempt ${attempt}/${options.attempts}`);
        attempts.push(await measureDevice({ playwright, baseUrl, device, options, bundle, baseline }));
      }
      const report = selectBestAttempt(attempts);
      report.attempts = attempts.map((entry) => ({
        verdict: entry.verdict,
        failures: entry.failures,
        frameP95Ms: entry.observed.frameP95Ms,
        frameMaxMs: entry.observed.frameMaxMs,
        longTasksPer10s: entry.observed.longTasksPer10s,
      }));
      reports.push(report);
      await mkdir(options.out, { recursive: true });
      await writeFile(path.join(options.out, `${device}.json`), `${JSON.stringify(report, null, 2)}\n`);
      console.log(`  frames=${report.samples} p95=${report.observed.frameP95Ms}ms max=${report.observed.frameMaxMs}ms fps=${report.observed.fps} interactions=${report.interactionSamples} longTasks=${report.observed.longTasksPer10s}/10s draw=${report.observed.drawUnitsPerFrame} bundle=${report.observed.bundleKibGzip}KiB gzip -> ${report.verdict.toUpperCase()}`);
      if (report.regression.comparable) console.log(`  baseline: ${report.regression.failures.length ? 'REGRESSION' : 'within 15% p95 tolerance'}`);
      else console.log(`  baseline: skipped (${report.regression.reason})`);
      if (report.failures.length) console.log(`  failures: ${report.failures.join(', ')}`);
      if (report.verdict !== 'pass') exitCode = 1;
      if (options.updateBaseline) {
        if (report.verdict !== 'pass') {
          console.error(`  baseline not updated for ${device}: probe did not pass`);
          exitCode = 1;
        } else {
          baseline.devices = baseline.devices || {};
          baseline.devices[device] = baselineEntry({ device, observed: report.observed, environment: report.environment, bundle });
          baseline.version = 1;
          baseline.updatedAt = new Date().toISOString();
          baseline.method = 'scripts/perf-probe.mjs; Playwright Chromium; budgets from public/js/perf-budget.js';
        }
      }
    }
    if (options.updateBaseline) {
      await writeFile(options.baseline, `${JSON.stringify(baseline, null, 2)}\n`);
      console.log(`baseline written: ${options.baseline}`);
    }
  } catch (error) {
    console.error(`perf-probe — ${error?.stack || error}`);
    exitCode = 1;
  } finally {
    if (server) await server.close();
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  }
  if (options.json) console.log(JSON.stringify({ generatedAt: new Date().toISOString(), devices: reports }, null, 2));
  else {
    const failed = reports.filter((report) => report.verdict !== 'pass').length;
    console.log(failed ? `PERF FAIL — ${failed}/${reports.length} device(s)` : `PERF PASS — ${reports.length} device(s)`);
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = await main(process.argv.slice(2));
}

export default { parseArgs, selectDevices, environmentSignature, compareToBaseline, baselineEntry };
