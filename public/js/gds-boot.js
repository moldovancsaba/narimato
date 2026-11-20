/**
 * NARIMATO — GDS island page boot (issue UI-01; surface mount UI-02…UI-05).
 *
 * Loaded by `public/index.html` after the unchanged game entry. It imports the
 * committed island bundle (`/ui/island.js`) only when the flags select GDS,
 * boots exactly one provider/root, hands presentation to the island, and mounts
 * the single `app` surface. If anything fails, the game keeps running and a
 * dismissible `GDS UNAVAILABLE // LEGACY UI` banner appears.
 *
 * This file is served as-is by the zero-dependency server and is never bundled.
 */
import { bootstrapGds } from './gds-adapter.js';
import { clearFallbackBanner } from './gds-bridge.js';

const win = typeof window === 'undefined' ? null : window;
const INTENT_EVENT = 'narimato:gds-intent';

if (win && !win.__NARIMATO_GDS_BOOT__) {
  const safeStorage = (name) => {
    try {
      return win[name] || null;
    } catch {
      return null;
    }
  };

  // One intent channel: the island dispatches, the frozen UI controller acts.
  win.addEventListener(INTENT_EVENT, (event) => {
    const ui = win.__NARIMATO_UI__;
    if (ui && typeof ui.handleGdsIntent === 'function') {
      try {
        ui.handleGdsIntent(event.detail || {});
      } catch (error) {
        console.warn('[gds-boot] intent failed', error);
      }
    }
  });

  bootstrapGds({
    window: win,
    document: win.document,
    location: win.location,
    localStorage: safeStorage('localStorage'),
    sessionStorage: safeStorage('sessionStorage'),
    importIsland: () => import('/ui/island.js'),
    fetchManifest: () =>
      fetch('/ui/manifest.json', { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)),
    logger: console,
  })
    .then((record) => {
      if (!record || record.booted !== true) return record;
      const ui = win.__NARIMATO_UI__;
      // Move presentation ownership before mounting so required ids are unique.
      if (ui && typeof ui.enableGds === 'function') {
        try {
          ui.enableGds();
        } catch (error) {
          console.warn('[gds-boot] enableGds failed; legacy chrome stays live', error);
        }
      }
      if (record.mode !== 'proof') {
        const island = win.__NARIMATO_GDS__;
        if (island && typeof island.mount === 'function') island.mount('app', win.document.getElementById('gds-root'));
      }
      clearFallbackBanner();
      win.dispatchEvent(new win.CustomEvent('narimato:gds-ready'));
      return record;
    })
    .catch((error) => {
      // bootstrapGds never rejects by contract; this is a last-resort guard.
      console.warn('[gds-boot] unexpected failure', error);
    });
}
