/**
 * NARIMATO — surface HUD slice mapping and keyboard ownership (UI-04).
 *
 * Pure helpers shared by `public/js/surface-controller.js`, `public/js/ui.js`,
 * the GDS island and node:test. Surface mode is additive: one HUD tree, one
 * renderer, and the strip only owns its own controls and readouts.
 */

export const SURFACE_PHASES = Object.freeze(['landing', 'running', 'leaving', 'idle']);
export const TARGET_STATES = Object.freeze(['idle', 'can', 'locked', 'depleted']);

/** `data-surface-hold` intent names stay stable for the controller. */
export const MOVE_KEYS = Object.freeze({
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
});

export const MOVE_LABELS = Object.freeze({
  forward: 'Run forward',
  back: 'Run backward',
  left: 'Turn left',
  right: 'Turn right',
});

const STEER_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const ACTIVATION_KEYS = new Set(['Enter', ' ']);
const CONTROL_SELECTOR = 'button, a, input, select, textarea, [role="button"], [contenteditable="true"], [data-gds-control]';

export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** 0..100 integer lap progress, matching the legacy `#surface-lap` contract. */
export function lapPercent(fraction) {
  return Math.round(clamp01(fraction) * 100);
}

export function isSteerCode(code) {
  return STEER_CODES.has(String(code || ''));
}

export function isActivationKey(key) {
  return ACTIVATION_KEYS.has(String(key || ''));
}

/** True when the event target is a native control that must keep its keys. */
export function isControlFocused(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable === true) return true;
  if (typeof target.closest === 'function') {
    try {
      return !!target.closest(CONTROL_SELECTOR);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * One owner per key: the canvas captures steering only while the strip has not
 * taken keyboard ownership, and a focused control always wins.
 */
export function shouldCaptureSteering({ code, key, target, mode = 'canvas' } = {}) {
  if (mode !== 'canvas') return false;
  if (isControlFocused(target)) return false;
  if (String(key || '') === 'Escape') return true;
  return isSteerCode(code);
}

/** Map a controller readout into the additive surface slice. */
export function mapSurfaceSlice(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const phase = SURFACE_PHASES.includes(src.phase) ? src.phase : 'idle';
  const active = src.active === true;
  const targetLabel = src.targetLabel == null || src.targetLabel === '' ? null : String(src.targetLabel);
  let targetState = 'idle';
  if (src.depleted === true) targetState = 'depleted';
  else if (targetLabel && src.targetHarvestable === true) targetState = 'can';
  else if (targetLabel) targetState = 'locked';
  if (!TARGET_STATES.includes(targetState)) targetState = 'idle';
  const autopilot = src.autoLabel == null ? null : String(src.autoLabel);
  return {
    active,
    phase,
    lap: {
      seconds: Math.max(0, Number(src.lapSeconds) || 0),
      run: lapPercent(src.lapFraction),
      auto: autopilot,
    },
    target: { label: targetLabel, state: targetState },
    mission: {
      done: Math.max(0, Math.trunc(Number(src.missionDone) || 0)),
      total: Math.max(0, Math.trunc(Number(src.missionTotal) || 0)),
      ready: src.missionReady === true,
    },
    keyboard: {
      steering: src.keyboardMode !== 'controls',
      mode: src.keyboardMode === 'controls' ? 'controls' : 'canvas',
    },
  };
}

/** Text equivalent for every target state; colour is never the only signal. */
export function targetStateText(state, label) {
  if (!label) return 'TARGET: —';
  if (state === 'can') return `TARGET ${label} // GREEN // HARVEST`;
  if (state === 'depleted') return `TARGET ${label} // RED // DEPLETED`;
  if (state === 'locked') return `TARGET ${label} // RED // LOCKED`;
  return `TARGET ${label} // —`;
}

export function targetStateBadge(state) {
  if (state === 'can') return { status: 'success', text: 'GREEN // HARVEST' };
  if (state === 'depleted') return { status: 'danger', text: 'RED // DEPLETED' };
  if (state === 'locked') return { status: 'warning', text: 'RED // LOCKED' };
  return { status: 'neutral', text: 'NO TARGET' };
}

/** A surface exit is only disabled while the mode is already leaving. */
export function exitControl(phase) {
  if (phase === 'leaving') return { disabled: true, label: 'RETURNING TO ORBIT' };
  return { disabled: false, label: 'RETURN TO ORBIT' };
}

export function modeChip(slice) {
  const data = slice || {};
  return {
    surface: data.active === true ? 'SURFACE' : 'ORBIT',
    keyboard: data.keyboard && data.keyboard.mode === 'controls' ? 'UI' : 'STEERING',
  };
}
