/**
 * One planet, one camera instance, three altitudes:
 *   orbit → commercial-flight height → building height (camera rotated to horizon)
 * Same active face set, same IcosaRenderer. No generated geometry/HUD.
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
await delay(500);
await page.fill('#tag-input', `ALT${Date.now().toString(36).slice(-5)}`.toUpperCase());
await page.click('#btn-join');
await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
await delay(900);

const result = await page.evaluate(async () => {
  const { IcosaRenderer } = await import('/js/renderer.js');
  const app = window.__ICOSA__;
  const leaves = app.world.activeLeaves();
  const state = app.state;
  const W = 1600;
  const H = 1000;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `width:${W}px;height:${H}px`;
  document.body.appendChild(canvas);
  const renderer = new IcosaRenderer(canvas);
  renderer.resize();
  renderer.setConfig({ threshold: state.threshold, maxDepth: state.maxDepth });
  renderer.setPlanetSurface(state.planetSeed);
  renderer.setFaces(leaves);
  renderer.setPlayers(state.players, app.player && app.player.id);

  // ONE camera instance with two projection modes.
  class PlanetCamera {
    constructor(w, h) { this.width = w; this.height = h; this.mode = 'orbit'; this.origin = null; this._view = null; }
    setOrbit() {
      this.mode = 'orbit'; this.origin = null; this._view = null;
      this.zoom = 1;
      return this;
    }
    setAltitude(pos, altitude) {
      this.mode = 'near'; this.origin = pos; this.altitude = altitude;
      const up = norm(pos);
      const f = norm(tangent(up, { x: 1, y: 0, z: 0 }));
      const cam = add(mul(up, 1 + altitude), mul(f, -Math.max(0.004, altitude * 0.08)));
      const target = add(add(up, mul(f, 0.9)), mul(up, -Math.max(0.002, altitude * 0.16)));
      const fwd = norm(sub(target, cam));
      const right = norm(cross(fwd, up));
      const vup = norm(cross(right, fwd));
      this._view = { cam, fwd, right, up: vup };
      return this;
    }
    viewAxis() { return this._view ? norm(this._view.cam) : { x: 0, y: 0, z: 1 }; }
    get yaw() { return 0; }
    get pitch() { return 0; }
    project(v) {
      if (this.mode === 'orbit') {
        const d = 3.2;
        const radius = Math.min(this.width, this.height) * 0.34;
        const scale = (radius * d) / Math.max(0.001, d - v.z);
        return { x: this.width / 2 + v.x * scale, y: this.height / 2 - v.y * scale, z: v.z };
      }
      const { cam, fwd, right, up } = this._view;
      const rel = sub(v, cam);
      const z = dot(rel, fwd);
      if (z <= 0.002) return { x: 0, y: 0, z, visible: false };
      const focal = this.height * 1.35;
      return {
        x: this.width / 2 + (dot(rel, right) / z) * focal,
        y: this.height * 0.58 - (dot(rel, up) / z) * focal,
        z,
        visible: true,
      };
    }
  }
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x/l, y: v.y/l, z: v.z/l }; };
  const dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
  const cross = (a,b) => ({ x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x });
  const add = (a,b) => ({ x:a.x+b.x, y:a.y+b.y, z:a.z+b.z });
  const sub = (a,b) => ({ x:a.x-b.x, y:a.y-b.y, z:a.z-b.z });
  const mul = (a,k) => ({ x:a.x*k, y:a.y*k, z:a.z*k });
  const tangent = (up, v) => norm(sub(v, mul(up, dot(v, up))));

  const camera = new PlanetCamera(W, H);
  const shots = {};
  camera.setOrbit();
  renderer.setSurfaceView(false);
  renderer.render(camera, performance.now());
  shots.orbit = canvas.toDataURL('image/png');

  // Same camera, commercial-flight altitude over the actual surface.
  const home = leaves[0].centroid;
  camera.setAltitude(home, 0.22);
  renderer.setSurfaceView(true);
  renderer.render(camera, performance.now());
  shots.flight = canvas.toDataURL('image/png');

  // Same camera, building height, still aimed at the horizon.
  camera.setAltitude(home, 0.012);
  renderer.render(camera, performance.now());
  shots.building = canvas.toDataURL('image/png');

  return { shots, faces: leaves.length, leaf: leaves[0].label, sameFaces: renderer.faces.length };
});

const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
await fs.writeFile(`${outDir}/planet-orbit.png`, decode(result.shots.orbit));
await fs.writeFile(`${outDir}/planet-flight.png`, decode(result.shots.flight));
await fs.writeFile(`${outDir}/planet-building.png`, decode(result.shots.building));
console.log(JSON.stringify({ faces: result.faces, leaf: result.leaf, sameFaces: result.sameFaces, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
