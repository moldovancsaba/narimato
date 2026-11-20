/**
 * NARIMATO — INFINITE GRID renderer.
 *
 * Neon hologram renderer for the persistent adaptive icosahedron: a mixed-depth
 * tree of active leaves (any cell may break individually into four children at
 * any depth). One frame per `render(camera, timeMs)` call — the app owns RAF.
 *
 * Public API (per SPEC_INFINITE section 3):
 *   setPlayers(players, myPlayerId)
 *   setFaces(faces)                 mixed-depth leaves
 *   updateCell(label, ownerIndex, clicks)
 *   replaceFace(label, children)    incremental break (shatter + pop-in)
 *   setConfig({ threshold, maxDepth })
 *   setHover(label | null)
 *   setLabelsVisible(boolean)
 *   pulse(label, { color, kind, text })   kind: claim|steal|reinforce|break|resource
 *   discoverResource(label, resourceId)   instant discovered-ore marker + burst
 *   render(camera, timeMs)
 *   resize()
 *
 * Discovered ore: faces may carry `resourceId` (server sends it only after the
 * deposit has been mined). Hidden deposits carry no resourceId, so hidden cells
 * render exactly like empty ones. Discovered cells get a small resource-coloured
 * diamond + glyph at their centroid, LOD-capped so dense worlds stay clean.
 *
 * Planet surface: faces may carry `terrain: { biome:{id,name,color,mineable},
 * elevation, temperature, mineable }` (derived client-side from the shared
 * planet seed). Terrain is painted as a low-poly biome underlay beneath the
 * ownership tint; faceless/terrain-less faces keep the plain hologram styling.
 *
 * Design notes:
 * - Geodesic edges are cached per label as slerp-sampled great-circle arcs, with
 *   the sample count chosen by depth (dense at the base, cheap deeper). The cache
 *   is keyed by the stable hierarchical label.
 * - Per frame each leaf is culled in 3D with a conservative view-cone test before
 *   any projection work, then projected only if it can touch the viewport. This
 *   keeps deep zoom (camera zoom up to 4096) cheap: only the handful of cells
 *   under the crosshair are drawn.
 * - Faces are depth sorted (far → near) and drawn as translucent holographic
 *   fills; edges are batched by owner + depth bucket + depth tier and fake-bloomed
 *   with double strokes (no per-face shadowBlur).
 * - No rounds, no timers, no global surge flashes in this mode. Break juice is
 *   local to the broken cell and its new children.
 */

import {
  SPHERE_SCREEN_FRACTION,
  CAMERA_DISTANCE,
  latLonToVec,
  normalize,
  slerp,
  getMesh,
} from './shared/geometry.js';
import { resourceById } from './shared/resources.js';
import { BIOMES } from './shared/planet.js';
import { LiveSurfaceStore } from './shared/live-surface-mesh.js';
import { drawTetraShip } from './shared/tetra-ship.js';
import { createFrameBudget, detectDeviceClass, parsePinnedTier, qualityWorkScale } from './perf-budget.js';

/**
 * RND-05 humanoid rig module, loaded lazily (PERF-01 first-load budget): the
 * figures only exist on the surface, so the closed-triangle rig is a dynamic
 * import set through `setHumanoidModule()` instead of first-load JavaScript.
 */
let HUMAN_MODULE = null;

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const FONT_STACK = '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace';

/**
 * CTL-02: renderer truth bounds. Every projected sample is clamped to
 * ±OVERSCAN·max(W,H) so a silhouette point can never produce an unbounded
 * bbox/streak, and samples closer than NEAR_EPS to the camera are skipped
 * instead of being mirrored as a fake back band.
 */
export const NEAR_EPS = 1e-3;
export const OVERSCAN = 4;

const CYAN = { r: 0, g: 240, b: 255 };
const MAGENTA = { r: 255, g: 43, b: 214 };
const WHITE = { r: 255, g: 255, b: 255 };
const VIOLET = { r: 138, g: 92, b: 255 };
const ACID = { r: 215, g: 255, b: 0 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;
// Vector helpers shared by the surface visual pass (RND-05/07).
const vnorm = (v) => {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};
const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vmul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = vnorm;
const add = vadd;
const sub = vsub;
const mul = vmul;
const dot = vdot;
const hexRgb = (hex) => {
  const v = String(hex || '').replace('#', '');
  if (v.length !== 6) return { r: 120, g: 120, b: 120 };
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
};
const mixRgb = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

/** Parse '#rgb' / '#rrggbb' / 'rgb(...)' into {r,g,b}; cyan fallback. */
function parseColor(value) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (s[0] === '#' && (s.length === 4 || s.length === 7)) {
      const hex = s.length === 4 ? s.slice(1).split('').map((ch) => ch + ch).join('') : s.slice(1);
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    }
    const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return { r: clamp(+m[1], 0, 255), g: clamp(+m[2], 0, 255), b: clamp(+m[3], 0, 255) };
  }
  return CYAN;
}

/* ------------------------------------------------------------------ *
 * Static cartography
 * ------------------------------------------------------------------ */
const GRATICULE = (() => {
  const latCircles = [];
  for (const lat of [-60, -30, 0, 30, 60]) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 4) pts.push(latLonToVec(lat, lon));
    latCircles.push(pts);
  }
  const meridians = [];
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [];
    for (let lat = -88; lat <= 88; lat += 4) pts.push(latLonToVec(lat, lon));
    meridians.push(pts);
  }
  return { latCircles, meridians };
})();

const POLES = [
  { v: { x: 0, y: 1, z: 0 }, name: 'N', latLabel: '90.0000' },
  { v: { x: 0, y: -1, z: 0 }, name: 'S', latLabel: '-90.0000' },
];

const STAR_COLORS = ['#dff6ff', '#dff6ff', '#bfefff', '#00f0ff', '#8a5cff', '#ff2bd6', '#d7ff00'];

/** Geodesic edge samples per edge by cell depth. */
function segmentsForDepth(depth) {
  // Boundary sampling only: the cell geometry/set is unchanged. Close surface
  // cameras need enough samples for the same spherical triangles to read as
  // arcs instead of chords.
  if (depth <= 0) return 12;
  if (depth === 1) return 10;
  if (depth === 2) return 6;
  if (depth === 3) return 3;
  return 1;
}

const DEPTH_EDGE_SCALE = [1, 0.85, 0.7, 0.55];
const MAX_PULSES = 36;
const PULSE_DUR = { claim: 0.9, steal: 1.05, reinforce: 0.75, break: 1.3, resource: 1.5 };
const CHARGE_TIERS = 5;

/* ------------------------------------------------------------------ *
 * Surface visual contract (RND-07)
 * ------------------------------------------------------------------ */
/** Fixed interpolation delay: twice the 10 Hz surface broadcast period. */
const INTERP_DELAY_MS = 120;
/** Bound on drift for a peer that stops publishing. */
const MAX_EXTRAPOLATION_MS = 250;
const BEAM_TTL_MS = { mine: 900, break: 1400 };
const PEER_STALE_MS = 5000;
const PEER_FADE_MS = 300;
const MAX_PEER_SAMPLES = 8;
const MAX_BEAMS = 24;
const MAX_RESOURCE_PINS = 64;
const MINE_LIFT_MS = 140;
const MINE_HOLD_MS = 900;
/** Production rig scales: figure height stays inside 12–90 CSS px at L0. */
const SELF_RIG_SCALE = 0.0115;
const PEER_RIG_SCALE = 0.0105;

const nowLocal = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const slerpPos = (a, b, k) => (typeof slerp === 'function' ? slerp(a, b, k) : a);

export class IcosaRenderer {
  /** @param {HTMLCanvasElement} canvas fixed full-viewport #arena-canvas */
  constructor(canvas) {
    if (typeof canvas === 'string' && typeof document !== 'undefined') {
      canvas = document.querySelector(canvas);
    }
    this.canvas = canvas || null;
    this.ctx = this.canvas && typeof this.canvas.getContext === 'function'
      ? this.canvas.getContext('2d')
      : null;

    this.width = 1;
    this.height = 1;
    this.dpr = 1;

    // --- PERF-01 frame budget / quality ladder ------------------------
    // The renderer owns the rAF timestamp stream, so it can measure frame
    // deltas without an extra clock read per frame. A pinned `?quality=0|1|2`
    // disables adaptive tier changes for reproducible probes.
    const perfHints = typeof window !== 'undefined'
      ? {
          width: window.innerWidth,
          dpr: window.devicePixelRatio,
          hardwareConcurrency: window.navigator && window.navigator.hardwareConcurrency,
          deviceMemory: window.navigator && window.navigator.deviceMemory,
        }
      : {};
    this.perf = createFrameBudget({
      device: detectDeviceClass(perfHints),
      pinnedTier: parsePinnedTier(typeof window !== 'undefined' && window.location ? window.location.search : ''),
      now: () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()),
    });
    this._perfLastRenderAt = 0;
    this._perfDrawUnits = 0;
    this._workStars = 0;
    this._workMotes = 0;
    this._workDust = 0;

    // --- infinite world state -----------------------------------------
    this.players = [];
    this.myPlayerId = null;
    this.myIndex = -1;
    this.faces = []; // full-quality leaf entries
    this.byLabel = new Map(); // label -> entry
    // PERF-01 adaptive LOD: tier 1 draws a medium tessellation, tier 0 a
    // coarse one. Both are built from the same live leaves and carry the
    // source leaf label so owner/charge updates stay in sync.
    this._lodFaces = { 0: [], 1: [] };
    this._lodByLabel = { 0: new Map(), 1: new Map() };
    this.threshold = 8;
    this.maxDepth = 8;
    // Debug "show all ids" toggle (app L key). Off by default: ids are only
    // rendered for interactive/pulsed faces.
    this.labelsVisible = false;
    this.poleLabelsVisible = false;
    // RND-04: surface geometry is derived from the live World leaf list through
    // a revision-gated store; there is no cached seed-keyed globe.
    this.liveSurface = new LiveSurfaceStore({ colourOf: (leaf) => this._liveLeafColour(leaf) });
    this.liveSurfaceStats = null;
    this.surfaceView = false;
    // RND-02 single-scene surface mode: the renderer owns the entity pass and
    // the landing/leaving ship; the surface controller owns only pose + labels.
    this.surfaceMode = false;
    this.surfaceEntities = [];
    this.surfaceEffects = [];
    this.surfacePhase = 'walking';
    this.surfaceProgress = 1;
    this.opaqueSurface = false;
    // RND-07 surface visual state: authoritative peers, beams, pins. The
    // renderer owns interpolation and fades; app.js only forwards events.
    this.peerVisuals = new Map();
    this.beams = [];
    this.resourcePins = [];
    this._leafLabels = new Set();
    this._surfaceClock = { server: 0, local: 0 };
    this._renderLocalNow = 0;
    this._selfMineAt = null;
    this._avatarRig = null;
    this._peerRig = null;
    this._rigCounts = { l0: 0, l1: 0, l2: 0 };
    this.avatarScale = 1;
    this._surfaceVisual = {
      peers: 0,
      beams: 0,
      droppedBeams: 0,
      pins: 0,
      markers: 0,
      avatars: 0,
      interpolated: 0,
      triangles: 0,
    };
    this.materialProbe = false;
    this.planetTheme = null;
    this._surfaceCanvas = null;
    this._surfaceCtx = null;
    this.hoverLabel = null;
    this.waypointLabel = null;
    this.supplyMarkers = new Map();
    this._supplyUntil = 0;
    this.pulses = [];
    // label -> animation time of the last pulse, used for click-only ids.
    this._pulseLabels = new Map();
    this._labelTtl = 2.0;
    this._markerScratch = [];

    // --- animation clock ----------------------------------------------
    this.t = 0;
    this.lastRaw = 0;
    this.frame = 0;

    // --- preferences ---------------------------------------------------
    this.reducedMotion = false;
    this._mq = null;
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        this._mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.reducedMotion = !!(this._mq && this._mq.matches);
        if (this._mq && typeof this._mq.addEventListener === 'function') {
          this._mq.addEventListener('change', (ev) => {
            this.reducedMotion = !!(ev && ev.matches);
          });
        }
      }
    } catch (_) {
      /* ignore */
    }

    // --- scratch / caches ---------------------------------------------
    this._styles = null;
    this._stylesDirty = true;
    this._buckets = [];
    this._nearBreak = [];
    this._visList = new Int32Array(0);
    this._dotZ = new Float32Array(0);
    this._visCount = 0;
    // CTL-02 frame statistics (read-only mirror for tests/acceptance).
    this._stats = {
      visCount: 0,
      culled: 0,
      nearSkipped: 0,
      emptyFrames: 0,
      axis: [0, 0, 1],
    };
    this._tmpV = { x: 0, y: 0, z: 0 };
    this._scrPX = new Float32Array(64);
    this._scrPY = new Float32Array(64);
    this._scrPZ = new Float32Array(64);
    this._polyX = new Float32Array(160);
    this._polyY = new Float32Array(160);
    this._pexX = new Float32Array(160);
    this._pexY = new Float32Array(160);
    this._hoverX = new Float32Array(64);
    this._hoverY = new Float32Array(64);
    this._hoverNp = 0;
    this._hoverEntry = null;
    this._cage = null;

    // camera frame + cull data
    this._d = CAMERA_DISTANCE;
    this._R = 1;
    this._Kx = 0;
    this._Ky = 0;
    this._Kz = 1;
    this._cosA = 0;
    this._sinA = 1;
    this._cosGB = 0;
    this._sinGB = 1;
    this._zoom = 1;

    // backdrop caches
    this._backdropGrad = null;
    this._coreGrad = null;
    this._nebulaA = null;
    this._nebulaB = null;
    this._haloKey = '';
    this._haloGrad = null;
    this._vigGrad = null;
    this._sphereFxKey = '';
    this._sphereRim = null;
    this._sphereSheen = null;
    this._sphereShade = null;
    this._sphereDisc = null;
    this._sphereDiscKey = '';
    this._scanPattern = null;

    this._stars = null;
    this._starCount = 0;
    this._motes = [];
    this._dust = [];
    this._yawRef = null;
    this._pitchRef = 0;

    this.resize();
    this._rebuildStyles();
  }

  /* ================================================================ *
   * Public API — world
   * ================================================================ */

  /** @param {Array} players state.players; @param {string|null} myPlayerId */
  setPlayers(players, myPlayerId) {
    this.players = Array.isArray(players) ? players : [];
    this.myPlayerId = myPlayerId == null ? null : myPlayerId;
    this.myIndex = this.myPlayerId == null
      ? -1
      : this.players.findIndex((p) => p && p.id === this.myPlayerId);
    this._rebuildStyles();
  }

  /**
   * Replace the active leaf list (mixed depth). Entries are cached by label so
   * boundary tessellation is only computed once per label.
   * @param {Array<{label:string,a:object,b:object,c:object,ownerIndex:number,clicks:number,depth:number}>} faces
   */
  /** Apply a per-planet palette (from shared/planet-theme.js). */
  setPlanetTheme(theme) {
    this.planetTheme = theme && typeof theme === 'object' ? theme : null;
    // Colour is derived per leaf; invalidate so the next sync rebuilds the mesh.
    this.liveSurface.invalidate();
  }

  /**
   * RND-04: pass the authoritative live leaf list. Geometry is rebuilt at
   * frame preparation only when the world revision or planet seed changed.
   * @param {{leaves?:Array, revision?:number, seed?:number}} input
   */
  setLiveSurface(input = {}) {
    const next = input && typeof input === 'object' ? input : {};
    if (Array.isArray(next.leaves)) {
      this._leafLabels = new Set();
      for (const leaf of next.leaves) {
        if (leaf && typeof leaf.label === 'string') this._leafLabels.add(leaf.label);
      }
    }
    return this.liveSurface.setInput({
      leaves: Array.isArray(next.leaves) ? next.leaves : [],
      revision: Number.isInteger(next.revision) ? next.revision : 0,
      seed: Number(next.seed) >>> 0,
    });
  }

  /** Rebuild metrics for QA: revision, triangles, buckets, rebuild time, skips. */
  surfaceMeshStats() {
    this.liveSurfaceStats = this.liveSurface.stats();
    return this.liveSurfaceStats;
  }

  /** Colour of one leaf for the live mesh: terrain (same as the cell pass) + owner tint. */
  _liveLeafColour(entry) {
    if (!entry) return { r: 42, g: 92, b: 116 };
    let rgb = entry.terrainRgb || null;
    if (!rgb) {
      const terrain = entry.terrain;
      rgb = terrain && terrain.rgb ? terrain.rgb : { r: 42, g: 92, b: 116 };
    }
    if (entry.ownerIndex >= 0 && Array.isArray(this.players) && this.players[entry.ownerIndex]) {
      const ownerRgb = parseColor(this.players[entry.ownerIndex].color);
      rgb = mixRgb(rgb, ownerRgb, 0.22);
    }
    return rgb;
  }

  /** Use the existing cell/material pipeline from a close surface camera. */
  setSurfaceView(enabled) {
    this.surfaceView = !!enabled;
    if (!this.surfaceView) {
      this.surfaceMode = false;
      this.surfaceEntities = [];
      this.surfaceEffects = [];
    }
  }

  /**
   * Surface mode is a camera + control mode on this same renderer (RND-02).
   * The planet, cells, markers and labels keep their orbit pipeline; the
   * surface adds only the entity pass and the landing/leaving ship.
   * @param {{active?:boolean, entities?:Array, phase?:string, progress?:number, effects?:Array}} options
   */
  setSurfaceMode(options = {}) {
    const next = options && typeof options === 'object' ? options : {};
    this.surfaceMode = !!next.active;
    this.surfaceView = this.surfaceMode;
    this.surfaceEntities = this.surfaceMode && Array.isArray(next.entities) ? next.entities : [];
    this.surfaceEffects = this.surfaceMode && Array.isArray(next.effects) ? next.effects : [];
    this.surfacePhase = typeof next.phase === 'string' && next.phase ? next.phase : 'walking';
    this.surfaceProgress = Number.isFinite(next.progress) ? clamp(next.progress, 0, 1) : 1;
    return this;
  }

  setOpaqueSurface(enabled) {
    this.opaqueSurface = !!enabled;
  }

  /**
   * Replace the render tessellation. `options.lod` optionally supplies
   * `{0: coarseFaces, 1: mediumFaces}` used by the adaptive quality ladder.
   * Entries are rebuilt per list so each LOD has its own projection buffers.
   */
  setFaces(faces, options = {}) {
    const built = this._buildEntries(faces, this.byLabel);
    this.faces = built.faces;
    this.byLabel = built.map;
    const lod = options && options.lod && typeof options.lod === 'object' ? options.lod : {};
    for (const tier of [0, 1]) {
      const lodBuilt = this._buildEntries(Array.isArray(lod[tier]) ? lod[tier] : [], null);
      this._lodFaces[tier] = lodBuilt.faces;
      this._lodByLabel[tier] = lodBuilt.map;
    }
    if (this.hoverLabel && !this.byLabel.has(this.hoverLabel)) this.hoverLabel = null;
    this._ensureBuffers();
  }

  _buildEntries(faces, reuseMap) {
    const input = Array.isArray(faces) ? faces : [];
    const nextFaces = [];
    const nextMap = new Map();
    for (let i = 0; i < input.length; i++) {
      const f = input[i];
      if (!f || typeof f.label !== 'string') continue;
      let entry = reuseMap ? reuseMap.get(f.label) : null;
      if (!entry) entry = this._createEntry(f);
      entry.sourceLabel = typeof f.sourceLabel === 'string' ? f.sourceLabel : f.label;
      entry.ownerIndex = Number.isInteger(f.ownerIndex) ? f.ownerIndex : -1;
      entry.clicks = Number.isFinite(f.clicks) ? Math.max(0, Math.trunc(f.clicks)) : 0;
      entry.lastClickIndex = Number.isInteger(f.lastClickIndex) ? f.lastClickIndex : -1;
      this._setEntryResource(entry, f.resourceId);
      this._setEntryTerrain(entry, f.terrain);
      nextFaces.push(entry);
      nextMap.set(f.label, entry);
    }
    return { faces: nextFaces, map: nextMap };
  }

  /** Attach the lazily loaded RND-05 rig module; builds the shared rigs once. */
  setHumanoidModule(module) {
    if (!module || typeof module.buildRig !== 'function' || typeof module.drawRig !== 'function') return false;
    HUMAN_MODULE = module;
    this._rigCounts = {
      l0: module.TRIANGLE_COUNTS.L0,
      l1: module.TRIANGLE_COUNTS.L1,
      l2: module.TRIANGLE_COUNTS.L2,
    };
    this._avatarRig = module.buildRig(SELF_RIG_SCALE);
    this._peerRig = module.buildRig(PEER_RIG_SCALE);
    return true;
  }

  /**
   * RND-06 single-scene parity probe. When enabled, `render()` draws only the
   * live cell material (opaque biome fill, no post-processing) so the same cell
   * can be sampled in orbit and surface phases under identical conditions.
   * It is a measurement mode: production rendering is unchanged when off.
   */
  setMaterialProbe(enabled) {
    this.materialProbe = !!enabled;
    return this.materialProbe;
  }

  /** Draw the opaque cell material for the parity probe (back → front). */
  _drawMaterialProbe(ctx, camera, W, H) {
    const axis = typeof camera.viewAxis === 'function' ? camera.viewAxis() : null;
    const origin = camera && camera.origin ? camera.origin : axis;
    const surface = this.surfaceView;
    const candidates = this._probeList || (this._probeList = []);
    candidates.length = 0;
    for (let i = 0; i < this.faces.length; i += 1) {
      const entry = this.faces[i];
      if (!entry || !entry.terrainRgb) continue;
      const c = entry.centroid;
      if (!axis) {
        candidates.push(entry);
        continue;
      }
      const facing = c.x * axis.x + c.y * axis.y + c.z * axis.z;
      if (facing <= 0) continue;
      if (surface && origin) {
        const local = c.x * origin.x + c.y * origin.y + c.z * origin.z;
        if (local < 0.35) continue;
      }
      candidates.push(entry);
    }
    // Painter order far → near so a sampled centroid shows its own material.
    if (axis) {
      candidates.sort((left, right) => {
        const a = left.centroid;
        const b = right.centroid;
        return (a.x * axis.x + a.y * axis.y + a.z * axis.z) - (b.x * axis.x + b.y * axis.y + b.z * axis.z);
      });
    }
    for (let i = 0; i < candidates.length; i += 1) {
      const entry = candidates[i];
      if (!this._projectEntry(entry, camera, W, H)) continue;
      let np;
      if (entry.allFront) {
        np = entry.n;
      } else {
        np = this._clipEntryPoly(entry, camera, this._polyX, this._polyY);
      }
      if (np < 3) continue;
      ctx.beginPath();
      if (entry.allFront) {
        const px = entry.px;
        const py = entry.py;
        ctx.moveTo(px[0], py[0]);
        for (let k = 1; k < np; k += 1) ctx.lineTo(px[k], py[k]);
      } else {
        ctx.moveTo(this._polyX[0], this._polyY[0]);
        for (let k = 1; k < np; k += 1) ctx.lineTo(this._polyX[k], this._polyY[k]);
      }
      ctx.closePath();
      ctx.fillStyle = `rgb(${entry.terrainRgb.r},${entry.terrainRgb.g},${entry.terrainRgb.b})`;
      ctx.fill();
    }
  }

  /* ================================================================ *
   * Surface visual API (RND-07)
   * ================================================================ */

  /** Local monotonic clock (RAF time base) for surface visuals. */
  _localNow() {
    return nowLocal();
  }

  /** Renderer-owned server clock estimate from the last `setPeers` sample. */
  _serverNowAt(localNow) {
    const clock = this._surfaceClock;
    if (!(clock.server > 0)) return this.t * 1000;
    return clock.server + (localNow - clock.local);
  }

  _serverNow() {
    const local = this._renderLocalNow > 0 ? this._renderLocalNow : this._localNow();
    return this._serverNowAt(local);
  }

  /** First render-tessellation entry for a leaf label (`~<label>.0`). */
  _leafEntry(label) {
    if (typeof label !== 'string' || !label) return null;
    return this.byLabel.get(`~${label}.0`) || this.byLabel.get(label) || null;
  }

  /** Centroid of a live leaf, or null when the label no longer exists. */
  _leafCentroid(label) {
    if (typeof label !== 'string' || !label) return null;
    if (this._leafLabels.size && !this._leafLabels.has(label)) return null;
    const entry = this._leafEntry(label);
    return entry && entry.centroid ? entry.centroid : null;
  }

  hasLeaf(label) {
    if (typeof label !== 'string' || !label) return false;
    if (this._leafLabels.size) return this._leafLabels.has(label);
    return !!this._leafEntry(label);
  }

  /**
   * Authoritative peer poses from `surface` frames (`state.players[].surface`).
   * Samples are inserted in server-time order, de-duplicated and capped, so a
   * late/out-of-order frame can never rewind the body.
   * @param {Array<object>} peers
   * @param {number} [serverNow] server clock at the call (ms)
   * @returns {number} number of live peers
   */
  setPeers(peers, serverNow) {
    const list = Array.isArray(peers) ? peers : [];
    const server = Number.isFinite(serverNow) ? serverNow : Date.now();
    this._surfaceClock = { server, local: this._localNow() };
    let live = 0;
    for (const peer of list) {
      if (!peer) continue;
      const playerId = String(peer.playerId || peer.id || '');
      if (!playerId) continue;
      const surface = peer.surface && peer.surface.pos ? peer.surface : peer;
      const pos = surface.pos;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) continue;
      const state = typeof surface.state === 'string' ? surface.state : (peer.state || 'idle');
      const updatedAt = Number.isFinite(surface.updatedAt) ? surface.updatedAt : server;
      let visual = this.peerVisuals.get(playerId);
      if (!visual) {
        visual = {
          playerId,
          tag: String(peer.tag || playerId).slice(0, 14),
          color: typeof peer.color === 'string' ? peer.color : '#a78bfa',
          samples: [],
          lastSeenAt: 0,
          leaving: false,
          leaveAt: 0,
          mineAt: null,
          mineLabel: null,
        };
        this.peerVisuals.set(playerId, visual);
      }
      if (typeof peer.tag === 'string' && peer.tag) visual.tag = peer.tag.slice(0, 14);
      if (typeof peer.color === 'string' && peer.color) visual.color = peer.color;
      visual.leaving = false;
      visual.leaveAt = 0;
      visual.lastSeenAt = server;
      const heading = surface.heading && Number.isFinite(surface.heading.x)
        ? { x: Number(surface.heading.x), y: Number(surface.heading.y), z: Number(surface.heading.z) }
        : null;
      const sample = {
        pos: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) },
        heading,
        state,
        moving: !!surface.moving,
        updatedAt,
      };
      const samples = visual.samples;
      if (samples.length && samples[samples.length - 1].updatedAt === updatedAt) {
        samples[samples.length - 1] = sample;
      } else if (!samples.length || samples[samples.length - 1].updatedAt < updatedAt) {
        samples.push(sample);
        if (samples.length > MAX_PEER_SAMPLES) samples.splice(0, samples.length - MAX_PEER_SAMPLES);
      } else {
        // Out-of-order frame: insert at the right index, ignore exact dupes.
        let index = samples.length - 1;
        while (index > 0 && samples[index].updatedAt > updatedAt) index -= 1;
        if (samples[index].updatedAt !== updatedAt) samples.splice(index + 1, 0, sample);
        if (samples.length > MAX_PEER_SAMPLES) samples.splice(0, samples.length - MAX_PEER_SAMPLES);
      }
      live += 1;
    }
    this._surfaceVisual.peers = live;
    return live;
  }

  /** Fade a peer out on `surface_leave`; the visual is removed after 300 ms. */
  removePeer(playerId, serverNow) {
    const visual = this.peerVisuals.get(String(playerId || ''));
    if (!visual) return false;
    visual.leaving = true;
    visual.leaveAt = Number.isFinite(serverNow) ? serverNow : Date.now();
    return true;
  }

  /**
   * Authoritative mining beam from `surface_mine`. Returns false (and counts a
   * dropped beam) when the target leaf is absent from the live world, so no
   * line is ever drawn to a cell the server never changed.
   * @param {{playerId?:string,tag?:string,color?:string,toLeaf?:string,label?:string,
   *          pos?:object,kind?:'mine'|'break',startAt?:number,ttlMs?:number}} beam
   * @returns {boolean}
   */
  mineBeam(beam) {
    if (!beam || typeof beam !== 'object') return false;
    const toLeaf = typeof beam.toLeaf === 'string' ? beam.toLeaf : beam.label;
    if (!this.hasLeaf(toLeaf)) {
      this._surfaceVisual.droppedBeams += 1;
      return false;
    }
    const server = this._serverNow();
    const startAt = Number.isFinite(beam.startAt) ? beam.startAt : server;
    const kind = beam.kind === 'break' ? 'break' : 'mine';
    const ttlMs = Number.isFinite(beam.ttlMs) && beam.ttlMs > 0
      ? beam.ttlMs
      : (kind === 'break' ? BEAM_TTL_MS.break : BEAM_TTL_MS.mine);
    const playerId = beam.playerId ? String(beam.playerId) : null;
    const visual = playerId ? this.peerVisuals.get(playerId) : null;
    let from = null;
    if (visual) {
      const sample = this.samplePeer(visual, startAt);
      from = sample ? sample.pos : null;
    }
    if (!from && beam.pos && Number.isFinite(beam.pos.x)) {
      from = { x: Number(beam.pos.x), y: Number(beam.pos.y), z: Number(beam.pos.z) };
    }
    if (!from) {
      this._surfaceVisual.droppedBeams += 1;
      return false;
    }
    this.beams.push({
      playerId,
      tag: String(beam.tag || (visual && visual.tag) || 'ROBOT').slice(0, 14),
      color: typeof beam.color === 'string' ? beam.color : (visual ? visual.color : '#8afcff'),
      from: { x: from.x, y: from.y, z: from.z },
      toLeaf,
      kind,
      startAt,
      ttlMs,
    });
    if (this.beams.length > MAX_BEAMS) this.beams.splice(0, this.beams.length - MAX_BEAMS);
    if (visual) {
      visual.mineAt = startAt;
      visual.mineLabel = toLeaf;
    }
    return true;
  }

  /**
   * Discovered resource pins: only entries carrying a non-null `resourceId` from
   * the wire are accepted, so a hidden deposit can never become a client pin.
   */
  setResourcePins(pins) {
    const list = Array.isArray(pins) ? pins : [];
    const next = [];
    for (const pin of list) {
      if (!pin || typeof pin.resourceId !== 'string' || !pin.resourceId) continue;
      const label = typeof pin.label === 'string' ? pin.label : null;
      if (!label || !this.hasLeaf(label)) continue;
      next.push({ label, resourceId: pin.resourceId });
      if (next.length >= MAX_RESOURCE_PINS) break;
    }
    this.resourcePins = next;
    this._surfaceVisual.pins = next.length;
    return next.length;
  }

  /** Forget every surface visual (planet change / surface exit). */
  clearSurfaceVisuals() {
    this.peerVisuals.clear();
    this.beams = [];
    this.resourcePins = [];
    this._selfMineAt = null;
    this._surfaceVisual.peers = 0;
    this._surfaceVisual.beams = 0;
    this._surfaceVisual.pins = 0;
    this._surfaceVisual.avatars = 0;
    this._surfaceVisual.triangles = 0;
    return true;
  }

  /** QA: authoritative surface visual counters (never gameplay state). */
  surfaceVisualStats() {
    return { ...this._surfaceVisual, samples: [...this.peerVisuals.values()].reduce((sum, peer) => sum + peer.samples.length, 0) };
  }

  /** QA: tri-count and source report for `window.__ICOSA__.avatarStats()`. */
  avatarStats() {
    return {
      l0: this._rigCounts.l0,
      l1: this._rigCounts.l1,
      l2: this._rigCounts.l2,
      tris: this._surfaceVisual.triangles,
      avatars: this._surfaceVisual.avatars,
      sources: {
        rig: 'shared/humanoid-3d.js',
        self: 'surface-controller pose',
        peers: 'surface frames',
        mining: 'surface_mine frames',
      },
    };
  }

  /** QA-only figure scale multiplier (evidence close-ups; default 1). */
  setAvatarScale(multiplier) {
    const value = Number(multiplier);
    this.avatarScale = Number.isFinite(value) && value > 0 ? Math.min(4, Math.max(0.25, value)) : 1;
    return this.avatarScale;
  }

  /** Local tool swing on a successful authoritative click. */
  setSelfMine(serverNow) {
    this._selfMineAt = Number.isFinite(serverNow) ? serverNow : Date.now();
    return this._selfMineAt;
  }

  /**
   * Interpolated authoritative pose at `renderServerNow`. Holds the newest
   * sample (never extrapolates past it) and returns `interpolated: false` for a
   * single-sample peer.
   * @param {object} peer a `peerVisuals` entry
   * @param {number} renderServerNow
   */
  samplePeer(peer, renderServerNow) {
    if (!peer || !Array.isArray(peer.samples) || !peer.samples.length) return null;
    const samples = peer.samples;
    const t = (Number.isFinite(renderServerNow) ? renderServerNow : this._serverNow()) - INTERP_DELAY_MS;
    if (samples.length === 1 || t <= samples[0].updatedAt) {
      return { pos: samples[0].pos, heading: samples[0].heading, state: samples[0].state, moving: samples[0].moving, interpolated: false };
    }
    let index = -1;
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      if (samples[i].updatedAt <= t) { index = i; break; }
    }
    if (index < 0) return { pos: samples[0].pos, heading: samples[0].heading, state: samples[0].state, moving: samples[0].moving, interpolated: false };
    if (index >= samples.length - 1) {
      // Hold the newest sample; never extrapolate past it.
      const last = samples[samples.length - 1];
      return { pos: last.pos, heading: last.heading, state: last.state, moving: last.moving, interpolated: false };
    }
    const a = samples[index];
    const b = samples[index + 1];
    const span = Math.max(1, b.updatedAt - a.updatedAt);
    const k = clamp((t - a.updatedAt) / span, 0, 1);
    const pos = slerpPos(a.pos, b.pos, k);
    let heading = a.heading || b.heading;
    if (a.heading && b.heading) {
      heading = slerpPos(a.heading, b.heading, k);
    }
    return {
      pos,
      heading,
      state: b.moving ? 'walk' : b.state,
      moving: !!b.moving,
      interpolated: true,
    };
  }

  /** Mining lift phase in [0,1] for a peer, driven by its `surface_mine` event. */
  peerMinePhase(playerId, serverNow) {
    const visual = this.peerVisuals.get(String(playerId || ''));
    if (!visual || !Number.isFinite(visual.mineAt)) return 0;
    const server = Number.isFinite(serverNow) ? serverNow : this._serverNow();
    const elapsed = Math.max(0, server - visual.mineAt);
    if (elapsed <= MINE_LIFT_MS) return clamp(elapsed / MINE_LIFT_MS, 0, 1);
    return clamp(1 - (elapsed - MINE_LIFT_MS) / MINE_HOLD_MS, 0, 1);
  }

  /** The tessellation the quality ladder currently draws. */
  _activeFaces() {
    const tier = this.perf.tier;
    if (tier <= 0 && this._lodFaces[0].length) return this._lodFaces[0];
    if (tier <= 1 && this._lodFaces[1].length) return this._lodFaces[1];
    return this.faces;
  }

  _updateLodEntries(label, apply) {
    for (const tier of [0, 1]) {
      for (const entry of this._lodByLabel[tier].values()) {
        if (entry.sourceLabel === label) apply(entry);
      }
    }
  }

  /** Lightweight owner/charge update (no geometry change). */
  updateCell(label, ownerIndex, clicks, lastClickIndex) {
    if (typeof label !== 'string') return;
    const apply = (entry) => {
      if (Number.isInteger(ownerIndex)) entry.ownerIndex = ownerIndex;
      if (Number.isFinite(clicks)) entry.clicks = Math.max(0, Math.trunc(clicks));
      if (Number.isInteger(lastClickIndex)) entry.lastClickIndex = lastClickIndex;
    };
    const entry = this.byLabel.get(label);
    if (entry) apply(entry);
    this._updateLodEntries(label, apply);
  }

  /**
   * Incremental break: parent leaf is replaced by its four children.
   * Captures the parent boundary for the shatter effect before discarding it.
   * @param {string} label
   * @param {Array} children world nodes with geometry ({label,a,b,c,depth,ownerIndex,clicks})
   */
  replaceFace(label, children) {
    if (typeof label !== 'string' || !Array.isArray(children) || !children.length) return;
    const parent = this.byLabel.get(label);
    const kids = [];
    for (let i = 0; i < children.length; i++) {
      const ch = children[i];
      if (!ch || typeof ch.label !== 'string') continue;
      let entry = this.byLabel.get(ch.label);
      if (!entry) entry = this._createEntry(ch);
      entry.ownerIndex = Number.isInteger(ch.ownerIndex) ? ch.ownerIndex : -1;
      entry.clicks = Number.isFinite(ch.clicks) ? Math.max(0, Math.trunc(ch.clicks)) : 0;
      entry.lastClickIndex = Number.isInteger(ch.lastClickIndex) ? ch.lastClickIndex : -1;
      this._setEntryResource(entry, ch.resourceId);
      this._setEntryTerrain(entry, ch.terrain);
      entry.born = this.t;
      kids.push(entry);
    }
    if (!kids.length) return;

    if (parent) {
      this._spawnShatter(parent);
      this.byLabel.delete(label);
      const idx = this.faces.indexOf(parent);
      if (idx >= 0) this.faces.splice(idx, 1, ...kids);
      else this.faces.push(...kids);
    } else {
      this.faces.push(...kids);
    }
    for (let i = 0; i < kids.length; i++) this.byLabel.set(kids[i].label, kids[i]);
    // Geometry changed: the LOD lists are stale until the app rebuilds them.
    // Falling back to the full list is always correct (just heavier).
    this._lodFaces = { 0: [], 1: [] };
    this._lodByLabel = { 0: new Map(), 1: new Map() };
    this._ensureBuffers();
  }

  _setEntryTerrain(entry, terrain) {
    if (!terrain || !terrain.biome) {
      entry.terrain = null;
      entry.terrainFill = null;
      entry.terrainFillOwned = null;
      entry.terrainRgb = null;
      return;
    }
    const rawBiome = terrain.biome;
    const biomeId = typeof rawBiome.id === 'string' ? rawBiome.id : String(rawBiome.id || '');
    const fallback = BIOMES[biomeId] || null;
    const color = typeof rawBiome.color === 'string' ? rawBiome.color : (fallback && fallback.color) || '#2b6b4b';
    let rgb = parseColor(color);
    const elevation = Number.isFinite(terrain.elevation) ? terrain.elevation : 0;
    const temperature = Number.isFinite(terrain.temperature) ? terrain.temperature : 0.5;
    const isOcean = biomeId === 'ocean' || biomeId === 'deep_ocean';
    const isIce = biomeId === 'ice';
    const mineable = terrain.mineable === undefined
      ? !!(fallback ? fallback.mineable : true)
      : !!terrain.mineable;
    // Lift the very dark ocean palette a little so water reads as blue under
    // the dark hologram glass instead of collapsing to black.
    if (isOcean) rgb = mixRgb(rgb, { r: 22, g: 92, b: 148 }, 0.42);
    // Elevation shading: lowlands darker, peaks/ice bright.
    let shade;
    if (isOcean) shade = 0.8 + 0.5 * clamp((elevation + 0.45) / 0.55, 0, 1);
    else shade = 0.8 + 0.58 * clamp((elevation + 0.05) / 1.05, 0, 1);
    if (isIce) shade *= 1.12;
    const shaded = {
      r: clamp(Math.round(rgb.r * shade), 0, 255),
      g: clamp(Math.round(rgb.g * shade), 0, 255),
      b: clamp(Math.round(rgb.b * shade), 0, 255),
    };
    entry.terrain = {
      id: biomeId,
      name: typeof rawBiome.name === 'string' ? rawBiome.name : (fallback && fallback.name) || biomeId,
      isOcean,
      isIce,
      mineable,
      elevation,
      temperature,
    };
    entry.terrainRgb = shaded;
    entry.terrainFill = rgba(shaded, isOcean ? 0.9 : 0.86);
    entry.terrainFillOwned = rgba(shaded, isOcean ? 0.62 : 0.56);
  }

  _setEntryResource(entry, resourceId) {
    const id = typeof resourceId === 'string' && resourceId ? resourceId : null;
    if (!id) {
      if (entry.resourceId) {
        entry.resourceId = null;
        entry.resource = null;
        entry.resRgb = null;
      }
      return;
    }
    if (entry.resourceId === id) return;
    const resource = resourceById(id);
    if (!resource) return;
    entry.resourceId = resource.id;
    entry.resource = resource;
    entry.resRgb = parseColor(resource.color);
    entry.foundAt = -1e9;
  }

  /**
   * Mark a cell's hidden deposit as discovered (instant marker + burst).
   * @param {string} label
   * @param {string} resourceId catalog id ('gold', 'myrthil', ...)
   */
  discoverResource(label, resourceId) {
    if (typeof label !== 'string') return;
    const entry = this.byLabel.get(label);
    if (!entry) return;
    this._setEntryResource(entry, resourceId);
    if (!entry.resource) return;
    entry.foundAt = this.t;
    this._pushPulse({
      label,
      kind: 'resource',
      rgb: entry.resRgb,
      color: entry.resource.color,
      text: '',
      wx: entry.wx,
      n: entry.n,
      centroid: entry.centroid,
      depth: entry.depth,
      start: this.t,
      dur: PULSE_DUR.resource,
    });
  }

  /** @param {{threshold?:number,maxDepth?:number}} cfg */
  setConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    if (Number.isFinite(cfg.threshold) && cfg.threshold > 0) this.threshold = cfg.threshold;
    if (Number.isFinite(cfg.maxDepth) && cfg.maxDepth >= 0) this.maxDepth = cfg.maxDepth;
  }

  /** @param {string|null} label */
  setHover(label) {
    this.hoverLabel = typeof label === 'string' && label ? label : null;
  }

  setPoleLabelsVisible(visible) {
    this.poleLabelsVisible = !!visible;
  }

  setLabelsVisible(visible) {
    this.labelsVisible = !!visible;
  }

  /** Mark a cell as the navigation target (gold pulsing beacon). */
  setWaypoint(label) {
    this.waypointLabel = typeof label === 'string' && label ? label : null;
  }

  /** Highlight emergency supply salvage cells for a short time. */
  setSupplyMarkers(cells, ttlMs = 25000) {
    this.supplyMarkers.clear();
    if (Array.isArray(cells)) {
      for (const cell of cells) {
        if (!cell || !cell.label) continue;
        this.supplyMarkers.set(String(cell.label), { resourceId: cell.resourceId || null });
      }
    }
    this._supplyUntil = this.t + Math.max(2000, Math.min(120000, Number(ttlMs) || 25000)) / 1000;
  }

  _drawSupplyMarkers(ctx, camera) {
    if (!this.supplyMarkers.size) return;
    if (this.t > this._supplyUntil) {
      this.supplyMarkers.clear();
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4.2);
    for (const [label, info] of this.supplyMarkers) {
      const entry = this._leafEntry(label);
      if (!entry) continue;
      const p = camera.project(entry.centroid);
      if (!p || p.z <= 0.01) continue;
      const resource = info.resourceId ? resourceById(info.resourceId) : null;
      const color = hexRgb(resource ? resource.color : '#ffb347');
      const r = clamp((entry.sr || 14) * 0.42, 12, 30) + pulse * 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(color, 0.78);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(color, 0.4 * (1 - pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8 + pulse * 8, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(color, 0.95);
      ctx.font = `700 10px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.fillText(resource ? resource.glyph : '◆', p.x, p.y + 3);
      ctx.restore();
    }
  }

  /**
   * Click / break juice on one cell.
   * @param {string} label
   * @param {{color?:string,kind?:'claim'|'steal'|'reinforce'|'break',text?:string}} [opts]
   */
  pulse(label, opts) {
    if (typeof label !== 'string') return;
    const options = opts && typeof opts === 'object' ? opts : {};
    const entry = this.byLabel.get(label);
    if (!entry) return;
    const kind = options.kind === 'steal' || options.kind === 'reinforce' || options.kind === 'break' || options.kind === 'resource'
      ? options.kind
      : 'claim';
    const fallbackColor = kind === 'resource' && entry.resource ? entry.resource.color : '#00f0ff';
    const color = typeof options.color === 'string' ? options.color : fallbackColor;
    const text = typeof options.text === 'string' ? options.text : '';
    this._pushPulse({
      label,
      kind,
      rgb: parseColor(color),
      color,
      text,
      wx: entry.wx,
      n: entry.n,
      centroid: entry.centroid,
      depth: entry.depth,
      start: this.t,
      dur: PULSE_DUR[kind] || PULSE_DUR.claim,
    });
  }

  /* ================================================================ *
   * Public API — canvas / frame
   * ================================================================ */

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    let cssW = 0;
    let cssH = 0;
    try {
      cssW = canvas.clientWidth || 0;
      cssH = canvas.clientHeight || 0;
      if ((!cssW || !cssH) && typeof canvas.getBoundingClientRect === 'function') {
        const rect = canvas.getBoundingClientRect();
        cssW = cssW || rect.width || 0;
        cssH = cssH || rect.height || 0;
      }
    } catch (_) {
      /* ignore */
    }
    if (!cssW) cssW = canvas.width || 1;
    if (!cssH) cssH = canvas.height || 1;

    const rawDpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const dpr = clamp(rawDpr, 1, 2);
    const w = Math.max(1, Math.round(cssW));
    const h = Math.max(1, Math.round(cssH));
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));

    const changed = w !== this.width || h !== this.height || dpr !== this.dpr;
    this.width = w;
    this.height = h;
    this.dpr = dpr;

    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;

    if (changed) {
      this._backdropGrad = null;
      this._coreGrad = null;
      this._nebulaA = null;
      this._nebulaB = null;
      this._haloKey = '';
      this._haloGrad = null;
      this._vigGrad = null;
      this._sphereFxKey = '';
      this._sphereDiscKey = '';
      this._scanPattern = null;
      this._seedStarfield();
      this._seedMotes();
      this._seedDust();
      // Edge case 3: a dpr/viewport change resets the ring so mixed-DPR
      // frames never contaminate the percentile.
      this.perf.reset('resize');
      this._perfLastRenderAt = 0;
    }
  }

  /**
   * Draw one frame. No RAF inside.
   * @param {import('./shared/geometry.js').SphereCamera} camera
   * @param {number} timeMs monotonic clock
   */
  /**
   * CTL-02 read-only frame statistics. `renderStats()` mirrors this through
   * `window.__ICOSA__`; the acceptance script asserts `emptyFrames === 0`.
   */
  frameStats() {
    return {
      visCount: this._stats.visCount,
      culled: this._stats.culled,
      nearSkipped: this._stats.nearSkipped,
      emptyFrames: this._stats.emptyFrames,
      axis: [...this._stats.axis],
    };
  }

  /** Clear the cumulative empty-frame counter (used by the HUD recovery line). */
  resetEmptyFrames() {
    this._stats.emptyFrames = 0;
    return this;
  }

  render(camera, timeMs) {
    const ctx = this.ctx;
    if (!ctx) return;

    const raw = Number.isFinite(timeMs) ? timeMs : (this.lastRaw || 0) + 16.7;
    const perfFrameMs = this._perfLastRenderAt ? raw - this._perfLastRenderAt : 0;
    this._perfLastRenderAt = raw;
    this._workStars = 0;
    this._workMotes = 0;
    this._workDust = 0;
    this._renderLocalNow = raw;
    if (!this.lastRaw) this.lastRaw = raw;
    let dt = (raw - this.lastRaw) / 1000;
    this.lastRaw = raw;
    if (!(dt > 0)) dt = 1 / 120;
    if (dt > 0.1) dt = 0.1;
    this.t += dt;
    this.frame++;
    this._stats.visCount = 0;
    this._stats.culled = 0;
    this._stats.nearSkipped = 0;

    if (this._mq) this.reducedMotion = !!this._mq.matches;
    const rm = this.reducedMotion;

    const W = this.width;
    const H = this.height;
    if (W < 2 || H < 2) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05010f';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const hasCamera = !!camera && typeof camera.project === 'function';
    const cx = W / 2;
    const cy = H / 2;
    const zoom = hasCamera && Number.isFinite(camera.zoom) ? camera.zoom : 1;
    this._zoom = zoom;
    const R = Math.min(W, H) * SPHERE_SCREEN_FRACTION * zoom;
    this._R = R;

    if (this._stylesDirty || !this._styles) this._rebuildStyles();
    if (hasCamera) this._computeCameraFrame(camera, R);
    // One rebuild per frame maximum, only when the world revision changed.
    const rebuilt = this.liveSurface.prepare(this.t);
    if (rebuilt) this.perf.recordRebuild(1);

    // RND-06 material probe: draw the cell material only, opaque and without
    // screen-space post-processing, so the acceptance suite can compare the
    // same cell's colour across camera modes. Off in production.
    if (this.materialProbe) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (hasCamera && this.faces.length) this._drawMaterialProbe(ctx, camera, W, H);
      return;
    }

    // Backdrop layers.
    this._drawBackdrop(ctx, W, H);
    this._drawStarfield(ctx, W, H, dt, hasCamera ? camera : null, rm);
    const gridFade = clamp(1 - (zoom - 10) / 10, 0, 1);
    if (!this.surfaceView && gridFade > 0.01 && this.perf.tier > 0) this._drawFloorGrid(ctx, W, H, cx, rm, gridFade);

    // Zoom-aware decoration fades: sphere-scale glow must not wash a deep zoom.
    const haloFade = clamp(1 - (zoom - 2.5) / 4.5, 0, 1);
    const glassFade = clamp(1 - (zoom - 3) / 3, 0, 1);
    const cartoFade = clamp(1 - (zoom - 5) / 6, 0, 1);

    if (!this.surfaceView && haloFade > 0.01 && this.perf.tier > 0) this._drawHalo(ctx, W, H, cx, cy, R, rm, haloFade);

    this._visCount = 0;
    if (this.surfaceView && hasCamera) {
      this._drawSurfaceProjected(ctx, camera, W, H);
    }
    if (this._activeFaces().length && hasCamera) {
      this._drawSphere(ctx, camera, cx, cy, R, rm, glassFade);
      this._drawResourceMarkers(ctx);
      // CTL-02: an empty frame is a signal, not a silent blank planet.
      this._stats.visCount = this._visCount;
      if (this._visCount === 0) this._stats.emptyFrames += 1;
    }

    if (!this.surfaceView && !this.opaqueSurface && hasCamera && cartoFade > 0.01) {
      this._drawGraticule(ctx, camera, cartoFade);
      this._drawPoles(ctx, camera, cx, cy, cartoFade);
    }

    this._drawForegroundDust(ctx, W, H, dt, rm);
    this._drawVignette(ctx, W, H);
    if (!rm && this.perf.tier > 1) this._drawScanlines(ctx, W, H);

    // Labels + charge arcs are drawn crisp above the vignette.
    if (hasCamera) {
      this._drawLabels(ctx, camera);
      this._drawChargeArcs(ctx);
      this._drawWaypoint(ctx, camera);
      this._drawSupplyMarkers(ctx, camera);
    }

    if (this.surfaceMode && hasCamera) this._drawSurfaceEntities(ctx, camera, rm);

    if (hasCamera) this._drawPulses(ctx, camera, rm);

    this._finishPerfFrame(raw, perfFrameMs, rebuilt);
  }

  /* ================================================================ *
   * PERF-01: frame budget, quality ladder, renderer work accounting
   * ================================================================ */

  /** Decorative work multiplier for the current quality tier. */
  _qualityScale() {
    return qualityWorkScale(this.perf.tier);
  }

  _starLimit() {
    const total = Number(this._starCount) || 0;
    return Math.max(20, Math.round(total * this._qualityScale()));
  }

  /**
   * Record one frame in the preallocated ring and let the quality ladder move
   * at most once per 2 s. Frame deltas come from the rAF `timeMs` stream; the
   * frame after a surface rebuild is excluded, and hidden-tab frames are not
   * measured at all.
   */
  _finishPerfFrame(at, frameMs, rebuilt) {
    const hidden = typeof document !== 'undefined' && document.hidden === true;
    let drawUnits = this._visCount + this._workStars + this._workMotes * 2 + this._workDust * 2;
    if (this.supplyMarkers) drawUnits += this.supplyMarkers.size;
    if (this.pulses) drawUnits += this.pulses.length;
    if (this.surfaceEntities) drawUnits += this.surfaceEntities.length;
    this._perfDrawUnits = drawUnits;
    if (frameMs > 0) {
      this.perf.recordFrame(frameMs, { at, draw: drawUnits, rebuild: rebuilt, hidden });
    }
    this.perf.maybeAdjustTier(at);
  }

  /** Reset the frame ring and skip the first frame after the reset. */
  resetPerf(reason = 'manual', options = {}) {
    this.perf.reset(reason, options);
    this._perfLastRenderAt = 0;
    return this.perf;
  }

  /** Input-to-next-frame latency, measured by the app's capture listeners. */
  recordInteraction(ms) {
    return this.perf.recordInteraction(ms);
  }

  /** Full budget report for the probe and `window.__ICOSA__.perf()`. */
  perfSnapshot() {
    return this.perf.snapshot();
  }

  /** The three numeric beacon fields (PERF-01). */
  perfTelemetry() {
    return this.perf.telemetry();
  }

  /* ================================================================ *
   * World entries / boundary cache
   * ================================================================ */

  _createEntry(face) {
    const a = face.a;
    const b = face.b;
    const c = face.c;
    if (!a || !b || !c) return this._emptyEntry(face);
    const label = String(face.label);
    const depth = Number.isInteger(face.depth) ? face.depth : Math.max(0, label.split('.').length - 1);
    const centroid = face.centroid && Number.isFinite(face.centroid.x)
      ? face.centroid
      : normalize({ x: a.x + b.x + c.x, y: a.y + b.y + c.y, z: a.z + b.z + c.z });
    const segs = segmentsForDepth(depth);
    const n = 3 * segs;
    const wx = new Float32Array(n * 3);
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const pz = new Float32Array(n);

    let o = 0;
    const edges = [[a, b], [b, c], [c, a]];
    for (let e = 0; e < 3; e++) {
      const p = edges[e][0];
      const q = edges[e][1];
      for (let k = 0; k < segs; k++) {
        const v = k === 0 ? p : slerp(p, q, k / segs);
        wx[o] = v.x;
        wx[o + 1] = v.y;
        wx[o + 2] = v.z;
        o += 3;
      }
    }

    // Angular radius from the centroid to the corners (cull bound).
    let maxDot = -1;
    const verts = [a, b, c];
    for (let i = 0; i < 3; i++) {
      const d = centroid.x * verts[i].x + centroid.y * verts[i].y + centroid.z * verts[i].z;
      if (d > maxDot) maxDot = d;
    }
    const theta = Math.acos(clamp(maxDot, -1, 1));

    return {
      label,
      depth,
      n,
      segs,
      a,
      b,
      c,
      centroid,
      wx,
      px,
      py,
      pz,
      theta,
      cosTheta: Math.cos(theta),
      sinTheta: Math.sin(theta),
      ownerIndex: Number.isInteger(face.ownerIndex) ? face.ownerIndex : -1,
      clicks: Number.isFinite(face.clicks) ? Math.max(0, Math.trunc(face.clicks)) : 0,
      lastClickIndex: Number.isInteger(face.lastClickIndex) ? face.lastClickIndex : -1,
      resourceId: null,
      resource: null,
      resRgb: null,
      foundAt: -1e9,
      terrain: null,
      terrainFill: null,
      terrainFillOwned: null,
      terrainRgb: null,
      born: -1e9,
      // per-frame scratch
      allFront: true,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      sr: 0,
      fx: 0,
      fy: 0,
      visFrame: -1,
    };
  }

  _emptyEntry(face) {
    return {
      label: String(face && face.label != null ? face.label : '?'),
      depth: 0,
      n: 0,
      segs: 1,
      a: { x: 0, y: 1, z: 0 },
      b: { x: 0, y: 1, z: 0 },
      c: { x: 0, y: 1, z: 0 },
      centroid: { x: 0, y: 1, z: 0 },
      wx: new Float32Array(0),
      px: new Float32Array(0),
      py: new Float32Array(0),
      pz: new Float32Array(0),
      theta: 0,
      cosTheta: 1,
      sinTheta: 0,
      ownerIndex: -1,
      clicks: 0,
      resourceId: null,
      resource: null,
      resRgb: null,
      foundAt: -1e9,
      terrain: null,
      terrainFill: null,
      terrainFillOwned: null,
      terrainRgb: null,
      born: -1e9,
      allFront: true,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      sr: 0,
      fx: 0,
      fy: 0,
      visFrame: -1,
    };
  }

  _spawnShatter(entry) {
    // Dedupe if the app also pulsed the same label this instant.
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      if (p.label === entry.label && p.kind === 'break' && this.t - p.start < 0.25) return;
    }
    this._pushPulse({
      label: entry.label,
      kind: 'break',
      rgb: WHITE,
      color: '#d7ff00',
      text: '',
      wx: entry.wx,
      n: entry.n,
      centroid: entry.centroid,
      depth: entry.depth,
      start: this.t,
      dur: PULSE_DUR.break,
    });
  }

  _pushPulse(pulse) {
    // Copy the boundary so the effect survives the entry being replaced.
    const wx = new Float32Array(pulse.n * 3);
    wx.set(pulse.wx.subarray(0, pulse.n * 3));
    this.pulses.push({ ...pulse, wx });
    if (this.pulses.length > MAX_PULSES) this.pulses.splice(0, this.pulses.length - MAX_PULSES);
    this._pulseLabels.set(pulse.label, this.t);
  }

  _prunePulseLabels() {
    if (!this._pulseLabels.size) return;
    const cutoff = this.t - this._labelTtl;
    for (const [label, at] of this._pulseLabels) {
      if (at < cutoff) this._pulseLabels.delete(label);
    }
  }

  _ensureBuffers() {
    const nf = Math.max(this.faces.length, this._lodFaces[0].length, this._lodFaces[1].length);
    if (this._dotZ.length < nf) {
      this._dotZ = new Float32Array(Math.max(20, nf));
      this._visList = new Int32Array(Math.max(20, nf));
    }
  }

  /* ================================================================ *
   * Styles
   * ================================================================ */

  _styleIndex(ownerIndex) {
    return ownerIndex >= 0 && ownerIndex < this.players.length ? ownerIndex + 1 : 0;
  }

  _rebuildStyles() {
    const styles = [this._buildStyle(CYAN, 'unowned')];
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const style = this._buildStyle(parseColor(p && p.color), i === this.myIndex ? 'mine' : 'owned');
      style.tag = p && p.tag ? String(p.tag) : `P${i + 1}`;
      style.playerIndex = i;
      styles.push(style);
    }
    this._styles = styles;
    this._stylesDirty = false;
    const bucketCount = styles.length * 8;
    this._buckets = new Array(bucketCount).fill(null);
    this._nearBreak = new Array(styles.length).fill(null);
  }

  _buildStyle(rgb, kind) {
    const fillC = [];
    const overlayC = [];
    const edgeCore = [];
    // Thin edge lines are lightened toward white so neighbouring cells of the
    // same owner still read as separate geodesic cells (crisp, no glow pass).
    const edgeRgb = mixRgb(rgb, WHITE, kind === 'mine' ? 0.45 : kind === 'owned' ? 0.3 : 0.18);
    for (let b = 0; b < 6; b++) {
      const k = b / 5;
      let fa = 0;
      let ca = 0;
      if (kind === 'mine') {
        fa = 0.17 + 0.085 * k;
        ca = 0.85 + 0.15 * k;
      } else if (kind === 'owned') {
        fa = 0.105 + 0.06 * k;
        ca = 0.6 + 0.24 * k;
      } else {
        fa = 0.024 + 0.022 * k;
        ca = 0.3 + 0.18 * k;
      }
      edgeCore.push(rgba(edgeRgb, ca));
      // Charge tiers: owned cells brighten as they approach the break threshold.
      for (let tier = 0; tier < CHARGE_TIERS; tier++) {
        const frac = tier / (CHARGE_TIERS - 1);
        const faT = fa + (kind === 'unowned' ? 0 : 0.05 * frac);
        fillC.push(rgba(rgb, Math.min(0.65, faT)));
        if (kind === 'unowned') overlayC.push(null);
        else overlayC.push(rgba(rgb, Math.min(0.6, (kind === 'mine' ? 0.26 : 0.2) + 0.075 * k + 0.05 * frac)));
      }
    }
    return {
      rgb,
      kind,
      isMine: kind === 'mine',
      isUnowned: kind === 'unowned',
      tag: '',
      playerIndex: -1,
      fillC,
      overlayC,
      edgeCore,
      // One crisp, thin owner-coloured edge per face.
      coreW: kind === 'mine' ? 1.05 : kind === 'owned' ? 0.85 : 0.65,
    };
  }

  /* ================================================================ *
   * Camera frame + culling bounds
   * ================================================================ */

  _computeCameraFrame(camera, R) {
    // CTL-02: the cull axis may only come from the real camera orientation.
    // There is deliberately no Euler fallback here (narimato-physics.md §6).
    if (!camera || typeof camera.viewAxis !== 'function') {
      throw new Error('IcosaRenderer: camera.viewAxis() is required for culling');
    }
    const d = Number(camera.distance) || CAMERA_DISTANCE;
    const axis = camera.viewAxis();
    if (!axis || !Number.isFinite(axis.x) || !Number.isFinite(axis.y) || !Number.isFinite(axis.z)) {
      throw new Error('IcosaRenderer: camera.viewAxis() must return a finite unit axis');
    }
    this._d = d;
    this._Kx = axis.x;
    this._Ky = axis.y;
    this._Kz = axis.z;
    this._stats.axis = [axis.x, axis.y, axis.z];

    const D = Math.hypot(this.width / 2, this.height / 2) + 28;
    let cosA = 0;
    let sinA = 1;
    let cosGB = 0;
    let sinGB = 1;
    if (D < R - 1e-6) {
      // Front cone: largest angular distance from K that can project on screen.
      let lo = 0;
      let hi = HALF_PI;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const rho = (R * d * Math.sin(mid)) / Math.max(1e-9, d - Math.cos(mid));
        if (rho < D) lo = mid;
        else hi = mid;
      }
      const a = (lo + hi) / 2;
      cosA = Math.cos(a);
      sinA = Math.sin(a);
      // Back cone: antipodal patch whose mirrored projection can still be on screen.
      lo = HALF_PI;
      hi = Math.PI;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const rho = (R * d * Math.sin(mid)) / Math.max(1e-9, d - Math.cos(mid));
        if (rho > D) lo = mid;
        else hi = mid;
      }
      const g = (lo + hi) / 2;
      cosGB = Math.cos(g);
      sinGB = Math.sin(g);
    }
    this._cosA = cosA;
    this._sinA = sinA;
    this._cosGB = cosGB;
    this._sinGB = sinGB;
  }

  /**
   * Project one entry's boundary; returns true when its bbox can touch the view.
   * CTL-02: samples nearer than NEAR_EPS are skipped, and every projected
   * coordinate is clamped to ±OVERSCAN·max(W,H), so the silhouette math can
   * never feed an unbounded coordinate into a path or a bbox.
   */
  _projectEntry(entry, camera, W, H) {
    const wx = entry.wx;
    const px = entry.px;
    const py = entry.py;
    const pz = entry.pz;
    const n = entry.n;
    const tmp = this._tmpV;
    const bound = OVERSCAN * Math.max(W, H);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let allFront = true;
    let usable = 0;
    for (let k = 0; k < n; k++) {
      const o = k * 3;
      tmp.x = wx[o];
      tmp.y = wx[o + 1];
      tmp.z = wx[o + 2];
      const pr = camera.project(tmp);
      const depth = Number.isFinite(pr.depth) ? pr.depth : camera.distance - pr.z;
      if (!(depth >= NEAR_EPS)) {
        // Too close to the camera plane to project honestly: mark the boundary
        // as back-facing and clamp, never mirror an infinite coordinate.
        allFront = false;
        this._stats.nearSkipped += 1;
        px[k] = clamp(pr.x, -bound, bound);
        py[k] = clamp(pr.y, -bound, bound);
        pz[k] = pr.z;
        continue;
      }
      const X = clamp(pr.x, -bound, bound);
      const Y = clamp(pr.y, -bound, bound);
      const Z = pr.z;
      px[k] = X;
      py[k] = Y;
      pz[k] = Z;
      usable += 1;
      if (Z <= NEAR_EPS) allFront = false;
      if (X < minX) minX = X;
      if (X > maxX) maxX = X;
      if (Y < minY) minY = Y;
      if (Y > maxY) maxY = Y;
    }
    entry.allFront = allFront;
    if (!usable) {
      entry.minX = 0;
      entry.minY = 0;
      entry.maxX = 0;
      entry.maxY = 0;
      entry.sr = 0;
      this._stats.culled += 1;
      return false;
    }
    entry.minX = minX;
    entry.minY = minY;
    entry.maxX = maxX;
    entry.maxY = maxY;
    entry.sr = Math.max(maxX - minX, maxY - minY) * 0.5;
    if (maxX < -6 || minX > W + 6 || maxY < -6 || minY > H + 6) return false;
    return entry.sr >= 0.28;
  }

  /** Sutherland–Hodgman clip of a projected boundary polygon at the horizon. */
  _clipEntryPoly(entry, camera, outX, outY) {
    const n = entry.n;
    const px = entry.px;
    const py = entry.py;
    const pz = entry.pz;
    const wx = entry.wx;
    const tmp = this._tmpV;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const zp = pz[i];
      const zq = pz[j];
      if (zp >= 0) {
        outX[m] = px[i];
        outY[m] = py[i];
        m++;
      }
      if ((zp >= 0) !== (zq >= 0) && Math.abs(zp - zq) > 1e-12) {
        const t = zp / (zp - zq);
        const oi = i * 3;
        const oj = j * 3;
        tmp.x = wx[oi] + (wx[oj] - wx[oi]) * t;
        tmp.y = wx[oi + 1] + (wx[oj + 1] - wx[oi + 1]) * t;
        tmp.z = wx[oi + 2] + (wx[oj + 2] - wx[oi + 2]) * t;
        const unit = normalize(tmp);
        const pr = camera.project(unit);
        outX[m] = pr.x;
        outY[m] = pr.y;
        m++;
      }
    }
    return m;
  }

  /* ================================================================ *
   * Sphere
   * ================================================================ */

  /** Draw the navigation target beacon above the grid. */
  _drawWaypoint(ctx, camera) {
    if (!this.waypointLabel) return;
    const entry = this.byLabel.get(this.waypointLabel);
    if (!entry) return;
    let p = camera.project(entry.centroid);
    if (!p) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const offscreen = p.z <= 0.01 || p.x < 24 || p.x > this.width - 24 || p.y < 80 || p.y > this.height - 24;
    if (offscreen) {
      // Target is behind the camera or off-screen: put a guide chevron on the
      // rim pointing toward it instead of losing the wayfinding cue.
      let dx = p.x - cx;
      let dy = p.y - cy;
      if (p.z <= 0.01 && Math.hypot(dx, dy) < 1) {
        dx = 0;
        dy = -1;
      }
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const rim = Math.min(this.width, this.height) * 0.39;
      const ax = cx + ux * rim;
      const ay = cy + uy * rim;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(215,255,0,${0.34 + 0.3 * pulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ax, ay, 14 + pulse * 4, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(215,255,0,0.9)';
      ctx.beginPath();
      ctx.moveTo(ax + ux * 24, ay + uy * 24);
      ctx.lineTo(ax + ux * 10 - uy * 7, ay + uy * 10 + ux * 7);
      ctx.lineTo(ax + ux * 10 + uy * 7, ay + uy * 10 - ux * 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.font = `700 10px ${FONT_STACK}`;
      ctx.fillStyle = 'rgba(215,255,0,0.9)';
      ctx.textAlign = 'center';
      const label = this.waypointLabel;
      ctx.fillText(`NAV ${label}`, ax, ay + 30);
      ctx.restore();
      return;
    }
    const sr = clamp((entry.sr || 18) * 0.3, 13, 42);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.4);
    const r = sr + 8 + pulse * 10;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(215,255,0,${0.32 + 0.35 * pulse})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(215,255,0,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 10 + pulse * 6, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(215,255,0,${0.72 + 0.2 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r - 18);
    ctx.lineTo(p.x + 6, p.y - r - 10);
    ctx.lineTo(p.x, p.y - r - 3);
    ctx.lineTo(p.x - 6, p.y - r - 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const name = entry.terrain && entry.terrain.biome ? entry.terrain.biome.name : '';
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = `700 10px ${FONT_STACK}`;
    try { ctx.letterSpacing = '0.08em'; } catch (_) { /* ignore */ }
    const text = `NAV ${this.waypointLabel}${name ? ' // ' + name : ''}`;
    const tx = Math.min(this.width - 8, Math.max(8, p.x + r + 12));
    const ty = Math.min(this.height - 12, Math.max(16, p.y - r - 8));
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = 'rgba(215,255,0,0.92)';
    ctx.fillText(text, tx, ty);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Surface underlay: the live leaf mesh (RND-04), rebuilt from World.leaves on
   * revision/seed change and drawn in quantised colour buckets.
   */
  _drawSurfaceProjected(ctx, camera, W, H) {
    const mesh = this.liveSurface.mesh;
    if (!mesh || !mesh.triangles || !mesh.triangleCount) return;
    const tris = mesh.triangles;
    const buckets = mesh.buckets;
    const origin = camera && camera.origin ? camera.origin : camera.viewAxis();
    const tmp = this._tmpV;
    const near = Number.isFinite(camera.nearPlane) ? camera.nearPlane : 0;
    const paths = new Map();
    for (let b = 0; b < buckets.length; b += 1) {
      const bucket = buckets[b];
      const start = bucket.start * 9;
      const end = (bucket.start + bucket.count) * 9;
      let path = null;
      for (let o = start; o < end; o += 9) {
        tmp.x = tris[o]; tmp.y = tris[o + 1]; tmp.z = tris[o + 2];
        const pa = camera.project(tmp);
        if (!pa.visible || pa.depth <= near) continue;
        tmp.x = tris[o + 3]; tmp.y = tris[o + 4]; tmp.z = tris[o + 5];
        const pb = camera.project(tmp);
        if (!pb.visible || pb.depth <= near) continue;
        tmp.x = tris[o + 6]; tmp.y = tris[o + 7]; tmp.z = tris[o + 8];
        const pc = camera.project(tmp);
        if (!pc.visible || pc.depth <= near) continue;
        // Cheap back-face/horizon cull: the centroid must face the camera.
        const cx = (tris[o] + tris[o + 3] + tris[o + 6]) / 3;
        const cy = (tris[o + 1] + tris[o + 4] + tris[o + 7]) / 3;
        const cz = (tris[o + 2] + tris[o + 5] + tris[o + 8]) / 3;
        if (cx * origin.x + cy * origin.y + cz * origin.z < -0.02) continue;
        const minX = Math.min(pa.x, pb.x, pc.x);
        const maxX = Math.max(pa.x, pb.x, pc.x);
        const minY = Math.min(pa.y, pb.y, pc.y);
        const maxY = Math.max(pa.y, pb.y, pc.y);
        if (maxX < -4 || minX > W + 4 || maxY < -4 || minY > H + 4) continue;
        if (!path) {
          path = new Path2D();
          paths.set(b, path);
        }
        path.moveTo(pa.x, pa.y);
        path.lineTo(pb.x, pb.y);
        path.lineTo(pc.x, pc.y);
        path.closePath();
      }
    }
    for (const [index, path] of paths) {
      const fill = buckets[index].fill;
      ctx.fillStyle = fill;
      ctx.globalAlpha = 0.98;
      ctx.fill(path);
      ctx.strokeStyle = fill;
      ctx.lineWidth = 0.8;
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
  }

  /* ================================================================ *
   * Surface entity pass (RND-02)
   * ================================================================ */

  /**
   * Draw the surface entity pass inside the single renderer: the local pilot,
   * authoritative peers/robots (interpolated), beams, resource pins, supply
   * markers, harvest effects and the landing/leaving ship. Entities reference
   * cells by label, never by copied geometry.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   * @param {boolean} rm reduced motion
   */
  _drawSurfaceEntities(ctx, camera, rm) {
    const W = this.width;
    const H = this.height;
    if (W < 2 || H < 2) return;
    const serverNow = this._serverNow();
    if (!(this._surfaceClock.server > 0)) {
      // No peer frame yet: keep the local clock as the server estimate.
      this._surfaceClock = { server: Date.now(), local: this._localNow() };
    }
    this._surfaceVisual.avatars = 0;
    this._surfaceVisual.triangles = 0;
    this._surfaceVisual.beams = 0;
    this._surfaceVisual.markers = this.supplyMarkers.size;
    this._pruneSurfaceBeams(serverNow);
    const avatars = [];
    const list = this.surfaceEntities || [];
    for (let i = 0; i < list.length; i += 1) {
      const entity = list[i];
      if (!entity || !entity.pos) continue;
      if (entity.kind === 'pin') this._drawSurfacePin(ctx, camera, entity);
      else if (entity.kind === 'self') avatars.push({ kind: 'self', entity, depth: 1e9 });
    }
    for (const visual of this.peerVisuals.values()) {
      if (!visual || !visual.samples.length) continue;
      let alpha = 1;
      if (visual.leaving) {
        const age = serverNow - visual.leaveAt;
        if (age >= PEER_FADE_MS) continue;
        alpha = clamp(1 - age / PEER_FADE_MS, 0, 1);
      }
      const stale = serverNow - visual.lastSeenAt > PEER_STALE_MS;
      const sample = this.samplePeer(visual, serverNow);
      if (!sample || !sample.pos) continue;
      const projected = camera.project(sample.pos);
      // Far bodies are drawn first so near bodies occlude them.
      const depth = projected && Number.isFinite(projected.depth) ? projected.depth : 0;
      avatars.push({ kind: 'peer', visual, sample, alpha, stale, depth });
    }
    // Painter order for figures: far → near (deterministic for equal depths).
    avatars.sort((left, right) => right.depth - left.depth);
    // Local harvest FX and the landing ship sit under the shared world visuals,
    // so an authoritative beam is never hidden by the pilot's own mining cone.
    this._drawSurfaceHarvest(ctx, W, H);
    this._drawSurfaceShip(ctx, W, H, rm);
    this._drawSurfaceBeams(ctx, camera, rm, serverNow);
    this._drawResourcePins(ctx, camera);
    for (let i = 0; i < avatars.length; i += 1) {
      const avatar = avatars[i];
      if (avatar.kind === 'self') this._drawSurfaceSelf(ctx, camera, avatar.entity, rm);
      else this._drawSurfacePeer(ctx, camera, avatar, rm, serverNow);
    }
  }

  /** Local pilot: a full L0 rig driven by the controller pose and local clicks. */
  _drawSurfaceSelf(ctx, camera, entity, rm) {
    const selfRig = this._avatarRig;
    if (!selfRig || !HUMAN_MODULE) return;
    const walkPhase = Number.isFinite(entity.walk) ? entity.walk : 0;
    const serverNow = this._serverNow();
    let minePhase = 0;
    if (Number.isFinite(this._selfMineAt)) {
      const elapsed = Math.max(0, serverNow - this._selfMineAt);
      minePhase = elapsed <= MINE_LIFT_MS
        ? clamp(elapsed / MINE_LIFT_MS, 0, 1)
        : clamp(1 - (elapsed - MINE_LIFT_MS) / MINE_HOLD_MS, 0, 1);
    }
    const stats = HUMAN_MODULE.drawRig(ctx, camera, selfRig, {
      walkPhase,
      minePhase,
      moving: minePhase <= 0,
      lean: 0.06,
    }, {
      anchor: entity.pos,
      forward: entity.forward,
      level: 'L0',
      tint: entity.tint || '#67ddff',
      skin: '#f2ffff',
      scale: this.avatarScale,
      reducedMotion: rm,
    });
    this._surfaceVisual.avatars += 1;
    this._surfaceVisual.triangles += stats.drawn;
    this._drawAvatarLabel(ctx, camera, entity.pos, entity.label, 0.024);
  }

  /** Peer/robot: interpolated authoritative pose + walk + mining lift. */
  _drawSurfacePeer(ctx, camera, avatar, rm, serverNow) {
    if (!this._peerRig || !HUMAN_MODULE) return;
    const visual = avatar.visual;
    const sample = avatar.sample;
    const angle = HUMAN_MODULE.angleFromAxis(sample.pos, camera);
    const level = HUMAN_MODULE.lodForDistance(angle, visual.lod || null);
    visual.lod = level;
    const moving = !!sample.moving && !avatar.stale;
    const walkPhase = moving ? serverNow * 0.006 + (visual.playerId.length % 7) : 0;
    const minePhase = this.peerMinePhase(visual.playerId, serverNow);
    const stats = HUMAN_MODULE.drawRig(ctx, camera, this._peerRig, {
      walkPhase,
      minePhase,
      moving,
      lean: moving ? 0.05 : 0,
    }, {
      anchor: sample.pos,
      forward: sample.heading,
      level,
      angle,
      currentLod: level,
      tint: avatar.stale ? '#7f8c99' : visual.color,
      skin: '#dffcff',
      alpha: avatar.alpha * (avatar.stale ? 0.62 : 1),
      scale: this.avatarScale,
      reducedMotion: rm,
    });
    this._surfaceVisual.avatars += 1;
    this._surfaceVisual.triangles += stats.drawn;
    if (!visual.leaving) this._drawAvatarLabel(ctx, camera, sample.pos, visual.tag, 0.026);
  }

  /** Tag above a figure, clamped to the viewport. */
  _drawAvatarLabel(ctx, camera, anchor, label, lift) {
    if (!label) return;
    const head = camera.project(mul(anchor, 1 + lift));
    if (!head || !head.visible) return;
    if (head.x < 10 || head.x > this.width - 10 || head.y < 10 || head.y > this.height - 10) return;
    ctx.fillStyle = 'rgba(225,250,255,0.82)';
    ctx.font = `8px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(label).toUpperCase().slice(0, 14), head.x, head.y - 10);
  }

  _drawSurfacePin(ctx, camera, entity) {
    const anchor = camera.project(mul(entity.pos, 1.001));
    if (!anchor || !anchor.visible) return;
    const color = entity.tint || (entity.variant === 'supply' ? '#ffd166' : '#22ff88');
    const supply = entity.variant === 'supply';
    const height = supply ? 52 : 22;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = supply ? 1.2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(anchor.x, anchor.y - height);
    ctx.stroke();
    const tip = anchor.y - height - 10;
    ctx.beginPath();
    ctx.moveTo(anchor.x, tip - 6);
    ctx.lineTo(anchor.x + 6, tip + 1);
    ctx.lineTo(anchor.x, tip + 8);
    ctx.lineTo(anchor.x - 6, tip + 1);
    ctx.closePath();
    ctx.fill();
    if (supply && entity.label) {
      ctx.fillStyle = '#f3ffff';
      ctx.font = `8px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(entity.label).toUpperCase(), anchor.x, tip - 8);
    }
    ctx.restore();
  }

  /** Expire beams past their TTL and drop beams whose cell disappeared. */
  _pruneSurfaceBeams(serverNow) {
    if (!this.beams.length) return;
    const kept = [];
    for (const beam of this.beams) {
      // A beam created between two frames can look slightly "younger" than the
      // frame clock; clamp to zero instead of dropping it as out of range.
      const age = Math.max(0, serverNow - beam.startAt);
      if (age > beam.ttlMs) continue;
      if (!this._leafCentroid(beam.toLeaf)) {
        this._surfaceVisual.droppedBeams += 1;
        continue;
      }
      kept.push(beam);
    }
    this.beams = kept;
  }

  /**
   * Beams are rendered strictly from `surface_mine` frames: an arc from the
   * peer's authoritative pose to the exact leaf the server changed, with an
   * impact ring and an off-screen chevron when the cell is not in view.
   */
  _drawSurfaceBeams(ctx, camera, rm, serverNow) {
    if (!this.beams.length) return;
    const W = this.width;
    const H = this.height;
    for (const beam of this.beams) {
      const target = this._leafCentroid(beam.toLeaf);
      if (!target) {
        this._surfaceVisual.droppedBeams += 1;
        continue;
      }
      const age = Math.max(0, serverNow - beam.startAt);
      const life = clamp(1 - age / beam.ttlMs, 0, 1);
      if (life <= 0) continue;
      const from = add(beam.from, mul(norm(beam.from), 0.0105));
      const arc = [];
      const steps = rm ? 3 : 8;
      let offscreen = false;
      for (let i = 0; i <= steps; i += 1) {
        const k = i / steps;
        const point = slerpPos(from, target, k);
        // Gentle arc above the crust.
        const lifted = add(point, mul(norm(point), Math.sin(k * Math.PI) * 0.012));
        const projected = camera.project(lifted);
        if (!projected || !projected.visible) {
          offscreen = true;
          break;
        }
        arc.push(projected);
        if (projected.x < 8 || projected.y < 8 || projected.x > W - 8 || projected.y > H - 8) offscreen = true;
      }
      const color = parseColor(beam.color);
      const impact = camera.project(mul(target, 1.002));
      ctx.save();
      if (life > 0 && arc.length > 2) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = rm ? 0.5 : 0.28 + 0.55 * life;
        ctx.strokeStyle = rgba(color, 0.9);
        ctx.lineWidth = rm ? 1.4 : 2.2;
        ctx.beginPath();
        ctx.moveTo(arc[0].x, arc[0].y);
        for (let i = 1; i < arc.length; i += 1) ctx.lineTo(arc[i].x, arc[i].y);
        ctx.stroke();
        // Second faint pass gives the beam a soft edge without shadowBlur.
        ctx.globalAlpha = (rm ? 0.22 : 0.18) * life;
        ctx.lineWidth = rm ? 3 : 6;
        ctx.stroke();
      }
      if (impact && impact.visible) {
        const pulse = rm ? 0.5 : 0.5 + 0.5 * Math.sin(this.t * 6 + beam.startAt * 0.001);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(life, 0, 1) * 0.85;
        ctx.strokeStyle = rgba(color, 0.95);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(impact.x, impact.y, 4 + pulse * 9, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba(color, 0.9);
        ctx.beginPath();
        ctx.arc(impact.x, impact.y, 2.2, 0, TAU);
        ctx.fill();
      }
      if (offscreen && !rm) this._drawOffscreenBeamIndicator(ctx, camera, beam, color, life);
      ctx.restore();
      this._surfaceVisual.beams += 1;
    }
    ctx.globalAlpha = 1;
  }

  /** Canvas edge chevron for a beam whose authoritative cell is out of view. */
  _drawOffscreenBeamIndicator(ctx, camera, beam, color, life) {
    const target = this._leafCentroid(beam.toLeaf);
    if (!target) return;
    const axis = typeof camera.viewAxis === 'function' ? camera.viewAxis() : null;
    let dx = target.x - (axis ? axis.x : 0);
    let dy = target.y - (axis ? axis.y : 0);
    let dz = target.z - (axis ? axis.z : 0);
    const right = typeof camera.unprojectView === 'function' ? camera.unprojectView({ x: 1, y: 0, z: 0 }) : { x: 1, y: 0, z: 0 };
    const upv = typeof camera.unprojectView === 'function' ? camera.unprojectView({ x: 0, y: 1, z: 0 }) : { x: 0, y: 1, z: 0 };
    const sx = dx * right.x + dy * right.y + dz * right.z;
    const sy = -(dx * upv.x + dy * upv.y + dz * upv.z);
    const len = Math.hypot(sx, sy) || 1;
    const W = this.width;
    const H = this.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.44;
    const ex = clamp(cx + (sx / len) * radius, 18, W - 18);
    const ey = clamp(cy + (sy / len) * radius, 18, H - 18);
    const angle = Math.atan2(sy / len, sx / len);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.5 * life;
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    ctx.fillStyle = rgba(color, 0.95);
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Discovered resource pins: a small diamond per authoritative resourceId. */
  _drawResourcePins(ctx, camera) {
    if (!this.resourcePins.length) return;
    for (const pin of this.resourcePins) {
      const centroid = this._leafCentroid(pin.label);
      if (!centroid) continue;
      const p = camera.project(mul(centroid, 1.002));
      if (!p || !p.visible) continue;
      const resource = resourceById(pin.resourceId);
      const color = parseColor(resource ? resource.color : '#ffd166');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = rgba(color, 0.95);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 5);
      ctx.lineTo(p.x + 4, p.y);
      ctx.lineTo(p.x, p.y + 5);
      ctx.lineTo(p.x - 4, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Tractor cone + ore sparks for an authoritative harvest success. */
  _drawSurfaceHarvest(ctx, W, H) {
    const effects = this.surfaceEffects;
    if (!effects || !effects.length) return;
    for (let i = 0; i < effects.length; i += 1) {
      const effect = effects[i];
      const k = clamp(Number.isFinite(effect.age) ? effect.age : 0, 0, 1);
      const x = W / 2;
      const y = H * 0.69;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,255,190,${0.18 * (1 - k)})`;
      ctx.beginPath();
      ctx.moveTo(x - 18, 0);
      ctx.lineTo(x + 18, 0);
      ctx.lineTo(x + 90, y);
      ctx.lineTo(x - 90, y);
      ctx.closePath();
      ctx.fill();
      for (let j = 0; j < 22; j += 1) {
        const a = (j / 22) * Math.PI * 2 + k * 2;
        const r = 18 + k * 130 + (j % 4) * 9;
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.fillStyle = effect.color || '#ffe066';
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45 - 20);
        ctx.lineTo(x + Math.cos(a + 0.18) * (r + 9), y + Math.sin(a + 0.18) * (r + 9) * 0.45 - 20);
        ctx.lineTo(x + Math.cos(a - 0.18) * (r + 9), y + Math.sin(a - 0.18) * (r + 9) * 0.45 - 20);
        ctx.closePath();
        ctx.fill();
      }
      if (effect.value > 0) {
        ctx.globalAlpha = 0.9 * (1 - k);
        ctx.fillStyle = effect.color || '#ffe066';
        ctx.font = `700 14px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.fillText(`+${effect.value} ${effect.name}`, x, y - 52 - k * 42);
      }
      ctx.restore();
      drawTetraShip(ctx, {
        x: W / 2,
        y: H * 0.07 + Math.sin(k * Math.PI) * 8,
        scale: 0.55,
        yaw: 0.6 + k,
        pitch: -0.4,
        hull: '#e8fbff',
        fin: effect.color || '#ffe066',
        edge: '#bffaff',
        glow: effect.color || '#ffe066',
        alpha: 0.55 * (1 - k),
        engine: false,
        shadow: false,
      });
    }
    ctx.globalAlpha = 1;
  }

  /** The landing/leaving ship is part of the same surface draw path. */
  _drawSurfaceShip(ctx, W, H, rm) {
    const phase = this.surfacePhase;
    if (phase === 'landing') {
      const k = clamp(this.surfaceProgress, 0, 1);
      drawTetraShip(ctx, {
        x: W / 2,
        y: -80 + (H * 0.57 + 100) * k,
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
    } else if (phase === 'leaving') {
      const k = clamp(this.surfaceProgress, 0, 1);
      drawTetraShip(ctx, {
        x: W / 2 + k * 160,
        y: H * 0.62 - k * H * 0.8,
        scale: 1.2 + k * 1.8,
        yaw: 0.7 + k * 2,
        pitch: -0.4,
        glow: '#55eaff',
        alpha: 1 - k * 0.3,
      });
    }
  }

  _drawSphere(ctx, camera, cx, cy, R, rm, glassFade) {
    const W = this.width;
    const H = this.height;
    const faces = this._activeFaces();
    const nf = faces.length;
    const styles = this._styles;
    const Kx = this._Kx;
    const Ky = this._Ky;
    const Kz = this._Kz;
    const cosA = this._cosA;
    const sinA = this._sinA;
    const cosGB = this._cosGB;
    const sinGB = this._sinGB;

    this._ensureBuffers();
    const dotZ = this._dotZ;
    const vis = this._visList;

    // --- Dark glass substrate clipped to the sphere silhouette. ------
    const discKey = `${Math.round(cx)}|${Math.round(cy)}|${Math.round(R)}`;
    if (this._sphereDiscKey !== discKey) {
      this._sphereDiscKey = discKey;
      const d = ctx.createRadialGradient(cx - R * 0.14, cy - R * 0.18, R * 0.06, cx, cy, R * 1.02);
      d.addColorStop(0, 'rgba(4,1,16,0.86)');
      d.addColorStop(0.55, 'rgba(5,1,18,0.78)');
      d.addColorStop(0.86, 'rgba(8,3,26,0.62)');
      d.addColorStop(1, 'rgba(10,4,30,0.2)');
      this._sphereDisc = d;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, R), 0, TAU);
    ctx.clip();
    ctx.fillStyle = this._sphereDisc;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // --- Back hemisphere wireframe (cheap hologram scaffold). --------
    const backFade = clamp(1 - (this._zoom - 6) / 8, 0, 1);
    if (!this.surfaceView && !this.opaqueSurface && backFade > 0.02) {
      const backPath = new Path2D();
      let backCount = 0;
      if (nf <= 800) {
        // Authentic back-face wireframe of the actual leaves.
        const backFadeInner = backFade;
        for (let i = 0; i < nf; i++) {
          const e = faces[i];
          const c = e.centroid;
          const dotc = c.x * Kx + c.y * Ky + c.z * Kz;
          const cosBack = cosGB * e.cosTheta + sinGB * e.sinTheta;
          if (dotc > cosBack) continue; // not a back candidate
          if (e.depth > 3) continue;
          const sr = (R * this._d * e.sinTheta) / Math.max(1e-6, this._d - dotc);
          if (e.depth >= 2 && sr < 1.5 * (nf / 400)) continue;
          if (this._addBackTri(backPath, e, camera, W, H)) backCount++;
        }
        if (backCount) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = backFadeInner;
          ctx.strokeStyle = rgba(CYAN, 0.05);
          ctx.lineWidth = 0.5;
          ctx.stroke(backPath);
          ctx.restore();
        }
      } else {
        // Dense worlds: draw a static coarse geodesic cage instead (much cheaper).
        const cage = this._getCage();
        for (let i = 0; i < cage.length; i++) {
          const f = cage[i];
          const c = f.centroid;
          if (c.x * Kx + c.y * Ky + c.z * Kz > 0.02) continue;
          if (this._addCageTri(backPath, f, camera, W, H)) backCount++;
        }
        if (backCount) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = backFade * 0.9;
          ctx.strokeStyle = rgba(CYAN, 0.045);
          ctx.lineWidth = 0.45;
          ctx.stroke(backPath);
          ctx.restore();
        }
      }
    }

    // --- Cull + project front candidates. ---------------------------
    let vc = 0;
    for (let i = 0; i < nf; i++) {
      const e = faces[i];
      if (this.surfaceView) {
        // Show the local crust around the pilot, not the whole planet's far
        // fan. culling is by angular distance from the camera's surface origin.
        const origin = camera && camera.origin;
        if (origin && e.centroid.x * origin.x + e.centroid.y * origin.y + e.centroid.z * origin.z < 0.35) continue;
        if (this.opaqueSurface && origin && e.centroid.x * origin.x + e.centroid.y * origin.y + e.centroid.z * origin.z <= 0) continue;
        if (!this._projectEntry(e, camera, W, H)) { this._stats.culled += 1; continue; }
        let sumZ = 0;
        for (let k = 0; k < e.n; k += 1) sumZ += e.pz[k];
        dotZ[i] = sumZ / Math.max(1, e.n);
        vis[vc++] = i;
        continue;
      }
      const c = e.centroid;
      const dotc = c.x * Kx + c.y * Ky + c.z * Kz;
      if (this.opaqueSurface && dotc <= 0) continue;
      const ct = e.cosTheta;
      const st = e.sinTheta;
      if (dotc >= cosA * ct - sinA * st) {
        if (!this._projectEntry(e, camera, W, H)) { this._stats.culled += 1; continue; }
        dotZ[i] = dotc;
        vis[vc++] = i;
      }
    }
    this._visCount = vc;

    // Depth sort (far → near). Leaves tile the sphere, so this is cheap and
    // only fixes edge-glow overdraw order.
    vis.subarray(0, vc).sort((a, b) => (this.surfaceView ? dotZ[b] - dotZ[a] : dotZ[a] - dotZ[b]));

    // --- Fills + edge buckets. --------------------------------------
    const buckets = this._buckets;
    buckets.fill(null);
    const nearBreak = this._nearBreak;
    nearBreak.fill(null);
    const lockedEdges = new Path2D();
    const px = this._polyX;
    const py = this._polyY;
    const hoverLabel = this.hoverLabel;
    let hoverNp = 0;
    this._hoverEntry = null;
    const useGradient = nf <= 96;
    const depthEdgeScale = DEPTH_EDGE_SCALE;
    const lowDensity = nf <= 900;
    const edgeWidthScale = lowDensity ? 1 : 0.82;
    const wScale = clamp(Math.min(W, H) / 900, 0.8, 1.3) * edgeWidthScale;
    const thr = this.threshold > 0 ? this.threshold : 1;

    for (let idx = 0; idx < vc; idx++) {
      const faceIdx = vis[idx];
      const e = faces[faceIdx];
      const dotc = dotZ[faceIdx];
      const band = this.surfaceView ? clamp(Math.floor((1 - Math.min(1, dotc)) * 5), 0, 5) : clamp(Math.floor(dotc * 6), 0, 5);

      let np;
      if (e.allFront) {
        np = e.n;
        const srcX = e.px;
        const srcY = e.py;
        for (let k = 0; k < np; k++) {
          px[k] = srcX[k];
          py[k] = srcY[k];
        }
      } else {
        np = this._clipEntryPoly(e, camera, px, py);
      }
      if (np < 3) continue;

      // Centroid + radius of the drawn polygon.
      let mx = 0;
      let my = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let k = 0; k < np; k++) {
        const x = px[k];
        const y = py[k];
        mx += x;
        my += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      mx /= np;
      my /= np;
      const sr = Math.max(maxX - minX, maxY - minY) * 0.5;
      e.sr = sr;
      e.fx = mx;
      e.fy = my;
      e.visFrame = this.frame;
      if (sr < 0.9) continue;
      // Sub-pixel cells fade out instead of turning the lattice into noise.
      const lodAlpha = sr < 3 ? 0.28 : sr < 7 ? 0.45 : sr < 12 ? 0.8 : 1;

      const sid = this._styleIndex(e.ownerIndex);
      const style = styles[sid];
      const isMine = this.myIndex >= 0 && e.ownerIndex === this.myIndex;
      const lockedToMe = isMine && e.lastClickIndex === this.myIndex;
      const frac = clamp(e.clicks / thr, 0, 1);
      const huge = sr > Math.min(W, H) * 0.6;
      const tier = clamp(Math.round(frac * (CHARGE_TIERS - 1)), 0, CHARGE_TIERS - 1);
      const fillIdx = band * CHARGE_TIERS + tier;

      ctx.beginPath();
      ctx.moveTo(px[0], py[0]);
      for (let k = 1; k < np; k++) ctx.lineTo(px[k], py[k]);
      ctx.closePath();

      const terrain = e.terrain;
      ctx.globalAlpha = this.opaqueSurface ? 1 : lodAlpha;
      if (this.opaqueSurface && terrain && e.terrainRgb) {
        ctx.fillStyle = `rgb(${e.terrainRgb.r},${e.terrainRgb.g},${e.terrainRgb.b})`;
        ctx.fill();
      } else if (terrain && this.surfaceView) {
        // Crust view: show the biome, not a full-cell player-colour wash.
        ctx.fillStyle = e.terrainFill;
        ctx.fill();
        if (e.ownerIndex >= 0 && style.overlayC[fillIdx]) {
          ctx.globalAlpha = lodAlpha * 0.04;
          ctx.fillStyle = style.overlayC[fillIdx];
          ctx.fill();
          ctx.globalAlpha = lodAlpha;
        }
      } else if (terrain) {
        // Low-poly biome underlay: strong on unclaimed cells, translucent under
        // the player-colour claim tint so ownership stays readable.
        const owned = e.ownerIndex >= 0;
        ctx.globalAlpha = lodAlpha * (0.82 + 0.18 * (band / 5));
        ctx.fillStyle = owned ? e.terrainFillOwned : e.terrainFill;
        ctx.fill();
        ctx.globalAlpha = lodAlpha;
        if (owned && style.overlayC[fillIdx]) {
          ctx.fillStyle = style.overlayC[fillIdx];
          ctx.fill();
        }
        // Subtle water sheen on large ocean cells.
        if (terrain.isOcean && useGradient) {
          const sheen = ctx.createRadialGradient(
            mx - sr * 0.22, my - sr * 0.28, 0,
            mx, my, Math.max(6, sr * 1.2),
          );
          sheen.addColorStop(0, 'rgba(170,240,255,0.18)');
          sheen.addColorStop(0.55, 'rgba(90,180,230,0.06)');
          sheen.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sheen;
          ctx.fill();
        }
      } else if (useGradient) {
        let maxD = 0;
        for (let k = 0; k < np; k++) {
          const dx = px[k] - mx;
          const dy = py[k] - my;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxD) maxD = d2;
        }
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(3, Math.sqrt(maxD)));
        const baseA = style.isUnowned ? 0.03 + 0.02 * (band / 5) : 0.1 + 0.05 * (band / 5) + 0.05 * frac;
        grad.addColorStop(0, rgba(style.rgb, baseA * (style.isUnowned ? 0.5 : 0.78)));
        grad.addColorStop(1, rgba(style.rgb, baseA * (style.isUnowned ? 1.9 : 1.35)));
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        ctx.fillStyle = style.fillC[fillIdx];
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Locked-to-me cell: red wash = contested play and only others can act.
      if (lockedToMe) {
        ctx.globalAlpha = lodAlpha * 0.52;
        ctx.fillStyle = 'rgb(255,38,82)';
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Huge cells (deep zoom): energise the interior so the view never goes
      // flat — additive fill, core halo, spokes toward the vertices, reticle.
      const hugeRgb = terrain && e.ownerIndex < 0 ? e.terrainRgb : style.rgb;
      if (huge) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(hugeRgb, style.isUnowned ? 0.05 : 0.1);
        ctx.fill();
        const haloR = Math.min(W, H) * 0.62;
        const halo = ctx.createRadialGradient(mx, my, 0, mx, my, haloR);
        halo.addColorStop(0, rgba(hugeRgb, style.isUnowned ? 0.08 : 0.15));
        halo.addColorStop(0.5, rgba(hugeRgb, 0.04));
        halo.addColorStop(1, rgba(hugeRgb, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(mx - haloR, my - haloR, haloR * 2, haloR * 2);
        const segs = e.segs;
        const corners = [0, segs, segs * 2];
        // Interior hologram scaffold: a local grid + scanner rings clipped to the
        // cell so a face that fills the screen still reads as a surface, not a
        // flat colour plate.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px[0], py[0]);
        for (let k = 1; k < np; k++) ctx.lineTo(px[k], py[k]);
        ctx.closePath();
        ctx.clip();
        const step = 66;
        ctx.strokeStyle = rgba(mixRgb(hugeRgb, CYAN, 0.5), 0.06);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let gx = mx - W; gx <= mx + W; gx += step) {
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, H);
        }
        for (let gy = my - H; gy <= my + H; gy += step) {
          ctx.moveTo(0, gy);
          ctx.lineTo(W, gy);
        }
        ctx.stroke();
        ctx.strokeStyle = rgba(mixRgb(hugeRgb, WHITE, 0.4), 0.06);
        ctx.lineWidth = 0.9;
        ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = -this.t * 12;
        ctx.beginPath();
        for (let ri = 1; ri <= 4; ri++) {
          ctx.moveTo(mx + 58 * ri, my);
          ctx.arc(mx, my, 58 * ri, 0, TAU);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.strokeStyle = rgba(mixRgb(hugeRgb, WHITE, 0.35), 0.28);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 0; c < 3; c++) {
          const ci = corners[c];
          const dx = e.px[ci] - mx;
          const dy = e.py[ci] - my;
          const len2 = Math.hypot(dx, dy);
          if (len2 < 1) continue;
          const ux2 = dx / len2;
          const uy2 = dy / len2;
          const inner = 22;
          const outer = inner + Math.min(110, len2 * 0.18);
          ctx.moveTo(mx + ux2 * inner, my + uy2 * inner);
          ctx.lineTo(mx + ux2 * outer, my + uy2 * outer);
        }
        ctx.stroke();
        // Reticle core.
        const rp = 0.5 + 0.5 * Math.sin(this.t * 2.2);
        ctx.strokeStyle = rgba(mixRgb(hugeRgb, WHITE, 0.5), 0.5 + 0.25 * rp);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(mx, my, 12 + 2 * rp, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let c = 0; c < 4; c++) {
          const ang = c * HALF_PI + Math.PI / 4;
          ctx.moveTo(mx + Math.cos(ang) * 18, my + Math.sin(ang) * 18);
          ctx.lineTo(mx + Math.cos(ang) * 26, my + Math.sin(ang) * 26);
        }
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = lodAlpha;
      }
      ctx.globalAlpha = 1;

      // Freshly spawned children flash white as they pop in.
      const bornAge = this.t - e.born;
      if (bornAge >= 0 && bornAge < 0.42) {
        const a = (1 - bornAge / 0.42) ** 1.4;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(WHITE, 0.5 * a);
        ctx.fill();
        ctx.restore();
      }

      if (hoverLabel !== null && e.label === hoverLabel) {
        this._hoverEntry = e;
        hoverNp = Math.min(np, this._hoverX.length);
        for (let k = 0; k < hoverNp; k++) {
          this._hoverX[k] = px[k];
          this._hoverY[k] = py[k];
        }
      }

      // Near-breaking cells pulse.
      if (frac >= 0.75 && !style.isUnowned) {
        let nb = nearBreak[sid];
        if (!nb) {
          nb = new Path2D();
          nearBreak[sid] = nb;
        }
        nb.moveTo(px[0], py[0]);
        for (let k = 1; k < np; k++) nb.lineTo(px[k], py[k]);
        nb.closePath();
      }

      // Batch edges by owner style + depth bucket + depth tier. One thin
      // owner-coloured stroke per face; no bloom pass, no inner border.
      const depthBucket = e.depth >= 3 ? 3 : e.depth;
      const zTier = dotc >= 0.4 ? 1 : 0;
      const key = sid * 8 + depthBucket * 2 + zTier;
      let edgePath = buckets[key];
      if (!edgePath) {
        edgePath = new Path2D();
        buckets[key] = edgePath;
      }
      edgePath.moveTo(px[0], py[0]);
      for (let k = 1; k < np; k++) edgePath.lineTo(px[k], py[k]);
      edgePath.closePath();
      if (lockedToMe) {
        lockedEdges.moveTo(px[0], py[0]);
        for (let k = 1; k < np; k++) lockedEdges.lineTo(px[k], py[k]);
        lockedEdges.closePath();
      }
    }
    this._hoverNp = hoverNp;

    // --- Crisp edges: one thin owner-coloured stroke per face. --------
    const edgeAlpha = nf >= 1400 ? 0.9 : nf >= 800 ? 0.95 : 1;
    const depthAlpha = [1, 0.92, 0.82, 0.66];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let key = 0; key < buckets.length; key++) {
      const path = buckets[key];
      if (!path) continue;
      const sid = (key / 8) | 0;
      const rest = key - sid * 8;
      const depthBucket = rest >> 1;
      const zTier = rest & 1;
      const st = styles[sid];
      if (!st) continue;
      const ai = zTier ? 4 : 1;
      ctx.globalAlpha = edgeAlpha * depthAlpha[depthBucket];
      ctx.strokeStyle = st.edgeCore[ai];
      ctx.lineWidth = Math.max(0.35, st.coreW * wScale * depthEdgeScale[depthBucket]);
      ctx.stroke(path);
    }
    // Locked cells get a clear red edge in addition to their owner colour.
    ctx.strokeStyle = 'rgba(255,38,82,0.98)';
    ctx.lineWidth = Math.max(1.4, 1.9 * wScale);
    ctx.stroke(lockedEdges);

    // Near-break cells keep a subtle charge pulse via the fill only.
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
    for (let sid = 0; sid < nearBreak.length; sid++) {
      const nb = nearBreak[sid];
      if (!nb) continue;
      const st = styles[sid];
      if (!st) continue;
      ctx.fillStyle = rgba(st.isMine ? WHITE : st.rgb, rm ? 0.05 : 0.07 + 0.1 * pulse);
      ctx.fill(nb);
    }
    ctx.restore();

    // --- Hover highlight (white flash + layered glow). --------------
    if (this._hoverNp >= 3) {
      const hx = this._hoverX;
      const hy = this._hoverY;
      const hn = this._hoverNp;
      const hoverEntry = this._hoverEntry;
      const hoverHuge = !!hoverEntry && hoverEntry.sr > Math.min(W, H) * 0.6;
      const flash = 0.5 + 0.5 * Math.sin(this.t * 9);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(hx[0], hy[0]);
      for (let k = 1; k < hn; k++) ctx.lineTo(hx[k], hy[k]);
      ctx.closePath();
      // A cell filling the viewport must not wash the frame white.
      ctx.fillStyle = rgba(WHITE, hoverHuge ? 0.02 : (rm ? 0.16 : 0.14 + 0.18 * flash));
      ctx.fill();
      const widths = hoverHuge ? [6, 3, 1.3] : [7, 3, 1.4];
      const alphas = hoverHuge ? [0.09, 0.2, 0.8] : [0.12, 0.25, 0.95];
      for (let s = 0; s < widths.length; s++) {
        ctx.strokeStyle = rgba(WHITE, alphas[s] * (rm ? 0.6 : 1));
        ctx.lineWidth = widths[s] * wScale;
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- Glass: rim light, sheen, sweep, scanlines (faded at deep zoom).
    // Surface mode must not draw a whole-planet glass dome over the crust.
    if (!this.surfaceView && glassFade > 0.01 && this.perf.tier > 0) this._drawSphereFx(ctx, cx, cy, R, rm, nf, glassFade);

    // --- Silhouette ring. -------------------------------------------
    if (!this.surfaceView && glassFade > 0.01 && R < Math.max(W, H) * 2.5) {
      ctx.save();
      ctx.globalAlpha = glassFade;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(CYAN, 0.34);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(CYAN, 0.05);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(228,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -2.55, -1.7);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(228,255,255,0.06)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,43,214,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 1.8, -0.3, Math.PI * 0.92);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,240,255,0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, R - 1.8, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
      ctx.restore();
    }
  }

  _addBackTri(path, entry, camera, W, H) {
    if (!entry.a || !entry.b || !entry.c) return false;
    const tmp = this._tmpV;
    const verts = [entry.a, entry.b, entry.c];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const xs = this._scrPX;
    const ys = this._scrPY;
    for (let i = 0; i < 3; i++) {
      tmp.x = verts[i].x;
      tmp.y = verts[i].y;
      tmp.z = verts[i].z;
      const pr = camera.project(tmp);
      xs[i] = pr.x;
      ys[i] = pr.y;
      if (pr.x < minX) minX = pr.x;
      if (pr.x > maxX) maxX = pr.x;
      if (pr.y < minY) minY = pr.y;
      if (pr.y > maxY) maxY = pr.y;
    }
    if (maxX < -2 || minX > W + 2 || maxY < -2 || minY > H + 2) return false;
    path.moveTo(xs[0], ys[0]);
    path.lineTo(xs[1], ys[1]);
    path.lineTo(xs[2], ys[2]);
    path.closePath();
    return true;
  }

  _addCageTri(path, f, camera, W, H) {
    const tmp = this._tmpV;
    const verts = [f.a, f.b, f.c];
    let inside = false;
    const xs = this._scrPX;
    const ys = this._scrPY;
    for (let i = 0; i < 3; i++) {
      tmp.x = verts[i].x;
      tmp.y = verts[i].y;
      tmp.z = verts[i].z;
      const pr = camera.project(tmp);
      xs[i] = pr.x;
      ys[i] = pr.y;
      if (pr.x > -4 && pr.x < W + 4 && pr.y > -4 && pr.y < H + 4) inside = true;
    }
    if (!inside) return false;
    path.moveTo(xs[0], ys[0]);
    path.lineTo(xs[1], ys[1]);
    path.lineTo(xs[2], ys[2]);
    path.closePath();
    return true;
  }

  _getCage() {
    if (!this._cage) {
      const mesh = getMesh(2);
      this._cage = mesh.faces.map((f) => ({ a: f.a, b: f.b, c: f.c, centroid: f.centroid }));
    }
    return this._cage;
  }

  /* ================================================================ *
   * Labels, charge arcs, hover chip
   * ================================================================ */

  _drawResourceMarkers(ctx) {
    const vc = this._visCount;
    if (!vc) return;
    const faces = this._activeFaces();
    const vis = this._visList;
    const W = this.width;
    const H = this.height;
    const list = this._markerScratch;
    list.length = 0;
    for (let idx = 0; idx < vc; idx++) {
      const e = faces[vis[idx]];
      if (!e.resource || e.visFrame !== this.frame) continue;
      if (e.sr < 9) continue;
      if (e.fx < -30 || e.fx > W + 30 || e.fy < -30 || e.fy > H + 30) continue;
      list.push(e);
    }
    if (!list.length) return;
    // Clutter cap: keep only the biggest on-screen deposits.
    if (list.length > 140) {
      list.sort((a, b) => b.sr - a.sr);
      list.length = 140;
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const res = e.resource;
      const rgb = e.resRgb || CYAN;
      const fade = clamp((e.sr - 9) / 14, 0, 1);
      const popAge = this.t - e.foundAt;
      const pop = popAge < 0 || popAge > 0.45 ? 1 : 0.3 + 0.7 * (popAge / 0.45);
      const twinkle = 0.84 + 0.16 * Math.sin(this.t * 2.2 + e.label.length);
      const alpha = clamp(fade * twinkle * pop, 0, 1);
      if (alpha < 0.04) continue;
      const hugeMarker = e.sr > Math.min(W, H) * 0.6;
      const d = hugeMarker ? 24 : clamp(e.sr * 0.12, 5, 13);
      const glyphSize = hugeMarker ? 22 : clamp(d * 1.2, 8, 16);
      ctx.save();
      ctx.translate(e.fx, e.fy);
      // Soft resource halo + one crisp diamond outline.
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(rgb, 0.1 * alpha);
      ctx.beginPath();
      ctx.arc(0, 0, d * 2.1, 0, TAU);
      ctx.fill();
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-d * 0.72, -d * 0.72, d * 1.44, d * 1.44);
      ctx.fillStyle = rgba(rgb, 0.22 * alpha);
      ctx.fill();
      ctx.strokeStyle = rgba(mixRgb(rgb, WHITE, 0.35), 0.92 * alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // Glyph (e.g. Au, U, My).
      ctx.font = `700 ${glyphSize}px ${FONT_STACK}`;
      ctx.lineWidth = Math.max(2.5, glyphSize * 0.3);
      ctx.strokeStyle = `rgba(2,0,10,${0.8 * alpha})`;
      ctx.strokeText(res.glyph, e.fx, e.fy + 0.5);
      ctx.fillStyle = rgba(mixRgb(rgb, WHITE, 0.5), alpha);
      ctx.fillText(res.glyph, e.fx, e.fy + 0.5);
      // Deep zoom: a faint scanner ring keeps the marker readable when the
      // host cell fills the viewport.
      if (hugeMarker) {
        ctx.strokeStyle = rgba(rgb, 0.22 * alpha);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(e.fx, e.fy, d * 2.4, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba(rgb, 0.1 * alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(e.fx, e.fy, d * 3.4, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawLabels(ctx, camera) {
    if (!this._activeFaces().length) return;
    this._prunePulseLabels();
    const vc = this._visCount;
    if (!vc) return;
    const hoverLabel = this.hoverLabel;
    const faces = this._activeFaces();
    const vis = this._visList;
    const W = this.width;
    const H = this.height;
    const pulseLabels = this._pulseLabels;

    const drawLabel = (e, size, hovered) => {
      if (e.visFrame !== this.frame || e.sr < 3) return;
      if (e.fx < -40 || e.fx > W + 40 || e.fy < -40 || e.fy > H + 40) return;
      const style = this._styles[this._styleIndex(e.ownerIndex)];
      if (!style) return;
      const color = style.isUnowned
        ? 'rgba(215,250,255,0.92)'
        : rgba(mixRgb(style.rgb, WHITE, 0.55), 0.97);
      const tx = e.fx;
      const hugeCell = e.sr > Math.min(W, H) * 0.6;
      const ty = hovered ? e.fy - (hugeCell ? 40 : 24) : e.fy;
      ctx.font = `700 ${size}px ${FONT_STACK}`;
      ctx.lineWidth = Math.max(3, size * 0.3);
      ctx.strokeStyle = 'rgba(2,0,10,0.82)';
      ctx.strokeText(e.label, tx, ty);
      ctx.fillStyle = color;
      ctx.fillText(e.label, tx, ty);
      if (hovered) {
        ctx.strokeStyle = rgba(WHITE, 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(this.t * 9)));
        ctx.lineWidth = 0.8;
        ctx.strokeText(e.label, tx, ty);
      }
    };

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Optional debug toggle (app L key): all visible ids, no permanent clutter
    // in normal play.
    if (this.labelsVisible) {
      for (let idx = 0; idx < vc; idx++) {
        const e = faces[vis[idx]];
        if (hoverLabel !== null && e.label === hoverLabel) continue;
        if (pulseLabels.has(e.label)) continue;
        const size = clamp(Math.round(10 + Math.sqrt(e.sr) * 0.5), 10, 26);
        drawLabel(e, size, false);
      }
    }

    // Interaction ids: faces with a click/break pulse in the last ~2s. These
    // always render, independently of the debug toggle.
    if (pulseLabels.size) {
      for (let idx = 0; idx < vc; idx++) {
        const e = faces[vis[idx]];
        if (!pulseLabels.has(e.label)) continue;
        if (hoverLabel !== null && e.label === hoverLabel) continue;
        drawLabel(e, 11, false);
      }
    }

    // Hovered face: small label near the centroid (detail lives in the HUD).
    if (hoverLabel !== null) {
      const e = this.byLabel.get(hoverLabel);
      if (e) drawLabel(e, 12, true);
    }
    ctx.restore();
  }

  _drawChargeArcs(ctx) {
    const vc = this._visCount;
    if (vc > 60 || !vc || !this._activeFaces().length) return;
    const thr = this.threshold > 0 ? this.threshold : 1;
    const faces = this._activeFaces();
    const vis = this._visList;
    const hugeThreshold = Math.min(this.width, this.height) * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let idx = 0; idx < vc; idx++) {
      const e = faces[vis[idx]];
      if (e.ownerIndex < 0 || e.clicks <= 0) continue;
      if (e.sr < 24) continue;
      const frac = clamp(e.clicks / thr, 0, 1);
      if (frac < 0.4) continue;
      const style = this._styles[this._styleIndex(e.ownerIndex)];
      if (!style || style.isUnowned) continue;
      const huge = e.sr > hugeThreshold;
      const r = huge ? 18 : clamp(e.sr * 0.18, 8, 40);
      const w1 = clamp(r * 0.16, 2.2, 5);
      ctx.beginPath();
      ctx.arc(e.fx, e.fy, r, 0, TAU);
      ctx.strokeStyle = 'rgba(2,0,10,0.4)';
      ctx.lineWidth = w1 * 1.25;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(e.fx, e.fy, r, -HALF_PI, -HALF_PI + TAU * frac);
      ctx.strokeStyle = rgba(mixRgb(style.rgb, WHITE, 0.25), 0.9);
      ctx.lineWidth = w1;
      ctx.stroke();
      if (frac >= 0.75) {
        ctx.beginPath();
        ctx.arc(e.fx, e.fy, r + Math.max(3, r * 0.12), -HALF_PI, -HALF_PI + TAU * frac);
        ctx.strokeStyle = rgba(WHITE, 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(this.t * 7)));
        ctx.lineWidth = Math.max(1, w1 * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ================================================================ *
   * Effects
   * ================================================================ */

  _drawPulses(ctx, camera, rm) {
    const pulses = this.pulses;
    if (!pulses.length) return;
    const px = this._pexX;
    const py = this._pexY;
    let textCount = 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let idx = pulses.length - 1; idx >= 0; idx--) {
      const p = pulses[idx];
      const age = this.t - p.start;
      if (age < 0 || age >= p.dur) {
        pulses.splice(idx, 1);
        continue;
      }
      const u = age / p.dur;
      const eased = 1 - (1 - u) ** 2.4;
      const steal = p.kind === 'steal';
      const broke = p.kind === 'break';
      const reinforce = p.kind === 'reinforce';
      const resourceKind = p.kind === 'resource';
      const hot = steal ? MAGENTA : broke ? ACID : p.rgb;

      const np = this._buildPulsePoly(p, camera, px, py);
      let fx;
      let fy;
      if (np >= 3) {
        fx = 0;
        fy = 0;
        for (let k = 0; k < np; k++) {
          fx += px[k];
          fy += py[k];
        }
        fx /= np;
        fy /= np;
      } else {
        const c = camera.project(p.centroid);
        fx = c.x;
        fy = c.y;
      }
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) continue;
      if (fx < -200 || fx > this.width + 200 || fy < -200 || fy > this.height + 200) continue;

      const maxA = rm ? 0.4 : 1;

      // Face flash.
      if (u < 0.4 && np >= 3) {
        const a = 1 - u / 0.4;
        ctx.beginPath();
        ctx.moveTo(px[0], py[0]);
        for (let k = 1; k < np; k++) ctx.lineTo(px[k], py[k]);
        ctx.closePath();
        ctx.fillStyle = broke
          ? rgba(WHITE, 0.5 * a)
          : steal
            ? rgba(WHITE, 0.46 * a)
            : rgba(resourceKind ? mixRgb(p.rgb, WHITE, 0.35) : p.rgb, resourceKind ? 0.34 * a : reinforce ? 0.18 * a : 0.3 * a);
        ctx.fill();
      }

      if (resourceKind) {
        // Mining burst: counter-rotating resource diamonds + four-point sparkles.
        const rot = rm ? 0.6 : this.t * 1.2;
        for (let r = 0; r < 3; r++) {
          const size = 12 + eased * 72 + r * 16;
          const a = ((1 - u) ** 1.6) * (0.85 / (1 + r * 0.9)) * maxA;
          if (a < 0.02) continue;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(rot * (r % 2 ? -1 : 1) + r * 0.4);
          ctx.strokeStyle = r === 0 ? rgba(WHITE, Math.min(0.95, a * 1.2)) : rgba(p.rgb, Math.min(0.9, a));
          ctx.lineWidth = r === 0 ? 2.2 : 1.2;
          ctx.beginPath();
          ctx.rect(-size * 0.5, -size * 0.5, size, size);
          ctx.stroke();
          ctx.restore();
        }
        if (!rm && u < 0.85) {
          const sparkA = (1 - u / 0.85) * 0.75;
          for (let j = 0; j < 8; j++) {
            const ang = (j * TAU) / 8 + rot * 1.6;
            const dist = 12 + eased * 72 + (j % 3) * 11;
            const sx = fx + Math.cos(ang) * dist;
            const sy = fy + Math.sin(ang) * dist;
            const ss = 3 + (j % 2) * 2;
            ctx.strokeStyle = rgba(mixRgb(p.rgb, WHITE, 0.55), sparkA);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - ss, sy);
            ctx.lineTo(sx + ss, sy);
            ctx.moveTo(sx, sy - ss);
            ctx.lineTo(sx, sy + ss);
            ctx.stroke();
          }
        }
      } else {
        // Expanding geodesic rings.
        const rings = broke ? 3 : steal ? 3 : reinforce ? 1 : 2;
        for (let r = 0; r < rings; r++) {
          const spread = 1 + (eased + r * 0.32) * (broke ? 2.0 : steal ? 1.9 : reinforce ? 0.9 : 1.35);
          const alpha = ((1 - u) ** 1.6) * (broke ? 0.95 : steal ? 0.95 : reinforce ? 0.4 : 0.7) / (1 + r * 0.9) * maxA;
          if (alpha < 0.02) continue;
          ctx.strokeStyle = r === 0
            ? rgba(broke ? WHITE : steal ? WHITE : p.rgb, Math.min(0.98, alpha * 1.25))
            : rgba(hot, Math.min(0.92, alpha));
          ctx.lineWidth = (r === 0 ? 2.6 : 1.3) * (1 - u * 0.45);
          if (np >= 3) {
            ctx.beginPath();
            for (let k = 0; k < np; k++) {
              const x = fx + (px[k] - fx) * spread;
              const y = fy + (py[k] - fy) * spread;
              if (k === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(fx, fy, 10 + eased * 34 + r * 9, 0, TAU);
            ctx.stroke();
          }
        }

        // Shatter shards for breaks.
        if (broke && !rm && u < 0.8) {
          const sA = (1 - u / 0.8) * 0.65;
          ctx.strokeStyle = rgba(WHITE, sA);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let j = 0; j < 10; j++) {
            const ang = j * 0.6283 + 0.3;
            const d0 = 8 + eased * 44 + (j % 3) * 9;
            const d1 = d0 + 12 + (j % 2) * 16;
            ctx.moveTo(fx + Math.cos(ang) * d0, fy + Math.sin(ang) * d0);
            ctx.lineTo(fx + Math.cos(ang) * d1, fy + Math.sin(ang) * d1);
          }
          ctx.stroke();
        } else if (!rm && !reinforce && u < 0.6) {
          const sparkA = (1 - u / 0.6) * (steal ? 0.7 : 0.5);
          ctx.strokeStyle = rgba(hot, sparkA);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let j = 0; j < 7; j++) {
            const ang = (p.label.length * 1.7 + j * 0.897 + u * 1.4) % TAU;
            const d0 = 6 + eased * 26 + (j % 3) * 7;
            const d1 = d0 + 9 + (j % 2) * 12;
            ctx.moveTo(fx + Math.cos(ang) * d0, fy + Math.sin(ang) * d0);
            ctx.lineTo(fx + Math.cos(ang) * d1, fy + Math.sin(ang) * d1);
          }
          ctx.stroke();
        }
      }

      // Floating text.
      if (p.text && textCount < 10) {
        textCount++;
        const alpha = clamp(u < 0.1 ? u / 0.1 : 1 - ((u - 0.1) / 0.9) ** 1.4, 0, 1) * (rm ? 0.85 : 1);
        if (alpha > 0.02) {
          const ty = fy - 20 - 58 * eased;
          const scale = 1.1 - 0.18 * u;
          const light = resourceKind
            ? mixRgb(p.rgb, WHITE, 0.35)
            : broke || steal
              ? WHITE
              : { r: Math.round(p.rgb.r + (255 - p.rgb.r) * 0.4), g: Math.round(p.rgb.g + (255 - p.rgb.g) * 0.4), b: Math.round(p.rgb.b + (255 - p.rgb.b) * 0.4) };
          ctx.save();
          ctx.translate(fx, ty);
          ctx.scale(scale, scale);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `800 21px ${FONT_STACK}`;
          ctx.lineWidth = 9;
          ctx.strokeStyle = rgba(hot, 0.2 * alpha);
          ctx.strokeText(p.text, 0, 0);
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = `rgba(2,0,10,${0.8 * alpha})`;
          ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = rgba(light, alpha);
          ctx.fillText(p.text, 0, 0);
          ctx.fillStyle = rgba(WHITE, alpha * 0.4);
          ctx.fillText(p.text, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  /** Project + horizon-clip a pulse's captured boundary into the pex buffers. */
  _buildPulsePoly(p, camera, outX, outY) {
    const n = p.n;
    if (!n) return 0;
    const wx = p.wx;
    const sx = this._scrPX;
    const sy = this._scrPY;
    const sz = this._scrPZ;
    if (sx.length < n + 4) {
      this._scrPX = new Float32Array(n + 4);
      this._scrPY = new Float32Array(n + 4);
      this._scrPZ = new Float32Array(n + 4);
    }
    const px = this._scrPX;
    const py = this._scrPY;
    const pz = this._scrPZ;
    const tmp = this._tmpV;
    let allFront = true;
    for (let k = 0; k < n; k++) {
      const o = k * 3;
      tmp.x = wx[o];
      tmp.y = wx[o + 1];
      tmp.z = wx[o + 2];
      const pr = camera.project(tmp);
      px[k] = pr.x;
      py[k] = pr.y;
      pz[k] = pr.z;
      if (pr.z <= 0.0005) allFront = false;
    }
    if (allFront) {
      for (let k = 0; k < n; k++) {
        outX[k] = px[k];
        outY[k] = py[k];
      }
      return n;
    }
    let m = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const zp = pz[i];
      const zq = pz[j];
      if (zp >= 0) {
        outX[m] = px[i];
        outY[m] = py[i];
        m++;
      }
      if ((zp >= 0) !== (zq >= 0) && Math.abs(zp - zq) > 1e-12) {
        const t = zp / (zp - zq);
        const oi = i * 3;
        const oj = j * 3;
        tmp.x = wx[oi] + (wx[oj] - wx[oi]) * t;
        tmp.y = wx[oi + 1] + (wx[oj + 1] - wx[oi + 1]) * t;
        tmp.z = wx[oi + 2] + (wx[oj + 2] - wx[oi + 2]) * t;
        const unit = normalize(tmp);
        const pr = camera.project(unit);
        outX[m] = pr.x;
        outY[m] = pr.y;
        m++;
      }
    }
    return m;
  }

  /* ================================================================ *
   * Cartography
   * ================================================================ */

  _drawGraticule(ctx, camera, fade) {
    const path = new Path2D();
    let segments = 0;
    const addPolyline = (pts) => {
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        const p = camera.project(pts[i]);
        if (p.visible) {
          if (prev) {
            path.moveTo(prev.x, prev.y);
            path.lineTo(p.x, p.y);
            segments++;
          }
          prev = p;
        } else {
          prev = null;
        }
      }
    };
    for (const circle of GRATICULE.latCircles) addPolyline(circle);
    for (const meridian of GRATICULE.meridians) addPolyline(meridian);
    if (!segments) return;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(CYAN, 0.055);
    ctx.stroke(path);
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'rgba(150,255,255,0.21)';
    ctx.stroke(path);
    ctx.restore();
  }

  _drawPoles(ctx, camera, cx, cy, fade) {
    if (this.poleLabelsVisible === false) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < POLES.length; i++) {
      const pole = POLES[i];
      const p = camera.project(pole.v);
      if (!(p.z > 0.02)) continue;
      if (p.x < -200 || p.x > this.width + 200 || p.y < -200 || p.y > this.height + 200) continue;
      const alpha = clamp(0.3 + p.z * 0.7, 0, 0.95) * (this.reducedMotion ? 0.85 : 1);

      let ux = p.x - cx;
      let uy = p.y - cy;
      const len = Math.hypot(ux, uy);
      if (len < 1) {
        ux = 0;
        uy = -1;
      } else {
        ux /= len;
        uy /= len;
      }
      const right = ux >= 0;
      const lx = p.x + ux * 22 + (right ? 6 : -6);
      const ly = p.y + uy * 26 + 3;

      ctx.strokeStyle = rgba(CYAN, alpha * 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x + ux * 6, p.y + uy * 6);
      ctx.lineTo(lx - (right ? 4 : -4), ly - 8);
      ctx.stroke();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = rgba(CYAN, alpha * 0.95);
      ctx.lineWidth = 1;
      ctx.strokeRect(-2.8, -2.8, 5.6, 5.6);
      ctx.fillStyle = rgba(WHITE, alpha * 0.55);
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
      ctx.strokeStyle = rgba(CYAN, alpha * 0.34);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7.5, 0, TAU);
      ctx.stroke();

      ctx.textAlign = right ? 'left' : 'right';
      try {
        ctx.letterSpacing = '0.7px';
      } catch (_) {
        /* ignore */
      }
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 4;
      ctx.font = `700 11px ${FONT_STACK}`;
      ctx.fillStyle = rgba(WHITE, alpha * 0.92);
      ctx.fillText(`${pole.name} ${pole.latLabel}`, lx, ly);
      ctx.font = `500 9.5px ${FONT_STACK}`;
      ctx.fillStyle = rgba(CYAN, alpha * 0.72);
      ctx.fillText('LON 0.0000', lx, ly + 13);
      ctx.shadowBlur = 0;
      try {
        ctx.letterSpacing = '0px';
      } catch (_) {
        /* ignore */
      }
    }
    ctx.restore();
  }

  /* ================================================================ *
   * Backdrop / atmosphere (shared hologram stack)
   * ================================================================ */

  _seedStarfield() {
    const W = this.width;
    const H = this.height;
    const count = clamp(Math.round((W * H) / 7200), 70, 300);
    this._starCount = count;
    this._stars = new Float32Array(count * 5);
    for (let i = 0; i < count; i++) {
      const o = i * 5;
      this._stars[o] = Math.random();
      this._stars[o + 1] = Math.random();
      this._stars[o + 2] = Math.random();
      this._stars[o + 3] = 0.35 + Math.random() * 1.25;
      this._stars[o + 4] = Math.random();
    }
  }

  _seedMotes() {
    const W = this.width;
    const H = this.height;
    const count = W * H < 400000 ? 10 : 16;
    const colors = ['#7fe9ff', '#8a5cff', '#ff2bd6', '#d7ff00', '#bfefff'];
    this._motes = [];
    for (let i = 0; i < count; i++) {
      this._motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 14,
        vy: -4 - Math.random() * 12,
        r: 1 + Math.random() * 1.6,
        rgb: parseColor(colors[i % colors.length]),
        phase: Math.random() * TAU,
      });
    }
  }

  _seedDust() {
    const W = this.width;
    const H = this.height;
    const count = W * H < 400000 ? 5 : 9;
    const colors = ['#9ff6ff', '#c9b7ff', '#ff9bea', '#e2ffff'];
    this._dust = [];
    for (let i = 0; i < count; i++) {
      this._dust.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 7,
        vy: -5 - Math.random() * 11,
        r: 1.6 + Math.random() * 2.8,
        phase: Math.random() * TAU,
        rgb: parseColor(colors[i % colors.length]),
      });
    }
  }

  _drawBackdrop(ctx, W, H) {
    if (!this._backdropGrad) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#070114');
      g.addColorStop(0.5, '#05010f');
      g.addColorStop(1, '#03000a');
      this._backdropGrad = g;
    }
    ctx.fillStyle = this._backdropGrad;
    ctx.fillRect(0, 0, W, H);

    if (!this._coreGrad) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.44, 0, W * 0.5, H * 0.44, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(40,12,86,0.55)');
      g.addColorStop(0.45, 'rgba(22,6,52,0.30)');
      g.addColorStop(1, 'rgba(3,0,10,0)');
      this._coreGrad = g;

      const a = ctx.createRadialGradient(W * 0.13, H * 0.3, 0, W * 0.13, H * 0.3, Math.max(W, H) * 0.55);
      a.addColorStop(0, 'rgba(90,40,200,0.16)');
      a.addColorStop(0.6, 'rgba(60,20,140,0.05)');
      a.addColorStop(1, 'rgba(20,0,50,0)');
      this._nebulaA = a;

      const b = ctx.createRadialGradient(W * 0.86, H * 0.7, 0, W * 0.86, H * 0.7, Math.max(W, H) * 0.5);
      b.addColorStop(0, 'rgba(210,30,160,0.10)');
      b.addColorStop(0.55, 'rgba(140,20,110,0.04)');
      b.addColorStop(1, 'rgba(40,0,30,0)');
      this._nebulaB = b;
    }
    ctx.fillStyle = this._coreGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = this._nebulaA;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = this._nebulaB;
    ctx.fillRect(0, 0, W, H);
  }

  _drawStarfield(ctx, W, H, dt, camera, rm) {
    const stars = this._stars;
    if (!stars) return;
    const count = Math.min(this._starCount, this._starLimit());
    this._workStars = count;

    let yawDelta = 0;
    let pitchDelta = 0;
    if (camera) {
      if (this._yawRef === null && Number.isFinite(camera.yaw)) {
        this._yawRef = camera.yaw;
        this._pitchRef = Number(camera.pitch) || 0;
      }
      if (this._yawRef !== null) {
        yawDelta = (Number(camera.yaw) || 0) - this._yawRef;
        pitchDelta = (Number(camera.pitch) || 0) - this._pitchRef;
      }
    }
    const drift = rm ? 0.18 : 1;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let lastColor = '';
    for (let i = 0; i < count; i++) {
      const o = i * 5;
      const depth = stars[o + 2];
      let ny = stars[o + 1] + (0.004 + depth * 0.014) * dt * drift;
      if (ny > 1) ny -= 1;
      else if (ny < 0) ny += 1;
      stars[o + 1] = ny;

      let x = stars[o] * W - yawDelta * depth * 130;
      let y = ny * H + pitchDelta * depth * 85;
      x = ((x % W) + W) % W;
      y = ((y % H) + H) % H;

      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * (0.4 + depth * 1.7) + stars[o + 4] * TAU));
      const size = stars[o + 3] > 1.3 ? 2 : 1;
      const alpha = Math.min(1, 0.12 + stars[o + 3] * 0.6) * twinkle * (rm ? 0.75 : 1);
      if (alpha <= 0.02) continue;
      const color = STAR_COLORS[i % STAR_COLORS.length];
      if (color !== lastColor) {
        ctx.fillStyle = color;
        lastColor = color;
      }
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, size, size);
      if (size === 2) {
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillRect(x - 2, y - 2, 6, 6);
        ctx.globalAlpha = alpha * 0.5;
        if (i % 5 === 0) {
          ctx.fillRect(x - 4, y, 10, 1);
          ctx.fillRect(x, y - 4, 1, 10);
        }
      }
    }
    const moteLimit = Math.round(this._motes.length * this._qualityScale());
    this._workMotes = moteLimit;
    for (let i = 0; i < moteLimit; i += 1) {
      const m = this._motes[i];
      m.x += m.vx * dt * drift;
      m.y += m.vy * dt * drift;
      if (m.x < -20) m.x = W + 20;
      else if (m.x > W + 20) m.x = -20;
      if (m.y < -20) m.y = H + 20;
      else if (m.y > H + 20) m.y = -20;
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 1.6 + m.phase);
      ctx.fillStyle = rgba(m.rgb, 0.1 * pulse);
      ctx.globalAlpha = 0.1 * pulse;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(m.rgb, 0.55 * pulse);
      ctx.globalAlpha = 0.55 * pulse;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawFloorGrid(ctx, W, H, cx, rm, fade) {
    const horizon = H * 0.76;
    ctx.save();
    ctx.globalAlpha = fade;
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, rgba(CYAN, 0.02));
    g.addColorStop(0.5, rgba(CYAN, 0.075));
    g.addColorStop(1, rgba(CYAN, 0.19));

    const path = new Path2D();
    const rows = 16;
    const phase = rm ? 0 : (this.t * 0.05) % 1;
    for (let i = 1; i <= rows; i++) {
      const d = ((i / rows) + phase) % 1;
      const y = horizon + (H - horizon) * d ** 2.1;
      path.moveTo(0, y);
      path.lineTo(W, y);
    }
    const cols = 20;
    for (let i = -cols; i <= cols; i++) {
      path.moveTo(cx + i * 6, horizon);
      path.lineTo(cx + i * (W / cols) * 1.25, H);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.stroke(path);
    ctx.strokeStyle = rgba(CYAN, 0.16);
    ctx.beginPath();
    ctx.moveTo(W * 0.05, horizon);
    ctx.lineTo(W * 0.95, horizon);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  _drawHalo(ctx, W, H, cx, cy, R, rm, fade) {
    const key = Math.round(R * 2) + '|' + W + 'x' + H;
    if (this._haloKey !== key) {
      this._haloKey = key;
      const g = ctx.createRadialGradient(cx, cy, R * 0.42, cx, cy, R * 1.98);
      g.addColorStop(0, rgba(VIOLET, 0.21));
      g.addColorStop(0.38, rgba(VIOLET, 0.1));
      g.addColorStop(0.66, rgba(CYAN, 0.065));
      g.addColorStop(1, rgba(CYAN, 0));
      this._haloGrad = g;
    }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this._haloGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = rgba(CYAN, 0.1);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.015, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(CYAN, 0.045);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.03, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const rr = R * (1.16 + i * 0.17);
      const tilt = -0.34 + i * 0.24;
      const spin = (i % 2 ? -1 : 1) * (0.8 + i * 0.45);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.strokeStyle = i === 1 ? rgba(MAGENTA, 0.12) : rgba(CYAN, 0.14);
      ctx.lineWidth = 1.1;
      ctx.setLineDash([Math.max(10, rr * 0.3), Math.max(14, rr * 0.62)]);
      ctx.lineDashOffset = rm ? 0 : -this.t * 34 * spin;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * 0.3, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const arcA = rm ? 0.9 : this.t * 0.55;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 2; i++) {
      const rr = R * (1.065 + i * 0.075);
      const dir = i ? -1 : 1;
      const start = arcA * dir + i * 2.4;
      const len = i ? 0.5 : 0.95;
      ctx.strokeStyle = i ? rgba(MAGENTA, 0.22) : rgba(CYAN, 0.3);
      ctx.lineWidth = i ? 1 : 1.7;
      ctx.beginPath();
      ctx.arc(0, 0, rr, start, start + len);
      ctx.stroke();
      ctx.strokeStyle = i ? rgba(MAGENTA, 0.05) : rgba(CYAN, 0.06);
      ctx.lineWidth = i ? 4 : 7;
      ctx.stroke();
    }
    ctx.restore();

    // Soft reflection pool on the floor plane below the sphere.
    ctx.save();
    ctx.translate(cx, cy + R * 0.98);
    ctx.scale(1, 0.24);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.2);
    pool.addColorStop(0, rgba(CYAN, 0.14));
    pool.addColorStop(0.45, rgba(CYAN, 0.05));
    pool.addColorStop(1, rgba(CYAN, 0));
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  _drawSphereFx(ctx, cx, cy, R, rm, nf, fade) {
    if (!R || R < 1) return;
    const key = `${Math.round(cx)}|${Math.round(cy)}|${Math.round(R)}`;
    if (this._sphereFxKey !== key) {
      this._sphereFxKey = key;
      const rim = ctx.createRadialGradient(cx, cy, R * 0.52, cx, cy, R);
      rim.addColorStop(0, 'rgba(0,240,255,0)');
      rim.addColorStop(0.66, 'rgba(0,240,255,0.035)');
      rim.addColorStop(0.9, 'rgba(110,255,255,0.14)');
      rim.addColorStop(0.975, 'rgba(190,255,255,0.52)');
      rim.addColorStop(1, 'rgba(0,240,255,0)');
      this._sphereRim = rim;

      const sheen = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.4, 0, cx - R * 0.34, cy - R * 0.4, R * 1.12);
      sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
      sheen.addColorStop(0.42, 'rgba(180,240,255,0.06)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      this._sphereSheen = sheen;

      const shade = ctx.createRadialGradient(cx + R * 0.42, cy + R * 0.5, R * 0.05, cx + R * 0.42, cy + R * 0.5, R * 1.45);
      shade.addColorStop(0, 'rgba(2,0,10,0.55)');
      shade.addColorStop(0.4, 'rgba(2,0,10,0.26)');
      shade.addColorStop(1, 'rgba(2,0,10,0)');
      this._sphereShade = shade;
    }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    if (this._sphereShade) {
      ctx.fillStyle = this._sphereShade;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'lighter';
    if (this._sphereRim) {
      ctx.fillStyle = this._sphereRim;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    if (this._sphereSheen) {
      ctx.fillStyle = this._sphereSheen;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    if (!rm) {
      const phase = (this.t * 0.13) % 1;
      const bx = cx - R * 1.5 + phase * R * 3.0;
      const sweep = ctx.createLinearGradient(bx - R * 0.4, cy - R, bx + R * 0.4, cy + R);
      sweep.addColorStop(0, 'rgba(140,255,255,0)');
      sweep.addColorStop(0.5, 'rgba(170,255,255,0.05)');
      sweep.addColorStop(1, 'rgba(140,255,255,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    if (!rm && this._scanPattern && nf < 900) {
      ctx.globalAlpha = fade * 0.1;
      ctx.translate(0, (this.t * 16) % 4);
      ctx.fillStyle = this._scanPattern;
      ctx.fillRect(cx - R, cy - R - 8, R * 2, R * 2 + 8);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawForegroundDust(ctx, W, H, dt, rm) {
    const dust = this._dust;
    if (!dust || !dust.length) return;
    const limit = Math.round(dust.length * this._qualityScale());
    this._workDust = limit;
    const drift = rm ? 0.2 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < limit; i += 1) {
      const d = dust[i];
      d.x += d.vx * dt * drift;
      d.y += d.vy * dt * drift;
      if (d.y < -30) {
        d.y = H + 30;
        d.x = Math.random() * W;
      }
      if (d.x < -30) d.x = W + 30;
      else if (d.x > W + 30) d.x = -30;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 1.1 + d.phase);
      const a = (0.05 + 0.06 * pulse) * (rm ? 0.6 : 1);
      ctx.fillStyle = rgba(d.rgb, a * 0.34);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(d.rgb, a * 1.3);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 0.62, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawVignette(ctx, W, H) {
    if (!this._vigGrad) {
      const cx = W / 2;
      const cy = H / 2;
      const inner = Math.min(W, H) * 0.36;
      const outer = Math.hypot(W, H) * 0.62;
      const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      g.addColorStop(0, 'rgba(2,0,10,0)');
      g.addColorStop(0.55, 'rgba(2,0,10,0.24)');
      g.addColorStop(1, 'rgba(2,0,10,0.72)');
      this._vigGrad = g;
    }
    ctx.fillStyle = this._vigGrad;
    ctx.fillRect(0, 0, W, H);
  }

  _drawScanlines(ctx, W, H) {
    if (!this._scanPattern) {
      if (typeof document === 'undefined') return;
      const off = document.createElement('canvas');
      off.width = 1;
      off.height = 4;
      const octx = off.getContext('2d');
      if (!octx) return;
      octx.fillStyle = 'rgba(150,255,255,0.55)';
      octx.fillRect(0, 0, 1, 1);
      this._scanPattern = this.ctx.createPattern(off, 'repeat');
      if (!this._scanPattern) return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.02;
    ctx.translate(0, (this.t * 7) % 4);
    ctx.fillStyle = this._scanPattern;
    ctx.fillRect(0, -8, W, H + 8);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export default IcosaRenderer;
