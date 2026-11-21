/**
 * NARIMATO — shared acceptance harness (TST-01).
 *
 * One deterministic bootstrap for the browser acceptance scripts: an ephemeral
 * in-process server with a throwaway DATA_DIR, real GDS-only clients, condition
 * waits instead of sleeps, an artifacts directory and a machine-readable
 * report. No new npm dependency: Playwright always arrives through
 * `PLAYWRIGHT_MODULE`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SETTLE_MS = 300;
export const WAIT_MS = 5000;
export const HARD_MS = 15000;
export const SUPPLY_MIN_AGE_MS = 2000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Deterministic-ish run id: timestamp + short random suffix (filesystem safe). */
export function createRunId(prefix = 'run') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const suffix = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${prefix}-${stamp}-${suffix}`;
}

export function relativeToRoot(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/**
 * Boot the authoritative server on an ephemeral port with throwaway data.
 * @param {{config?:object, env?:object, quiet?:boolean}} [options]
 */
export async function startAcceptanceServer(options = {}) {
  const { startServer } = await import('../../server.js');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-acceptance-'));
  const env = { ...process.env, ...(options.env || {}), BOTS: '1', DATA_DIR: dataDir, SUPPLY_MIN_AGE_MS: String(SUPPLY_MIN_AGE_MS) };
  const handle = await startServer({
    port: 0,
    dataDir,
    quiet: options.quiet !== false,
    env,
    config: {
      bots: 1,
      supplyMinAgeMs: SUPPLY_MIN_AGE_MS,
      // Three alternating clicks break a cell (A, B, A) so the live-mutation
      // check is deterministic in a short run; production keeps the default.
      breakClicks: 3,
      clickCooldownMs: 0,
      botMinMs: 3_600_000,
      botMaxMs: 7_200_000,
      botClickMinMs: 400,
      botClickMaxMs: 900,
      botGapMinMs: 200,
      botGapMaxMs: 400,
      ...(options.config || {}),
    },
  });
  return {
    url: handle.url,
    dataDir,
    handle,
    async stop() {
      try { await handle.close(); } catch (_) { /* best effort */ }
      try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    },
  };
}

/** Launch the real Chromium and real GDS pages; no styles or controls change. */
export async function launchClients(playwright, count = 2) {
  const browser = await playwright.chromium.launch({ headless: true });
  const contexts = [];
  const pages = [];
  const errors = [];
  const consoleErrors = [];
  const refusals = [];
  for (let index = 0; index < count; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(`p${index} pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`p${index} console.error: ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.status() < 400) return;
      // Gameplay refusals are legitimate protocol answers (e.g. own-cell lock
      // while the surface autopilot mines); everything else is an error.
      if (response.url().includes('/api/action')) {
        response.json().then((body) => {
          refusals.push({ status: response.status(), url: response.url(), error: body && body.error ? body.error : null });
        }).catch(() => {
          refusals.push({ status: response.status(), url: response.url(), error: null });
        });
        return;
      }
      errors.push(`p${index} http ${response.status()}: ${response.url()}`);
    });
    contexts.push(context);
    pages.push(page);
  }
  return {
    browser,
    pages,
    errors,
    consoleErrors,
    refusals,
    async close() {
      try { await browser.close(); } catch (_) { /* best effort */ }
    },
  };
}

/** Read the landing join controls before the landing overlay is unmounted. */
export async function readJoinControls(page) {
  return page.evaluate(() => {
    const nameOf = (element) => (element ? element.getAttribute('aria-label') || element.textContent.trim() || null : null);
    const tagInput = document.querySelector('#tag-input');
    const joinButton = document.querySelector('#btn-join');
    return {
      tagInputName: nameOf(tagInput),
      joinName: nameOf(joinButton),
      tagTabbable: tagInput ? tagInput.tabIndex >= 0 : false,
      joinTabbable: joinButton ? joinButton.tabIndex >= 0 : false,
    };
  });
}

/** Join one page with a throwaway callsign and wait for the joined state. */
export async function joinClient(page, tag, baseUrl, { beforeJoin = null } = {}) {
  await page.goto(`${baseUrl}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tag-input', { timeout: HARD_MS });
  if (beforeJoin) await beforeJoin(page);
  await page.fill('#tag-input', tag);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__ && window.__ICOSA__.joined === true, null, { timeout: HARD_MS });
  return tag;
}

/** Enter surface mode through the product hook and wait for the walking phase. */
export async function enterSurfaceClient(page) {
  await page.evaluate(() => window.__ICOSA__.surface());
  await page.waitForFunction(() => window.__ICOSA__.surfaceMode().active === true, null, { timeout: HARD_MS });
  await page.waitForFunction(() => window.__ICOSA__.surfaceMode().phase === 'walking', null, { timeout: HARD_MS });
  await delay(SETTLE_MS);
}

/**
 * Poll a page predicate with condition waits (never fixed sleeps) and fail with
 * the predicate source plus a screenshot path when the budget expires.
 */
export async function waitFor(page, predicate, { label = 'condition', timeout = WAIT_MS, hard = HARD_MS, interval = 100, artifactDir = null, arg = null } = {}) {
  const source = String(predicate);
  try {
    await page.waitForFunction(predicate, arg, { timeout: Math.min(timeout, hard), polling: interval });
    return true;
  } catch (error) {
    let screenshot = null;
    if (artifactDir) {
      screenshot = await captureScreenshot(page, artifactDir, `fail-${label.replace(/[^a-z0-9]+/gi, '-')}`).catch(() => null);
    }
    throw Object.assign(
      new Error(`wait failed: ${label} — ${source}${screenshot ? ` (screenshot ${screenshot})` : ''}`),
      { checkId: label, screenshot, cause: error },
    );
  }
}

/** Read the full event ring recorded by the client (bounded 200). */
export async function readEventLog(page) {
  return page.evaluate(() => (typeof window.__ICOSA__.eventLog === 'function' ? window.__ICOSA__.eventLog() : []));
}

/** Authoritative action through the normal HTTP path (never a mock). */
export async function postAction(page, body) {
  return page.evaluate(async (payload) => {
    const token = localStorage.getItem('icosa.token');
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, ...payload }),
    });
    let json = null;
    try { json = await response.json(); } catch (_) { json = null; }
    return { status: response.status, body: json };
  }, body);
}

/** Poll the supply action until it returns 200 (the gate is time-based). */
export async function requestSupply(page, { hard = HARD_MS, interval = 300 } = {}) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < hard) {
    last = await postAction(page, { type: 'supply' });
    if (last.status === 200 && last.body && last.body.ok) return last;
    const readyIn = last.body && Number.isFinite(last.body.readyInMs) ? last.body.readyInMs : null;
    await delay(Math.min(interval, readyIn && readyIn > 0 ? Math.max(120, readyIn + 60) : interval));
  }
  throw Object.assign(new Error(`supply gate not ready within ${hard} ms (last ${last && last.status})`), { harness: true });
}

export function newAcceptanceReport({ runId, baseUrl, planetSeed = null, planetIndex = null, tags = [] } = {}) {
  return {
    runId,
    baseUrl,
    planetSeed,
    planetIndex,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    tags,
    checks: [],
    peers: [],
    beams: [],
    supply: null,
    liveMutation: null,
    artifacts: [],
    errors: [],
    ok: false,
  };
}

/** Exit-code contract: report.ok is computed by writeReport(), never by the caller. */
export function acceptanceExitCode(report, { harnessFailure = false } = {}) {
  if (!report || typeof report !== 'object') return 2;
  return report.ok ? 0 : harnessFailure ? 2 : 1;
}

export function addCheck(report, id, ok, detail = null) {
  const check = { id, ok: !!ok, detail };
  report.checks.push(check);
  return check;
}

/** Create the artifact directory and return a context object for screenshots. */
export function createArtifactDir(runId, subdir = 'acceptance') {
  const dir = path.join(ROOT, 'media', subdir, runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function captureScreenshot(page, dir, name) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return relativeToRoot(file);
}

export function writeReport(dir, report) {
  report.finishedAt = report.finishedAt || new Date().toISOString();
  if (report.startedAt) report.durationMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  report.ok = report.errors.length === 0 && report.checks.every((check) => check.ok);
  const file = path.join(dir, 'report.json');
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return relativeToRoot(file);
}

/** Resolve Playwright from PLAYWRIGHT_MODULE with the documented failure mode. */
export async function loadPlaywright() {
  const modulePath = process.env.PLAYWRIGHT_MODULE || '';
  if (!modulePath) {
    throw Object.assign(
      new Error('PLAYWRIGHT_MODULE is not set // run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-two-client-surface.mjs'),
      { harness: true },
    );
  }
  const require = (await import('node:module')).createRequire(import.meta.url);
  try {
    return require(modulePath);
  } catch (error) {
    throw Object.assign(new Error(`cannot load Playwright at ${modulePath}: ${error.message}`), { harness: true });
  }
}

/**
 * Collapse a client's raw signals into the acceptance error list. Page errors
 * and unexpected HTTP always fail; gameplay protocol refusals
 * (`OWN_CELL_LOCKED`, `COOLDOWN`) are recorded separately, including their
 * browser "Failed to load resource" console noise.
 */
// NOT_A_LEAF is a legitimate server answer when a target is no longer a
// harvestable leaf at click time (own lock, contested cell, exhausted deposit);
// it is an expected refusal, not a page error.
export const DEFAULT_ALLOWED_REFUSALS = Object.freeze(['OWN_CELL_LOCKED', 'COOLDOWN', 'POSE_RATE_LIMIT', 'SUPPLY_NOT_READY', 'NOT_A_LEAF']);

export function collectErrors(clients, { allowedRefusals = DEFAULT_ALLOWED_REFUSALS } = {}) {
  const list = [...clients.errors];
  const allowed = [];
  const unexpected = [];
  for (const refusal of clients.refusals || []) {
    if (refusal.error && allowedRefusals.includes(refusal.error)) allowed.push(refusal);
    else unexpected.push(refusal);
  }
  for (const refusal of unexpected) list.push(`http ${refusal.status} ${refusal.url} ${refusal.error || ''}`.trim());
  for (const message of clients.consoleErrors || []) {
    if (/Failed to load resource/.test(message) && (clients.refusals || []).length > 0) continue;
    list.push(message);
  }
  return {
    errors: [...new Set(list)],
    allowedRefusals: allowed,
    unexpectedRefusals: unexpected,
  };
}

/** Convert a numeric bound into a reported boolean with the observed value. */
export function within(value, max) {
  return Number.isFinite(value) && value <= max;
}

export { delay };
