/**
 * Render two views of the SAME active-cell planet:
 *   1. orbit camera
 *   2. surface camera
 * Same renderer, same face list, same spherical triangles, no HUD/avatars.
 */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const outDir = process.env.OUT_DIR || 'media';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
await delay(600);
await page.fill('#tag-input', `R${Date.now().toString(36).slice(-6)}`.toUpperCase());
await page.click('#btn-join');
await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 12000 });
await delay(900);

const result = await page.evaluate(async () => {
  const { IcosaRenderer } = await import('/js/renderer.js');
  const { SphereCamera } = await import('/js/shared/geometry.js');
  const { SurfaceCamera } = await import('/js/shared/surface-camera.js');
  const app = window.__ICOSA__;
  const state = app.state;
  const leaves = app.world.activeLeaves();
  const canvas = document.createElement('canvas');
  const W = 1600;
  const H = 1000;
  canvas.style.cssText = `width:${W}px;height:${H}px`;
  document.body.appendChild(canvas);
  const renderer = new IcosaRenderer(canvas);
  renderer.resize();
  renderer.setConfig({ threshold: state.threshold, maxDepth: state.maxDepth });
  renderer.setLiveSurface({ leaves, revision: app.worldRevision(), seed: state.planetSeed });
  renderer.setFaces(leaves);
  renderer.setPlayers(state.players, app.player && app.player.id);
  renderer.setSurfaceView(false);
  const orbit = new SphereCamera({ width: W, height: H });
  orbit.reset();
  orbit.zoom = 1;
  renderer.render(orbit, performance.now());
  const orbitImage = canvas.toDataURL('image/png');

  // Pick an actual active leaf (do not generate any geometry) and use its
  // centroid as the surface camera position.
  let leaf = leaves[0];
  for (const candidate of leaves) if (candidate.depth > leaf.depth) leaf = candidate;
  const forward = { x: -leaf.centroid.z, y: 0, z: leaf.centroid.x };
  const surface = new SurfaceCamera(W, H);
  surface.setPose(leaf.centroid, forward);
  renderer.setSurfaceView(true);
  renderer.render(surface, performance.now());
  const surfaceImage = canvas.toDataURL('image/png');
  return {
    orbitImage, surfaceImage,
    faces: leaves.length,
    leafLabel: leaf.label,
    leafDepth: leaf.depth,
    sameFaceSet: renderer.faces.length,
  };
});

const decode = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
await fs.writeFile(`${outDir}/planet-orbit.png`, decode(result.orbitImage));
await fs.writeFile(`${outDir}/planet-surface.png`, decode(result.surfaceImage));
console.log(JSON.stringify({ ...result, orbitImage: 'media/planet-orbit.png', surfaceImage: 'media/planet-surface.png', errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
