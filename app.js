import { PHASES, LANDING, phaseCamera } from './camera.js';
import { V2Renderer } from './renderer.js';
import { subdividedIcosahedron } from './geometry.js';
import { collectTriangle, createGame, publicState, tickRobots } from './game-rules.js';

const planetCanvas = document.getElementById('planet-canvas');
const gameCanvas = document.getElementById('game-canvas');
const gctx = gameCanvas.getContext('2d');
const renderer = new V2Renderer(planetCanvas);
const phaseLabel = document.getElementById('phase-label');
const progressEl = document.getElementById('progress');
const planetEl = document.getElementById('planet');
const robotsEl = document.getElementById('robots');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const previewPhase = params.has('phase') ? Math.max(0, Math.min(3, Number(params.get('phase')) || 0)) : null;

let state = null;
let offlineGame = null;
let phase = previewPhase ?? 0;
let lastClick = 0;
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const TANGENT = norm(cross(cross(LANDING, { x: 0, y: 1, z: 0 }), LANDING));
const SIDE = norm(cross(LANDING, TANGENT));

const slerp = (a, b, t) => {
  const omega = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (omega < 1e-5) return a;
  const so = Math.sin(omega);
  return norm(add(mul(a, Math.sin((1 - t) * omega) / so), mul(b, Math.sin(t * omega) / so)));
};

/** The planet surface: the 20 spherical icosahedron faces. These ARE the collectibles. */
const BASE = subdividedIcosahedron(1);
const TRIANGLE_CELLS = BASE.faces.map((face, id) => {
  const [a, b, c] = face.map((idx) => BASE.vertices[idx]);
  const center = norm(add(add(a, b), c));
  return { id, center, vertices: [a, b, c] };
});

function arcPoints(a, b, camera, segments = 10) {
  const out = [];
  for (let k = 0; k <= segments; k += 1) {
    const p = camera.project(slerp(a, b, k / segments));
    if (!p.visible || p.depth <= 0) return null;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
  renderer.dpr = dpr;
  gameCanvas.width = Math.round(window.innerWidth * dpr);
  gameCanvas.height = Math.round(window.innerHeight * dpr);
  gameCanvas.style.width = `${window.innerWidth}px`;
  gameCanvas.style.height = `${window.innerHeight}px`;
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

function phaseForState() {
  if (previewPhase !== null) return previewPhase;
  if (!state) return 0;
  // Gameplay stays in the orbit view so the whole surface remains visible and collectible.
  // Camera descent becomes playable when the third-person rig offset lands.
  return 0;
}

function drawTriangles(camera) {
  const W = window.innerWidth, H = window.innerHeight;
  const projected = TRIANGLE_CELLS.map((cell) => {
    // front-facing surface only: the face is on the camera's near hemisphere
    if (dot(cell.center, camera.origin) <= 1.0) return null;
    const center = camera.project(cell.center);
    if (!center.visible || center.depth <= 0) return null;
    const poly = [];
    for (let e = 0; e < 3; e += 1) {
      const pts = arcPoints(cell.vertices[e], cell.vertices[(e + 1) % 3], camera, 10);
      if (!pts) return null;
      poly.push(...pts);
    }
    if (center.x < 2 || center.x > W - 2 || center.y < 2 || center.y > H - 2) return null;
    const tri = state ? state.triangles[cell.id] : { level: 3, mined: false };
    return { i: cell.id, x: center.x, y: center.y, points: poly, level: tri.level, mined: tri.mined };
  }).filter(Boolean);
  for (const t of projected) {
    const active = !t.mined && t.level > 0;
    gctx.save();
    gctx.beginPath();
    t.points.forEach((p, i) => (i ? gctx.lineTo(p.x, p.y) : gctx.moveTo(p.x, p.y)));
    gctx.closePath();
    gctx.fillStyle = active ? `rgba(18, ${70 + t.level * 22}, ${86 + t.level * 16}, .34)` : 'rgba(18,32,40,.22)';
    gctx.fill();
    gctx.strokeStyle = active ? 'rgba(120,240,255,.85)' : 'rgba(90,130,140,.35)';
    gctx.lineWidth = active ? 2.4 : 1.5;
    gctx.shadowColor = active ? 'rgba(40,230,255,.75)' : 'transparent';
    gctx.shadowBlur = active ? 8 : 0;
    gctx.stroke();
    gctx.shadowBlur = 0;
    // The triangle is the surface: no separate pickup icon or label.
    gctx.restore();
  }
  // robots as four visible dots around the landing area
  if (state) {
    state.robots.forEach((robot, i) => {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const dir = norm(add(mul(LANDING, Math.cos(0.45)), add(mul(TANGENT, Math.sin(0.45) * Math.cos(a)), mul(SIDE, Math.sin(0.45) * Math.sin(a)))));
      const p = camera.project(dir);
      if (!p.visible || p.depth <= 0) return;
      gctx.save(); gctx.translate(p.x, p.y);
      gctx.fillStyle = ['#ffd166', '#ef476f', '#06d6a0', '#a78bfa'][i % 4];
      gctx.beginPath(); gctx.arc(0, 0, 7, 0, Math.PI * 2); gctx.fill();
      gctx.fillStyle = '#04121a'; gctx.font = '700 9px ui-monospace'; gctx.textAlign = 'center'; gctx.fillText(`R${i + 1}`, 0, 3);
      gctx.restore();
    });
  }
  return projected;
}

let projected = [];
function frame() {
  phase = phaseForState();
  const camera = phaseCamera(phase, window.innerWidth, window.innerHeight);
  renderer.render(camera, renderer.dpr || 1);
  gctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  projected = drawTriangles(camera);
  if (state) {
    phaseLabel.textContent = `PHASE ${phase + 1} // ${PHASES[phase].name}`;
    progressEl.textContent = `${state.player.collected} / ${state.player.target}`;
    planetEl.textContent = String(state.planetIndex);
    robotsEl.innerHTML = state.robots.map((r, i) => `<div>R${i + 1} ${r.collected}/${r.target} · respawns ${r.respawns}</div>`).join('');
  }
  requestAnimationFrame(frame);
}

function flash(text) {
  statusEl.textContent = text;
  statusEl.style.opacity = '1';
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { statusEl.style.opacity = '0'; }, 1400);
}

async function collectAt(x, y) {
  if (!state || Date.now() - lastClick < 120) return;
  lastClick = Date.now();
  const hit = projected
    .filter((t) => !t.mined && t.level > 0)
    .map((t) => ({ ...t, dist: Math.hypot(t.x - x, t.y - y), inside: pointInPolygon(x, y, t.points) }))
    .filter((t) => t.inside || t.dist < 8)
    .sort((a, b) => a.dist - b.dist)[0];
  if (!hit) return;
  if (!offlineGame) {
    const res = await tryRemoteCollect(hit.i);
    if (res) {
      state = res.state;
      if (res.cleared) flash('PLANET CLEARED — NEXT PLANET');
      else flash(`TRIANGLE ${res.triangleId + 1} · ${res.level} LEFT`);
      return;
    }
  }
  if (!offlineGame) offlineGame = createGame();
  const local = collectTriangle(offlineGame, hit.i);
  if (!local.ok) return;
  state = publicState(offlineGame);
  if (local.cleared) flash('PLANET CLEARED — NEXT PLANET');
  else flash(`TRIANGLE ${local.triangleId + 1} · ${local.level} LEFT`);
}

async function tryRemoteCollect(triangleId) {
  const res = await fetch('api/collect', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ triangleId }),
  }).then((r) => r.json()).catch(() => null);
  return res && res.ok ? res : null;
}

gameCanvas.addEventListener('pointerdown', (event) => {
  const rect = gameCanvas.getBoundingClientRect();
  collectAt(event.clientX - rect.left, event.clientY - rect.top);
});
window.addEventListener('keydown', (event) => {
  if (/^[1-4]$/.test(event.key)) { phase = Number(event.key) - 1; if (previewPhase === null) flash(`CAMERA PREVIEW ${phase + 1}`); }
});

window.__v2 = { projected: () => projected, state: () => state };

async function loadState() {
  const data = await fetch('api/state').then((r) => r.json()).catch(() => null);
  if (data && data.ok) {
    state = data;
    offlineGame = null;
    return;
  }
  if (!offlineGame) {
    offlineGame = createGame();
    state = publicState(offlineGame);
    flash('PUBLIC PLAYTEST — browser state');
  }
}
resize();
loadState();
frame();
setInterval(loadState, 1000);
setInterval(() => {
  if (offlineGame) state = publicState(tickRobots(offlineGame));
}, 2000);
