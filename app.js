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
let manualPhase = previewPhase;
let viewYaw = 0;
let viewPitch = 0;
let viewDistance = null;
let playerPos = { ...LANDING };
let walkKeys = new Set();
let lastWalkFace = -1;
let lastWalkAt = 0;
let lastFrameTime = performance.now();
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
  const n = norm(cross(b, c));
  const edges = [];
  for (const [x, y] of [[a, b], [b, c], [c, a]]) {
    let normal = norm(cross(x, y));
    if (dot(normal, center) < 0) normal = mul(normal, -1);
    edges.push(normal);
  }
  return { id, center, vertices: [a, b, c], edges };
});

function faceAtPoint(q) {
  for (const cell of TRIANGLE_CELLS) {
    if (cell.edges.every((normal) => dot(q, normal) >= -1e-6)) return cell.id;
  }
  return -1;
}

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
  if (manualPhase !== null) return manualPhase;
  return 0;
}

const LANDED_SURFACE_PITCH = 12; // landed view looks at the surface so its faces are visible
function currentPitch() {
  const base = phase === 3 ? LANDED_SURFACE_PITCH : PHASES[phase].pitchDeg;
  return Math.max(-20, Math.min(70, base + viewPitch));
}

// Surface play view: close enough that the local surface triangles are visible and clickable.
const LANDED_SURFACE_DISTANCE = 1.44;

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
    const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
    if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) return null;
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

function collectFace(id) {
  if (!state || id < 0) return;
  const tri = state.triangles[id];
  if (!tri || tri.mined || tri.level <= 0) return;
  const doRemote = !offlineGame;
  const send = doRemote ? tryRemoteCollect(id) : Promise.resolve(null);
  send.then((res) => {
    if (res) {
      state = res.state;
      if (res.cleared) flash('PLANET CLEARED — NEXT PLANET');
      else flash(`FACE ${id + 1} · ${res.level} LEFT`);
      return;
    }
    if (!offlineGame) offlineGame = createGame();
    const local = collectTriangle(offlineGame, id);
    if (!local.ok) return;
    state = publicState(offlineGame);
    if (local.cleared) flash('PLANET CLEARED — NEXT PLANET');
    else flash(`FACE ${id + 1} · ${local.level} LEFT`);
  });
}

function walkStep(camera, dt) {
  let dx = 0, dy = 0;
  if (walkKeys.has('w') || walkKeys.has('ArrowUp')) dy += 1;
  if (walkKeys.has('s') || walkKeys.has('ArrowDown')) dy -= 1;
  if (walkKeys.has('a') || walkKeys.has('ArrowLeft')) dx -= 1;
  if (walkKeys.has('d') || walkKeys.has('ArrowRight')) dx += 1;
  if (!dx && !dy) return;
  const forward = camera.basis.forward;
  const tangentF = norm(add(forward, mul(playerPos, -dot(forward, playerPos))));
  const right = norm(cross(playerPos, tangentF));
  const dir = norm(add(mul(tangentF, dy), mul(right, dx)));
  const step = 0.9 * dt;
  playerPos = norm(add(mul(playerPos, Math.cos(step)), mul(dir, Math.sin(step))));
  const face = faceAtPoint(playerPos);
  if (face >= 0 && (face !== lastWalkFace || performance.now() - lastWalkAt > 450)) {
    lastWalkFace = face;
    lastWalkAt = performance.now();
    collectFace(face);
  }
}

let projected = [];
function frame() {
  phase = phaseForState();
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  const camera = phaseCamera(phase, window.innerWidth, window.innerHeight, {
    yawDeg: viewYaw,
    pitchDeg: currentPitch(),
    distance: viewDistance ?? (phase === 3 ? LANDED_SURFACE_DISTANCE : PHASES[phase].distance),
    landing: phase === 3 ? playerPos : undefined,
  });
  if (phase === 3) walkStep(camera, dt);
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

function screenToSphere(x, y, camera) {
  const W = window.innerWidth, H = window.innerHeight;
  const rel = { x: x - W / 2, y: H / 2 - y };
  const dir = norm(add(add(mul(camera.basis.right, rel.x), mul(camera.basis.up, rel.y)), mul(camera.basis.forward, camera.focal)));
  const O = camera.origin;
  const b = 2 * dot(O, dir);
  const c = dot(O, O) - 1;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (!(t > 0)) return null;
  return norm(add(O, mul(dir, t)));
}

function clampYaw(yaw) { return ((yaw + 540) % 360) - 180; }

/** Absolute surface-point follow: solve yaw/pitch so the grabbed point stays under the pointer. */
function solvePointFollow({ phase, distance, landing, grabbed, targetX, targetY, yaw, pitch }) {
  const make = (y, p) => phaseCamera(phase, window.innerWidth, window.innerHeight, {
    yawDeg: y, pitchDeg: p, distance, landing,
  });
  let best = { yaw, pitch, err: Infinity };
  let cy = yaw, cp = pitch;
  for (let it = 0; it < 10; it += 1) {
    const cam = make(cy, cp);
    const p = cam.project(grabbed);
    const ex = targetX - p.x;
    const ey = targetY - p.y;
    const err = Math.hypot(ex, ey);
    if (err < best.err) best = { yaw: cy, pitch: cp, err };
    if (err < 0.7) break;
    const h = 0.35;
    const py = make(cy + h, cp).project(grabbed);
    const pp = make(cy, cp + h).project(grabbed);
    const j11 = (py.x - p.x) / h, j12 = (pp.x - p.x) / h;
    const j21 = (py.y - p.y) / h, j22 = (pp.y - p.y) / h;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-7) break;
    const dy = (ex * j22 - ey * j12) / det;
    const dp = (j11 * ey - j21 * ex) / det;
    cy = clampYaw(cy + Math.max(-18, Math.min(18, dy)));
    cp = Math.max(-20, Math.min(70, cp + Math.max(-18, Math.min(18, dp))));
  }
  return { yaw: best.yaw, pitch: best.pitch, err: best.err };
}

const pointers = new Map();
let drag = null;
let pinchStart = null;

function localPoint(event) {
  const rect = gameCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
gameCanvas.style.cursor = 'grab';
gameCanvas.addEventListener('pointerdown', (event) => {
  const p = localPoint(event);
  pointers.set(event.pointerId, p);
  try { gameCanvas.setPointerCapture(event.pointerId); } catch {}
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), distance: viewDistance ?? PHASES[phase].distance };
    drag = null;
  } else if (pointers.size === 1) {
    const cam = phaseCamera(phase, window.innerWidth, window.innerHeight, {
      yawDeg: viewYaw, pitchDeg: currentPitch(), distance: viewDistance ?? (phase === 3 ? LANDED_SURFACE_DISTANCE : PHASES[phase].distance), landing: phase === 3 ? playerPos : undefined,
    });
    drag = { startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, moved: false, grabbed: screenToSphere(p.x, p.y, cam) };
    gameCanvas.style.cursor = 'grabbing';
  }
});
gameCanvas.addEventListener('pointermove', (event) => {
  const p = localPoint(event);
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, p);
  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    viewDistance = Math.max(phase === 3 ? LANDED_SURFACE_DISTANCE : 1.04, Math.min(3.2, pinchStart.distance * (pinchStart.dist / dist)));
    return;
  }
  if (!drag) return;
  if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4) drag.moved = true;
  const moveDx = p.x - drag.lastX;
  drag.lastX = p.x;
  drag.lastY = p.y;
  if (drag.moved && drag.grabbed) {
    const solved = solvePointFollow({
      phase,
      distance: viewDistance ?? (phase === 3 ? LANDED_SURFACE_DISTANCE : PHASES[phase].distance),
      landing: phase === 3 ? playerPos : undefined,
      grabbed: drag.grabbed,
      targetX: p.x,
      targetY: p.y,
      yaw: viewYaw,
      pitch: currentPitch(),
    });
    viewYaw = solved.yaw;
    viewPitch = solved.pitch - (phase === 3 ? LANDED_SURFACE_PITCH : PHASES[phase].pitchDeg);
    if (solved.err > 24) {
      // Fallback for points near the limb where the two-axis solve is ill-conditioned.
      viewYaw = clampYaw(viewYaw + moveDx * 0.2);
    }
  }
});
function endPointer(event) {
  const p = localPoint(event);
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (drag && !drag.moved) collectAt(p.x, p.y);
  drag = null;
  gameCanvas.style.cursor = pointers.size ? 'grabbing' : 'grab';
}
gameCanvas.addEventListener('pointerup', endPointer);
gameCanvas.addEventListener('pointercancel', (event) => { pointers.delete(event.pointerId); pinchStart = null; drag = null; });
gameCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const base = viewDistance ?? PHASES[phase].distance;
  viewDistance = Math.max(phase === 3 ? LANDED_SURFACE_DISTANCE : 1.04, Math.min(3.2, base * (event.deltaY < 0 ? 0.9 : 1.1)));
}, { passive: false });
window.addEventListener('keyup', (event) => {
  if (/^[wasd]$/i.test(event.key)) walkKeys.delete(event.key.toLowerCase());
});
window.addEventListener('keydown', (event) => {
  if (phase === 3 && /^[wasd]$/i.test(event.key)) { walkKeys.add(event.key.toLowerCase()); }
  if (/^[1-4]$/.test(event.key)) {
    phase = Number(event.key) - 1;
    manualPhase = phase;
    viewDistance = null;
    if (previewPhase === null) flash(`CAMERA PREVIEW ${phase + 1}`);
    return;
  }
  if (event.key === 'ArrowLeft') viewYaw -= 5;
  if (event.key === 'ArrowRight') viewYaw += 5;
  if (event.key === 'ArrowUp') viewPitch = Math.max(-20, viewPitch - 3);
  if (event.key === 'ArrowDown') viewPitch = Math.min(35, viewPitch + 3);
});

window.__v2 = {
  projected: () => projected,
  state: () => state,
  setView: (o = {}) => {
    if (Number.isFinite(o.phase)) { phase = o.phase; manualPhase = o.phase; }
    if (Number.isFinite(o.yaw)) viewYaw = o.yaw;
    if (Number.isFinite(o.pitch)) viewPitch = o.pitch;
    if (Number.isFinite(o.distance)) viewDistance = o.distance;
  },
};

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
