/**
 * NARIMATO — harvest truth (CTL-03).
 *
 * One pure, reason-carrying predicate decides whether the surface target is
 * green (the next `/api/action` click returns 200) or red (it returns 409 with
 * the same reason). Every consumer — target chip, footprint queue and renderer
 * highlight — reads this function; nobody compares owner or depth themselves.
 *
 * Precedence mirrors `WorldCore.click`:
 *   joined -> stale leaf -> cooldown -> own-cell lock
 *
 * `exhausted` (depth >= maxDepth) is informational only. The server accepts and
 * scores deep cells, so a depleted cell must never be red on its own.
 */

/** Reasons map 1:1 onto the server error enum. */
export const HARVEST_REASONS = Object.freeze(['ok', 'own_lock', 'cooldown', 'stale_leaf', 'not_joined']);

/** Server error code -> client reason. */
export const SERVER_REASON = Object.freeze({
  OWN_CELL_LOCKED: 'own_lock',
  COOLDOWN: 'cooldown',
  NOT_A_LEAF: 'stale_leaf',
  NOT_JOINED: 'not_joined',
});

export function reasonForServerError(error) {
  return SERVER_REASON[String(error || '')] || null;
}

const ok = (extra = {}) => ({ can: true, reason: 'ok', ...extra });
const no = (reason, extra = {}) => ({ can: false, reason, ...extra });

function sameEpoch(a, b) {
  // Both sides must opt in: a leaf without an epoch cannot be called stale.
  if (a === undefined || a === null || b === undefined || b === null) return true;
  return a === b;
}

/**
 * @param {{label?:string, ownerIndex?:number, lastClickIndex?:number, depth?:number, leafEpoch?:number}|null} cell
 * @param {{index?:number}|null} viewer the local player (`index` from server state)
 * @param {{myIndex?:number, maxDepth?:number, serverTimeMs?:number,
 *          lastClickAtMs?:number|null, clickCooldownMs?:number,
 *          leafEpoch?:number}|null} ctx
 * @returns {{can:boolean, reason:'ok'|'own_lock'|'cooldown'|'stale_leaf'|'not_joined',
 *            waitMs?:number, exhausted:boolean}}
 */
export function harvestStatus(cell, viewer, ctx) {
  const context = ctx && typeof ctx === 'object' ? ctx : {};
  const viewerIndex = viewer && Number.isInteger(viewer.index) ? viewer.index : -1;
  if (viewerIndex < 0) return no('not_joined', { exhausted: false });
  if (!cell || typeof cell !== 'object') return no('stale_leaf', { exhausted: false });
  if (!sameEpoch(context.leafEpoch, cell.leafEpoch)) return no('stale_leaf', { exhausted: false });

  const maxDepth = Number.isInteger(context.maxDepth) ? context.maxDepth : -1;
  const exhausted = maxDepth >= 0 && Number(cell.depth) >= maxDepth;

  const cooldownMs = Math.max(0, Number(context.clickCooldownMs) || 0);
  let waitMs = 0;
  if (cooldownMs > 0 && Number.isFinite(context.lastClickAtMs) && Number.isFinite(context.serverTimeMs)) {
    // Clamp into the cooldown window: a future lastClick (clock skew) cannot
    // report a wait longer than the cooldown the server enforces.
    waitMs = Math.min(cooldownMs, Math.max(0, cooldownMs - (context.serverTimeMs - context.lastClickAtMs)));
  }
  if (waitMs > 0) return no('cooldown', { waitMs, exhausted });

  if (Number(cell.ownerIndex) === viewerIndex && Number(cell.lastClickIndex) === viewerIndex) {
    return no('own_lock', { exhausted });
  }
  return ok({ exhausted });
}

/**
 * Human readout for the shared `#surface-target` chip. Colour is never the only
 * signal: the text carries GREEN/RED plus the reason.
 * @returns {{text:string, state:'idle'|'syncing'|'can'|'locked'|'cooldown'|'stale', exhausted:boolean}}
 */
export function harvestReadout(label, status, joined = true) {
  const id = label == null ? '' : String(label);
  if (!id) return { text: 'TARGET: —', state: 'idle', exhausted: false };
  const result = status && typeof status === 'object' ? status : { can: false, reason: 'not_joined', exhausted: false };
  if (result.reason === 'not_joined') {
    return joined
      ? { text: `TARGET ${id} // SYNCING`, state: 'syncing', exhausted: false }
      : { text: 'TARGET: SYNCING', state: 'syncing', exhausted: false };
  }
  const exhausted = !!result.exhausted;
  if (result.can) return { text: `TARGET ${id} // GREEN // HARVEST`, state: 'can', exhausted };
  if (result.reason === 'cooldown') return { text: `TARGET ${id} // RED // COOLDOWN`, state: 'cooldown', exhausted };
  if (result.reason === 'stale_leaf') return { text: `TARGET ${id} // RED // STALE`, state: 'stale', exhausted };
  return { text: `TARGET ${id} // RED // LOCKED`, state: 'locked', exhausted };
}

/** Backwards-compatible boolean for callers that only need eligibility. */
export function canHarvestCell(cell, myIndex, maxDepth) {
  return harvestStatus(cell, { index: myIndex }, { maxDepth }).can;
}
