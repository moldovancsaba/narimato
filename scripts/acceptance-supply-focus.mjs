#!/usr/bin/env node
/**
 * NARIMATO — orbital supply focus acceptance (TST-01 step set).
 *
 * A real server emergency drop must focus/zoom the orbit camera to the impact
 * and carry one authoritative placement per online human (no faked `cells: []`).
 *
 * Usage: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-supply-focus.mjs
 * Exit: 0 pass, 1 failed check, 2 harness failure. Report: media/acceptance/<runId>/report.json
 */
import {
  HARD_MS,
  addCheck,
  captureScreenshot,
  collectErrors,
  createArtifactDir,
  createRunId,
  delay,
  joinClient,
  launchClients,
  loadPlaywright,
  newAcceptanceReport,
  requestSupply,
  startAcceptanceServer,
  waitFor,
  writeReport,
} from './lib/acceptance-harness.mjs';

const runId = createRunId('supply-focus');
const artifactDir = createArtifactDir(runId);
const report = newAcceptanceReport({ runId, baseUrl: '' });
let server = null;
let clients = null;

function finish(code) {
  const file = writeReport(artifactDir, report);
  const pass = report.checks.filter((check) => check.ok).length;
  process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} supply-focus // ${runId} // ${pass}/${report.checks.length} checks\n`);
  for (const check of report.checks) process.stdout.write(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.id}${check.ok ? '' : ` — ${JSON.stringify(check.detail)}`}\n`);
  process.stdout.write(`report: ${file}\n`);
  process.exitCode = code;
}

try {
  const playwright = await loadPlaywright();
  server = await startAcceptanceServer();
  report.baseUrl = server.url;
  clients = await launchClients(playwright, 1);
  const page = clients.pages[0];
  await joinClient(page, `SP${Math.floor(Math.random() * 900 + 100)}`, server.url);
  await delay(600);
  const before = await page.evaluate(() => ({
    zoom: window.__ICOSA__.camera.zoom,
    focus: window.__ICOSA__.supplyFocus(),
  }));
  // The gate is 2 s in the harness; start the request once it is comfortably open.
  await delay(2600);
  const supply = await requestSupply(page);
  const cells = Array.isArray(supply.body.cells) ? supply.body.cells.map((cell) => cell.label) : [];
  const placements = Array.isArray(supply.body.placements) ? supply.body.placements : [];
  report.supply = { impactLabel: supply.body.impactLabel, cells, placements: placements.map((placement) => ({ playerId: placement.playerId, leaf: placement.leaf })) };
  let placement = null;
  try {
    await waitFor(page, () => {
      const focus = window.__ICOSA__.supplyFocus();
      return !!focus && focus.impactLabel && Array.isArray(focus.placements) && focus.placements.length >= 1;
    }, { label: 'supply-focus-applied', timeout: HARD_MS, artifactDir });
    placement = await page.evaluate(() => window.__ICOSA__.supplyFocus());
  } catch (error) {
    report.errors.push(error.message);
  }
  // The camera focuses the impact: zoom strictly increases (real event, not a fake).
  await delay(1600);
  const after = await page.evaluate(() => ({ zoom: window.__ICOSA__.camera.zoom }));
  const ownPlacement = placement && placement.ownPlacement ? placement.ownPlacement : null;
  const placementInCells = !!ownPlacement && cells.includes(ownPlacement.leaf);
  const focused = Number.isFinite(after.zoom) && after.zoom > before.zoom;
  report.artifacts.push(await captureScreenshot(page, artifactDir, 'supply-focus').catch(() => null));
  addCheck(report, 'supply-focus-zoom', focused, { beforeZoom: before.zoom, afterZoom: after.zoom });
  addCheck(report, 'supply-placement', placementInCells && placements.length >= 1, {
    cells,
    placements: placements.length,
    ownLeaf: ownPlacement ? ownPlacement.leaf : null,
  });
  const signals = collectErrors(clients);
  report.errors.push(...signals.errors);
  addCheck(report, 'no-page-errors', signals.errors.length === 0, {
    count: signals.errors.length,
    expectedRefusals: signals.allowedRefusals.length,
    errors: signals.errors.slice(0, 6),
  });
  finish(report.ok ? 0 : 1);
} catch (error) {
  report.errors.push(String(error && error.message ? error.message : error));
  addCheck(report, 'harness', false, { message: String(error && error.message ? error.message : error) });
  finish(error && error.harness ? 2 : 1);
} finally {
  if (clients) await clients.close();
  if (server) await server.stop();
}
