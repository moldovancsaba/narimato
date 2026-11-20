/**
 * NARIMATO — client-side persistent adaptive world.
 *
 * Mirrors the server's sparse sphere tree: 20 base cells, any active leaf can
 * break individually into four children. Owners are indexes into the state's
 * append-only players array. Every node keeps its hierarchical label.
 */

import { baseIcosahedron, childTriangles, faceCentroid } from './shared/geometry.js';
import { terrainAt } from './shared/planet.js';

export class World {
  constructor() {
    this.planetSeed = 0;
    /** RND-04: monotonic revision; reset only by `reset()`. */
    this.revision = 0;
    this.reset();
  }

  /** Bump the world revision after any mutation that can change geometry. */
  _bumpRevision() {
    this.revision += 1;
    return this.revision;
  }

  reset() {
    this.revision = 0;
    this.nodes = new Map(); // label -> node (internal + leaves)
    this.leaves = new Map(); // label -> active leaf
    this.roots = [];
    this.terrainCache = new Map();
    const { vertices, faces } = baseIcosahedron();
    for (let i = 0; i < faces.length; i++) {
      const [ia, ib, ic] = faces[i];
      const label = String(i + 1);
      const node = this._node(label, 0, vertices[ia], vertices[ib], vertices[ic], null);
      this.nodes.set(label, node);
      this.leaves.set(label, node);
      this.roots.push(node);
    }
  }

  _node(label, depth, a, b, c, parent) {
    return {
      id: label, // pickFace() returns this id
      label,
      depth,
      a,
      b,
      c,
      centroid: faceCentroid(a, b, c),
      parent,
      ownerIndex: -1,
      clicks: 0,
      lastClickIndex: -1,
      resourceId: null, // discovered deposit only (hidden deposits never reach the client)
      terrain: null, // lazy biome sample from the shared planet seed
      children: null,
    };
  }

  _ensureChildren(node) {
    if (node.children) return node.children;
    const tris = childTriangles(node.a, node.b, node.c);
    node.children = tris.map((tri) => {
      const label = `${node.label}.${tri.labelNumber}`;
      const child = this._node(label, node.depth + 1, tri.a, tri.b, tri.c, node);
      this.nodes.set(label, child);
      return child;
    });
    return node.children;
  }

  /** Replace the whole tree from the server's compact leaf snapshot. */
  loadLeaves(leafEntries) {
    this.reset();
    this._bumpRevision();
    if (!Array.isArray(leafEntries)) return;
    for (const entry of leafEntries) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      const label = entry[0];
      const ownerIndex = Number.isInteger(entry[1]) ? entry[1] : -1;
      const clicks = Number.isFinite(entry[2]) ? Math.max(0, Math.trunc(entry[2])) : 0;
      const resourceId = typeof entry[3] === 'string' && entry[3] ? entry[3] : null;
      const lastClickIndex = Number.isInteger(entry[4]) ? entry[4] : -1;
      const parts = label.split('.').map(Number);
      const root = this.roots[parts[0] - 1];
      if (!root) continue;
      let node = root;
      for (let i = 1; i < parts.length; i++) {
        const children = this._ensureChildren(node);
        node = children.find((child) => child.label === `${node.label}.${parts[i]}`);
        if (!node) break;
      }
      if (!node) continue;
      node.ownerIndex = ownerIndex;
      node.clicks = clicks;
      node.resourceId = resourceId;
      node.lastClickIndex = lastClickIndex;
    }
    this._rebuildLeaves();
  }

  _rebuildLeaves() {
    this.leaves = new Map();
    const walk = (node) => {
      if (node.children) {
        for (const child of node.children) walk(child);
      } else {
        this.leaves.set(node.label, node);
      }
    };
    for (const root of this.roots) walk(root);
  }

  /** Update owner/charge of an existing leaf (server cell event). */
  /** The world's planet seed drives all terrain/biome sampling. */
  setPlanetSeed(seed) {
    const next = Number(seed) >>> 0;
    if (this.planetSeed === next) return;
    this.planetSeed = next;
    this._bumpRevision();
    this.terrainCache.clear();
    for (const node of this.nodes.values()) node.terrain = null;
  }

  /** Lazy deterministic terrain for a cell (client/server share the function). */
  terrainFor(node) {
    if (!node) return null;
    if (node.terrain) return node.terrain;
    const terrain = terrainAt(this.planetSeed, node.centroid);
    node.terrain = terrain;
    this.terrainCache.set(node.label, terrain);
    return terrain;
  }

  /** Active leaves, each with its terrain attached for the renderer/hover. */
  activeLeaves() {
    const out = [];
    for (const node of this.leaves.values()) {
      this.terrainFor(node);
      out.push(node);
    }
    return out;
  }

  /** Mark a discovered deposit on a leaf (id from the public resource catalog). */
  applyResource(label, resourceId) {
    const node = this.leaves.get(label);
    if (!node || !resourceId) return null;
    node.resourceId = resourceId;
    this._bumpRevision();
    return node;
  }

  applyCell(label, ownerIndex, clicks, lastClickIndex) {
    const node = this.leaves.get(label);
    if (!node) return null;
    if (Number.isInteger(ownerIndex)) node.ownerIndex = ownerIndex;
    if (Number.isFinite(clicks)) node.clicks = Math.max(0, Math.trunc(clicks));
    if (Number.isInteger(lastClickIndex)) node.lastClickIndex = lastClickIndex;
    this._bumpRevision();
    return node;
  }

  /**
   * Replace one leaf with four children (server break event). Children arrive
   * as [label, ownerIndex, clicks]. Idempotent: a duplicate event is ignored.
   */
  applyBreak(label, childEntries) {
    const node = this.leaves.get(label);
    if (!node || node.children) return null;
    const tris = childTriangles(node.a, node.b, node.c);
    const byLabelNum = new Map(tris.map((tri) => [String(tri.labelNumber), tri]));
    const dataByLabel = new Map();
    if (Array.isArray(childEntries)) {
      for (const entry of childEntries) {
        if (Array.isArray(entry) && typeof entry[0] === 'string') {
          dataByLabel.set(entry[0], entry);
        }
      }
    }
    const children = [];
    for (let labelNum = 1; labelNum <= 4; labelNum++) {
      const tri = byLabelNum.get(String(labelNum));
      const childLabel = `${node.label}.${labelNum}`;
      const entry = dataByLabel.get(childLabel) || [childLabel, node.ownerIndex, 0];
      const child = this._node(
        childLabel,
        node.depth + 1,
        tri.a,
        tri.b,
        tri.c,
        node
      );
      child.ownerIndex = Number.isInteger(entry[1]) ? entry[1] : node.ownerIndex;
      child.clicks = Number.isFinite(entry[2]) ? Math.max(0, Math.trunc(entry[2])) : 0;
      child.resourceId = typeof entry[3] === 'string' && entry[3] ? entry[3] : null;
      child.lastClickIndex = Number.isInteger(entry[4]) ? entry[4] : child.ownerIndex;
      this.nodes.set(childLabel, child);
      children.push(child);
    }
    node.children = children;
    this.leaves.delete(label);
    for (const child of children) this.leaves.set(child.label, child);
    this._bumpRevision();
    return children;
  }

  leafCount() {
    return this.leaves.size;
  }

  get(label) {
    return this.leaves.get(label) || null;
  }

  deepestDepth() {
    let max = 0;
    for (const node of this.leaves.values()) if (node.depth > max) max = node.depth;
    return max;
  }

  deepestOwnedDepth(ownerIndex) {
    let max = 0;
    for (const node of this.leaves.values()) {
      if (node.ownerIndex === ownerIndex && node.depth > max) max = node.depth;
    }
    return max;
  }
}
