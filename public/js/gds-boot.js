/**
 * NARIMATO — GDS island page boot (issue UI-01).
 *
 * Loaded by `public/index.html` after the unchanged game entry. It imports the
 * committed island bundle (`/ui/island.js`) only when the flags select GDS,
 * boots exactly one provider/root, and mounts the proof surface for
 * `?gds=proof`. If anything fails, the game keeps running and a dismissible
 * `GDS UNAVAILABLE // LEGACY UI` banner appears.
 *
 * This file is served as-is by the zero-dependency server and is never bundled.
 */
import { bootstrapGds } from './gds-adapter.js';

const win = typeof window === 'undefined' ? null : window;

if (win && !win.__NARIMATO_GDS_BOOT__) {
  const safeStorage = (name) => {
    try {
      return win[name] || null;
    } catch {
      return null;
    }
  };

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
  }).catch((error) => {
    // bootstrapGds never rejects by contract; this is a last-resort guard.
    console.warn('[gds-boot] unexpected failure', error);
  });
}
