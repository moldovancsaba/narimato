/**
 * NARIMATO — surface mode.
 *
 * The zoom ladder's deepest step lands a five-tetrahedron ship on the planet.
 * For a deliberately small world, the pilot runs a full lap in ~60 seconds.
 * Terrain is drawn as flat-shaded triangles; entering a triangle auto-harvests
 * that active cell through the normal authoritative click path.
 */

import { drawTetraShip } from './shared/tetra-ship.js';
import { childTriangles, faceCentroid, getMesh } from './shared/geometry.js';
import { isRareResource } from './shared/mission.js';

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

/** Project a vector onto the tangent plane at `up` and normalize it. */
export function tangentAt(up, vector) {
  const u = norm(up);
  const d = dot(vector, u);
  return norm(sub(vector, mul(u, d)));
}

/** Rotate a tangent vector around the local surface normal. */
export function turnSurface(forward, up, angle) {
  const f = tangentAt(up, forward);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return tangentAt(up, add(mul(f, cos), mul(cross(up, f), sin)));
}

/** Advance across the sphere and parallel-transport the heading tangent. */
export function advanceSurface(up, forward, step) {
  const u = norm(up);
  const f = tangentAt(u, forward);
  const cos = Math.cos(step);
  const sin = Math.sin(step);
  const nextUp = norm(add(mul(u, cos), mul(f, sin)));
  const nextForward = tangentAt(nextUp, add(mul(f, cos), mul(u, -sin)));
  return { up: nextUp, forward: nextForward };
}

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
  getPlayers = () => [],
  getMyPlayerId = () => null,
  getMyIndex = () => -1,
  getMaxDepth = () => 8,
  getMission = () => null,
  onHarvest = () => {},
  onExit = () => {},
  getPeers = () => [],
  onPose = () => {},
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
  let heading = Math.PI / 2; // display bearing; movement uses the tangent vector below
  let headingVec = { x: 1, y: 0, z: 0 };
  let travel = 0;
  let harvestTimer = 0;
  let harvestCheck = 0;
  let harvestQueue = [];
  let lastHarvestLabel = null;
  let keys = new Set();
  let planet = { name: '', seed: 0, depth: 2 };
  let lastHud = 0;
  let lastPoseAt = 0;
  let shown = false;
  let debug = {};
  let effects = [];
  let missionSignature = '';
  let missionTick = 0;
  const SURFACE_RADIUS = 0.44;
  const MAX_SURFACE_SUBDIV = 4;
  const FOOTPRINT_RADIUS = 0.028;
  const visualCache = new Map();
  const baseSphere = getMesh(4).faces;

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
      <aside class="surface-mission" aria-label="What the ship needs">
        <h3>WHAT SHE NEEDS</h3>
        <ul id="surface-mission-list"></ul>
        <p class="surface-legend"><i class="is-open"></i> GREEN = HARVEST <i class="is-red"></i> RED = LOCKED / EMPTY</p>
      </aside>
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

  function cellsUnderFoot() {
    const fwd = headingVec;
    const right = norm(cross(fwd, pos));
    const samples = [[0, 0]];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      samples.push([Math.cos(a) * FOOTPRINT_RADIUS, Math.sin(a) * FOOTPRINT_RADIUS]);
    }
    const found = new Map();
    for (const [x, z] of samples) {
      const point = norm(add(pos, add(mul(right, x), mul(fwd, z))));
      const cell = findCell(point);
      if (cell && canHarvestNode(cell)) found.set(cell.label, cell);
    }
    return [...found.values()];
  }

  function harvestTick(dt) {
    if (phase !== 'walking') return;
    harvestCheck += dt;
    if (harvestCheck < 180) return;
    harvestCheck = 0;
    const cells = cellsUnderFoot();
    if (!cells.length) return;
    // Every triangle touched by the avatar's footprint is harvested, not only
    // the single cell under its centre point.
    const next = cells.find((cell) => cell.label !== lastHarvestLabel) || cells[0];
    if (!next) return;
    lastHarvestLabel = next.label;
    setText('surface-auto', next.label);
    effects.push({ start: performance.now(), color: '#9efcff', name: '', value: 0 });
    effects = effects.slice(-4);
    onHarvest(next.label);
    // Drain the rest of the footprint on subsequent throttled ticks.
    for (const cell of cells) {
      if (cell.label !== next.label) {
        harvestQueue.push(cell.label);
        if (harvestQueue.length > 12) harvestQueue.shift();
      }
    }
    if (harvestQueue.length && performance.now() - harvestTimer > HARVEST_INTERVAL_MS) {
      harvestTimer = performance.now();
      const queued = harvestQueue.shift();
      if (queued) onHarvest(queued);
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
    if (turn) headingVec = turnSurface(headingVec, pos, turn);
    const motion = forward - backward;
    if (motion) {
      const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.65 : 1;
      const step = ANGULAR_SPEED * motion * sprint * dtSec;
      const moved = advanceSurface(pos, headingVec, step);
      pos = moved.up;
      headingVec = moved.forward;
      travel += Math.abs(step);
    }
    harvestTick(dt);
    const nowMs = performance.now();
    if (nowMs - lastPoseAt > 110) {
      lastPoseAt = nowMs;
      const basis = tangentBasis(pos);
      heading = Math.atan2(dot(headingVec, basis.east), dot(headingVec, basis.north));
      onPose({
        pos: { ...pos },
        heading,
        moving: !!(forward || backward),
      });
    }
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

  function visualTriangles(node) {
    // Subdivide large active cells more than small ones. Every child vertex is
    // normalised back to the sphere, so these are spherical arc triangles, not
    // flat chords.
    const angle = (p, q) => Math.acos(clamp(dot(p, q), -1, 1));
    const edge = Math.max(
      angle(node.a, node.b),
      angle(node.b, node.c),
      angle(node.c, node.a),
    );
    const level = clamp(Math.ceil(Math.log2(Math.max(1e-4, edge / 0.055))), 0, MAX_SURFACE_SUBDIV);
    const key = `${node.label}:${level}`;
    if (visualCache.has(key)) return visualCache.get(key);
    let tris = [{ a: node.a, b: node.b, c: node.c }];
    for (let i = 0; i < level; i += 1) {
      const next = [];
      for (const tri of tris) {
        for (const child of childTriangles(tri.a, tri.b, tri.c)) {
          next.push({ a: child.a, b: child.b, c: child.c });
        }
      }
      tris = next;
    }
    const out = tris.map((tri) => ({ ...tri, center: faceCentroid(tri.a, tri.b, tri.c) }));
    visualCache.set(key, out);
    return out;
  }


  function canHarvestNode(node) {
    if (!node) return false;
    const myIndex = getMyIndex();
    if (node.ownerIndex === myIndex && node.lastClickIndex === myIndex) return false;
    if (node.depth >= getMaxDepth() && node.resourceId) return false;
    return true;
  }

  function leafColor(node) {
    const can = canHarvestNode(node);
    if (!can) return { fill: '#ff2d55', edge: '#ffafbd', open: false };
    return { fill: '#20d87a', edge: '#b6ffd0', open: true };
  }


  function updateMissionPanel(now) {
    if (now - missionTick < 400) return;
    missionTick = now;
    let info = null;
    try { info = getMission(); } catch { info = null; }
    const progress = info && info.progress ? info.progress : null;
    const planet = info && info.planet ? info.planet : planet;
    const worldName = planet.name || planet.planetName || 'UNKNOWN WORLD';
    setText('surface-planet', `${worldName} // LAP ${LAP_SECONDS}s`);
    const signature = progress
      ? `${progress.ready}:${progress.objectives.map((o) => o.items.map((i) => `${i.resourceId}:${i.have}:${i.need}`).join(',')).join('|')}`
      : 'offline';
    if (signature === missionSignature) return;
    missionSignature = signature;
    const list = doc && doc.getElementById('surface-mission-list');
    if (!list) return;
    if (!progress) {
      list.innerHTML = '<li>MISSION DATA OFFLINE</li>';
      return;
    }
    list.innerHTML = progress.objectives
      .flatMap((objective) => objective.items.map((item) => {
        const rare = isRareResource(item.resourceId) ? ' <em>RARE</em>' : '';
        const cls = item.done ? 'is-done' : '';
        return `<li class="${cls}"><span>${objective.name.slice(0, 4)}</span><b>${item.name}</b><i>${item.have}/${item.need}</i>${rare}</li>`;
      }))
      .join('') + (progress.ready ? '<li class="is-ready">READY TO FLY</li>' : '');
  }

  function harvestEffect(effect = {}) {
    if (!active) return;
    effects.push({
      start: performance.now(),
      color: (effect.resource && effect.resource.color) || '#ffe066',
      name: (effect.resource && effect.resource.name) || '',
      value: Number(effect.value) || 0,
    });
    effects = effects.slice(-4);
  }

  function drawHarvestEffects(w, h, now) {
    if (!effects.length) return;
    effects = effects.filter((effect) => now - effect.start < 1600);
    for (const effect of effects) {
      const k = clamp01((now - effect.start) / 1600);
      const x = w / 2;
      const y = h * 0.69;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Tractor cone from the ship above to the harvested triangle.
      ctx.fillStyle = `rgba(120,255,190,${0.18 * (1 - k)})`;
      ctx.beginPath();
      ctx.moveTo(x - 18, 0);
      ctx.lineTo(x + 18, 0);
      ctx.lineTo(x + 90, y);
      ctx.lineTo(x - 90, y);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 22; i += 1) {
        const a = (i / 22) * Math.PI * 2 + k * 2;
        const r = 18 + k * 130 + (i % 4) * 9;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45 - 20);
        ctx.lineTo(x + Math.cos(a + 0.18) * (r + 9), y + Math.sin(a + 0.18) * (r + 9) * 0.45 - 20);
        ctx.lineTo(x + Math.cos(a - 0.18) * (r + 9), y + Math.sin(a - 0.18) * (r + 9) * 0.45 - 20);
        ctx.closePath();
        ctx.fill();
      }
      if (effect.value > 0) {
        ctx.globalAlpha = 0.9 * (1 - k);
        ctx.fillStyle = effect.color;
        ctx.font = '700 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`+${effect.value} ${effect.name}`, x, y - 52 - k * 42);
      }
      ctx.restore();
      // The ship is the source of the beam; show its silhouette above.
      drawTetraShip(ctx, {
        x: w / 2,
        y: h * 0.07 + Math.sin(k * Math.PI) * 8,
        scale: 0.55,
        yaw: 0.6 + k,
        pitch: -0.4,
        hull: '#e8fbff',
        fin: effect.color,
        edge: '#bffaff',
        glow: effect.color,
        alpha: 0.55 * (1 - k),
        engine: false,
        shadow: false,
      });
    }
    ctx.globalAlpha = 1;
  }

  function virtualPeerPosition(peer, now) {
    const id = String(peer.playerId || peer.tag || 'PILOT');
    let hash = 2166136261;
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;
    const fwd = headingVec;
    const right = norm(cross(fwd, pos));
    const radius = 0.07 + ((hash >>> 8) % 80) / 1000;
    const angle = now * (0.00008 + (hash % 7) * 0.00002) + (hash % 360) * (Math.PI / 180);
    const tangent = add(mul(right, Math.cos(angle) * radius), mul(fwd, Math.sin(angle) * radius));
    return norm(add(pos, tangent));
  }

  function drawTerrain(w, h, now) {
    // Live cell mesh only: no generated geography, no terrain sampling. Every
    // triangle is an actual active cell from the game world.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#050414');
    sky.addColorStop(0.55, '#17103a');
    sky.addColorStop(1, '#0b0818');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 75; i += 1) {
      const sx = (i * 977) % Math.max(1, w);
      const sy = (i * 431) % Math.max(1, h * 0.6);
      ctx.globalAlpha = 0.1 + ((i * 17) % 50) / 100;
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;

    const up = pos;
    const fwd = headingVec;
    const playerPoint = mul(pos, SURFACE_RADIUS);
    const cam = add(playerPoint, add(mul(up, 0.035), mul(fwd, -0.055)));
    const target = add(playerPoint, add(mul(fwd, 0.18), mul(up, -0.065)));
    const camF = norm(sub(target, cam));
    const camR = norm(cross(camF, up));
    const camU = norm(cross(camR, camF));
    const view = { f: camF, r: camR, u: camU };
    const focal = h * 1.02;
    // Opaque low-poly planet shell under the live cells: hides the far side and
    // keeps the surface visually continuous without any geography sampling.
    const shell = [];
    for (const face of baseSphere) {
      const center = mul(face.centroid, SURFACE_RADIUS * 0.998);
      if (dot(center, pos) < 0.02) continue;
      const verts = [face.a, face.b, face.c].map((v) => mul(v, SURFACE_RADIUS * 0.998));
      const projected = verts.map((v) => projectPoint(v, cam, view, w, h));
      if (projected.some((p) => !p)) continue;
      const depth = (projected[0].z + projected[1].z + projected[2].z) / 3;
      shell.push({ projected, depth });
    }
    shell.sort((a, b) => b.depth - a.depth);
    for (const face of shell) {
      ctx.fillStyle = '#091522';
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.moveTo(face.projected[0].x, face.projected[0].y);
      ctx.lineTo(face.projected[1].x, face.projected[1].y);
      ctx.lineTo(face.projected[2].x, face.projected[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#4c7d9f';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const tris = [];
    const leaves = getLeaves();
    let drawn = 0;
    const threshold = 4;
    for (const node of leaves) {
      if (!node || !node.a || !node.b || !node.c) continue;
      const parentCenter = mul(node.centroid, SURFACE_RADIUS);
      if (dot(parentCenter, pos) < 0.05) continue;
      const colors = leafColor(node);
      const frac = clamp01((node.clicks || 0) / threshold);
      for (const visual of visualTriangles(node)) {
        const center = mul(visual.center, SURFACE_RADIUS);
        if (dot(center, pos) < 0.03) continue;
        const verts = [visual.a, visual.b, visual.c].map((v) => mul(v, SURFACE_RADIUS));
        const projected = verts.map((v) => projectPoint(v, cam, view, w, h));
        if (projected.some((p) => !p)) continue;
        const depth = (projected[0].z + projected[1].z + projected[2].z) / 3;
        tris.push({ colors, frac, projected, depth, label: node.label });
        drawn += 1;
      }
    }
    debug = { leaves: leaves.length, drawn };
    tris.sort((a, b) => b.depth - a.depth);
    for (const tri of tris) {
      ctx.fillStyle = tri.colors.fill;
      ctx.globalAlpha = 0.45 + tri.frac * 0.42;
      ctx.beginPath();
      ctx.moveTo(tri.projected[0].x, tri.projected[0].y);
      ctx.lineTo(tri.projected[1].x, tri.projected[1].y);
      ctx.lineTo(tri.projected[2].x, tri.projected[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = tri.colors.edge;
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

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
    if (phase === 'walking' || exiting) {
      updateMissionPanel(now);
      drawAvatar(w, h, now, null);
      for (const peer of getPeers()) {
        if (!peer || peer.playerId === getMyPlayerId()) continue;
        const peerPos = peer.pos && Number.isFinite(peer.pos.x) ? peer.pos : virtualPeerPosition(peer, now);
        if (!peerPos) continue;
        if (dot(peerPos, pos) < -0.2) continue;
        const wp = mul(peerPos, SURFACE_RADIUS);
        const anchor = projectPoint(wp, cam, view, w, h);
        if (!anchor) continue;
        drawAvatar(w, h, now, anchor, {
          scale: 0.85,
          tint: peer.color || '#a78bfa',
          label: peer.tag || 'PILOT',
        });
      }
    }
    drawHarvestEffects(w, h, now);
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


  function drawAvatar(w, h, now, anchor = null, options = {}) {
    const bob = Math.sin(now / 170) * 2.5;
    const x = anchor ? anchor.x : w / 2;
    const y = (anchor ? anchor.y : h * 0.72) + bob;
    const scale = options.scale || 1.45;
    const tint = options.tint || null;
    const stride = Math.sin(now / 150) * 0.45;
    const moving = keys.has('KeyW') || keys.has('KeyS') || keys.has('ArrowUp') || keys.has('ArrowDown');
    const swing = moving ? stride : 0;
    const armor = tint || '#2f4f9e';
    const armorLight = tint ? '#c9b8ff' : '#6a8dff';
    const trim = '#9efcff';
    const visor = '#d4ff3f';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // Contact shadow.
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 78, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = trim;
    ctx.lineWidth = 1.35;
    // Backpack.
    ctx.fillStyle = '#1c2b5a';
    ctx.beginPath();
    ctx.moveTo(-18, -38);
    ctx.lineTo(18, -38);
    ctx.lineTo(14, 2);
    ctx.lineTo(-14, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Legs: thigh + shin triangles, alternating stride.
    for (const side of [-1, 1]) {
      const lift = side * swing * 16;
      const hipX = side * 9;
      ctx.fillStyle = '#253b74';
      ctx.beginPath();
      ctx.moveTo(hipX - 8, 22);
      ctx.lineTo(hipX + 8, 22);
      ctx.lineTo(hipX + side * 6 + lift, 52);
      ctx.lineTo(hipX - side * 5 + lift, 52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2c4a8f';
      ctx.beginPath();
      ctx.moveTo(hipX + side * 6 + lift, 52);
      ctx.lineTo(hipX - side * 5 + lift, 52);
      ctx.lineTo(hipX + side * 2 + lift * 0.2, 76);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Torso diamond + chest plate.
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(28, -12);
    ctx.lineTo(0, 30);
    ctx.lineTo(-28, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = armorLight;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(18, -8);
    ctx.lineTo(0, 18);
    ctx.lineTo(-18, -8);
    ctx.closePath();
    ctx.fill();
    // Arms: shoulder + upper/lower triangular segments.
    for (const side of [-1, 1]) {
      const swingArm = -side * swing * 18;
      ctx.fillStyle = '#263d7a';
      ctx.beginPath();
      ctx.moveTo(side * 24, -24);
      ctx.lineTo(side * 42, -15 + swingArm * 0.4);
      ctx.lineTo(side * 30, 12 + swingArm);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#304f96';
      ctx.beginPath();
      ctx.moveTo(side * 30, 8 + swingArm);
      ctx.lineTo(side * 42, 28 + swingArm);
      ctx.lineTo(side * 26, 32 + swingArm);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Shoulder pad.
      ctx.beginPath();
      ctx.moveTo(side * 21, -32);
      ctx.lineTo(side * 38, -30);
      ctx.lineTo(side * 27, -13);
      ctx.closePath();
      ctx.fillStyle = '#4169d8';
      ctx.fill();
      ctx.stroke();
    }
    // Helmet / head: faceted cranium, faceplate and jaw.
    ctx.fillStyle = '#d8f6ff';
    ctx.beginPath();
    ctx.moveTo(0, -96);
    ctx.lineTo(15, -78);
    ctx.lineTo(18, -55);
    ctx.lineTo(9, -43);
    ctx.lineTo(-9, -43);
    ctx.lineTo(-18, -55);
    ctx.lineTo(-15, -78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = visor;
    ctx.beginPath();
    ctx.moveTo(-11, -76);
    ctx.lineTo(11, -76);
    ctx.lineTo(13, -60);
    ctx.lineTo(0, -52);
    ctx.lineTo(-13, -60);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#d8f6ff';
    ctx.beginPath();
    ctx.moveTo(0, -100);
    ctx.lineTo(5, -94);
    ctx.lineTo(-5, -94);
    ctx.closePath();
    ctx.fill();
    // Neck.
    ctx.fillStyle = '#334a74';
    ctx.fillRect(-5, -44, 10, 7);
    // Chest core.
    ctx.fillStyle = visor;
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(7, -11);
    ctx.lineTo(0, 1);
    ctx.lineTo(-7, -11);
    ctx.closePath();
    ctx.fill();
    if (options.label) {
      ctx.scale(1 / scale, 1 / scale);
      ctx.fillStyle = '#e9ffff';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(options.label).slice(0, 12), 0, -102);
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
    const startBasis = tangentBasis(pos);
    headingVec = tangentAt(pos, startBasis.east);
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
    lastPoseAt = 0;
    onPose({ pos: { ...pos }, heading, moving: false });
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
    debug: () => debug,
    peers: () => getPeers().length,
    harvestEffect,
  };
}
