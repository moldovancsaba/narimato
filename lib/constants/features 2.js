// FUNCTIONAL: Feature flags and runtime capability checks for perceptual feedback (audio tick fallback)
// STRATEGIC: Governance-compliant toggles allow safe, incremental rollout across devices/browsers without new deps

// Public env var controls (Next.js exposes NEXT_PUBLIC_* to client)
const ENV_AUDIO_TICK = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_ENABLE_AUDIO_TICK;

export const FEATURES = {
  // FUNCTIONAL: Enables Web Audio "tick" fallback when vibration is unavailable
  // STRATEGIC: Disabled by default; can be enabled per environment and overridden by user/localStorage
  AUDIO_TICK_ENABLED: ENV_AUDIO_TICK === '1' || ENV_AUDIO_TICK === 'true',
};

// FUNCTIONAL: Read a boolean localStorage flag safely
// STRATEGIC: Allows per-user overrides without a DB migration; name is namespaced to avoid collision
export function readLocalFlag(key, defaultValue = false) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (raw == null) return defaultValue;
    const val = raw.toLowerCase();
    return val === '1' || val === 'true' || val === 'yes' || val === 'on';
  } catch (_e) {
    return defaultValue;
  }
}

// FUNCTIONAL: Detect user preference for reduced motion
// STRATEGIC: Accessibility baseline — we avoid playing audio ticks or micro-animations when users prefer reduced motion
export function isReducedMotionPreferred() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_e) {
    return false;
  }
}

// FUNCTIONAL: Determine whether audio tick fallback should be used
// STRATEGIC: Combines env, local override, and accessibility preference
export function shouldUseAudioTick() {
  // Local override takes precedence over env off (to allow enabling locally), but cannot override reduced-motion preference
  if (isReducedMotionPreferred()) return false;
  const localOn = readLocalFlag('narimato_audio_tick', false);
  return FEATURES.AUDIO_TICK_ENABLED || localOn;
}
