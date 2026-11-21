#!/usr/bin/env node
/**
 * NARIMATO — RND-05 avatar evidence capture (Playwright).
 *
 * Injects one QA preview peer into the renderer's real entity pass and captures
 * the same rig from the front, the back and the side at normal and close
 * distance, plus a walk pose, a mining pose with its authoritative beam, and the
 * triangle budget/source report. This is product canvas rendering: no second
 * renderer, no sprite fallback and no DOM change.
 *
 * Usage: PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/evidence-avatars.mjs
 * Artifacts: media/rnd-05-07-tst-01/avatar-*.png + avatar-report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addCheck,
  captureScreenshot,
  collectErrors,
  createRunId,
  delay,
  enterSurfaceClient,
  joinClient,
  launchClients,
  loadPlaywright,
  newAcceptanceReport,
  startAcceptanceServer,
  writeReport,
} from './lib/acceptance-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = createRunId('avatar-evidence');
const artifactDir = path.join(ROOT, 'media', 'rnd-05-07-tst-01');
fs.mkdirSync(artifactDir, { recursive: true });
const report = newAcceptanceReport({ runId, baseUrl: '' });
let server = null;
let clients = null;

function finish(code) {
  const file = writeReport(artifactDir, report);
  process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} avatar-evidence // ${runId} // ${report.checks.filter((check) => check.ok).length}/${report.checks.length}\n`);
  for (const check of report.checks) process.stdout.write(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.id}\n`);
  process.stdout.write(`report: ${file}\n`);
  process.exitCode = code;
}

try {
  const playwright = await loadPlaywright();
  server = await startAcceptanceServer({ config: { bots: 0 } });
  report.baseUrl = server.url;
  clients = await launchClients(playwright, 1);
  const page = clients.pages[0];
  await joinClient(page, `AV${Math.floor(Math.random() * 900 + 100)}`, server.url);
  // Dismiss the (existing HUD) planet briefing so the canvas evidence is visible.
  await page.click('#btn-landing-brief-start').catch(() => {});
  await delay(300);
  await enterSurfaceClient(page);
  // Wait for the (existing) narration subtitle to clear so canvas evidence is
  // not covered by the tutorial caption.
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#narrative-subtitles');
      return !el || el.classList.contains('is-hidden') || el.hidden;
    }, null, { timeout: 12000, polling: 250 });
  } catch (_) { /* subtitle timing is cosmetic for the evidence */ }
  await delay(300);
  const views = [
    { id: 'front', heading: Math.PI },
    { id: 'back', heading: 0 },
    { id: 'side', heading: Math.PI / 2 },
  ];
  const stats = [];
  for (const view of views) {
    for (const distance of [{ id: 'normal', spread: 0.05 }, { id: 'close', spread: 0.028 }]) {
      const preview = await page.evaluate((options) => window.__ICOSA__.avatarPreview(options), {
        heading: view.heading,
        spread: distance.id === 'close' ? 0.03 : 0.05,
        lateral: distance.id === 'close' ? 0.045 : 0.06,
        tint: view.id === 'front' ? '#63dfff' : view.id === 'back' ? '#ffd166' : '#a78bfa',
        label: view.id.toUpperCase(),
        moving: false,
      });
      if (!preview) throw new Error('avatarPreview hook returned null');
      await delay(450);
      const shot = await captureScreenshot(page, artifactDir, `avatar-${view.id}-${distance.id}`);
      const avatarStats = await page.evaluate(() => window.__ICOSA__.avatarStats());
      stats.push({ view: view.id, distance: distance.id, shot, avatarStats });
    }
  }
  // Detail close-ups at a larger QA figure scale (same rig and renderer) so a
  // reviewer can inspect joints, gaps and face winding without a device farm.
  await page.evaluate(() => window.__ICOSA__.setAvatarScale(2.6));
  for (const view of views) {
    await page.evaluate((options) => window.__ICOSA__.avatarPreview(options), {
      heading: view.heading,
      spread: 0.035,
      lateral: 0.045,
      tint: view.id === 'front' ? '#63dfff' : view.id === 'back' ? '#ffd166' : '#a78bfa',
      label: view.id === 'front' ? 'FRONT' : view.id === 'back' ? 'BACK' : 'SIDE',
      moving: false,
    });
    await delay(450);
    const clip = await page.evaluate(() => {
      const ic = window.__ICOSA__;
      const cam = ic.camera;
      const visual = ic.renderer.peerVisuals.get('p_preview');
      const sample = ic.renderer.samplePeer(visual, Date.now());
      const p = sample ? cam.project(sample.pos) : null;
      return p && p.visible ? { x: p.x, y: p.y } : null;
    });
    if (!clip) continue;
    const file = path.join(artifactDir, `avatar-${view.id}-detail.png`);
    await page.screenshot({
      path: file,
      clip: {
        x: Math.max(0, clip.x - 150),
        y: Math.max(0, clip.y - 220),
        width: 300,
        height: 300,
      },
    });
    report.artifacts.push(path.relative(ROOT, file).split(path.sep).join('/'));
  }
  await page.evaluate(() => window.__ICOSA__.setAvatarScale(1));

  // Walk pose (front-facing toward the camera so the visor and limb swing read).
  await page.evaluate(() => window.__ICOSA__.avatarPreview({ heading: Math.PI, spread: 0.05, tint: '#63dfff', label: 'WALK', moving: true }));
  await delay(500);
  report.artifacts.push(await captureScreenshot(page, artifactDir, 'avatar-walk'));
  // Mining pose + authoritative beam + authoritative resource pin. The beam is
  // aimed at a live leaf that is actually on screen so the arc is legible.
  const mining = await page.evaluate(() => {
    const ic = window.__ICOSA__;
    const camera = ic.camera;
    let toLeaf = null;
    for (const node of ic.world.activeLeaves()) {
      if (!ic.renderer.hasLeaf(node.label)) continue;
      const p = camera.project(node.centroid);
      if (!p || !p.visible) continue;
      if (p.x > 420 && p.x < 780 && p.y > 180 && p.y < 400) { toLeaf = node.label; break; }
    }
    const preview = ic.avatarPreview({
      heading: Math.PI * 1.1,
      spread: 0.03,
      lateral: 0.075,
      tint: '#a78bfa',
      label: 'ROBOT',
      moving: false,
      mining: true,
      toLeaf,
    });
    const leaves = ic.leavesSnapshot();
    const pinLeaf = leaves.find(([label]) => label) ? leaves[0][0] : null;
    if (pinLeaf) ic.renderer.setResourcePins([{ label: pinLeaf, resourceId: 'gold' }]);
    return { preview, pinLeaf, toLeaf };
  });
  await delay(220);
  // Read the counters while the beam is alive (screenshots can take seconds
  // under load and a beam TTL is 900 ms).
  const visualAtMining = await page.evaluate(() => ({
    stats: window.__ICOSA__.surfaceVisualStats(),
    minePhase: window.__ICOSA__.renderer.peerMinePhase('p_preview', Date.now()),
    beams: window.__ICOSA__.renderer.beams.length,
  }));
  report.artifacts.push(await captureScreenshot(page, artifactDir, 'avatar-mining-beam'));
  // Close-up of the beam arc + tool arm at QA scale.
  const beamFocus = await page.evaluate(() => {
    const ic = window.__ICOSA__;
    const r = ic.renderer;
    const cam = ic.camera;
    const beam = r.beams[0];
    if (!beam) return null;
    const from = cam.project(beam.from);
    const to = cam.project(beam.toTarget || beam.from);
    return from && from.visible ? { x: from.x, y: from.y } : null;
  });
  await page.evaluate(() => window.__ICOSA__.setAvatarScale(2.2));
  await delay(200);
  const beamFile = path.join(artifactDir, 'avatar-mining-beam-detail.png');
  await page.screenshot({ path: beamFile, clip: { x: 60, y: 80, width: 900, height: 520 } });
  report.artifacts.push(path.relative(ROOT, beamFile).split(path.sep).join('/'));
  await page.evaluate(() => window.__ICOSA__.setAvatarScale(1));
  await delay(120);
  report.artifacts.push(await captureScreenshot(page, artifactDir, 'avatar-mining-beam-late'));
  const visual = await page.evaluate(() => window.__ICOSA__.surfaceVisualStats());
  const avatar = await page.evaluate(() => window.__ICOSA__.avatarStats());
  report.avatar = avatar;
  report.visuals = visual;
  report.visualsAtMining = visualAtMining;
  report.views = stats;
  report.mining = mining;
  addCheck(report, 'tri-budget', avatar.l0 === 132 && avatar.l1 === 72 && avatar.l2 === 2, avatar);
  addCheck(report, 'views-captured', stats.length === 6 && stats.every((entry) => !!entry.shot), stats.map((entry) => entry.shot));
  addCheck(report, 'rig-rendered', stats.every((entry) => entry.avatarStats.tris > 0 && entry.avatarStats.avatars >= 2), stats.map((entry) => entry.avatarStats.tris));
  addCheck(report, 'beam-and-pin-visuals', visualAtMining.beams >= 1
    && visualAtMining.stats.beams >= 1
    && visualAtMining.minePhase > 0
    && visualAtMining.stats.droppedBeams === 0
    && visual.pins >= 1, {
    beamsAtMining: visualAtMining.beams,
    renderedBeamsAtMining: visualAtMining.stats.beams,
    pinCount: visual.pins,
    droppedBeams: visualAtMining.stats.droppedBeams,
    peerMinePhase: visualAtMining.minePhase,
  });
  const signals = collectErrors(clients);
  report.errors.push(...signals.errors);
  addCheck(report, 'no-page-errors', signals.errors.length === 0, { count: signals.errors.length, expectedRefusals: signals.allowedRefusals.length });
  finish(report.ok ? 0 : 1);
} catch (error) {
  report.errors.push(String(error && error.message ? error.message : error));
  addCheck(report, 'harness', false, { message: String(error && error.message ? error.message : error) });
  finish(error && error.harness ? 2 : 1);
} finally {
  if (clients) await clients.close();
  if (server) await server.stop();
}
