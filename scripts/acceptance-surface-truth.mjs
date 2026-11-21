#!/usr/bin/env node
/**
 * NARIMATO — surface truth acceptance (TST-01 step set).
 *
 * Proves the HUD harvest verdict and the authoritative mine frame agree:
 *   - the surface target readout says HARVEST only when `/api/action` awards
 *     the click, and LOCKED when the server refuses it;
 *   - at least one `surface_mine` frame names a cell that a `cell`/`break`
 *     frame already changed (the renderer beam's only legal source).
 *
 * Usage: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-surface-truth.mjs
 * Exit: 0 pass, 1 failed check, 2 harness failure. Report: media/acceptance/<runId>/report.json
 */
import {
  HARD_MS,
  addCheck,
  captureScreenshot,
  DEFAULT_ALLOWED_REFUSALS,
  acceptanceExitCode,
  collectErrors,
  createArtifactDir,
  createRunId,
  delay,
  enterSurfaceClient,
  joinClient,
  launchClients,
  loadPlaywright,
  newAcceptanceReport,
  postAction,
  readEventLog,
  startAcceptanceServer,
  waitFor,
  writeReport,
} from './lib/acceptance-harness.mjs';

const runId = createRunId('surface-truth');
const artifactDir = createArtifactDir(runId);
const report = newAcceptanceReport({ runId, baseUrl: '' });
let server = null;
let clients = null;

function finish(harnessFailure = false) {
  // writeReport() is what computes report.ok, so the exit code must be derived
  // *after* it. Deriving it in the caller produced "PASS 4/4" with exit 1 (TST-01).
  const file = writeReport(artifactDir, report);
  const pass = report.checks.filter((check) => check.ok).length;
  process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} surface-truth // ${runId} // ${pass}/${report.checks.length} checks\n`);
  for (const check of report.checks) process.stdout.write(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.id}${check.ok ? '' : ` — ${JSON.stringify(check.detail)}`}\n`);
  process.stdout.write(`report: ${file}\n`);
  process.exitCode = acceptanceExitCode(report, { harnessFailure });
}

try {
  const playwright = await loadPlaywright();
  server = await startAcceptanceServer();
  report.baseUrl = server.url;
  clients = await launchClients(playwright, 1);
  const page = clients.pages[0];
  await joinClient(page, `TR${Math.floor(Math.random() * 900 + 100)}`, server.url);
  await enterSurfaceClient(page);
  // Acquire a target and click it under the same state snapshot. The server is
  // concurrently contested by robots and by the client's own footprint, so a
  // snapshot can legitimately go stale between the HUD read and the click; retry
  // only for that race, never to hide a persistently wrong HUD predicate.
  let hudState = null;
  let targetLabel = null;
  let targetCan = false;
  let click = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const debug = await page.evaluate(() => window.__ICOSA__.surfaceDebug());
    targetLabel = debug && debug.targetLabel;
    targetCan = !!(debug && debug.targetCan);
    if (!targetLabel) {
      await delay(150);
      continue;
    }
    try {
      await waitFor(page, (expected) => {
        const node = document.querySelector('#surface-target');
        if (!node) return false;
        return expected ? node.dataset.state === 'can' : node.dataset.state !== 'can';
      }, { label: 'hud-target-state', timeout: 2_000, artifactDir, arg: targetCan });
      hudState = await page.evaluate(() => {
        const node = document.querySelector('#surface-target');
        return node ? { text: node.textContent, state: node.dataset.state } : null;
      });
    } catch (error) {
      report.errors.push(error.message);
    }
    const fresh = await page.evaluate(() => window.__ICOSA__.surfaceDebug());
    if (!fresh || fresh.targetLabel !== targetLabel || !!fresh.targetCan !== targetCan) {
      continue;
    }
    click = await postAction(page, { type: 'click', label: targetLabel });
    const awarded = !!(click && click.status === 200 && click.body && click.body.ok);
    if (targetCan ? awarded : !awarded) break;
    // A 409/refusal can be the rightful result of a contest that landed after
    // the snapshot; refresh the snapshot and retry instead of asserting a race.
    if (!targetCan || (click && click.status === 409)) continue;
    break;
  }
  const clickOk = !!(click && click.status === 200 && click.body && click.body.ok);
  addCheck(report, 'target-available', !!targetLabel, { targetLabel, targetCan });
  const truthAgrees =
    !!hudState && (targetCan ? clickOk : !clickOk) && (targetCan ? hudState.state === 'can' : hudState.state !== 'can');
  addCheck(report, 'hud-truth', truthAgrees, {
    hud: hudState,
    targetCan,
    status: click && click.status,
    clickOk,
    expected: targetCan ? 'awarded' : 'refused',
  });
  report.artifacts.push(await captureScreenshot(page, artifactDir, 'surface-truth').catch(() => null));
  // Authoritative mine frame ordering (the beam never precedes the mutation).
  let mineFrames = [];
  try {
    await waitFor(page, () => window.__ICOSA__.eventLog().some((entry) => entry.type === 'surface_mine'), { label: 'surface-mine', timeout: HARD_MS, artifactDir });
    const log = await readEventLog(page);
    mineFrames = log.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === 'surface_mine')
      .map(({ entry, index }) => ({
        playerId: entry.playerId,
        label: entry.label,
        precededByCell: log.slice(0, index).some((previous) => (previous.type === 'cell' || previous.type === 'break') && previous.label === entry.label),
      }));
  } catch (error) {
    report.errors.push(error.message);
  }
  report.beams = mineFrames.slice(0, 20);
  addCheck(report, 'beam-ordering', mineFrames.length > 0 && mineFrames.every((frame) => frame.precededByCell), {
    frames: mineFrames.length,
    valid: mineFrames.filter((frame) => frame.precededByCell).length,
  });
  // The script itself posts one expected `/api/action` click; when the target is
  // locked the server legitimately answers 409 NOT_A_LEAF. That response is the
  // subject under test, not a page error (TST-01 defect).
  const signals = collectErrors(clients, {
    allowedRefusals: [...DEFAULT_ALLOWED_REFUSALS, 'NOT_A_LEAF'],
  });
  report.errors.push(...signals.errors);
  addCheck(report, 'no-page-errors', signals.errors.length === 0, {
    count: signals.errors.length,
    expectedRefusals: signals.allowedRefusals.length,
    errors: signals.errors.slice(0, 6),
  });
  finish();
} catch (error) {
  report.errors.push(String(error && error.message ? error.message : error));
  addCheck(report, 'harness', false, { message: String(error && error.message ? error.message : error) });
  finish(Boolean(error && error.harness));
} finally {
  if (clients) await clients.close();
  if (server) await server.stop();
}
