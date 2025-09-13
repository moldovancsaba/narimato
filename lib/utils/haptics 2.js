// FUNCTIONAL: Cross-platform perceptual feedback helper (vibration when available; audio tick fallback)
// STRATEGIC: Delivers consistent UX across devices/browsers without native APIs; respects accessibility and feature flags

import { shouldUseAudioTick, isReducedMotionPreferred } from '../constants/features';
import { playTick } from './audioTick';

function canVibrate() {
  try {
    return typeof navigator !== 'undefined' && !!navigator.vibrate;
  } catch (_e) {
    return false;
  }
}

// FUNCTIONAL: Trigger a light vibration if supported
// STRATEGIC: Keep patterns short to minimize distraction and battery impact
function vibrateLight() {
  try {
    if (!canVibrate()) return false;
    // Very short pulse (~10ms). Some browsers clamp values; keep minimal.
    return navigator.vibrate(10);
  } catch (_e) {
    return false;
  }
}

// FUNCTIONAL: Trigger a success vibration pattern (slightly longer)
function vibrateSuccess() {
  try {
    if (!canVibrate()) return false;
    // Two short pulses to indicate success (10ms, pause 20ms, 10ms)
    return navigator.vibrate([10, 20, 10]);
  } catch (_e) {
    return false;
  }
}

// Public API
export const haptics = {
  // FUNCTIONAL: Light feedback for gesture recognition (e.g., button press, swipe start)
  // STRATEGIC: Prefer vibration when available; otherwise use optional audio tick if feature-enabled
  async light() {
    if (isReducedMotionPreferred()) return; // Accessibility override

    const vibbed = vibrateLight();
    if (!vibbed && shouldUseAudioTick()) {
      await playTick({ frequency: 1600, duration: 0.018, volume: 0.018 });
    }
  },

  // FUNCTIONAL: Success feedback for action completion (e.g., swipe accepted)
  async success() {
    if (isReducedMotionPreferred()) return; // Accessibility override

    const vibbed = vibrateSuccess();
    if (!vibbed && shouldUseAudioTick()) {
      await playTick({ frequency: 2000, duration: 0.022, volume: 0.022 });
    }
  },
};
