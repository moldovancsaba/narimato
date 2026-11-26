import { PHASES, LANDING, LANDING_ARM, phaseCamera } from './camera.js';
import { V2Renderer } from './renderer.js';
import { initialHeading, moveHeading, rotateFrame, turnHeading } from './controls.js';
import { collectPlayer, createGame, publicState, tickRobots } from './game-rules.js';

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
const preview = params.has('step') ? Math.max(0, Math.min(3, Number(params.get('step')) || 0)) : params.has('phase') ? Math.max(0, Math.min(3, Number(params.get('phase')) || 0)) : null;

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const slerp = (a, b, t) => { const o = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); if (o < 1e-5) return a; return norm(add(mul(a, Math.sin((1 - t) * o) / Math.sin(o)), mul(b, Math.sin(t * o) / Math.sin(o)))); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const qMul = (a, b) => ({ x: a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y, y: a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x, z: a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w, w: a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z });
const qNorm = (q) => { const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; return { x:q.x/l,y:q.y/l,z:q.z/l,w:q.w/l }; };
const qAxis = (axis, angle) => { const h=angle/2; return {x:axis.x*Math.sin(h),y:axis.y*Math.sin(h),z:axis.z*Math.sin(h),w:Math.cos(h)}; };
const qRotate = (q, v) => { const p={x:v.x,y:v.y,z:v.z,w:0}; const c=qNorm(q); const inv={x:-c.x,y:-c.y,z:-c.z,w:c.w}; const r=qMul(qMul(c,p),inv); return {x:r.x,y:r.y,z:r.z}; };

let state = null;
let offlineGame = null;
let step = preview ?? 0;
let targetStep = step;
let surfaceDistance = 1.15;
let stepStart = performance.now();
let stepFrom = step;
let playerDir = { ...LANDING };
let heading = initialHeading(LANDING);
let currentLeaf = null;
let move = null;
let queued = null;
let lastFrame = performance.now();
let lastMouse = { x: 0, y: 0 };
let drag = null;
let pointers = new Map();
let pinch = null;
let pending = false;

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

function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function surfaceActive() { return step > 2.5; }
function stepDistance() {
  const i = Math.max(0, Math.min(2, Math.floor(step)));
  return PHASES[i].distance + (PHASES[Math.min(3, i + 1)].distance - PHASES[i].distance) * (step - i);
}
function horizonPitch(d) {
  const H = window.innerHeight;
  const focal = (H / 2) / Math.tan((50 * Math.PI) / 360);
  const phi = Math.atan((0.25 * H) / focal);
  return ((Math.asin(Math.min(1, 1 / d)) - phi) * 180) / Math.PI;
}
function cameraFor(landing, forward) {
  const d = surfaceActive() ? surfaceDistance : stepDistance();
  const phase = Math.max(0, Math.min(3, Math.round(step)));
  let pitch = step < 0.2 ? 0 : horizonPitch(d);
  if (surfaceActive()) pitch += 5.6;
  let arm = 0;
  if (surfaceActive()) {
    const h = Math.max(0.001, d - 1);
    arm = Math.min(0.45, h * Math.tan(((pitch - 11) * Math.PI) / 180));
  }
  return phaseCamera(phase, window.innerWidth, window.innerHeight, {
    pitchDeg: pitch,
    distance: d,
    landing,
    forward,
    arm,
    fovDeg: 50,
  });
}

function currentCamera() { return cameraFor(playerDir, heading); }

function solvePointerFollow(grabbed, targetX, targetY) {
  let landing = { ...playerDir };
  let forward = { ...heading };
  let best = { landing, forward, err: Infinity };
  for (let it = 0; it < 10; it += 1) {
    const camera = cameraFor(landing, forward);
    const p = camera.project(grabbed);
    const ex = targetX - p.x, ey = targetY - p.y;
    const err = Math.hypot(ex, ey);
    if (err < best.err) best = { landing: { ...landing }, forward: { ...forward }, err };
    if (err < 0.5) break;
    const h = 0.004;
    const up = camera.basis.up, right = camera.basis.right;
    const fu = rotateFrame(landing, forward, qAxis(up, h));
    const fr = rotateFrame(landing, forward, qAxis(right, h));
    const pu = cameraFor(fu.landing, fu.heading).project(grabbed);
    const pr = cameraFor(fr.landing, fr.heading).project(grabbed);
    const j11 = (pu.x - p.x) / h, j12 = (pr.x - p.x) / h;
    const j21 = (pu.y - p.y) / h, j22 = (pr.y - p.y) / h;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-9) break;
    const aUp = clamp((ex * j22 - ey * j12) / det, -0.12, 0.12);
    const aRight = clamp((j11 * ey - j21 * ex) / det, -0.12, 0.12);
    const next = rotateFrame(landing, forward, qMul(qAxis(up, aUp), qAxis(right, aRight)));
    landing = next.landing; forward = next.heading;
  }
  return best;
}

function leafData() {
  if (!state) return [];
  return state.leaves.map((leaf) => {
    const [a, b, c] = leaf.v.map((i) => state.vertices[i]);
    const center = norm(add(add(a, b), c));
    return { ...leaf, a, b, c, center };
  });
}
function leafColor(leaf) {
  const clicked = leaf.globallyRed || (leaf.clickedBy || []).includes('player');
  return clicked ? { fill: 'rgba(220,60,75,.55)', stroke: 'rgba(255,110,120,.95)' } : { fill: 'rgba(35,180,110,.38)', stroke: 'rgba(110,255,180,.9)' };
}
function containsPoint(leaf, q) {
  const verts = [leaf.a, leaf.b, leaf.c];
  for (let i = 0; i < 3; i += 1) {
    let n = norm(cross(verts[i], verts[(i + 1) % 3]));
    if (dot(n, leaf.center) < 0) n = mul(n, -1);
    if (dot(q, n) < -1e-6) return false;
  }
  return true;
}
function pickLeaf(q) {
  for (const leaf of leafData()) if (containsPoint(leaf, q)) return leaf;
  return null;
}

function drawLeaves(camera) {
  if (!state) return;
  const W = window.innerWidth, H = window.innerHeight;
  const leaves = leafData();
  const cx = camera.project(camera.axis).x, cy = camera.project(camera.axis).y;
  const R = Math.max(1, camera.screenRadius || 0);
  gctx.save(); gctx.beginPath(); gctx.arc(cx, cy, R, 0, Math.PI * 2); gctx.clip();
  if (surfaceActive()) {
    const under = pickLeaf(playerDir) || leaves[0];
    if (under) {
      const c = leafColor(under);
      gctx.fillStyle = c.fill;
      gctx.fillRect(0, H * 0.25, W, H * 0.75);
    }
  }
  for (const leaf of leaves) {
    if (dot(leaf.center, camera.origin) <= 1.0) continue;
    const pts = [leaf.a, leaf.b, leaf.c].map((v) => camera.project(v));
    if (pts.some((p) => !p.visible || p.depth <= 0)) continue;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) continue;
    const col = leafColor(leaf);
    gctx.beginPath(); gctx.moveTo(pts[0].x, pts[0].y); gctx.lineTo(pts[1].x, pts[1].y); gctx.lineTo(pts[2].x, pts[2].y); gctx.closePath();
    gctx.fillStyle = col.fill; gctx.fill(); gctx.strokeStyle = col.stroke; gctx.lineWidth = 1.6; gctx.stroke();
  }
  gctx.restore();
}

function drawGamer(camera) {
  if (!surfaceActive()) return;
  const p = camera.project(playerDir);
  if (!p.visible) return;
  gctx.save(); gctx.translate(p.x, p.y);
  gctx.fillStyle = '#9ffcff';
  gctx.beginPath(); gctx.moveTo(0, -13); gctx.lineTo(9, 8); gctx.lineTo(-9, 8); gctx.closePath(); gctx.fill();
  gctx.fillStyle = '#04121a'; gctx.font = '700 9px ui-monospace'; gctx.textAlign = 'center'; gctx.fillText('YOU', 0, 20);
  gctx.restore();
}

function drawRobots(camera) {
  if (!state) return;
  state.robots.forEach((robot, i) => {
    const side = norm(cross(playerDir, heading));
    const dir = norm(add(mul(playerDir, Math.cos(0.4)), add(mul(heading, Math.sin(0.4) * Math.cos(i)), mul(side, Math.sin(0.4) * Math.sin(i)))));
    const p = camera.project(dir);
    if (!p.visible || p.depth <= 0) return;
    gctx.save(); gctx.translate(p.x, p.y);
    gctx.fillStyle = ['#ffd166', '#ef476f', '#06d6a0', '#a78bfa'][i % 4];
    gctx.beginPath(); gctx.arc(0, 0, 6, 0, Math.PI * 2); gctx.fill(); gctx.restore();
  });
}

function ensureLeaf() {
  if (!state || !state.leaves.length) return;
  if (currentLeaf != null && state.leaves.some((l) => l.id === currentLeaf)) return;
  let best = null, bestD = -2;
  for (const leaf of leafData()) { const d = dot(leaf.center, playerDir); if (d > bestD) { bestD = d; best = leaf; } }
  if (best) { currentLeaf = best.id; playerDir = best.center; }
}

function commitState(next) {
  if (!next) return;
  state = next;
  ensureLeaf();
}

function applyCollectResult(result) {
  if (!result) return;
  if (result.state) commitState(result.state);
  if (result.cleared) {
    currentLeaf = null; ensureLeaf(); heading = initialHeading(playerDir);
    flash(`PLANET ${state.planetIndex} — NEW ROUND`);
  } else if (result.reset) {
    currentLeaf = null; ensureLeaf();
    flash('PLANET RESET — 20 NEW TRIANGLES');
  } else if (result.split) {
    flash(`LEVEL ${result.level + 1} — 4 NEW TRIANGLES`);
  }
}

async function clickLeaf(leaf) {
  if (!leaf || pending) return;
  pending = true;
  try {
    if (offlineGame) { applyCollectResult(collectPlayer(offlineGame, leaf.id)); return; }
    const res = await fetch('api/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ triangleId: leaf.id }) }).then((r) => r.json()).catch(() => null);
    if (res) applyCollectResult(res);
    else { offlineGame = createGame(); applyCollectResult(collectPlayer(offlineGame, leaf.id)); }
  } finally { pending = false; }
}

function collectAtScreen(x, y) {
  const camera = currentCamera();
  const q = screenToSphere(x, y, camera);
  if (!q) return;
  const leaf = pickLeaf(q);
  if (leaf) clickLeaf(leaf);
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

function nearestLeafCenter(direction, backwards = false) {
  const leaves = leafData();
  const f = backwards ? mul(direction, -1) : direction;
  let best = null, bestScore = -Infinity;
  for (const leaf of leaves) {
    const rel = norm(add(leaf.center, mul(playerDir, -dot(leaf.center, playerDir))));
    const score = dot(rel, f);
    if (score > bestScore && dot(leaf.center, playerDir) < 0.999999) { bestScore = score; best = leaf; }
  }
  return best;
}

function startMove(kind, leaf) {
  if (!leaf) return;
  const target = leaf.center;
  const from = playerDir;
  const control = norm(add(from, target));
  const fromHeading = heading;
  const toHeading = norm(add(target, mul(from, -dot(target, from))));
  move = { kind, leafId: leaf.id, from, target, control, fromHeading, toHeading, start: performance.now(), duration: 500 };
}
function startTurn(leaf) {
  if (!leaf) return;
  const dir = norm(add(leaf.center, mul(playerDir, -dot(leaf.center, playerDir))));
  move = { kind: 'turn', leafId: null, from: playerDir, target: playerDir, control: playerDir, fromHeading: heading, toHeading: dir, start: performance.now(), duration: 500 };
}

function stepSurface(dt) {
  if (move) {
    const t = clamp((performance.now() - move.start) / move.duration, 0, 1);
    const e = ease(t);
    const q1 = slerp(move.from, move.control, e);
    const q2 = slerp(move.control, move.target, e);
    playerDir = norm(slerp(q1, q2, e));
    heading = norm(slerp(move.fromHeading, move.toHeading, e));
    if (t >= 1) {
      const done = move; move = null;
      if (done.kind === 'move') {
        playerDir = done.target;
        currentLeaf = done.leafId;
        const leaf = leafData().find((l) => l.id === currentLeaf);
        if (leaf && !leaf.globallyRed && !(leaf.clickedBy || []).includes('player')) clickLeaf(leaf);
      }
      if (queued) { const q = queued; queued = null; handleSurfaceKey(q); }
    }
    return;
  }
  // no movement
}

function handleSurfaceKey(key) {
  if (move) { queued = key; return; }
  const leaves = leafData();
  if (!leaves.length) return;
  if (key === 'a' || key === 'arrowleft') startTurn(leaves.filter((l) => l.id !== currentLeaf).map((l) => ({ l, score: dot(norm(add(l.center, mul(playerDir, -dot(l.center, playerDir)))), cross(playerDir, heading)) })).sort((a, b) => b.score - a.score)[0]?.l);
  else if (key === 'd' || key === 'arrowright') startTurn(leaves.filter((l) => l.id !== currentLeaf).map((l) => ({ l, score: dot(norm(add(l.center, mul(playerDir, -dot(l.center, playerDir)))), cross(heading, playerDir)) })).sort((a, b) => b.score - a.score)[0]?.l);
  else if (key === 'w' || key === 'arrowup') startMove('move', nearestLeafCenter(heading));
  else if (key === 's' || key === 'arrowdown') startMove('move', nearestLeafCenter(heading, true));
}

function goStep(n) {
  targetStep = clamp(n, 0, 3);
  stepFrom = step;
  stepStart = performance.now();
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const t = clamp((now - stepStart) / 500, 0, 1);
  step = stepFrom + (targetStep - stepFrom) * ease(t);
  if (t >= 1) step = targetStep;
  if (surfaceActive()) { ensureLeaf(); stepSurface(dt); }
  const camera = currentCamera();
  renderer.render(camera, renderer.dpr || 1);
  gctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawLeaves(camera);
  drawGamer(camera);
  drawRobots(camera);
  if (state) {
    phaseLabel.textContent = `STEP ${Math.round(step) + 1} // ${PHASES[Math.max(0, Math.min(3, Math.round(step)))].name}`;
    progressEl.textContent = `${state.player.count} / ${state.player.target}`;
    planetEl.textContent = `${state.planetIndex} / ${state.planetCount}`;
    robotsEl.innerHTML = state.robots.map((r, i) => `<div>R${i + 1} ${r.count}/${r.target} · respawns ${r.respawns}</div>`).join('');
  }
  requestAnimationFrame(frame);
}

function flash(text) {
  statusEl.textContent = text;
  statusEl.style.opacity = '1';
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { statusEl.style.opacity = '0'; }, 1400);
}

function localPoint(event) { const r = gameCanvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
gameCanvas.style.cursor = 'grab';
gameCanvas.addEventListener('pointerdown', (event) => {
  if (surfaceActive()) return; // mouse acts only in orbit
  const p = localPoint(event); pointers.set(event.pointerId, p);
  try { gameCanvas.setPointerCapture(event.pointerId); } catch {}
  if (pointers.size === 2) { const [a,b]=[...pointers.values()]; pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),step:targetStep}; drag=null; }
  else if (pointers.size === 1) { const cam=currentCamera(); drag={x:p.x,y:p.y,moved:false,grabbed:screenToSphere(p.x,p.y,cam)}; gameCanvas.style.cursor='grabbing'; }
});
gameCanvas.addEventListener('pointermove', (event) => {
  if (surfaceActive()) return;
  const p = localPoint(event);
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, p);
  if (pointers.size === 2 && pinch) { const [a,b]=[...pointers.values()]; const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)); goStep(pinch.step + Math.log(d/pinch.dist)*1.6); return; }
  if (!drag) return;
  if (Math.hypot(p.x-drag.x,p.y-drag.y)>4) drag.moved=true;
  if (drag.moved && drag.grabbed) {
    const solved = solvePointerFollow(drag.grabbed, p.x, p.y);
    playerDir = solved.landing; heading = solved.forward;
  } else if (drag.moved) {
    const camera=currentCamera(); const dx=(p.x-drag.x)*0.006, dy=(p.y-drag.y)*0.006;
    const q=qMul(qAxis(camera.basis.up,dx),qAxis(camera.basis.right,-dy));
    const moved=rotateFrame(playerDir,heading,q); playerDir=moved.landing; heading=moved.heading;
  }
  drag.x=p.x; drag.y=p.y;
});
function endPointer(event){ const p=localPoint(event); pointers.delete(event.pointerId); if(pointers.size<2)pinch=null; if(drag&&!drag.moved)collectAtScreen(p.x,p.y); drag=null; gameCanvas.style.cursor=pointers.size?'grabbing':'grab'; }
gameCanvas.addEventListener('pointerup', endPointer);
gameCanvas.addEventListener('pointercancel', (e)=>{pointers.delete(e.pointerId);pinch=null;drag=null;});
gameCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  if (surfaceActive()) {
    surfaceDistance = clamp(surfaceDistance + (event.deltaY > 0 ? 0.04 : -0.04), 1.02, 1.7);
    return;
  }
  goStep(targetStep + (event.deltaY < 0 ? 1 : -1));
}, { passive:false });
window.addEventListener('keydown', (event) => {
  const k = event.key.toLowerCase();
  if (/^[1-4]$/.test(event.key)) { goStep(Number(event.key)-1); return; }
  if (surfaceActive() && ['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) { event.preventDefault(); handleSurfaceKey(k); }
});
window.__v2 = { state: () => state, step: () => step, axis: () => playerDir, heading: () => heading, camera: () => currentCamera(), leaves: leafData, cursor: () => gameCanvas.style.cursor, setStep: goStep, move: () => move, screenToSphere, solve: solvePointerFollow, surfaceDistance: () => surfaceDistance };

async function loadState() {
  const data = await fetch('api/state').then(r=>r.json()).catch(()=>null);
  if (data && data.leaves) { state=data; ensureLeaf(); return; }
  if (!offlineGame) { offlineGame=createGame(); state=publicState(offlineGame); ensureLeaf(); flash('PUBLIC PLAYTEST — browser state'); }
}
resize(); loadState(); frame();
setInterval(loadState, 1200);
setInterval(() => {
  if (!offlineGame) return;
  const res = tickRobots(offlineGame);
  state = res.state;
  if (res.reset) { currentLeaf = null; ensureLeaf(); }
}, 1800);
