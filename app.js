import { PHASES, LANDING, LANDING_ARM, phaseCamera } from './camera.js?v=final2';
import { V2Renderer } from './renderer.js?v=final2';
import { subdividedIcosahedron } from './geometry.js?v=final2';
import { collectTriangle, createGame, publicState, tickRobots } from './game-rules.js?v=final2';

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

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const qMul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const qNorm = (q) => { const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l }; };
const qAxis = (axis, angle) => {
  const h = angle / 2;
  return { x: axis.x * Math.sin(h), y: axis.y * Math.sin(h), z: axis.z * Math.sin(h), w: Math.cos(h) };
};
const qRotate = (q, v) => {
  const p = { x: v.x, y: v.y, z: v.z, w: 0 };
  const c = qNorm(q);
  const inv = { x: -c.x, y: -c.y, z: -c.z, w: c.w };
  const r = qMul(qMul(c, p), inv);
  return { x: r.x, y: r.y, z: r.z };
};

const slerp = (a, b, t) => {
  const o = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (o < 1e-5) return a;
  return norm(add(mul(a, Math.sin((1 - t) * o) / Math.sin(o)), mul(b, Math.sin(t * o) / Math.sin(o))));
};

let state = null;
let offlineGame = null;
let step = previewPhase ?? 0;
let targetStep = step;
let playerDir = { ...LANDING };
let viewAxis = { ...LANDING };
let headingYaw = 0;
let viewPitch = 0;
let lastClick = 0;
let lastFrame = performance.now();
let lastWalkFace = -1;
let lastWalkAt = 0;
const walkKeys = new Set();
function solveAxisFollow(grabbed, targetX, targetY) {
  let axis = { ...viewAxis };
  let best = { axis, err: Infinity };
  for (let it = 0; it < 9; it += 1) {
    const cam = cameraForAxis(axis);
    const p = cam.project(grabbed);
    const ex = targetX - p.x;
    const ey = targetY - p.y;
    const err = Math.hypot(ex, ey);
    if (err < best.err) best = { axis: { ...axis }, err };
    if (err < 0.5) break;
    const h = 0.004;
    const up = cam.basis.up, right = cam.basis.right;
    const aUp = norm(qRotate(qAxis(up, h), axis));
    const aRight = norm(qRotate(qAxis(right, h), axis));
    const pUp = cameraForAxis(aUp).project(grabbed);
    const pRight = cameraForAxis(aRight).project(grabbed);
    const j11 = (pUp.x - p.x) / h, j12 = (pRight.x - p.x) / h;
    const j21 = (pUp.y - p.y) / h, j22 = (pRight.y - p.y) / h;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-9) break;
    const dUp = (ex * j22 - ey * j12) / det;
    const dRight = (j11 * ey - j21 * ex) / det;
    axis = norm(qRotate(qMul(qAxis(up, Math.max(-0.08, Math.min(0.08, dUp))), qAxis(right, Math.max(-0.08, Math.min(0.08, dRight)))), axis));
  }
  return best;
}

const pointers = new Map();
let drag = null;
let pinch = null;

const BASE = subdividedIcosahedron(3);
const FACES = BASE.faces.map((face, id) => {
  const [a, b, c] = face.map((i) => BASE.vertices[i]);
  const center = norm(add(add(a, b), c));
  const edges = [[a, b], [b, c], [c, a]].map(([x, y]) => {
    let n = norm(cross(x, y));
    if (dot(n, center) < 0) n = mul(n, -1);
    return n;
  });
  return { id, center, vertices: [a, b, c], edges };
});

function faceAtPoint(q) {
  for (const cell of FACES) if (cell.edges.every((n) => dot(q, n) >= -1e-6)) return cell.id;
  return -1;
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

function smooth(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function currentDistance() {
  const i = Math.max(0, Math.min(2, Math.floor(step)));
  const f = smooth(step - i);
  return lerp(PHASES[i].distance, PHASES[Math.min(3, i + 1)].distance, f);
}
function currentArm() {
  if (step < 2.6) return 0;
  return LANDING_ARM * smooth(Math.min(1, (step - 2.6) / 0.4));
}
function horizonPitch(distance) {
  const H = window.innerHeight;
  const focal = (H / 2) / Math.tan((50 * Math.PI) / 360);
  const phi = Math.atan((0.25 * H) / focal);
  const alpha = Math.asin(Math.min(1, 1 / distance));
  return ((alpha - phi) * 180) / Math.PI;
}
function cameraForAxis(axis) {
  const d = currentDistance();
  const pitch = step < 0.2 ? 0 : horizonPitch(d);
  const phase = Math.max(0, Math.min(3, Math.round(step)));
  return phaseCamera(phase, window.innerWidth, window.innerHeight, {
    yawDeg: headingYaw,
    pitchDeg: pitch + viewPitch,
    distance: d,
    landing: axis,
    arm: currentArm() * d,
    fovDeg: 50,
  });
}

function currentCamera() {
  const d = currentDistance();
  const pitch = step < 0.2 ? 0 : horizonPitch(d);
  const phase = Math.max(0, Math.min(3, Math.round(step)));
  const cam = phaseCamera(phase, window.innerWidth, window.innerHeight, {
    yawDeg: headingYaw,
    pitchDeg: pitch + viewPitch,
    distance: d,
    landing: viewAxis,
    arm: currentArm() * d,
    fovDeg: 50,
  });
  return cam;
}

function arcPoints(a, b, camera, segments = 8) {
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

function drawFaces(camera) {
  const W = window.innerWidth, H = window.innerHeight;
  const projected = [];
  for (const cell of FACES) {
    if (dot(cell.center, camera.origin) <= 1.0) continue;
    const poly = [];
    let ok = true;
    for (let e = 0; e < 3; e += 1) {
      const pts = arcPoints(cell.vertices[e], cell.vertices[(e + 1) % 3], camera);
      if (!pts) { ok = false; break; }
      poly.push(...pts);
    }
    if (!ok) continue;
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) continue;
    const tri = state ? state.triangles[cell.id] : { level: 3, mined: false };
    const center = camera.project(cell.center);
    projected.push({ i: cell.id, x: center.x, y: center.y, points: poly, level: tri.level, mined: tri.mined });
  }
  const cx = camera.project(camera.axis).x;
  const cy = camera.project(camera.axis).y;
  const R = Math.max(1, camera.screenRadius || 0);
  gctx.save();
  gctx.beginPath();
  gctx.arc(cx, cy, R, 0, Math.PI * 2);
  gctx.clip();
  for (const t of projected) {
    const active = !t.mined && t.level > 0;
    gctx.beginPath();
    t.points.forEach((p, i) => (i ? gctx.lineTo(p.x, p.y) : gctx.moveTo(p.x, p.y)));
    gctx.closePath();
    gctx.fillStyle = active ? `rgba(30, ${95 + t.level * 25}, ${115 + t.level * 18}, .32)` : 'rgba(20,38,46,.20)';
    gctx.fill();
    gctx.strokeStyle = active ? 'rgba(120,240,255,.8)' : 'rgba(80,120,130,.3)';
    gctx.lineWidth = active ? 2 : 1.2;
    gctx.stroke();
  }
  gctx.restore();
  return projected;
}

function drawGamer(camera) {
  if (step < 2.75) return;
  const p = camera.project(playerDir);
  if (!p.visible) return;
  gctx.save();
  gctx.translate(p.x, p.y);
  gctx.fillStyle = '#9ffcff';
  gctx.beginPath(); gctx.moveTo(0, -14); gctx.lineTo(10, 8); gctx.lineTo(-10, 8); gctx.closePath(); gctx.fill();
  gctx.fillStyle = '#04121a'; gctx.font = '700 9px ui-monospace'; gctx.textAlign = 'center'; gctx.fillText('YOU', 0, 20);
  gctx.restore();
}

function drawRobots(camera) {
  if (!state) return;
  state.robots.forEach((robot, i) => {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    const dir = norm(add(mul(playerDir, Math.cos(0.4)), add(mul(norm(cross(cross(playerDir, { x: 0, y: 1, z: 0 }), playerDir)), Math.sin(0.4) * Math.cos(a)), mul(norm(cross(playerDir, norm(cross(cross(playerDir, { x: 0, y: 1, z: 0 }), playerDir)))), Math.sin(0.4) * Math.sin(a)))));
    const p = camera.project(dir);
    if (!p.visible || p.depth <= 0) return;
    gctx.save(); gctx.translate(p.x, p.y);
    gctx.fillStyle = ['#ffd166', '#ef476f', '#06d6a0', '#a78bfa'][i % 4];
    gctx.beginPath(); gctx.arc(0, 0, 6, 0, Math.PI * 2); gctx.fill();
    gctx.restore();
  });
}

let projected = [];
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  step += (targetStep - step) * Math.min(1, dt * 5);
  if (Math.abs(step - targetStep) < 0.002) step = targetStep;
  moveGamer(dt);
  const camera = currentCamera();
  renderer.render(camera, renderer.dpr || 1);
  gctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  projected = drawFaces(camera);
  drawGamer(camera);
  drawRobots(camera);
  if (state) {
    phaseLabel.textContent = `STEP ${Math.round(step) + 1} // ${PHASES[Math.max(0, Math.min(3, Math.round(step)))].name}`;
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

async function tryRemoteCollect(id) {
  const res = await fetch('api/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ triangleId: id }) }).then((r) => r.json()).catch(() => null);
  return res && res.ok ? res : null;
}
function collectFace(id) {
  if (!state || id < 0) return;
  const tri = state.triangles[id];
  if (!tri || tri.mined || tri.level <= 0) return;
  const apply = (res) => {
    if (res) { state = res.state; flash(res.cleared ? 'PLANET CLEARED — NEXT PLANET' : `FACE ${id + 1} · ${res.level} LEFT`); return; }
    if (!offlineGame) offlineGame = createGame();
    const local = collectTriangle(offlineGame, id);
    if (!local.ok) return;
    state = publicState(offlineGame);
    flash(local.cleared ? 'PLANET CLEARED — NEXT PLANET' : `FACE ${local.id + 1} · ${local.level} LEFT`);
  };
  if (!offlineGame) tryRemoteCollect(id).then(apply);
  else apply(null);
}

function moveGamer(dt) {
  let forward = 0, turn = 0;
  if (walkKeys.has('w') || walkKeys.has('arrowup')) forward += 1;
  if (walkKeys.has('s') || walkKeys.has('arrowdown')) forward -= 1;
  if (walkKeys.has('a') || walkKeys.has('arrowleft')) turn += 1;
  if (walkKeys.has('d') || walkKeys.has('arrowright')) turn -= 1;
  if (!forward && !turn) return;
  headingYaw += turn * 110 * dt;
  if (forward) {
    const camera = currentCamera();
    const fwd = camera.basis.forward;
    const tangent = norm(add(fwd, mul(playerDir, -dot(fwd, playerDir))));
    const dir = forward > 0 ? tangent : mul(tangent, -1);
    const stepAngle = 0.9 * dt;
    playerDir = norm(add(mul(playerDir, Math.cos(stepAngle)), mul(dir, Math.sin(stepAngle))));
    viewAxis = playerDir;
    if (step > 2.75) {
      const face = faceAtPoint(playerDir);
      if (face >= 0 && (face !== lastWalkFace || performance.now() - lastWalkAt > 450)) {
        lastWalkFace = face;
        lastWalkAt = performance.now();
        collectFace(face);
      }
    }
  }
}

function screenToSphere(x, y, camera) {
  const W = window.innerWidth, H = window.innerHeight;
  const rel = { x: x - W / 2, y: H / 2 - y };
  const dir = norm(add(add(mul(camera.basis.right, rel.x), mul(camera.basis.up, rel.y)), mul(camera.basis.forward, camera.focal)));
  const O = camera.origin;
  const b = 2 * dot(O, dir), c = dot(O, O) - 1, disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  return t > 0 ? norm(add(O, mul(dir, t))) : null;
}

function localPoint(event) { const r = gameCanvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
gameCanvas.style.cursor = 'grab';
gameCanvas.addEventListener('pointerdown', (event) => {
  const p = localPoint(event);
  pointers.set(event.pointerId, p);
  try { gameCanvas.setPointerCapture(event.pointerId); } catch {}
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), step: targetStep };
    drag = null;
  } else if (pointers.size === 1) {
    const camera = currentCamera();
    drag = { x: p.x, y: p.y, moved: false, grabbed: screenToSphere(p.x, p.y, camera) };
    gameCanvas.style.cursor = 'grabbing';
  }
});
gameCanvas.addEventListener('pointermove', (event) => {
  const p = localPoint(event);
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, p);
  if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    targetStep = Math.max(0, Math.min(3, pinch.step + Math.log(dist / pinch.dist) * 1.6));
    return;
  }
  if (!drag) return;
  if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4) drag.moved = true;
  if (drag.moved && drag.grabbed) {
    const solved = solveAxisFollow(drag.grabbed, p.x, p.y);
    viewAxis = solved.axis;
  }
  drag.x = p.x; drag.y = p.y;
});
function endPointer(event) {
  const p = localPoint(event);
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (drag && !drag.moved) {
    const camera = currentCamera();
    const q = screenToSphere(p.x, p.y, camera);
    if (q) {
      const id = faceAtPoint(q);
      if (id >= 0) collectFace(id);
    }
  }
  drag = null;
  gameCanvas.style.cursor = pointers.size ? 'grabbing' : 'grab';
}
gameCanvas.addEventListener('pointerup', endPointer);
gameCanvas.addEventListener('pointercancel', (event) => { pointers.delete(event.pointerId); pinch = null; drag = null; });
gameCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  targetStep = Math.max(0, Math.min(3, Math.round(targetStep) + (event.deltaY < 0 ? 1 : -1)));
}, { passive: false });
window.addEventListener('keydown', (event) => {
  const k = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
    walkKeys.add(k);
    event.preventDefault();
    return;
  }
  if (/^[1-4]$/.test(event.key)) targetStep = Number(event.key) - 1;
});
window.addEventListener('keyup', (event) => walkKeys.delete(event.key.toLowerCase()));

window.__v2 = { projected: () => projected, state: () => state, step: () => step, player: () => playerDir, camera: () => currentCamera(), faceAt: faceAtPoint, axis: () => viewAxis, drag: () => drag, screenToSphere, cursor: () => gameCanvas.style.cursor, solve: solveAxisFollow, setAxis: (a) => { viewAxis = norm(a); }, camFor: cameraForAxis };
async function loadState() {
  const data = await fetch('api/state').then((r) => r.json()).catch(() => null);
  if (data && data.ok) { state = data; offlineGame = null; return; }
  if (!offlineGame) { offlineGame = createGame(); state = publicState(offlineGame); flash('PUBLIC PLAYTEST — browser state'); }
}
resize();
loadState();
frame();
setInterval(loadState, 1000);
setInterval(() => { if (offlineGame) state = publicState(tickRobots(offlineGame)); }, 2000);
