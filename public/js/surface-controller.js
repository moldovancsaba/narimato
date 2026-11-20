/**
 * NARIMATO — surface controller (RND-02).
 *
 * Surface mode is a camera mode and a control mode on the same `IcosaRenderer`,
 * `World` tree and `#arena-canvas`. This module owns no canvas, no
 * `requestAnimationFrame` loop, no projection and no DOM tree: it advances the
 * pilot pose, decides the harvest target and produces `SurfaceEntity[]` for the
 * renderer's entity pass.
 *
 * Public contract (issue RND-02 §9):
 *   createSurfaceController({ getLeaves, getPlayers, onPose, onHarvest, onExit })
 *     → { start, stop, update, pose, active, phase, entities, ... }
 *
 * No gameplay rule is invented here: harvesting goes through the normal
 * authoritative click path (`onHarvest(label)`), and peers are resolved from
 * the server's surface frames.
 */

import { harvestStatus } from './shared/harvest.js';

const LAP_SECONDS = 60;
const ANGULAR_SPEED = (Math.PI * 2) / LAP_SECONDS;
const HARVEST_CHECK_MS = 180;
const HARVEST_INTERVAL_MS = 120;
const POSE_INTERVAL_MS = 110;
const HUD_INTERVAL_MS = 200;
const LANDING_MS = 2200;
const LEAVING_MS = 1600;
const SURFACE_SUBDIV = 4;
const FOOTPRINT_RADIUS = 0.028;
const WORLD_UP = { x: 0, y: 1, z: 0 };
const SURFACE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

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
const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

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

function faceContains(node, p) {
  const edges = [[node.a, node.b], [node.b, node.c], [node.c, node.a]];
  for (const [u, v] of edges) {
    let n = cross(u, v);
    if (dot(n, node.centroid) < 0) n = mul(n, -1);
    if (dot(n, p) < -1e-5) return false;
  }
  return true;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value == null ? '' : value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {object} options
 * @param {()=>object} [options.getStartPoint]
 * @param {()=>Array} [options.getLeaves]
 * @param {()=>object} [options.getPlanet]
 * @param {()=>Array} [options.getPlayers]
 * @param {()=>string|null} [options.getMyPlayerId]
 * @param {()=>number} [options.getMyIndex]
 * @param {()=>number} [options.getMaxDepth]
 * @param {()=>Array} [options.getSupplyCells] legacy: renderer owns supply markers (RND-07)
 * @param {()=>Array} [options.getPeers] peers are resolved by the renderer (RND-07)
 * @param {()=>object|null} [options.getHarvestContext] CTL-03 viewer/cooldown/epoch
 * @param {boolean} [options.autoHarvest] footprint auto-harvest (QA can pause it)
 * @param {(pose:object)=>void} [options.onPose]
 * @param {(label:string)=>void} [options.onHarvest]
 * @param {()=>void} [options.onExit]
 * @param {(surfaceState:object)=>void} [options.onHud]
 */
export function createSurfaceController({
  getStartPoint = () => ({ x: 0, y: 0, z: 1 }),
  getLeaves = () => [],
  getPlanet = () => ({ name: 'UNKNOWN WORLD', seed: 0, depth: 2 }),
  getPlayers = () => [],
  getMyPlayerId = () => null,
  getMyIndex = () => -1,
  getMaxDepth = () => SURFACE_SUBDIV,
  getSupplyCells = () => [],
  getPeers = () => [],
  getHarvestContext = null,
  autoHarvest = true,
  onPose = () => {},
  onHarvest = () => {},
  onExit = () => {},
  onHud = () => {},
  now = nowMs,
} = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  let active = false;
  let phase = 'idle';
  let startedAt = 0;
  let leaveStart = 0;
  let lastFrame = 0;
  let pos = { x: 0, y: 0, z: 1 };
  let headingVec = { x: 1, y: 0, z: 0 };
  let travel = 0;
  let keys = new Set();
  let planet = { name: '', seed: 0, depth: 2 };
  let harvestCheck = 0;
  let harvestTimer = 0;
  let harvestQueue = [];
  let lastHarvestLabel = null;
  let lastPoseAt = 0;
  let lastHudAt = 0;
  let debug = {};
  let effects = [];

  /**
   * CTL-03: the one harvest predicate. The context (viewer index, cooldown, leaf
   * epoch) comes from the app so the chip colour and `/api/action` cannot disagree.
   */
  function harvestContext() {
    const supplied = typeof getHarvestContext === 'function' ? getHarvestContext() : null;
    const ctx = supplied && typeof supplied === 'object' ? supplied : {};
    return {
      myIndex: Number.isInteger(ctx.myIndex) ? ctx.myIndex : getMyIndex(),
      maxDepth: Number.isInteger(ctx.maxDepth) ? ctx.maxDepth : getMaxDepth(),
      serverTimeMs: Number.isFinite(ctx.serverTimeMs) ? ctx.serverTimeMs : now(),
      lastClickAtMs: Number.isFinite(ctx.lastClickAtMs) ? ctx.lastClickAtMs : null,
      clickCooldownMs: Math.max(0, Number(ctx.clickCooldownMs) || 0),
      leafEpoch: ctx.leafEpoch,
    };
  }

  function harvestStatusFor(node) {
    const ctx = harvestContext();
    return harvestStatus(node, { index: ctx.myIndex }, ctx);
  }

  function harvestable(node) {
    return harvestStatusFor(node).can;
  }


  function findCell(point) {
    const leaves = getLeaves();
    for (const node of leaves) {
      if (!node || !node.a) continue;
      if (faceContains(node, point)) return node;
    }
    let best = null;
    let bestDot = -2;
    for (const node of leaves) {
      if (!node || !node.centroid) continue;
      const d = dot(node.centroid, point);
      if (d > bestDot) {
        bestDot = d;
        best = node;
      }
    }
    return best;
  }

  function target() {
    const node = findCell(pos);
    if (!node) return { label: null, harvestable: false, can: false, reason: 'not_joined', waitMs: 0, exhausted: false };
    const status = harvestStatusFor(node);
    return {
      label: node.label,
      harvestable: status.can,
      can: status.can,
      reason: status.reason,
      waitMs: status.waitMs || 0,
      exhausted: !!status.exhausted,
    };
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
      if (cell && harvestable(cell)) found.set(cell.label, cell);
    }
    return [...found.values()];
  }

  function harvestTick(dtMs) {
    if (!autoHarvest) return;
    if (phase !== 'walking') return;
    harvestCheck += dtMs;
    if (harvestCheck < HARVEST_CHECK_MS) return;
    harvestCheck = 0;
    const cells = cellsUnderFoot();
    if (!cells.length) return;
    const next = cells.find((cell) => cell.label !== lastHarvestLabel) || cells[0];
    if (!next) return;
    lastHarvestLabel = next.label;
    effects.push({ start: now(), color: '#9efcff', name: '', value: 0 });
    effects = effects.slice(-4);
    onHarvest(next.label);
    for (const cell of cells) {
      if (cell.label !== next.label) {
        harvestQueue.push(cell.label);
        if (harvestQueue.length > 12) harvestQueue.shift();
      }
    }
    if (harvestQueue.length && now() - harvestTimer > HARVEST_INTERVAL_MS) {
      harvestTimer = now();
      const queued = harvestQueue.shift();
      if (queued) onHarvest(queued);
    }
  }

  function emitPose(force = false) {
    const stamp = now();
    if (!force && stamp - lastPoseAt < POSE_INTERVAL_MS) return;
    lastPoseAt = stamp;
    const basis = tangentBasis(pos);
    const heading = Math.atan2(dot(headingVec, basis.east), dot(headingVec, basis.north));
    onPose({ pos: { ...pos }, heading, forward: { ...headingVec }, moving: !!keys.size });
  }

  function emitHud(force = false) {
    const stamp = now();
    if (!force && stamp - lastHudAt < HUD_INTERVAL_MS) return;
    lastHudAt = stamp;
    const current = target();
    onHud({
      targetLabel: current.label,
      targetHarvestable: current.harvestable,
      targetCan: current.can,
      targetReason: current.reason,
      targetWaitMs: current.waitMs,
      targetExhausted: current.exhausted,
      lapFraction: clamp01(travel / (Math.PI * 2)),
      autoLabel: lastHarvestLabel,
      phase,
      lapSeconds: LAP_SECONDS,
    });
  }

  function update(dtMs) {
    if (!active) return false;
    const dt = Number.isFinite(dtMs) ? clamp(dtMs, 0, 64) : 16.7;
    const stamp = now();
    if (phase === 'landing') {
      if (stamp - startedAt > LANDING_MS) {
        phase = 'walking';
        emitHud(true);
      }
      return false;
    }
    if (phase === 'leaving') {
      if (stamp - leaveStart > LEAVING_MS) {
        active = false;
        onExit();
        return true;
      }
      return false;
    }
    if (phase !== 'walking') return false;
    lastFrame = stamp;
    const dtSec = dt / 1000;
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
    emitPose();
    emitHud();
    return false;
  }

  function pose() {
    return { pos: { ...pos }, forward: { ...headingVec } };
  }

  function progress() {
    const stamp = now();
    if (phase === 'landing') return clamp01((stamp - startedAt) / LANDING_MS);
    if (phase === 'leaving') return clamp01((stamp - leaveStart) / LEAVING_MS);
    return 1;
  }

  /**
   * Build the renderer entity list for the *local* control surface: the pilot
   * body and the target pin. Authoritative peers, robots, beams, supply markers
   * and resource pins are owned by `IcosaRenderer` (RND-07), so no event state
   * lives here.
   * @returns {Array<object>} SurfaceEntity[]
   */
  function entities() {
    if (!active) return [];
    const out = [];
    const players = getPlayers();
    const myId = getMyPlayerId();
    const me = Number.isInteger(getMyIndex()) && getMyIndex() >= 0 ? players[getMyIndex()] : null;
    const current = target();
    out.push({
      kind: 'self',
      playerId: myId,
      pos: { ...pos },
      forward: { ...headingVec },
      walk: travel * 2600,
      mine: false,
      tint: (me && me.color) || '#67ddff',
      label: String((me && me.tag) || 'PILOT'),
      cellLabel: current.label,
    });
    if (current.label) {
      const node = getLeaves().find((leaf) => leaf && leaf.label === current.label);
      if (node && node.centroid) {
        out.push({
          kind: 'pin',
          playerId: null,
          pos: mul(node.centroid, 1.002),
          forward: null,
          walk: 0,
          mine: false,
          tint: current.harvestable ? '#22ff88' : '#ff3355',
          label: current.harvestable ? 'HARVEST' : 'LOCKED',
          cellLabel: current.label,
          variant: 'target',
        });
      }
    }
    // QA readout: the authoritative harvest verdict is the same predicate the
    // HUD uses (CTL-03), so acceptance can compare it with an API click.
    debug = {
      leaves: getLeaves().length,
      entities: out.length,
      phase,
      targetLabel: current.label,
      targetCan: current.can,
      targetHarvestable: current.can,
      targetReason: current.reason,
      targetWaitMs: current.waitMs || 0,
      targetExhausted: !!current.exhausted,
    };
    return out;
  }

  function attachInput() {
    if (!doc) return;
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('keyup', onKeyUp, true);
  }

  function detachInput() {
    if (!doc) return;
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('keyup', onKeyUp, true);
  }

  function onKeyDown(event) {
    if (!active || !event) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
      return;
    }
    if (SURFACE_KEYS.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function onKeyUp(event) {
    if (!active || !event) return;
    keys.delete(event.code);
  }

  /** Touch/keyboard hold from the shared surface control strip. */
  function hold(code, down) {
    if (!active) return false;
    if (!code) return false;
    if (down) keys.add(String(code));
    else keys.delete(String(code));
    return true;
  }

  function start(options = {}) {
    if (active) return true;
    const planetInfo = getPlanet() || {};
    planet = {
      name: String(options.planetName || planetInfo.name || 'UNKNOWN WORLD'),
      seed: Number.isInteger(options.seed) ? options.seed : Number(planetInfo.seed) || 0,
      depth: Number(options.depth || planetInfo.depth) || 2,
    };
    pos = norm(getStartPoint() || { x: 0, y: 0, z: 1 });
    const startBasis = tangentBasis(pos);
    headingVec = tangentAt(pos, startBasis.east);
    travel = 0;
    harvestCheck = 0;
    harvestTimer = 0;
    harvestQueue = [];
    lastHarvestLabel = null;
    effects = [];
    keys = new Set();
    phase = 'landing';
    active = true;
    startedAt = now();
    lastFrame = startedAt;
    lastPoseAt = 0;
    lastHudAt = 0;
    attachInput();
    emitPose(true);
    emitHud(true);
    return true;
  }

  function stop() {
    if (!active || phase === 'leaving') return false;
    phase = 'leaving';
    leaveStart = now();
    keys = new Set();
    detachInput();
    emitHud(true);
    return true;
  }

  /**
   * SRV-04: adopt the authoritative server placement pose for this pilot.
   * The server owns the point; the client only adopts it (no local centroid).
   */
  function applyPlacement(placement) {
    if (!active || !placement || !placement.pos) return false;
    const x = Number(placement.pos.x);
    const y = Number(placement.pos.y);
    const z = Number(placement.pos.z);
    if (![x, y, z].every(Number.isFinite)) return false;
    pos = norm({ x, y, z });
    const forward = placement.heading;
    const hasForward = forward
      && Number.isFinite(Number(forward.x))
      && Number.isFinite(Number(forward.y))
      && Number.isFinite(Number(forward.z));
    headingVec = hasForward ? tangentAt(pos, forward) : tangentAt(pos, { x: 1, y: 0, z: 0 });
    travel = Math.max(0, travel - 0.0001);
    harvestTimer = 0;
    harvestQueue.length = 0;
    emitPose(true);
    emitHud(true);
    return true;
  }

  function focusLabel(label) {
    if (!active || !label) return false;
    const node = getLeaves().find((leaf) => leaf && leaf.label === label);
    if (!node || !node.centroid) return false;
    pos = norm(node.centroid);
    headingVec = tangentAt(pos, { x: 1, y: 0, z: 0 });
    travel = Math.max(0, travel - 0.0001);
    harvestTimer = 0;
    harvestQueue = [];
    return true;
  }

  /** QA/acceptance hook: pause the footprint auto-harvest without leaving play. */
  function setAutoHarvest(enabled) {
    autoHarvest = enabled !== false;
    return autoHarvest;
  }

  function harvestEffect(effect = {}) {
    if (!active) return;
    effects.push({
      start: now(),
      color: (effect.resource && effect.resource.color) || '#ffe066',
      name: (effect.resource && effect.resource.name) || '',
      value: Number(effect.value) || 0,
    });
    effects = effects.slice(-4);
  }

  function effectsList() {
    const stamp = now();
    effects = effects.filter((effect) => stamp - effect.start < 1600);
    return effects.map((effect) => ({
      start: effect.start,
      age: (stamp - effect.start) / 1600,
      color: effect.color,
      name: effect.name,
      value: effect.value,
    }));
  }

  return {
    start,
    stop,
    update,
    pose,
    progress,
    entities,
    effects: effectsList,
    hold,
    applyPlacement,
    focusLabel,
    harvestEffect,
    setAutoHarvest,
    debug: () => debug,
    peers: () => getPeers().length,
    target,
    get active() { return active; },
    get phase() { return phase; },
    get planet() { return { ...planet }; },
    get travel() { return travel; },
    get lapFraction() { return clamp01(travel / (Math.PI * 2)); },
  };
}

export default createSurfaceController;
