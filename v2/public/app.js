import { PHASES, LANDING, phaseCamera } from './camera.js';
import { V2Renderer } from './renderer.js';

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
let phase = previewPhase ?? 0;
let lastClick = 0;
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const TANGENT = norm(cross(cross(LANDING, { x: 0, y: 1, z: 0 }), LANDING));
const SIDE = norm(cross(LANDING, TANGENT));

/** Deterministic 10 triangle anchors spread around the landing point. */
const TRIANGLE_DIRS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + 0.25;
  const r = 0.10 + (i % 3) * 0.045;
  return norm(add(mul(LANDING, Math.cos(r)), add(mul(TANGENT, Math.sin(r) * Math.cos(a)), mul(SIDE, Math.sin(r) * Math.sin(a)))));
});

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
  // Gameplay stays in the orbit/halfway views; close camera phases are preview-only until the
  // third-person rig offset (Wave 4) makes the full surface visible at landed distance.
  return state.player.collected >= 15 ? 1 : 0;
}

function drawTriangles(camera) {
  const W = window.innerWidth, H = window.innerHeight;
  const projected = TRIANGLE_DIRS.map((dir, i) => {
    const p = camera.project(dir);
    if (!p.visible || p.depth <= 0) return null;
    if (dot(dir, camera.origin) < 0.2) return null;
    if (p.x < 36 || p.x > window.innerWidth - 36 || p.y < 36 || p.y > window.innerHeight - 36) return null;
    const tri = state ? state.triangles[i] : { level: 3, mined: false };
    const size = Math.max(8, Math.min(34, 420 / p.depth));
    return { i, x: p.x, y: p.y, size, level: tri.level, mined: tri.mined };
  }).filter(Boolean);
  for (const t of projected) {
    const active = !t.mined && t.level > 0;
    gctx.save();
    gctx.translate(t.x, t.y);
    gctx.beginPath();
    gctx.moveTo(0, -t.size);
    gctx.lineTo(t.size * 0.9, t.size * 0.7);
    gctx.lineTo(-t.size * 0.9, t.size * 0.7);
    gctx.closePath();
    gctx.fillStyle = active ? `rgba(60, ${120 + t.level * 45}, ${160 + t.level * 25}, .82)` : 'rgba(30,60,70,.35)';
    gctx.fill();
    gctx.strokeStyle = active ? 'rgba(125,249,255,.95)' : 'rgba(90,130,140,.4)';
    gctx.lineWidth = 2;
    gctx.stroke();
    if (active) {
      gctx.fillStyle = '#dffcff';
      gctx.font = '700 12px ui-monospace, monospace';
      gctx.textAlign = 'center';
      gctx.fillText(String(t.level), 0, -t.size - 5);
    }
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
    .map((t) => ({ ...t, dist: Math.hypot(t.x - x, t.y - y) }))
    .filter((t) => t.dist < Math.max(28, t.size * 1.4))
    .sort((a, b) => a.dist - b.dist)[0];
  if (!hit) return;
  const res = await fetch('/api/collect', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ triangleId: hit.i }),
  }).then((r) => r.json()).catch(() => null);
  if (!res || !res.ok) return;
  state = res.state;
  if (res.cleared) flash('PLANET CLEARED — NEXT PLANET');
  else flash(`TRIANGLE ${res.triangleId + 1} · ${res.level} LEFt`);
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
  const data = await fetch('/api/state').then((r) => r.json()).catch(() => null);
  if (data && data.ok) state = data;
}
resize();
loadState();
frame();
setInterval(loadState, 1000);
