/**
 * NARIMATO — HUD formatting and ordering contract (UI-02).
 *
 * Pure, dependency-free helpers shared by `public/js/ui.js`, the GDS island and
 * the node:test suite. Keeping them here means the legacy renderer, the GDS
 * renderer and the tests cannot drift on grouping, `pad2` charge text, the
 * 14-row cap or the deterministic rank tie-break.
 */

/** Required DOM ids after the HUD migration (issue UI-02 §10). */
export const REQUIRED_HUD_IDS = Object.freeze([
  'hud',
  'hud-score',
  'planet-badge',
  'nav-chip',
  'mission-panel',
  'players-panel',
  'arcade-panel',
  'hud-target',
  'target-charge-bar',
  'hud-zoom',
  'mobile-dock',
  'hud-hint',
  'btn-nav-focus',
  'btn-nav-next',
  'btn-abandon',
  'btn-escape',
]);

/** One HUD tree namespace; the surface strip is additive, never a second HUD. */
export const HUD_NODES = Object.freeze({
  hud: 'hud',
  score: 'score',
  world: 'world',
  planet: 'planet',
  mission: 'mission',
  players: 'players',
  arcade: 'arcade',
  target: 'target',
  zoom: 'zoom',
  hint: 'hint',
  nav: 'nav',
  surfaceControls: 'surface-controls',
  surfaceTarget: 'surface-target',
  surfaceLap: 'surface-lap',
  surfaceLapValue: 'surface-lap-value',
  surfaceAuto: 'surface-auto',
  surfacePads: 'surface-pads',
  surfaceForward: 'surface-forward',
  surfaceLeft: 'surface-left',
  surfaceBack: 'surface-back',
  surfaceRight: 'surface-right',
  surfaceExit: 'surface-exit',
});

export const MAX_PLAYER_ROWS = 14;

const CONNECTIONS = new Set(['connected', 'connecting', 'reconnecting', 'offline', 'transit']);

export const CONNECTION_TEXT = Object.freeze({
  connected: 'LINKED',
  connecting: 'LINKING',
  reconnecting: 'RETRYING',
  offline: 'OFFLINE',
  transit: 'IN TRANSIT',
});

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 16777216;

export const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
export const finite = (value) => typeof value === 'number' && Number.isFinite(value);
export const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
export const int = (value, fallback = 0) => Math.round(toNum(value, fallback));

/** Zero-padded integer used by charge text and rank labels. */
export function pad2(value) {
  return String(Math.max(0, int(value))).padStart(2, '0');
}

/** Group thousands with commas; negative values keep the sign. */
export function formatNumber(value) {
  const n = Math.round(toNum(value));
  const negative = n < 0;
  const digits = Math.abs(n).toString();
  let out = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) out += ',';
    out += digits[index];
  }
  return negative ? `-${out}` : out;
}

/** Short zoom label used by the HUD indicator (×1.0 … ×16.00M). */
export function formatZoom(zoom) {
  const z = clamp(toNum(zoom, 1), ZOOM_MIN, ZOOM_MAX);
  if (z < 10) return `×${z.toFixed(1)}`;
  if (z < 100) return `×${Math.round(z)}`;
  if (z < 1000) return `×${formatNumber(Math.round(z))}`;
  if (z < 1000000) return `×${(z / 1000).toFixed(z >= 10000 ? 0 : 1)}K`;
  return `×${(z / 1000000).toFixed(2)}M`;
}

/** Clamped 0..100 logarithmic zoom fill. */
export function zoomPercent(zoom) {
  const z = clamp(toNum(zoom, 1), ZOOM_MIN, ZOOM_MAX);
  return clamp((Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100, 0, 100);
}

/** Zoom band used for styling hooks (never the only information carrier). */
export function zoomBand(zoom) {
  const z = clamp(toNum(zoom, 1), ZOOM_MIN, ZOOM_MAX);
  return z >= 1024 ? 'macro' : z >= 64 ? 'deep' : z >= 8 ? 'mid' : 'wide';
}

export function normalizeConnection(status) {
  const value = String(status || '').toLowerCase();
  return CONNECTIONS.has(value) ? value : 'connecting';
}

export function connectionText(status) {
  return CONNECTION_TEXT[normalizeConnection(status)] || CONNECTION_TEXT.connecting;
}

export function normalizeTag(raw) {
  return String(raw == null ? '' : raw).trim().toUpperCase().slice(0, 12);
}

/** Mission completion ratio 0..1 (0 objectives is 0, never NaN). */
export function missionDoneRatio(mission) {
  const objectives = mission && Array.isArray(mission.objectives) ? mission.objectives : [];
  if (!objectives.length) return 0;
  return objectives.filter((objective) => objective && objective.done).length / objectives.length;
}

/** `min(clicks, threshold) / threshold * 100`, rounded to one decimal. */
export function chargePercent(clicks, threshold) {
  const max = Math.max(1, int(threshold, 8));
  const now = clamp(int(clicks), 0, max);
  return Math.round((now / max) * 1000) / 10;
}

/** Charge text keeps the `03 / 08` pad2 contract and an em dash when unknown. */
export function chargeText(clicks, threshold) {
  const max = Math.max(1, int(threshold, 8));
  return clicks == null ? `— / ${pad2(max)}` : `${pad2(clicks)} / ${pad2(max)}`;
}

/** Target state derived from max-depth / lock / ownership, never colour alone. */
export function targetState(hover, maxDepth) {
  const info = hover && typeof hover === 'object' ? hover : null;
  if (!info) return 'idle';
  const depth = Math.max(0, int(info.depth, String(info.label || '').split('.').length - 1));
  if (depth >= Math.max(0, int(maxDepth, 0))) return 'depleted';
  if (info.locked === true) return 'locked';
  if (info.terrain && info.terrain.mineable === false) return 'submerged';
  return 'active';
}

export const TARGET_STATE_TEXT = Object.freeze({
  idle: 'NO TARGET',
  active: 'TARGET READY',
  locked: 'LOCKED // CONTEST REQUIRED',
  depleted: 'MAX DEPTH // NO FURTHER BREAKS',
  submerged: 'SUBMERGED // NO SURFACE DEPOSITS',
});

/**
 * Deterministic player ordering: online first, score desc, then tag asc, then id.
 * Caps at `MAX_PLAYER_ROWS` and reports how many rows were hidden.
 */
export function rankPlayers(players, myId = null, cap = MAX_PLAYER_ROWS) {
  const rows = [];
  const list = Array.isArray(players) ? players : [];
  for (let index = 0; index < list.length; index += 1) {
    const raw = list[index];
    if (!raw || typeof raw !== 'object') continue;
    rows.push({
      id: raw.id != null ? String(raw.id) : `idx-${index}`,
      tag: normalizeTag(raw.tag) || 'PLAYER',
      color: typeof raw.color === 'string' ? raw.color : null,
      online: raw.online !== false,
      score: Math.max(0, int(raw.score)),
      faces: Math.max(0, int(raw.facesHeld)),
      isMe: myId != null && raw.id != null && String(raw.id) === String(myId),
    });
  }
  rows.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    const byTag = a.tag.localeCompare(b.tag);
    if (byTag !== 0) return byTag;
    return a.id.localeCompare(b.id);
  });
  const limit = Math.max(1, int(cap, MAX_PLAYER_ROWS));
  return {
    rows: rows.slice(0, limit),
    total: rows.length,
    online: rows.filter((row) => row.online).length,
    hidden: Math.max(0, rows.length - limit),
  };
}

/** Stable one-line signature used to skip redundant commits. */
export function hudSignature(slice) {
  if (!slice || typeof slice !== 'object') return '';
  return JSON.stringify([
    slice.score,
    slice.faces,
    slice.clicks,
    slice.breaks,
    slice.worldText,
    slice.planet && slice.planet.name,
    slice.planet && slice.planet.depth,
    slice.players && slice.players.map((p) => `${p.id}:${p.tag}:${p.score}:${p.faces}:${p.online}`).join('|'),
    slice.mission && slice.mission.ready,
    slice.cargo && slice.cargo.total,
    slice.zoom && slice.zoom.value,
    slice.zoom && slice.zoom.depth,
    slice.connection,
  ]);
}
