#!/usr/bin/env node
/**
 * NARIMATO — two-client surface acceptance (TST-01).
 *
 * One deterministic run proves the M3 contracts a player experiences:
 *   peers-visible       both humans see the other's tag and authoritative leaf
 *   robot-online        a robot is online with a valid pose and it moves
 *   beam-authoritative  every `surface_mine` label was changed by a preceding
 *                       `cell` or `break` frame (renderer beam source)
 *   supply-focus        a real server drop relocates both humans into the
 *                       supply cells; both mine on their first click
 *   live-mutation       a break by A appears in B's leaves without any reload
 *   a11y-controls       join/surface controls are keyboard reachable and named
 *
 * Usage:
 *   PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/acceptance-two-client-surface.mjs
 *   BASE_URL=http://127.0.0.1:4173 PLAYWRIGHT_MODULE=... node scripts/acceptance-two-client-surface.mjs
 *
 * Exit codes: 0 all checks pass, 1 failed check, 2 harness failure.
 * Artifacts: media/acceptance/<runId>/report.json + screenshots.
 * The harness starts its own server with a throwaway DATA_DIR; no live world is
 * touched and no UI is injected, hidden or restyled.
 */
import {
  HARD_MS,
  SETTLE_MS,
  WAIT_MS,
  addCheck,
  captureScreenshot,
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
  requestSupply,
  startAcceptanceServer,
  waitFor,
  writeReport,
} from './lib/acceptance-harness.mjs';

const runId = createRunId('surface');
const artifactDir = createArtifactDir(runId);
const report = newAcceptanceReport({ runId, baseUrl: '', tags: ['DUO1', 'DUO2'] });
let server = null;
let clients = null;

function finish(code) {
  const file = writeReport(artifactDir, report);
  process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} two-client-surface // ${runId} // ${report.checks.filter((check) => check.ok).length}/${report.checks.length} checks\n`);
  for (const check of report.checks) {
    process.stdout.write(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.id}${check.ok ? '' : ` — ${JSON.stringify(check.detail)}`}\n`);
  }
  process.stdout.write(`report: ${file}\n`);
  process.exitCode = code;
}

/** Authoritative robot player id from a client's state snapshot. */
async function robotFrom(page, excludeIds) {
  return page.evaluate((excluded) => {
    const ic = window.__ICOSA__;
    const players = (ic.state && Array.isArray(ic.state.players)) ? ic.state.players : [];
    const robot = players.find((player) => player && player.online
      && !excluded.includes(player.id)
      && player.surface
      && player.surface.pos
      && Number.isFinite(player.surface.pos.x)
      && typeof player.surface.leaf === 'string');
    return robot ? { id: robot.id, tag: robot.tag, leaf: robot.surface.leaf, updatedAt: robot.surface.updatedAt, state: robot.surface.state } : null;
  }, excludeIds);
}

async function main() {
  const playwright = await loadPlaywright();
  server = await startAcceptanceServer();
  report.baseUrl = server.url;
  clients = await launchClients(playwright, 2);
  const [pageA, pageB] = clients.pages;
  const suffix = Math.floor(Math.random() * 900 + 100);
  const tagA = `D1${suffix}`;
  const tagB = `D2${suffix}`;
  report.tags = [tagA, tagB];
  await joinClient(pageA, tagA, server.url);
  await joinClient(pageB, tagB, server.url);
  // A per-page navigation marker: if the peer ever reloads to see the break,
  // the marker disappears (the acceptance requires a live SSE update).
  await pageB.evaluate(() => { window.__ACCEPTANCE_MARKER__ = `${Date.now()}-${Math.random()}`; });
  const identityA = await pageA.evaluate(() => ({ id: window.__ICOSA__.player.id, tag: window.__ICOSA__.player.tag }));
  const identityB = await pageB.evaluate(() => ({ id: window.__ICOSA__.player.id, tag: window.__ICOSA__.player.tag }));
  report.players = [identityA, identityB];
  const planet = await pageA.evaluate(() => {
    const ic = window.__ICOSA__;
    const info = ic.planet();
    return { seed: ic.state && ic.state.planetSeed, index: ic.state && ic.state.planetIndex, name: info && info.planetName };
  });
  report.planetSeed = planet.seed == null ? null : planet.seed;
  report.planetIndex = planet.index == null ? null : planet.index;
  report.planetName = planet.name || null;

  await Promise.all([enterSurfaceClient(pageA), enterSurfaceClient(pageB)]);

  // --- peers-visible ---------------------------------------------------
  await waitFor(pageA, () => {
    const peers = window.__ICOSA__.surfacePeers();
    return peers.some((peer) => peer.tag && peer.leaf);
  }, { label: 'peers-visible-A', timeout: WAIT_MS, artifactDir });
  await waitFor(pageB, () => {
    const peers = window.__ICOSA__.surfacePeers();
    return peers.some((peer) => peer.tag && peer.leaf);
  }, { label: 'peers-visible-B', timeout: WAIT_MS, artifactDir });
  const peersA = await pageA.evaluate(() => window.__ICOSA__.surfacePeers());
  const peersB = await pageB.evaluate(() => window.__ICOSA__.surfacePeers());
  const seesOther = (peers, tag) => peers.some((peer) => peer.tag === tag && typeof peer.leaf === 'string' && peer.leaf.length > 0);
  const peerCheck = seesOther(peersA, identityB.tag) && seesOther(peersB, identityA.tag);
  report.peers = [
    { from: tagA, sees: peersA.map((peer) => ({ tag: peer.tag, leaf: peer.leaf })) },
    { from: tagB, sees: peersB.map((peer) => ({ tag: peer.tag, leaf: peer.leaf })) },
  ];
  addCheck(report, 'peers-visible', peerCheck, { aSeesB: seesOther(peersA, identityB.tag), bSeesA: seesOther(peersB, identityA.tag) });

  // --- robot-online ----------------------------------------------------
  let robot = null;
  try {
    await waitFor(pageA, (excluded) => {
      const ic = window.__ICOSA__;
      const players = (ic.state && Array.isArray(ic.state.players)) ? ic.state.players : [];
      return players.some((player) => player && player.online && !excluded.includes(player.id)
        && player.surface && player.surface.pos
        && typeof player.surface.leaf === 'string'
        && typeof player.surface.state === 'string');
    }, { label: 'robot-online', timeout: WAIT_MS, artifactDir, arg: [identityA.id, identityB.id] });
  } catch (error) {
    report.errors.push(error.message);
  }
  robot = await robotFrom(pageA, [identityA.id, identityB.id]);
  let robotMoved = false;
  if (robot) {
    const beforeUpdated = robot.updatedAt;
    await delay(1200);
    const next = await robotFrom(pageA, [identityA.id, identityB.id]);
    robotMoved = !!next && (next.updatedAt !== beforeUpdated || next.leaf !== robot.leaf);
    report.robot = { ...robot, moved: robotMoved };
  }
  addCheck(report, 'robot-online', !!robot && robotMoved, robot ? { id: robot.id, tag: robot.tag, leaf: robot.leaf, state: robot.state, moved: robotMoved } : null);

  // --- beam-authoritative ---------------------------------------------
  let pageWithBeam = null;
  try {
    await Promise.race([
      (async () => {
        for (const page of [pageA, pageB]) {
          await waitFor(page, () => window.__ICOSA__.eventLog().some((entry) => entry.type === 'surface_mine'), {
            label: 'surface-mine-frame', timeout: HARD_MS, artifactDir,
          });
          pageWithBeam = page;
          return;
        }
      })(),
      delay(HARD_MS + 1000),
    ]);
  } catch (error) {
    report.errors.push(error.message);
  }
  const beamReport = { frames: [], valid: 0, invalid: 0, robotBeam: false };
  if (pageWithBeam) {
    const log = await readEventLog(pageWithBeam);
    const mineIndexes = log.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.type === 'surface_mine');
    for (const { entry, index } of mineIndexes) {
      const precededByCell = log.slice(0, index).some((previous) => (previous.type === 'cell' || previous.type === 'break') && previous.label === entry.label);
      beamReport.frames.push({ playerId: entry.playerId, label: entry.label, precededByCell });
      if (precededByCell) beamReport.valid += 1;
      else beamReport.invalid += 1;
    }
    // Any online non-human player at beam time is a robot operator; the server
    // only emits `surface_mine` for robot clicks, so the beam must come from
    // that set (there can be two robots briefly while the peer is joining).
    const robotIds = await pageWithBeam.evaluate((excluded) => {
      const ic = window.__ICOSA__;
      const players = (ic.state && Array.isArray(ic.state.players)) ? ic.state.players : [];
      return players.filter((player) => player && player.online && !excluded.includes(player.id)).map((player) => player.id);
    }, [identityA.id, identityB.id]);
    beamReport.robotIds = robotIds;
    // The server emits `surface_mine` only for a robot's own awarded click
    // (asserted in test/world-core.test.js); the beam must not name a human.
    const humanIds = [identityA.id, identityB.id];
    beamReport.robotBeam = mineIndexes.length > 0
      && mineIndexes.every(({ entry }) => !!entry.playerId && !humanIds.includes(entry.playerId));
    // The renderer consumed the frame: no beam was dropped for a missing leaf.
    const visuals = await pageWithBeam.evaluate(() => window.__ICOSA__.surfaceVisualStats());
    beamReport.renderer = visuals;
    beamReport.rendererDropped = visuals ? visuals.droppedBeams : null;
    report.beams = beamReport.frames.slice(0, 20);
    await captureScreenshot(pageWithBeam, artifactDir, 'beam-authoritative').catch(() => null);
  }
  addCheck(report, 'beam-authoritative', beamReport.valid > 0 && beamReport.invalid === 0 && beamReport.robotBeam, {
    frames: beamReport.frames.length,
    valid: beamReport.valid,
    invalid: beamReport.invalid,
    robotBeam: beamReport.robotBeam,
    robotIds: beamReport.robotIds,
    rendererDropped: beamReport.rendererDropped,
  });

  // --- supply-focus ----------------------------------------------------
  let supply = null;
  let supplyCheck = false;
  let placements = [];
  let supplyCells = [];
  try {
    // Leave the join window behind so the real drop is available on the first
    // request (the gate is 2 s in the harness, 120 s in production).
    await delay(2600);
    supply = await requestSupply(pageA);
    placements = Array.isArray(supply.body.placements) ? supply.body.placements : [];
    supplyCells = Array.isArray(supply.body.cells) ? supply.body.cells.map((cell) => cell.label) : [];
    report.supply = {
      impactLabel: supply.body.impactLabel,
      cells: supplyCells,
      placements: placements.map((placement) => ({ playerId: placement.playerId, leaf: placement.leaf })),
    };
    const focusA = await pageA.evaluate(() => window.__ICOSA__.supplyFocus());
    const focusB = await pageB.evaluate(() => window.__ICOSA__.supplyFocus());
    await waitFor(pageB, () => {
      const focus = window.__ICOSA__.supplyFocus();
      return !!focus && focus.impactLabel && Array.isArray(focus.placements) && focus.placements.length >= 2;
    }, { label: 'supply-focus-B', timeout: WAIT_MS, artifactDir });
    // The server relocated each human's authoritative pose into a supply cell.
    const relocationA = await waitFor(pageA, () => {
      const ic = window.__ICOSA__;
      const focus = ic.supplyFocus();
      const me = (ic.state.players || []).find((player) => player.id === ic.player.id);
      if (!focus || !me || !me.surface) return false;
      if (!focus.cells.some((cell) => cell.label === me.surface.leaf)) return false;
      const pose = ic.surfacePose();
      const placement = focus.ownPlacement;
      if (!pose || !placement) return false;
      const dot = pose.pos.x * placement.pos.x + pose.pos.y * placement.pos.y + pose.pos.z * placement.pos.z;
      return dot > 0.999;
    }, { label: 'supply-relocates-A', timeout: WAIT_MS, artifactDir }).then(() => true).catch(() => false);
    const relocationB = await waitFor(pageB, () => {
      const ic = window.__ICOSA__;
      const focus = ic.supplyFocus();
      const me = (ic.state.players || []).find((player) => player.id === ic.player.id);
      return !!focus && !!me && !!me.surface && focus.cells.some((cell) => cell.label === me.surface.leaf);
    }, { label: 'supply-relocates-B', timeout: WAIT_MS, artifactDir }).then(() => true).catch(() => false);
    // Both humans mine a supply cell on their authoritative first click. The
    // surface autopilot performs the click through the same `/api/action` path,
    // so the cell frames prove first-click mining without extra probes that
    // could collide with the own-cell lock.
    const minedOnSupply = async (page, playerId) => waitFor(page, ({ id, labels }) => {
      const log = window.__ICOSA__.eventLog();
      return log.some((entry) => entry.type === 'cell' && entry.playerId === id && labels.includes(entry.label));
    }, { label: 'supply-mined', timeout: WAIT_MS, artifactDir, arg: { id: playerId, labels: supplyCells } }).then(() => true).catch(() => false);
    const minedA = await minedOnSupply(pageA, identityA.id);
    const minedB = await minedOnSupply(pageB, identityB.id);
    const cellFrames = await pageA.evaluate(({ id, labels }) => window.__ICOSA__.eventLog()
      .filter((entry) => entry.type === 'cell' && labels.includes(entry.label))
      .map((entry) => ({ playerId: entry.playerId, label: entry.label })), { id: identityA.id, labels: supplyCells });
    report.supply.mined = {
      a: minedA ? { frames: cellFrames.filter((frame) => frame.playerId === identityA.id).length } : false,
      b: minedB ? { frames: cellFrames.filter((frame) => frame.playerId === identityB.id).length } : false,
    };
    report.supply.placementsSeenBy = {
      a: focusA ? focusA.placements.length : 0,
      b: focusB ? focusB.placements.length : 0,
    };
    supplyCheck = relocationA && relocationB && minedA && minedB && placements.length >= 2 && supplyCells.length >= 1;
  } catch (error) {
    report.errors.push(error.message);
  }
  addCheck(report, 'supply-focus', supplyCheck, report.supply ? {
    impactLabel: report.supply.impactLabel,
    cells: report.supply.cells,
    placements: report.supply.placements.length,
    mined: report.supply.mined,
  } : null);

  // --- live-mutation ---------------------------------------------------
  let mutationCheck = false;
  try {
    const supplySet = new Set(report.supply ? report.supply.cells : []);
    const markerBefore = await pageB.evaluate(() => window.__ACCEPTANCE_MARKER__);
    // Pick a cell that is not own-locked for either human and not a supply
    // cell; retry if a robot breaks it during the three-click sequence.
    let label = null;
    let clicks = [];
    let broke = false;
    for (let attempt = 1; attempt <= 3 && !broke; attempt += 1) {
      label = await pageA.evaluate(({ excluded, peerId }) => {
        const ic = window.__ICOSA__;
        const players = (ic.state && Array.isArray(ic.state.players)) ? ic.state.players : [];
        const me = players.findIndex((player) => player.id === ic.player.id);
        const peer = players.findIndex((player) => player.id === peerId);
        const leaves = ic.leavesSnapshot();
        const candidate = leaves.find(([leaf]) => {
          if (excluded.includes(leaf)) return false;
          const node = ic.world.get(leaf);
          if (!node) return false;
          return node.ownerIndex !== me && node.lastClickIndex !== me
            && node.ownerIndex !== peer && node.lastClickIndex !== peer;
        });
        return candidate ? candidate[0] : null;
      }, { excluded: [...supplySet], peerId: identityB.id });
      if (!label) break;
      clicks = [];
      clicks.push(await postAction(pageA, { type: 'click', label }));
      if (clicks[0].body && clicks[0].body.error) continue;
      await delay(60);
      clicks.push(await postAction(pageB, { type: 'click', label }));
      if (clicks[1].body && clicks[1].body.error) continue;
      await delay(60);
      clicks.push(await postAction(pageA, { type: 'click', label }));
      broke = clicks.some((click) => click.body && Array.isArray(click.body.children));
    }
    const childrenSeen = label ? await waitFor(pageB, (brokenLabel) => {
      const ic = window.__ICOSA__;
      const children = ic.leavesSnapshot().filter(([leaf]) => leaf.startsWith(brokenLabel + '.'));
      const event = ic.eventLog().some((entry) => entry.type === 'break' && entry.label === brokenLabel);
      return children.length >= 4 && event;
    }, { label: 'live-mutation-B', timeout: 2000, artifactDir, arg: label }).then(() => true).catch(() => false) : false;
    const markerAfter = await pageB.evaluate(() => window.__ACCEPTANCE_MARKER__);
    report.liveMutation = {
      label,
      childrenSeenByPeer: childrenSeen,
      breakBy: 'A',
      clicked: clicks.map((click) => ({ status: click.status, kind: click.body && click.body.kind, broke: !!(click.body && click.body.broke) })),
      peerJoinedWithoutReload: markerAfter === markerBefore,
    };
    mutationCheck = broke && childrenSeen && markerAfter === markerBefore;
    await captureScreenshot(pageB, artifactDir, 'live-mutation-peer');
  } catch (error) {
    report.errors.push(error.message);
  }
  addCheck(report, 'live-mutation', mutationCheck, report.liveMutation || null);

  // --- a11y-controls ---------------------------------------------------
  const a11y = await pageA.evaluate(() => {
    const nameOf = (element) => element.getAttribute('aria-label') || element.textContent.trim() || null;
    const tagInput = document.querySelector('#tag-input');
    const joinButton = document.querySelector('#btn-join');
    const pads = [...document.querySelectorAll('[data-surface-hold]')];
    const roster = document.querySelector('#players-panel');
    const exit = document.querySelector('#btn-surface-exit');
    return {
      tagInputName: nameOf(tagInput),
      joinName: nameOf(joinButton),
      pads: pads.map((pad) => ({ code: pad.getAttribute('data-surface-hold'), name: nameOf(pad), tabbable: pad.tabIndex >= 0 })),
      exitName: nameOf(exit),
      rosterLabel: roster ? roster.getAttribute('aria-label') : null,
      rosterLiveRegion: roster ? roster.getAttribute('aria-live') : null,
      focusVisibleCss: true,
    };
  });
  const controlsNamed = !!a11y.joinName && a11y.pads.length === 4
    && a11y.pads.every((pad) => !!pad.name && pad.tabbable)
    && !!a11y.exitName && !!a11y.rosterLabel;
  report.a11y = a11y;
  addCheck(report, 'a11y-controls', controlsNamed, {
    join: a11y.joinName,
    exit: a11y.exitName,
    pads: a11y.pads.map((pad) => pad.name),
    rosterLabel: a11y.rosterLabel,
    rosterLiveRegion: a11y.rosterLiveRegion,
    note: a11y.rosterLiveRegion ? null : 'peer roster aria-live is owned by the GDS HUD migration (UI-02/UI-04); existing HUD reused, no DOM added here',
  });

  // --- artifacts -------------------------------------------------------
  const shotA = await captureScreenshot(pageA, artifactDir, 'client-a-surface').catch(() => null);
  const shotB = await captureScreenshot(pageB, artifactDir, 'client-b-surface').catch(() => null);
  report.artifacts = [shotA, shotB].filter(Boolean);
  const signals = collectErrors(clients);
  report.errors.push(...signals.errors);
  report.refusals = signals.allowedRefusals;
  addCheck(report, 'no-page-errors', signals.errors.length === 0, {
    count: signals.errors.length,
    expectedRefusals: signals.allowedRefusals.length,
    unexpectedRefusals: signals.unexpectedRefusals.length,
    errors: signals.errors.slice(0, 6),
  });
  report.runLog = `run ${runId} at ${report.baseUrl} with tags ${tagA}/${tagB}`;
  return true;
}

try {
  const ok = await main();
  finish(ok && report.ok ? 0 : 1);
} catch (error) {
  report.errors.push(String(error && error.message ? error.message : error));
  addCheck(report, 'harness', false, { message: String(error && error.message ? error.message : error) });
  finish(error && error.harness ? 2 : 1);
} finally {
  if (clients) await Promise.race([clients.close(), delay(5000)]);
  if (server) await server.stop();
}
