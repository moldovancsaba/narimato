/**
 * NARIMATO — GDS island bridge (UI-02…UI-05).
 *
 * A tiny, dependency-free boundary the legacy controllers use to publish state
 * slices to the committed island and to listen for island intents. Nothing here
 * touches the DOM at import time; with the island absent every call is a no-op,
 * so `?gds=0` keeps the legacy UI working unchanged.
 */

export const INTENT_EVENT = 'narimato:gds-intent';

/** True when the GDS island is booted and owns presentation. */
export function gdsActive() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.gdsUi === 'on';
}

function island() {
  if (typeof window === 'undefined') return null;
  const api = window.__NARIMATO_GDS__;
  return api && typeof api.update === 'function' ? api : null;
}

/** Publish one namespaced slice; returns false when the island is absent. */
export function publish(slice) {
  // Route presentation slices through the UI controller so one publisher owns
  // the snapshot the island renders (UI-02…UI-05).
  const ui = typeof window !== 'undefined' ? window.__NARIMATO_UI__ : null;
  if (ui && typeof ui === 'object') {
    if (slice && slice.cine && typeof ui.setCine === 'function') return ui.setCine(slice.cine) !== false;
    if (slice && slice.incident && typeof ui.setIncident === 'function') return ui.setIncident(slice.incident) !== false;
    if (slice && slice.captions && typeof ui.setCaptions === 'function') return ui.setCaptions(slice.captions) !== false;
    if (slice && slice.voice && typeof ui.setVoice === 'function') return ui.setVoice(slice.voice) !== false;
  }
  const api = island();
  if (!api || !slice || typeof slice !== 'object') return false;
  try {
    return api.update(slice) !== false;
  } catch {
    return false;
  }
}

/** Dismiss the fallback banner once a real island surface has taken over. */
export function clearFallbackBanner() {
  if (typeof document === 'undefined') return;
  const banner = document.getElementById('gds-fallback-banner');
  if (banner && typeof banner.remove === 'function') banner.remove();
}
