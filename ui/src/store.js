/**
 * NARIMATO — frame-coalescing island store (issue UI-01).
 *
 * `update(slice)` may be called at 10 Hz by the legacy HUD cadence (`updateHud`).
 * It merges the slice immediately but notifies React at most once per animation
 * frame, so the island commits once per frame instead of once per call. A
 * microtask fallback keeps the store usable in Node (unit tests) and in browsers
 * where `requestAnimationFrame` is unavailable.
 *
 * Zero dependencies; the store is a plain ES module so it can be unit tested
 * outside the bundle.
 */

const DEFAULT_FRAME_MS = 16;

function defaultScheduler(run) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(run);
    return;
  }
  if (typeof globalThis.setTimeout === 'function') {
    globalThis.setTimeout(run, DEFAULT_FRAME_MS);
    return;
  }
  queueMicrotask(run);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Create a store with a single committed state object.
 *
 * @param {object} [initialState] initial state
 * @param {{ schedule?: (run: () => void) => void }} [options] frame scheduler override
 * @returns {{
 *   getState: () => object,
 *   subscribe: (listener: (state: object) => void) => () => void,
 *   update: (slice: object) => boolean,
 *   flush: () => boolean,
 *   commits: () => number,
 * }}
 */
export function createStore(initialState = {}, options = {}) {
  const schedule = typeof options.schedule === 'function' ? options.schedule : defaultScheduler;
  const listeners = new Set();

  let state = Object.freeze({ ...initialState });
  let pending = null;
  let scheduled = false;
  let commitCount = 0;

  const commit = () => {
    scheduled = false;
    if (!pending) return false;
    const next = pending;
    pending = null;
    if (shallowEqual(next, state)) return false;
    state = Object.freeze(next);
    commitCount += 1;
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch (error) {
        // A broken subscriber must not stop the other subscribers or the boot.
        if (typeof console !== 'undefined' && console.error) console.error('[gds-store] listener failed', error);
      }
    }
    return true;
  };

  const flush = () => {
    if (!pending) return false;
    return commit();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('store.subscribe(listener) requires a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(slice) {
      if (!slice || typeof slice !== 'object') return false;
      const base = pending || state;
      const next = { ...base, ...slice };
      if (shallowEqual(next, base)) return false;
      pending = next;
      if (!scheduled) {
        scheduled = true;
        schedule(commit);
      }
      return true;
    },
    flush,
    commits: () => commitCount,
  };
}
