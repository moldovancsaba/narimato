/**
 * NARIMATO — control preferences (CTL-05).
 *
 * One versioned record owns every persisted control preference. Nothing else
 * may write a control key: `app.js` reads through `loadPrefs` and writes through
 * `writePrefs`, so a reload always restores exactly what the HUD shows.
 *
 * Record: `icosa.controls.v1 = {"v":1,"dragInvert":false,"modeChipCollapsed":false}`
 * Legacy keys are migrated once and deleted:
 *   - `icosa.dragInvert.v2`     ('1' = reverse)      — pre-CTL-01 polarity
 *   - `icosa.orbitInputMode.v1` ('reverse'|'follow') — CTL-01 draft key
 *
 * This module is DOM-free and testable in Node: pass a storage-like object
 * (`getItem`/`setItem`/`removeItem`) or `null` in private mode.
 */

export const STORAGE_KEY = 'icosa.controls.v1';
export const PREFS_VERSION = 1;
export const LEGACY_KEYS = Object.freeze(['icosa.dragInvert.v2', 'icosa.orbitInputMode.v1']);

export function defaultPrefs() {
  return { v: PREFS_VERSION, dragInvert: false, modeChipCollapsed: false };
}

/** Coerce anything into a valid record; `dragInvert` is the only real state. */
export function normalizePrefs(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    v: PREFS_VERSION,
    dragInvert: source.dragInvert === true,
    modeChipCollapsed: source.modeChipCollapsed === true,
  };
}

function readLegacy(storage) {
  if (!storage) return null;
  for (const key of LEGACY_KEYS) {
    let value = null;
    try {
      value = storage.getItem(key);
    } catch {
      return null;
    }
    if (value == null) continue;
    return { key, dragInvert: value === '1' || value === 'reverse' };
  }
  return null;
}

/**
 * Load the persisted record, repairing corruption and migrating the legacy keys
 * exactly once. Never throws when storage is blocked (private mode).
 * @returns {{prefs:object, source:'stored'|'default'|'migrated'|'repaired'|'unavailable', storageOk:boolean}}
 */
export function loadPrefs(storage) {
  const fallback = { prefs: defaultPrefs(), source: 'unavailable', storageOk: false };
  if (!storage) return fallback;
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (raw != null) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const prefs = defaultPrefs();
      const storageOk = writePrefs(storage, prefs);
      return { prefs, source: 'repaired', storageOk };
    }
    return { prefs: normalizePrefs(parsed), source: 'stored', storageOk: true };
  }
  const legacy = readLegacy(storage);
  if (legacy) {
    const prefs = normalizePrefs({ dragInvert: legacy.dragInvert });
    const storageOk = writePrefs(storage, prefs);
    try {
      storage.removeItem(legacy.key);
    } catch {
      /* private mode: the migration still applied for this session */
    }
    return { prefs, source: 'migrated', storageOk };
  }
  const prefs = defaultPrefs();
  const storageOk = writePrefs(storage, prefs);
  return { prefs, source: 'default', storageOk };
}

/** Persist the record. Returns false when storage is unavailable. */
export function writePrefs(storage, prefs) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}

/** `dragInvert` boolean <-> `follow|reverse` mode, one mapping only. */
export function modeFromPrefs(prefs) {
  return prefs && prefs.dragInvert === true ? 'reverse' : 'follow';
}

export function prefsWithMode(prefs, mode) {
  const next = normalizePrefs(prefs);
  next.dragInvert = mode === 'reverse';
  return next;
}
