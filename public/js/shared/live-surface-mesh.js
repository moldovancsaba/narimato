/**
 * NARIMATO — live surface mesh (RND-04).
 *
 * Surface geometry is derived from the authoritative `World.leaves` only. A
 * monotonic world revision gates rebuilding, one rebuild happens per frame, and
 * the triangle budget is clamped by lowering subdivision levels. No cached
 * seed-keyed planet copy exists.
 *
 * Pure module: no DOM, no canvas, no renderer imports — safe to unit test.
 */

import { childTriangles } from './geometry.js';

export const MAX_LEVEL = 4;
export const TRIANGLE_BUDGET = 6000;
/** Longest spherical edge targeted by subdivision level 0 (radians). */
export const TARGET_EDGE = 0.055;
const MIN_EDGE = 1e-4;
const DEGENERATE_EPS = 1e-24;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const crossLen = (a, b, c) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  return nx * nx + ny * ny + nz * nz;
};

function finiteVec(v) {
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** Longest spherical edge of a leaf, radians. */
export function edgeAngleOfLeaf(leaf) {
  if (!leaf) return 0;
  const angle = (p, q) => Math.acos(clamp(dot(p, q), -1, 1));
  return Math.max(
    angle(leaf.a, leaf.b),
    angle(leaf.b, leaf.c),
    angle(leaf.c, leaf.a),
  );
}

/**
 * `L(leaf) = clamp(ceil(log2(e / 0.055)), 0, 4)` with `e` the longest edge.
 * Level 0 is the leaf itself; each level multiplies triangles by four.
 */
export function levelForLeaf(leaf) {
  const edge = edgeAngleOfLeaf(leaf);
  if (!(edge > 0)) return 0;
  return clamp(Math.ceil(Math.log2(Math.max(MIN_EDGE, edge / TARGET_EDGE))), 0, MAX_LEVEL) | 0;
}

/** Quantise a colour into a 4-bit-per-channel bucket key and fill string. */
export function quantizeRgb(rgb) {
  const source = rgb && typeof rgb === 'object' ? rgb : { r: 42, g: 92, b: 116 };
  const r = clamp(Math.round(Number(source.r) || 0), 0, 255) & 0xf0;
  const g = clamp(Math.round(Number(source.g) || 0), 0, 255) & 0xf0;
  const b = clamp(Math.round(Number(source.b) || 0), 0, 255) & 0xf0;
  return { key: (r << 8) | (g << 4) | b, r, g, b, fill: `rgb(${r},${g},${b})` };
}

function trianglesForLevel(leaf, level) {
  let tris = [{ a: leaf.a, b: leaf.b, c: leaf.c }];
  for (let i = 0; i < level; i += 1) {
    const next = [];
    for (const tri of tris) {
      for (const child of childTriangles(tri.a, tri.b, tri.c)) next.push(child);
    }
    tris = next;
  }
  return tris;
}

/**
 * Build one deterministic surface mesh from the live leaves.
 *
 * @param {{leaves?:Array, revision?:number, seed?:number,
 *          colourOf?:(leaf:object)=>{r:number,g:number,b:number},
 *          levelOf?:(leaf:object)=>number, budget?:number}} input
 * @returns {{revision:number, seed:number, triangles:Float32Array,
 *            buckets:Array<{index:number,fill:string,start:number,count:number}>,
 *            triangleCount:number, levelCounts:Array<number>, skipped:number,
 *            hash:string}}
 */
export function buildLiveSurface(input = {}) {
  const options = input && typeof input === 'object' ? input : {};
  const revision = Number.isInteger(options.revision) ? options.revision : 0;
  const seed = Number(options.seed) >>> 0;
  const budget = Number.isFinite(options.budget) ? Math.max(0, Math.trunc(options.budget)) : TRIANGLE_BUDGET;
  const colourOf = typeof options.colourOf === 'function' ? options.colourOf : null;
  const levelOf = typeof options.levelOf === 'function' ? options.levelOf : levelForLeaf;
  const leaves = (Array.isArray(options.leaves) ? options.leaves : []).filter(
    (leaf) => leaf && finiteVec(leaf.a) && finiteVec(leaf.b) && finiteVec(leaf.c),
  );

  // Levels per leaf, then deterministic budget clamping.
  const levels = leaves.map((leaf) => clamp(Math.trunc(Number(levelOf(leaf))) || 0, 0, MAX_LEVEL));
  const countTriangles = () => levels.reduce((sum, level) => sum + 4 ** level, 0);
  let guard = 0;
  while (countTriangles() > budget && guard < 100000) {
    guard += 1;
    let index = -1;
    let best = 0;
    for (let i = 0; i < levels.length; i += 1) {
      if (levels[i] > best) {
        best = levels[i];
        index = i;
      }
    }
    if (index < 0) break;
    levels[index] -= 1;
  }

  // Colour buckets, in first-appearance order (deterministic).
  const bucketMap = new Map();
  const leafBucket = [];
  for (const leaf of leaves) {
    const quantized = quantizeRgb(colourOf ? colourOf(leaf) : null);
    if (!bucketMap.has(quantized.key)) {
      bucketMap.set(quantized.key, {
        index: bucketMap.size,
        key: quantized.key,
        fill: quantized.fill,
        start: 0,
        count: 0,
      });
    }
    leafBucket.push(bucketMap.get(quantized.key).index);
  }
  const buckets = [...bucketMap.values()];

  // Count non-degenerate triangles per bucket so the buffer is exactly sized.
  let degenerate = 0;
  const perBucket = new Array(buckets.length).fill(0);
  for (let i = 0; i < leaves.length; i += 1) {
    for (const tri of trianglesForLevel(leaves[i], levels[i])) {
      if (!(crossLen(tri.a, tri.b, tri.c) > DEGENERATE_EPS)) {
        degenerate += 1;
        continue;
      }
      perBucket[leafBucket[i]] += 1;
    }
  }
  let offset = 0;
  for (const bucket of buckets) {
    bucket.start = offset;
    bucket.count = perBucket[bucket.index];
    offset += bucket.count;
  }
  const triangleCount = offset;
  const triangles = new Float32Array(triangleCount * 9);
  const cursor = buckets.map((bucket) => bucket.start);

  for (let i = 0; i < leaves.length; i += 1) {
    const bucketIndex = leafBucket[i];
    let at = cursor[bucketIndex];
    for (const tri of trianglesForLevel(leaves[i], levels[i])) {
      if (!(crossLen(tri.a, tri.b, tri.c) > DEGENERATE_EPS)) continue;
      const o = at * 9;
      triangles[o] = tri.a.x; triangles[o + 1] = tri.a.y; triangles[o + 2] = tri.a.z;
      triangles[o + 3] = tri.b.x; triangles[o + 4] = tri.b.y; triangles[o + 5] = tri.b.z;
      triangles[o + 6] = tri.c.x; triangles[o + 7] = tri.c.y; triangles[o + 8] = tri.c.z;
      at += 1;
    }
    cursor[bucketIndex] = at;
  }

  const levelCounts = new Array(MAX_LEVEL + 1).fill(0);
  for (const level of levels) levelCounts[level] += 1;

  return {
    revision,
    seed,
    triangles,
    buckets,
    triangleCount,
    levelCounts,
    skipped: degenerate,
    hash: hashTriangles(triangles),
  };
}

/** FNV-1a over the packed Float32 bit patterns (stable buffer hash). */
export function hashTriangles(triangles) {
  if (!(triangles instanceof Float32Array) || triangles.length === 0) return '00000000';
  const view = new DataView(triangles.buffer, triangles.byteOffset, triangles.byteLength);
  let hash = 2166136261;
  for (let i = 0; i < triangles.length; i += 1) {
    hash ^= view.getUint32(i * 4, true);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Revision-gated mesh store. `setInput()` is cheap and coalesces (last input
 * wins); `prepare()` performs at most one rebuild per call/frame.
 */
export class LiveSurfaceStore {
  constructor({ colourOf = null, levelOf = null, budget = TRIANGLE_BUDGET } = {}) {
    this._colourOf = typeof colourOf === 'function' ? colourOf : null;
    this._levelOf = typeof levelOf === 'function' ? levelOf : null;
    this._budget = Number.isFinite(budget) ? Math.trunc(budget) : TRIANGLE_BUDGET;
    this._mesh = null;
    this._revision = -1;
    this._seed = -1;
    this._pending = null;
    this._skipped = 0;
    this._rebuilds = 0;
    this._lastRebuildMs = 0;
    this._lastRebuildAt = 0;
    this._lastError = null;
  }

  /** Accept a new world snapshot; returns true when a rebuild is queued. */
  setInput(input = {}) {
    const options = input && typeof input === 'object' ? input : {};
    const revision = Number.isInteger(options.revision) ? options.revision : 0;
    const seed = Number(options.seed) >>> 0;
    if (this._revision === revision && this._seed === seed) {
      // No-op fast path: identical world snapshot, zero rebuild work.
      this._skipped += 1;
      return false;
    }
    this._pending = {
      leaves: Array.isArray(options.leaves) ? options.leaves : [],
      revision,
      seed,
    };
    return true;
  }

  /** Force the next snapshot (even with the same revision) to rebuild. */
  invalidate() {
    this._revision = -1;
    this._seed = -1;
  }

  /** Rebuild the pending snapshot, exactly once. Returns true when rebuilt. */
  prepare(now = Date.now()) {
    if (!this._pending) return false;
    const pending = this._pending;
    this._pending = null;
    const started = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    try {
      this._mesh = buildLiveSurface({
        leaves: pending.leaves,
        revision: pending.revision,
        seed: pending.seed,
        colourOf: this._colourOf,
        levelOf: this._levelOf,
        budget: this._budget,
      });
      this._revision = pending.revision;
      this._seed = pending.seed;
      this._rebuilds += 1;
      this._lastError = null;
    } catch (error) {
      // Keep the previous mesh; report the failure once.
      this._lastError = String(error && error.message ? error.message : error);
    }
    const ended = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    this._lastRebuildMs = ended - started;
    this._lastRebuildAt = now;
    return true;
  }

  get mesh() {
    return this._mesh;
  }

  stats() {
    const mesh = this._mesh;
    return {
      revision: this._revision,
      seed: this._seed,
      triangles: mesh ? mesh.triangleCount : 0,
      buckets: mesh ? mesh.buckets.length : 0,
      hash: mesh ? mesh.hash : null,
      skipped: this._skipped,
      rebuilds: this._rebuilds,
      lastRebuildMs: this._lastRebuildMs,
      lastRebuildAt: this._lastRebuildAt,
      lastError: this._lastError,
    };
  }
}
