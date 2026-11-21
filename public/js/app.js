/**
 * NARIMATO — INFINITE GRID client integration.
 *
 * Persistent adaptive sphere: players join and play immediately, every cell
 * charges with clicks and breaks individually into four children, owners and
 * progress survive forever on the server. Camera zooms from whole-sphere to
 * the deepest face. No rounds, no timers, no end.
 */

import { CAMERA_DISTANCE, SphereCamera, pickFace, childTriangles, faceCentroid } from './shared/geometry.js';
import { CarrierCamera, SURFACE_CARRIER_DISTANCE } from './shared/carrier-camera.js';
import {
  beginSurfaceDrag,
  dragSurfaceTo,
  applyArrowTravelFrame,
  normalizeMode,
  toggleMode as toggleOrbitMode,
} from './shared/orbit-controls.js';
import { loadPrefs, writePrefs, modeFromPrefs, prefsWithMode } from './control-prefs.js';
import {
  deriveControlMode,
  modeSentence,
  canToggle,
  actionReason,
  modeLabel as controlModeLabel,
  dragLabel as controlDragLabel,
  actionLabel as controlActionLabel,
} from './shared/control-mode.js';
import {
  ORBIT_FAR_ZOOM,
  SURFACE_ENTER_LEVEL,
  MAX_ZOOM,
  zoomForLevel,
  zoomLevelForZoom as zoomLevelFromLadder,
  applyOrbitFarZoom,
} from './shared/zoom-levels.js';
import {
  createPointerRouter,
  attachPointerRouter,
  watchPointerEnvironment,
  capturePointer,
  releasePointer,
} from './shared/pointer-router.js';
import { harvestStatus, reasonForServerError } from './shared/harvest.js';
import { World } from './world.js';
import { IcosaRenderer } from './renderer.js';
import { UI } from './ui.js';
import { ArcadeAudio } from './audio.js';
import { downloadResultCard, buildShareText, renderResultCard } from './result-card.js';
import { resourceById } from './shared/resources.js';
import { missionProgress, missionForPlanet, planetDepth, planetName, planetSource } from './shared/mission.js';
import { planetTheme } from './shared/planet-theme.js';
import { createIntro } from './intro.js';
import { createInterlude } from './interlude.js';
import { createNarrator } from './narrator.js';
import { createSupplyDrop } from './supply-drop.js';
import { createSurfaceController } from './surface-controller.js';
import { telemetry } from './telemetry.js';
import { HELP_SECTIONS, captainLog } from './story-copy.js';
import { buildIncidentAnnouncement } from './shared/incident-announcements.js';

// PERF-01 probe mode: no landing poll (its JSON/UI work is unrelated to the
// renderer budget and would add a periodic long task to every measurement).
const PERF_PROBE = typeof window !== 'undefined'
  && typeof window.location !== 'undefined'
  && new URLSearchParams(window.location.search).get('perf-probe') === '1';
const TOKEN_KEY = 'icosa.token';
const TAG_KEY = 'icosa.tag';
const TOKENS_KEY = 'icosa.tokens';
const DEFAULT_THRESHOLD = 8;
const DEFAULT_MAX_DEPTH = 24;
const canvas = document.getElementById('arena-canvas');
const camera = new SphereCamera(window.innerWidth || 1, window.innerHeight || 1);
// Approved carrier control: the surface camera is held by the pilot/cursor.
const surfaceCamera = new CarrierCamera(window.innerWidth || 1, window.innerHeight || 1);
const renderer = new IcosaRenderer(canvas);
const audio = new ArcadeAudio();
const world = new World();

let leafList = world.activeLeaves();
let state = null; // latest server State
let myPlayer = null;
let myIndex = -1;
let authToken = null;
let joined = false;
let joining = false;
let connected = false;
let eventSource = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let hoveredLabel = null;
let navLabel = null;
let lastClickSentAt = 0;
let lastLockToastAt = 0;
const finalDepthNotified = new Set();
const seenOreKeys = new Set();
let lastInteraction = performance.now();
let pollTimer = null;
let focusAnim = null;
let spinVel = { x: 0, y: 0 }; // radians/sec after releasing a drag
let zoomTarget = null; // eased zoom target (null = no movement)
let zoomAnim = null; // fast cubic-bezier step to a cell level
let zoomUiPending = false;
const navKeys = new Set();
// CTL-05: all control persistence flows through control-prefs.js.
const controlPrefsLoad = loadPrefs(readControlStorage());
let controlPrefs = controlPrefsLoad.prefs;
let dragMode = modeFromPrefs(controlPrefs); // pointer polarity only ('follow'|'reverse')
// CTL-01: one absolute surface-point/arrow input implementation.
let activePointerDrag = null; // { cameraDrag, x0, y0 } for the pointer gesture
let pointerRouter = null;
let detachPointerRouter = null;
let detachPointerEnvironment = null;
// CTL-03: server clock/self + leaf epoch feed the one harvest predicate.
let serverSelf = null;
let serverClock = { local: 0, server: 0 };
let lastClickAtClient = null;
let leafEpoch = 0;
// CTL-04: exit is single-flight and history-aware.
let exitingSurface = false;
let surfaceExitState = null;
let surfaceHistoryPushed = false;
let lastEmptyFrameCheck = 0;
let lastMouse = null;
let hoverRaf = false;
let hoverNeedsRefresh = false;
let currentReport = null;
let intro = null;
let interlude = null;
let narrator = null;
let escaping = false;
let seenTips = loadSeenTips();
let appliedPlanetThemeKey = '';
let supplyDrop = null;
let surface = null;
// RND-02: one renderer, two views. `view` is the only mode switch.
let view = 'orbit';
const surfacePeers = new Map();
let surfaceSupplyCells = [];
let planetRenderFaces = [];
let supplyTimer = 0;
let supplyDeadline = 0;
let supplyPlanetKey = '';
let supplyRequestedKey = '';
let lastSupplyEventKey = '';
let lastDistressProgressKey = '';
let captainLogHoldUntil = 0;
let lastCaptainLogCue = null;
let firstGuideTimer = 0;
let guideNarrationTimer = 0;
let guideNarrationToken = 0;
let pendingAutoJoin = null;
let pendingSupplyFocus = null;
let lastSupplyFocus = null;
const missionReadyNotified = new Set();
const GUIDE_CUE_IDS = Object.freeze(['guide-what', 'guide-how', 'guide-where', 'guide-leave']);

const session = {
  startedAt: Date.now(),
  clicks: 0,
  breaks: 0,
  claims: 0,
  steals: 0,
  score: 0,
  depth: 0,
  ores: 0,
  oreValue: 0,
  bestFind: null,
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const now = () => performance.now();
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function safeCall(obj, method, ...args) {
  try {
    if (obj && typeof obj[method] === 'function') return obj[method](...args);
  } catch (err) {
    console.warn(`[icosa] ${method} failed`, err);
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Quick Guide narration (STR-01: four guide section cues)
 * ------------------------------------------------------------------ */

function stopGuideNarration() {
  guideNarrationToken += 1;
  if (guideNarrationTimer) clearTimeout(guideNarrationTimer);
  guideNarrationTimer = 0;
}

/** Play the four Quick Guide section cues in order; cancel on close. */
function startGuideNarration() {
  if (!narrator) return;
  stopGuideNarration();
  const token = guideNarrationToken;
  let index = 0;
  const playNext = () => {
    if (token !== guideNarrationToken || !narrator) return;
    if (ui && !ui.isGuideOpen) return;
    if (index >= GUIDE_CUE_IDS.length) return;
    const cueId = GUIDE_CUE_IDS[index];
    index += 1;
    const ms = narrator.playCue(cueId, { speaker: 'QUICK GUIDE' });
    if (index < GUIDE_CUE_IDS.length) {
      guideNarrationTimer = setTimeout(playNext, Math.max(1200, ms + 320));
    }
  };
  playNext();
}

function openGuide() {
  if (!ui) return;
  narrator.stop();
  safeCall(ui, 'showGuide');
  try {
    localStorage.setItem('icosa.guideSeen', '1');
  } catch {
    /* private mode */
  }
  startGuideNarration();
}

function closeGuide() {
  stopGuideNarration();
  narrator.stop();
  safeCall(ui, 'hideGuide');
}

function scheduleFirstGuide(delayMs = 700) {
  try {
    if (localStorage.getItem('icosa.guideSeen') === '1') return;
  } catch {
    /* private mode */
  }
  clearTimeout(firstGuideTimer);
  firstGuideTimer = setTimeout(() => {
    try {
      if (localStorage.getItem('icosa.guideSeen') === '1') return;
    } catch {
      /* private mode */
    }
    const brief = document.getElementById('landing-brief');
    if (brief && !brief.hidden) return;
    if (!joined) return;
    if (view === 'surface') return;
    openGuide();
  }, Math.max(0, delayMs));
}

/** Storage handle for control preferences; `null` in private mode. */
function readControlStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__icosa_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function safeAudio(method, ...args) {
  try {
    if (audio && typeof audio[method] === 'function') audio[method](...args);
  } catch {
    /* audio is best effort */
  }
}

async function fetchJSON(url, options) {
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    return { res, data };
  } catch (err) {
    return { res: null, data: null, error: err };
  }
}

function postJSON(url, body) {
  return fetchJSON(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function readStorage(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

/** Keep existing single-token sessions switchable after this update. */
function primeTokenMap() {
  try {
    const tag = readStorage(TAG_KEY);
    const token = readStorage(TOKEN_KEY);
    if (!tag || !token) return;
    const map = readTokenMap();
    if (map[tag] !== token) {
      map[tag] = token;
      localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
    }
  } catch {
    /* private mode */
  }
}

function readTokenMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/**
 * One token per callsign: switching tags must create/restore a separate
 * identity (own colour, own score) instead of hijacking the previous one.
 */
function readTokenForTag(tag) {
  const map = readTokenMap();
  if (tag && typeof map[tag] === 'string' && map[tag]) return map[tag];
  return readStorage(TAG_KEY) === tag ? readStorage(TOKEN_KEY) : '';
}

function storeSession(token, tag) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (tag) localStorage.setItem(TAG_KEY, tag);
    if (token && tag) {
      const map = readTokenMap();
      map[tag] = token;
      localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
    }
  } catch {
    /* private mode */
  }
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function refreshLeafList() {
  leafList = world.activeLeaves();
  return stampLeafEpoch();
}

function threshold() {
  return state && Number.isFinite(state.threshold) ? state.threshold : DEFAULT_THRESHOLD;
}

function maxDepth() {
  return state && Number.isFinite(state.maxDepth) ? state.maxDepth : DEFAULT_MAX_DEPTH;
}

function playerAt(index) {
  if (!state || !Array.isArray(state.players)) return null;
  return state.players[index] || null;
}

function myPlayerState() {
  return myIndex >= 0 ? playerAt(myIndex) : null;
}

function faceInfo(label) {
  if (!label) return null;
  const node = world.get(label);
  if (!node) return null;
  const owner = playerAt(node.ownerIndex);
  return {
    label: node.label,
    depth: node.depth,
    clicks: node.clicks,
    threshold: threshold(),
    maxDepth: maxDepth(),
    ownerTag: owner ? owner.tag : null,
    ownerColor: owner ? owner.color : null,
    ownerIndex: node.ownerIndex,
    isMine: node.ownerIndex === myIndex,
    isFinal: node.depth >= maxDepth(),
    locked: harvestStatus(node, { index: myIndex }, harvestContext()).reason === 'own_lock',
    terrain: (() => {
      const terrain = world.terrainFor(node);
      if (!terrain) return null;
      return {
        id: terrain.biome.id,
        name: terrain.biome.name,
        color: terrain.biome.color,
        mineable: terrain.biome.mineable,
        elevation: terrain.elevation,
        temperature: terrain.temperature,
      };
    })(),
    resource: node.resourceId ? resourceById(node.resourceId) : null,
  };
}

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */

const ui = new UI({
  onJoin: (tag) => join(tag),
  onReport: () => openReport(),
  onDownload: () => downloadReport(),
  onShare: () => shareReport(),
  onCloseReport: () => safeCall(ui, 'hideReport'),
  onToggleSound: () => {
    safeAudio('unlock');
    const muted = !audio.isMuted;
    safeAudio('setMuted', muted);
    safeCall(ui, 'setSoundMuted', muted);
  },
  onSurfaceHold: (code, down) => {
    if (surface) surface.hold(code, down);
  },
  onSurfaceExit: () => {
    requestExitSurface();
  },
  onDragModeToggle: () => toggleDragMode(),
  onControlModeToggle: () => toggleSurfaceFromControl(),
});

/* ------------------------------------------------------------------ *
 * Narration / subtitles / Field Manual
 * ------------------------------------------------------------------ */

narrator = createNarrator();
supplyDrop = createSupplyDrop();

surface = createSurfaceController({
  getStartPoint: () => (camera && typeof camera.viewAxis === 'function' ? camera.viewAxis() : { x: 0, y: 0, z: 1 }),
  getLeaves: () => leafList,
  getPlanet: () => {
    const p = typeof planetInfoFromState === 'function' ? planetInfoFromState() : {};
    return { name: p.planetName || 'UNKNOWN WORLD', seed: p.planetSeed || 0, depth: p.planetDepth || 2 };
  },
  getPlayers: () => (state && Array.isArray(state.players) ? state.players : []),
  getMyPlayerId: () => (myPlayer ? myPlayer.id : null),
  getMyIndex: () => myIndex,
  getMaxDepth: () => maxDepth(),
  getSupplyCells: () => surfaceSupplyCells,
  getHarvestContext: () => harvestContext(),
  getPeers: () => {
    const synced = [...surfacePeers.values()].filter((peer) => Date.now() - (peer.updatedAt || 0) < 5000);
    const ids = new Set(synced.map((peer) => peer.playerId));
    const others = (state && Array.isArray(state.players) ? state.players : [])
      .filter((player) => player && player.online && player.id !== (myPlayer && myPlayer.id) && !ids.has(player.id))
      .map((player) => ({ playerId: player.id, tag: player.tag, color: player.color, virtual: true, surface: player.surface || null }));
    return [...synced, ...others];
  },
  onPose: (pose) => sendSurfacePose(pose),
  onHarvest: (label) => {
    if (!joined || !label) return;
    attemptClick(label);
  },
  onHud: (surfaceState) => {
    safeCall(ui, 'updateSurfaceHud', surfaceState);
    applyControlModeUi();
  },
  onExit: () => exitSurfaceMode(),
});

/**
 * RND-05 (PERF-01 friendly): the humanoid rig is a lazy chunk. Prefetch it at
 * boot so the surface never shows an unrigged figure after the landing
 * animation, without adding it to the first-load JavaScript graph.
 */
let humanoidRigPromise = null;
function loadHumanoidRig() {
  if (!humanoidRigPromise) {
    humanoidRigPromise = import('./shared/humanoid-3d.js')
      .then((module) => safeCall(renderer, 'setHumanoidModule', module) === true)
      .catch((err) => {
        console.warn('[icosa] humanoid rig unavailable', err);
        return false;
      });
  }
  return humanoidRigPromise;
}

function loadSeenTips() {
  try {
    const raw = JSON.parse(localStorage.getItem('icosa.tips') || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function maybeTip(id, { delay = 900, speaker = 'TACTICAL' } = {}) {
  if (!id || seenTips[id] || !joined) return;
  if (view === 'surface') return;
  if (intro && intro.active) return;
  if (interlude && interlude.active) return;
  if (ui && ui.isManualOpen) return;
  seenTips[id] = 1;
  try {
    localStorage.setItem('icosa.tips', JSON.stringify(seenTips));
  } catch {
    /* private mode */
  }
  setTimeout(() => {
    if (!joined || (intro && intro.active) || (interlude && interlude.active)) return;
    narrator.playCue(id, { speaker });
  }, Math.max(0, delay));
}

/* ------------------------------------------------------------------ *
 * Cinematic intro (cockpit → gravity capture → planet reveal)
 * ------------------------------------------------------------------ */

intro = createIntro({
  camera,
  ui,
  safeCall,
  safeAudio,
  onStart: () => {
    focusAnim = null;
    safeCall(renderer, 'setPoleLabelsVisible', false);
    hoveredLabel = null;
    safeCall(ui, 'setHoverFace', null);
    safeCall(ui, 'hideLanding');
    safeCall(ui, 'hideReport');
    renderer.setHover(null);
  },
  planetName: planetName(0),
  onPhase: (phase) => {
    narrator.playCue(`intro-${phase}`, { speaker: 'NARRATOR', interrupt: true });
  },
  onComplete: ({ skipped }) => {
    if (!skipped) narrator.playCue('intro-arrival', { speaker: 'SHIP AI' });
    safeCall(renderer, 'setPoleLabelsVisible', joined);
    if (!joined) {
      safeCall(ui, 'showLanding');
      safeCall(ui, 'setConnection', 'connected');
      safeCall(ui, 'updateMission', missionProgress({}, missionForPlanet(0, 0)));
      refreshPublicState();
      safeCall(ui, 'toast', skipped
        ? `INTRO SKIPPED // WELCOME TO ${planetName(0)}`
        : 'FUEL EMPTY // GRAVITY CAPTURE // MINE REQUIRED ORES TO ESCAPE', 'info');
      if (pendingAutoJoin) {
        const tag = pendingAutoJoin;
        pendingAutoJoin = null;
        join(tag);
      }
      // Otherwise always show the callsign/tag screen after the launch cine,
      // so the pilot can keep their identity or enter a new game tag.
    } else {
      // Replay from inside the game: return straight to play.
      safeCall(ui, 'setConnection', connected ? 'connected' : 'reconnecting');
      resize();
      updateZoomUi();
    }
  },
});

interlude = createInterlude({ safeCall, safeAudio });

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

function buildPlanetRenderFaces(levelOverride) {
  // ONE render tessellation per quality tier for the whole planet, identical
  // in orbit and surface. The camera never changes triangle density; the
  // PERF-01 quality ladder selects full/medium/coarse before drawing.
  const targetLevel = Number.isInteger(levelOverride)
    ? clamp(levelOverride, 0, 4)
    : leafList.length <= 120 ? 4 : leafList.length <= 400 ? 3 : 2;
  const out = [];
  const angle = (p, q) => Math.acos(clamp(p.x * q.x + p.y * q.y + p.z * q.z, -1, 1));
  for (const node of leafList) {
    if (!node || !node.a) continue;
    const edge = Math.max(angle(node.a, node.b), angle(node.b, node.c), angle(node.c, node.a));
    const edgeLevel = clamp(Math.ceil(Math.log2(Math.max(1e-4, edge / 0.03))), 0, 5);
    const level = Math.min(targetLevel, edgeLevel);
    let tris = [{ a: node.a, b: node.b, c: node.c }];
    for (let i = 0; i < level; i += 1) {
      const next = [];
      for (const tri of tris) for (const child of childTriangles(tri.a, tri.b, tri.c)) next.push(child);
      tris = next;
    }
    for (let i = 0; i < tris.length; i += 1) {
      const tri = tris[i];
      out.push({
        label: `~${node.label}.${i}`,
        sourceLabel: node.label,
        a: tri.a, b: tri.b, c: tri.c,
        centroid: faceCentroid(tri.a, tri.b, tri.c),
        depth: node.depth,
        ownerIndex: node.ownerIndex,
        clicks: node.clicks,
        lastClickIndex: node.lastClickIndex,
        terrain: node.terrain,
        resourceId: null,
      });
    }
  }
  return out;
}

function refreshPlanetRenderFaces() {
  planetRenderFaces = buildPlanetRenderFaces();
  // PERF-01 LOD: tier 1 medium (2^2 triangles per leaf), tier 0 coarse
  // (2^1). Both keep the exact live-leaf boundaries and ownership tint.
  const mediumFaces = buildPlanetRenderFaces(2);
  const coarseFaces = buildPlanetRenderFaces(1);
  renderer.setFaces(planetRenderFaces, { lod: { 0: coarseFaces, 1: mediumFaces } });
}


function syncRenderFaces() {
  refreshPlanetRenderFaces();
}

function boot() {
  primeTokenMap();
  resize();
  renderer.setPlayers([], null);
  safeCall(renderer, 'setPoleLabelsVisible', false);
  renderer.setConfig({ threshold: DEFAULT_THRESHOLD, maxDepth: DEFAULT_MAX_DEPTH });
  syncRenderFaces();

  const params = new URLSearchParams(window.location.search);
  const prefill = (params.get('tag') || readStorage(TAG_KEY) || '').toUpperCase().slice(0, 12);
  const tagInput = document.getElementById('tag-input');
  if (tagInput && prefill) tagInput.value = prefill;

  safeCall(ui, 'showLanding', { leaderboard: [], liveCount: 0, world: null });
  safeCall(ui, 'setConnection', 'connecting');
  safeCall(ui, 'hideReport');
  refreshPublicState();
  if (!PERF_PROBE) startPolling();

  const reportParam = params.get('report');
  const autoTag = params.get('auto') === '1' && prefill ? prefill : null;
  const wantsIntro = !reportParam && intro.shouldPlay();
  if (reportParam) {
    showSharedReport(reportParam);
  } else if (wantsIntro && intro.start()) {
    pendingAutoJoin = autoTag;
  } else if (autoTag) {
    join(autoTag);
  }

  const replayBtn = document.getElementById('btn-replay-intro');
  if (replayBtn) replayBtn.addEventListener('click', () => startIntroReplay());
  const escapeBtn = document.getElementById('btn-escape');
  if (escapeBtn) escapeBtn.addEventListener('click', () => requestEscape());
  const escapeCenterBtn = document.getElementById('btn-escape-center');
  if (escapeCenterBtn) escapeCenterBtn.addEventListener('click', () => requestEscape());
  const helpBtn = document.getElementById('btn-help');
  if (helpBtn) helpBtn.addEventListener('click', () => openGuide());
  const guideStartBtn = document.getElementById('btn-guide-start');
  if (guideStartBtn) guideStartBtn.addEventListener('click', () => closeGuide());
  const guideCloseBtn = document.getElementById('btn-guide-close');
  if (guideCloseBtn) guideCloseBtn.addEventListener('click', () => closeGuide());
  const guideManualBtn = document.getElementById('btn-guide-manual');
  if (guideManualBtn) guideManualBtn.addEventListener('click', () => {
    closeGuide();
    safeCall(ui, 'showManual', HELP_SECTIONS);
  });
  const guideShareBtn = document.getElementById('btn-guide-share');
  if (guideShareBtn) guideShareBtn.addEventListener('click', async () => {
    const link = `${location.origin}${location.pathname}?guide=1`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const area = document.createElement('textarea');
        area.value = link;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      safeCall(ui, 'toast', 'GUIDE LINK COPIED // SEND IT TO A NEW PILOT', 'good');
    } catch {
      safeCall(ui, 'toast', link, 'info');
    }
  });
  if (params.get('guide') === '1') setTimeout(openGuide, 500);
  const manualSections = document.getElementById('manual-sections');
  if (manualSections) manualSections.addEventListener('click', (event) => {
    const btn = event.target && event.target.closest ? event.target.closest('.manual-play') : null;
    if (!btn || !btn.dataset || !btn.dataset.voice) return;
    narrator.playCue(btn.dataset.voice, { speaker: 'FIELD MANUAL' });
  });
  const briefStartBtn = document.getElementById('btn-landing-brief-start');
  if (briefStartBtn) briefStartBtn.addEventListener('click', () => {
    maybeTip(state && state.planetIndex > 0 ? 'tip-newplanet' : 'tip-mining', { delay: 600 });
    scheduleFirstGuide(900);
  });
  const navFocusBtn = document.getElementById('btn-nav-focus');
  if (navFocusBtn) navFocusBtn.addEventListener('click', () => {
    if (navLabel) focusFace(navLabel);
  });
  const navNextBtn = document.getElementById('btn-nav-next');
  if (navNextBtn) navNextBtn.addEventListener('click', () => chooseNavTarget({ cycle: true }));
  const abandonBtn = document.getElementById('btn-abandon');
  if (abandonBtn) abandonBtn.addEventListener('click', () => abandonRun());
  const newPilotBtn = document.getElementById('btn-new-pilot');
  if (newPilotBtn) newPilotBtn.addEventListener('click', () => startNewPilot());
  if (params.get('mute') === '1') {
    safeAudio('setMuted', true);
    safeCall(ui, 'setSoundMuted', true);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    // Browsers suspend/duck audio when a tab is backgrounded or interrupted.
    safeAudio('unlock');
    safeAudio('resume');
    if (narrator) narrator.resume();
    if (!joined) refreshPublicState();
  });
  // Keep the audio context warm while the cockpit is active; this is a no-op
  // when the player has not unlocked audio or has muted it. The PERF-01 probe
  // skips it so an audio-context wake-up can never look like a renderer stall.
  if (!PERF_PROBE) {
    const audioWatchdog = setInterval(() => {
      if (document.hidden) return;
      safeAudio('unlock');
      safeAudio('resume');
      if (narrator) narrator.resume();
    }, 15000);
    audioWatchdog.unref?.();
  }

  bindCanvasInput();
  bindKeyboard();
  installPerfInputProbe();
  bindControlModeUi();
  applyControlModeUi(true);
  requestAnimationFrame(frame);
}

function resize() {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  camera.setViewport(w, h);
  surfaceCamera.setViewport(w, h);
  try {
    renderer.resize();
  } catch (err) {
    console.warn('[icosa] renderer resize failed', err);
  }
  try {
    if (intro) intro.resize();
  } catch {
    /* intro canvas is optional */
  }
}

/* ------------------------------------------------------------------ *
 * Landing data
 * ------------------------------------------------------------------ */

async function refreshPublicState() {
  const { res, data } = await fetchJSON('/api/state', { cache: 'no-store' });
  if (!res || !res.ok || !data || !data.ok || !data.state) {
    safeCall(ui, 'setConnection', 'offline');
    return;
  }
  if (!joined) {
    safeCall(ui, 'setConnection', 'connected');
    if (data.state.planetSeed != null && world.planetSeed !== (Number(data.state.planetSeed) >>> 0)) {
      world.setPlanetSeed(data.state.planetSeed);
      refreshLeafList();
      syncRenderFaces();
    }
    safeCall(ui, 'updateHud', data.state, null, { zoom: camera.zoom });
    safeCall(ui, 'setLeaderboard', data.state.arcade || []);
    safeCall(ui, 'setLiveCount', onlineCount(data.state));
  }
}

function onlineCount(s) {
  if (!s || !Array.isArray(s.players)) return 0;
  return s.players.filter((p) => p && p.online).length;
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (joined) return;
    refreshPublicState();
  }, 4000);
}

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */

function normalizeTag(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .slice(0, 12);
}

async function join(rawTag) {
  if (joining) return;
  const tag = normalizeTag(rawTag);
  if (!/^[A-Z0-9_-]{2,12}$/.test(tag)) {
    safeCall(ui, 'showJoinError', 'TAG MUST BE 2–12 CHARS: A–Z 0–9 _ -');
    safeAudio('error');
    return;
  }

  joining = true;
  safeCall(ui, 'setJoinBusy', true);
  safeCall(ui, 'showJoinError', '');
  safeCall(ui, 'setConnection', 'connecting');
  safeAudio('unlock');

  const { res, data, error } = await postJSON('/api/join', {
    tag,
    token: readTokenForTag(tag) || undefined,
  });

  if (error || !res || !res.ok || !data || !data.ok) {
    const message =
      (data && data.message) ||
      (data && data.error === 'TAG_IN_USE'
        ? 'THAT CALLSIGN IS TAKEN — CHOOSE ANOTHER'
        : 'NO UPLINK — SERVER UNREACHABLE');
    safeCall(ui, 'showJoinError', message);
    safeCall(ui, 'setConnection', 'offline');
    safeCall(ui, 'setJoinBusy', false);
    safeAudio('error');
    joining = false;
    return;
  }

  myPlayer = { id: data.player.id, tag: data.player.tag, color: data.player.color };
  authToken = data.token;
  storeSession(authToken, myPlayer.tag);
  joined = true;
  joining = false;
  reconnectAttempts = 0;
  resetSession();

  applySnapshot(data.state, data.leaves);
  if (data.focus) handleSupplyFocusEvent(data.focus);
  const joinedProgress = refreshMission();
  startDistressTimer();
  chooseNavTarget();
  safeCall(ui, 'hideLanding');
  if (!joinedProgress.ready) {
    setTimeout(() => {
      if (joined && !escaping && !(interlude && interlude.active)) {
        safeCall(ui, 'showLandingBrief', joinedProgress, planetInfoFromState());
      }
    }, 300);
  }
  safeCall(renderer, 'setPoleLabelsVisible', true);
  safeCall(ui, 'setJoinBusy', false);
  safeCall(ui, 'setSoundMuted', !!audio.isMuted);
  safeAudio('join');
  connectEvents();
  scheduleFirstGuide(2200);

  safeCall(ui, 'toast', "RADIO CHECK // YOU'RE NOT ALONE OUT HERE", 'good');
}

function resetSession() {
  clearDistressTimer();
  supplyRequestedKey = '';
  supplyPlanetKey = '';
  surfaceSupplyCells = [];
  captainLogHoldUntil = 0;
  appliedPlanetThemeKey = '';
  session.startedAt = Date.now();
  session.clicks = 0;
  session.breaks = 0;
  session.claims = 0;
  session.steals = 0;
  session.score = 0;
  session.depth = 0;
  session.ores = 0;
  session.oreValue = 0;
  session.bestFind = null;
}

function connectEvents() {
  if (!authToken) return;
  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
  }
  safeCall(ui, 'setConnection', 'connecting');
  const es = new EventSource(`/api/events?token=${encodeURIComponent(authToken)}`);
  eventSource = es;
  es.onopen = () => {
    connected = true;
    reconnectAttempts = 0;
    safeCall(ui, 'setConnection', 'connected');
  };
  es.onerror = () => {
    connected = false;
    if (!joined || escaping || (interlude && interlude.active)) return;
    safeCall(ui, 'setConnection', 'reconnecting');
    scheduleReconnect();
  };
  es.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    try {
      handleEvent(msg);
    } catch (err) {
      console.warn('[icosa] event failed', msg && msg.type, err);
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectAttempts += 1;
  const delay = Math.min(8000, 400 + reconnectAttempts * 700);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!joined || connected || escaping || (interlude && interlude.active)) return;
    const tag = myPlayer ? myPlayer.tag : normalizeTag(readStorage(TAG_KEY));
    const { res, data } = await postJSON('/api/join', {
      tag,
      token: authToken || readTokenForTag(tag) || undefined,
    });
    if (res && res.ok && data && data.ok) {
      myPlayer = { id: data.player.id, tag: data.player.tag, color: data.player.color };
      authToken = data.token;
      storeSession(authToken, myPlayer.tag);
      applySnapshot(data.state, data.leaves);
      if (data.focus) handleSupplyFocusEvent(data.focus);
      connectEvents();
    } else if (reconnectAttempts < 999) {
      scheduleReconnect();
    }
  }, delay);
}

/* ------------------------------------------------------------------ *
 * Server events
 * ------------------------------------------------------------------ */

/** Bounded ring of received SSE frames for acceptance ordering evidence (TST-01). */
const EVENT_LOG_LIMIT = 200;
const eventLog = [];
function recordEvent(msg) {
  if (!msg || typeof msg.type !== 'string') return;
  // `cell` frames carry the label as cell[0]; `supply_focus` as impactLabel.
  const label = typeof msg.label === 'string'
    ? msg.label
    : (Array.isArray(msg.cell) && typeof msg.cell[0] === 'string')
      ? msg.cell[0]
      : (typeof msg.impactLabel === 'string' ? msg.impactLabel : null);
  eventLog.push({
    type: msg.type,
    playerId: msg.playerId || null,
    label,
    at: Date.now(),
    ...(Array.isArray(msg.children) ? { children: msg.children.length } : {}),
  });
  if (eventLog.length > EVENT_LOG_LIMIT) eventLog.splice(0, eventLog.length - EVENT_LOG_LIMIT);
}

function handleEvent(msg) {
  recordEvent(msg);
  switch (msg.type) {
    case 'snapshot':
      applySnapshot(msg.state, msg.leaves);
      if (msg.focus) handleSupplyFocusEvent(msg.focus);
      break;
    case 'state':
      applyState(msg.state);
      break;
    case 'cell':
      handleCellEvent(msg);
      break;
    case 'break':
      handleBreakEvent(msg);
      break;
    case 'resource':
      handleResourceEvent(msg);
      break;
    case 'supply':
      handleSupplyEvent(msg);
      break;
    case 'supply_focus':
      handleSupplyFocusEvent(msg);
      break;
    case 'surface':
    case 'surface_leave':
      handleSurfaceEvent(msg);
      break;
    case 'surface_mine':
      // RND-07: the renderer owns the beam; app.js only forwards the frame.
      if (surface && surface.active) {
        safeCall(renderer, 'mineBeam', {
          playerId: msg.playerId,
          tag: msg.tag,
          color: msg.color,
          toLeaf: msg.label,
          pos: msg.pos,
          kind: msg.broke ? 'break' : 'mine',
          startAt: Number.isFinite(msg.updatedAt) ? msg.updatedAt : Date.now(),
        });
      }
      break;
    case 'incident':
      handleIncidentEvent(msg);
      break;
    case 'meteor': // backward compatibility for older streams
      handleIncidentEvent(msg);
      break;
    case 'toast':
      safeCall(ui, 'toast', msg.message || '', msg.kind || 'info');
      break;
    default:
      break;
  }
}

function applySnapshot(nextState, leaves) {
  if (!nextState) return;
  leafEpoch += 1;
  if (nextState.planetSeed != null) {
    world.setPlanetSeed(nextState.planetSeed);
  }
  world.loadLeaves(leaves);
  refreshLeafList();
  syncRenderFaces();
  applyState(nextState);
  syncSurfaceResourcePins();
  refreshMission();
  refreshNavTarget();
  renderer.setHover(null);
  hoveredLabel = null;
  safeCall(ui, 'setHoverFace', null);
}

function applyState(next) {
  if (!next || !Array.isArray(next.players)) return;
  state = next;
  // CTL-03: server clock + the pilot's own click timing power harvest truth.
  if (Number.isFinite(next.serverTime)) {
    serverClock = { local: performance.now(), server: next.serverTime };
  }
  if (next.self && Number.isInteger(next.self.index)) {
    serverSelf = {
      index: next.self.index,
      lastClickAtMs: Number.isFinite(next.self.lastClickAtMs) ? next.self.lastClickAtMs : null,
      clickCooldownMs: Number.isFinite(next.self.clickCooldownMs) ? next.self.clickCooldownMs : 0,
    };
    if (serverSelf.lastClickAtMs != null && lastClickAtClient == null) {
      lastClickAtClient = serverSelf.lastClickAtMs;
    }
  }
  if (next.planetSeed != null && world.planetSeed !== (Number(next.planetSeed) >>> 0)) {
    world.setPlanetSeed(next.planetSeed);
    refreshLeafList();
    syncRenderFaces();
  }
  myIndex = myPlayer ? next.players.findIndex((p) => p.id === myPlayer.id) : -1;
  if (myIndex === -1 && myPlayer && joined) {
    // Player identity lost (world reset): fall back to landing.
    showSessionLost();
    return;
  }
  renderer.setPlayers(next.players, myPlayer ? myPlayer.id : null);
  syncSurfacePeerVisuals();
  renderer.setConfig({ threshold: next.threshold, maxDepth: next.maxDepth });
  safeCall(ui, 'updateHud', next, myPlayer ? myPlayer.id : null, {
    zoom: camera.zoom,
    hoverFace: hoveredLabel ? faceInfo(hoveredLabel) : null,
  });
  safeCall(ui, 'setLeaderboard', next.arcade || []);
  refreshMission();
  safeCall(ui, 'setLiveCount', onlineCount(next));
  if (hoveredLabel) {
    const info = faceInfo(hoveredLabel);
    if (info) safeCall(ui, 'setHoverFace', info);
    else {
      hoveredLabel = null;
      renderer.setHover(null);
      safeCall(ui, 'setHoverFace', null);
    }
  }
  updateZoomUi();
  applyControlModeUi();
}

function handleCellEvent(msg) {
  if (!Array.isArray(msg.cell)) return;
  // A cell update never changes the leaf set; the epoch only moves on snapshot
  // and break, so untouched leaves cannot be branded stale by a neighbour.
  const [label, ownerIndex, clicks, , lastClickIndex] = msg.cell;
  const node = world.applyCell(label, ownerIndex, clicks, lastClickIndex);
  if (!node) return;
  node.leafEpoch = leafEpoch;
  // The authoritative click landed; our own cooldown starts from it.
  if (Number.isInteger(lastClickIndex) && lastClickIndex === myIndex) lastClickAtClient = serverNow();
  renderer.updateCell(label, node.ownerIndex, node.clicks, node.lastClickIndex);
  refreshPlanetRenderFaces();
  if (hoveredLabel === label) safeCall(ui, 'setHoverFace', faceInfo(label));
}

function handleBreakEvent(msg) {
  if (!msg || typeof msg.label !== 'string') return;
  leafEpoch += 1;
  const children = world.applyBreak(msg.label, msg.children);
  if (!children) return;
  refreshLeafList();
  renderer.replaceFace(msg.label, children);
  refreshPlanetRenderFaces();
  syncSurfaceResourcePins();
  for (const child of children) renderer.pulse(child.label, { color: '#d7ff00', kind: 'break', text: '' });
  safeAudio('breakShatter');
  safeCall(ui, 'toast', `CELL ${msg.label} FRACTURED // 4 NEW NODES`, 'good');
  if (hoveredLabel === msg.label) {
    hoveredLabel = null;
    renderer.setHover(null);
    safeCall(ui, 'setHoverFace', null);
  }
}

function handleResourceEvent(msg) {
  if (!msg || typeof msg.label !== 'string' || !msg.resource) return;
  applyDiscoveredResource(msg.label, msg.resource, msg.playerId);
}

/**
 * Record a discovered deposit exactly once (the scan frame and the click
 * response can both announce it; the first one wins).
 */
function applyDiscoveredResource(label, resource, playerId) {
  const key = `${label}:${resource.id}`;
  if (seenOreKeys.has(key)) return;
  const node = world.get(label);
  if (node && node.resourceId) return;
  seenOreKeys.add(key);
  if (node) {
    node.resourceId = resource.id;
    try {
      if (typeof renderer.discoverResource === 'function') renderer.discoverResource(label, resource.id);
      else syncRenderFaces();
    } catch (err) {
      console.warn('[icosa] resource marker failed', err);
    }
  }
  syncSurfaceResourcePins();
  const value = Number(resource.value) || 0;
  renderer.pulse(label, { color: resource.color || '#ffd166', kind: 'resource', text: `+${value} ${resource.name}` });
  safeCall(ui, 'setLastFind', resource, value);
  const mine = !!(playerId && myPlayer && playerId === myPlayer.id);
  if (mine) {
    session.ores += 1;
    session.oreValue += value;
    if (!session.bestFind || value > session.bestFind.value) {
      session.bestFind = { id: resource.id, name: resource.name, glyph: resource.glyph, value, color: resource.color };
    }
    safeCall(ui, 'toast', `GOOD FIND // ${resource.name} +${value} CR`, 'good');
    safeAudio('discovery');
    maybeTip('tip-ore', { delay: 1200 });
    const stat = myStatePlayer();
    if (stat) {
      stat.oreCounts = stat.oreCounts && typeof stat.oreCounts === 'object' ? stat.oreCounts : {};
      stat.oreCounts[resource.id] = (stat.oreCounts[resource.id] || 0) + 1;
      refreshMission();
    }
  } else if (value >= 1200) {
    const tag = playerId && state ? (state.players.find((p) => p.id === playerId) || {}).tag : null;
    safeCall(ui, 'toast', `${tag || 'OPERATOR'} STRUCK ${resource.name} // +${value} CR`, 'info');
  }
  if (surface && surface.active) safeCall(surface, 'harvestEffect', { resource, value, label });
  if (hoveredLabel === label) safeCall(ui, 'setHoverFace', faceInfo(label));
}

function myStatePlayer() {
  if (!state || !myPlayer || !Array.isArray(state.players)) return null;
  return state.players.find((player) => player && player.id === myPlayer.id) || null;
}

function cellLockedForMe(node) {
  return !!node && node.ownerIndex === myIndex && node.lastClickIndex === myIndex;
}

/** Recompute the escape mission from the pilot's persistent ore inventory. */
/** Apply the planet's major colour identity to CSS and the procedural globe. */
function applyPlanetTheme(planet) {
  if (!planet) return;
  const seed = Number.isInteger(planet.planetSeed) ? planet.planetSeed >>> 0 : 0;
  const key = `${planet.planetIndex}:${seed}`;
  if (key === appliedPlanetThemeKey) return;
  appliedPlanetThemeKey = key;
  const theme = planetTheme(planet.planetIndex, seed);
  if (typeof document !== 'undefined' && document.body) {
    document.body.style.setProperty('--planet-accent', theme.accent);
    document.body.style.setProperty('--planet-secondary', theme.secondary);
    document.body.style.setProperty('--planet-atmosphere', theme.atmosphere);
    document.body.dataset.planetTheme = theme.id;
  }
  safeCall(renderer, 'setPlanetTheme', theme);
  // Colour derivation changed: re-sync so the live mesh rebuilds from the leaves.
  syncRenderFaces();
}

function planetInfoFromState() {
  const next = state || {};
  const index = Number.isInteger(next.planetIndex) ? next.planetIndex : 0;
  const seed = Number.isInteger(next.planetSeed) ? next.planetSeed >>> 0 : 0;
  return {
    planetIndex: index,
    planetSeed: seed,
    planetDepth: Number.isInteger(next.planetDepth) ? next.planetDepth : planetDepth(index),
    planetName: typeof next.planetName === 'string' && next.planetName ? next.planetName : planetName(index),
    planetSource: typeof next.planetSource === 'string' && next.planetSource ? next.planetSource : planetSource(index),
    mission: missionForPlanet(index, seed),
  };
}

function clearDistressTimer() {
  if (supplyTimer) clearTimeout(supplyTimer);
  supplyTimer = 0;
  safeCall(ui, 'setDistressTimer', null);
}

function startDistressTimer() {
  clearDistressTimer();
  if (!joined || !myPlayer) return;
  const planet = planetInfoFromState();
  supplyPlanetKey = `${planet.planetIndex}:${planet.planetSeed}`;
  supplyRequestedKey = '';
  lastDistressProgressKey = '';
  supplyDeadline = Date.now() + 120000;
  const tick = () => {
    supplyTimer = 0;
    if (!joined) return;
    const progress = refreshMission();
    if (progress.ready) {
      clearDistressTimer();
      return;
    }
    const progressKey = `${supplyPlanetKey}:${progress.have}`;
    if (progressKey !== lastDistressProgressKey) {
      lastDistressProgressKey = progressKey;
      supplyDeadline = Date.now() + 120000;
    }
    const remaining = Math.max(0, Math.ceil((supplyDeadline - Date.now()) / 1000));
    safeCall(ui, 'setDistressTimer', remaining);
    if (remaining <= 0) {
      requestEmergencySupply();
      return;
    }
    supplyTimer = setTimeout(tick, 1000);
  };
  safeCall(ui, 'setDistressTimer', 120);
  supplyTimer = setTimeout(tick, 1000);
}

async function requestEmergencySupply() {
  if (!joined || !authToken) return;
  const key = planetInfoFromState();
  const planetKey = `${key.planetIndex}:${key.planetSeed}`;
  if (supplyRequestedKey === planetKey) return;
  supplyRequestedKey = planetKey;
  const { res, data, error } = await postJSON('/api/action', {
    token: authToken,
    type: 'supply',
    label: navLabel || undefined,
  });
  if (error || !res || !res.ok || !data || !data.ok) {
    supplyRequestedKey = '';
    safeCall(ui, 'setDistressTimer', 15);
    safeCall(ui, 'setCaptainLog', 'The relief ship is holding off. We keep mining; she will find a window.');
    supplyTimer = setTimeout(() => {
      if (joined) requestEmergencySupply();
    }, 15000);
    return;
  }
  if (Array.isArray(data.cells)) handleSupplyEvent({ ...data, message: data.message, cells: data.cells, impactLabel: data.impactLabel });
}

function turnViewToSupply(label) {
  const node = world.get(label);
  if (!node) return false;
  const c = node.centroid;
  let targetYaw = Math.atan2(-c.x, c.z);
  const horizontal = Math.hypot(c.x, c.z);
  const targetPitch = Math.atan2(c.y, horizontal);
  let dYaw = targetYaw - camera.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  const targetZoom = Math.max(
    camera.zoom,
    zoomForLevel(Math.min(maxOrbitZoomLevel(), Math.max(2, (Number(node.depth) || 0) + 2))),
  );
  focusAnim = {
    start: now(),
    duration: 560,
    fromYaw: camera.yaw,
    toYaw: camera.yaw + dYaw,
    fromPitch: camera.pitch,
    toPitch: targetPitch,
    fromZoom: camera.zoom,
    toZoom: targetZoom,
  };
  lastInteraction = now();
  return true;
}

function handleSupplyEvent(msg) {
  if (!msg) return;
  const cells = Array.isArray(msg.cells) ? msg.cells : [];
  const eventKey = `${msg.impactLabel || ''}:${cells.map((c) => `${c.label}:${c.resourceId}`).join(',')}`;
  if (eventKey && eventKey === lastSupplyEventKey) return;
  lastSupplyEventKey = eventKey;
  const message = msg.message || 'EMERGENCY SUPPLY DROP // SALVAGE MARKED CELLS';
  surfaceSupplyCells = cells.map((cell) => {
    const resource = resourceById(cell.resourceId) || { name: cell.resourceId, color: '#ffd166' };
    return { label: cell.label, resourceId: cell.resourceId, name: resource.name, color: resource.color };
  });
  if (surface && surface.active) {
    // A supply drop is a shared race: put every surface pilot at the impact
    // footprint immediately so they can mine the marked cells, not just watch.
    surface.focusLabel(msg.impactLabel);
  }
  clearDistressTimer();
  // EVT-03: the relief ship is announced too, but through the SAME single
  // #event-announcer region, so it never duplicates a toast live region.
  const supplyPlanet = typeof planetInfoFromState === 'function' ? planetInfoFromState() : {};
  const supplyPlanetName = (supplyPlanet && supplyPlanet.planetName) || 'this planet';
  safeCall(
    ui,
    'announceEvent',
    `supply:${eventKey || supplyPlanetName}`,
    `Emergency supply drop on ${supplyPlanetName}. Missing ore is scattered across the marked triangles. It is a race; every pilot on this world can see the salvage rings.`,
    [
      'Emergency supply drop. A relief ship came down hard.',
      'The missing ore is scattered across the marked triangles.',
      'It is a race; every pilot on this world can see the salvage rings.',
    ],
  );
  setCaptainLogMessage('They heard us. A relief ship came down hard — the missing ore is scattered across the marked triangles. Go get it.', 30000);
  if (narrator) narrator.playCue('event-relief', { speaker: 'SHIP AI' });
  if (supplyDrop) supplyDrop.show({ message, cells });
  safeCall(renderer, 'setSupplyMarkers', cells);
  const label = msg.impactLabel || cells[0]?.label;
  if (label) {
    navLabel = label;
    safeCall(renderer, 'setWaypoint', label);
    const info = faceInfo(label);
    if (info) safeCall(ui, 'setNavTarget', info);
  }
  // Every human on the planet turns toward the impact so the salvage race is
  // immediate, not a hunt for a tiny marker.
  setTimeout(() => {
    if (!joined || (interlude && interlude.active)) return;
    if (label) turnViewToSupply(label);
  }, 260);
  safeAudio('discovery');
  // The relief beacon repeats: if the pilot is still missing parts after this
  // drop, start another two-minute stuck window. Progress resets the window.
  setTimeout(() => {
    if (!joined) return;
    const progress = refreshMission();
    if (progress.ready) return;
    supplyRequestedKey = '';
    lastDistressProgressKey = '';
    supplyDeadline = Date.now() + 120000;
    startDistressTimer();
  }, 3500);
}

/**
 * SRV-04: the server's `supply_focus` frame carries one authoritative placement
 * per online human. Adopt our own placement; the legacy `supply` centroid focus
 * remains the fallback for older frames.
 */
function handleSupplyFocusEvent(msg) {
  if (!msg || !Array.isArray(msg.placements)) return;
  if (msg.expiresAt && Date.now() > msg.expiresAt) return;
  lastSupplyFocus = { ...msg, receivedAt: Date.now() };
  pendingSupplyFocus = msg;
  applySupplyFocus();
}

function applySupplyFocus() {
  const focus = pendingSupplyFocus;
  if (!focus || !surface || !surface.active || !myPlayer) return false;
  if (focus.expiresAt && Date.now() > focus.expiresAt) {
    pendingSupplyFocus = null;
    return false;
  }
  const placement = focus.placements.find((entry) => entry && entry.playerId === myPlayer.id);
  if (!placement) return false;
  const applied = safeCall(surface, 'applyPlacement', placement);
  if (applied) pendingSupplyFocus = null;
  return !!applied;
}

function setCaptainLogMessage(text, holdMs = 22000) {
  captainLogHoldUntil = Date.now() + Math.max(1000, holdMs);
  safeCall(ui, 'setCaptainLog', text || '');
}

function captainLogFor(planet, progress) {
  const missing = [];
  for (const objective of progress.objectives) {
    for (const item of objective.items) {
      if (item.done) continue;
      const left = Math.max(0, item.need - item.have);
      if (left > 0) missing.push({ name: item.name, left });
    }
  }
  return captainLog({
    planetName: planet.planetName,
    planetSource: planet.planetSource,
    missing,
    ready: progress.ready,
  });
}

/** Which Captain's Log cue matches the current refit state. */
function captainLogCueFor(progress) {
  if (progress.ready) return 'log-ready';
  for (const objective of progress.objectives) {
    for (const item of objective.items) {
      if (item.need > item.have) return 'log-grounded';
    }
  }
  return 'log-almost';
}

/**
 * Narrate the Captain's Log on state transitions only, never over other
 * narration (STR-01: three log cues). The first observation after boot is
 * silent so the intro/landing keeps its own voice.
 */
function narrateCaptainLog(progress) {
  const cueId = captainLogCueFor(progress);
  if (lastCaptainLogCue === null) {
    lastCaptainLogCue = cueId;
    return;
  }
  if (lastCaptainLogCue === cueId) return;
  lastCaptainLogCue = cueId;
  if (!joined || !narrator || narrator.speaking) return;
  if (intro && intro.active) return;
  if (interlude && interlude.active) return;
  if (ui && (ui.isGuideOpen || ui.isManualOpen)) return;
  narrator.playCue(cueId, { speaker: "CAPTAIN'S LOG" });
}

function refreshMission() {
  const player = myStatePlayer();
  const counts = player && player.oreCounts ? player.oreCounts : {};
  const planet = planetInfoFromState();
  applyPlanetTheme(planet);
  const progress = missionProgress(counts, planet.mission);
  safeCall(ui, 'updateMission', progress);
  safeCall(ui, 'updateCargo', counts);
  if (Date.now() >= captainLogHoldUntil) {
    safeCall(ui, 'setCaptainLog', captainLogFor(planet, progress));
    narrateCaptainLog(progress);
  }
  safeCall(ui, 'setPlanet', {
    planetIndex: planet.planetIndex,
    planetDepth: planet.planetDepth,
    planetName: planet.planetName,
    planetSource: planet.planetSource,
  });
  safeCall(ui, 'setGuideThreshold', threshold());
  safeCall(ui, 'setEscapeReady', progress.ready && !(interlude && interlude.active), planet.mission.name);
  if (progress.ready && player && !missionReadyNotified.has(`${planet.planetIndex}:${player.id}`)) {
    missionReadyNotified.add(`${planet.planetIndex}:${player.id}`);
    safeCall(ui, 'toast', `THE DRIVE IS ALIVE // ${planet.planetName} IS READY TO LET US GO`, 'good');
    safeAudio('discovery');
    maybeTip('tip-escape', { delay: 1800, speaker: 'SHIP AI' });
  }
  return progress;
}

/** Complete the escape mission and leave for the next planet. */
async function requestEscape() {
  if (!joined || !myPlayer || escaping) return;
  if (interlude && interlude.active) return;
  const progress = refreshMission();
  if (!progress.ready) {
    safeCall(ui, 'toast', 'NOT YET // SHE STILL NEEDS THE MISSING PARTS', 'warn');
    return;
  }
  escaping = true;
  safeCall(ui, 'hideEscapeCta');
  safeCall(ui, 'hideLandingBrief');
  safeCall(ui, 'setJoinBusy', true);
  const { res, data, error } = await postJSON('/api/action', { token: authToken, type: 'escape' });
  if (error || !res || !res.ok || !data || !data.ok) {
    escaping = false;
    safeCall(ui, 'setJoinBusy', false);
    safeCall(ui, 'toast', (data && data.message) || 'THE BURN IS NOT READY YET', 'warn');
    safeAudio('error');
    return;
  }
  // Leave the old planet room immediately; the server has already routed this
  // token to the next planet, so old frames must not mutate our grid.
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
  }
  connected = false;
  safeCall(ui, 'setConnection', 'transit');
  const from = planetInfoFromState();
  const storyMs = narrator.playStory(data.story, { speaker: 'SHIP LOG' });
  const holdMs = (narrator.voiceEnabled || narrator.subtitlesEnabled) ? Math.max(0, storyMs - 5900 + 500) : 0;
  interlude.startEscape(
    {
      story: data.story,
      from: { name: from.planetName, depth: from.planetDepth },
      to: { name: data.planetName, depth: data.planetDepth },
      planetName: data.planetName,
      planetDepth: data.planetDepth,
      holdMs,
    },
    () => applyEscapeResult(data),
  );
}

function applyEscapeResult(data) {
  const nextState = data && data.state;
  if (!nextState) {
    escaping = false;
    safeCall(ui, 'setJoinBusy', false);
    return;
  }
  const tag = myPlayer ? myPlayer.tag : null;
  const found = Array.isArray(nextState.players)
    ? nextState.players.find((player) => player && player.tag === tag)
    : null;
  const player = data.player || found;
  if (player) myPlayer = { id: player.id, tag: player.tag, color: player.color };
  joined = true;
  escaping = false;
  resetSession();
  applySnapshot(nextState, data.leaves || []);
  cancelCameraInertia();
  camera.reset();
  updateZoomUi();
  safeCall(ui, 'setJoinBusy', false);
  safeCall(ui, 'setConnection', 'connected');
  connectEvents();
  const to = planetInfoFromState();
  safeCall(ui, 'toast', `LANDED ON ${to.planetName} // LEVELS ${to.planetDepth} // ${to.mission.name}`, 'good');
  safeAudio('join');
  const progress = refreshMission();
  startDistressTimer();
  chooseNavTarget();
  lastInteraction = now();
  // Put the new planet's required refit front and center.
  setTimeout(() => {
    if (joined && !escaping && !(interlude && interlude.active)) {
      safeCall(ui, 'showLandingBrief', progress, to);
    }
  }, 260);
}

async function confirmAction(options) {
  if (ui && typeof ui.confirm === 'function') {
    try {
      return await ui.confirm(options);
    } catch {
      return false;
    }
  }
  return typeof window !== 'undefined' ? window.confirm(`${options.title}\n\n${options.message}`) : false;
}

/** Leave the current run and return to the main/tag screen. */
async function abandonRun() {
  if (!joined || (interlude && interlude.active)) return;
  const ok = await confirmAction({
    title: 'ABANDON RUN?',
    message: 'Return to the main screen? Your pilot identity and planet progress are saved; you can resume with the same tag or enter a new one.',
    okLabel: 'RETURN TO MAIN',
    cancelLabel: 'KEEP PLAYING',
  });
  if (!ok) return;
  joined = false;
  escaping = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
  }
  connected = false;
  myPlayer = null;
  myIndex = -1;
  authToken = null;
  pendingAutoJoin = null;
  currentReport = null;
  finalDepthNotified.clear();
  resetSession();
  safeCall(ui, 'hideReport');
  safeCall(ui, 'setEscapeReady', false);
  safeCall(ui, 'hideEscapeCta');
  safeCall(ui, 'hideLandingBrief');
  navLabel = null;
  safeCall(renderer, 'setWaypoint', null);
  safeCall(ui, 'hideNavTarget');
  safeCall(ui, 'setConnection', 'connected');
  safeCall(renderer, 'setPlayers', [], null);
  cancelCameraInertia();
  camera.reset();
  updateZoomUi();
  safeCall(ui, 'showLanding', { leaderboard: (state && state.arcade) || [], liveCount: state ? onlineCount(state) : 0 });
  // Show planet 0's landing scene, not the abandoned planet.
  await reloadWorld();
  refreshPublicState();
  lastInteraction = now();
  safeCall(ui, 'toast', 'RUN ABANDONED // CHOOSE A TAG TO DEPLOY', 'info');
}

/** Clear this browser's saved pilots so a new tag starts a new mission. */
function startNewPilot() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TAG_KEY);
    localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* private mode */
  }
  const input = document.getElementById('tag-input');
  if (input) {
    input.value = '';
    try {
      input.focus();
    } catch {
      /* ignore */
    }
  }
  safeCall(ui, 'showJoinError', '');
  safeCall(ui, 'toast', 'NEW PILOT // ENTER A NEW GAME TAG TO START FROM PLANET 1', 'good');
}

/**
 * EVT-01/02/03: one SSE incident becomes ONE spoken announcement, one static
 * caption block, one overlay and one deferred crust reload.
 *
 * The announcement is built by the pure `buildIncidentAnnouncement` so the
 * spoken wording, the card and the captions cannot drift. The event's `revision`
 * makes the dedupe key stable across an SSE reconnect, and the dwell comes from
 * the announcement (1200 ms reduced motion / 2600 ms otherwise) so no path
 * reloads the crust before the reset snapshot has been applied.
 */
let incidentRevisionSeq = 0;
function handleIncidentEvent(msg) {
  if (!msg) return;
  const planet = typeof planetInfoFromState === 'function' ? planetInfoFromState() : {};
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const revision = Number.isFinite(msg.revision) ? msg.revision : (incidentRevisionSeq += 1);
  const announcement = buildIncidentAnnouncement(msg, { name: planet.planetName, planetIndex: planet.planetIndex }, { reducedMotion, revision });
  const shown = safeCall(ui, 'showIncidentFeedback', announcement);
  if (shown === false) return; // duplicate replay: one announcement per event
  setCaptainLogMessage(announcement.detail || announcement.spoken, 26000);
  if (interlude && !interlude.active) {
    interlude.incident(announcement.kind, announcement.title, msg.message, announcement.detail, {
      dwellMs: announcement.dwellMs,
    });
  }
  if (narrator) narrator.playCue(announcement.captionCueId, { speaker: 'SHIP AI' });
  setTimeout(async () => {
    await reloadWorld();
    refreshMission();
    cancelCameraInertia();
    camera.reset();
    updateZoomUi();
  }, announcement.dwellMs);
}

/**
 * Pick the best nearby place to mine: mineable land (geological deposit chance),
 * not my locked cell, not a depleted lowest-level cell. Higher chance wins;
 * cells in front of the camera get a small bonus. NAV opens/focuses this cell.
 */
function chooseNavTarget({ cycle = false } = {}) {
  if (!joined || !state || !leafList.length) {
    navLabel = null;
    safeCall(renderer, 'setWaypoint', null);
    safeCall(ui, 'hideNavTarget');
    return null;
  }
  const candidates = [];
  const maxD = maxDepth();
  for (const node of leafList) {
    if (!node) continue;
    if (node.depth >= maxD && node.resourceId) continue; // emptied max-level cell
    if (cellLockedForMe(node)) continue; // locked to me in contested play
    const terrain = world.terrainFor(node);
    if (!terrain || !terrain.biome || !terrain.biome.mineable) continue;
    const p = camera.project(node.centroid);
    if (!p) continue;
    const dx = (p.x - camera.width / 2) / Math.max(1, camera.width * 0.5);
    const dy = (p.y - camera.height / 2) / Math.max(1, camera.height * 0.5);
    const off = Math.min(1.6, Math.hypot(dx, dy));
    const front = p.z > 0 ? 1 : 0;
    const chance = Number(terrain.biome.depositChance) || 0;
    const score = chance * 2.4 + front * 0.32 - off * 0.5 + (node.clicks > 0 ? 0.08 : 0);
    candidates.push({ node, terrain, chance, score });
  }
  if (!candidates.length) {
    navLabel = null;
    safeCall(renderer, 'setWaypoint', null);
    safeCall(ui, 'hideNavTarget');
    return null;
  }
  candidates.sort((a, b) => b.score - a.score);
  let pick = candidates[0];
  if (cycle && navLabel) {
    const current = candidates.findIndex((c) => c.node.label === navLabel);
    if (current >= 0) pick = candidates[(current + 1) % candidates.length];
  }
  navLabel = pick.node.label;
  safeCall(renderer, 'setWaypoint', navLabel);
  safeCall(ui, 'setNavTarget', {
    label: navLabel,
    biomeName: pick.terrain.biome.name,
    chance: pick.chance,
  });
  return pick;
}

function refreshNavTarget() {
  if (!joined) {
    navLabel = null;
    safeCall(renderer, 'setWaypoint', null);
    safeCall(ui, 'hideNavTarget');
    return;
  }
  if (!navLabel || !world.get(navLabel)) chooseNavTarget();
  else safeCall(renderer, 'setWaypoint', navLabel);
}

function startIntroReplay() {
  if (!intro || intro.active) return;
  safeCall(ui, 'hideReport');
  intro.start({ replay: true });
}

function showSessionLost() {
  joined = false;
  myPlayer = null;
  authToken = null;
  hoveredLabel = null;
  renderer.setHover(null);
  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
  }
  safeCall(ui, 'showLanding', {
    leaderboard: (state && state.arcade) || [],
    liveCount: state ? onlineCount(state) : 0,
    world: state,
  });
  safeCall(ui, 'setConnection', 'offline');
  safeCall(ui, 'toast', 'UPLINK DROPPED — RE-ENTER YOUR CALLSIGN', 'warn');
  refreshPublicState();
}

/* ------------------------------------------------------------------ *
 * Clicking / breaking
 * ------------------------------------------------------------------ */

function optimisticClick(label) {
  const node = world.get(label);
  if (!node) return null;
  const prevOwner = node.ownerIndex;
  const kind = prevOwner === -1 ? 'claim' : prevOwner === myIndex ? 'reinforce' : 'steal';
  node.clicks += 1;
  if (kind !== 'reinforce' && myIndex >= 0) node.ownerIndex = myIndex;
  if (myIndex >= 0) node.lastClickIndex = myIndex;
  renderer.updateCell(label, node.ownerIndex, node.clicks, node.lastClickIndex);
  refreshPlanetRenderFaces();
  const color = myPlayer ? myPlayer.color : '#00f0ff';
  const info = faceInfo(label);
  renderer.pulse(label, {
    color,
    kind,
    text: kind === 'reinforce' ? '+2' : '',
  });
  if (kind === 'claim') safeAudio('claim');
  else if (kind === 'steal') safeAudio('steal');
  else safeAudio('tick');
  if (info) safeCall(ui, 'setHoverFace', info);
  return { node, kind };
}

function attemptClick(label) {
  if (!joined || !myPlayer) {
    safeCall(ui, 'toast', 'ENTER A CALLSIGN TO JACK IN', 'warn');
    return;
  }
  if (!label) return;
  const node = world.get(label);
  if (!node) {
    reloadWorld();
    return;
  }
  // CTL-03: exactly one predicate decides whether the server would accept now.
  const status = targetHarvestStatus(node);
  if (!status.can) {
    if (status.reason === 'own_lock') {
      maybeTip('tip-lock', { delay: 250 });
      const stampLock = now();
      if (stampLock - lastLockToastAt > 1200) {
        lastLockToastAt = stampLock;
        safeCall(ui, 'toast', 'CELL LOCKED // ANOTHER OPERATOR MUST CONTEST IT FIRST', 'warn');
        safeAudio('error');
      }
    } else if (status.reason === 'stale_leaf') {
      reloadWorld();
    }
    // `cooldown` is silent by design: the auto-harvest retries on the next tick.
    return;
  }
  const stamp = now();
  if (stamp - lastClickSentAt < 45) return;
  lastClickSentAt = stamp;
  lastClickAtClient = serverNow();

  const before = { ownerIndex: world.get(label).ownerIndex, clicks: world.get(label).clicks };
  optimisticClick(label);

  postJSON('/api/action', { token: authToken, type: 'click', label }).then(({ res, data }) => {
    if (!res || !res.ok || !data || !data.ok) {
      const err = data && data.error;
      if (err === 'NOT_A_LEAF') {
        reloadWorld();
      } else if (err === 'COOLDOWN') {
        const node = world.get(label);
        if (node) {
          node.ownerIndex = before.ownerIndex;
          node.clicks = before.clicks;
          renderer.updateCell(label, node.ownerIndex, node.clicks, node.lastClickIndex);
  refreshPlanetRenderFaces();
          if (hoveredLabel === label) safeCall(ui, 'setHoverFace', faceInfo(label));
        }
      } else if (err === 'NOT_JOINED') {
        showSessionLost();
      } else if (err === 'OWN_CELL_LOCKED') {
        const node = world.get(label);
        if (node) {
          node.ownerIndex = before.ownerIndex;
          node.clicks = before.clicks;
          if (myIndex >= 0) node.lastClickIndex = myIndex; // remember locally: no more optimistic pulses
          renderer.updateCell(label, node.ownerIndex, node.clicks, node.lastClickIndex);
  refreshPlanetRenderFaces();
          if (hoveredLabel === label) safeCall(ui, 'setHoverFace', faceInfo(label));
        }
        safeCall(ui, 'toast', 'CELL LOCKED // ANOTHER OPERATOR MUST CONTEST IT FIRST', 'warn');
        safeAudio('error');
      } else {
        const node = world.get(label);
        if (node) {
          node.ownerIndex = before.ownerIndex;
          node.clicks = before.clicks;
          renderer.updateCell(label, node.ownerIndex, node.clicks, node.lastClickIndex);
  refreshPlanetRenderFaces();
        }
        safeCall(ui, 'toast', (data && data.message) || 'GRID REJECTED THE CLICK', 'warn');
        safeAudio('error');
      }
      return;
    }
    // Reconcile with authoritative cell values.
    const cell = Array.isArray(data.cell) ? data.cell : null;
    if (cell) {
      const node = world.applyCell(cell[0], cell[1], cell[2], cell[4]);
      if (node) renderer.updateCell(node.label, node.ownerIndex, node.clicks, node.lastClickIndex);
    }
    if (data.resource) applyDiscoveredResource(data.cell ? data.cell[0] : label, data.resource, myPlayer.id);
    // RND-05/07: a successful authoritative click raises the local tool arm.
    if (surface && surface.active) safeCall(renderer, 'setSelfMine', Date.now());
    const kind = data.kind || 'claim';
    const points = Number(data.points) || 0;
    session.clicks += 1;
    session.score += points;
    session.depth = Math.max(session.depth, label.split('.').length - 1);
    if (kind === 'claim') session.claims += 1;
    if (kind === 'steal') session.steals += 1;

    if (data.broke) {
      // The break may already have arrived over SSE (order is not guaranteed),
      // so session accounting must not depend on us applying the tree change.
      session.breaks += 1;
      if (Array.isArray(data.children)) {
        const children = world.applyBreak(cell ? cell[0] : label, data.children);
        if (children) {
          refreshLeafList();
          refreshNavTarget();
          renderer.replaceFace(label, children);
          for (const child of children) renderer.pulse(child.label, { color: '#d7ff00', kind: 'break', text: '' });
          safeAudio('breakShatter');
          const depth = label.split('.').length - 1 + 1;
          safeCall(ui, 'toast', `CELL ${label} BROKE // DEPTH ${depth}`, 'good');
          if (hoveredLabel === label) {
            hoveredLabel = null;
            renderer.setHover(null);
            safeCall(ui, 'setHoverFace', null);
          }
        }
      }
    }
    const nodeAfter = world.get(data.cell ? data.cell[0] : label);
    if (
      nodeAfter &&
      !data.broke &&
      nodeAfter.depth >= maxDepth() &&
      nodeAfter.clicks >= threshold() &&
      !finalDepthNotified.has(nodeAfter.label)
    ) {
      finalDepthNotified.add(nodeAfter.label);
      safeCall(ui, 'toast', `FINAL DEPTH D${nodeAfter.depth} // THIS CELL CANNOT BREAK FURTHER`, 'warn');
    }
    if (hoveredLabel) safeCall(ui, 'setHoverFace', faceInfo(hoveredLabel));
    if (state) {
      // Keep the HUD score snappy; periodic state confirms.
      const me = playerAt(myIndex);
      if (me) me.score = (me.score || 0) + points;
      safeCall(ui, 'updateHud', state, myPlayer.id, {
        zoom: camera.zoom,
        hoverFace: hoveredLabel ? faceInfo(hoveredLabel) : null,
      });
    }
  });
}

async function reloadWorld() {
  const query = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
  const { res, data } = await fetchJSON(`/api/world${query}`, { cache: 'no-store' });
  if (!res || !res.ok || !data || !data.ok) return;
  applySnapshot(data.state, data.leaves);
}

/* ------------------------------------------------------------------ *
 * Report / share
 * ------------------------------------------------------------------ */

function buildResult() {
  const me = myPlayerState();
  const players = (state && state.players) || [];
  const myScore = me ? me.score || 0 : 0;
  const rank = 1 + players.filter((p) => (p.score || 0) > myScore).length;
  const base = {
    mode: 'infinite',
    tag: myPlayer ? myPlayer.tag : 'OPERATOR',
    color: myPlayer ? myPlayer.color : '#00f0ff',
    score: myScore,
    sessionScore: session.score,
    rank,
    totalPlayers: players.length,
    clicks: session.clicks,
    breaks: session.breaks,
    claims: session.claims,
    steals: session.steals,
    facesHeld: me ? me.facesHeld || 0 : 0,
    depth: Math.max(session.depth, myIndex >= 0 ? world.deepestOwnedDepth(myIndex) : 0),
    ores: session.ores,
    oreValue: session.oreValue,
    bestFind: session.bestFind,
    maxDepth: maxDepth(),
    startedAt: session.startedAt,
    durationMs: Date.now() - session.startedAt,
    createdAt: Date.now(),
  };
  const payload = { ...base };
  const shareUrl = `${location.origin}${location.pathname}?report=${base64UrlEncode(JSON.stringify(payload))}`;
  return { ...base, shareUrl };
}

function openReport() {
  if (!joined || !state) {
    safeCall(ui, 'toast', 'JACK IN FIRST', 'warn');
    return;
  }
  const result = buildResult();
  currentReport = result;
  safeCall(ui, 'showReport', result, {
    leaderboard: state.arcade || [],
    shareUrl: result.shareUrl,
    title: 'SESSION REPORT',
  });
  safeAudio('roundEnd');
  renderReportPreview(result);
}

function showSharedReport(encoded) {
  try {
    const result = JSON.parse(base64UrlDecode(encoded));
    if (!result || typeof result !== 'object') return;
    safeCall(ui, 'showLanding', { leaderboard: [], liveCount: 0, world: null });
    safeCall(ui, 'showReport', result, { leaderboard: [], shareUrl: null, title: 'SHARED REPORT' });
    renderReportPreview(result);
  } catch {
    safeCall(ui, 'toast', 'INVALID REPORT LINK', 'bad');
  }
}

function renderReportPreview(result) {
  requestAnimationFrame(() => {
    const preview = document.getElementById('report-card-preview');
    if (preview && typeof preview.getContext === 'function') {
      try {
        renderResultCard(preview, result);
      } catch (err) {
        console.warn('[icosa] report preview failed', err);
      }
    }
  });
}

async function downloadReport() {
  const result = currentReport || buildResult();
  try {
    await downloadResultCard(result);
    safeCall(ui, 'toast', 'REPORT CARD EXPORTED // PNG', 'good');
    safeAudio('tick');
  } catch {
    safeCall(ui, 'toast', 'EXPORT FAILED', 'bad');
  }
}

function fallbackCopy(text) {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(area);
    return !!ok;
  } catch {
    return false;
  }
}

async function shareReport() {
  const result = currentReport || buildResult();
  const url = result.shareUrl;
  safeAudio('tick');
  if (navigator.share) {
    try {
      await navigator.share({ title: 'NARIMATO — session report', text: buildShareText(result, url), url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = false;
    }
  }
  if (!copied) copied = fallbackCopy(url);
  safeCall(ui, 'toast', copied ? 'REPORT LINK COPIED' : url, copied ? 'good' : 'info');
}

/* ------------------------------------------------------------------ *
 * Camera / input
 * ------------------------------------------------------------------ */

function applyHover(label) {
  if (label === hoveredLabel) return;
  hoveredLabel = label;
  renderer.setHover(label);
  safeCall(ui, 'setHoverFace', label ? faceInfo(label) : null);
  canvas.style.cursor = label ? 'crosshair' : 'grab';
}

function refreshHoverFromPointer() {
  if (!lastMouse || (pointerRouter && pointerRouter.activeCount() > 0)) return;
  const rect = canvas.getBoundingClientRect();
  applyHover(pickFace({ faces: leafList }, camera, lastMouse.x - rect.left, lastMouse.y - rect.top));
}

function updateZoomUi() {
  // Approximate visible depth from zoom (avoids picking the whole leaf set 4×/s).
  const depth = clamp(Math.round(Math.log2(Math.max(1, camera.zoom))), 0, Math.max(maxDepth(), SURFACE_ENTER_LEVEL));
  safeCall(ui, 'setZoom', camera.zoom, depth);
}

/** Cubic-bezier(0.16, 1, 0.3, 1): fast start, long soft landing. */
function bezierEase(t) {
  const x = clamp(t, 0, 1);
  const bx = (u) => 3 * (1 - u) ** 2 * u * 0.16 + 3 * (1 - u) * u ** 2 * 0.3 + u ** 3;
  const by = (u) => 3 * (1 - u) ** 2 * u * 1 + 3 * (1 - u) * u ** 2 * 1 + u ** 3;
  let lo = 0;
  let hi = 1;
  let u = x;
  for (let i = 0; i < 10; i += 1) {
    const sample = bx(u);
    if (Math.abs(sample - x) < 1e-5) break;
    if (sample < x) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
  }
  return by(u);
}

function maxZoomLevel() {
  return Math.max(0, Math.min(12, maxDepth()));
}

/** Surface landing happens after the fourth zoom rung (D0..D3), not maxDepth. */
function maxOrbitZoomLevel() {
  return Math.max(maxZoomLevel(), SURFACE_ENTER_LEVEL);
}

/** Ladder wrappers: the constants and maths live in shared/zoom-levels.js (CTL-04). */
function zoomLevelForZoom(value) {
  return zoomLevelFromLadder(value, maxOrbitZoomLevel());
}

function startZoom(target, duration = 260) {
  const to = clamp(Number(target) || 1, 0.4, MAX_ZOOM);
  zoomTarget = to;
  zoomAnim = {
    from: camera.zoom,
    to,
    start: performance.now(),
    duration: Math.max(100, Math.min(900, Number(duration) || 260)),
  };
}

function cancelZoom() {
  zoomAnim = null;
  zoomTarget = null;
}

function snapZoomToLevel() {
  const current = zoomTarget === null ? camera.zoom : zoomTarget;
  const level = zoomLevelForZoom(current);
  if (Math.abs(current - zoomForLevel(level)) > 0.0001) startZoom(zoomForLevel(level), 200);
}

function zoomByNotch(direction, magnitude = 1) {
  const current = zoomTarget === null ? camera.zoom : zoomTarget;
  // SINGLE CAMERA: on the surface the same camera keeps dollying in/out; it does
  // not swap to a second projection. Scrolling back out past the entry rung
  // returns to orbit through the normal exit policy.
  if (view === 'surface') {
    // Approved model: wheel changes the carrier radius, focal stays fixed.
    if (direction > 0) {
      surfaceCamera.dolly(0.88);
    } else if (surfaceCamera.distance >= surfaceCamera.maxDistance - 1e-3) {
      requestExitSurface();
      return;
    } else {
      surfaceCamera.dolly(1.14);
    }
    lastInteraction = now();
    return;
  }
  const level = zoomLevelForZoom(current);
  if (direction > 0 && level >= SURFACE_ENTER_LEVEL) {
    enterSurfaceMode();
    return;
  }
  const next = clamp(level + (direction > 0 ? 1 : -1), 0, maxOrbitZoomLevel());
  startZoom(zoomForLevel(next), 240 + 40 * clamp(magnitude, 0, 2));
  lastInteraction = now();
  hoverNeedsRefresh = true;
}

function zoomLevelsPerNotch() {
  const d = clamp(Math.log2(Math.max(1, camera.zoom)), 0, Math.max(1, maxDepth()));
  // Finer steps as you go deeper: ~13% at the coarse sphere, ~2.5% at depth 16+.
  return 0.2 / (1 + d * 0.3);
}

function cancelCameraInertia() {
  spinVel.x = 0;
  spinVel.y = 0;
  cancelZoom();
}

function updateCameraInertia(dt) {
  if (dt <= 0) return;
  const dtSec = dt / 1000;
  if (zoomAnim) {
    const t = clamp((performance.now() - zoomAnim.start) / zoomAnim.duration, 0, 1);
    const e = bezierEase(t);
    camera.zoom = zoomAnim.from * (zoomAnim.to / zoomAnim.from) ** e;
    if (t >= 1) {
      camera.zoom = zoomAnim.to;
      zoomAnim = null;
      zoomTarget = null;
    }
    updateZoomUi();
    hoverNeedsRefresh = true;
  } else if (zoomTarget !== null) {
    const k = 1 - Math.exp(-8 * dtSec);
    camera.zoom += (zoomTarget - camera.zoom) * k;
    if (Math.abs(Math.log(zoomTarget / Math.max(1e-9, camera.zoom))) < 0.0007) {
      camera.zoom = zoomTarget;
      zoomTarget = null;
    }
    updateZoomUi();
    hoverNeedsRefresh = true;
  }
  if (Math.abs(spinVel.x) > 0.0004 || Math.abs(spinVel.y) > 0.0004) {
    // camera.rotate(dx,dy) = +dx*0.006 rad yaw, +dy*0.006 rad pitch.
    camera.rotate((spinVel.x / 0.006) * dtSec, (spinVel.y / 0.006) * dtSec);
    const decay = Math.exp(-2.15 * dtSec);
    spinVel.x *= decay;
    spinVel.y *= decay;
    if (Math.abs(spinVel.x) < 0.0003 && Math.abs(spinVel.y) < 0.0003) {
      spinVel.x = 0;
      spinVel.y = 0;
      hoverNeedsRefresh = true;
    }
    // Keep hovered labels from freezing while the planet coasts.
    if (!zoomUiPending) {
      zoomUiPending = true;
      setTimeout(() => {
        zoomUiPending = false;
        hoverNeedsRefresh = true;
      }, 90);
    }
  }
}

function rotationScale() {
  // Drag-to-pan should move the sphere surface with the cursor at any zoom.
  // Screen radius is min(w,h)*0.4*zoom, and camera.rotate() uses 0.006 rad/px,
  // so ~0.45/zoom makes a 100px drag move the surface ~100px.
  return clamp(0.45 / Math.max(1, camera.zoom), 0.00002, 1);
}

function initSequence() {
  safeCall(ui, 'hideReport');
}

function bindCanvasInput() {
  if (!canvas) return;
  // CTL-06: the router owns roles, capture and cancellation for every pointer.
  canvas.setAttribute('data-pointer-role', 'orbit-drag');

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const pickAt = (x, y) => pickFace({ faces: leafList }, camera, x, y);

  function setHover(label) {
    applyHover(label);
  }

  const scheduleHover = (event) => {
    lastMouse = { x: event.clientX, y: event.clientY };
    if (hoverRaf) return;
    hoverRaf = true;
    requestAnimationFrame(() => {
      hoverRaf = false;
      if (!lastMouse || (pointerRouter && pointerRouter.activeCount() > 0)) return;
      const p = localPoint({ clientX: lastMouse.x, clientY: lastMouse.y });
      setHover(pickAt(p.x, p.y));
    });
  };

  canvas.addEventListener('pointermove', scheduleHover);
  canvas.addEventListener('pointerleave', () => {
    if (!pointerRouter || pointerRouter.activeCount() === 0) setHover(null);
  });

  const router = createPointerRouter({
    canvas,
    capture: (element, pointerId) => capturePointer(element, pointerId),
    release: (element, pointerId) => releasePointer(element, pointerId),
    onIntent: (intent) => {
      try {
        handlePointerIntent(intent);
      } catch (err) {
        console.error('[icosa] pointer intent failed', err);
      }
    },
  });
  pointerRouter = router;
  const attached = attachPointerRouter(canvas, { router });
  detachPointerRouter = attached.detach;
  detachPointerEnvironment = watchPointerEnvironment(router, { win: window, doc: document });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cancelFocus();
      zoomByNotch(event.deltaY < 0 ? 1 : -1, Math.abs(event.deltaY) / 100);
    },
    { passive: false }
  );

  canvas.addEventListener('dblclick', (event) => {
    const rect = canvas.getBoundingClientRect();
    const label = pickAt(event.clientX - rect.left, event.clientY - rect.top);
    if (label) focusFace(label);
  });
}

/* ------------------------------------------------------------------ *
 * Pointer intents (CTL-01 absolute drag, CTL-06 pinch/router)
 * ------------------------------------------------------------------ */

let pinchBaseZoom = 0;
let pinchBaseDistance = 0;
let pinchAccum = 1;

function pointerLocal(intent) {
  const rect = canvas.getBoundingClientRect();
  return { x: Number(intent.x) - rect.left, y: Number(intent.y) - rect.top };
}

function handlePointerIntent(intent) {
  if (!intent || !intent.kind) return;
  if (intent.kind === 'orbit-drag') {
    if (view === 'surface') {
      const p = pointerLocal(intent);
      if (intent.phase === 'start') {
        safeAudio('unlock');
        surfaceCamera.beginDrag(p.x, p.y);
        canvas.style.cursor = 'grabbing';
      } else if (intent.phase === 'move') {
        surfaceCamera.dragTo(p.x, p.y);
        lastInteraction = now();
      } else {
        surfaceCamera.endDrag();
        canvas.style.cursor = 'grab';
        hoverNeedsRefresh = true;
      }
      return;
    }
    if (intent.phase === 'start') {
      safeAudio('unlock');
      initSequence();
      cancelFocus();
      spinVel.x = 0;
      spinVel.y = 0;
      zoomTarget = null;
      lastInteraction = now();
      applyHover(null);
      const p = pointerLocal(intent);
      activePointerDrag = beginSurfaceDrag(camera, p.x, p.y, camera.width || window.innerWidth, camera.height || window.innerHeight);
      if (activePointerDrag) activePointerDrag.mode = dragMode;
      canvas.style.cursor = 'grabbing';
    } else if (intent.phase === 'move') {
      if (!activePointerDrag) return;
      const p = pointerLocal(intent);
      dragSurfaceTo(camera, activePointerDrag, p.x, p.y);
      activePointerDrag.mode = dragMode;
      spinVel.x = 0;
      spinVel.y = 0;
      lastInteraction = now();
    } else {
      activePointerDrag = null;
      spinVel.x = 0;
      spinVel.y = 0;
      canvas.style.cursor = 'grab';
      hoverNeedsRefresh = true;
    }
    return;
  }
  if (intent.kind === 'tap') {
    const p = pointerLocal(intent);
    const label = pickFace({ faces: leafList }, view === 'surface' ? surfaceCamera : camera, p.x, p.y);
    if (label) attemptClick(label);
    return;
  }
  if (intent.kind === 'pinch') {
    if (intent.phase === 'start') {
      pinchBaseZoom = zoomTarget === null ? camera.zoom : zoomTarget;
      pinchBaseDistance = surfaceCamera.distance;
      pinchAccum = 1;
      return;
    }
    if (intent.phase === 'move') {
      const scale = Number(intent.scale) || 1;
      pinchAccum *= scale;
      if (view === 'surface') {
        surfaceCamera.setDistance(pinchBaseDistance / Math.max(0.01, pinchAccum));
        return;
      }
      if (zoomLevelForZoom(pinchBaseZoom) >= SURFACE_ENTER_LEVEL) {
        if (pinchAccum > 1.25) {
          enterSurfaceMode();
          return;
        }
        startZoom(clamp(pinchBaseZoom * pinchAccum, zoomForLevel(SURFACE_ENTER_LEVEL), MAX_ZOOM), 90);
        return;
      }
      startZoom(clamp(pinchBaseZoom * pinchAccum, ORBIT_FAR_ZOOM, MAX_ZOOM), 90);
      return;
    }
    snapZoomToLevel();
    return;
  }
  if (intent.kind === 'cancel-all') {
    activePointerDrag = null;
    pinchBaseZoom = 0;
    pinchAccum = 1;
    cancelZoom();
    spinVel.x = 0;
    spinVel.y = 0;
    canvas.style.cursor = 'grab';
    return;
  }
}

/**
 * CTL-01 arrow travel: carrier movement on the concentric sphere with a
 * parallel-transported up. No Euler yaw/pitch is assigned here, so travel never
 * reverses across a pole; Shift scales the angular rate by SHIFT_BOOST.
 */
function updateKeyboardNavigation(dt) {
  if (!dt || (intro && intro.active) || (interlude && interlude.active)) return;
  const dtSec = dt / 1000;
  const hasInput = navKeys.has('ArrowLeft') || navKeys.has('ArrowRight') || navKeys.has('ArrowUp') || navKeys.has('ArrowDown');
  if (!hasInput) return;
  lastInteraction = now();
  spinVel.x = 0;
  spinVel.y = 0;
  applyArrowTravelFrame(camera, navKeys, dtSec, navKeys.has('Shift'));
}

let lastSurfacePoseSent = 0;
function refreshSurfaceLiveFaces() {
  refreshPlanetRenderFaces();
}

function sendSurfacePose(pose) {
  if (!joined || !authToken || !pose || !pose.pos) return;
  const stamp = now();
  if (stamp - lastSurfacePoseSent < 90) return;
  lastSurfacePoseSent = stamp;
  postJSON('/api/action', {
    token: authToken,
    type: 'surface',
    pos: pose.pos,
    heading: pose.heading,
    moving: !!pose.moving,
  }).catch(() => {});
}

function sendSurfaceLeave() {
  if (!authToken) return;
  postJSON('/api/action', { token: authToken, type: 'surface_leave' }).catch(() => {});
}

function handleSurfaceEvent(msg) {
  if (!msg || !msg.playerId) return;
  if (msg.type === 'surface_leave') {
    surfacePeers.delete(msg.playerId);
    safeCall(renderer, 'removePeer', msg.playerId, Date.now());
    return;
  }
  if (myPlayer && msg.playerId === myPlayer.id) return;
  const pos = msg.pos;
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
  surfacePeers.set(msg.playerId, {
    playerId: msg.playerId,
    tag: String(msg.tag || 'PILOT').slice(0, 12),
    color: typeof msg.color === 'string' ? msg.color : '#a78bfa',
    pos: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) },
    // Vector heading from SRV-01 plus the authoritative leaf the server resolved
    // for the pose (TST-01 compares peer tags and leaves).
    headingVec: msg.heading && Number.isFinite(msg.heading.x) ? { ...msg.heading } : null,
    heading: Number(msg.heading) || 0,
    leaf: typeof msg.leaf === 'string' ? msg.leaf : null,
    state: typeof msg.state === 'string' ? msg.state : null,
    moving: !!msg.moving,
    updatedAt: Number.isFinite(msg.updatedAt) ? msg.updatedAt : Date.now(),
  });
  syncSurfacePeerVisuals();
}

/**
 * RND-07: forward the authoritative peer list (live `surface` frames plus the
 * last known pose on `state.players`) into the renderer. The renderer owns
 * interpolation, fading and mining pose; app.js keeps no visual state.
 */
function syncSurfacePeerVisuals() {
  if (!renderer) return 0;
  const now = Date.now();
  const peers = [...surfacePeers.values()]
    .filter((peer) => now - (peer.updatedAt || 0) < 5000)
    .map((peer) => ({
      playerId: peer.playerId,
      tag: peer.tag,
      color: peer.color,
      surface: {
        pos: peer.pos,
        heading: peer.headingVec || null,
        state: peer.moving ? 'walk' : 'idle',
        moving: !!peer.moving,
        updatedAt: peer.updatedAt,
      },
    }));
  const ids = new Set(peers.map((peer) => peer.playerId));
  for (const player of (state && Array.isArray(state.players) ? state.players : [])) {
    if (!player || !player.online || !player.surface || ids.has(player.id)) continue;
    if (myPlayer && player.id === myPlayer.id) continue;
    peers.push({ playerId: player.id, tag: player.tag, color: player.color, surface: player.surface });
  }
  return safeCall(renderer, 'setPeers', peers, now) || 0;
}

/**
 * RND-07: forward discovered resource ids (never hidden deposits) as surface
 * pins. Only leaves that already carry a `resourceId` from the wire qualify.
 */
function syncSurfaceResourcePins() {
  if (!renderer || view !== 'surface') return 0;
  const pins = [];
  for (const node of leafList) {
    if (!node || !node.label || !node.resourceId) continue;
    pins.push({ label: node.label, resourceId: node.resourceId });
  }
  return safeCall(renderer, 'setResourcePins', pins) || 0;
}

function enterSurfaceMode() {
  if (!joined || !surface || surface.active || view === 'surface') return;
  if (interlude && interlude.active) return;
  if (exitingSurface) return;
  if (intro && intro.active) intro.skip();
  cancelFocus();
  cancelZoom();
  narrator.stop();
  if (firstGuideTimer) {
    clearTimeout(firstGuideTimer);
    firstGuideTimer = 0;
  }
  safeCall(ui, 'hideGuide');
  safeCall(ui, 'hideManual');
  safeCall(ui, 'hideLandingBrief');
  loadHumanoidRig();
  // CTL-04 supersedes RND-02's exact-restore policy: every exit returns to the
  // farthest orbit, so no pre-entry camera pose is stored.
  const planet = planetInfoFromState();
  if (!surface.start({ planetName: planet.planetName, seed: planet.planetSeed, depth: planet.planetDepth })) {
    return;
  }
  view = 'surface';
  surfaceExitState = null;
  // CTL-04: one history entry marks the surface so browser/mobile back exits
  // the game mode instead of leaving the page.
  try {
    if (typeof history !== 'undefined' && typeof history.pushState === 'function') {
      history.pushState({ surface: true }, '', location.href);
      surfaceHistoryPushed = true;
    }
  } catch {
    surfaceHistoryPushed = false;
  }
  renderer.setSurfaceMode({ active: true, entities: [], phase: surface.phase, progress: surface.progress() });
  surfaceCamera.reset();
  surfaceCamera.setDistance(SURFACE_CARRIER_DISTANCE);
  const startPose = surface.pose();
  if (startPose && startPose.pos) surfaceCamera.setPose(startPose.pos, startPose.forward);
  syncSurfacePeerVisuals();
  syncSurfaceResourcePins();
  safeCall(ui, 'enterSurface', { planet });
  refreshSurfaceLiveFaces();
  applySupplyFocus();
  applyControlModeUi(true);
  safeAudio('introWhoosh');
}

/**
 * CTL-04: every exit path (RETURN TO ORBIT, Escape, popstate/mobile back) funnels
 * here. Single-flight: a repeat call changes nothing and returns false.
 */
function requestExitSurface() {
  if (exitingSurface) return false;
  if (view !== 'surface' && !(surface && surface.active)) return false;
  exitingSurface = true;
  if (surface && surface.active) {
    // The controller runs its fly-out, then calls onExit -> finishSurfaceExit().
    surface.stop();
    return true;
  }
  finishSurfaceExit();
  return true;
}

/** Legacy alias: the surface controller calls this through `onExit`. */
function exitSurfaceMode() {
  return finishSurfaceExit();
}

/** Apply the deterministic exit state, then propagate it to the acceptance hook. */
function finishSurfaceExit() {
  if (view !== 'surface') {
    exitingSurface = false;
    return surfaceExitState;
  }
  view = 'orbit';
  renderer.setSurfaceMode({ active: false });
  safeCall(renderer, 'clearSurfaceVisuals');
  syncRenderFaces();
  sendSurfaceLeave();
  cancelFocus();
  cancelZoom();
  // CTL-04: farthest orbit through the one exported exit policy.
  const zoom = applyOrbitFarZoom(camera);
  updateZoomUi();
  renderer.resetEmptyFrames && renderer.resetEmptyFrames();
  applyControlModeUi(true);
  safeCall(ui, 'exitSurface');
  safeCall(ui, 'toast', 'ORBIT VIEW // MAXIMUM ZOOM OUT', 'info');
  const overlayRemoved = typeof document === 'undefined' || !document.getElementById('surface-overlay');
  const hudVisible = typeof document === 'undefined'
    || !document.getElementById('hud')
    || document.getElementById('hud').getAttribute('aria-hidden') !== 'true';
  const focusTarget = safeCall(ui, 'focusOrbitControl') || null;
  const overlay = typeof document !== 'undefined' ? document.getElementById('surface-overlay') : null;
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  if (typeof document !== 'undefined' && document.body) document.body.classList.remove('is-surface');
  surfaceExitState = {
    zoom: camera.zoom,
    overlayRemoved: overlayRemoved && !overlay,
    hudVisible: !!hudVisible,
    focusTarget,
    historyDepth: surfaceHistoryPushed ? 1 : 0,
  };
  // Consume the pushed history entry so a second back gesture cannot exit twice.
  if (surfaceHistoryPushed) {
    surfaceHistoryPushed = false;
    surfaceExitState.historyDepth = 0;
    try {
      // Only consume an entry that is still ours; a popstate-driven exit has
      // already restored the pre-surface depth.
      if (typeof history !== 'undefined'
        && history.state && history.state.surface === true
        && typeof history.back === 'function') {
        history.back();
      }
    } catch {
      /* history is advisory */
    }
  }
  exitingSurface = false;
  return surfaceExitState;
}

/* ------------------------------------------------------------------ *
 * Control mode (CTL-05)
 * ------------------------------------------------------------------ */

let lastControlMode = null;

function controlModeState() {
  return deriveControlMode({
    joined,
    surfaceActive: view === 'surface' || !!(surface && surface.active),
    surfacePhase: surface ? surface.phase : 'idle',
  });
}

/** Pure derivation -> one HUD render + one polite announcement per transition. */
function applyControlModeUi(force = false) {
  const mode = controlModeState();
  const announce = force === true ? lastControlMode !== null && mode !== lastControlMode : mode !== lastControlMode;
  lastControlMode = mode;
  safeCall(ui, 'setControlMode', {
    mode,
    label: controlModeLabel(mode),
    dragInvert: dragMode === 'reverse',
    dragLabel: controlDragLabel(dragMode === 'reverse'),
    actionLabel: controlActionLabel(mode),
    canToggle: canToggle(mode) && !exitingSurface,
    reason: actionReason(mode),
    announce,
    sentence: modeSentence(mode, dragMode === 'reverse'),
  });
  return mode;
}

/** `I`, the drag toggle and the acceptance hook all share this transition. */
function setDragMode(next, { persist = true } = {}) {
  const mode = normalizeMode(next);
  if (mode === dragMode) return dragMode;
  dragMode = mode;
  controlPrefs = prefsWithMode(controlPrefs, mode);
  const saved = persist ? writePrefs(readControlStorage(), controlPrefs) : false;
  safeCall(ui, 'setControlMode', {
    mode: controlModeState(),
    label: controlModeLabel(controlModeState()),
    dragInvert: dragMode === 'reverse',
    dragLabel: controlDragLabel(dragMode === 'reverse'),
    actionLabel: controlActionLabel(controlModeState()),
    canToggle: canToggle(controlModeState()) && !exitingSurface,
    reason: actionReason(controlModeState()),
    announce: true,
    sentence: modeSentence(controlModeState(), dragMode === 'reverse'),
    persistFailed: !saved && !!readControlStorage(),
  });
  if (activePointerDrag) activePointerDrag.mode = dragMode; // applies to the next gesture
  return dragMode;
}

function toggleDragMode() {
  return setDragMode(toggleOrbitMode(dragMode));
}

function toggleSurfaceFromControl() {
  const mode = controlModeState();
  if (!canToggle(mode) || exitingSurface) return false;
  if (mode === 'surface') return requestExitSurface();
  enterSurfaceMode();
  return true;
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (surface && surface.active) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        navKeys.add(event.key);
        lastInteraction = now();
        break;
      case 'Shift':
        navKeys.add('Shift');
        break;
      case '+':
      case '=':
        zoomByNotch(1);
        break;
      case '-':
      case '_':
        zoomByNotch(-1);
        break;
      case 'r':
      case 'R':
        cancelCameraInertia();
        camera.reset();
        updateZoomUi();
        break;
      case 'l':
      case 'L': {
        const visible = !renderer.labelsVisible;
        safeCall(renderer, 'setLabelsVisible', visible);
        safeCall(ui, 'toast', visible ? 'FACE IDS ON' : 'FACE IDS OFF', 'info');
        break;
      }
      case 'i':
      case 'I':
        toggleDragMode();
        break;
      default:
        return;
    }
    event.preventDefault();
  }, { capture: true });
  window.addEventListener('keyup', (event) => {
    navKeys.delete(event.key);
    if (event.key === 'Shift') navKeys.delete('Shift');
  }, { capture: true });
  window.addEventListener('blur', () => navKeys.clear());
  navKeys.clear();
}

/**
 * CTL-05: HUD controls + CTL-04 history entry. One listener set for the two
 * visible mode actions; nothing here writes DOM directly (ui.js renders).
 */
function bindControlModeUi() {
  if (typeof window === 'undefined') return;
  window.addEventListener('popstate', () => {
    // Browser/mobile back consumes the surface entry: leave the surface, never
    // the page. A back gesture outside surface mode is left to the browser.
    if (view === 'surface' || (surface && surface.active)) {
      // The browser already consumed the pushed entry; finish must not go back
      // again or it would leave the game.
      surfaceHistoryPushed = false;
      requestExitSurface();
    }
  });
  const prefs = readControlStorage();
  if (prefs) {
    try {
      // Private-mode storage failure keeps the session value; the HUD says so.
      writePrefs(prefs, controlPrefs);
    } catch {
      /* ignore */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Harvest truth (CTL-03)
 * ------------------------------------------------------------------ */

/** Best estimate of the server clock from the last state frame. */
function serverNow() {
  if (!serverClock.local) return Date.now();
  return serverClock.server + (performance.now() - serverClock.local);
}

/**
 * One context for the predicate: viewer index, server clock, the pilot's own
 * last click, the server's cooldown and the leaf epoch.
 */
function harvestContext() {
  const cooldown = serverSelf && Number.isFinite(serverSelf.clickCooldownMs)
    ? Math.max(0, serverSelf.clickCooldownMs)
    : 0;
  return {
    myIndex,
    maxDepth: maxDepth(),
    serverTimeMs: serverNow(),
    lastClickAtMs: lastClickAtClient,
    clickCooldownMs: cooldown,
    leafEpoch,
  };
}

/** The chip/queue/highlight single source of truth. */
function targetHarvestStatus(node) {
  return harvestStatus(node, { index: myIndex }, harvestContext());
}

/** Stamp freshly materialized leaves with the leaf epoch. */
function stampLeafEpoch() {
  for (const node of leafList) node.leafEpoch = leafEpoch;
  return leafList;
}

/* ------------------------------------------------------------------ *
 * Focus / deep zoom
 * ------------------------------------------------------------------ */

function cancelFocus() {
  focusAnim = null;
  cancelZoom();
}

function focusFace(label) {
  const node = world.get(label);
  if (!node) return;
  cancelZoom();
  const c = node.centroid;
  let targetYaw = Math.atan2(-c.x, c.z);
  const horizontal = Math.hypot(c.x, c.z);
  const targetPitch = Math.atan2(c.y, horizontal);

  // Face angular size (largest edge).
  const angle = (p, q) => Math.acos(clamp(p.x * q.x + p.y * q.y + p.z * q.z, -1, 1));
  const edge = Math.max(angle(node.a, node.b), angle(node.b, node.c), angle(node.c, node.a));
  let targetZoom = clamp(0.75 / Math.tan(Math.min(1.45, edge) / 2), 0.8, MAX_ZOOM);

  const projected = camera.project(c);
  const dx = projected.x - camera.width / 2;
  const dy = projected.y - camera.height / 2;
  const centered = Math.hypot(dx, dy) < Math.min(camera.width, camera.height) * 0.08;
  if (centered && camera.zoom > targetZoom * 0.55) {
    targetZoom = clamp(camera.zoom * 2.4, targetZoom, MAX_ZOOM);
    targetYaw = camera.yaw;
    // Keep the current pitch/yaw when drilling into the already-centred face.
    focusAnim = {
      start: now(),
      duration: 380,
      fromYaw: camera.yaw,
      toYaw: camera.yaw,
      fromPitch: camera.pitch,
      toPitch: camera.pitch,
      fromZoom: camera.zoom,
      toZoom: targetZoom,
    };
  } else {
    let dYaw = targetYaw - camera.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    focusAnim = {
      start: now(),
      duration: 420,
      fromYaw: camera.yaw,
      toYaw: camera.yaw + dYaw,
      fromPitch: camera.pitch,
      toPitch: targetPitch,
      fromZoom: camera.zoom,
      toZoom: targetZoom,
    };
  }
  lastInteraction = now();
}

function updateFocus(nowMs) {
  if (!focusAnim) return;
  const t = clamp((nowMs - focusAnim.start) / focusAnim.duration, 0, 1);
  const e = bezierEase(t);
  camera.yaw = focusAnim.fromYaw + (focusAnim.toYaw - focusAnim.fromYaw) * e;
  camera.pitch = focusAnim.fromPitch + (focusAnim.toPitch - focusAnim.fromPitch) * e;
  camera.zoom = focusAnim.fromZoom * (focusAnim.toZoom / focusAnim.fromZoom) ** e;
  if (t >= 1) {
    focusAnim = null;
    hoverNeedsRefresh = true;
  }
  updateZoomUi();
}

/* ------------------------------------------------------------------ *
 * Render loop
 * ------------------------------------------------------------------ */

let lastFrame = performance.now();
let zoomUiAt = 0;
let pendingInputAt = 0;
let lastPerfTelemetryAt = 0;

/** Update the PERF-01 beacon fields at most once a second. */
function syncPerfTelemetry(t) {
  if (t - lastPerfTelemetryAt < 1000) return;
  lastPerfTelemetryAt = t;
  const perf = renderer.perfTelemetry();
  if (perf) telemetry?.recordPerf(perf);
}

/**
 * PERF-01 interaction latency: the first trusted pointer/key/wheel event sets
 * a timestamp, and the next rendered frame records input-to-frame time. The
 * listener is capture-phase and passive, so it never changes input behaviour.
 */
function installPerfInputProbe() {
  if (typeof window === 'undefined') return;
  const mark = (event) => {
    if (!event || event.isTrusted === false) return;
    pendingInputAt = Number.isFinite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : now();
  };
  for (const type of ['pointerdown', 'keydown', 'wheel']) {
    window.addEventListener(type, mark, { capture: true, passive: true });
  }
}

function frame(t) {
  const dt = Math.min(64, Math.max(0, t - lastFrame));
  lastFrame = t;
  if (pendingInputAt) {
    renderer.recordInteraction(Math.max(0, t - pendingInputAt));
    pendingInputAt = 0;
  }

  // QA measurement pause (RND-06 frame budget): schedule RAF but draw nothing,
  // so the acceptance harness can time renderer frames in isolation.
  if (window.__ICOSA_RENDER_PAUSED__) {
    requestAnimationFrame(frame);
    return;
  }

  // EVT-02/EVT-03: while the full-screen incident overlay is open it owns the
  // visible frame. Keep this loop alive (state stays consistent) but do not
  // compete with the FX canvas for the software-rendered frame budget; the
  // planet underneath is not visible anyway.
  if (interlude && interlude.incidentOpen) {
    requestAnimationFrame(frame);
    return;
  }

  if (intro && intro.active) {
    intro.update(t, dt);
    try {
      renderer.render(camera, t);
    } catch (err) {
      if (!frame.warned) {
        frame.warned = true;
        console.warn('[icosa] render failed', err);
      }
    }
    syncPerfTelemetry(t);
    requestAnimationFrame(frame);
    return;
  }

  if (view === 'surface' && surface && surface.active) {
    // One RAF loop (this one): the controller advances pose and harvest state,
    // the shared renderer draws the planet, cells and entities.
    surface.update(dt);
    // Approved carrier control: the camera is held by the pilot/cursor anchor
    // through parallel transport. Never write Euler yaw/pitch here; mouse drag
    // rotates the planet object with exact point follow (quaternion).
    const pose = surface.pose();
    if (pose && pose.pos) surfaceCamera.setPose(pose.pos, pose.forward);
    renderer.setSurfaceMode({
      active: true,
      entities: surface.entities(),
      effects: surface.effects(),
      phase: surface.phase,
      progress: surface.progress(),
    });
    try {
      renderer.render(surfaceCamera, t);
    } catch (err) {
      if (!frame.warned) {
        frame.warned = true;
        console.warn('[icosa] surface render failed', err);
      }
    }
    syncPerfTelemetry(t);
    requestAnimationFrame(frame);
    return;
  }
  if (renderer.surfaceMode) renderer.setSurfaceMode({ active: false });

  updateFocus(t);
  if (!focusAnim && !(interlude && interlude.active)) updateKeyboardNavigation(dt);
  if (!focusAnim && !(interlude && interlude.active)) updateCameraInertia(dt);

  if (!joined && !focusAnim && Math.abs(spinVel.x) < 0.0005 && Math.abs(spinVel.y) < 0.0005 && t - lastInteraction > 6000) {
    camera.yaw += dt * 0.00006;
  }

  if (!focusAnim && t - zoomUiAt > 250) {
    zoomUiAt = t;
    updateZoomUi();
  }

  if (hoverNeedsRefresh && !focusAnim && lastMouse) {
    hoverNeedsRefresh = false;
    refreshHoverFromPointer();
  }

  try {
    renderer.render(camera, t);
  } catch (err) {
    if (!frame.warned) {
      frame.warned = true;
      console.warn('[icosa] render failed', err);
    }
  }
  syncPerfTelemetry(t);
  // CTL-02: an empty frame is surfaced once as a GDS status line, then the
  // camera is recovered and the counter is reset so the message cannot loop.
  if (joined && t - lastEmptyFrameCheck > 1000) {
    lastEmptyFrameCheck = t;
    const stats = renderer && typeof renderer.frameStats === 'function' ? renderer.frameStats() : null;
    if (stats && stats.emptyFrames > 0) {
      safeCall(ui, 'announceStatus', 'VIEW RECOVERY');
      camera.reset();
      if (typeof renderer.resetEmptyFrames === 'function') renderer.resetEmptyFrames();
      updateZoomUi();
    }
  }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ *
 * Public hooks (QA / debugging)
 * ------------------------------------------------------------------ */

window.__ICOSA__ = {
  get state() {
    return state;
  },
  get player() {
    return myPlayer;
  },
  get joined() {
    return joined;
  },
  get connected() {
    return connected;
  },
  get leaves() {
    return leafList.length;
  },
  get threshold() {
    return threshold();
  },
  get maxDepth() {
    return maxDepth();
  },
  get hoveredLabel() {
    return hoveredLabel;
  },
  get session() {
    return { ...session };
  },
  get resources() {
    return state && state.resources ? state.resources : null;
  },
  get intro() {
    return intro ? intro.state() : null;
  },
  startIntro: () => (intro ? intro.start({ replay: true }) : false),
  skipIntro: () => (intro ? intro.skip() : false),
  mission: () => refreshMission(),
  missionConfig: () => planetInfoFromState().mission,
  planet: () => planetInfoFromState(),
  escape: () => requestEscape(),
  supply: () => requestEmergencySupply(),
  supplyEvent: (msg) => handleSupplyEvent(msg),
  get interludeState() {
    return interlude ? interlude.state() : null;
  },
  incidentFxStats: () => (interlude && typeof interlude.incidentFxStats === 'function' ? interlude.incidentFxStats() : null),
  narrator: () => (narrator ? narrator.state() : null),
  narratorPlayCue: (id) => (narrator ? narrator.playCue(id) : 0),
  narratorResume: () => (narrator ? narrator.resume() : false),
  audioTelemetry: () => telemetry.getPayload(),
  audioState: () => ({
    unlocked: !!(audio && audio.isUnlocked),
    muted: !!(audio && audio.isMuted),
    context: audio && audio._ctx ? audio._ctx.state : null,
  }),
  manual: () => safeCall(ui, 'showManual', HELP_SECTIONS),
  guide: () => openGuide(),
  surface: () => enterSurfaceMode(),
  /**
   * QA-only avatar preview (RND-05 evidence): injects one synthetic peer into
   * the renderer's real entity pass so front/back/side and mining poses can be
   * captured deterministically. Never gameplay state and never a second
   * renderer; the preview is removed by `clearSurfaceVisuals()` on exit.
   */
  avatarPreview: (options = {}) => {
    if (!surface || !surface.active) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const pose = surface.pose();
    const forward = pose.forward;
    const anchor = pose.pos;
    const spread = Number.isFinite(opts.spread) ? opts.spread : 0.055;
    const lateral = Number.isFinite(opts.lateral) ? opts.lateral : 0;
    const angle = Number.isFinite(opts.heading) ? opts.heading : 0;
    const len = Math.hypot(forward.x, forward.y, forward.z) || 1;
    const f = { x: forward.x / len, y: forward.y / len, z: forward.z / len };
    // Move `spread` radians forward and `lateral` radians sideways, then
    // normalize to the sphere. Lateral separation keeps the preview beside the
    // local pilot instead of directly along the camera's view direction.
    const right = {
      x: anchor.y * f.z - anchor.z * f.y,
      y: anchor.z * f.x - anchor.x * f.z,
      z: anchor.x * f.y - anchor.y * f.x,
    };
    const rlen = Math.hypot(right.x, right.y, right.z) || 1;
    let px = anchor.x + f.x * spread + (right.x / rlen) * lateral;
    let py = anchor.y + f.y * spread + (right.y / rlen) * lateral;
    let pz = anchor.z + f.z * spread + (right.z / rlen) * lateral;
    const plen = Math.hypot(px, py, pz) || 1;
    px /= plen; py /= plen; pz /= plen;
    const up = { x: px, y: py, z: pz };
    // Rotate the heading tangent around the surface normal for front/back/side.
    let t = { x: f.x, y: f.y, z: f.z };
    const td = t.x * up.x + t.y * up.y + t.z * up.z;
    t = { x: t.x - up.x * td, y: t.y - up.y * td, z: t.z - up.z * td };
    const tl = Math.hypot(t.x, t.y, t.z) || 1;
    t.x /= tl; t.y /= tl; t.z /= tl;
    const cross = {
      x: up.y * t.z - up.z * t.y,
      y: up.z * t.x - up.x * t.z,
      z: up.x * t.y - up.y * t.x,
    };
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dir = {
      x: t.x * cos + cross.x * sin,
      y: t.y * cos + cross.y * sin,
      z: t.z * cos + cross.z * sin,
    };
    const now = Date.now();
    safeCall(renderer, 'setPeers', [{
      playerId: 'p_preview',
      tag: String(opts.label || 'PREVIEW').slice(0, 14),
      color: typeof opts.tint === 'string' ? opts.tint : '#63dfff',
      surface: {
        pos: { x: px, y: py, z: pz },
        heading: dir,
        state: opts.moving === false ? 'idle' : 'walk',
        moving: opts.moving !== false,
        updatedAt: now,
      },
    }], now);
    if (opts.mining) {
      const cell = surface.target();
      safeCall(renderer, 'mineBeam', {
        playerId: 'p_preview',
        tag: 'PREVIEW',
        color: '#8afcff',
        toLeaf: typeof opts.toLeaf === 'string' && opts.toLeaf ? opts.toLeaf : (cell && cell.label) || null,
        pos: { x: px, y: py, z: pz },
        kind: 'mine',
        startAt: now,
      });
    }
    return { pos: { x: px, y: py, z: pz }, heading: dir, spread, angle };
  },
  surfaceMode: () => ({
    active: view === 'surface' && !!surface && surface.active,
    phase: surface ? surface.phase : 'idle',
    entities: surface && surface.active ? surface.entities().length : 0,
    canvasCount: typeof document !== 'undefined'
      ? document.querySelectorAll('canvas#arena-canvas').length
      : 0,
  }),
  view: () => view,
  hudSnapshot: () => safeCall(ui, 'hudSnapshot'),
  surfaceDebug: () => (surface ? surface.debug() : null),
  surfaceMineCount: () => {
    const stats = safeCall(renderer, 'surfaceVisualStats');
    return stats ? stats.beams : 0;
  },
  surfaceVisualStats: () => safeCall(renderer, 'surfaceVisualStats'),
  avatarStats: () => safeCall(renderer, 'avatarStats'),
  setAvatarScale: (multiplier) => safeCall(renderer, 'setAvatarScale', multiplier),
  setRenderPaused: (paused) => {
    window.__ICOSA_RENDER_PAUSED__ = !!paused;
    return window.__ICOSA_RENDER_PAUSED__;
  },
  surfacePose: () => (surface ? surface.pose() : null),
  supplyFocus: () => {
    if (!lastSupplyFocus) return null;
    return {
      impactLabel: lastSupplyFocus.impactLabel,
      cells: lastSupplyFocus.cells,
      placements: lastSupplyFocus.placements,
      ownPlacement: myPlayer
        ? (lastSupplyFocus.placements || []).find((entry) => entry && entry.playerId === myPlayer.id) || null
        : null,
      rev: lastSupplyFocus.rev,
      expiresAt: lastSupplyFocus.expiresAt,
      receivedAt: lastSupplyFocus.receivedAt,
    };
  },
  eventLog: () => eventLog.slice(),
  surfaceFocus: (label) => (surface ? surface.focusLabel(label) : false),
  surfaceAutoHarvest: (enabled) => (surface ? surface.setAutoHarvest(enabled) : false),
  harvestContext: () => harvestContext(),
  harvestStatusFor: (label) => {
    const node = label ? world.get(label) : null;
    if (!node) return null;
    const status = targetHarvestStatus(node);
    return { label: node.label, depth: node.depth, can: status.can, reason: status.reason, waitMs: status.waitMs || 0, exhausted: !!status.exhausted };
  },
  surfacePeers: () => [...surfacePeers.values()],
  surfaceEffect: (name = 'ORE', value = 90, color = '#ffd166') => safeCall(surface, 'harvestEffect', { resource: { name, color }, value }),
  projectFace: (label) => {
    const node = world.get(label);
    if (!node) return null;
    const projected = camera.project(node.centroid);
    return { x: projected.x, y: projected.y, z: projected.z, visible: projected.visible };
  },
  cameraInertia: () => ({
    spin: { ...spinVel },
    zoomTarget,
    zoomAnim,
    dragMode,
    dragInvert: dragMode === 'reverse',
    pointerDragging: !!activePointerDrag,
    pointerDrag: activePointerDrag ? { hasStart: !!activePointerDrag.start, mode: activePointerDrag.mode } : null,
    pointerRoles: pointerRouter ? pointerRouter.roles() : [],
    keyboard: { up: camera.carrierUp(), axis: camera.viewAxis() },
  }),
  zoomLevel: () => ({
    level: zoomLevelForZoom(zoomTarget === null ? camera.zoom : zoomTarget),
    maxLevel: maxZoomLevel(),
    target: zoomTarget,
    animating: !!zoomAnim,
  }),
  dragMode: () => dragMode,
  setDragMode: (value) => setDragMode(value),
  invertDrag: () => dragMode === 'reverse',
  setInvertDrag: (value) => setDragMode(value === true ? 'reverse' : 'follow'),
  controlMode: () => ({ mode: controlModeState(), dragMode, canToggle: canToggle(controlModeState()) }),
  renderStats: () => (renderer && typeof renderer.frameStats === 'function' ? renderer.frameStats() : null),
  exitSurface: () => requestExitSurface(),
  surfaceExitResult: () => surfaceExitState,
  pointerRoles: () => (pointerRouter ? pointerRouter.roles() : []),
  surfacePointerRoles: () => safeCall(ui, 'surfacePointerRoles') || [],
  cancelPointers: (reason = 'manual') => (pointerRouter ? pointerRouter.cancelAll(reason) : false),
  navTarget: () => (navLabel ? faceInfo(navLabel) : null),
  nextNavTarget: () => chooseNavTarget({ cycle: true }),
  meteor: (message) => handleIncidentEvent({ kind: 'meteor', title: 'METEOR IMPACT', message }),
  incident: (kind, title, message, description) => handleIncidentEvent({ kind, title, message, description }),
  abandon: () => abandonRun(),
  newPilot: () => startNewPilot(),
  world,
  camera,
  renderer,
  ui,
  surfaceCamera: () => surfaceCamera,
  cameraMode: () => ({ surface: 'carrier', contractVersion: 1 }),
  join,
  focusFace,
  hoverFace: () => (hoveredLabel ? faceInfo(hoveredLabel) : null),
  clickFace: (label) => attemptClick(label),
  report: () => openReport(),
  getReport: () => currentReport,
  leavesSnapshot: () => refreshLeafList().map((n) => [n.label, n.ownerIndex, n.clicks, n.resourceId || null]),
  worldRevision: () => world.revision,
  perf: () => safeCall(renderer, 'perfSnapshot'),
  renderFaces: () => planetRenderFaces,
};

boot();
