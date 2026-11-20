/**
 * NARIMATO — HUD parity contract (RND-03).
 *
 * One mounted HUD tree serves orbit and surface. Surface mode adds only its
 * control strip, target readout, lap and exit; orbit-owned nodes must keep
 * their identity before, during and after surface entry.
 *
 * This module is DOM-free so the parity mathematics is unit-testable in Node:
 * the browser HUD controller feeds it ordered `data-hud-node` ids, and the
 * Playwright acceptance script feeds it real snapshots.
 */

/** Nodes owned by the always-mounted orbital HUD. */
export const ORBIT_HUD_NODES = Object.freeze([
  'hud',
  'nav',
  'planet',
  'world',
  'score',
  'clicks',
  'breaks',
  'zoom',
  'mission',
  'mission-list',
  'cargo',
  'cargo-list',
  'players',
  'arcade',
  'target',
  'hint',
]);

/** Nodes surface mode adds to the same tree. */
export const SURFACE_HUD_NODES = Object.freeze([
  'surface-controls',
  'surface-target',
  'surface-lap',
  'surface-lap-value',
  'surface-auto',
  'surface-pads',
  'surface-forward',
  'surface-left',
  'surface-back',
  'surface-right',
  'surface-exit',
]);

export const ALL_HUD_NODES = Object.freeze([...ORBIT_HUD_NODES, ...SURFACE_HUD_NODES]);

const SURFACE_ONLY = new Set(SURFACE_HUD_NODES);

/** `true` when the id belongs to the surface-only addition set. */
export function isSurfaceOnlyNode(id) {
  return SURFACE_ONLY.has(String(id));
}

/**
 * Build an ordered snapshot from a list of `data-hud-node` ids.
 * @param {Array<string>} ids
 * @returns {{nodes:Array<string>, total:number, unique:number, duplicates:Array<string>}}
 */
export function snapshotFromIds(ids) {
  const list = Array.isArray(ids) ? ids : [];
  const counts = new Map();
  const nodes = [];
  for (const raw of list) {
    if (typeof raw !== 'string' || !raw) continue;
    const seen = counts.get(raw) || 0;
    counts.set(raw, seen + 1);
    if (seen === 0) nodes.push(raw);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  return {
    nodes,
    total: list.filter((id) => typeof id === 'string' && id).length,
    unique: nodes.length,
    duplicates,
  };
}

/**
 * Parity identity: `P = |before ∩ during ∩ after| / |before|` must be 1.0,
 * and no id may appear twice in any phase.
 * @param {{nodes:Array<string>}} before
 * @param {{nodes:Array<string>}} during
 * @param {{nodes:Array<string>}} after
 */
export function parity(before, during, after) {
  const first = Array.isArray(before && before.nodes) ? before.nodes : [];
  const mid = new Set(Array.isArray(during && during.nodes) ? during.nodes : []);
  const last = new Set(Array.isArray(after && after.nodes) ? after.nodes : []);
  const intersection = first.filter((id) => mid.has(id) && last.has(id));
  const P = first.length ? intersection.length / first.length : 1;
  const addedDuring = [...mid].filter((id) => !first.includes(id));
  const duplicates = [
    ...(before && before.duplicates ? before.duplicates : []),
    ...(during && during.duplicates ? during.duplicates : []),
    ...(after && after.duplicates ? after.duplicates : []),
  ];
  return {
    P,
    ok: P === 1 && duplicates.length === 0,
    missingDuring: first.filter((id) => !mid.has(id)),
    missingAfter: first.filter((id) => !last.has(id)),
    addedDuring,
    unexpectedDuring: addedDuring.filter((id) => !isSurfaceOnlyNode(id)),
    duplicates,
  };
}

/** Target readout text and state for the shared `#surface-target` node. */
export function targetReadout(label, harvestable) {
  const id = label == null ? '' : String(label);
  if (!id) return { text: 'TARGET: —', state: 'idle' };
  return {
    text: `TARGET ${id} // ${harvestable ? 'GREEN // HARVEST' : 'RED // LOCKED'}`,
    state: harvestable ? 'can' : 'locked',
  };
}

/** Lap progress as an integer percent 0..100 (progressbar aria-valuenow). */
export function lapPercent(fraction) {
  const value = Number(fraction);
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

/** Attribute values the mode switch applies to the one HUD tree. */
export function modeAttributes(mode) {
  const surface = mode === 'surface';
  return { hudMode: surface ? 'surface' : 'orbit', controlsHidden: !surface };
}
