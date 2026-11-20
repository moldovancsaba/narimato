import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEY,
  LEGACY_KEYS,
  defaultPrefs,
  normalizePrefs,
  loadPrefs,
  writePrefs,
  modeFromPrefs,
  prefsWithMode,
} from '../public/js/control-prefs.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  const writes = [];
  return {
    writes,
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      writes.push(key);
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('CTL-05: defaults are the single source for a fresh pilot', () => {
  assert.deepEqual(defaultPrefs(), { v: 1, dragInvert: false, modeChipCollapsed: false });
  assert.equal(STORAGE_KEY, 'icosa.controls.v1');
  assert.deepEqual([...LEGACY_KEYS], ['icosa.dragInvert.v2', 'icosa.orbitInputMode.v1']);
  assert.equal(modeFromPrefs(defaultPrefs()), 'follow');
  assert.equal(modeFromPrefs({ dragInvert: true }), 'reverse');
  assert.deepEqual(prefsWithMode(defaultPrefs(), 'reverse'), { v: 1, dragInvert: true, modeChipCollapsed: false });
});

test('CTL-05: a stored record round-trips and only the documented key is written', () => {
  const storage = memoryStorage();
  const ok = writePrefs(storage, { v: 1, dragInvert: true, modeChipCollapsed: false });
  assert.equal(ok, true);
  assert.deepEqual(storage.writes, [STORAGE_KEY], 'exactly one key is written');
  const loaded = loadPrefs(storage);
  assert.equal(loaded.source, 'stored');
  assert.equal(loaded.prefs.dragInvert, true);
  assert.equal(loaded.storageOk, true);
});

test('CTL-05: corrupt JSON falls back to defaults and is repaired once', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{"v":1,"dragInvert":' });
  const loaded = loadPrefs(storage);
  assert.deepEqual(loaded.prefs, defaultPrefs());
  assert.equal(loaded.source, 'repaired');
  assert.equal(storage.map.get(STORAGE_KEY), JSON.stringify(defaultPrefs()));
  // Arrays/objects are coerced into the record shape, never trusted raw.
  assert.deepEqual(normalizePrefs({ dragInvert: 'yes' }), { v: 1, dragInvert: false, modeChipCollapsed: false });
  assert.deepEqual(normalizePrefs(null), defaultPrefs());
});

test('CTL-05: the legacy drag key migrates once and is deleted', () => {
  const storage = memoryStorage({ 'icosa.dragInvert.v2': '1' });
  const loaded = loadPrefs(storage);
  assert.equal(loaded.source, 'migrated');
  assert.equal(loaded.prefs.dragInvert, true);
  assert.equal(storage.map.has('icosa.dragInvert.v2'), false, 'legacy key is deleted');
  assert.equal(storage.map.get(STORAGE_KEY), JSON.stringify({ v: 1, dragInvert: true, modeChipCollapsed: false }));
  // A '0' legacy value means follow, and is still migrated + removed.
  const off = memoryStorage({ 'icosa.dragInvert.v2': '0' });
  assert.equal(loadPrefs(off).prefs.dragInvert, false);
  assert.equal(off.map.has('icosa.dragInvert.v2'), false);
});

test('CTL-05: the CTL-01 draft key also migrates', () => {
  const storage = memoryStorage({ 'icosa.orbitInputMode.v1': 'reverse' });
  const loaded = loadPrefs(storage);
  assert.equal(loaded.prefs.dragInvert, true);
  assert.equal(storage.map.has('icosa.orbitInputMode.v1'), false);
});

test('CTL-05: blocked storage degrades to session-only, never throws', () => {
  const blocked = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  const loaded = loadPrefs(blocked);
  assert.equal(loaded.source, 'unavailable');
  assert.equal(loaded.storageOk, false);
  assert.deepEqual(loaded.prefs, defaultPrefs());
  assert.equal(loadPrefs(null).source, 'unavailable');
  assert.equal(writePrefs(null, defaultPrefs()), false);
  assert.equal(writePrefs(blocked, defaultPrefs()), false);
});

test('CTL-05: mode is never persisted — only the drag polarity is', () => {
  const storage = memoryStorage();
  writePrefs(storage, prefsWithMode(defaultPrefs(), 'reverse'));
  const raw = JSON.parse(storage.map.get(STORAGE_KEY));
  assert.deepEqual(Object.keys(raw).sort(), ['dragInvert', 'modeChipCollapsed', 'v']);
  assert.equal('mode' in raw, false);
  assert.equal(raw.v, 1);
});
