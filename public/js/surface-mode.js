/**
 * NARIMATO — surface mode.
 *
 * The zoom ladder's deepest step lands a five-tetrahedron ship on the planet.
 * For a deliberately small world, the pilot runs a full lap in ~60 seconds.
 * Terrain is drawn as flat-shaded triangles; entering a triangle auto-harvests
 * that active cell through the normal authoritative click path.
 */

import { drawTetraShip } from './shared/tetra-ship.js';
import { terrainAt } from './shared/planet.js';

const LAP_SECONDS = 60;
const ANGULAR_SPEED = (Math.PI * 2) / LAP_SECONDS;
const HARVEST_INTERVAL_MS = 900;
const WORLD_UP = { x: 0, y: 1, z: 0 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const norm = (v) => {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

function tangentBasis(p) {
  let east = cross(WORLD_UP, p);
  if (Math.hypot(east.x, east.y, east.z) < 0.02) east = cross({ x: 1, y: 0, z: 0 }, p);
  east = norm(east);
  const north = norm(cross(p, east));
  return { east, north };
}

function mixColor(hex, target, t) {
  const raw = String(hex || '#566').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full.slice(0, 6), 16) || 0x3c6a5a;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const rr = Math.round(r + (target.r - r) * t);
  const gg = Math.round(g + (target.g - g) * t);
  const bb = Math.round(b + (target.b - b) * t);
  return `rgb(${rr},${gg},${bb})`;
}

function faceContains(node, p) {
  const edges = [[node.a, node.b], [node.b, node.c], [node.c, node.a]];
  for (const [u, v] of edges) {
    let n = cross(u, v);
    if (dot(n, node.centroid) < 0) n = mul(n, -1);
    if (dot(n, p) < -1e-5) return false;
  }
  return true;
}

export function createSurfaceMode({
  getStartPoint = () => ({ x: 0, y: 0, z: 1 }),
  getLeaves = () => [],
  getPlanet = () => ({ name: 'UNKNOWN WORLD', seed: 0, depth: 2 }),
  onHarvest = () => {},
  onExit = () => {},
} = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let active = false;
  let exiting = false;
  let phase = 'idle';
  let startedAt = 0;
  let lastFrame = 0;
  let pos = { x: 0, y: 0, z: 1 };
  let heading = Math.PI / 2; // start running east along the equator
  let travel = 0;
  let harvestTimer = 0;
  let lastHarvestLabel = null;
  let keys = new Set();
  let planet = { name: '', seed: 0, depth: 2 };
  let lastHud = 0;
  let shown = false;

  function ensureDom() {
    if (!doc || shown) return;
    shown = true;
    overlay = doc.createElement('section');
    overlay.id = 'surface-overlay';
    overlay.className = 'surface-overlay is-hidden';
    overlay.hidden = true;
    overlay.setAttribute('aria-label', 'Surface mode');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <canvas id="surface-canvas" class="surface-canvas" aria-hidden="true"></canvas>
      <div class="surface-vignette" aria-hidden="true"></div>
      <header class="surface-head">
        <p class="surface-kicker">SURFACE MODE // ONE SMALL WORLD</p>
        <h2 id="surface-title" class="surface-title">TOUCHDOWN</h2>
        <p id="surface-planet" class="surface-planet"></p>
      </header>
      <div class="surface-stats" role="status" aria-live="polite">
        <span>LAP <b>60s</b></span>
        <span>RUN <b id="surface-run">0.0</b></span>
        <span>AUTO <b id="surface-auto">—</b></span>
      </div>
      <div class="surface-hint" id="surface-hint">WASD / ARROWS RUN · A / D TURN · SHIFT SPRINT · ENTER TRIANGLES TO HARVEST</div>
      <div class="surface-pads" aria-label="Surface movement controls">
        <button type="button" data-surface-hold="KeyW" aria-label="Run forward">▲</button>
        <button type="button" data-surface-hold="KeyA" aria-label="Turn left">◀</button>
        <button type="button" data-surface-hold="KeyS" aria-label="Run backward">▼</button>
        <button type="button" data-surface-hold="KeyD" aria-label="Turn right">▶</button>
      </div>
      <button id="btn-surface-exit" class="surface-exit" type="button">RETURN TO ORBIT</button>
    `;
    doc.body.appendChild(overlay);
    canvas = doc.getElementById('surface-canvas');
    if (canvas && canvas.getContext) ctx = canvas.getContext('2d');
    const exit = doc.getElementById('btn-surface-exit');
    if (exit) exit.addEventListener('click', () => stop());
    for (const btn of overlay.querySelectorAll('[data-surface-hold]')) {
      const code = btn.getAttribute('data-surface-hold');
      const on = (event) => {
        event.preventDefault();
        keys.add(code);
        btn.classList.add('is-held');
      };
      const off = () => {
        keys.delete(code);
        btn.classList.remove('is-held');
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    }
    resize();
  }

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(1.6, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setText(id, value) {
    const el = doc && doc.getElementById(id);
    if (el) el.textContent = value;
  }

  function findCell(p) {
    const leaves = getLeaves();
    for (const node of leaves) {
      if (!node || !node.a) continue;
      if (faceContains(node, p)) return node;
    }
    let best = null;
    let bestDot = -2;
    for (const node of leaves) {
      if (!node || !node.centroid) continue;
      const d = dot(node.centroid, p);
      if (d > bestDot) {
        bestDot = d;
        best = node;
      }
    }
    return best;
  }

  function harvestTick(dt) {
    if (phase !== 'walking') return;
    const cell = findCell(pos);
    if (!cell) return;
    // Entering a triangle starts harvesting; staying in it keeps charging it on
    // the authoritative server until it breaks or finds ore.
    if (cell.label !== lastHarvestLabel) {
      lastHarvestLabel = cell.label;
      setText('surface-auto', `${cell.label}`);
      harvestTimer = 0;
      onHarvest(cell.label);
    } else {
      harvestTimer += dt;
      if (harvestTimer >= HARVEST_INTERVAL_MS) {
        harvestTimer = 0;
        onHarvest(cell.label);
      }
    }
  }

  function update(dt) {
    const dtSec = dt / 1000;
    if (phase === 'landing') {
      if (performance.now() - startedAt > 2200) phase = 'walking';
      return;
    }
    if (phase !== 'walking') return;
    const forward = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
    const backward = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0;
    const right = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
    const turn = (right - left) * 1.7 * dtSec;
    heading += turn;
    const motion = forward - backward;
    if (motion) {
      const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.65 : 1;
      heading += 0;
      const step = ANGULAR_SPEED * motion * sprint * dtSec;
      const basis = tangentBasis(pos);
      const fwd = add(mul(basis.north, Math.cos(heading)), mul(basis.east, Math.sin(heading)));
      pos = norm(add(mul(pos, Math.cos(step)), mul(fwd, Math.sin(step))));
      travel += Math.abs(step);
    }
    harvestTick(dt);
  }

  function projectPoint(point, cam, basis, w, h) {
    const rel = sub(point, cam);
    const z = dot(rel, basis.f);
    if (z <= 0.035) return null;
    const focal = h * 1.15;
    return {
      x: w / 2 + (dot(rel, basis.r) / z) * focal,
      y: h * 0.57 - (dot(rel, basis.u) / z) * focal,
      z,
    };
  }

  function drawGroundMesh(w, h, now) {
    // Triangle-only ground shell. It is intentionally a low-poly approximation:
    // the authoritative cells still drive harvesting, while this gives the
    // running pilot a complete, readable horizon and foreground.
    const horizonY = h * 0.34;
    const rows = 32;
    const cols = 40;
    const palette = ['#1c2142', '#253955', '#2f4d5a', '#3a5b58', '#514d48', '#3a2d52', '#2a2448'];
    const hash = (n) => {
      let x = Math.imul(n ^ (n >>> 13), 0x5bd1e995) ^ Math.imul(Math.floor(travel * 9), 0x27d4eb2d);
      x ^= x >>> 15;
      return (x >>> 0) % palette.length;
    };
    const grid = [];
    for (let r = 0; r <= rows; r += 1) {
      const t = r / rows;
      const y = horizonY + (h - horizonY) * (t ** 1.62);
      const half = w * (0.34 + t * 0.88);
      const row = [];
      for (let c = 0; c <= cols; c += 1) {
        const u = c / cols;
        const jitter = (((r * 73 + c * 151) % 13) / 13 - 0.5) * w * 0.006 * (0.25 + t);
        row.push({
          x: w / 2 + (u - 0.5) * 2 * half + Math.sin(travel * 0.7 + heading) * w * 0.018 * t + jitter,
          y: y + Math.sin(u * Math.PI * 5 + travel * 0.25) * h * 0.007 * (1 - t) * t + jitter * 0.35,
        });
      }
      grid.push(row);
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const d = grid[r + 1][c];
        const e = grid[r + 1][c + 1];
        const triA = hash(r * 131 + c * 17 + 3);
        const triB = hash(r * 131 + c * 17 + 11 + Math.floor(heading * 3));
        for (const [tri, idx] of [[[a, b, d], triA], [[b, e, d], triB]]) {
          ctx.fillStyle = palette[idx];
          ctx.globalAlpha = 0.5 + (r / rows) * 0.34;
          ctx.beginPath();
          ctx.moveTo(tri[0].x, tri[0].y);
          ctx.lineTo(tri[1].x, tri[1].y);
          ctx.lineTo(tri[2].x, tri[2].y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Distant low-poly ridge.
    for (let i = 0; i < 22; i += 1) {
      const x = (i / 22) * w;
      const peak = horizonY - 10 - ((i * 37) % 52);
      ctx.fillStyle = i % 2 ? 'rgba(52,44,92,0.7)' : 'rgba(37,35,72,0.7)';
      ctx.beginPath();
      ctx.moveTo(x, horizonY + 10);
      ctx.lineTo(x + w / 22, horizonY + 10);
      ctx.lineTo(x + w / 44, peak);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTerrain(w, h, now) {
    // Sky / atmosphere.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#09061c');
    sky.addColorStop(0.55, '#20124d');
    sky.addColorStop(0.82, '#3b255f');
    sky.addColorStop(1, '#120a20');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 80; i += 1) {
      const x = ((i * 977) % Math.max(1, w));
      const y = ((i * 431) % Math.max(1, h * 0.6));
      const a = 0.16 + ((i * 13) % 60) / 100;
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
    // A deep ground base prevents any unfilled void below the horizon.
    const groundBase = ctx.createLinearGradient(0, h * 0.28, 0, h);
    groundBase.addColorStop(0, '#17143b');
    groundBase.addColorStop(0.55, '#18103a');
    groundBase.addColorStop(1, '#0d0820');
    ctx.fillStyle = groundBase;
    ctx.fillRect(0, h * 0.28, w, h * 0.72);
    drawGroundMesh(w, h, now);

    // Horizon glow.
    const horizon = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.72);
    horizon.addColorStop(0, 'rgba(120,190,255,0)');
    horizon.addColorStop(0.55, 'rgba(120,190,255,0.06)');
    horizon.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, w, h);

    // Landing ship.
    if (phase === 'landing') {
      const k = clamp01((performance.now() - startedAt) / 2200);
      drawTetraShip(ctx, {
        x: w / 2,
        y: -80 + (h * 0.57 + 100) * k,
        scale: 1.35 + k * 1.2,
        yaw: 0.6 + k * 1.8,
        pitch: -0.4,
        roll: 0.2,
        hull: '#e8fbff',
        fin: '#52d9ff',
        edge: '#bffaff',
        glow: '#55eaff',
        alpha: 0.95,
      });
    }
    if (phase === 'walking' || exiting) drawAvatar(w, h, now);
    // Ship leaving after exit.
    if (exiting) {
      const k = clamp01((performance.now() - leaveStart) / 1600);
      drawTetraShip(ctx, {
        x: w / 2 + k * 160,
        y: h * 0.62 - k * h * 0.8,
        scale: 1.2 + k * 1.8,
        yaw: 0.7 + k * 2,
        pitch: -0.4,
        glow: '#55eaff',
        alpha: 1 - k * 0.3,
      });
    }
  }

  function drawAvatar(w, h, now) {
    const bob = Math.sin(now / 180) * 2;
    const x = w / 2;
    const y = h * 0.72 + bob;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 76, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const body = '#5f7fff';
    const edge = '#a9ffff';
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.4;
    // Head.
    ctx.fillStyle = '#b9e9ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 77);
    ctx.lineTo(x + 12, y - 58);
    ctx.lineTo(x - 12, y - 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Torso.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x, y - 55);
    ctx.lineTo(x + 19, y - 10);
    ctx.lineTo(x, y + 26);
    ctx.lineTo(x - 19, y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Legs.
    ctx.fillStyle = '#334aa8';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 4, y + 18);
      ctx.lineTo(x + s * 22, y + 66);
      ctx.lineTo(x + s * 8, y + 68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Arms.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 14, y - 38);
      ctx.lineTo(x + s * 30, y + 2 + Math.sin(now / 160) * 4);
      ctx.lineTo(x + s * 20, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  let leaveStart = 0;

  function frame(now) {
    if (!active) return;
    const dt = Math.min(64, Math.max(0, now - (lastFrame || now)));
    lastFrame = now;
    update(dt);
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    drawTerrain(w, h, now);
    if (now - lastHud > 200) {
      lastHud = now;
      setText('surface-run', (travel / (Math.PI * 2)).toFixed(2));
      if (phase === 'landing') setText('surface-title', 'TOUCHDOWN');
      else setText('surface-title', `RUN // ${(travel / (Math.PI * 2)).toFixed(2)} LAP`);
    }
    if (exiting && now - leaveStart > 1600) {
      exiting = false;
      hide();
      onExit();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start(options = {}) {
    ensureDom();
    if (!overlay) return false;
    if (active) return true;
    const planetInfo = getPlanet() || {};
    planet = {
      name: String(options.planetName || planetInfo.name || 'UNKNOWN WORLD'),
      seed: Number.isInteger(options.seed) ? options.seed : Number(planetInfo.seed) || 0,
      depth: Number(options.depth || planetInfo.depth) || 2,
    };
    pos = norm(getStartPoint() || { x: 0, y: 0, z: 1 });
    heading = Math.PI / 2;
    travel = 0;
    lastHarvestLabel = null;
    harvestTimer = 0;
    phase = 'landing';
    exiting = false;
    keys = new Set();
    active = true;
    startedAt = performance.now();
    lastFrame = startedAt;
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    doc.body.classList.add('is-surface');
    setText('surface-planet', `${planet.name} // LAP ${LAP_SECONDS}s`);
    setText('surface-title', 'TOUCHDOWN');
    setText('surface-hint', 'WASD / ARROWS RUN · A / D TURN · SHIFT SPRINT · ENTER TRIANGLES TO HARVEST');
    resize();
    const exit = doc.getElementById('btn-surface-exit');
    if (exit) exit.focus({ preventScroll: true });
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('resize', resize);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    return true;
  }

  function onKeyDown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function onKeyUp(event) {
    if (!active) return;
    keys.delete(event.code);
  }

  function stop() {
    if (!active) return;
    phase = 'leaving';
    exiting = true;
    leaveStart = performance.now();
    setText('surface-title', 'LEAVING SURFACE');
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('resize', resize);
    // Let the ship fly out before revealing the orbital HUD.
  }

  function hide() {
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    if (overlay) {
      overlay.classList.add('is-hidden');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (doc && doc.body) doc.body.classList.remove('is-surface');
  }

  return {
    start,
    stop,
    hide,
    resize,
    get active() { return active; },
    get phase() { return phase; },
  };
}
