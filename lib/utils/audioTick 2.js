// FUNCTIONAL: Minimal Web Audio "tick" utility for perceptual feedback
// STRATEGIC: Provides a cross-platform fallback when device vibration isn't available (e.g., iOS Safari)
// - No external deps
// - Initializes AudioContext only in response to a user gesture
// - Respects reduced-motion and feature flags (controlled by caller)

let audioCtx = null; // Lazily created AudioContext (user-gesture gated by caller)

function ensureContext() {
  // Some browsers (especially iOS Safari) require creation within a user gesture
  if (typeof window === 'undefined') return null;
  try {
    // eslint-disable-next-line no-undef
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (audioCtx && audioCtx.state !== 'closed') return audioCtx;
    audioCtx = new Ctor();
    return audioCtx;
  } catch (_e) {
    return null;
  }
}

// FUNCTIONAL: Play a very short, unobtrusive tick
// STRATEGIC: Keep the envelope extremely brief and quiet to avoid annoyance
export async function playTick({ frequency = 1800, duration = 0.02, volume = 0.02 } = {}) {
  const ctx = ensureContext();
  if (!ctx) return false;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = frequency; // Hz

    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);

    // Simple exponential fade-out to avoid clicks
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.stop(now + duration + 0.005);
    return true;
  } catch (_e) {
    // Swallow errors; fallback is optional
    return false;
  }
}

// FUNCTIONAL: Teardown for cleanup (optional)
// STRATEGIC: Free audio resources if needed (rare in SPA, but safe to expose)
export function disposeAudioTick() {
  try {
    if (audioCtx && typeof audioCtx.close === 'function') {
      audioCtx.close();
    }
  } catch (_e) {
    // noop
  } finally {
    audioCtx = null;
  }
}
