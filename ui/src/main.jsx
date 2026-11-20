/**
 * NARIMATO — GDS React island entry (issue UI-01).
 *
 * Built once by `npm run build:ui` into the committed `public/ui/island.js`.
 * The game page loads it through `public/js/gds-adapter.js`; `node server.js`
 * serves the output as static files and stays zero-dependency.
 *
 * Frozen public API (issue #7 §10):
 *   export const version;  export async function bootstrap(cfg); // { theme, reducedMotion }
 *   export function mount(surface, host);  export function update(slice);
 *   export function status();  export function shutdown(); // tests only
 *
 * Exactly one `GdsProvider` lives in `GdsRoot.jsx` and exactly one React root is
 * created here. `bootstrap()` is idempotent: a second call (two script tags, an
 * HMR re-evaluation or a retry after a failure) returns the same promise, so
 * `createRoot` can never run twice against `#gds-root`.
 */
import '@sovereignsquad/gds-theme/styles.css';
import './styles/island.css';
import { createRoot } from 'react-dom/client';
import GdsRoot from './GdsRoot.jsx';
import { createStore } from './store.js';

export const version = __GDS_ISLAND_VERSION__;

const DEFAULT_CFG = Object.freeze({ theme: 'dark', colorScheme: 'dark', reducedMotion: false });

const store = createStore({
  surface: null,
  host: null,
  announcement: '',
  announcementSeq: 0,
  data: Object.freeze({}),
});

const runtime = {
  booted: null,
  root: null,
  host: null,
  cfg: null,
  error: null,
  startedAt: null,
  mounts: 0,
  shutdowns: 0,
};

function normalizeCfg(cfg = {}) {
  const theme = cfg.theme === 'light' ? 'light' : 'dark';
  return Object.freeze({
    ...DEFAULT_CFG,
    ...cfg,
    theme,
    colorScheme: cfg.colorScheme === 'light' ? 'light' : theme,
    reducedMotion: cfg.reducedMotion === true,
    version,
  });
}

/** Stable status snapshot for operators and tests; never throws. */
function snapshot() {
  return Object.freeze({
    version,
    booted: Boolean(runtime.booted),
    providerCount: runtime.root ? 1 : 0,
    rootCount: runtime.root ? 1 : 0,
    surface: store.getState().surface,
    mounts: runtime.mounts,
    shutdowns: runtime.shutdowns,
    startedAt: runtime.startedAt,
    error: runtime.error ? String(runtime.error.message || runtime.error) : null,
    theme: runtime.cfg ? runtime.cfg.theme : null,
    reducedMotion: runtime.cfg ? runtime.cfg.reducedMotion : null,
  });
}

/** Best-effort operator surface (`window.__NARIMATO_GDS__.status()`). */
function publishStatus() {
  if (typeof window !== 'undefined') {
    window.__NARIMATO_GDS__ = globalApi;
    window.__NARIMATO_GDS_STATUS__ = snapshot();
  }
  return snapshot();
}

export async function bootstrap(cfg = {}) {
  if (runtime.booted) return runtime.booted;
  runtime.startedAt = Date.now();
  runtime.cfg = normalizeCfg(cfg);
  runtime.error = null;

  runtime.booted = new Promise((resolve, reject) => {
    Promise.resolve()
      .then(() => {
        const host =
          runtime.cfg.host || (typeof document === 'undefined' ? null : document.getElementById('gds-root'));
        if (!host) throw new Error('GDS_ROOT_HOST_MISSING: #gds-root is required');
        runtime.host = host;
        runtime.root = createRoot(host);
        host.setAttribute('data-gds-state', 'booted');
        runtime.root.render(<GdsRoot cfg={runtime.cfg} store={store} />);
        publishStatus();
        return globalApi;
      })
      .then(resolve)
      .catch((error) => {
        // Reset so the page-level boot can retry once (issue #7 §13).
        runtime.booted = null;
        runtime.root = null;
        runtime.host = null;
        runtime.error = error;
        publishStatus();
        reject(error);
      });
  });

  return runtime.booted;
}

/** Mount a named GDS surface into `host` (default: `#gds-root`). */
export function mount(surface, host) {
  if (!runtime.root) throw new Error(`GDS_NOT_BOOTED: cannot mount "${surface}" before bootstrap()`);
  const target =
    typeof host === 'string'
      ? typeof document === 'undefined'
        ? null
        : document.getElementById(host)
      : host || runtime.host;
  runtime.mounts += 1;
  store.update({ surface: surface == null ? null : String(surface), host: target || null });
  publishStatus();
  return true;
}

/**
 * Update the island once per frame. A 10 Hz `updateHud` cadence produces at most
 * one React commit per animation frame because the store coalesces slices.
 */
export function update(slice) {
  if (!runtime.root) return false;
  if (!slice || typeof slice !== 'object') return false;
  const current = store.getState();
  const next = {
    data: Object.freeze({ ...current.data, ...slice }),
  };
  if (typeof slice.announcement === 'string') {
    next.announcement = slice.announcement;
    next.announcementSeq = current.announcementSeq + 1;
  }
  return store.update(next);
}

export function status() {
  return snapshot();
}

/** Tests only: unmount the root so the next bootstrap creates a fresh one. */
export function shutdown() {
  if (!runtime.root) return false;
  const root = runtime.root;
  runtime.root = null;
  runtime.booted = null;
  runtime.host = null;
  runtime.shutdowns += 1;
  root.unmount();
  store.update({ surface: null, host: null });
  publishStatus();
  return true;
}

const globalApi = Object.freeze({ version, bootstrap, mount, update, status, shutdown });

if (typeof window !== 'undefined') {
  window.__NARIMATO_GDS__ = globalApi;
}
