/**
 * NARIMATO — INFINITE GRID authoritative world core.
 *
 * A single, never-ending sphere. There are no rounds or phase timers: the world is
 * always live and every change is persisted forever. Robots are staffed transiently
 * as opponents/ambience and are not treated as humans for ownership or surface presence.
 *
 * Model
 * -----
 * A sparse adaptive tree rooted at the 20 icosahedron faces (labels "1".."20",
 * depth 0). Active cells ("leaves") are tree nodes with `children === null`.
 * Every successful click charges a leaf; at `threshold` clicks (default 8) and
 * while `depth < maxDepth` (default 24) *only that leaf* subdivides into its four
 * spherical children. Children inherit the parent's owner and start at 0
 * clicks. Labels are hierarchical (`9.2` -> `9.2.1` … `9.2.4`) and stable
 * forever; children geometry comes from the shared `childTriangles()` helper.
 *
 * Player indexes are append-only array indexes and are what leaf owners refer
 * to, so a client's per-cell colour never changes meaning.
 *
 * Persistence
 * -----------
 * `DATA_DIR/world.json` stores the players plus the sparse tree (nodes only —
 * geometry is rebuilt from labels + `childTriangles`). Saves are atomic
 * (temp file + rename), debounced (`SAVE_DEBOUNCE_MS`) and flushed on shutdown.
 * A missing file starts a fresh level-0 world; a present-but-corrupt file is
 * quarantined (`world.json.corrupt-<stamp>`) and startup is refused unless
 * `ALLOW_EMPTY_WORLD=1` (OPS-03, docs/RECOVERY.md).
 *
 * Zero npm dependencies, ESM, Node >= 20.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { buildMesh, childTriangles, faceCentroid, parseFaceLabel } from '../public/js/shared/geometry.js';
import {
  DEPOSIT_CHANCE,
  RESOURCE_MARKET,
  publicResource,
  rollDeposit,
  rollResource,
  resourceById,
} from '../public/js/shared/resources.js';
import { PLANET_VERSION, rollTerrainDeposit, terrainAt, weightedResourceForBiome } from '../public/js/shared/planet.js';
import { INCIDENT_COPY } from '../public/js/story-copy.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(LIB_DIR, '..');
export const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const WORLD_FILE = 'world.json';

/**
 * Player colours: one cryptographic 24-bit RGB colour per player.
 *
 * There are 16,777,216 possible colours, so every player can have their own
 * random `#rrggbb` (no fixed palette). Persisted colours are never rewritten;
 * only new players get a random one.
 *
 * Visibility guard: a colour whose red, green AND blue are all below 96 would
 * be nearly black and disappear against the dark arena, so channels are
 * resampled until `max(r, g, b) >= 96`. That still leaves 16,777,216 - 96^3 =
 * 15,892,480 usable colours (~95% of the space), and only ~5% of samples hit
 * the retry path, so this costs essentially nothing.
 */
export const MIN_COLOR_CHANNEL_MAX = 96;

function hexChannel(value) {
  return value.toString(16).padStart(2, '0');
}

/** Cryptographic random visible player colour, formatted `#rrggbb`. */
function hexToRgb(color) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
}

export function randomPlayerColor() {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const r = crypto.randomInt(0, 256);
    const g = crypto.randomInt(0, 256);
    const b = crypto.randomInt(0, 256);
    if (Math.max(r, g, b) >= MIN_COLOR_CHANNEL_MAX) return `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`;
  }
  // Practically unreachable (95% acceptance per attempt); deterministic bright fallback.
  return '#00f0ff';
}

/** True when a colour is a canonical #rrggbb string. */
export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export const TAG_RE = /^[A-Z0-9_-]{2,12}$/;

export const CLAIM_POINTS = 10;
export const STEAL_POINTS = 15;
export const REINFORCE_POINTS = 2;
export const BREAK_BONUS_BASE = 50;
export const BREAK_BONUS_PER_DEPTH = 10;

/** Hard safety ceiling for hierarchical labels (SPEC default maxDepth is 20). */
export const ABSOLUTE_MAX_DEPTH = 32;

export const PERSIST_VERSION = 2;

/**
 * End-of-planet incidents: each resets/reseeds the crust with new deposits.
 * Copy is owned by `public/js/story-copy.js` (STR-02); this module only drives
 * the rotation.
 */
export const INCIDENTS = INCIDENT_COPY;

/** EVT-01: canonical incident kinds in deterministic rotation order. */
export const INCIDENT_KINDS = Object.freeze(INCIDENTS.map((incident) => incident.kind));

/** True when `kind` names one of the four supported incidents. */
export function isIncidentKind(kind) {
  return typeof kind === 'string' && INCIDENT_KINDS.includes(kind);
}

/**
 * EVT-01: sanitize the persisted incident rotation index. Missing, negative,
 * non-integer, unsafe or out-of-range-unsafe values restart the cycle at 0.
 */
export function sanitizeIncidentCycle(value) {
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return value % INCIDENTS.length;
}

export const DEFAULT_CONFIG = Object.freeze({
  port: 4173,
  host: '0.0.0.0',
  dataDir: DEFAULT_DATA_DIR,
  breakClicks: 8,
  maxDepth: 24,
  clickCooldownMs: 40,
  saveDebounceMs: 500,
  // Hidden ore deposits: null -> use each biome's geological chance
  // (planet.js). An explicit value (DEPOSIT_CHANCE env) overrides the chance
  // for MINEABLE cells only (ocean never yields surface deposits).
  depositChance: null,
  // Fixed planet seed override (tests); null -> random uint32 per world.
  planetSeed: null,
  // Unique index of this core in the planet sequence (manager sets it). It is
  // part of the robot route seed so two planets never share a route stream.
  planetIndex: 0,
  // Safe empty-boot guard (OPS-03): a present-but-corrupt world.json is
  // quarantined and startup is refused unless this is explicitly enabled.
  allowEmptyWorld: false,
  // EVT-01: development-only deterministic incident trigger. Off unless
  // NARIMATO_EVENT_TRIGGER=1; no header/query parameter can override it.
  eventTrigger: false,
  // Always-on single robot player ("always spawn and play around").
  bots: 1,
  botMinMs: 60_000, // lifetime
  botMaxMs: 180_000,
  botGapMinMs: 3_000, // offline gap between robots
  botGapMaxMs: 10_000,
  botClickMinMs: 800, // click cadence
  botClickMaxMs: 2_800,
  // Emergency-supply gate (SRV-04). Production default is two minutes; the
  // acceptance harness shortens it so a real drop is reachable in a short run.
  supplyMinAgeMs: 120_000,
});

export const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);

const NUMERIC_LIMITS = Object.freeze({
  breakClicks: [1, 1_000_000],
  planetIndex: [0, 100_000],
  maxDepth: [0, ABSOLUTE_MAX_DEPTH],
  clickCooldownMs: [0, 60_000],
  saveDebounceMs: [0, 60_000],
  bots: [0, 8],
  botMinMs: [0, 86_400_000],
  botMaxMs: [0, 86_400_000],
  botGapMinMs: [0, 86_400_000],
  botGapMaxMs: [0, 86_400_000],
  botClickMinMs: [0, 86_400_000],
  botClickMaxMs: [0, 86_400_000],
  supplyMinAgeMs: [0, 86_400_000],
});

function toInt(value, fallback, min = -Infinity, max = Infinity) {
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && value.trim() !== '') n = Number(value.trim());
  else n = NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Fill a partial config with defaults and coerce numeric fields. */
export function normalizeConfig(partial = {}) {
  const cfg = { ...DEFAULT_CONFIG };
  for (const key of CONFIG_KEYS) {
    if (partial && partial[key] !== undefined && partial[key] !== null) cfg[key] = partial[key];
  }
  for (const [key, [min, max]] of Object.entries(NUMERIC_LIMITS)) {
    cfg[key] = toInt(cfg[key], DEFAULT_CONFIG[key], min, max);
  }
  // DEPOSIT_CHANCE is a 0..1 probability (floats allowed), not an integer.
  const rawChance =
    typeof cfg.depositChance === 'number'
      ? cfg.depositChance
      : typeof cfg.depositChance === 'string' && cfg.depositChance.trim() !== ''
        ? Number(cfg.depositChance.trim())
        : NaN;
  cfg.depositChance = Number.isFinite(rawChance) ? Math.min(1, Math.max(0, rawChance)) : null;
  const rawSeed =
    typeof cfg.planetSeed === 'number'
      ? cfg.planetSeed
      : typeof cfg.planetSeed === 'string' && cfg.planetSeed.trim() !== ''
        ? Number(cfg.planetSeed.trim())
        : NaN;
  cfg.planetSeed = Number.isInteger(rawSeed) && rawSeed >= 0 && rawSeed <= 0xffffffff ? rawSeed >>> 0 : null;
  // Keep every robot min/max pair ordered (env/overrides may invert them).
  if (cfg.botMaxMs < cfg.botMinMs) cfg.botMaxMs = cfg.botMinMs;
  if (cfg.botGapMaxMs < cfg.botGapMinMs) cfg.botGapMaxMs = cfg.botGapMinMs;
  if (cfg.botClickMaxMs < cfg.botClickMinMs) cfg.botClickMaxMs = cfg.botClickMinMs;
  const rawPort =
    typeof cfg.port === 'number' ? cfg.port : typeof cfg.port === 'string' && cfg.port.trim() !== '' ? Number(cfg.port.trim()) : NaN;
  cfg.port = Number.isInteger(rawPort) && rawPort >= 0 && rawPort <= 65535 ? rawPort : DEFAULT_CONFIG.port;
  cfg.host = typeof cfg.host === 'string' && cfg.host.trim() ? cfg.host.trim() : DEFAULT_CONFIG.host;
  cfg.dataDir = typeof cfg.dataDir === 'string' && cfg.dataDir.trim() ? cfg.dataDir.trim() : DEFAULT_CONFIG.dataDir;
  cfg.allowEmptyWorld =
    cfg.allowEmptyWorld === true ||
    ['1', 'true', 'yes', 'on'].includes(String(cfg.allowEmptyWorld ?? '').trim().toLowerCase());
  cfg.eventTrigger =
    cfg.eventTrigger === true ||
    ['1', 'true', 'yes', 'on'].includes(String(cfg.eventTrigger ?? '').trim().toLowerCase());
  return cfg;
}

const ENV_KEYS = Object.freeze({
  PORT: 'port',
  HOST: 'host',
  DATA_DIR: 'dataDir',
  BREAK_CLICKS: 'breakClicks',
  MAX_DEPTH: 'maxDepth',
  CLICK_COOLDOWN_MS: 'clickCooldownMs',
  SAVE_DEBOUNCE_MS: 'saveDebounceMs',
  DEPOSIT_CHANCE: 'depositChance',
  ALLOW_EMPTY_WORLD: 'allowEmptyWorld',
  NARIMATO_EVENT_TRIGGER: 'eventTrigger',
  BOTS: 'bots',
  BOT_MIN_MS: 'botMinMs',
  BOT_MAX_MS: 'botMaxMs',
  BOT_GAP_MIN_MS: 'botGapMinMs',
  BOT_GAP_MAX_MS: 'botGapMaxMs',
  BOT_CLICK_MIN_MS: 'botClickMinMs',
  BOT_CLICK_MAX_MS: 'botClickMaxMs',
  SUPPLY_MIN_AGE_MS: 'supplyMinAgeMs',
});

export function configFromEnv(env = process.env) {
  const out = {};
  const source = env || {};
  for (const [envKey, key] of Object.entries(ENV_KEYS)) {
    const value = source[envKey];
    if (value !== undefined && value !== null && String(value).trim() !== '') out[key] = value;
  }
  return out;
}

export function resolveConfig(env = process.env, overrides = {}) {
  return normalizeConfig({ ...configFromEnv(env), ...(overrides || {}) });
}

export function normalizeTag(value) {
  if (typeof value !== 'string') return null;
  const tag = value.trim().toUpperCase();
  return TAG_RE.test(tag) ? tag : null;
}

/** Break bonus for breaking a cell at `depth`: 50 + 10*depth. */
export function breakBonus(depth) {
  return BREAK_BONUS_BASE + BREAK_BONUS_PER_DEPTH * (Number.isFinite(depth) ? depth : 0);
}

const fail = (error, message) => ({ ok: false, error, message });

/** Random uint32 planet seed (cryptographic). */
function randomPlanetSeed() {
  return crypto.randomBytes(4).readUInt32BE(0);
}
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomPlayerId(isTaken) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let id = 'p_';
    for (let i = 0; i < 6; i += 1) id += BASE36[Math.floor(Math.random() * 36)];
    if (!isTaken(id)) return id;
  }
  let counter = 1;
  let candidate = `p_${counter.toString(36).padStart(6, '0')}`;
  while (isTaken(candidate)) {
    counter += 1;
    candidate = `p_${counter.toString(36).padStart(6, '0')}`;
  }
  return candidate;
}

const lastLabelPart = (label) => Number(label.slice(label.lastIndexOf('.') + 1));

/**
 * Parse a hierarchical cell label at any depth the world supports.
 *
 * The shared `parseFaceLabel()` is used as the fast path for the depths it
 * currently validates (base + 3 child digits). SPEC_INFINITE allows MAX_DEPTH
 * 8 (base + 8 child digits), so deeper labels fall back to the same grammar
 * extended to ABSOLUTE_MAX_DEPTH. Returns `{path, label, level}` or null.
 */
export function parseWorldLabel(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const shared = parseFaceLabel(text);
  if (shared) return shared;

  const parts = text.split('.');
  if (parts.length < 5 || parts.length > ABSOLUTE_MAX_DEPTH + 1) return null;
  const path = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (!/^\d{1,2}$/.test(parts[i])) return null;
    const n = Number(parts[i]);
    const ok = i === 0 ? n >= 1 && n <= 20 : n >= 1 && n <= 4;
    if (!ok) return null;
    path.push(n);
  }
  return { path, label: path.join('.'), level: path.length - 1 };
}

async function atomicWriteJson(file, data) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const text = JSON.stringify(data, null, 2) + '\n';
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tmp, text, 'utf8');
  try {
    await fsp.rename(tmp, file);
  } catch (err) {
    if (err && (err.code === 'EEXIST' || err.code === 'EPERM')) {
      await fsp.rm(file, { force: true });
      await fsp.rename(tmp, file);
    } else {
      await fsp.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }
}

function makeCell({ label, depth, a, b, c, ownerIndex = -1, clicks = 0, lastClickIndex = -1 }) {
  return {
    label,
    depth,
    a,
    b,
    c,
    centroid: faceCentroid(a, b, c),
    ownerIndex,
    clicks,
    /** Player index of the most recent click on this cell (-1 = never). */
    lastClickIndex,
    /** Server-only hidden deposit: resource id or null; never leaked until found. */
    resourceId: null,
    resourceFound: false,
    foundByIndex: -1,
    /** Server-only: the click count at which this hidden deposit is mined. */
    resourceFindClick: null,
    children: null,
  };
}

/** Keep only known resource ids with positive integer counts (zeros omitted). */
function sanitizeOreCounts(raw) {
  const counts = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return counts;
  for (const [id, value] of Object.entries(raw)) {
    if (!resourceById(id)) continue;
    const count = Number.isFinite(value) ? Math.trunc(value) : 0;
    if (count > 0) counts[id] = count;
  }
  return counts;
}


/* ------------------------------------------------------------------ *
 * Surface contracts shared by humans, robots and the supply focus
 * ------------------------------------------------------------------ */

/** Transient surface pose lifetime (SRV-01): 5 s of silence clears the body. */
export const POSE_TTL_MS = 5_000;
/** Minimum spacing between accepted surface poses per token (SRV-01: <= 15 Hz). */
export const POSE_MIN_INTERVAL_MS = 60;
/** Coalesced `surface` frame interval; the pump runs every 100 ms (<= 10 Hz). */
export const POSE_FRAME_INTERVAL_MS = 100;
/** Closed surface state vocabulary. */
export const POSE_STATES = Object.freeze(['idle', 'walk', 'turn', 'mine']);
/** Closed `surface_leave` reason vocabulary. */
export const SURFACE_LEAVE_REASONS = Object.freeze(['leave', 'disconnect', 'expire', 'escape', 'reset', 'robot']);

/** Robot route contract (SRV-02). */
export const ROUTE_MAX_WAYPOINTS = 4;
export const ROUTE_RADIUS_RAD = 0.55;
export const ROUTE_MAX_ARC = 2.4;
export const ROUTE_TTL_MS = 30_000;
export const TURN_RATE_RAD_S = 1.2;
export const STEP_RAD = 0.0035;
export const ARRIVE_RAD = 0.02;
/** Fallback containment radius (rad) for a point just outside every leaf. */
export const ROBOT_MINE_EPS = 0.003;
/** Dwell while the route state is `mine` after a committed click (ms). */
export const ROBOT_MINE_DWELL_MS = 900;
/** Idle dwell at a waypoint before the next turn (ms). */
export const ROBOT_IDLE_DWELL_MS = 900;

/** Emergency-supply focus contract (SRV-04). */
export const SUPPLY_FOCUS_TTL_MS = 120_000;
export const SUPPLY_MAX_PLACEMENTS = 24;
export const SUPPLY_MIN_SEPARATION_RAD = 0.06;
export const GOLDEN_ANGLE = 2.399963229728653;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const vnorm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const vcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const vmul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const vtangent = (up, v) => vnorm(vadd(v, vmul(up, -vdot(v, up))));
const vstep = (up, forward, angle) => {
  const f = vtangent(up, forward);
  return { pos: vnorm(vadd(vmul(up, Math.cos(angle)), vmul(f, Math.sin(angle)))), forward: f };
};
const triangleHasPoint = (a, b, c, p, center) => {
  const edges = [[a, b], [b, c], [c, a]];
  for (const [u, v] of edges) {
    const n = vcross(u, v);
    const sign = Math.sign(vdot(n, center)) || 1;
    if (sign * vdot(n, p) < -1e-7) return false;
  }
  return true;
};

/** FNV-1a over a sequence of uint32 values; deterministic across processes. */
function hash32(...values) {
  let hash = 2166136261 >>> 0;
  for (const value of values) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = 0;
    n = Math.trunc(n) >>> 0;
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (n >>> shift) & 0xff;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  return hash >>> 0;
}

function hashText(text) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index) & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** Small deterministic PRNG so routes replay from a seed alone. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform seeded point on the unit sphere. */
function seededUnit(rng) {
  const z = rng() * 2 - 1;
  const angle = rng() * TAU;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), z };
}

/** Bearing of a tangent in a chart basis, in [0, 2π). */
function bearingOf(tangent, basis) {
  return (Math.atan2(vdot(tangent, basis.north), vdot(tangent, basis.east)) + TAU) % TAU;
}

/** Gnomonic chart coordinates of a unit point around a leaf centroid. */
function chartLocal(unit, basis) {
  const denom = vdot(unit, basis.c);
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) return { x: 0, y: 0 };
  return { x: vdot(unit, basis.east) / denom, y: vdot(unit, basis.north) / denom };
}

/** Serialised robot route digest (SRV-02 determinism evidence). */
export function routeDigest(route) {
  if (!route) return null;
  const waypoints = (route.waypoints || [])
    .map((waypoint) => `${waypoint.leaf}:${waypoint.pos.x.toFixed(9)},${waypoint.pos.y.toFixed(9)},${waypoint.pos.z.toFixed(9)}`)
    .join(';');
  return hashText(`${route.seed}|${route.serial}|${route.index}|${route.state}|${route.replans}|${waypoints}`)
    .toString(16)
    .padStart(8, '0');
}

/** Wire strip of one authoritative surface pose (also `state.players[].surface`). */
const surfacePoseOf = (pose) => ({
  playerId: pose.playerId,
  tag: pose.tag,
  color: pose.color,
  leaf: pose.leaf,
  pos: { ...pose.pos },
  local: { x: pose.local.x, y: pose.local.y },
  heading: { ...pose.heading },
  bearingRad: pose.bearingRad,
  state: pose.state,
  moving: !!pose.moving,
  updatedAt: pose.updatedAt,
  rev: pose.rev,
});

const publicPlayerFields = (player, pose = null) => ({
  id: player.id,
  tag: player.tag,
  color: player.color,
  online: !!player.online,
  score: player.score,
  facesHeld: player.facesHeld,
  clicks: player.clicks,
  breaks: player.breaks,
  claims: player.claims,
  steals: player.steals,
  ores: player.ores,
  oreValue: player.oreValue,
  oreCounts: { ...player.oreCounts },
  ...(pose ? { surface: surfacePoseOf(pose) } : {}),
});

const joinPlayerSummary = (player) => ({ id: player.id, tag: player.tag, color: player.color });

// Wire Leaf: [label, ownerIndex, clicks, discoveredResourceId|null, lastClickIndex].
// Hidden deposits stay server-only (4th slot null until discovered); the 5th
// slot exposes the own-cell contest lock so clients can stop rendering +2 spam.
const leafOf = (cell) => [
  cell.label,
  cell.ownerIndex,
  cell.clicks,
  cell.resourceFound && cell.resourceId ? cell.resourceId : null,
  cell.lastClickIndex,
];

export class WorldCore {
  /**
   * @param {object} [options]
   * @param {string} [options.dataDir] override DATA_DIR
   * @param {object} [options.config] partial config (camelCase)
   * @param {() => number} [options.now] injectable clock (epoch ms)
   * @param {boolean} [options.autoSave] debounce disk writes (default true)
   * @param {boolean} [options.quiet] suppress load/save warnings
   */
  constructor({ dataDir, config = {}, now = Date.now, rng = Math.random, autoSave = true, quiet = false } = {}) {
    this.config = normalizeConfig(dataDir ? { ...config, dataDir } : config);
    this.dataDir = this.config.dataDir;
    this.worldFile = path.join(this.dataDir, WORLD_FILE);
    this.now = typeof now === 'function' ? now : Date.now;
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this._autoSave = !!autoSave;
    this._quiet = !!quiet;
    this._startedAt = this.now();

    /** @type {Array<object>} append-only; index == ownerIndex in leaves */
    this.players = [];
    this._tokens = new Map();
    this._baseCells = [];
    this._leaves = new Map();
    this._faces = 0;
    this.createdAt = this.now();
    this.totalClicks = 0;
    this.totalBreaks = 0;
    this.maxDepthReached = 0;

    /** Internal change counter (not part of the wire State). */
    this.revision = 0;
    this._stateUrgent = false;
    this._events = [];
    this._loaded = false;
    this.lastSaveError = null;

    this._dirty = false;
    this._saveTimer = null;
    this._writeChain = Promise.resolve();

    // Transient surface authority (SRV-01 .. SRV-04). Never persisted, never
    // token-bearing: one wire-shaped pose per online player, one route per robot,
    // one advisory supply focus per planet.
    this._poses = new Map(); // playerId -> SurfacePose
    this._poseDirty = new Set(); // playerIds whose latest pose has not been flushed
    this._lastPoseFrameAt = new Map(); // playerId -> last surface frame time (10 Hz cap)
    this._poseRev = 0; // strictly monotonic per core (restart boots at 0)
    this._robotSerial = 0; // spawn serial feeding the deterministic route seed
    this._robotMineRejected = 0;
    this._supplyDrops = 0;
    this._supplyRev = 0;
    this._focus = null;

    // Robot controller (always-on single robot player).
    // Robot scene staffing: manager sets a target per planet each tick; each
    // robot is an ordinary player (no bot flag on the wire) tracked internally.
    this._robots = []; // [{playerId, token, tag, index, nextClickAt, nextLeaveAt}]
    this._robotIds = new Set(); // robot player ids (so bots don't count as humans)
    this._robotTarget = this.config.bots > 0 ? this.config.bots : 0;
    this._closed = false;
    this._migratedOnLoad = 0;
    this._meteorArmed = false;
    this._incidentCycle = 0;
    this._findClickMigrated = 0;
    this.freshlyCreated = false;

    // One persisted procedural planet: seed + terrain model version.
    this.planetSeed = Number.isInteger(this.config.planetSeed) ? this.config.planetSeed >>> 0 : randomPlanetSeed();
    this.planetIndex = Number.isInteger(this.config.planetIndex) ? this.config.planetIndex : 0;
    this.terrainVersion = PLANET_VERSION;

    this._resetTree();
  }

  /** Create a core and load whatever is persisted in its data dir. */
  static async open(options = {}) {
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    // The constructor builds a throwaway level-0 tree before loading; keep it
    // off the caller's injected RNG stream so load-time backfill rolls (and any
    // fresh world created when no file exists) consume a deterministic sequence.
    const core = new WorldCore({ ...options, rng: () => 0 });
    core.rng = rng;
    await core.load();
    return core;
  }

  _log(...args) {
    if (!this._quiet) console.warn('[world-core]', ...args);
  }

  // ------------------------------------------------------------------ loading

  async load() {
    await fsp.mkdir(this.dataDir, { recursive: true });
    this._migratedOnLoad = 0;
    this._meteorArmed = false;
    this._incidentCycle = 0;
    this._findClickMigrated = 0;
    const { raw, corruptReason } = await this._readWorldFile();
    this._loaded = true;
    this.freshlyCreated = false;

    // OPS-03: a present-but-corrupt world.json is evidence, not an empty world.
    // Quarantine it (rename) and refuse to boot unless explicitly allowed, so
    // the next debounced save cannot overwrite the last good copy.
    if (corruptReason) {
      await this._handleCorruptWorld(corruptReason);
      return this;
    }
    if (!raw) {
      this._freshWorld();
      return this;
    }

    // A world written by a newer release must never be silently downgraded.
    if (Number.isInteger(raw.version) && raw.version > PERSIST_VERSION) {
      const err = new Error(
        `${WORLD_FILE} persist version ${raw.version} is newer than this build (${PERSIST_VERSION}); refusing to load so a newer world is not downgraded. Start the release that wrote it.`,
      );
      err.code = 'SCHEMA_TOO_NEW';
      throw err;
    }

    const players = this._sanitizePlayers(raw.players);
    if (!players) {
      await this._handleCorruptWorld('players are corrupt');
      return this;
    }

    this.players = players;
    this._tokens = new Map(players.map((player) => [player.token, player]));
    // EVT-01: resume the persisted incident rotation for THIS planet. Missing,
    // corrupt or unsafe values restart at meteor instead of skipping kinds.
    this._incidentCycle = sanitizeIncidentCycle(raw.incidentCycle);

    const storedSeed =
      Number.isInteger(raw.planetSeed) && raw.planetSeed >= 0 && raw.planetSeed <= 0xffffffff ? raw.planetSeed >>> 0 : null;
    const storedVersion = Number.isInteger(raw.terrainVersion) ? raw.terrainVersion : null;
    const needsTerrainMigration = storedSeed === null || storedVersion !== PLANET_VERSION;
    if (storedSeed !== null) this.planetSeed = storedSeed;
    this.terrainVersion = PLANET_VERSION;

    let cells = null;
    try {
      cells = this._sanitizeTree(raw.tree, players.length);
    } catch (err) {
      this._log('world.json tree is corrupt — resetting the grid', err?.message || err);
      cells = null;
    }

    if (cells) {
      this._baseCells = cells;
    } else {
      this._resetTree();
    }
    this._rebuildLeafIndex();
    this._recountFacesHeld();

    this.createdAt = Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? raw.createdAt : this.now();
    this.totalClicks = Number.isInteger(raw.totalClicks) && raw.totalClicks >= 0 ? raw.totalClicks : 0;
    this.totalBreaks = Number.isInteger(raw.totalBreaks) && raw.totalBreaks >= 0 ? raw.totalBreaks : 0;
    const persistedDepth = Number.isInteger(raw.maxDepthReached) && raw.maxDepthReached >= 0 ? raw.maxDepthReached : 0;
    this.maxDepthReached = Math.max(persistedDepth, this._treeDepth());
    this.revision += 1;
    this._stateUrgent = false;
    this._dirty = false;
    // Planet migration: existing worlds without a seed/terrain version get one
    // and their HIDDEN deposits re-rolled from the procedural terrain (found
    // deposits and all player data are preserved). Persist the new fields.
    if (needsTerrainMigration) {
      this._migrateTerrain();
      this._markDirty();
    }
    // Existing deposits from before the random-discovery-click change get a
    // random discovery click and are persisted.
    if (this._findClickMigrated > 0) this._markDirty();
    this._refreshMeteorArming();
    return this;
  }

  /** Read world.json, distinguishing a missing file (first boot) from a corrupt one. */
  async _readWorldFile() {
    let text;
    try {
      text = await fsp.readFile(this.worldFile, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') return { raw: null, corruptReason: null };
      throw error;
    }
    if (!text.trim()) return { raw: null, corruptReason: 'empty file' };
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return { raw: null, corruptReason: `invalid JSON (${error?.message || error})` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { raw: null, corruptReason: 'not a JSON object' };
    }
    return { raw: parsed, corruptReason: null };
  }

  /**
   * Quarantine the corrupt world file and either boot a fresh world (explicit
   * ALLOW_EMPTY_WORLD=1) or refuse to start. Never deletes the evidence.
   */
  async _handleCorruptWorld(reason) {
    const quarantineFile = await this._quarantineWorld();
    if (this.config.allowEmptyWorld) {
      this._log(`ALLOW_EMPTY_WORLD=1 — starting a fresh world; corrupt ${WORLD_FILE} quarantined to ${quarantineFile}`);
      this._freshWorld();
      return quarantineFile;
    }
    const err = new Error(
      `${WORLD_FILE} is corrupt (${reason}); quarantined to ${quarantineFile}. ` +
        'Refusing to boot an empty world so the last good copy is not overwritten. ' +
        'Restore a verified backup (docs/RECOVERY.md) or start once with ALLOW_EMPTY_WORLD=1.',
    );
    err.code = 'WORLD_CORRUPT';
    err.quarantineFile = quarantineFile;
    throw err;
  }

  /** Rename world.json to world.json.corrupt-<UTC stamp>; returns the new path. */
  async _quarantineWorld() {
    const stamp = new Date(this.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    let target = `${this.worldFile}.corrupt-${stamp}`;
    let counter = 1;
    for (;;) {
      try {
        await fsp.access(target);
        target = `${this.worldFile}.corrupt-${stamp}-${counter}`;
        counter += 1;
      } catch {
        break;
      }
    }
    await fsp.rename(this.worldFile, target);
    return target;
  }

  _freshWorld() {
    this.freshlyCreated = true;
    if (!Number.isInteger(this.planetSeed)) this.planetSeed = randomPlanetSeed();
    this.terrainVersion = PLANET_VERSION;
    this.players = [];
    this._tokens = new Map();
    this.createdAt = this.now();
    this.totalClicks = 0;
    this.totalBreaks = 0;
    this.maxDepthReached = 0;
    this._resetTree();
    this._dirty = false;
  }

  _sanitizePlayers(raw) {
    // A persisted world always has a players array; a missing/non-array value is
    // corruption, not an empty world (OPS-03 quarantine path).
    if (!Array.isArray(raw)) return null;
    const players = [];
    const ids = new Set();
    const tokens = new Set();
    const tags = new Set();
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') return null;
      const tag = normalizeTag(entry.tag);
      if (!tag || tags.has(tag)) return null;
      tags.add(tag);
      let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
      if (!id || ids.has(id)) id = randomPlayerId((candidate) => ids.has(candidate));
      ids.add(id);
      let token = typeof entry.token === 'string' && entry.token.trim() ? entry.token.trim() : null;
      if (!token || tokens.has(token)) token = crypto.randomUUID();
      tokens.add(token);
      const num = (value) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
      players.push({
        id,
        tag,
        // Persisted colours are authoritative and kept verbatim (even if dark);
        // only a corrupt colour string gets a fresh random one.
        color: isHexColor(entry.color) ? entry.color : randomPlayerColor(),
        token,
        online: false,
        score: num(entry.score),
        facesHeld: 0, // recomputed from the tree
        clicks: num(entry.clicks),
        breaks: num(entry.breaks),
        claims: num(entry.claims),
        steals: num(entry.steals),
        ores: num(entry.ores),
        oreValue: num(entry.oreValue),
        oreCounts: sanitizeOreCounts(entry.oreCounts),
        suppliedPlanets: Array.isArray(entry.suppliedPlanets)
          ? [...new Set(entry.suppliedPlanets.filter((value) => Number.isInteger(value) && value >= 0))]
          : [],
        supplyDropAt: Number.isFinite(entry.supplyDropAt) && entry.supplyDropAt > 0 ? entry.supplyDropAt : 0,
        createdAt: Number.isFinite(entry.createdAt) && entry.createdAt > 0 ? entry.createdAt : this.now(),
        updatedAt: Number.isFinite(entry.updatedAt) && entry.updatedAt > 0 ? entry.updatedAt : this.now(),
        lastClickAt: null,
      });
    }
    return players;
  }

  /** Validate + rebuild the sparse tree from persisted nodes. Throws on corrupt. */
  _sanitizeTree(rawTree, playerCount) {
    if (!Array.isArray(rawTree) || rawTree.length !== 20) throw new Error('tree must have 20 roots');
    const baseFaces = buildMesh(0).faces;
    const roots = [];
    for (let i = 0; i < baseFaces.length; i += 1) {
      const face = baseFaces[i];
      const expectedLabel = String(i + 1);
      const rawNode = rawTree[i];
      if (!rawNode || typeof rawNode !== 'object') throw new Error(`missing root ${expectedLabel}`);
      roots.push(this._nodeFromPersisted(rawNode, expectedLabel, 0, face.a, face.b, face.c, playerCount));
    }
    return roots;
  }

  _nodeFromPersisted(rawNode, expectedLabel, depth, a, b, c, playerCount) {
    if (rawNode.label !== undefined && rawNode.label !== null && String(rawNode.label) !== expectedLabel) {
      throw new Error(`root/label mismatch: ${rawNode.label} != ${expectedLabel}`);
    }
    const ownerIndex = Number.isInteger(rawNode.owner) ? rawNode.owner : -1;
    if (ownerIndex < -1 || ownerIndex >= playerCount) throw new Error(`owner index out of range at ${expectedLabel}`);
    const clicks = Number.isInteger(rawNode.clicks) && rawNode.clicks >= 0 ? rawNode.clicks : 0;
    // Backward compatible: older world.json files have no lastClickIndex (-1).
    const lastClickIndex =
      Number.isInteger(rawNode.lastClickIndex) && rawNode.lastClickIndex >= -1 && rawNode.lastClickIndex < playerCount
        ? rawNode.lastClickIndex
        : -1;
    const cell = makeCell({ label: expectedLabel, depth, a, b, c, ownerIndex, clicks, lastClickIndex });
    const hasResourceFields =
      rawNode.resourceId !== undefined || rawNode.resourceFound !== undefined || rawNode.foundByIndex !== undefined;
    if (hasResourceFields) {
      // Modern node: fields are authoritative. Explicit "no deposit"
      // (resourceId=null / resourceFound=false) is preserved — no re-roll.
      const resourceId = typeof rawNode.resourceId === 'string' && resourceById(rawNode.resourceId) ? rawNode.resourceId : null;
      const resourceFound = resourceId ? rawNode.resourceFound === true : false;
      const foundByIndex =
        resourceFound && Number.isInteger(rawNode.foundByIndex) && rawNode.foundByIndex >= 0 && rawNode.foundByIndex < playerCount
          ? rawNode.foundByIndex
          : -1;
      cell.resourceId = resourceId;
      cell.resourceFound = resourceFound;
      cell.foundByIndex = foundByIndex;
      if (resourceId) {
        const threshold = Math.max(1, Math.trunc(this.config.breakClicks) || 1);
        const storedFindClick =
          Number.isInteger(rawNode.resourceFindClick) && rawNode.resourceFindClick >= 1 && rawNode.resourceFindClick <= threshold
            ? rawNode.resourceFindClick
            : null;
        if (storedFindClick === null) {
          // Pre-discovery-click world: migrate each deposit to a random click.
          cell.resourceFindClick = this._randomFindClick();
          this._findClickMigrated += 1;
        } else {
          cell.resourceFindClick = storedFindClick;
        }
      }
    }
    // Older/extension-free nodes keep the makeCell defaults (no deposit).
    // If the file also lacks planetSeed/terrainVersion, load() migrates ALL
    // active leaves from procedural terrain below.
    if (Array.isArray(rawNode.children)) {
      if (depth + 1 > ABSOLUTE_MAX_DEPTH) throw new Error(`tree deeper than supported at ${expectedLabel}`);
      if (rawNode.children.length !== 4) throw new Error(`cell ${expectedLabel} must have 4 children`);
      const tris = childTriangles(a, b, c);
      const byLabel = new Map(tris.map((tri) => [`${expectedLabel}.${tri.labelNumber}`, tri]));
      if (byLabel.size !== 4) throw new Error(`child label collision at ${expectedLabel}`);
      const children = [];
      const seen = new Set();
      for (const rawChild of rawNode.children) {
        if (!rawChild || typeof rawChild !== 'object') throw new Error(`bad child of ${expectedLabel}`);
        const label = typeof rawChild.label === 'string' ? rawChild.label : null;
        if (!label || !byLabel.has(label) || seen.has(label)) throw new Error(`unexpected child ${label} of ${expectedLabel}`);
        seen.add(label);
        const tri = byLabel.get(label);
        children.push(this._nodeFromPersisted(rawChild, label, depth + 1, tri.a, tri.b, tri.c, playerCount));
      }
      children.sort((p, q) => lastLabelPart(p.label) - lastLabelPart(q.label));
      cell.children = children;
    }
    return cell;
  }

  /**
   * Roll a hidden surface deposit at a unit sphere point, from procedural
   * terrain. Ocean/deep-ocean cells return null (not mineable from the surface).
   * With an explicit DEPOSIT_CHANCE override (tests/tuning) the biome chance is
   * replaced for mineable cells only; resource type still follows biome weights.
   */
  _rollDepositForPoint(point) {
    const terrain = terrainAt(this.planetSeed, point);
    const override = this.config.depositChance;
    if (override === null) {
      const id = rollTerrainDeposit(terrain, this.rng);
      return id ? resourceById(id) : null;
    }
    if (!terrain.biome.mineable) return null;
    if (!(override > 0)) return null;
    if (override < 1 && this.rng() >= override) return null;
    const id = weightedResourceForBiome(terrain.biome, this.rng);
    return id ? resourceById(id) : null;
  }

  /** Random server-only discovery click in [1..breakClicks] for one deposit. */
  _randomFindClick() {
    const threshold = Math.max(1, Math.trunc(this.config.breakClicks) || 1);
    return 1 + Math.min(threshold - 1, Math.floor(this.rng() * threshold));
  }

  /** Create a cell and roll its hidden deposit (base roots and break children). */
  _createCell(options) {
    const cell = makeCell(options);
    const resource = this._rollDepositForPoint(cell.centroid);
    if (resource) {
      cell.resourceId = resource.id;
      cell.resourceFound = false;
      cell.foundByIndex = -1;
      cell.resourceFindClick = this._randomFindClick();
    }
    return cell;
  }

  /**
   * Terrain migration for worlds created before the planet layer (no seed /
   * terrainVersion): assign the seed + version (caller), then re-roll every
   * UNDISCOVERED active-leaf deposit from terrain. Found deposits are kept
   * forever and player data is untouched; non-mineable cells end with no deposit.
   */
  _migrateTerrain() {
    let changed = 0;
    const walk = (cell) => {
      if (cell.children) {
        for (const child of cell.children) walk(child);
        return;
      }
      if (cell.resourceFound) return; // discovered deposits are permanent
      const resource = this._rollDepositForPoint(cell.centroid);
      cell.resourceId = resource ? resource.id : null;
      cell.foundByIndex = -1;
      cell.resourceFindClick = resource ? this._randomFindClick() : null;
      changed += 1;
    };
    for (const root of this._baseCells) walk(root);
    this._migratedOnLoad += changed;
    return changed;
  }

  _resetTree() {
    const baseFaces = buildMesh(0).faces;
    this._baseCells = baseFaces.map((face) =>
      this._createCell({ label: String(face.id + 1), depth: 0, a: face.a, b: face.b, c: face.c }),
    );
    this._leaves = new Map(this._baseCells.map((cell) => [cell.label, cell]));
    this._faces = this._baseCells.length;
    this._refreshMeteorArming();
  }

  /**
   * Place an authoritative emergency supply drop: one hidden deposit per
   * missing mission unit on nearby mineable leaves, each with
   * `resourceFindClick = 1` so the first successful click mines it.
   * Never overwrites a discovered deposit and never adds ore to inventories.
   */
  placeEmergencySupply({ units = [], hintLabel = null, player = null, planetIndex = 0 } = {}) {
    const now = this.now();
    const cells = [];
    const resources = [];
    const seen = new Set();
    const mineable = [...this._leaves.values()].filter((cell) => {
      if (cell.resourceFound) return false; // discovered deposits are permanent
      const terrain = terrainAt(this.planetSeed, cell.centroid);
      return !!(terrain && terrain.biome && terrain.biome.mineable);
    });
    if (!mineable.length || !units.length) return { impactLabel: null, cells, resources, impactPos: null };

    // Impact point: requested hint cell if it is a mineable leaf, else a random
    // (preferably empty) mineable leaf.
    let impact = null;
    if (typeof hintLabel === 'string' && hintLabel) {
      const parsed = parseWorldLabel(hintLabel);
      const hinted = parsed ? this._leaves.get(parsed.label) : null;
      if (hinted && mineable.includes(hinted)) impact = hinted;
    }
    if (!impact) {
      const empties = mineable.filter((cell) => !cell.resourceId);
      const pool = empties.length ? empties : mineable;
      impact = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(this.rng() * pool.length)))];
    }

    const distance = (a, b) =>
      1 - (a.centroid.x * b.centroid.x + a.centroid.y * b.centroid.y + a.centroid.z * b.centroid.z);
    const byDistance = mineable
      .filter((cell) => cell !== impact)
      .sort((a, b) => distance(impact, a) - distance(impact, b) || a.label.localeCompare(b.label));
    const ordered = [impact, ...byDistance];
    const emptyFirst = ordered.filter((cell) => !cell.resourceId);
    const hiddenFallback = ordered.filter((cell) => cell.resourceId && !cell.resourceFound);
    const pool = [...emptyFirst, ...hiddenFallback];

    for (let index = 0; index < units.length && index < pool.length; index += 1) {
      const resource = resourceById(units[index]);
      if (!resource) continue;
      const cell = pool[index];
      if (!cell) continue;
      cell.resourceId = resource.id;
      cell.resourceFound = false;
      cell.foundByIndex = -1;
      cell.resourceFindClick = 1; // first successful click mines it
      cells.push({ label: cell.label, resourceId: resource.id });
      if (!seen.has(resource.id)) {
        seen.add(resource.id);
        resources.push(publicResource(resource));
      }
    }

    if (cells.length) {
      this._supplyDrops += 1;
      if (player) {
        player.supplyDropAt = now;
        const supplied = Array.isArray(player.suppliedPlanets) ? player.suppliedPlanets : [];
        if (!supplied.includes(planetIndex)) supplied.push(planetIndex);
        player.suppliedPlanets = supplied;
      }
      this._markDirty();
      this._bump(true);
      this._refreshMeteorArming();
    }
    return {
      impactLabel: cells.length ? impact.label : null,
      impactPos: cells.length && impact ? vnorm(impact.centroid) : null,
      cells,
      resources,
    };
  }

  // ------------------------------------------------- surface pose authority

  /**
   * Chart basis for one leaf: centroid plus an orthonormal tangent east/north
   * pair. Every pose carries `local` gnomonic coordinates in this basis so two
   * clients can render a body without re-deriving the chart.
   */
  _chartBasis(cell) {
    const centroid = cell.centroid || faceCentroid(cell.a, cell.b, cell.c);
    const c = vnorm(centroid);
    let east = vtangent(c, sub(cell.a, c));
    if (Math.hypot(east.x, east.y, east.z) < 1e-6) {
      east = vtangent(c, sub(cell.b, c));
      if (Math.hypot(east.x, east.y, east.z) < 1e-6) east = vtangent(c, { x: 0, y: 1, z: 0 });
    }
    return { c, east, north: vnorm(vcross(c, east)) };
  }

  /**
   * Deterministic containment resolver shared by pose validation, robot mining
   * and supply placement (SRV-03). Spherical half-spaces first; ties resolve to
   * the smaller label; a point just outside every leaf falls back to the
   * nearest leaf centroid within `ROBOT_MINE_EPS` radians.
   */
  resolveLeaf(surfacePos) {
    if (!surfacePos) return null;
    const p = vnorm(surfacePos);
    let best = null;
    let bestDot = -Infinity;
    for (const cell of this._leaves.values()) {
      const centroid = cell.centroid || faceCentroid(cell.a, cell.b, cell.c);
      if (!triangleHasPoint(cell.a, cell.b, cell.c, p, centroid)) continue;
      const d = vdot(p, centroid);
      if (d > bestDot || (d === bestDot && best && cell.label < best.label)) {
        best = cell;
        bestDot = d;
      }
    }
    if (best) return best;
    for (const cell of this._leaves.values()) {
      const centroid = cell.centroid || faceCentroid(cell.a, cell.b, cell.c);
      const d = vdot(p, centroid);
      if (d > Math.cos(ROBOT_MINE_EPS) && d > bestDot) {
        best = cell;
        bestDot = d;
      }
    }
    return best;
  }

  /** Backwards-compatible alias; `resolveLeaf()` is the single resolver. */
  _labelAtSurface(surfacePos) {
    return this.resolveLeaf(surfacePos);
  }

  /** Minimum angular distance from a leaf centroid to its three edges (rad). */
  _inradius(cell) {
    const centroid = vnorm(cell.centroid || faceCentroid(cell.a, cell.b, cell.c));
    let min = Infinity;
    for (const [u, v] of [[cell.a, cell.b], [cell.b, cell.c], [cell.c, cell.a]]) {
      const mid = vnorm(vadd(u, v));
      const angle = Math.acos(clamp(vdot(centroid, mid), -1, 1));
      if (angle < min) min = angle;
    }
    return Number.isFinite(min) ? min : 0;
  }

  /** Gnomonic chart point → unit sphere point inside the leaf's plane. */
  _chartToUnit(cell, s, t) {
    const basis = this._chartBasis(cell);
    return vnorm(vadd(basis.c, vadd(vmul(basis.east, s), vmul(basis.north, t))));
  }

  /** Resolve the tangent heading from a number (bearing) or a vector (SRV-01). */
  _poseHeading(input, unit, basis) {
    if (input && typeof input === 'object') {
      const x = Number(input.x);
      const y = Number(input.y);
      const z = Number(input.z);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        const projected = vtangent(unit, { x, y, z });
        if (Math.hypot(projected.x, projected.y, projected.z) > 1e-9) {
          return { heading: projected, bearingRad: bearingOf(projected, basis) };
        }
      }
    }
    const raw = Number(input);
    const bearing = Number.isFinite(raw) ? ((raw % TAU) + TAU) % TAU : 0;
    const candidate = vadd(vmul(basis.east, Math.cos(bearing)), vmul(basis.north, Math.sin(bearing)));
    let heading = vtangent(unit, candidate);
    if (Math.hypot(heading.x, heading.y, heading.z) < 1e-9) heading = vtangent(unit, basis.east);
    return { heading, bearingRad: bearingOf(heading, basis) };
  }

  /** Write one pose record; the only place `_poseRev` advances (SRV-01). */
  _writeSurfacePose(player, { unit, cell, heading, bearingRad, state, moving, local }, now) {
    this._poseRev += 1;
    const pose = {
      playerId: player.id,
      tag: player.tag,
      color: player.color,
      leaf: cell.label,
      pos: { ...unit },
      local: { x: local.x, y: local.y },
      heading: { ...heading },
      bearingRad,
      state,
      moving: !!moving,
      updatedAt: now,
      rev: this._poseRev,
    };
    this._poses.set(player.id, pose);
    this._poseDirty.add(player.id);
    this._bump(false);
    return pose;
  }

  /**
   * Validate and store one human surface pose. Rejections never mutate state and
   * use the closed vocabulary NOT_JOINED / INVALID_POSE / INVALID_STATE /
   * POSE_RATE_LIMIT (SRV-01).
   */
  applySurfacePose(player, input = {}, now = this.now()) {
    if (!player) return fail('NOT_JOINED', 'Join with a valid token before surface movement.');
    const rawPos = input && typeof input === 'object' ? input.pos : null;
    const x = rawPos && Number(rawPos.x);
    const y = rawPos && Number(rawPos.y);
    const z = rawPos && Number(rawPos.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return fail('INVALID_POSE', 'Surface position must be a finite vector.');
    }
    const length = Math.hypot(x, y, z);
    if (!(length >= 0.1 && length <= 10)) {
      return fail('INVALID_POSE', 'Surface position length must be within [0.1, 10].');
    }
    let explicitState = null;
    if (input && input.state !== undefined && input.state !== null) {
      if (typeof input.state !== 'string' || !POSE_STATES.includes(input.state.trim().toLowerCase())) {
        return fail('INVALID_STATE', `Surface state must be one of ${POSE_STATES.join(', ')}.`);
      }
      explicitState = input.state.trim().toLowerCase();
    }
    const unit = vnorm({ x, y, z });
    const cell = this.resolveLeaf(unit);
    if (!cell) return fail('INVALID_POSE', 'Surface position is outside every active cell.');
    const prev = this._poses.get(player.id);
    if (prev && now - prev.updatedAt < POSE_MIN_INTERVAL_MS) {
      return fail('POSE_RATE_LIMIT', `Surface poses are limited to one per ${POSE_MIN_INTERVAL_MS}ms.`);
    }
    const movingInput = input && typeof input.moving === 'boolean' ? input.moving : null;
    const state = explicitState || (movingInput === true ? 'walk' : 'idle');
    const moving = movingInput === null ? state !== 'idle' : movingInput;
    const basis = this._chartBasis(cell);
    const { heading, bearingRad } = this._poseHeading(input ? input.heading : null, unit, basis);
    const pose = this._writeSurfacePose(
      player,
      { unit, cell, heading, bearingRad, state, moving, local: chartLocal(unit, basis) },
      now,
    );
    return { ok: true, pose };
  }

  /** Write a supply placement pose, bypassing the human rate limiter. */
  _writePlacementPose(player, placement, now) {
    // Placements are already unit vectors; keep them bit-identical to the frame.
    const length = Math.hypot(placement.pos.x, placement.pos.y, placement.pos.z);
    const unit = Number.isFinite(length) && Math.abs(length - 1) < 1e-12
      ? { x: placement.pos.x, y: placement.pos.y, z: placement.pos.z }
      : vnorm(placement.pos);
    const cell = this.resolveLeaf(unit);
    if (!cell) return null;
    const basis = this._chartBasis(cell);
    const rawHeading = placement.heading && typeof placement.heading === 'object' ? placement.heading : basis.east;
    let heading = vtangent(unit, rawHeading);
    if (Math.hypot(heading.x, heading.y, heading.z) < 1e-9) heading = basis.east;
    return this._writeSurfacePose(
      player,
      {
        unit,
        cell,
        heading,
        bearingRad: bearingOf(heading, basis),
        state: 'idle',
        moving: false,
        local: chartLocal(unit, basis),
      },
      now,
    );
  }

  /** Current pose for one player id, or null. */
  getPose(playerId) {
    return this._poses.get(playerId) || null;
  }

  /** Live pose count (metrics: `planets[].posesLive`). */
  get poseCount() {
    return this._poses.size;
  }

  /** Monotonic pose revision counter (restarts at 0; diagnostics/tests). */
  get poseRev() {
    return this._poseRev;
  }

  /**
   * Clear one pose and queue exactly one `surface_leave` with a closed reason.
   * Returns true when a live pose was removed.
   */
  clearSurfacePose(player, reason = 'leave') {
    const id = typeof player === 'string' ? player : player && player.id;
    if (!id || !this._poses.has(id)) return false;
    this._poses.delete(id);
    this._poseDirty.delete(id);
    this._lastPoseFrameAt.delete(id);
    const closed = SURFACE_LEAVE_REASONS.includes(reason) ? reason : 'leave';
    this._emit({ type: 'surface_leave', playerId: id, reason: closed });
    this._bump(true);
    return true;
  }

  _clearAllPoses(reason) {
    for (const id of [...this._poses.keys()]) this.clearSurfacePose(id, reason);
  }

  /** Expire poses older than `POSE_TTL_MS`; one `surface_leave` per expiry. */
  sweepPoses(now = this.now()) {
    let expired = 0;
    for (const [id, pose] of [...this._poses]) {
      if (now - pose.updatedAt <= POSE_TTL_MS) continue;
      if (this.clearSurfacePose(id, 'expire')) expired += 1;
    }
    return expired;
  }

  /**
   * Coalesced surface frames for the pump: at most one frame per player per
   * `POSE_FRAME_INTERVAL_MS` (<= 10 Hz), after expiring stale poses. Pending
   * poses stay dirty so the next pump tick still publishes them.
   */
  flushPoses(now = this.now()) {
    const t = Number.isFinite(now) ? now : this.now();
    this.sweepPoses(t);
    const frames = [];
    for (const id of [...this._poseDirty]) {
      const pose = this._poses.get(id);
      if (!pose) {
        this._poseDirty.delete(id);
        continue;
      }
      const last = this._lastPoseFrameAt.get(id) || 0;
      if (t - last < POSE_FRAME_INTERVAL_MS) continue;
      this._lastPoseFrameAt.set(id, t);
      this._poseDirty.delete(id);
      frames.push({ type: 'surface', ...surfacePoseOf(pose) });
    }
    return frames;
  }

  // ------------------------------------------- emergency supply focus (SRV-04)

  /** Deterministic interior standing point for a supply cell (40% inradius). */
  _supplyPoint(cell, playerIndex, total, attempt) {
    const radius = this._inradius(cell) * 0.55 * Math.sqrt((playerIndex + 0.5) / Math.max(1, total));
    const angle = playerIndex * GOLDEN_ANGLE + attempt * 0.7;
    return this._chartToUnit(cell, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  /**
   * One distinct, collision-safe placement per online human inside the supply
   * cells: golden-angle spiral, verified containment and `SUPPLY_MIN_SEPARATION`
   * spacing. Deterministic in player order, so two servers agree.
   */
  computeSupplyPlacements({ impactLabel = null, cells = [], humans = null } = {}) {
    const supplyCells = [];
    if (impactLabel) {
      const impactCell = this._leaves.get(impactLabel);
      if (impactCell) supplyCells.push(impactCell);
    }
    for (const entry of cells) {
      const label = entry && entry.label ? entry.label : entry;
      const cell = this._leaves.get(label);
      if (cell && !supplyCells.includes(cell)) supplyCells.push(cell);
    }
    const targets = (humans || this.players.filter((player) => player.online && !this._robotIds.has(player.id)))
      .slice(0, SUPPLY_MAX_PLACEMENTS);
    const placements = [];
    const total = targets.length;
    for (let i = 0; i < total; i += 1) {
      if (!supplyCells.length) break;
      for (let slot = i; slot < i + supplyCells.length; slot += 1) {
        const cell = supplyCells[slot % supplyCells.length];
        let placed = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const point = this._supplyPoint(cell, i, total, attempt);
          if (this.resolveLeaf(point)?.label !== cell.label) continue;
          if (placements.some((other) => vdot(other.pos, point) > Math.cos(SUPPLY_MIN_SEPARATION_RAD))) continue;
          const basis = this._chartBasis(cell);
          const heading = vtangent(point, sub(basis.c, point));
          placed = {
            playerId: targets[i].id,
            leaf: cell.label,
            pos: point,
            local: chartLocal(point, basis),
            heading,
            bearingRad: bearingOf(heading, basis),
          };
          break;
        }
        if (placed) {
          placements.push(placed);
          break;
        }
      }
    }
    return placements;
  }

  /**
   * Broadcast-ready `supply_focus` payload: one placement per online human in
   * the drop cells. Also relocates every placed human pose so `state`,
   * `snapshot` and `surface` converge without a client-side move.
   */
  createSupplyFocus({ planetIndex = this.planetIndex, impactLabel = null, impactPos = null, cells = [], resources = [], message = '' } = {}) {
    const now = this.now();
    this._supplyRev += 1;
    const placements = this.computeSupplyPlacements({ impactLabel, cells });
    this._focus = {
      planetIndex,
      impactLabel,
      impactPos: impactPos ? { ...impactPos } : impactLabel && this._leaves.get(impactLabel) ? vnorm(this._leaves.get(impactLabel).centroid) : null,
      cells: cells.map((cell) => ({ label: cell.label, resourceId: cell.resourceId })),
      resources: resources.map((resource) => ({ ...resource })),
      placements,
      rev: this._supplyRev,
      expiresAt: now + SUPPLY_FOCUS_TTL_MS,
      message: String(message || ''),
    };
    for (const placement of placements) {
      const player = this.players.find((entry) => entry.id === placement.playerId);
      if (player) this._writePlacementPose(player, placement, now);
    }
    this._bump(true);
    return this.focusSnapshot();
  }

  /** Filter retired labels and fall back affected humans to a surviving cell. */
  _pruneFocus() {
    if (!this._focus) return null;
    const surviving = this._focus.cells.filter((cell) => this._leaves.has(cell.label));
    if (!surviving.length) {
      this._focus = null;
      return null;
    }
    if (surviving.length === this._focus.cells.length) return this._focus;
    this._focus.cells = surviving;
    const cellLabels = surviving.map((cell) => cell.label);
    this._focus.placements = this._focus.placements.map((placement, index) => {
      if (this._leaves.has(placement.leaf)) return placement;
      const label = cellLabels[index % cellLabels.length];
      const cell = this._leaves.get(label);
      const playerIndex = index;
      const total = Math.max(1, this._focus.placements.length);
      const point = this._supplyPoint(cell, playerIndex, total, 0);
      const basis = this._chartBasis(cell);
      const heading = vtangent(point, sub(basis.c, point));
      return {
        playerId: placement.playerId,
        leaf: label,
        pos: point,
        local: chartLocal(point, basis),
        heading,
        bearingRad: bearingOf(heading, basis),
      };
    });
    return this._focus;
  }

  /** Join/snapshot/state-safe focus copy; null when absent or expired. */
  focusSnapshot(now = this.now()) {
    const focus = this._pruneFocus();
    if (!focus) return null;
    if (now > focus.expiresAt) {
      this._focus = null;
      return null;
    }
    return {
      planetIndex: focus.planetIndex,
      impactLabel: focus.impactLabel,
      impactPos: focus.impactPos ? { ...focus.impactPos } : null,
      cells: focus.cells.map((cell) => ({ label: cell.label, resourceId: cell.resourceId })),
      resources: focus.resources.map((resource) => ({ ...resource })),
      placements: focus.placements.map((placement) => ({
        playerId: placement.playerId,
        leaf: placement.leaf,
        pos: { ...placement.pos },
        local: { x: placement.local.x, y: placement.local.y },
        heading: { ...placement.heading },
        bearingRad: placement.bearingRad,
      })),
      rev: focus.rev,
      expiresAt: focus.expiresAt,
      message: focus.message,
    };
  }

  /** Advisory focus for joins/snapshots; expires without timers. */
  getFocus(now = this.now()) {
    return this.focusSnapshot(now);
  }

  /**
   * Guarantee that a freshly created/reset planet can actually satisfy its
   * escape mission: ensure at least the required number of hidden deposits for
   * each mission ore exist on mineable leaves. Only used on fresh/reset grids
   * (never on load, so players cannot farm top-ups by restarting).
   */
  ensureMissionDeposits(mission) {
    if (!mission || !Array.isArray(mission.objectives)) return 0;
    // Tests/tuning use DEPOSIT_CHANCE=0 to create a deliberately barren planet.
    if (this.config.depositChance === 0) return 0;
    const required = new Map();
    for (const objective of mission.objectives) {
      for (const item of objective.items) {
        required.set(item.resourceId, (required.get(item.resourceId) || 0) + item.need);
      }
    }
    const leaves = [...this._leaves.values()];
    const mineable = leaves.filter((cell) => {
      const terrain = terrainAt(this.planetSeed, cell.centroid);
      return terrain && terrain.biome && terrain.biome.mineable;
    });
    const hasHidden = (cell) => cell.resourceId && !cell.resourceFound;
    let added = 0;
    for (const [id, need] of required) {
      let present = mineable.reduce(
        (count, cell) => count + (hasHidden(cell) && cell.resourceId === id ? 1 : 0),
        0,
      );
      let guard = 0;
      while (present < need && guard < 500) {
        guard += 1;
        let target = mineable.find((cell) => !cell.resourceId && !cell.resourceFound);
        if (!target) {
          // Replace a non-required hidden deposit on a mineable leaf.
          target = mineable.find(
            (cell) => hasHidden(cell) && !required.has(cell.resourceId) && cell.resourceId !== id,
          );
        }
        if (!target) break;
        target.resourceId = id;
        target.resourceFound = false;
        target.foundByIndex = -1;
        target.resourceFindClick = this._randomFindClick();
        present += 1;
        added += 1;
      }
    }
    if (added > 0) {
      this._markDirty();
      this._bump(true);
      // The grid now has deposits again; re-arm meteor detection.
      this._refreshMeteorArming();
    }
    return added;
  }

  _rebuildLeafIndex() {
    const leaves = new Map();
    let maxDepth = 0;
    const walk = (cell) => {
      if (cell.depth > maxDepth) maxDepth = cell.depth;
      if (cell.children) {
        for (const child of cell.children) walk(child);
      } else {
        leaves.set(cell.label, cell);
      }
    };
    for (const root of this._baseCells) walk(root);
    this._leaves = leaves;
    this._faces = leaves.size;
    return maxDepth;
  }

  _treeDepth() {
    return this._rebuildLeafIndex();
  }

  _recountFacesHeld() {
    for (const player of this.players) player.facesHeld = 0;
    for (const cell of this._leaves.values()) {
      const owner = this.players[cell.ownerIndex];
      if (owner) owner.facesHeld += 1;
    }
  }

  // ------------------------------------------------------------------- saving

  _markDirty() {
    this._dirty = true;
    if (!this._autoSave || this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._dirty) void this._enqueueWrite();
    }, this.config.saveDebounceMs);
    this._saveTimer.unref?.();
  }

  _serializePlayers() {
    return this.players.map((player) => ({
      id: player.id,
      tag: player.tag,
      color: player.color,
      token: player.token,
      score: player.score,
      clicks: player.clicks,
      breaks: player.breaks,
      claims: player.claims,
      steals: player.steals,
      ores: player.ores,
      oreValue: player.oreValue,
      oreCounts: { ...player.oreCounts },
      suppliedPlanets: [...(player.suppliedPlanets || [])],
      supplyDropAt: player.supplyDropAt || 0,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    }));
  }

  _serializeNode(cell) {
    return {
      label: cell.label,
      owner: cell.ownerIndex,
      clicks: cell.clicks,
      lastClickIndex: cell.lastClickIndex,
      resourceId: cell.resourceId,
      resourceFound: !!cell.resourceFound,
      foundByIndex: cell.foundByIndex,
      resourceFindClick: cell.resourceFindClick,
      children: cell.children ? cell.children.map((child) => this._serializeNode(child)) : null,
    };
  }

  _serialize() {
    return {
      version: PERSIST_VERSION,
      savedAt: this.now(),
      createdAt: this.createdAt,
      threshold: this.config.breakClicks,
      maxDepth: this.config.maxDepth,
      maxDepthReached: this.maxDepthReached,
      totalClicks: this.totalClicks,
      totalBreaks: this.totalBreaks,
      planetSeed: this.planetSeed,
      terrainVersion: this.terrainVersion,
      // EVT-01: the per-planet incident rotation survives reload.
      incidentCycle: this._incidentCycle,
      players: this._serializePlayers(),
      tree: this._baseCells.map((cell) => this._serializeNode(cell)),
    };
  }

  _enqueueWrite() {
    this._dirty = false;
    const payload = this._serialize();
    this._writeChain = this._writeChain
      .catch(() => {})
      .then(() => atomicWriteJson(this.worldFile, payload))
      .catch((err) => {
        this.lastSaveError = err;
        this._log('save failed:', err?.message || err);
      });
    return this._writeChain;
  }

  /** Force pending changes to disk and wait for any in-flight write. */
  async flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    while (this._dirty) {
      this._dirty = false;
      await this._enqueueWrite();
    }
    await this._writeChain.catch(() => {});
    return this;
  }

  async close() {
    this.stop();
    return this.flush();
  }

  // ------------------------------------------------------------------ players

  findByToken(token) {
    if (typeof token !== 'string' || !token.trim()) return null;
    return this._tokens.get(token.trim()) || null;
  }

  getPlayerIdByToken(token) {
    const player = this.findByToken(token);
    return player ? player.id : null;
  }

  getPlayerIndex(player) {
    return this.players.indexOf(player);
  }

  /** Random colour for a brand-new player (persisted players keep theirs). */
  _nextColor() {
    // Avoid colours that are merely *similar*, not just exact duplicates.
    const used = this.players
      .map((player) => hexToRgb(player.color))
      .filter(Boolean);
    const distance = (a, b) =>
      Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    let best = null;
    let bestDistance = -1;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const color = randomPlayerColor();
      const rgb = hexToRgb(color);
      if (!rgb) continue;
      const minDistance = used.length
        ? used.reduce((min, other) => Math.min(min, distance(rgb, other)), Infinity)
        : Infinity;
      if (minDistance >= 96) return color;
      if (minDistance > bestDistance) {
        bestDistance = minDistance;
        best = color;
      }
    }
    return best || randomPlayerColor();
  }

  /**
   * Create or reconnect a persistent player. Token is the reconnect key; tags
   * are unique case-insensitively across all known players.
   */
  join({ tag, token } = {}) {
    const normalized = normalizeTag(tag);
    if (!normalized) {
      return fail('INVALID_TAG', 'Tag must be 2-12 characters: A-Z, 0-9, underscore or dash.');
    }
    const suppliedToken = typeof token === 'string' && token.trim() ? token.trim() : null;
    const existing = suppliedToken ? this.findByToken(suppliedToken) : null;

    if (existing && existing.tag === normalized) {
      // Same tag + same token = resume this persistent identity.
      existing.online = true;
      existing.updatedAt = this.now();
      this._bump(true);
      return {
        ok: true,
        token: existing.token,
        player: joinPlayerSummary(existing),
        state: this.getState(),
        leaves: this.getLeaves(),
      };
    }
    // A different tag is a DIFFERENT identity: never rename/hijack the token's
    // existing player. Fall through and create a fresh player (new token/color/
    // zero score). The old identity stays intact for when that tag is used again.

    const clash = this.players.find((player) => player.tag === normalized);
    if (clash) return fail('TAG_IN_USE', 'That callsign is already held by another operator.');

    const now = this.now();
    const player = {
      id: randomPlayerId((id) => this.players.some((other) => other.id === id)),
      tag: normalized,
      color: this._nextColor(),
      token: crypto.randomUUID(),
      online: true,
      score: 0,
      facesHeld: 0,
      clicks: 0,
      breaks: 0,
      claims: 0,
      steals: 0,
      ores: 0,
      oreValue: 0,
      oreCounts: {},
      // Emergency supply bookkeeping: repeatable after the cooldown while parts are missing.
      suppliedPlanets: [],
      supplyDropAt: 0,
      createdAt: now,
      updatedAt: now,
      lastClickAt: null,
    };
    this.players.push(player);
    this._tokens.set(player.token, player);
    this._markDirty();
    this._bump(true);
    return {
      ok: true,
      token: player.token,
      player: joinPlayerSummary(player),
      state: this.getState(),
      leaves: this.getLeaves(),
    };
  }

  /** Mark a player online/offline (SSE connect/disconnect). */
  setOnline(playerId, online) {
    const player = this.players.find((entry) => entry.id === playerId);
    if (!player) return false;
    const next = !!online;
    if (player.online === next) return false;
    player.online = next;
    this._bump(true);
    return true;
  }

  onlineCount() {
    return this.players.reduce((count, player) => count + (player.online ? 1 : 0), 0);
  }

  // ------------------------------------------------------------------- clicks

  /**
   * Apply one click on a cell label.
   * @returns {object} `{ok:true,label,cell,points,kind,score,broke,children?}` or
   *                   `{ok:false,error,message}` with a SPEC section 2 error code.
   */
  click({ token, label } = {}) {
    const player = this.findByToken(token);
    if (!player) return fail('NOT_JOINED', 'Join with a valid token before clicking.');
    const parsed = parseWorldLabel(label);
    if (!parsed) return fail('INVALID_LABEL', 'Cell label must look like "7", "7.2" or "7.2.1".');
    const cell = this._leaves.get(parsed.label);
    if (!cell) return fail('NOT_A_LEAF', 'That cell is not an active leaf — reload the grid.');
    const now = this.now();
    if (player.lastClickAt !== null && now - player.lastClickAt < this.config.clickCooldownMs) {
      const waitMs = Math.max(1, this.config.clickCooldownMs - (now - player.lastClickAt));
      return fail('COOLDOWN', `Click cooldown: wait ${Math.ceil(waitMs)}ms.`);
    }

    const playerIndex = this.players.indexOf(player);

    // OWN-CELL LOCK: you cannot keep charging a cell whose most recent click
    // was yours. Someone else must contest it first. Robots are real operators
    // and are spawned/prioritised to break this lock; never allow solo farming.
    if (cell.ownerIndex === playerIndex && cell.lastClickIndex === playerIndex) {
      return fail('OWN_CELL_LOCKED', 'Another operator must contest this cell before you can charge it again.');
    }

    const previousOwner = cell.ownerIndex;
    let kind;
    let clickPoints;
    if (previousOwner === -1) {
      kind = 'claim';
      clickPoints = CLAIM_POINTS;
      player.claims += 1;
      player.facesHeld += 1;
    } else if (previousOwner === playerIndex) {
      kind = 'reinforce';
      clickPoints = REINFORCE_POINTS;
    } else {
      kind = 'steal';
      clickPoints = STEAL_POINTS;
      player.steals += 1;
      const victim = this.players[previousOwner];
      if (victim) victim.facesHeld = Math.max(0, victim.facesHeld - 1);
      player.facesHeld += 1;
    }

    cell.ownerIndex = playerIndex;
    cell.lastClickIndex = playerIndex;
    cell.clicks += 1;
    player.clicks += 1;
    player.score += clickPoints;
    player.updatedAt = now;
    player.lastClickAt = now;
    this.totalClicks += 1;

    // Hidden deposit discovery: only successful clicks mine (rejected/cooldown/
    // locked clicks never reach this point). Discovered forever, finder recorded.
    let minedResource = null;
    const findClick = cell.resourceFindClick || 1;
    if (cell.resourceId && !cell.resourceFound && cell.clicks >= findClick) {
      const resource = resourceById(cell.resourceId);
      if (resource) {
        cell.resourceFound = true;
        cell.foundByIndex = playerIndex;
        minedResource = resource;
        player.score += resource.value;
        player.ores += 1;
        player.oreValue += resource.value;
        player.oreCounts[resource.id] = (player.oreCounts[resource.id] || 0) + 1;
      }
    }

    let broke = false;
    let bonus = 0;
    let childCells = null;
    if (cell.clicks >= this.config.breakClicks && cell.depth < this.config.maxDepth) {
      broke = true;
      bonus = breakBonus(cell.depth);
      player.score += bonus;
      player.breaks += 1;
      // One leaf becomes four inherited leaves: +3 held faces for the breaker
      // (who owns the parent after this click).
      player.facesHeld += 3;
      this.totalBreaks += 1;
      childCells = this._breakCell(cell);
      this.maxDepthReached = Math.max(this.maxDepthReached, cell.depth + 1);
    }

    const cellWire = leafOf(cell);
    const childrenWire = childCells ? childCells.map(leafOf) : undefined;
    const resourceWire = minedResource ? publicResource(minedResource) : undefined;
    this._markDirty();
    this._bump(false);
    this._emit({
      type: 'cell',
      cell: cellWire,
      playerId: player.id,
      points: clickPoints,
      kind,
      broke,
    });
    if (broke) {
      this._emit({
        type: 'break',
        label: cell.label,
        depth: cell.depth,
        byPlayerId: player.id,
        points: bonus,
        children: childrenWire,
      });
    }
    if (resourceWire) {
      this._emit({
        type: 'resource',
        label: cell.label,
        resource: resourceWire,
        playerId: player.id,
        points: minedResource.value,
      });
    }

    const response = {
      ok: true,
      label: cell.label,
      cell: cellWire,
      // Total awarded by this action: click + break bonus + mined ore value.
      points: clickPoints + bonus + (minedResource ? minedResource.value : 0),
      kind,
      score: player.score,
      broke,
    };
    if (broke) response.children = childrenWire;
    if (resourceWire) response.resource = resourceWire;
    return response;
  }

  /** Subdivide a single leaf into its four labelled children. */
  _breakCell(cell) {
    const tris = childTriangles(cell.a, cell.b, cell.c);
    const children = tris.map((tri) =>
      this._createCell({
        label: `${cell.label}.${tri.labelNumber}`,
        depth: cell.depth + 1,
        a: tri.a,
        b: tri.b,
        c: tri.c,
        ownerIndex: cell.ownerIndex,
        clicks: 0,
        // Fresh children inherit the owner AND count as already clicked by
        // them, so the breaker cannot immediately chain-charge the children.
        lastClickIndex: cell.ownerIndex,
      }),
    );
    children.sort((p, q) => lastLabelPart(p.label) - lastLabelPart(q.label));
    cell.children = children;
    this._leaves.delete(cell.label);
    for (const child of children) this._leaves.set(child.label, child);
    this._faces += 3;
    return children;
  }

  // ------------------------------------------------------------------ reading

  _bump(urgent) {
    this.revision += 1;
    if (urgent) this._stateUrgent = true;
    return this.revision;
  }

  peekStateUrgent() {
    return this._stateUrgent;
  }

  clearStateUrgent() {
    this._stateUrgent = false;
  }

  drainEvents() {
    const events = this._events;
    this._events = [];
    return events;
  }

  _emit(event) {
    this._events.push(event);
  }


  // ------------------------------------------------------------ robot player

  /** Random float in [min, max] (order tolerant). */
  _randomBetween(min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const span = Math.max(0, hi - lo);
    return lo + this.rng() * span;
  }

  /** Fresh, unique, uppercase robot callsign (word + number, 2-12 chars). */
  _robotCallsign() {
    const pick = (arr) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(this.rng() * arr.length)))];
    const ADJ = [
      'VOID', 'NEON', 'IRON', 'ASH', 'DUST', 'CRYO', 'MAGMA', 'NOVA', 'ORBIT', 'RUST',
      'SLAG', 'HELIX', 'ION', 'ARC', 'XENO', 'QUASAR', 'LUNAR', 'SOLAR', 'CHROME', 'STATIC',
      'SABLE', 'AMBER', 'OBSIDIAN', 'CORE', 'GRID', 'NULL', 'PALE', 'GOLD', 'DEAD', 'HALO',
      'NEBULA', 'VEX', 'GLITCH', 'CELESTIAL', 'PRISM', 'EMBER', 'CIPHER', 'HOLO', 'OMEN',
    ];
    const ROLE = [
      'SAINT', 'WITCH', 'MONK', 'KID', 'PROPHET', 'DRIFTER', 'RIGGER', 'DIVER', 'DELVER',
      'MULE', 'JACK', 'HACKER', 'WRAITH', 'MIMIC', 'PILOT', 'GRIFTER', 'NOMAD', 'RAIDER',
      'MINER', 'BEAST', 'CULTIST', 'COURIER', 'BROKER', 'GHOST', 'SPECTER', 'BITER', 'SCOUT',
      'SALVAGER', 'HAUNT', 'HERETIC', 'ORACLE', 'SIREN', 'VIPER', 'REAPER', 'SQUATTER',
    ];
    const SINGLE = [
      'DRILLBEAST', 'OREFATHER', 'ROCKBITER', 'GRIDWALKER', 'VOIDMINER', 'NEBULAJACK',
      'MAGMAWITCH', 'QUARRYGHOST', 'SALVAGE_9', 'DEEPCORE', 'CRUSTCRAWLER', 'STARDUST',
      'HOLLOWSAINT', 'NULLRIGGER', 'GRIMPROSPECT', 'DUSTDELVER', 'IRONWIDOW',
    ];
    const HEX = '0123456789ABCDEF';
    const clean = (tag) => tag.replace(/[^A-Z0-9_-]/g, '').replace(/_+$/g, '');
    const num = () => 1 + Math.floor(this.rng() * 99);
    const make = () => {
      const mode = Math.floor(this.rng() * 12);
      let tag;
      if (mode < 4) {
        // Poetry: VOID_SAINT / MAGMA_MONK / RUST_PROPHET (or the reverse order).
        const a = pick(ADJ);
        const b = pick(ROLE);
        tag = this.rng() < 0.72 ? `${a}_${b}` : `${b}_${a}`;
      } else if (mode < 6) {
        // Frontier worker handles: HACKER41, ORACLE_7, VIPER_73 …
        const role = pick(ROLE);
        tag = this.rng() < 0.35 ? `${role}_${num()}` : `${role}${num()}`;
      } else if (mode === 6) {
        // Cryptic hexadecimal handles: 0XDEAD / 0X7F3A / 0X013B.
        let hex = '';
        for (let i = 0; i < 4; i += 1) hex += HEX[Math.floor(this.rng() * HEX.length)];
        tag = `0X${hex}`;
      } else if (mode < 9) {
        // Curated frontier callsigns.
        tag = pick(SINGLE);
        if (this.rng() < 0.25) tag = `${tag}${num()}`;
      } else if (mode === 9) {
        // Fused title: VOIDSAINT, NEONMONK, GOLDREAPER (no separator).
        tag = `${pick(ADJ)}${pick(ROLE)}`;
      } else {
        // Numeric prospector: ORBIT_42, ASH_7 …
        tag = `${pick(ADJ)}_${num()}`;
      }
      return clean(tag);
    };
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const tag = make();
      // Never truncate a word — only accept complete callsigns inside the grammar.
      if (tag.length < 2 || tag.length > 12) continue;
      if (!this.players.some((player) => player.tag === tag)) return tag;
    }
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const tag = `0X${Math.floor(this.rng() * 0xfffff).toString(16).toUpperCase().padStart(5, '0')}`;
      if (tag.length <= 12 && !this.players.some((player) => player.tag === tag)) return tag;
    }
    let counter = 1;
    while (this.players.some((player) => player.tag === `NULL_${counter}`)) counter += 1;
    return `NULL_${counter}`;
  }

  /** First active robot info (compat helper) or null. */
  robotInfo() {
    return this._robots.length ? { playerId: this._robots[0].playerId, tag: this._robots[0].tag } : null;
  }

  /** All active robot infos (diagnostics/tests/metrics). */
  robotInfos() {
    return this._robots.map((robot) => ({
      playerId: robot.playerId,
      tag: robot.tag,
      state: robot.route ? robot.route.state : null,
      replans: robot.replans || 0,
      digest: routeDigest(robot.route),
    }));
  }

  isRobotId(playerId) {
    return this._robotIds.has(playerId);
  }

  /** Connected humans only — robots never count as humans. */
  onlineHumanCount() {
    let count = 0;
    for (const player of this.players) {
      if (player.online && !this._robotIds.has(player.id)) count += 1;
    }
    return count;
  }

  /** Desired number of robots in this scene (manager recomputes each tick). */
  setRobotTarget(count) {
    const desired = this.config.bots <= 0 ? 0 : Math.max(0, Math.min(8, Math.trunc(Number(count) || 0)));
    this._robotTarget = desired;
    this._applyStaffing(this.now());
    return this._robots.length;
  }

  /** Spawn/remove robots immediately to hit the current target (no gap). */
  _applyStaffing(now) {
    if (this._closed) return;
    if (this.config.bots <= 0) this._robotTarget = 0;
    const target = Math.max(0, Math.min(8, Math.trunc(this._robotTarget)));
    let guard = 0;
    while (this._robots.length > target && guard < 20) {
      guard += 1;
      this._leaveRobot(this._robots[this._robots.length - 1], now);
    }
    guard = 0;
    while (this._robots.length < target && guard < 20) {
      guard += 1;
      if (!this._spawnRobot(now)) break;
    }
  }

  _spawnRobot(now) {
    const tag = this._robotCallsign();
    const joined = this.join({ tag });
    if (!joined.ok) return false;
    const player = this.findByToken(joined.token);
    if (!player) return false;
    const serial = this._robotSerial;
    this._robotSerial += 1;
    const robot = {
      playerId: player.id,
      token: player.token,
      tag: player.tag,
      index: this.players.indexOf(player),
      serial,
      replans: 0,
      route: null,
      nextClickAt: now + this._randomBetween(this.config.botClickMinMs, this.config.botClickMaxMs),
      nextLeaveAt: now + this._randomBetween(this.config.botMinMs, this.config.botMaxMs),
    };
    this._robots.push(robot);
    this._robotIds.add(player.id);
    this._ensureRobotPose(robot, now);
    this._planRoute(robot, now, this._routeSeed(serial), 'spawn');
    this._emit({ type: 'toast', message: `OPERATOR ${player.tag} LINKED`, kind: 'info' });
    return true;
  }

  _leaveRobot(robot, now) {
    if (!robot) return;
    const index = this._robots.indexOf(robot);
    if (index === -1) return;
    this._robots.splice(index, 1);
    this._robotIds.delete(robot.playerId);
    this.setOnline(robot.playerId, false);
    this.clearSurfacePose(robot.playerId, 'robot');
    robot.route = null;
    this._emit({ type: 'toast', message: `${robot.tag} LEFT`, kind: 'info' });
    // If a human is waiting for a chair, _applyStaffing() refills immediately.
    void now;
  }

  // ---------------------------------------- robot surface routes (SRV-02/03)

  /** Deterministic route seed: hash32(planetSeed, planetIndex, spawnSerial). */
  _routeSeed(serial) {
    return hash32(this.planetSeed, this.planetIndex, serial);
  }

  /** Seeded spawn pose, used before the first route exists. */
  _ensureRobotPose(robot, now) {
    const existing = this._poses.get(robot.playerId);
    if (existing) return existing;
    const rng = mulberry32(this._routeSeed(robot.serial));
    const pos = seededUnit(rng);
    const heading = vtangent(pos, seededUnit(rng));
    return this._applyRobotPose(robot, pos, heading, 'idle', now);
  }

  /** Write the robot's authoritative pose; the wire shape is shared with humans. */
  _applyRobotPose(robot, pos, heading, state, now) {
    const player = this.players[robot.index];
    if (!player) return null;
    const unit = vnorm(pos);
    const cell = this.resolveLeaf(unit);
    if (!cell) return null;
    const basis = this._chartBasis(cell);
    let tangent = vtangent(unit, heading || basis.east);
    if (Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-9) tangent = basis.east;
    return this._writeSurfacePose(
      player,
      {
        unit,
        cell,
        heading: tangent,
        bearingRad: bearingOf(tangent, basis),
        state,
        moving: state === 'walk' || state === 'turn',
        local: chartLocal(unit, basis),
      },
      now,
    );
  }

  /** Interior standing point for a route waypoint: 40% of the inradius. */
  _interiorPoint(cell, rng, factor = 0.4) {
    const inradius = this._inradius(cell);
    const basis = this._chartBasis(cell);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const radius = inradius * factor * Math.sqrt(rng());
      const angle = rng() * TAU;
      const point = vnorm(
        vadd(basis.c, vadd(vmul(basis.east, Math.cos(angle) * radius), vmul(basis.north, Math.sin(angle) * radius))),
      );
      const leaf = this.resolveLeaf(point);
      if (leaf && leaf.label === cell.label) return point;
    }
    return basis.c;
  }

  /**
   * Re-plan one robot's route from its seed alone (SRV-02). Candidate leaves are
   * active, within `ROUTE_RADIUS_RAD` of the robot and not locked to it; order is
   * the stable label order, then a seeded sample without replacement. No human
   * pose is read, so humans joining or leaving cannot change a route.
   */
  _planRoute(robot, now, seed, reason = 'spawn') {
    const nextSeed = seed >>> 0;
    const rng = mulberry32(nextSeed);
    const pose = this._ensureRobotPose(robot, now);
    const origin = pose ? pose.pos : seededUnit(mulberry32(nextSeed));
    const ownLocked = (cell) => cell.ownerIndex === robot.index && cell.lastClickIndex === robot.index;
    let pool = [...this._leaves.values()]
      .filter((cell) => vdot(cell.centroid, origin) > Math.cos(ROUTE_RADIUS_RAD))
      .filter((cell) => !ownLocked(cell))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (!pool.length) {
      // Blocked: fall back to the four largest centroid dots, then idle.
      pool = [...this._leaves.values()]
        .sort((a, b) => vdot(b.centroid, origin) - vdot(a.centroid, origin) || a.label.localeCompare(b.label))
        .slice(0, 4);
    }
    const candidates = [...pool];
    const wanted = 1 + Math.floor(rng() * ROUTE_MAX_WAYPOINTS);
    const waypoints = [];
    let arcTotal = 0;
    let lastPos = origin;
    for (let attempt = 0; attempt < candidates.length * 2 && waypoints.length < wanted; attempt += 1) {
      if (!candidates.length) break;
      const pickIndex = Math.floor(rng() * candidates.length);
      const cell = candidates[pickIndex];
      const point = this._interiorPoint(cell, rng);
      const arc = Math.acos(clamp(vdot(lastPos, point), -1, 1));
      // Bound the planned path so route duration is predictable.
      if (waypoints.length > 0 && arcTotal + arc > ROUTE_MAX_ARC) continue;
      candidates.splice(pickIndex, 1);
      waypoints.push({ leaf: cell.label, pos: point, arriveAt: 0 });
      arcTotal += arc;
      lastPos = point;
    }
    // Predictable arrival timestamps from arc length (fixed step per tick).
    let cursor = now;
    let from = origin;
    for (const waypoint of waypoints) {
      const arc = Math.acos(clamp(vdot(from, waypoint.pos), -1, 1));
      cursor += Math.max(POSE_FRAME_INTERVAL_MS, Math.ceil(arc / STEP_RAD) * POSE_FRAME_INTERVAL_MS);
      waypoint.arriveAt = cursor;
      from = waypoint.pos;
    }
    if (reason !== 'spawn') robot.replans = (robot.replans || 0) + 1;
    const heading = waypoints[0] ? vtangent(origin, sub(waypoints[0].pos, origin)) : null;
    const route = {
      playerId: robot.playerId,
      seed: nextSeed,
      serial: robot.serial,
      waypoints,
      index: 0,
      state: 'idle',
      stateSince: now,
      stateUntil: now + ROBOT_IDLE_DWELL_MS + Math.floor(rng() * 600),
      intent: { kind: 'travel', leaf: waypoints[0] ? waypoints[0].leaf : null },
      replans: robot.replans || 0,
      plannedAt: now,
      lastTickAt: now,
    };
    robot.route = route;
    this._applyRobotPose(
      robot,
      origin,
      heading && Math.hypot(heading.x, heading.y, heading.z) > 1e-9 ? heading : null,
      'idle',
      now,
    );
    return route;
  }

  _replanRobot(robot, now, reason) {
    const route = robot.route;
    const seed = ((route ? route.seed : this._routeSeed(robot.serial)) + 1) >>> 0;
    return this._planRoute(robot, now, seed, reason);
  }

  /** Current route waypoint (task target), or null. */
  _robotRouteTarget(robot) {
    const route = robot.route;
    if (!route || !route.waypoints.length) return null;
    return route.waypoints[Math.min(route.index, route.waypoints.length - 1)] || null;
  }

  /** Advance one robot one tick: turn/walk toward the waypoint, idle, mine. */
  _advanceRobotRoute(robot, now) {
    if (!robot) return false;
    let route = robot.route;
    if (!route) route = this._planRoute(robot, now, this._routeSeed(robot.serial), 'spawn');
    if (!route) return false;
    if (now - route.plannedAt > ROUTE_TTL_MS) {
      this._replanRobot(robot, now, 'ttl');
      return true;
    }
    if (!route.waypoints.length) {
      if (now - route.stateSince > ROBOT_IDLE_DWELL_MS) this._replanRobot(robot, now, 'blocked');
      return true;
    }
    const work = route.waypoints[Math.min(route.index, route.waypoints.length - 1)];
    if (!work || !this._leaves.has(work.leaf)) {
      this._replanRobot(robot, now, 'stale_leaf');
      return true;
    }
    let pose = this._poses.get(robot.playerId);
    if (!pose) pose = this._ensureRobotPose(robot, now);
    if (!pose) return false;
    const dtSec = clamp((now - (route.lastTickAt || now)) / 1000, 0, 0.25);
    route.lastTickAt = now;

    if (route.state === 'mine') {
      if (now < (route.stateUntil || 0)) return true;
      route.index = Math.min(route.index + 1, route.waypoints.length);
      if (route.index >= route.waypoints.length) {
        this._replanRobot(robot, now, 'complete');
        return true;
      }
      route.state = 'idle';
      route.stateSince = now;
      route.stateUntil = now + ROBOT_IDLE_DWELL_MS;
      route.intent = { kind: 'travel', leaf: route.waypoints[route.index].leaf };
      return true;
    }
    if (route.state === 'idle') {
      if (now < (route.stateUntil || 0)) return false;
      route.state = 'turn';
      route.stateSince = now;
      return true;
    }

    // Turn toward the waypoint within the rate limit, then step when aligned.
    const desired = vtangent(pose.pos, sub(work.pos, pose.pos));
    const delta = Math.atan2(vdot(vcross(pose.heading, desired), pose.pos), vdot(pose.heading, desired));
    const maxTurn = Math.max(0.0005, TURN_RATE_RAD_S * Math.max(dtSec, 0.001));
    if (Math.abs(delta) > maxTurn) {
      const clamped = Math.sign(delta) * maxTurn;
      const heading = vtangent(
        pose.pos,
        vadd(vmul(pose.heading, Math.cos(clamped)), vmul(vcross(pose.pos, pose.heading), Math.sin(clamped))),
      );
      this._applyRobotPose(robot, pose.pos, heading, 'turn', now);
      route.state = 'turn';
      return true;
    }
    const stepped = vstep(pose.pos, desired, STEP_RAD);
    const heading = vtangent(stepped.pos, stepped.forward);
    this._applyRobotPose(robot, stepped.pos, heading, 'walk', now);
    route.state = 'walk';
    if (vdot(stepped.pos, work.pos) > Math.cos(ARRIVE_RAD)) {
      // Arrived: pause, then try the authoritative click on this very cell.
      route.state = 'idle';
      route.stateSince = now;
      route.stateUntil = now + ROBOT_IDLE_DWELL_MS;
      this._robotClick(robot, now);
      if (robot.route !== route) return true;
      if (route.state === 'idle' && route.index < route.waypoints.length) {
        route.index += 1;
        if (route.index >= route.waypoints.length) {
          this._replanRobot(robot, now, 'complete');
          return true;
        }
        route.intent = { kind: 'travel', leaf: route.waypoints[route.index].leaf };
      }
    }
    return true;
  }

  /**
   * One robot click (SRV-03): resolve the leaf under the authoritative pose,
   * convert a mismatched intent to `travel`, click through `WorldCore.click()`
   * with the robot's own token, and emit `surface_mine` only for an awarded
   * click. Events are queued after `click()`'s cell/break frames, so a beam
   * never precedes the mutation it names.
   */
  _robotClick(robot, now) {
    if (!robot || !this._robots.includes(robot)) return;
    const route = robot.route;
    const pose = this._poses.get(robot.playerId) || this._ensureRobotPose(robot, now);
    const cell = pose ? this.resolveLeaf(pose.pos) : null;
    if (cell) {
      const target = this._robotRouteTarget(robot);
      if (target && target.leaf !== cell.label) {
        if (route) route.intent = { kind: 'travel', leaf: target.leaf };
      } else {
        if (route) route.intent = { kind: 'mine', leaf: cell.label };
        const clicked = this.click({ token: robot.token, label: cell.label });
        if (clicked && clicked.ok) {
          const player = this.players[robot.index];
          this._emit({
            type: 'surface_mine',
            playerId: robot.playerId,
            tag: robot.tag,
            color: (player && player.color) || '#a78bfa',
            label: cell.label,
            pos: { ...pose.pos },
            resourceId: clicked.resource ? clicked.resource.id : null,
            points: clicked.points,
            kind: clicked.kind,
            broke: !!clicked.broke,
            rev: pose.rev,
          });
          if (route) {
            route.state = 'mine';
            route.stateSince = now;
            route.stateUntil = now + ROBOT_MINE_DWELL_MS;
            this._applyRobotPose(robot, pose.pos, pose.heading, 'mine', now);
          }
        } else {
          this._robotMineRejected += 1;
          this._replanRobot(robot, now, 'blocked');
        }
      }
    }
    // Advance on the scheduled cadence (not "now"), so a slow pump/tick catch-up
    // performs every due click instead of collapsing them into one.
    const cadence = this._randomBetween(this.config.botClickMinMs, this.config.botClickMaxMs);
    robot.nextClickAt = Math.max(robot.nextClickAt + Math.max(1, cadence), robot.nextClickAt + 1);
  }

  /** Route digest for one live robot (SRV-02 determinism evidence), or null. */
  robotRouteDigest(playerId) {
    const robot = this._robots.find((entry) => entry.playerId === playerId);
    return robot ? routeDigest(robot.route) : null;
  }

  /** Number of re-plans across this planet's robots (metrics). */
  get robotReplanCount() {
    return this._robots.reduce((total, robot) => total + (robot.replans || 0), 0);
  }

  /** Rejected robot mining clicks (metrics). */
  get robotMineRejectedCount() {
    return this._robotMineRejected;
  }

  /** Emergency-supply drops placed on this planet (metrics). */
  get supplyDropCount() {
    return this._supplyDrops;
  }

  /**
   * Advance robot staffing + every robot's lifetime/route/click cadence.
   *
   * No spawn gap: `_applyStaffing()` runs before and after the per-robot work,
   * so a departure (lifetime expiry, human joining, escape) is replaced in the
   * same tick. The manager calls `setRobotTarget()` each tick from the online
   * human count; standalone users can call it too.
   */
  tick(now = this.now()) {
    if (this._closed) return this._events;
    const t = Number.isFinite(now) ? now : this.now();
    if (this.config.bots <= 0) {
      this._robotTarget = 0;
      this._applyStaffing(t);
      return this._events;
    }
    this._applyStaffing(t);
    for (const robot of [...this._robots]) {
      if (!this._robots.includes(robot)) continue;
      if (t >= robot.nextLeaveAt) {
        this._leaveRobot(robot, t);
        continue;
      }
      this._advanceRobotRoute(robot, t);
      let guard = 0;
      while (robot.nextClickAt <= t && guard < 50 && this._robots.includes(robot)) {
        guard += 1;
        this._robotClick(robot, t);
      }
    }
    this._applyStaffing(t);
    return this._events;
  }

  /** Stop robot activity and clear transient surface state (shutdown / tests). */
  stop() {
    this._closed = true;
    for (const robot of [...this._robots]) this.clearSurfacePose(robot.playerId, 'robot');
    this._robots = [];
    this._robotIds.clear();
    this._robotTarget = 0;
    this._clearAllPoses('reset');
    this._focus = null;
  }

  // ---------------------------------------------------- planets / meteor

  /** Count active leaves that still hide an undiscovered deposit. */
  hiddenDepositCount() {
    let count = 0;
    for (const cell of this._leaves.values()) {
      if (cell.resourceId && !cell.resourceFound) count += 1;
    }
    return count;
  }

  _refreshMeteorArming() {
    this._meteorArmed = this.hiddenDepositCount() > 0;
    return this._meteorArmed;
  }

  /**
   * Reset the grid of THIS planet (used by the meteor event): fresh base 20
   * cells, new hidden deposits (new terrain seed when provided), players and
   * their scores/ores/oreCounts are preserved; ownership/faces reset.
   */
  resetGrid({ newSeed = null, mission = null } = {}) {
    if (Number.isInteger(newSeed) && newSeed >= 0 && newSeed <= 0xffffffff) this.planetSeed = newSeed >>> 0;
    this.terrainVersion = PLANET_VERSION;
    this.maxDepthReached = 0;
    this._resetTree();
    // Every label is replaced: transient poses and the supply focus die with the
    // old grid, and every robot re-plans against the new one in this call.
    this._clearAllPoses('reset');
    this._focus = null;
    for (const robot of [...this._robots]) {
      robot.route = null;
      this._planRoute(robot, this.now(), this._routeSeed(robot.serial), 'stale_leaf');
    }
    if (mission) this.ensureMissionDeposits(mission);
    this._recountFacesHeld();
    this._bump(true);
    this._markDirty();
    return this;
  }

  /**
   * Meteor / catastrophe reset. When every hidden deposit has been mined (armed
   * transition >0 -> 0) or the refit is complete, resample the planet seed,
   * reset the grid and advance the deterministic per-planet kind rotation.
   *
   * EVT-01 guarantees:
   * - `_incidentCycle` persists (serialized as `incidentCycle`) and advances
   *   exactly once per fired incident, so four consecutive incidents cover
   *   meteor, nuclear, solar and alien in order;
   * - arming is cleared before `resetGrid` and re-derived afterwards, so a
   *   zero-deposit grid can never fire twice back to back;
   * - `forcedKind` (development trigger) emits the same payload as play and
   *   still advances the rotation; an unknown kind is a no-op (null, no advance).
   */
  maybeMeteor({ missionReady = false, forcedKind = null } = {}) {
    if (!this._meteorArmed) return null;
    // End-of-crust, or the refit mission is complete while extra deposits remain:
    // otherwise mission/supply deposits can keep incidents unreachable forever.
    if (this.hiddenDepositCount() > 0 && !missionReady) return null;
    let incident;
    if (forcedKind !== null && forcedKind !== undefined) {
      // Development trigger: unknown kinds never advance the cycle or the world.
      if (!isIncidentKind(forcedKind)) return null;
      incident = INCIDENTS.find((entry) => entry.kind === forcedKind);
    } else {
      incident = INCIDENTS[this._incidentCycle % INCIDENTS.length];
    }
    if (!incident) return null;
    this._incidentCycle = (this._incidentCycle + 1) % INCIDENTS.length;
    this._meteorArmed = false; // no second fire without a fresh re-arm
    this.resetGrid({ newSeed: randomPlanetSeed() });
    this._refreshMeteorArming(); // explicit re-arm against the reseeded crust
    this._markDirty(); // persist the advanced rotation even with autoSave off
    return {
      triggered: true,
      event: {
        type: 'incident',
        kind: incident.kind,
        title: incident.title,
        tone: incident.tone,
        message: incident.message,
        description: incident.description,
        // Additive (EVT-01/EVT-03): a stable per-fire revision lets clients
        // dedupe an announcement replayed after an SSE reconnect.
        revision: this.revision,
      },
      incidentCycle: this._incidentCycle,
      state: this.getState(),
      leaves: this.getLeaves(),
    };
  }

  /**
   * Adopt an existing pilot onto a new planet (escape): same tag/colour/token
   * and carried score, but a clean run (ores/oreCounts/faces reset). Tag
   * conflicts get a numeric suffix.
   */
  adoptPlayer({ tag, token, color, score, id, ores = 0, oreValue = 0, oreCounts = {}, suppliedPlanets = [] } = {}) {
    const normalized = normalizeTag(tag) || 'PILOT';
    let uniqueTag = normalized;
    if (this.players.some((player) => player.tag === uniqueTag)) {
      const base = normalized.slice(0, 9);
      let suffix = 2;
      while (this.players.some((player) => player.tag === uniqueTag)) {
        uniqueTag = `${base}_${suffix}`.slice(0, 12);
        suffix += 1;
        if (suffix > 999) {
          uniqueTag = `PILOT${suffix}`.slice(0, 12);
        }
      }
    }
    const now = this.now();
    const playerId =
      typeof id === 'string' && id.trim() && !this.players.some((player) => player.id === id)
        ? id.trim()
        : randomPlayerId((candidate) => this.players.some((player) => player.id === candidate));
    const suppliedToken = typeof token === 'string' && token.trim() ? token.trim() : null;
    const player = {
      id: playerId,
      tag: uniqueTag,
      color: isHexColor(color) ? color : randomPlayerColor(),
      token: suppliedToken && !this._tokens.has(suppliedToken) ? suppliedToken : crypto.randomUUID(),
      online: true,
      score: Number.isFinite(score) ? Math.max(0, Math.trunc(score)) : 0,
      facesHeld: 0,
      clicks: 0,
      breaks: 0,
      claims: 0,
      steals: 0,
      // Escaping carries the full ore inventory (usable for the next mission).
      ores: Number.isFinite(ores) ? Math.max(0, Math.trunc(ores)) : 0,
      oreValue: Number.isFinite(oreValue) ? Math.max(0, Math.trunc(oreValue)) : 0,
      oreCounts: sanitizeOreCounts(oreCounts),
      suppliedPlanets: Array.isArray(suppliedPlanets)
        ? [...new Set(suppliedPlanets.filter((value) => Number.isInteger(value) && value >= 0))]
        : [],
      supplyDropAt: 0,
      createdAt: now,
      updatedAt: now,
      lastClickAt: null,
    };
    this.players.push(player);
    this._tokens.set(player.token, player);
    this._markDirty();
    this._bump(true);
    return {
      ok: true,
      token: player.token,
      player: { id: player.id, tag: player.tag, color: player.color },
      state: this.getState(),
      leaves: this.getLeaves(),
    };
  }

  /** Top 20 arcade entries by score desc (ties: facesHeld, breaks, tag). */
  getLeaderboard(limit = 20) {
    const entries = this.players.map((player) => ({
      tag: player.tag,
      score: player.score,
      facesHeld: player.facesHeld,
      breaks: player.breaks,
      updatedAt: player.updatedAt,
    }));
    entries.sort(
      (a, b) =>
        b.score - a.score ||
        b.facesHeld - a.facesHeld ||
        b.breaks - a.breaks ||
        String(a.tag).localeCompare(String(b.tag)),
    );
    return entries.slice(0, Math.max(0, limit));
  }

  getState() {
    return {
      serverTime: this.now(),
      resources: RESOURCE_MARKET,
      planetSeed: this.planetSeed,
      terrainVersion: this.terrainVersion,
      threshold: this.config.breakClicks,
      maxDepth: this.config.maxDepth,
      maxDepthReached: this.maxDepthReached,
      faces: this._faces,
      totalClicks: this.totalClicks,
      totalBreaks: this.totalBreaks,
      createdAt: this.createdAt,
      players: this.players.map((player) => publicPlayerFields(player, this._poses.get(player.id))),
      humansOnline: this.onlineHumanCount(),
      arcade: this.getLeaderboard(20),
    };
  }

  /** Active leaves, deterministic depth-first label order. */
  getLeaves() {
    const out = [];
    const walk = (cell) => {
      if (cell.children) {
        for (const child of cell.children) walk(child);
        return;
      }
      out.push(leafOf(cell));
    };
    for (const root of this._baseCells) walk(root);
    return out;
  }

  /** Active leaves keyed by label (read-only diagnostic / tests). */
  getLeafMap() {
    return new Map(this._leaves);
  }

  get leafCount() {
    return this._faces;
  }

  /** EVT-01: this planet's deterministic incident rotation index (0..3). */
  get incidentCycle() {
    return this._incidentCycle;
  }

  health() {
    return {
      uptimeMs: Math.max(0, this.now() - this._startedAt),
      playersOnline: this.onlineCount(),
      faces: this._faces,
      maxDepthReached: this.maxDepthReached,
      totalClicks: this.totalClicks,
    };
  }
}

export default WorldCore;
