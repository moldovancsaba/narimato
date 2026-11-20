/**
 * NARIMATO — GDS adapter, flag precedence and page-boot tests (issue UI-01).
 *
 * The adapter has no import-time DOM access, so every path is exercised here with
 * injected fakes: no browser, no `node_modules`, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_MESSAGE,
  FROZEN_UI_METHODS,
  MODES,
  RETRY_DELAY_MS,
  STALE_RELOAD_KEY,
  STORAGE_KEY,
  bootstrapGds,
  createGdsAdapter,
  renderFallbackBanner,
  resolveUiMode,
} from '../public/js/gds-adapter.js';

function fakeStorage(initial = {}, { throwOnGet = false, throwOnSet = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) {
      if (throwOnGet) throw new Error('SECURITY_ERR');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('QUOTA_ERR');
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function fakeElement(tag = 'div') {
  const attrs = new Map();
  const listeners = new Map();
  const element = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    type: '',
    children: [],
    removed: false,
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    hasAttribute(name) {
      return attrs.has(name);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type) {
      const listener = listeners.get(type);
      if (listener) listener({ type });
    },
    appendChild(child) {
      element.children.push(child);
      return child;
    },
    remove() {
      element.removed = true;
    },
  };
  return element;
}

function fakeDocument({ withRoot = true } = {}) {
  const root = fakeElement('div');
  root.id = 'gds-root';
  const body = fakeElement('body');
  return {
    body,
    root,
    createElement: (tag) => fakeElement(tag),
    getElementById: (id) => (withRoot && id === 'gds-root' ? root : null),
  };
}

function fakeIsland(overrides = {}) {
  const calls = { bootstrap: [], mount: [], update: [] };
  const island = {
    version: 'abc123def4567',
    calls,
    async bootstrap(cfg) {
      calls.bootstrap.push(cfg);
    },
    mount(surface, host) {
      calls.mount.push([surface, host]);
      return true;
    },
    update(slice) {
      calls.update.push(slice);
      return true;
    },
    ...overrides,
  };
  return island;
}

function bootOptions(overrides = {}) {
  const doc = overrides.document || fakeDocument();
  const location = overrides.location || { search: '', reload() {} };
  return {
    window: {},
    document: doc,
    location,
    localStorage: fakeStorage(),
    sessionStorage: fakeStorage(),
    importIsland: async () => fakeIsland(),
    wait: async () => {},
    logger: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Flag precedence (issue #7 §11)
// ---------------------------------------------------------------------------

test('flags: ?gds=0 selects the legacy UI', () => {
  assert.deepEqual(resolveUiMode({ search: '?gds=0', storage: fakeStorage({ [STORAGE_KEY]: 'on' }) }), {
    mode: MODES.LEGACY,
    source: 'query',
  });
});

test('flags: ?gds=1 selects the GDS island even when storage says off', () => {
  assert.deepEqual(resolveUiMode({ search: '?gds=1', storage: fakeStorage({ [STORAGE_KEY]: 'off' }) }), {
    mode: MODES.GDS,
    source: 'query',
  });
});

test('flags: ?gds=proof selects the GDS proof surface', () => {
  assert.deepEqual(resolveUiMode({ search: '?gds=proof' }), { mode: MODES.PROOF, source: 'query' });
});

test('flags: storage "off" selects the legacy UI when the query is absent', () => {
  assert.deepEqual(resolveUiMode({ search: '', storage: fakeStorage({ [STORAGE_KEY]: 'off' }) }), {
    mode: MODES.LEGACY,
    source: 'storage',
  });
});

test('flags: unknown ?gds values fall through to storage, then to the GDS default', () => {
  assert.deepEqual(resolveUiMode({ search: '?gds=maybe', storage: fakeStorage({ [STORAGE_KEY]: 'off' }) }), {
    mode: MODES.LEGACY,
    source: 'storage',
  });
  assert.deepEqual(resolveUiMode({ search: '?gds=maybe', storage: fakeStorage() }), {
    mode: MODES.GDS,
    source: 'default',
  });
});

test('flags: a throwing localStorage is wrapped and the GDS default wins', () => {
  assert.deepEqual(resolveUiMode({ search: '', storage: fakeStorage({}, { throwOnGet: true }) }), {
    mode: MODES.GDS,
    source: 'default',
  });
});

// ---------------------------------------------------------------------------
// Frozen UI API adapter
// ---------------------------------------------------------------------------

test('adapter: exposes every method of the frozen UI API', () => {
  const adapter = createGdsAdapter({ island: fakeIsland() });
  for (const method of FROZEN_UI_METHODS) assert.equal(typeof adapter[method], 'function', method);
  assert.deepEqual(
    FROZEN_UI_METHODS,
    [
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
    ]
  );
});

test('adapter: maps frozen API calls into one island store update each', () => {
  const island = fakeIsland();
  const adapter = createGdsAdapter({ mode: MODES.GDS, island });
  assert.equal(adapter.updateHud({ score: 10 }, 'token', { zoom: 2 }), true);
  assert.equal(adapter.setConnection('offline'), true);
  assert.deepEqual(island.calls.update, [
    { updateHud: [{ score: 10 }, 'token', { zoom: 2 }] },
    { setConnection: ['offline'] },
  ]);
  assert.equal(adapter.status().mapped, 2);
});

test('adapter: legacy mode delegates to the legacy UI and never touches the island', () => {
  const island = fakeIsland();
  const calls = [];
  const legacy = { toast: (...args) => calls.push(args), updateHud: (...args) => calls.push(args) };
  const adapter = createGdsAdapter({ mode: MODES.LEGACY, island, legacy });
  assert.equal(adapter.toast('hello', 'info'), true);
  assert.deepEqual(calls, [['hello', 'info']]);
  assert.equal(island.calls.update.length, 0);
  assert.equal(adapter.status().delegated, 1);
});

test('adapter: degrades to the legacy UI when the island is not booted', () => {
  const calls = [];
  const legacy = { toast: (...args) => calls.push(args) };
  const adapter = createGdsAdapter({
    mode: MODES.GDS,
    island: fakeIsland({ update: () => false }),
    legacy,
  });
  assert.equal(adapter.toast('fallback', 'bad'), true);
  assert.deepEqual(calls, [['fallback', 'bad']]);
  assert.equal(adapter.status().degraded, 1);
});

test('adapter: degrades when the island throws instead of propagating into app.js', () => {
  const calls = [];
  const legacy = { setZoom: (...args) => calls.push(args) };
  const adapter = createGdsAdapter({
    mode: MODES.GDS,
    island: fakeIsland({
      update: () => {
        throw new Error('ISLAND_CRASH');
      },
    }),
    legacy,
  });
  assert.equal(adapter.setZoom(3), true);
  assert.deepEqual(calls, [[3]]);
  const status = adapter.status();
  assert.equal(status.errors, 1);
  assert.equal(status.mapped, 0);
});

test('adapter: safe degradation is silent when no legacy UI exists', () => {
  const adapter = createGdsAdapter({ mode: MODES.GDS, island: null });
  assert.equal(adapter.setLiveCount(7), false);
  const status = adapter.status();
  assert.equal(status.degraded, 1);
  assert.equal(status.delegated, 0);
  assert.equal(status.dropped, 1);
});

// ---------------------------------------------------------------------------
// Page boot
// ---------------------------------------------------------------------------

test('boot: legacy mode never imports the island and marks the host off', async () => {
  const doc = fakeDocument();
  let imported = 0;
  const record = await bootstrapGds(
    bootOptions({
      document: doc,
      location: { search: '?gds=0', reload() {} },
      importIsland: async () => {
        imported += 1;
        return fakeIsland();
      },
    })
  );
  assert.equal(imported, 0);
  assert.equal(record.mode, MODES.LEGACY);
  assert.equal(record.booted, false);
  assert.equal(doc.root.getAttribute('data-gds'), 'off');
});

test('boot: default mode boots one island and creates no surface', async () => {
  const doc = fakeDocument();
  const island = fakeIsland();
  const record = await bootstrapGds(
    bootOptions({
      document: doc,
      importIsland: async () => island,
      fetchManifest: async () => ({ version: island.version }),
    })
  );
  assert.equal(record.booted, true);
  assert.equal(record.fallback, false);
  assert.equal(island.calls.bootstrap.length, 1);
  assert.deepEqual(island.calls.bootstrap[0].theme, 'dark');
  assert.equal(island.calls.mount.length, 0);
  assert.equal(doc.root.getAttribute('data-gds'), 'on');
});

test('boot: ?gds=proof mounts the proof surface into the root host', async () => {
  const doc = fakeDocument();
  const island = fakeIsland();
  const record = await bootstrapGds(
    bootOptions({
      document: doc,
      location: { search: '?gds=proof', reload() {} },
      importIsland: async () => island,
    })
  );
  assert.equal(record.mode, MODES.PROOF);
  assert.equal(record.booted, true);
  assert.deepEqual(island.calls.mount, [['proof', doc.root]]);
});

test('boot: retries the import once after 1 s, then succeeds', async () => {
  let attempts = 0;
  const waits = [];
  const record = await bootstrapGds(
    bootOptions({
      importIsland: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('CHUNK_404');
        return fakeIsland();
      },
      wait: async (ms) => waits.push(ms),
    })
  );
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [RETRY_DELAY_MS]);
  assert.equal(record.retried, true);
  assert.equal(record.booted, true);
});

test('boot: two failed imports fall back to legacy with a dismissible banner', async () => {
  const doc = fakeDocument();
  let reason = null;
  const record = await bootstrapGds(
    bootOptions({
      document: doc,
      importIsland: async () => {
        throw new Error('CHUNK_404');
      },
      onFallback: (fallback) => {
        reason = fallback.fallbackReason;
      },
    })
  );
  assert.equal(record.booted, false);
  assert.equal(record.fallback, true);
  assert.match(reason, /CHUNK_404/);
  assert.equal(doc.root.getAttribute('data-gds'), 'fallback');
  assert.equal(doc.body.children.length, 1);
  const banner = doc.body.children[0];
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.equal(banner.children[0].textContent, FALLBACK_MESSAGE);
  const dismiss = banner.children[1];
  assert.equal(dismiss.getAttribute('aria-label'), 'Dismiss GDS fallback notice');
  dismiss.dispatch('click');
  assert.equal(banner.removed, true);
  assert.equal(doc.root.getAttribute('data-gds'), 'fallback-dismissed');
});

test('boot: a bootstrap() rejection also falls back with the banner', async () => {
  const doc = fakeDocument();
  const record = await bootstrapGds(
    bootOptions({
      document: doc,
      importIsland: async () =>
        fakeIsland({
          async bootstrap() {
            throw new Error('PROVIDER_MOUNT_FAILED');
          },
        }),
    })
  );
  assert.equal(record.fallback, true);
  assert.match(record.fallbackReason, /PROVIDER_MOUNT_FAILED/);
  assert.equal(doc.body.children.length, 1);
});

test('boot: is idempotent — a second caller shares the first promise and import', async () => {
  const win = {};
  let imported = 0;
  const options = bootOptions({
    window: win,
    importIsland: async () => {
      imported += 1;
      return fakeIsland();
    },
  });
  const first = bootstrapGds(options);
  const second = bootstrapGds(options);
  assert.equal(first, second);
  const record = await first;
  assert.equal(imported, 1);
  assert.equal(record.booted, true);
  assert.equal(win.__NARIMATO_GDS_BOOT__, first);
  assert.equal(win.__NARIMATO_GDS_BOOT_STATUS__.booted, true);
});

test('boot: a stale chunk triggers one guarded reload, never a loop', async () => {
  const session = fakeStorage();
  let reloads = 0;
  const stale = await bootstrapGds(
    bootOptions({
      sessionStorage: session,
      location: { search: '?gds=1', reload: () => (reloads += 1) },
      importIsland: async () => fakeIsland({ version: 'aaaaaaaaaaaaaaa' }),
      fetchManifest: async () => ({ version: 'bbbbbbbbbbbbbbb' }),
    })
  );
  assert.equal(stale.reloaded, true);
  assert.equal(reloads, 1);
  assert.equal(session.getItem(STALE_RELOAD_KEY), '1');

  // After the reload the guard is present: boot proceeds instead of reloading again.
  const island = fakeIsland({ version: 'bbbbbbbbbbbbbbb' });
  let secondReloads = 0;
  const second = await bootstrapGds(
    bootOptions({
      sessionStorage: session,
      location: { search: '?gds=1', reload: () => (secondReloads += 1) },
      importIsland: async () => island,
      fetchManifest: async () => ({ version: 'bbbbbbbbbbbbbbb' }),
    })
  );
  assert.equal(secondReloads, 0);
  assert.equal(second.booted, true);
});

test('boot: a manifest fetch failure is non-fatal', async () => {
  const record = await bootstrapGds(
    bootOptions({
      fetchManifest: async () => {
        throw new Error('OFFLINE');
      },
    })
  );
  assert.equal(record.booted, true);
  assert.equal(record.fallback, false);
});

test('banner: renderFallbackBanner is idempotent and never throws without a document', () => {
  const doc = fakeDocument();
  const first = renderFallbackBanner({ document: doc });
  assert.equal(doc.body.children.length, 1);
  // A second call finds the existing banner by id (fake document returns null for it).
  assert.equal(renderFallbackBanner({ document: null }), null);
  assert.equal(first.getAttribute('role'), 'alert');
});
