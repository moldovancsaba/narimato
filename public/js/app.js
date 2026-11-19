/**
 * NARIMATO — INFINITE GRID client integration.
 *
 * Persistent adaptive sphere: players join and play immediately, every cell
 * charges with clicks and breaks individually into four children, owners and
 * progress survive forever on the server. Camera zooms from whole-sphere to
 * the deepest face. No rounds, no timers, no end.
 */

import { SphereCamera, pickFace } from './shared/geometry.js';
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
import { createSurfaceMode } from './surface-mode.js';
import './telemetry.js';
import { HELP_SECTIONS } from './narrative-data.js';

const TOKEN_KEY = 'icosa.token';
const TAG_KEY = 'icosa.tag';
const TOKENS_KEY = 'icosa.tokens';
const DEFAULT_THRESHOLD = 8;
const DEFAULT_MAX_DEPTH = 24;
const MAX_ZOOM = 16777216;

const canvas = document.getElementById('arena-canvas');
const camera = new SphereCamera(window.innerWidth || 1, window.innerHeight || 1);
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
let pointerDown = null;
let pointers = new Map();
const navKeys = new Set();
const navVel = { x: 0, y: 0 };
let keyboardYaw = 0;
let keyboardPitch = 0;
let keyboardSyncNeeded = true;
let invertDrag = readStoredInvertDrag();
let pinchDist = 0;
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
const surfacePeers = new Map();
let supplyTimer = 0;
let supplyDeadline = 0;
let supplyPlanetKey = '';
let supplyRequestedKey = '';
let lastSupplyEventKey = '';
let lastDistressProgressKey = '';
let captainLogHoldUntil = 0;
let firstGuideTimer = 0;
let pendingAutoJoin = null;
const missionReadyNotified = new Set();

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
    narrator.stop();
    safeCall(ui, 'showGuide');
    try {
      localStorage.setItem('icosa.guideSeen', '1');
    } catch {
      /* private mode */
    }
  }, Math.max(0, delayMs));
}

function readStoredInvertDrag() {
  try {
    // New key: existing pilots get direct drag by default, even if they had the
    // old reverse-drag experiment enabled.
    const raw = localStorage.getItem('icosa.dragInvert.v2');
    return raw === '1';
  } catch {
    return false;
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
  return leafList;
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
    locked: cellLockedForMe(node),
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
});

/* ------------------------------------------------------------------ *
 * Narration / subtitles / Field Manual
 * ------------------------------------------------------------------ */

narrator = createNarrator();
supplyDrop = createSupplyDrop();
surface = createSurfaceMode({
  getStartPoint: () => (camera && typeof camera.viewAxis === 'function' ? camera.viewAxis() : { x: 0, y: 0, z: 1 }),
  getLeaves: () => leafList,
  getPlanet: () => {
    const p = typeof planetInfoFromState === 'function' ? planetInfoFromState() : {};
    return { name: p.planetName || 'UNKNOWN WORLD', seed: p.planetSeed || 0, depth: p.planetDepth || 2 };
  },
  getPlayers: () => (state && Array.isArray(state.players) ? state.players : []),
  getMyPlayerId: () => (myPlayer ? myPlayer.id : null),
  getPeers: () => [...surfacePeers.values()].filter((peer) => Date.now() - (peer.updatedAt || 0) < 5000),
  onPose: (pose) => sendSurfacePose(pose),
  onHarvest: (label) => {
    if (!joined || !label) return;
    attemptClick(label);
  },
  onExit: () => {
    sendSurfaceLeave();
    camera.zoom = zoomForLevel(maxZoomLevel());
    zoomTarget = null;
    zoomAnim = null;
    keyboardSyncNeeded = true;
    updateZoomUi();
    safeCall(ui, 'toast', 'BACK IN ORBIT // THE SURFACE IS STILL THERE', 'info');
  },
});

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
    keyboardSyncNeeded = true;
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

function boot() {
  primeTokenMap();
  resize();
  renderer.setPlayers([], null);
  safeCall(renderer, 'setPoleLabelsVisible', false);
  renderer.setConfig({ threshold: DEFAULT_THRESHOLD, maxDepth: DEFAULT_MAX_DEPTH });
  renderer.setFaces(leafList);

  const params = new URLSearchParams(window.location.search);
  const prefill = (params.get('tag') || readStorage(TAG_KEY) || '').toUpperCase().slice(0, 12);
  const tagInput = document.getElementById('tag-input');
  if (tagInput && prefill) tagInput.value = prefill;

  safeCall(ui, 'showLanding', { leaderboard: [], liveCount: 0, world: null });
  safeCall(ui, 'setConnection', 'connecting');
  safeCall(ui, 'hideReport');
  refreshPublicState();
  startPolling();

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
  function openGuide() {
    narrator.stop();
    safeCall(ui, 'showGuide');
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  }
  const helpBtn = document.getElementById('btn-help');
  if (helpBtn) helpBtn.addEventListener('click', () => openGuide());
  const guideStartBtn = document.getElementById('btn-guide-start');
  if (guideStartBtn) guideStartBtn.addEventListener('click', () => safeCall(ui, 'hideGuide'));
  const guideCloseBtn = document.getElementById('btn-guide-close');
  if (guideCloseBtn) guideCloseBtn.addEventListener('click', () => safeCall(ui, 'hideGuide'));
  const guideManualBtn = document.getElementById('btn-guide-manual');
  if (guideManualBtn) guideManualBtn.addEventListener('click', () => {
    safeCall(ui, 'hideGuide');
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
  // when the player has not unlocked audio or has muted it.
  const audioWatchdog = setInterval(() => {
    if (document.hidden) return;
    safeAudio('unlock');
    safeAudio('resume');
    if (narrator) narrator.resume();
  }, 15000);
  audioWatchdog.unref?.();

  bindCanvasInput();
  bindKeyboard();
  requestAnimationFrame(frame);
}

function resize() {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  camera.setViewport(w, h);
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
      safeCall(renderer, 'setPlanetSurface', data.state.planetSeed);
      refreshLeafList();
      renderer.setFaces(leafList);
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
      connectEvents();
    } else if (reconnectAttempts < 999) {
      scheduleReconnect();
    }
  }, delay);
}

/* ------------------------------------------------------------------ *
 * Server events
 * ------------------------------------------------------------------ */

function handleEvent(msg) {
  switch (msg.type) {
    case 'snapshot':
      applySnapshot(msg.state, msg.leaves);
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
    case 'surface':
    case 'surface_leave':
      handleSurfaceEvent(msg);
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
  if (nextState.planetSeed != null) {
    world.setPlanetSeed(nextState.planetSeed);
    safeCall(renderer, 'setPlanetSurface', nextState.planetSeed);
  }
  world.loadLeaves(leaves);
  refreshLeafList();
  renderer.setFaces(leafList);
  applyState(nextState);
  refreshMission();
  refreshNavTarget();
  renderer.setHover(null);
  hoveredLabel = null;
  safeCall(ui, 'setHoverFace', null);
}

function applyState(next) {
  if (!next || !Array.isArray(next.players)) return;
  state = next;
  if (next.planetSeed != null && world.planetSeed !== (Number(next.planetSeed) >>> 0)) {
    world.setPlanetSeed(next.planetSeed);
    safeCall(renderer, 'setPlanetSurface', next.planetSeed);
    refreshLeafList();
    renderer.setFaces(leafList);
  }
  myIndex = myPlayer ? next.players.findIndex((p) => p.id === myPlayer.id) : -1;
  if (myIndex === -1 && myPlayer && joined) {
    // Player identity lost (world reset): fall back to landing.
    showSessionLost();
    return;
  }
  renderer.setPlayers(next.players, myPlayer ? myPlayer.id : null);
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
}

function handleCellEvent(msg) {
  if (!Array.isArray(msg.cell)) return;
  const [label, ownerIndex, clicks, , lastClickIndex] = msg.cell;
  const node = world.applyCell(label, ownerIndex, clicks, lastClickIndex);
  if (!node) return;
  renderer.updateCell(label, node.ownerIndex, node.clicks);
  if (hoveredLabel === label) safeCall(ui, 'setHoverFace', faceInfo(label));
}

function handleBreakEvent(msg) {
  if (!msg || typeof msg.label !== 'string') return;
  const children = world.applyBreak(msg.label, msg.children);
  if (!children) return;
  refreshLeafList();
  renderer.replaceFace(msg.label, children);
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
      else renderer.setFaces(leafList);
    } catch (err) {
      console.warn('[icosa] resource marker failed', err);
    }
  }
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
  safeCall(renderer, 'setPlanetSurface', seed);
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
  focusAnim = {
    start: now(),
    duration: 560,
    fromYaw: camera.yaw,
    toYaw: camera.yaw + dYaw,
    fromPitch: camera.pitch,
    toPitch: targetPitch,
    fromZoom: camera.zoom,
    toZoom: camera.zoom,
  };
  keyboardSyncNeeded = true;
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
  clearDistressTimer();
  safeCall(ui, 'toast', message, 'good');
  setCaptainLogMessage('They heard us. A relief ship came down hard — the missing ore is scattered across the marked triangles. Go get it.', 30000);
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

function setCaptainLogMessage(text, holdMs = 22000) {
  captainLogHoldUntil = Date.now() + Math.max(1000, holdMs);
  safeCall(ui, 'setCaptainLog', text || '');
}

function captainLogFor(planet, progress) {
  if (progress.ready) {
    return `The drive is breathing again. We can leave ${planet.planetName} whenever you're ready — but the next world will ask for more.`;
  }
  const missing = [];
  for (const objective of progress.objectives) {
    for (const item of objective.items) {
      if (item.done) continue;
      const left = Math.max(0, item.need - item.have);
      if (left > 0) missing.push(`${left} ${item.name}${left === 1 ? '' : 's'}`);
    }
  }
  if (!missing.length) {
    return `We're still on ${planet.planetName}. The drive is almost there. Check the ship, then take us home.`;
  }
  return `We're grounded on ${planet.planetName} — ${planet.planetSource || 'somewhere far from home'}. The drive still needs ${missing.join(' and ')}. The crust can give it to us.`;
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
  }
  safeCall(ui, 'setPlanet', {
    planetIndex: planet.planetIndex,
    planetDepth: planet.planetDepth,
    planetName: planet.planetName,
    planetSource: planet.planetSource,
  });
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

function handleIncidentEvent(msg) {
  if (!msg) return;
  const kind = ['meteor', 'nuclear', 'solar', 'alien'].includes(msg.kind) ? msg.kind : 'meteor';
  const title = msg.title || kind.toUpperCase();
  const message = msg.message || 'PLANET EXHAUSTED // NEW RESOURCES AVAILABLE';
  const description = msg.description || '';
  safeCall(ui, 'toast', message, 'warn');
  setCaptainLogMessage(description || message, 26000);
  if (interlude && !interlude.active) interlude.incident(kind, title, message, description);
  maybeTip(kind === 'meteor' ? 'tip-meteor' : 'tip-incident', { delay: 1800, speaker: 'SHIP AI' });
  setTimeout(async () => {
    await reloadWorld();
    refreshMission();
    cancelCameraInertia();
    camera.reset();
    updateZoomUi();
    safeCall(ui, 'toast', 'THE DUST SETTLES // NEW ORE IN THE CRUST', 'good');
  }, 2400);
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
  renderer.updateCell(label, node.ownerIndex, node.clicks);
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
  if (!node) return;
  if (cellLockedForMe(node)) {
    maybeTip('tip-lock', { delay: 250 });
    const stampLock = now();
    if (stampLock - lastLockToastAt > 1200) {
      lastLockToastAt = stampLock;
      safeCall(ui, 'toast', 'CELL LOCKED // ANOTHER OPERATOR MUST CONTEST IT FIRST', 'warn');
      safeAudio('error');
    }
    return;
  }
  const stamp = now();
  if (stamp - lastClickSentAt < 45) return;
  lastClickSentAt = stamp;

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
          renderer.updateCell(label, node.ownerIndex, node.clicks);
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
          renderer.updateCell(label, node.ownerIndex, node.clicks);
          if (hoveredLabel === label) safeCall(ui, 'setHoverFace', faceInfo(label));
        }
        safeCall(ui, 'toast', 'CELL LOCKED // ANOTHER OPERATOR MUST CONTEST IT FIRST', 'warn');
        safeAudio('error');
      } else {
        const node = world.get(label);
        if (node) {
          node.ownerIndex = before.ownerIndex;
          node.clicks = before.clicks;
          renderer.updateCell(label, node.ownerIndex, node.clicks);
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
      if (node) renderer.updateCell(node.label, node.ownerIndex, node.clicks);
    }
    if (data.resource) applyDiscoveredResource(data.cell ? data.cell[0] : label, data.resource, myPlayer.id);
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
  if (!lastMouse || pointers.size > 0) return;
  const rect = canvas.getBoundingClientRect();
  applyHover(pickFace({ faces: leafList }, camera, lastMouse.x - rect.left, lastMouse.y - rect.top));
}

function updateZoomUi() {
  // Approximate visible depth from zoom (avoids picking the whole leaf set 4×/s).
  const depth = clamp(Math.round(Math.log2(Math.max(1, camera.zoom))), 0, maxDepth());
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

function zoomForLevel(level) {
  return clamp(2 ** clamp(Math.round(Number(level) || 0), 0, 12), 0.4, MAX_ZOOM);
}

function zoomLevelForZoom(value) {
  return clamp(Math.round(Math.log2(Math.max(1, Number(value) || 1))), 0, maxZoomLevel());
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
  const level = zoomLevelForZoom(current);
  if (direction > 0 && level >= maxZoomLevel()) {
    enterSurfaceMode();
    return;
  }
  const next = clamp(level + (direction > 0 ? 1 : -1), 0, maxZoomLevel());
  if (direction > 0 && next >= maxZoomLevel()) {
    safeCall(ui, 'toast', 'DEEPEST ZOOM // SCROLL AGAIN TO LAND ON THE SURFACE', 'info');
  }
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
      if (!lastMouse || pointers.size > 0) return;
      const { x, y } = localPoint({ clientX: lastMouse.x, clientY: lastMouse.y });
      setHover(pickAt(x, y));
    });
  };

  canvas.addEventListener('pointerdown', (event) => {
    safeAudio('unlock');
    keyboardSyncNeeded = true;
    navVel.x = 0;
    navVel.y = 0;
    initSequence();
    cancelFocus();
    spinVel.x = 0;
    spinVel.y = 0;
    zoomTarget = null;
    pointers.set(event.pointerId, localPoint(event));
    lastInteraction = now();
    if (pointers.size === 1) {
      pointerDown = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: 0,
        time: now(),
        lastMoveAt: now(),
      };
      canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
      const start = localPoint(event);
      safeCall(camera, 'beginArcball', start.x - camera.width / 2, start.y - camera.height / 2, Math.min(camera.width, camera.height) * 0.45);
      setHover(null);
    } else if (pointers.size === 2) {
      pointerDown = null;
      const pts = [...pointers.values()];
      pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, localPoint(event));
    lastInteraction = now();

    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDist > 0 && dist > 0) {
        const base = zoomTarget === null ? camera.zoom : zoomTarget;
        if (dist > pinchDist * 1.25 && zoomLevelForZoom(base) >= maxZoomLevel()) {
          enterSurfaceMode();
          return;
        }
        startZoom(clamp(base * (dist / pinchDist), 0.4, MAX_ZOOM), 90);
      }
      pinchDist = dist;
      hoverNeedsRefresh = true;
      return;
    }

    if (pointerDown && pointerDown.id === event.pointerId) {
      const dx = event.clientX - pointerDown.lastX;
      const dy = event.clientY - pointerDown.lastY;
      pointerDown.lastX = event.clientX;
      pointerDown.lastY = event.clientY;
      pointerDown.moved += Math.abs(dx) + Math.abs(dy);
      if (pointerDown.moved > 2) {
        const p = localPoint(event);
        const radius = Math.min(camera.width, camera.height) * 0.45;
        safeCall(camera, 'arcballTo', p.x - camera.width / 2, p.y - camera.height / 2, radius, invertDrag);
        const stamp = now();
        pointerDown.lastMoveAt = stamp;
        // A direct grab is deterministic; no residual spin can reverse it.
        spinVel.x = 0;
        spinVel.y = 0;
        canvas.style.cursor = 'grabbing';
      }
      return;
    }
    scheduleHover(event);
  });

  canvas.addEventListener('pointerup', (event) => {
    const wasDown = pointerDown && pointerDown.id === event.pointerId;
    const clickLike =
      wasDown && !event._cancelled && pointerDown.moved <= 7 && now() - pointerDown.time < 900;
    pointers.delete(event.pointerId);
    if (wasDown) {
      const dragged = pointerDown.moved > 2;
      const sinceMove = now() - (pointerDown.lastMoveAt || pointerDown.time);
      if (dragged) {
        // Direct arcball drag ends where the cursor left it; no post-release
        // spin that could make the planet keep moving in a different direction.
        spinVel.x = 0;
        spinVel.y = 0;
        canvas.style.cursor = 'grab';
        hoverNeedsRefresh = true;
      } else {
        spinVel.x = 0;
        spinVel.y = 0;
      }
      pointerDown = null;
      if (camera && camera._arc) camera._arc = null;
      if (clickLike) {
        const rect = canvas.getBoundingClientRect();
        const label = pickAt(event.clientX - rect.left, event.clientY - rect.top);
        if (label) attemptClick(label);
      }
    }
    if (pointers.size < 2) snapZoomToLevel();
    if (pointers.size === 1) {
      const [id, p] = [...pointers.entries()][0];
      pointerDown = {
        id,
        startX: p.x,
        startY: p.y,
        lastX: p.x,
        lastY: p.y,
        moved: 0,
        time: now(),
      };
    }
    if (pointers.size === 0) pinchDist = 0;
    lastMouse = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener('pointercancel', (event) => {
    pointers.delete(event.pointerId);
    pointerDown = null;
    if (camera && camera._arc) camera._arc = null;
    pinchDist = 0;
    spinVel.x = 0;
    spinVel.y = 0;
    zoomTarget = null;
  });

  canvas.addEventListener('pointerleave', () => {
    if (pointers.size === 0) setHover(null);
  });

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

function syncKeyboardEuler() {
  if (!keyboardSyncNeeded) return;
  const e = camera.viewEuler ? camera.viewEuler() : { yaw: camera.yaw, pitch: camera.pitch };
  keyboardYaw = e.yaw;
  keyboardPitch = e.pitch;
  keyboardSyncNeeded = false;
}

function updateKeyboardNavigation(dt) {
  if (!dt || (intro && intro.active) || (interlude && interlude.active)) return;
  const dtSec = dt / 1000;
  const hasInput = navKeys.has('ArrowLeft') || navKeys.has('ArrowRight') || navKeys.has('ArrowUp') || navKeys.has('ArrowDown');
  if (hasInput) {
    syncKeyboardEuler();
    // Cursor steering is a natural upright orbit: it travels the globe rather
    // than tumbling it with the mouse trackball.
    const boost = navKeys.has('Shift') ? 2.1 : 1;
    const yawInput = (navKeys.has('ArrowRight') ? 1 : 0) - (navKeys.has('ArrowLeft') ? 1 : 0);
    const pitchInput = (navKeys.has('ArrowUp') ? 1 : 0) - (navKeys.has('ArrowDown') ? 1 : 0);
    // Travel is deliberately inverse to mouse drag: pressing left rotates the
    // planet right while dragging left moves the grabbed surface left.
    const yawTarget = -yawInput * 1.55 * boost;
    const pitchTarget = pitchInput * 1.05 * boost;
    const ease = 1 - Math.exp(-16 * dtSec);
    navVel.x += (yawTarget - navVel.x) * ease;
    navVel.y += (pitchTarget - navVel.y) * ease;
    spinVel.x = 0;
    spinVel.y = 0;
    lastInteraction = now();
  } else {
    const decay = Math.exp(-9 * dtSec);
    navVel.x *= decay;
    navVel.y *= decay;
    if (Math.abs(navVel.x) < 0.0005) navVel.x = 0;
    if (Math.abs(navVel.y) < 0.0005) navVel.y = 0;
  }
  if (!navVel.x && !navVel.y) return;
  if (keyboardSyncNeeded) syncKeyboardEuler();
  keyboardYaw += navVel.x * dtSec;
  keyboardPitch += navVel.y * dtSec;
  // Set an upright yaw/pitch orientation: keyboard travel carries no roll.
  camera.yaw = keyboardYaw;
  camera.pitch = keyboardPitch;
}

let lastSurfacePoseSent = 0;
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
  if (myPlayer && msg.playerId === myPlayer.id) return;
  if (msg.type === 'surface_leave') {
    surfacePeers.delete(msg.playerId);
    return;
  }
  const pos = msg.pos;
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
  surfacePeers.set(msg.playerId, {
    playerId: msg.playerId,
    tag: String(msg.tag || 'PILOT').slice(0, 12),
    color: typeof msg.color === 'string' ? msg.color : '#a78bfa',
    pos: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) },
    heading: Number(msg.heading) || 0,
    moving: !!msg.moving,
    updatedAt: Date.now(),
  });
}

function enterSurfaceMode() {
  if (!joined || !surface || surface.active) return;
  cancelFocus();
  cancelZoom();
  narrator.stop();
  safeCall(ui, 'hideGuide');
  safeCall(ui, 'hideManual');
  const planet = planetInfoFromState();
  if (!surface.start({ planetName: planet.planetName, seed: planet.planetSeed, depth: planet.planetDepth })) return;
  safeAudio('introWhoosh');
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
        setInvertDrag(!invertDrag);
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

function setInvertDrag(next) {
  invertDrag = !!next;
  try {
    localStorage.setItem('icosa.dragInvert.v2', invertDrag ? '1' : '0');
  } catch {
    /* private mode */
  }
  safeCall(ui, 'toast', invertDrag ? 'DRAG: REVERSE — press I for direct drag' : 'DRAG: FOLLOW CURSOR — press I to reverse', 'info');
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
  keyboardSyncNeeded = true;
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

function frame(t) {
  const dt = Math.min(64, Math.max(0, t - lastFrame));
  lastFrame = t;

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
    requestAnimationFrame(frame);
    return;
  }

  if (surface && surface.active) {
    requestAnimationFrame(frame);
    return;
  }

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
  narrator: () => (narrator ? narrator.state() : null),
  audioState: () => ({
    unlocked: !!(audio && audio.isUnlocked),
    muted: !!(audio && audio.isMuted),
    context: audio && audio._ctx ? audio._ctx.state : null,
  }),
  manual: () => safeCall(ui, 'showManual', HELP_SECTIONS),
  guide: () => safeCall(ui, 'showGuide'),
  surface: () => enterSurfaceMode(),
  surfaceMode: () => (surface ? { active: surface.active, phase: surface.phase } : null),
  surfaceDebug: () => (surface ? surface.debug() : null),
  surfacePeers: () => [...surfacePeers.values()],
  projectFace: (label) => {
    const node = world.get(label);
    if (!node) return null;
    const projected = camera.project(node.centroid);
    return { x: projected.x, y: projected.y, z: projected.z, visible: projected.visible };
  },
  cameraInertia: () => ({ spin: { ...spinVel }, zoomTarget, zoomAnim, invertDrag, nav: { ...navVel }, keyboard: { yaw: keyboardYaw, pitch: keyboardPitch, synced: !keyboardSyncNeeded } }),
  zoomLevel: () => ({
    level: zoomLevelForZoom(zoomTarget === null ? camera.zoom : zoomTarget),
    maxLevel: maxZoomLevel(),
    target: zoomTarget,
    animating: !!zoomAnim,
  }),
  invertDrag: () => invertDrag,
  setInvertDrag: (value) => setInvertDrag(value),
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
  join,
  focusFace,
  hoverFace: () => (hoveredLabel ? faceInfo(hoveredLabel) : null),
  clickFace: (label) => attemptClick(label),
  report: () => openReport(),
  getReport: () => currentReport,
  leavesSnapshot: () => refreshLeafList().map((n) => [n.label, n.ownerIndex, n.clicks, n.resourceId || null]),
};

boot();
