/**
 * CTL-03 acceptance: harvest truth round-trip against /api/action.
 *
 * Kept separate from scripts/acceptance-harvest-roundtrip.mjs, which TST-01 owns for
 * the surface-mine/beam ordering proof. This script proves both directions of
 * the chip <-> /api/action contract, including a maximum-depth cell.
 *
 * Proves the chip colour is exactly the server verdict:
 *  - green  -> the next click returns 200;
 *  - red    -> the next click returns 409 with the mapped reason;
 *  - a maximum-depth cell stays green and scores (exhausted is informational).
 *
 * Runs an isolated server with BREAK_CLICKS=8, MAX_DEPTH=1 so a broken cell's
 * children are maximum-depth leaves, and uses a second identity to contest.
 *
 * Run: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-harvest-roundtrip.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startLocalServer, loadPlaywright, launchChromium, finish, dismissGameOverlays, ROOT } from './lib/local-server.mjs';

const failures = [];
let finished = false;
const shotsDir = path.join(ROOT, 'media', 'ctl');
await mkdir(shotsDir, { recursive: true });

const server = await startLocalServer({
  port: Number(process.env.ACCEPTANCE_PORT) || 0,
  env: { BREAK_CLICKS: '8', MAX_DEPTH: '1', CLICK_COOLDOWN_MS: '40', BOTS: '0' },
});
const { chromium } = await loadPlaywright();
const browser = await launchChromium(chromium);
browser.on('disconnected', () => { if (!finished) failures.push('browser disconnected before the run completed'); });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  // 404 favicon and the deliberate 409 negative probes are not page errors.
  if (/favicon/i.test(text) || /404 \(Not Found\)/.test(text) || /409 \(Conflict\)/.test(text)) return;
  consoleErrors.push(text);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** POST /api/action from the page origin (same headers as the game). */
async function action(token, type, label) {
  return page.evaluate(async ({ token, type, label }) => {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, type, label }),
    });
    return { status: res.status, body: await res.json() };
  }, { token, type, label });
}

async function waitFor(predicate, { timeout = 8000, interval = 100 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await sleep(interval);
  }
  return null;
}

try {
  await page.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private */ }
  });
  await page.goto(`${server.base}/?gds=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.fill('#tag-input', 'TRUTH');
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await dismissGameOverlays(page);
  const tokenA = await page.evaluate(() => localStorage.getItem('icosa.token'));

  // Second identity used only to contest cells (no second browser needed).
  const rival = await page.evaluate(async () => {
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tag: 'RIVAL' }),
    });
    return res.json();
  });
  const tokenB = rival.token;

  // Pause the footprint auto-harvest so this script owns every click it asserts.
  await page.evaluate(() => window.__ICOSA__.surfaceAutoHarvest(false));
  await page.evaluate(() => window.__ICOSA__.surface());
  await page.waitForFunction(() => window.__ICOSA__.surfaceMode().phase === 'walking', null, { timeout: 12000 });
  await sleep(400);
  const target = await waitFor(async () => {
    const debug = await page.evaluate(() => window.__ICOSA__.surfaceDebug());
    return debug && debug.targetLabel ? debug : null;
  });
  if (!target) throw new Error('surface target never resolved');
  const entry = {
    targetLabel: target.targetLabel,
    targetCan: target.targetCan,
    targetReason: target.targetReason,
    targetExhausted: target.targetExhausted,
  };

  /* green chip -> 200 */
  if (target.targetCan !== true) failures.push(`target ${target.targetLabel} is not green before the first click (${target.targetReason})`);
  const greenText = await page.evaluate(() => document.getElementById('surface-target')?.textContent || '');
  entry.greenChipText = greenText;
  if (!/GREEN \/\/ HARVEST/.test(greenText)) failures.push(`green chip text is "${greenText}"`);
  await page.screenshot({ path: path.join(shotsDir, 'surface-truth-green.jpg'), type: 'jpeg', quality: 82 });
  const greenClick = await action(tokenA, 'click', target.targetLabel);
  entry.greenClick = { status: greenClick.status, error: greenClick.body?.error || null, points: greenClick.body?.points ?? null };
  if (greenClick.status !== 200 || greenClick.body?.ok !== true) {
    failures.push(`green target did not yield 200 (got ${greenClick.status} ${greenClick.body?.error})`);
  }

  /* own lock is red and 409 with the same reason */
  await sleep(80);
  const redChip = await waitFor(async () => {
    const text = await page.evaluate(() => document.getElementById('surface-target')?.textContent || '');
    return /RED \/\/ LOCKED/.test(text) ? text : null;
  });
  entry.redChipText = redChip;
  if (!redChip) failures.push('chip did not turn RED // LOCKED after the server accepted the first click');
  await page.screenshot({ path: path.join(shotsDir, 'surface-truth-red.jpg'), type: 'jpeg', quality: 82 });
  const lockClick = await action(tokenA, 'click', target.targetLabel);
  entry.redClick = { status: lockClick.status, error: lockClick.body?.error || null };
  if (lockClick.status !== 409 || lockClick.body?.error !== 'OWN_CELL_LOCKED') {
    failures.push(`red target did not yield 409 OWN_CELL_LOCKED (got ${lockClick.status} ${lockClick.body?.error})`);
  }
  const redStatus = await page.evaluate((label) => window.__ICOSA__.harvestStatusFor(label), target.targetLabel);
  entry.redPredicate = redStatus;
  if (!redStatus || redStatus.can !== false || redStatus.reason !== 'own_lock') failures.push('predicate and 409 reason disagree');

  /* break the cell into maximum-depth children using two identities.
     The first click must come from the rival: tokenA is own-locked by the
     accepted green click above. */
  let lastClicker = tokenA;
  let broke = null;
  for (let click = 0; click < 8; click += 1) {
    const actor = click % 2 === 0 ? tokenB : tokenA;
    await sleep(60);
    const res = await action(actor, 'click', target.targetLabel);
    if (res.status !== 200) {
      failures.push(`break loop click ${click + 1} failed: ${res.status} ${res.body?.error}`);
      break;
    }
    lastClicker = actor;
    if (res.body?.broke) { broke = res.body; break; }
  }
  entry.break = broke ? { broke: true, children: broke.children.map((child) => child[0]) } : null;
  if (!broke) throw new Error('the target never broke into children');
  const childLabel = broke.children[0][0];

  /* Deep cell: exhausted is informational, green after a contest -> 200 + score.
     Arrange that tokenA is the *next* legitimate clicker: if B locked the child,
     A contests and B contests back, then A is green again. */
  const contest = [];
  if (lastClicker === tokenB) {
    const first = await action(tokenA, 'click', childLabel);
    contest.push({ actor: 'A', status: first.status, error: first.body?.error || null });
    await sleep(60);
    const second = await action(tokenB, 'click', childLabel);
    contest.push({ actor: 'B', status: second.status, error: second.body?.error || null });
  } else {
    const only = await action(tokenB, 'click', childLabel);
    contest.push({ actor: 'B', status: only.status, error: only.body?.error || null });
  }
  entry.deepContest = { lastClicker: lastClicker === tokenA ? 'A' : 'B', attempts: contest };
  for (const attempt of contest) {
    if (attempt.status !== 200) failures.push(`contesting the deep child as ${attempt.actor} failed: ${attempt.status} ${attempt.error}`);
  }
  await sleep(120);
  await page.evaluate((label) => window.__ICOSA__.surfaceFocus(label), childLabel);
  entry.afterContest = await page.evaluate(async (label) => {
    const node = window.__ICOSA__.world.get(label);
    const res = await fetch(`/api/world?token=${encodeURIComponent(localStorage.getItem('icosa.token') || '')}`);
    const world = await res.json();
    const leaf = (world.leaves || []).find((entry) => entry[0] === label) || null;
    return {
      client: node ? { owner: node.ownerIndex, last: node.lastClickIndex, clicks: node.clicks, epoch: node.leafEpoch } : null,
      server: leaf,
      epoch: window.__ICOSA__.harvestContext().leafEpoch,
    };
  }, childLabel);
  const deepStatus = await waitFor(async () => {
    const status = await page.evaluate((label) => window.__ICOSA__.harvestStatusFor(label), childLabel);
    return status && status.can ? status : null;
  });
  entry.deepPredicate = deepStatus;
  if (!deepStatus) {
    entry.deepPredicateObserved = await page.evaluate((label) => {
      const raw = window.__ICOSA__.harvestStatusFor(label);
      return { raw, ctx: window.__ICOSA__.harvestContext(), myIndex: window.__ICOSA__.cameraInertia ? undefined : undefined };
    }, childLabel);
    failures.push(`deep child predicate did not turn green after a contest (${JSON.stringify(entry.deepPredicateObserved)})`);
  }
  if (deepStatus && deepStatus.exhausted !== true) failures.push('deep child did not report exhausted=true');
  const deepChip = await waitFor(async () => {
    const debug = await page.evaluate(() => window.__ICOSA__.surfaceDebug());
    return debug && debug.targetLabel === childLabel && debug.targetCan ? debug : null;
  }, { timeout: 3000 });
  entry.deepChip = deepChip;
  if (!deepChip) failures.push('deep child chip did not turn green');
  const deepClick = await action(tokenA, 'click', childLabel);
  entry.deepClick = {
    status: deepClick.status,
    error: deepClick.body?.error || null,
    points: deepClick.body?.points ?? null,
    kind: deepClick.body?.kind || null,
  };
  if (deepClick.status !== 200 || deepClick.body?.ok !== true) {
    failures.push(`green deep cell did not score (got ${deepClick.status} ${deepClick.body?.error})`);
  }
  if (!(deepClick.body?.points > 0)) failures.push('deep click returned no points — green did not mean scoring');

  /* deep own lock -> 409 with the same reason */
  await sleep(80);
  const deepLock = await action(tokenA, 'click', childLabel);
  entry.deepLock = { status: deepLock.status, error: deepLock.body?.error || null };
  if (deepLock.status !== 409 || deepLock.body?.error !== 'OWN_CELL_LOCKED') {
    failures.push(`deep own-lock did not return 409 OWN_CELL_LOCKED (${deepLock.status} ${deepLock.body?.error})`);
  }

  for (const err of consoleErrors) failures.push(`console error: ${err}`);
  finished = true;
  await finish({
    issue: 'CTL-03',
    entry,
    screenshots: ['media/ctl/surface-truth-green.jpg', 'media/ctl/surface-truth-red.jpg'],
    consoleErrors,
    failures,
  });
} catch (err) {
  finished = true;
  failures.push(`acceptance crashed: ${err && err.message ? err.message : String(err)}`);
  await finish({ issue: 'CTL-03', failures, serverLog: server.log().slice(-1200) });
} finally {
  await browser.close();
  await server.stop();
}
