/**
 * NARIMATO — pointer router (CTL-06).
 *
 * One boundary for touch, mouse and pen: it assigns a role per pointer,
 * captures that pointer for the duration of the gesture, and emits small
 * intents. Consumers (intro steering, orbit camera, surface steering, pinch)
 * never call `setPointerCapture` themselves and never track pointer ids.
 *
 * DOM-free core: pass plain pointer records (`{pointerId, clientX, clientY,
 * target}`) and injected `capture`/`release` callbacks, so the routing rules are
 * unit-testable in Node. `attachPointerRouter` wires real DOM events; it is the
 * only place that calls `setPointerCapture`.
 *
 * Roles: `steer` (a hold pad), `orbit-drag` (canvas), `pinch` (two canvas
 * pointers), `ui` (chrome; ignored) and `ignored` (a third finger).
 */

export const POINTER_ROLES = Object.freeze(['steer', 'orbit-drag', 'pinch', 'ui']);
export const TAP_SLOP_PX = 7;
export const TAP_MS = 900;
/** Ignore sub-2% pinch jitter so a still hand cannot zoom. */
export const PINCH_DEAD_ZONE = 0.02;

const noop = () => false;

function readRole(el) {
  let node = el;
  for (let depth = 0; node && depth < 8; depth += 1) {
    if (typeof node.getAttribute === 'function') {
      const role = node.getAttribute('data-pointer-role');
      if (role) return role;
    }
    node = node.parentNode || node.parentElement || null;
  }
  return null;
}

export function pointerRecord(event, now = () => 0) {
  if (!event) return null;
  return {
    pointerId: event.pointerId,
    clientX: Number(event.clientX) || 0,
    clientY: Number(event.clientY) || 0,
    target: event.target || null,
    t: now(),
  };
}

/**
 * @param {object} [options]
 * @param {(element:any, pointerId:number)=>boolean} [options.capture]
 * @param {(element:any, pointerId:number)=>boolean} [options.release]
 * @param {(intent:object)=>void} [options.onIntent]
 * @param {(element:any)=>string|null} [options.roleFor]
 * @param {any} [options.canvas] element that maps to the `orbit-drag` role
 * @param {()=>number} [options.now]
 */
export function createPointerRouter({
  capture = noop,
  release = noop,
  onIntent = () => {},
  roleFor = readRole,
  canvas = null,
  now = () => Date.now(),
  tapSlop = TAP_SLOP_PX,
  tapMs = TAP_MS,
  pinchDeadZone = PINCH_DEAD_ZONE,
} = {}) {
  /** @type {Map<number, object>} */
  const pointers = new Map();
  let pinchBaseDist = 0;
  let pinchLastDist = 0;

  const emit = (intent) => {
    try {
      onIntent(intent);
    } catch {
      /* an intent handler must never break routing */
    }
  };

  function roleOf(record) {
    const declared = roleFor(record.target);
    if (declared === 'steer' || declared === 'orbit-drag' || declared === 'pinch' || declared === 'ui') return declared;
    if (canvas && record.target === canvas) return 'orbit-drag';
    return 'ui';
  }

  function captureFor(record, role) {
    if (role !== 'steer' && role !== 'orbit-drag' && role !== 'pinch') return false;
    try {
      return capture(record.target, record.pointerId) !== false;
    } catch {
      return false;
    }
  }

  function releaseFor(record) {
    if (!record || !record.captured) return;
    try {
      release(record.element || record.target, record.pointerId);
    } catch {
      /* capture may already be gone */
    }
  }

  function orbitDrags() {
    return [...pointers.values()].filter((p) => p.role === 'orbit-drag');
  }

  function pinchPointers() {
    return [...pointers.values()].filter((p) => p.role === 'pinch');
  }

  function distance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function demoteToPinch() {
    const drags = orbitDrags();
    if (drags.length < 2) return false;
    const [a, b] = drags;
    a.role = 'pinch';
    b.role = 'pinch';
    pinchBaseDist = distance(a, b);
    pinchLastDist = pinchBaseDist;
    emit({ kind: 'pinch', phase: 'start', scale: 1, x: b.clientX, y: b.clientY });
    return true;
  }

  function down(record) {
    if (!record) return null;
    const role = roleOf(record);
    if (role === 'ui') {
      emit({ kind: 'ui', phase: 'down', x: record.clientX, y: record.clientY, target: record.target });
      return 'ui';
    }
    // A third finger during pinch is ignored until the count returns to two.
    if (role === 'orbit-drag' && pinchPointers().length >= 2) {
      pointers.set(record.pointerId, { ...record, role: 'ignored', captured: false, moved: 0 });
      return 'ignored';
    }
    if (role === 'orbit-drag' && orbitDrags().length >= 1) {
      const stored = {
        ...record,
        role: 'orbit-drag',
        element: record.target,
        captured: false,
        moved: 0,
        lastX: record.clientX,
        lastY: record.clientY,
      };
      stored.captured = captureFor(stored, 'orbit-drag');
      pointers.set(record.pointerId, stored);
      demoteToPinch();
      return 'pinch';
    }
    const stored = {
      ...record,
      role,
      element: record.target,
      captured: false,
      moved: 0,
      lastX: record.clientX,
      lastY: record.clientY,
    };
    stored.captured = captureFor(stored, role);
    pointers.set(record.pointerId, stored);
    if (role === 'steer') {
      emit({ kind: 'steer', phase: 'start', hold: holdOf(record.target), x: record.clientX, y: record.clientY });
    } else if (role === 'orbit-drag') {
      emit({ kind: 'orbit-drag', phase: 'start', x: record.clientX, y: record.clientY });
    } else if (role === 'pinch') {
      emit({ kind: 'pinch', phase: 'start', scale: 1, x: record.clientX, y: record.clientY });
    }
    return role;
  }

  function move(record) {
    if (!record) return;
    const stored = pointers.get(record.pointerId);
    if (!stored) return;
    stored.clientX = record.clientX;
    stored.clientY = record.clientY;
    stored.t = record.t;
    if (stored.role === 'ignored' || stored.role === 'ui') return;
    if (stored.role === 'steer') {
      emit({ kind: 'steer', phase: 'move', hold: holdOf(stored.target), x: record.clientX, y: record.clientY });
      return;
    }
    if (stored.role === 'orbit-drag') {
      const dx = record.clientX - stored.lastX;
      const dy = record.clientY - stored.lastY;
      stored.lastX = record.clientX;
      stored.lastY = record.clientY;
      stored.moved += Math.abs(dx) + Math.abs(dy);
      emit({ kind: 'orbit-drag', phase: 'move', dx, dy, x: record.clientX, y: record.clientY });
      return;
    }
    if (stored.role === 'pinch') {
      const pinch = pinchPointers();
      if (pinch.length < 2) return;
      const dist = distance(pinch[0], pinch[1]);
      if (!(pinchLastDist > 0) || !(dist > 0)) return;
      const scale = dist / pinchLastDist;
      if (Math.abs(scale - 1) < pinchDeadZone) return;
      pinchLastDist = dist;
      emit({ kind: 'pinch', phase: 'move', scale, x: record.clientX, y: record.clientY });
    }
  }

  function end(record) {
    if (!record) return;
    const stored = pointers.get(record.pointerId);
    if (!stored) return;
    pointers.delete(record.pointerId);
    releaseFor(stored);
    if (stored.role === 'steer') {
      emit({ kind: 'steer', phase: 'end', hold: holdOf(stored.target), x: record.clientX, y: record.clientY });
      return;
    }
    if (stored.role === 'orbit-drag') {
      const elapsed = Math.max(0, Number(record.t || now()) - Number(stored.t || 0));
      if (stored.moved <= tapSlop && elapsed <= tapMs) {
        emit({ kind: 'tap', x: record.clientX, y: record.clientY });
      }
      emit({ kind: 'orbit-drag', phase: 'end', x: record.clientX, y: record.clientY });
      return;
    }
    if (stored.role === 'pinch') {
      const remaining = pinchPointers();
      if (remaining.length >= 2) {
        pinchLastDist = distance(remaining[0], remaining[1]);
        return;
      }
      if (remaining.length === 1) {
        // Stay in the gesture: one finger holds the drag where it is.
        const last = remaining[0];
        last.role = 'orbit-drag';
        last.lastX = last.clientX;
        last.lastY = last.clientY;
        emit({ kind: 'orbit-drag', phase: 'start', x: last.clientX, y: last.clientY });
        return;
      }
      pinchBaseDist = 0;
      pinchLastDist = 0;
      emit({ kind: 'pinch', phase: 'end', scale: 1, x: record.clientX, y: record.clientY });
    }
  }

  function cancel(record) {
    if (!record) return;
    const stored = pointers.get(record.pointerId);
    if (!stored) return;
    pointers.delete(record.pointerId);
    releaseFor(stored);
    if (stored.role === 'steer') {
      emit({ kind: 'steer', phase: 'end', hold: holdOf(stored.target), cancelled: true, x: record.clientX, y: record.clientY });
    } else if (stored.role === 'orbit-drag') {
      emit({ kind: 'orbit-drag', phase: 'end', cancelled: true, x: record.clientX, y: record.clientY });
    } else if (stored.role === 'pinch') {
      pinchBaseDist = 0;
      pinchLastDist = 0;
      emit({ kind: 'pinch', phase: 'end', cancelled: true, scale: 1, x: record.clientX, y: record.clientY });
    }
  }

  /** A captured pointer leaving its element still owns the gesture. */
  function leave(record) {
    const stored = record ? pointers.get(record.pointerId) : null;
    if (!stored || stored.captured) return false;
    end(record);
    return true;
  }

  /** Emit `cancel-all`: blur, visibilitychange and orientationchange all use it. */
  function cancelAll(reason = 'cancel-all') {
    if (!pointers.size) {
      emit({ kind: 'cancel-all', reason });
      return false;
    }
    const hadSteer = [...pointers.values()].some((p) => p.role === 'steer');
    const hadPinch = [...pointers.values()].some((p) => p.role === 'pinch');
    for (const stored of pointers.values()) releaseFor(stored);
    pointers.clear();
    pinchBaseDist = 0;
    pinchLastDist = 0;
    if (hadPinch) emit({ kind: 'pinch', phase: 'end', cancelled: true, scale: 1 });
    emit({ kind: 'cancel-all', reason, steer: hadSteer });
    return true;
  }

  return {
    down,
    move,
    end,
    cancel,
    leave,
    cancelAll,
    roleOf: (pointerId) => (pointers.get(pointerId) || {}).role || null,
    activeCount: () => pointers.size,
    roles: () => [...pointers.values()].map((p) => p.role),
    /** Test hook: force the two-pointer demotion path. */
    demoteToPinch,
  };
}

function holdOf(target) {
  let node = target;
  for (let depth = 0; node && depth < 6; depth += 1) {
    if (typeof node.getAttribute === 'function') {
      const hold = node.getAttribute('data-hold') || node.getAttribute('data-surface-hold');
      if (hold) return hold;
    }
    node = node.parentNode || node.parentElement || null;
  }
  return null;
}

const ROLE_ATTR = 'data-pointer-role';

/**
 * Wire a router to one element's pointer events. This helper (and this module)
 * is the only caller of `setPointerCapture`; every consumer goes through it.
 * @returns {{detach:()=>void, router:object}}
 */
export function attachPointerRouter(element, options = {}) {
  const router = options.router || createPointerRouter(options);
  if (!element) return { detach: () => {}, router };
  const now = options.now || (() => Date.now());
  const onDown = (event) => router.down(pointerRecord(event, now));
  const onMove = (event) => router.move(pointerRecord(event, now));
  const onUp = (event) => router.end(pointerRecord(event, now));
  const onCancel = (event) => router.cancel(pointerRecord(event, now));
  const onLeave = (event) => router.leave(pointerRecord(event, now));
  const onLostCapture = (event) => router.cancel(pointerRecord(event, now));
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onCancel);
  element.addEventListener('pointerleave', onLeave);
  element.addEventListener('lostpointercapture', onLostCapture);
  return {
    router,
    detach() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('lostpointercapture', onLostCapture);
      router.cancelAll('detach');
    },
  };
}

/**
 * Global cleanup: a backgrounded tab, a blur or an orientation change must never
 * leave a stale steering/drag role behind. Injected objects keep this testable.
 * @returns {() => void} detach
 */
export function watchPointerEnvironment(router, { win = null, doc = null } = {}) {
  if (!router || !(win || doc)) return () => {};
  const onBlur = () => router.cancelAll('blur');
  const onOrientation = () => router.cancelAll('orientation');
  const onVisibility = () => {
    const state = doc && doc.visibilityState;
    if (state === 'hidden') router.cancelAll('visibility');
  };
  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('blur', onBlur);
    win.addEventListener('orientationchange', onOrientation);
  }
  if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('blur', onBlur);
      win.removeEventListener('orientationchange', onOrientation);
    }
    if (doc && typeof doc.removeEventListener === 'function') doc.removeEventListener('visibilitychange', onVisibility);
  };
}

/** Capture that degrades gracefully when the browser denies it. */
export function capturePointer(element, pointerId) {
  try {
    if (element && typeof element.setPointerCapture === 'function') {
      element.setPointerCapture(pointerId);
      return true;
    }
  } catch {
    /* capture denied: pointerleave cleanup still ends the gesture */
  }
  return false;
}

export function releasePointer(element, pointerId) {
  try {
    if (element && typeof element.releasePointerCapture === 'function') element.releasePointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

/** `data-pointer-role` constants for markup and tests. */
export const POINTER_ROLE_ATTR = ROLE_ATTR;
