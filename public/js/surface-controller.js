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

import { canHarvestCell } from './shared/harvest.js';

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

/** Harvest rule shared with the HUD and the renderer (CTL-03). */
function harvestable(node, myIndex, maxDepth) {
  return canHarvestCell(node, myIndex, maxDepth);
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
 * @param {()=>Array} [options.getSupplyCells]
 * @param {()=>Array} [options.getPeers]
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
  let mineEffects = [];
  let mineTotal = 0;
  const virtualHomes = new Map();

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
    if (!node) return { label: null, harvestable: false };
    return { label: node.label, harvestable: harvestable(node, getMyIndex(), getMaxDepth()) };
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
    const myIndex = getMyIndex();
    const maxDepth = getMaxDepth();
    for (const [x, z] of samples) {
      const point = norm(add(pos, add(mul(right, x), mul(fwd, z))));
      const cell = findCell(point);
      if (cell && harvestable(cell, myIndex, maxDepth)) found.set(cell.label, cell);
    }
    return [...found.values()];
  }

  function harvestTick(dtMs) {
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

  function virtualPeerPosition(peer, stamp) {
    const id = String(peer.playerId || peer.tag || 'PILOT');
    let home = virtualHomes.get(id);
    if (!home) {
      const hash = hashString(id);
      const basis = tangentBasis(pos);
      const radius = 0.035 + (hash % 60) / 1500;
      const angle = ((hash >>> 7) % 628) / 100;
      const homeBase = norm(add(pos, add(
        mul(basis.east, Math.cos(angle) * radius),
        mul(basis.north, Math.sin(angle) * radius),
      )));
      home = {
        base: homeBase,
        phase: ((hash >>> 13) % 628) / 100,
        speed: 0.00006 + ((hash >>> 3) % 7) * 0.000015,
        radius: 0.018 + (hash % 45) / 1600,
        direction: (hash & 1) ? 1 : -1,
      };
      virtualHomes.set(id, home);
    }
    const basis = tangentBasis(home.base);
    const angle = stamp * home.speed * home.direction + home.phase;
    const x = Math.cos(angle) * home.radius;
    const y = Math.sin(angle * 0.63 + home.phase) * home.radius * 0.62;
    return norm(add(home.base, add(mul(basis.east, x), mul(basis.north, y))));
  }

  /**
   * Build the renderer entity list. Entities reference cells by `label` only;
   * no geometry is copied and no colour/projection logic lives here.
   * @returns {Array<object>} SurfaceEntity[]
   */
  function entities() {
    if (!active) return [];
    const stamp = now();
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
    for (const peer of getPeers()) {
      if (!peer || peer.playerId === myId) continue;
      const serverSurface = peer.surface && peer.surface.pos && Number.isFinite(peer.surface.pos.x)
        ? peer.surface.pos
        : null;
      const peerPos = serverSurface || (peer.pos && Number.isFinite(peer.pos.x) ? peer.pos : virtualPeerPosition(peer, stamp));
      if (!peerPos) continue;
      const serverHeading = peer.surface && peer.surface.heading
        && Number.isFinite(peer.surface.heading.x) ? peer.surface.heading : null;
      const peerForward = serverHeading
        || (peer.forward && Number.isFinite(peer.forward.x)
          ? peer.forward
          : tangentAt(peerPos, { x: 1, y: 0, z: 0 }));
      let ph = 0;
      const seed = String(peer.playerId || peer.tag);
      for (let i = 0; i < seed.length; i += 1) ph = (ph * 31 + seed.charCodeAt(i)) % 997;
      const cycle = (stamp / 2600 + ph / 997) % 1;
      out.push({
        kind: 'peer',
        playerId: String(peer.playerId || peer.tag || 'PILOT'),
        pos: { ...peerPos },
        forward: { ...peerForward },
        walk: stamp * 0.004,
        mine: cycle < 0.32,
        tint: peer.color || '#a78bfa',
        label: String(peer.tag || 'PILOT'),
        cellLabel: null,
      });
    }
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
    for (const cell of getSupplyCells()) {
      if (!cell || !cell.label) continue;
      const node = getLeaves().find((leaf) => leaf && leaf.label === cell.label);
      if (!node || !node.centroid) continue;
      out.push({
        kind: 'pin',
        playerId: null,
        pos: mul(node.centroid, 1.004),
        forward: null,
        walk: 0,
        mine: false,
        tint: cell.color || '#ffd166',
        label: String(cell.name || 'ORE'),
        cellLabel: cell.label,
        variant: 'supply',
      });
    }
    mineEffects = mineEffects.filter((effect) => stamp - effect.start < 1000);
    for (const effect of mineEffects) {
      const node = getLeaves().find((leaf) => leaf && leaf.label === effect.label);
      if (!node || !node.centroid) continue;
      out.push({
        kind: 'beam',
        playerId: effect.playerId || null,
        pos: mul(node.centroid, 1.003),
        forward: null,
        walk: 0,
        mine: true,
        tint: effect.color || '#8afcff',
        label: `${effect.tag || 'ROBOT'} // MINE ${effect.label}`,
        cellLabel: effect.label,
        progress: clamp01((stamp - effect.start) / 1000),
      });
    }
    debug = { leaves: getLeaves().length, entities: out.length, phase };
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
    virtualHomes.clear();
    const startBasis = tangentBasis(pos);
    headingVec = tangentAt(pos, startBasis.east);
    travel = 0;
    harvestCheck = 0;
    harvestTimer = 0;
    harvestQueue = [];
    lastHarvestLabel = null;
    effects = [];
    mineEffects = [];
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

  function showMine(message) {
    if (!active || !message || !message.label) return false;
    mineEffects.push({
      start: now(),
      label: String(message.label),
      tag: String(message.tag || 'ROBOT').slice(0, 14),
      color: message.color || '#8afcff',
      playerId: message.playerId || null,
    });
    mineEffects = mineEffects.slice(-12);
    mineTotal += 1;
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
    showMine,
    applyPlacement,
    focusLabel,
    harvestEffect,
    debug: () => debug,
    peers: () => getPeers().length,
    mineCount: () => mineTotal,
    target,
    get active() { return active; },
    get phase() { return phase; },
    get planet() { return { ...planet }; },
    get travel() { return travel; },
    get lapFraction() { return clamp01(travel / (Math.PI * 2)); },
  };
}

export default createSurfaceController;
