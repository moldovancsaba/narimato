/**
 * NARIMATO — intro/interlude chrome slice mapping (UI-05).
 *
 * Pure, dependency-free helpers shared by `public/js/intro.js`,
 * `public/js/interlude.js`, `public/js/narrator.js`, the GDS island and the
 * node:test suite. Controllers keep the timing state machines; this module owns
 * the copy/progress/caption normalisation and the steering-key scoping rules.
 */

export const CINE_KINDS = Object.freeze(['intro', 'interlude']);
export const CINE_PHASES = Object.freeze({
  intro: ['idle', 'wormhole', 'drift', 'descent', 'complete'],
  interlude: ['idle', 'launch', 'event', 'fall', 'complete'],
});

export const INTRO_PHASE_COPY = Object.freeze({
  wormhole: {
    label: 'WORMHOLE EXIT // YEAR 2189',
    main: 'WORMHOLE EXIT',
    sub: 'HULL STRESS CRITICAL // UNKNOWN SYSTEM',
  },
  drift: {
    label: 'GRAVITY WELL',
    main: 'GRAVITY LOCK',
    sub: 'THRUSTERS UNRESPONSIVE // WASD / ARROWS / DRAG TO STEER',
  },
  descent: {
    label: 'ATMOSPHERIC CAPTURE',
    main: 'PLANETARY CAPTURE',
    sub: 'FALLING INTO THE GRAVITY WELL // COCKPIT FRAME FAILING',
  },
  complete: {
    label: 'SURFACE CONTACT',
    main: 'FUEL EMPTY',
    sub: 'GRAVITY CAPTURE // MINE REQUIRED ORES TO REBUILD THE DRIVE',
  },
});

export const INTERLUDE_PHASE_COPY = Object.freeze({
  launch: { status: 'ESCAPE BURN', title: 'ESCAPE BURN', sub: 'CLEARING THE GRAVITY WELL' },
  event: { status: 'SPACE STORM', title: 'SPACE STORM', sub: 'HULL BREACH // UNCONTROLLED DRIFT' },
  fall: { status: 'EMERGENCY LANDING', title: 'EMERGENCY LANDING', sub: 'NEW PLANET DETECTED // BRACE FOR IMPACT' },
});

export const REDUCED_MOTION_SCALE = 0.35;
export const CAPTION_GAP_MS = 340;

const CONTROL_SELECTOR = 'button, a, input, select, textarea, [role="button"], [contenteditable="true"], [data-gds-control]';

/** Intro phase copy with the planet name interpolated exactly as the cine does. */
export function introCopy(phase, planetName = 'UNKNOWN WORLD') {
  const copy = { ...(INTRO_PHASE_COPY[phase] || INTRO_PHASE_COPY.wormhole) };
  const planet = String(planetName || '').trim().toUpperCase() || 'UNKNOWN WORLD';
  if (phase === 'drift') copy.label = `GRAVITY WELL // ${planet}`;
  if (phase === 'descent') copy.sub = `FALLING INTO ${planet} // COCKPIT FRAME FAILING`;
  return copy;
}

export function clampProgress(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function durationScale(prefersReducedMotion) {
  return prefersReducedMotion === true ? REDUCED_MOTION_SCALE : 1;
}

/** Progress never moves backwards when the reduced-motion preference flips. */
export function nextProgress(previous, elapsed, total, scale = 1) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeScale = Math.max(0.01, Number(scale) || 1);
  const pct = clampProgress((Math.max(0, Number(elapsed) || 0) / (safeTotal * safeScale)) * 100);
  return pct < previous ? previous : pct;
}

/** Normalise any controller update into the slice the island renders. */
export function mapCineSlice(kind, input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const resolvedKind = CINE_KINDS.includes(kind) ? kind : 'intro';
  const phases = CINE_PHASES[resolvedKind];
  const phase = phases.includes(src.phase) ? src.phase : 'idle';
  const copy = src.copy && typeof src.copy === 'object' ? src.copy : {};
  const captions = src.captions && typeof src.captions === 'object' ? src.captions : {};
  return {
    kind: resolvedKind,
    active: src.active === true,
    phase,
    progress: clampProgress(src.progress),
    copy: {
      kicker: String(copy.kicker || ''),
      title: String(copy.title || ''),
      sub: String(copy.sub || ''),
      alarm: copy.alarm == null ? undefined : String(copy.alarm),
    },
    captions: {
      speaker: String(captions.speaker || 'NARRATOR'),
      text: String(captions.text || ''),
      visible: captions.visible === true,
    },
    motion: src.motion === 'reduced' ? 'reduced' : 'full',
    skipVisible: src.skipVisible === true,
    continueVisible: src.continueVisible === true,
    voice: src.voice === true,
    subtitles: src.subtitles !== false,
  };
}

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

const CINE_STEER_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd']);

/**
 * Steering keys stay available during the cine, but a focused chrome control
 * keeps its native keys (Space/Enter activate, arrows do not get stolen).
 */
export function shouldCaptureCineKey({ key, target, active }) {
  if (!active) return false;
  if (isControlFocused(target)) return false;
  if (String(key || '').toLowerCase() === 'escape') return true;
  return CINE_STEER_KEYS.has(String(key || '').toLowerCase());
}

/**
 * Caption write contract: reset the live region before each write so a repeated
 * sentence is announced again, then append speaker and sentence as text nodes.
 */
export function writeCaption(region, speaker, text, doc = null) {
  const documentRef = doc || (region && region.ownerDocument) || null;
  if (!region || !documentRef || typeof documentRef.createElement !== 'function') return false;
  region.textContent = '';
  const speakerNode = documentRef.createElement('span');
  speakerNode.className = 'subtitle-speaker';
  speakerNode.textContent = String(speaker || 'NARRATOR').toUpperCase();
  const textNode = documentRef.createElement('span');
  textNode.className = 'subtitle-text';
  textNode.textContent = String(text || '');
  region.appendChild(speakerNode);
  region.appendChild(textNode);
  return true;
}

/** `TAP FOR VOICE` hint is part of the speaker label until audio is unlocked. */
export function speakerLabel(speaker, voiceEnabled, unlocked) {
  const label = String(speaker || 'NARIMATO').toUpperCase();
  return voiceEnabled && !unlocked ? `${label} · TAP FOR VOICE` : label;
}

export const CAPTION_TOGGLES = Object.freeze({
  subtitles: { label: 'CC subtitles', pressedLabel: 'Subtitles' },
  voice: { label: 'VOX narration voice', pressedLabel: 'Narration voice' },
});
