/**
 * NARIMATO — GDS island adapter and page boot (issue UI-01).
 *
 * Zero dependencies and no import-time DOM access, so the whole contract is
 * unit-testable under `node:test`:
 *
 *   1. flag precedence  — `?gds=0` / `?gds=1` / `?gds=proof`, then
 *      `localStorage['narimato.gds'] === 'off'`, then GDS-on default;
 *   2. frozen `UI` API  — every method of the legacy `public/js/ui.js` contract is
 *      mapped onto island store updates, and degrades to the legacy instance when
 *      the island is absent, not booted, or throws;
 *   3. page boot        — idempotent import + bootstrap, one retry after 1 s, a
 *      dismissible `GDS UNAVAILABLE // LEGACY UI` banner on failure, and a guarded
 *      single reload when a stale chunk disagrees with the manifest.
 *
 * `app.js` call sites are intentionally unchanged by UI-01: `public/js/gds-boot.js`
 * starts the island next to the running game, and this adapter is the bridge
 * UI-02 uses when it starts replacing legacy `ui.js` calls.
 */

export const MODES = Object.freeze({ GDS: 'gds', LEGACY: 'legacy', PROOF: 'proof' });
export const STORAGE_KEY = 'narimato.gds';
export const STALE_RELOAD_KEY = 'narimato.gds.reload';
export const RETRY_DELAY_MS = 1000;
export const FALLBACK_MESSAGE = 'GDS UNAVAILABLE // LEGACY UI';

/** The frozen UI API from `public/js/ui.js` / SPEC_INFINITE §3. */
export const FROZEN_UI_METHODS = Object.freeze([
  'showLanding',
  'hideLanding',
  'showJoinError',
  'setJoinBusy',
  'updateHud',
  'setHoverFace',
  'setZoom',
  'setLeaderboard',
  'setLiveCount',
  'setConnection',
  'toast',
  'showReport',
  'hideReport',
  'setSoundMuted',
]);

/** Read a storage key without letting a privacy-mode `SecurityError` escape. */
export function readStorage(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(storage, key) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve which implementation serves DOM UI.
 *
 * Precedence (issue #7 §11): `?gds=0` legacy · `?gds=1` GDS · `?gds=proof` GDS
 * proof surface · `localStorage['narimato.gds'] === 'off'` legacy · otherwise GDS.
 * Unknown `?gds=` values fall through to storage rather than guessing.
 */
export function resolveUiMode({ search = '', storage = null } = {}) {
  let params = null;
  try {
    params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  } catch {
    params = null;
  }
  const flag = params ? params.get('gds') : null;
  if (flag === '0') return { mode: MODES.LEGACY, source: 'query' };
  if (flag === '1') return { mode: MODES.GDS, source: 'query' };
  if (flag === 'proof') return { mode: MODES.PROOF, source: 'query' };
  if (readStorage(storage, STORAGE_KEY) === 'off') return { mode: MODES.LEGACY, source: 'storage' };
  return { mode: MODES.GDS, source: 'default' };
}

/**
 * Adapter over the frozen `UI` API.
 *
 * In GDS/proof mode each call becomes one namespaced island store slice; the
 * island coalesces commits per frame. Any failure degrades to the legacy UI
 * instance in the same call, never throwing into `app.js`.
 */
export function createGdsAdapter({ mode = MODES.GDS, island = null, legacy = null, logger = null } = {}) {
  const record = {
    mode,
    calls: 0,
    mapped: 0,
    delegated: 0,
    degraded: 0,
    dropped: 0,
    errors: 0,
    lastMethod: null,
    lastSlice: null,
    lastError: null,
  };

  const log = (level, ...args) => {
    if (!logger) return;
    const fn = typeof logger[level] === 'function' ? logger[level] : null;
    if (fn) fn('[gds-adapter]', ...args);
  };

  const delegateLegacy = (method, args) => {
    if (legacy && typeof legacy[method] === 'function') {
      legacy[method](...args);
      record.delegated += 1;
      return true;
    }
    record.dropped += 1;
    return false;
  };

  const usesIsland = () => (mode === MODES.GDS || mode === MODES.PROOF) && island && typeof island.update === 'function';

  const invoke = (method, args) => {
    record.calls += 1;
    record.lastMethod = method;
    if (mode === MODES.LEGACY) return delegateLegacy(method, args);
    if (!usesIsland()) {
      record.degraded += 1;
      log('warn', `${method} degraded: island unavailable`);
      return delegateLegacy(method, args);
    }
    const slice = { [method]: args };
    try {
      const accepted = island.update(slice);
      if (accepted === false) {
        // The island is loaded but not booted (or rejected the slice): degrade.
        record.degraded += 1;
        log('warn', `${method} degraded: island not booted`);
        return delegateLegacy(method, args);
      }
      record.mapped += 1;
      record.lastSlice = slice;
      return true;
    } catch (error) {
      record.errors += 1;
      record.lastError = error;
      log('warn', `${method} threw; degrading to legacy UI`, error);
      return delegateLegacy(method, args);
    }
  };

  const adapter = {
    mode,
    /** Snapshot of adapter health for `window.__NARIMATO_GDS__` operators and tests. */
    status() {
      return Object.freeze({ ...record });
    },
    /** Swap in a live legacy UI instance (e.g. the one `app.js` constructs). */
    attachLegacy(instance) {
      legacy = instance || null;
      return adapter;
    },
    attachIsland(instance) {
      island = instance || null;
      return adapter;
    },
  };

  for (const method of FROZEN_UI_METHODS) {
    adapter[method] = (...args) => invoke(method, args);
  }

  return adapter;
}

/**
 * Dismissible failure banner. Uses the legacy stylesheet that is already on the
 * page (GDS cannot render a GDS banner when GDS is the thing that failed) and is
 * exposed to tests through an injectable `document`.
 */
export function renderFallbackBanner({ document: doc, message = FALLBACK_MESSAGE, onDismiss = null, id = 'gds-fallback-banner' } = {}) {
  if (!doc || typeof doc.createElement !== 'function' || !doc.body) return null;
  if (typeof doc.getElementById === 'function' && doc.getElementById(id)) return doc.getElementById(id);

  const banner = doc.createElement('div');
  banner.id = id;
  banner.className = 'gds-fallback';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('data-gds-fallback', 'true');

  const text = doc.createElement('span');
  text.className = 'gds-fallback-text';
  text.textContent = message;

  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn btn--ghost gds-fallback-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss GDS fallback notice');
  dismiss.textContent = 'DISMISS';
  dismiss.addEventListener('click', () => {
    if (typeof banner.remove === 'function') banner.remove();
    if (typeof onDismiss === 'function') onDismiss();
  });

  banner.appendChild(text);
  banner.appendChild(dismiss);
  doc.body.appendChild(banner);
  return banner;
}

function detectReducedMotion(win) {
  if (!win || typeof win.matchMedia !== 'function') return false;
  try {
    return win.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Boot the island from the page.
 *
 * Everything the browser provides is injectable so the retry, fallback, stale
 * reload and idempotency paths are deterministic in `node:test`. Returns a
 * promise resolving to the boot record; it never rejects.
 */
export function bootstrapGds(options = {}) {
  const {
    window: win = null,
    document: doc = null,
    location = null,
    localStorage: local = null,
    sessionStorage: session = null,
    search = location && typeof location.search === 'string' ? location.search : '',
    importIsland,
    fetchManifest = null,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    retryDelayMs = RETRY_DELAY_MS,
    logger = typeof console === 'undefined' ? null : console,
    bannerMessage = FALLBACK_MESSAGE,
    onFallback = null,
  } = options;

  if (win && win.__NARIMATO_GDS_BOOT__) return win.__NARIMATO_GDS_BOOT__;

  const record = {
    mode: null,
    source: null,
    booted: false,
    fallback: false,
    retried: false,
    reloaded: false,
    fallbackReason: null,
    islandVersion: null,
    manifestVersion: null,
    finishedAt: null,
  };

  const publish = () => {
    if (win) win.__NARIMATO_GDS_BOOT_STATUS__ = { ...record };
    return record;
  };

  const bootPromise = (async () => {
    const modeInfo = resolveUiMode({ search, storage: local });
    record.mode = modeInfo.mode;
    record.source = modeInfo.source;
    publish();

    const root = doc && typeof doc.getElementById === 'function' ? doc.getElementById('gds-root') : null;
    const setRoot = (name, value) => {
      if (root && typeof root.setAttribute === 'function') root.setAttribute(name, value);
    };

    if (modeInfo.mode === MODES.LEGACY) {
      setRoot('data-gds', 'off');
      record.finishedAt = Date.now();
      return publish();
    }

    setRoot('data-gds', modeInfo.mode);

    if (typeof importIsland !== 'function') {
      record.fallback = true;
      record.fallbackReason = 'IMPORT_UNAVAILABLE';
      record.finishedAt = Date.now();
      return publish();
    }

    let island = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        island = await importIsland();
        if (!island || typeof island.bootstrap !== 'function') throw new Error('ISLAND_CONTRACT_INVALID: bootstrap() is missing');
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          record.retried = true;
          publish();
          try {
            await wait(retryDelayMs);
          } catch {
            /* wait failure still counts as a failed attempt */
          }
        }
      }
    }

    if (!island) {
      record.fallback = true;
      record.fallbackReason = String((lastError && lastError.message) || lastError || 'IMPORT_FAILED');
      setRoot('data-gds', 'fallback');
      if (logger && typeof logger.warn === 'function') logger.warn('[gds-boot] island import failed, legacy UI stays live', lastError);
      renderFallbackBanner({ document: doc, message: bannerMessage, onDismiss: () => setRoot('data-gds', 'fallback-dismissed') });
      if (typeof onFallback === 'function') onFallback(record);
      record.finishedAt = Date.now();
      return publish();
    }

    record.islandVersion = typeof island.version === 'string' ? island.version : null;

    // Stale chunk guard: one guarded reload per session, never a loop.
    if (typeof fetchManifest === 'function') {
      let manifest = null;
      try {
        manifest = await fetchManifest();
      } catch (error) {
        if (logger && typeof logger.warn === 'function') logger.warn('[gds-boot] manifest fetch failed; continuing', error);
      }
      if (manifest && typeof manifest.version === 'string') {
        record.manifestVersion = manifest.version;
        if (record.islandVersion && manifest.version !== record.islandVersion) {
          const alreadyReloaded = readStorage(session, STALE_RELOAD_KEY) === '1';
          if (!alreadyReloaded && writeStorage(session, STALE_RELOAD_KEY, '1')) {
            record.reloaded = true;
            record.finishedAt = Date.now();
            publish();
            if (location && typeof location.reload === 'function') {
              location.reload();
              return record;
            }
          }
        } else {
          removeStorage(session, STALE_RELOAD_KEY);
        }
      }
    }

    try {
      await island.bootstrap({
        theme: 'dark',
        reducedMotion: detectReducedMotion(win),
        host: root,
      });
      if (modeInfo.mode === MODES.PROOF && typeof island.mount === 'function') {
        island.mount('proof', root || undefined);
      }
      record.booted = true;
      setRoot('data-gds', 'on');
      publish();
    } catch (error) {
      record.fallback = true;
      record.fallbackReason = String((error && error.message) || error || 'BOOT_FAILED');
      setRoot('data-gds', 'fallback');
      if (logger && typeof logger.warn === 'function') logger.warn('[gds-boot] island bootstrap failed, legacy UI stays live', error);
      renderFallbackBanner({ document: doc, message: bannerMessage, onDismiss: () => setRoot('data-gds', 'fallback-dismissed') });
      if (typeof onFallback === 'function') onFallback(record);
    }

    record.finishedAt = Date.now();
    return publish();
  })().catch((error) => {
    record.fallback = true;
    record.fallbackReason = String((error && error.message) || error || 'BOOT_THREW');
    record.finishedAt = Date.now();
    if (logger && typeof logger.error === 'function') logger.error('[gds-boot] unexpected boot failure', error);
    return publish();
  });

  if (win) win.__NARIMATO_GDS_BOOT__ = bootPromise;
  return bootPromise;
}
