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
import { BIOMES, terrainAt, SEA_LEVEL } from './shared/planet.js';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const FONT_STACK = '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace';

const CYAN = { r: 0, g: 240, b: 255 };
const MAGENTA = { r: 255, g: 43, b: 214 };
const WHITE = { r: 255, g: 255, b: 255 };
const VIOLET = { r: 138, g: 92, b: 255 };
const ACID = { r: 215, g: 255, b: 0 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;
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
  if (depth <= 0) return 8;
  if (depth === 1) return 4;
  if (depth === 2) return 2;
  return 1;
}

const DEPTH_EDGE_SCALE = [1, 0.85, 0.7, 0.55];
const MAX_PULSES = 36;
const PULSE_DUR = { claim: 0.9, steal: 1.05, reinforce: 0.75, break: 1.3, resource: 1.5 };
const CHARGE_TIERS = 5;

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

    // --- infinite world state -----------------------------------------
    this.players = [];
    this.myPlayerId = null;
    this.myIndex = -1;
    this.faces = []; // active leaf entries
    this.byLabel = new Map(); // label -> entry
    this.threshold = 8;
    this.maxDepth = 8;
    // Debug "show all ids" toggle (app L key). Off by default: ids are only
    // rendered for interactive/pulsed faces.
    this.labelsVisible = false;
    this.poleLabelsVisible = false;
    this.surface = null;
    this.surfaceSeed = null;
    this._surfaceCanvas = null;
    this._surfaceCtx = null;
    this.hoverLabel = null;
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
  /**
   * Build the dense procedural geography surface for a planet seed.
   * Uses a high-res icosphere mesh coloured once, then drawn behind the game
   * cells every frame. No per-frame noise work.
   */
  setPlanetSurface(seed) {
    const next = Number(seed) >>> 0;
    if (this.surfaceSeed === next && this.surface) return;
    this.surfaceSeed = next;
    const level = (this.width || 0) < 760 ? 2 : 3;
    const mesh = getMesh(level);
    const snow = { r: 232, g: 244, b: 255 };
    const sand = { r: 186, g: 168, b: 118 };
    const rock = { r: 112, g: 110, b: 104 };
    const deep = { r: 2, g: 10, b: 28 };
    const shallow = { r: 18, g: 92, b: 132 };
    const buckets = new Map();
    const faces = mesh.faces.map((face) => {
      const terrain = terrainAt(next, face.centroid);
      const elevation = terrain.elevation;
      const temperature = terrain.temperature;
      const moisture = terrain.moisture;
      const isOcean = !terrain.biome.mineable;
      let rgb;
      if (isOcean) {
        const depth = clamp((SEA_LEVEL - elevation) / 0.4, 0, 1);
        rgb = mixRgb(shallow, deep, Math.pow(depth, 0.78));
      } else {
        // Continuous climate/elevation ramp: coast sand → lowland green →
        // highland rock → snow, with dry basins shifting toward ochre.
        const alt = clamp((elevation - SEA_LEVEL) / 0.55, 0, 1);
        const dry = clamp((0.46 - moisture) / 0.34, 0, 1) * clamp((temperature - 0.38) / 0.4, 0, 1);
        const wetGreen = { r: 38, g: 92, b: 58 };
        const forest = { r: 28, g: 72, b: 48 };
        const ochre = { r: 148, g: 128, b: 78 };
        rgb = mixRgb(mixRgb(forest, wetGreen, clamp(moisture, 0, 1)), ochre, dry * 0.78);
        rgb = mixRgb(rgb, rock, alt * 0.7);
        const coastal = 1 - clamp((elevation - SEA_LEVEL) / 0.035, 0, 1);
        rgb = mixRgb(rgb, sand, coastal * 0.65);
        const cold = clamp((0.24 - temperature) / 0.24, 0, 1);
        const snowLine = clamp((elevation - 0.48) / 0.26, 0, 1);
        const snowAmt = clamp(Math.max(snowLine, cold * 0.9), 0, 1);
        rgb = mixRgb(rgb, snow, snowAmt * 0.88);
      }
      // Quantize colour into ~a few hundred buckets; the frame loop groups
      // triangles into one Path2D per colour so 5k facets cost ~100 fills, not 5k.
      const qr = rgb.r & 0xf0;
      const qg = rgb.g & 0xf0;
      const qb = rgb.b & 0xf0;
      const key = (qr << 8) | (qg << 4) | qb;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          index: buckets.size,
          fill: `rgb(${qr},${qg},${qb})`,
        };
        buckets.set(key, bucket);
      }
      return {
        a: face.a,
        b: face.b,
        c: face.c,
        centroid: face.centroid,
        bucket: bucket.index,
        isOcean,
        elevation,
      };
    });
    this.surface = { seed: next, level, faces, buckets: [...buckets.values()] };
  }

  setFaces(faces) {
    const input = Array.isArray(faces) ? faces : [];
    const nextFaces = [];
    const nextMap = new Map();
    for (let i = 0; i < input.length; i++) {
      const f = input[i];
      if (!f || typeof f.label !== 'string') continue;
      let entry = this.byLabel.get(f.label);
      if (!entry) entry = this._createEntry(f);
      entry.ownerIndex = Number.isInteger(f.ownerIndex) ? f.ownerIndex : -1;
      entry.clicks = Number.isFinite(f.clicks) ? Math.max(0, Math.trunc(f.clicks)) : 0;
      this._setEntryResource(entry, f.resourceId);
      this._setEntryTerrain(entry, f.terrain);
      nextFaces.push(entry);
      nextMap.set(f.label, entry);
    }
    this.faces = nextFaces;
    this.byLabel = nextMap;
    if (this.hoverLabel && !nextMap.has(this.hoverLabel)) this.hoverLabel = null;
    this._ensureBuffers();
  }

  /** Lightweight owner/charge update (no geometry change). */
  updateCell(label, ownerIndex, clicks) {
    if (typeof label !== 'string') return;
    const entry = this.byLabel.get(label);
    if (!entry) return;
    if (Number.isInteger(ownerIndex)) entry.ownerIndex = ownerIndex;
    if (Number.isFinite(clicks)) entry.clicks = Math.max(0, Math.trunc(clicks));
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
    }
  }

  /**
   * Draw one frame. No RAF inside.
   * @param {import('./shared/geometry.js').SphereCamera} camera
   * @param {number} timeMs monotonic clock
   */
  render(camera, timeMs) {
    const ctx = this.ctx;
    if (!ctx) return;

    const raw = Number.isFinite(timeMs) ? timeMs : (this.lastRaw || 0) + 16.7;
    if (!this.lastRaw) this.lastRaw = raw;
    let dt = (raw - this.lastRaw) / 1000;
    this.lastRaw = raw;
    if (!(dt > 0)) dt = 1 / 120;
    if (dt > 0.1) dt = 0.1;
    this.t += dt;
    this.frame++;

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

    // Backdrop layers.
    this._drawBackdrop(ctx, W, H);
    this._drawStarfield(ctx, W, H, dt, hasCamera ? camera : null, rm);
    const gridFade = clamp(1 - (zoom - 10) / 10, 0, 1);
    if (gridFade > 0.01) this._drawFloorGrid(ctx, W, H, cx, rm, gridFade);

    // Zoom-aware decoration fades: sphere-scale glow must not wash a deep zoom.
    const haloFade = clamp(1 - (zoom - 2.5) / 4.5, 0, 1);
    const glassFade = clamp(1 - (zoom - 3) / 3, 0, 1);
    const cartoFade = clamp(1 - (zoom - 5) / 6, 0, 1);

    if (haloFade > 0.01) this._drawHalo(ctx, W, H, cx, cy, R, rm, haloFade);

    this._visCount = 0;
    if (this.faces.length && hasCamera) {
      this._drawSphere(ctx, camera, cx, cy, R, rm, glassFade);
      this._drawResourceMarkers(ctx);
    }

    if (hasCamera && cartoFade > 0.01) {
      this._drawGraticule(ctx, camera, cartoFade);
      this._drawPoles(ctx, camera, cx, cy, cartoFade);
    }

    this._drawForegroundDust(ctx, W, H, dt, rm);
    this._drawVignette(ctx, W, H);
    if (!rm) this._drawScanlines(ctx, W, H);

    // Labels + charge arcs are drawn crisp above the vignette.
    if (hasCamera) {
      this._drawLabels(ctx, camera);
      this._drawChargeArcs(ctx);
    }

    if (hasCamera) this._drawPulses(ctx, camera, rm);
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
    const nf = this.faces.length;
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
    const d = Number(camera.distance) || CAMERA_DISTANCE;
    const yaw = Number(camera.yaw) || 0;
    const pitch = Number(camera.pitch) || 0;
    const sy = Math.sin(yaw);
    const cyw = Math.cos(yaw);
    const sp = Math.sin(pitch);
    const cp = Math.cos(pitch);
    this._d = d;
    this._Kx = -sy * cp;
    this._Ky = sp;
    this._Kz = cyw * cp;

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

  /** Project one entry's boundary; returns true when its bbox can touch the view. */
  _projectEntry(entry, camera, W, H) {
    const wx = entry.wx;
    const px = entry.px;
    const py = entry.py;
    const pz = entry.pz;
    const n = entry.n;
    const tmp = this._tmpV;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let allFront = true;
    for (let k = 0; k < n; k++) {
      const o = k * 3;
      tmp.x = wx[o];
      tmp.y = wx[o + 1];
      tmp.z = wx[o + 2];
      const pr = camera.project(tmp);
      const X = pr.x;
      const Y = pr.y;
      const Z = pr.z;
      px[k] = X;
      py[k] = Y;
      pz[k] = Z;
      if (Z <= 0.0005) allFront = false;
      if (X < minX) minX = X;
      if (X > maxX) maxX = X;
      if (Y < minY) minY = Y;
      if (Y > maxY) maxY = Y;
    }
    entry.allFront = allFront;
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

  /** Draw the cached high-res geography mesh behind the game grid. */
  _drawSurface(ctx, camera, cx, cy, R, W, H) {
    const surface = this.surface;
    if (!surface) return;
    const Kx = this._Kx;
    const Ky = this._Ky;
    const Kz = this._Kz;
    const tmp = this._tmpV;
    // Render the geography mesh into a lower-res offscreen globe, then upscale
    // with smoothing. This both hides low-poly facets and keeps path-fill cost
    // bounded at deep zoom.
    const offSize = Math.round(clamp(R * 1.5, 380, 768));
    if (!this._surfaceCanvas || this._surfaceCanvas.width !== offSize) {
      this._surfaceCanvas = document.createElement('canvas');
      this._surfaceCanvas.width = offSize;
      this._surfaceCanvas.height = offSize;
      this._surfaceCtx = this._surfaceCanvas.getContext('2d');
    }
    const sctx = this._surfaceCtx;
    const scale = offSize / Math.min(W, H);
    sctx.save();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, offSize, offSize);
    sctx.setTransform(scale, 0, 0, scale, offSize / 2 - cx * scale, offSize / 2 - cy * scale);
    sctx.beginPath();
    sctx.arc(cx, cy, Math.max(1, R), 0, TAU);
    sctx.clip();
    sctx.fillStyle = 'rgb(6,28,52)';
    sctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // Group facets into one Path2D per quantized geography colour.
    const nBuckets = surface.buckets.length;
    const paths = this._surfacePaths && this._surfacePaths.length === nBuckets
      ? this._surfacePaths
      : (this._surfacePaths = new Array(nBuckets));
    for (let i = 0; i < nBuckets; i += 1) paths[i] = null;
    for (const f of surface.faces) {
      const c = f.centroid;
      if (c.x * Kx + c.y * Ky + c.z * Kz <= 0.015) continue;
      tmp.x = f.a.x; tmp.y = f.a.y; tmp.z = f.a.z;
      const pa = camera.project(tmp);
      tmp.x = f.b.x; tmp.y = f.b.y; tmp.z = f.b.z;
      const pb = camera.project(tmp);
      tmp.x = f.c.x; tmp.y = f.c.y; tmp.z = f.c.z;
      const pc = camera.project(tmp);
      if (pa.z <= 0 || pb.z <= 0 || pc.z <= 0) continue;
      const minX = Math.min(pa.x, pb.x, pc.x);
      const maxX = Math.max(pa.x, pb.x, pc.x);
      const minY = Math.min(pa.y, pb.y, pc.y);
      const maxY = Math.max(pa.y, pb.y, pc.y);
      if (maxX < -2 || minX > W + 2 || maxY < -2 || minY > H + 2) continue;
      let path = paths[f.bucket];
      if (!path) path = paths[f.bucket] = new Path2D();
      path.moveTo(pa.x, pa.y);
      path.lineTo(pb.x, pb.y);
      path.lineTo(pc.x, pc.y);
      path.closePath();
    }
    // A slight global blur of the surface would soften facet edges, but plain
    // grouped fills keep 60fps; the atmosphere/shading pass hides hard seams.
    for (let i = 0; i < nBuckets; i += 1) {
      const path = paths[i];
      if (!path) continue;
      const fill = surface.buckets[i].fill;
      sctx.fillStyle = fill;
      sctx.fill(path);
      // Same-colour hairline closes antialiased cracks between buckets.
      sctx.strokeStyle = fill;
      sctx.lineWidth = 0.8;
      sctx.stroke(path);
    }
    sctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, R), 0, TAU);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.filter = 'blur(1.1px)';
    ctx.drawImage(this._surfaceCanvas, 0, 0, offSize, offSize, cx - R, cy - R, R * 2, R * 2);
    ctx.filter = 'none';
    // Soft directional shading + rim to make the sphere read as a world.
    const shade = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.4, R * 0.12, cx, cy, R * 1.02);
    shade.addColorStop(0, 'rgba(195,235,255,0.16)');
    shade.addColorStop(0.45, 'rgba(0,0,0,0)');
    shade.addColorStop(0.82, 'rgba(2,6,20,0.18)');
    shade.addColorStop(1, 'rgba(1,3,12,0.52)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // A faint atmosphere rim over the ocean edge.
    const rim = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.005);
    rim.addColorStop(0, 'rgba(70,190,255,0)');
    rim.addColorStop(0.82, 'rgba(80,210,255,0.13)');
    rim.addColorStop(1, 'rgba(120,240,255,0.28)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _drawSphere(ctx, camera, cx, cy, R, rm, glassFade) {
    const W = this.width;
    const H = this.height;
    const faces = this.faces;
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
    if (backFade > 0.02) {
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

    // --- Detailed procedural geography underlay. -------------------
    if (this.surface && this.surface.faces.length) {
      this._drawSurface(ctx, camera, cx, cy, R, W, H);
    }

    // --- Cull + project front candidates. ---------------------------
    let vc = 0;
    for (let i = 0; i < nf; i++) {
      const e = faces[i];
      const c = e.centroid;
      const dotc = c.x * Kx + c.y * Ky + c.z * Kz;
      const ct = e.cosTheta;
      const st = e.sinTheta;
      if (dotc >= cosA * ct - sinA * st) {
        if (!this._projectEntry(e, camera, W, H)) continue;
        dotZ[i] = dotc;
        vis[vc++] = i;
      }
    }
    this._visCount = vc;

    // Depth sort (far → near). Leaves tile the sphere, so this is cheap and
    // only fixes edge-glow overdraw order.
    vis.subarray(0, vc).sort((a, b) => dotZ[a] - dotZ[b]);

    // --- Fills + edge buckets. --------------------------------------
    const buckets = this._buckets;
    buckets.fill(null);
    const nearBreak = this._nearBreak;
    nearBreak.fill(null);
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
      const band = clamp(Math.floor(dotc * 6), 0, 5);

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
      const frac = clamp(e.clicks / thr, 0, 1);
      const huge = sr > Math.min(W, H) * 0.6;
      const tier = clamp(Math.round(frac * (CHARGE_TIERS - 1)), 0, CHARGE_TIERS - 1);
      const fillIdx = band * CHARGE_TIERS + tier;

      ctx.beginPath();
      ctx.moveTo(px[0], py[0]);
      for (let k = 1; k < np; k++) ctx.lineTo(px[k], py[k]);
      ctx.closePath();

      const terrain = e.terrain;
      const detailedSurface = !!(this.surface && this.surface.faces.length);
      ctx.globalAlpha = lodAlpha;
      if (terrain && detailedSurface) {
        // Geography is already painted by the high-res surface. Keep only a
        // light ownership tint so the terrain reads through the grid.
        if (e.ownerIndex >= 0) {
          const owned = style.overlayC[fillIdx];
          if (owned) {
            ctx.globalAlpha = lodAlpha * 0.5;
            ctx.fillStyle = owned;
            ctx.fill();
          }
        }
        ctx.globalAlpha = lodAlpha;
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
    if (glassFade > 0.01) this._drawSphereFx(ctx, cx, cy, R, rm, nf, glassFade);

    // --- Silhouette ring. -------------------------------------------
    if (glassFade > 0.01 && R < Math.max(W, H) * 2.5) {
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
    const faces = this.faces;
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
    if (!this.faces.length) return;
    this._prunePulseLabels();
    const vc = this._visCount;
    if (!vc) return;
    const hoverLabel = this.hoverLabel;
    const faces = this.faces;
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
    if (vc > 60 || !vc || !this.faces.length) return;
    const thr = this.threshold > 0 ? this.threshold : 1;
    const faces = this.faces;
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
    const count = this._starCount;

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
    for (let i = 0; i < this._motes.length; i++) {
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
    const drift = rm ? 0.2 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < dust.length; i++) {
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
