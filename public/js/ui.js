/**
 * NARIMATO — INFINITE GRID DOM UI controller.
 *
 * Owns the landing screen, the always-live HUD (world telemetry, operator list,
 * arcade, zoom/depth indicator, hovered-cell inspector), toasts, connection
 * badge and the session REPORT overlay. It is intentionally dumb: no fetch, no
 * game rules, no rendering. app.js is the only driver.
 *
 * Public API (frozen contract, SPEC_INFINITE §3):
 *   const ui = new UI({ onJoin, onReport, onDownload, onShare, onCloseReport, onToggleSound });
 *   ui.showLanding({ leaderboard, liveCount, world }); ui.hideLanding();
 *   ui.showJoinError(message);                         ui.setJoinBusy(busy);
 *   ui.updateHud(state, myId, extras = { zoom, hoverFace });
 *   ui.setHoverFace(info | null);                      ui.setZoom(zoom, depth);
 *   ui.setLeaderboard(entries);                        ui.setLiveCount(n);
 *   ui.setConnection(status);                          ui.toast(message, kind);
 *   ui.showReport(result, { leaderboard, shareUrl, title }); ui.hideReport();
 *   ui.setSoundMuted(muted);
 *
 * updateHud can run at 10 Hz: every write is diffed and operator rows are
 * reused (reordered, never rebuilt) so the HUD stays cheap.
 */

import { renderResultCard } from './result-card.js';
import { RESOURCE_MARKET, resourceById } from './shared/resources.js';
import { BIOMES } from './shared/planet.js';

const CONNECTIONS = new Set(['connected', 'connecting', 'reconnecting', 'offline']);
const CONNECTION_TEXT = {
  connected: 'LINKED',
  connecting: 'LINKING',
  reconnecting: 'RETRYING',
  offline: 'OFFLINE',
};
const TOAST_KINDS = new Set(['info', 'good', 'bad', 'warn']);
const TOAST_GLYPH = { info: '▸', good: '+', bad: '×', warn: '!' };
const TOAST_MS = { info: 3200, good: 3200, bad: 4200, warn: 3800 };
const MAX_PLAYER_ROWS = 14;

const DEFAULT_MISSION = Object.freeze({
  ready: false,
  objectives: [
    {
      id: 'fuel-rods',
      name: 'FUEL RODS',
      items: [{ resourceId: 'uranium', name: 'URANIUM', glyph: 'U', color: '#7dff5c', need: 3, have: 0 }],
    },
    {
      id: 'hull-plates',
      name: 'HULL PLATES',
      items: [
        { resourceId: 'silver', name: 'SILVER', glyph: 'Ag', color: '#c9d6e5', need: 5, have: 0 },
        { resourceId: 'gold', name: 'GOLD', glyph: 'Au', color: '#ffd166', need: 2, have: 0 },
      ],
    },
    {
      id: 'warp-core',
      name: 'WARP CORE',
      items: [{ resourceId: 'palladium', name: 'PALLADIUM', glyph: 'Pd', color: '#a9c7ff', need: 1, have: 0 }],
    },
  ],
});

const DRAWERS = ['mission', 'operators', 'arcade'];

const TAG_RE = /^[A-Z0-9_-]{2,12}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const PLACEHOLDER_COLORS = ['#00f0ff', '#ff2bd6', '#d7ff00', '#ff7a00', '#8a5cff', '#00ffa8', '#ff3860', '#4d7cff'];
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 16777216;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const int = (v, fallback = 0) => Math.round(toNum(v, fallback));
const pad2 = (n) => String(Math.max(0, int(n))).padStart(2, '0');

function formatNumber(value) {
  const n = Math.round(toNum(value));
  const neg = n < 0;
  const s = Math.abs(n).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return neg ? `-${out}` : out;
}

function formatZoom(zoom) {
  const z = clamp(toNum(zoom, 1), ZOOM_MIN, ZOOM_MAX);
  if (z < 10) return `×${z.toFixed(1)}`;
  if (z < 100) return `×${Math.round(z)}`;
  if (z < 1000) return `×${formatNumber(Math.round(z))}`;
  if (z < 1000000) return `×${(z / 1000).toFixed(z >= 10000 ? 0 : 1)}K`;
  return `×${(z / 1000000).toFixed(2)}M`;
}

function normalizeConnection(status) {
  const s = String(status || '').toLowerCase();
  return CONNECTIONS.has(s) ? s : 'connecting';
}

function normalizeTag(raw) {
  return String(raw == null ? '' : raw).trim().toUpperCase().slice(0, 12);
}

class UI {
  /**
   * @param {object} options
   * @param {(tag:string)=>void} [options.onJoin]
   * @param {()=>void} [options.onReport]
   * @param {()=>void} [options.onDownload]
   * @param {()=>void} [options.onShare]
   * @param {()=>void} [options.onCloseReport]
   * @param {(muted:boolean)=>void} [options.onToggleSound]
   */
  constructor(options = {}) {
    this.opts = options && typeof options === 'object' ? options : {};
    const doc = typeof document !== 'undefined' ? document : null;
    this.doc = doc;
    this._el = doc ? resolveElements(doc) : {};

    this._joinBusy = false;
    this._soundMuted = false;
    this._connection = 'connecting';
    this._liveCount = 0;
    this._leaderboard = [];
    this._leaderboardSig = null;
    this._highlightTag = '';
    this._myPlayerId = null;
    this._myTag = '';
    this._state = null;
    this._world = null;
    this._threshold = 8;
    this._maxDepth = 8;
    this._hoverInfo = null;
    this._zoom = 1;
    this._focusDepth = 0;
    this._lastScore = 0;
    this._lastWorldText = null;
    this._lastZoomValue = null;
    this._lastZoomDepth = null;
    this._lastZoomFill = null;
    this._lastNextRoundText = null;
    this._lastToast = { message: '', at: 0 };
    this._toastSeq = 0;
    this._destroyed = false;
    this._mission = null;
    this._drawerName = null;
    this._introActive = false;
    this._escapeCtaDismissed = false;
    this._planet = { planetIndex: 0, planetDepth: 2, planetName: 'ICOSA-9' };
    this._escapeReady = false;
    this._interludeActive = false;
    this._meteorActive = false;
    this._confirmResolver = null;
    this._confirmPreviousFocus = null;
    this._reportResult = null;
    this._playersOrderSig = null;
    this._playerRows = new Map();

    this._bind();
    this._renderMarket();
    this._renderBiomeLegend();
    this.updateMission(DEFAULT_MISSION);
    this.setPlanet(this._planet);
    this.setSoundMuted(false);
    this.setJoinBusy(false);
    if (this._el.connectionBadge) this._el.connectionBadge.dataset.status = 'connecting';
  }

  /* ================================================================ *
   * Landing
   * ================================================================ */

  /**
   * Show the join overlay and focus the tag field.
   * @param {{leaderboard?: object[], liveCount?: number, world?: object}} [info]
   */
  showLanding(info = {}) {
    const data = info && typeof info === 'object' ? info : {};
    this.setJoinBusy(false);
    this.showJoinError('');
    this.closeDrawers();

    const overlay = this._el.joinOverlay;
    if (overlay) {
      overlay.classList.remove('is-hidden');
      overlay.removeAttribute('aria-hidden');
      // A shared report may be open over the landing; keep the background inert.
      overlay.inert = this.isReportOpen;
    }
    if (this.doc && this.doc.body) this.doc.body.classList.add('is-landing');
    if (this._el.hud) this._el.hud.setAttribute('aria-hidden', 'true');

    const input = this._el.tagInput;
    if (input && !input.value && this._lastTag) input.value = this._lastTag;

    if (typeof data.liveCount === 'number' || typeof data.liveCount === 'string') {
      this.setLiveCount(data.liveCount);
    }
    if (Array.isArray(data.leaderboard)) this.setLeaderboard(data.leaderboard);
    if (data.world && typeof data.world === 'object') this._renderWorld(data.world);
    this._focusTagInput();
  }

  /** Hide the join overlay and reveal the HUD. */
  hideLanding() {
    const input = this._el.tagInput;
    if (input) {
      const value = normalizeTag(input.value);
      if (value) this._lastTag = value;
      if (this.doc && this.doc.activeElement === input && typeof input.blur === 'function') input.blur();
    }
    const overlay = this._el.joinOverlay;
    if (overlay) {
      overlay.classList.add('is-hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (this.doc && this.doc.body) this.doc.body.classList.remove('is-landing');
    if (this._el.hud) this._el.hud.removeAttribute('aria-hidden');
    this.showJoinError('');
    this.setJoinBusy(false);
    this.closeDrawers();
  }

  /** Inline validation / server error under the tag field ('' clears it). */
  showJoinError(message) {
    const el = this._el.joinError;
    if (!el) return;
    const text = message == null ? '' : String(message);
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('is-visible', text.length > 0);
    const input = this._el.tagInput;
    if (input) input.setAttribute('aria-invalid', text ? 'true' : 'false');
    const form = this._el.joinForm;
    if (form) {
      form.classList.toggle('is-error', text.length > 0);
      if (text) {
        form.classList.remove('is-shaking');
        void form.offsetWidth;
        form.classList.add('is-shaking');
        setTimeout(() => form.classList.remove('is-shaking'), 600);
      }
    }
    if (text) this._focusTagInput();
  }

  /** Toggle the JACK IN button busy state. */
  setJoinBusy(busy) {
    this._joinBusy = !!busy;
    const btn = this._el.btnJoin;
    const input = this._el.tagInput;
    const form = this._el.joinForm;
    if (btn) {
      btn.disabled = this._joinBusy;
      btn.classList.toggle('is-busy', this._joinBusy);
      btn.setAttribute('aria-busy', this._joinBusy ? 'true' : 'false');
      const label = btn.querySelector('.btn-label');
      if (label) label.textContent = this._joinBusy ? 'LINKING…' : 'JACK IN';
      const glyph = btn.querySelector('.btn-glyph');
      if (glyph) glyph.textContent = this._joinBusy ? '· · ·' : '▸';
    }
    if (input) {
      input.readOnly = this._joinBusy;
      input.setAttribute('aria-busy', this._joinBusy ? 'true' : 'false');
    }
    if (form) form.setAttribute('aria-busy', this._joinBusy ? 'true' : 'false');
  }

  /* ================================================================ *
   * Live HUD
   * ================================================================ */

  /**
   * Refresh the HUD from a world State (SPEC_INFINITE §2).
   * Safe to call ~10×/s; all writes are diffed.
   * @param {object} state
   * @param {string|null} myId
   * @param {{zoom?:number, depth?:number, hoverFace?:object|string|null}} [extras]
   */
  updateHud(state, myId, extras = {}) {
    if (!state || typeof state !== 'object') return;
    this._state = state;
    this._myPlayerId = myId == null ? null : String(myId);

    this._threshold = Math.max(1, int(state.threshold, 8));
    this._maxDepth = Math.max(0, int(state.maxDepth, 8));
    this._renderWorld(state);

    const players = Array.isArray(state.players) ? state.players : [];
    const me = this._renderPlayers(players, this._myPlayerId);
    this._renderMyScore(players, me);
    if (Array.isArray(state.arcade)) this.setLeaderboard(state.arcade);
    if (me) this._setHighlightTag(normalizeTag(me.tag));

    const e = extras && typeof extras === 'object' ? extras : {};
    if ('zoom' in e) this.setZoom(e.zoom, finite(e.depth) ? e.depth : this._focusDepth);
    if ('hoverFace' in e) {
      this.setHoverFace(e.hoverFace);
    } else if (this._hoverInfo) {
      // Owner/charge may have changed since the last pointer move.
      this._renderTarget();
    }
  }

  /**
   * Hovered-cell inspector. Accepts a label, a number or an info object such as
   * { label, depth, ownerIndex, clicks, threshold, ownerId, owner:{tag,color} }.
   * Pass null to hide the panel.
   */
  setHoverFace(info) {
    if (info == null || info === false || info === '') {
      this._hoverInfo = null;
      this._renderTarget();
      return;
    }
    let hover;
    if (typeof info === 'string' || typeof info === 'number') {
      hover = { label: String(info) };
    } else if (Array.isArray(info)) {
      hover = { label: info[0], ownerIndex: info[1], clicks: info[2] };
    } else if (typeof info === 'object') {
      hover = { ...info };
    } else {
      this._hoverInfo = null;
      this._renderTarget();
      return;
    }
    const label = hover.label != null ? String(hover.label) : hover.id != null ? String(hover.id) : '';
    if (!label) {
      this._hoverInfo = null;
      this._renderTarget();
      return;
    }
    hover.label = label;
    if (!finite(hover.depth)) hover.depth = Math.max(0, label.split('.').length - 1);
    this._hoverInfo = hover;
    this._renderTarget();
  }

  /**
   * Zoom / focus-depth indicator. zoom 0.4 … 16,777,216, depth = current focus depth.
   */
  setZoom(zoom, depth) {
    const z = clamp(toNum(zoom, this._zoom), ZOOM_MIN, ZOOM_MAX);
    const d = Math.max(0, int(depth, this._focusDepth));
    this._zoom = z;
    this._focusDepth = d;

    const root = this._el.hudZoom;
    if (root) {
      const valueText = formatZoom(z);
      if (valueText !== this._lastZoomValue) {
        this._lastZoomValue = valueText;
        this._setText(this._el.hudZoomValue, valueText);
      }
      const pct = clamp((Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100, 0, 100);
      const pctText = pct.toFixed(1);
      if (pctText !== this._lastZoomFill) {
        this._lastZoomFill = pctText;
        if (this._el.hudZoomFill) this._el.hudZoomFill.style.width = `${pctText}%`;
      }
      const depthText = `FOCUS D${d}`;
      if (depthText !== this._lastZoomDepth) {
        this._lastZoomDepth = depthText;
        this._setText(this._el.hudZoomDepth, depthText);
      }
      const band = z >= 1024 ? 'macro' : z >= 64 ? 'deep' : z >= 8 ? 'mid' : 'wide';
      if (root.dataset.band !== band) root.dataset.band = band;
      if (root.dataset.zoom !== valueText) root.dataset.zoom = valueText;
    }
  }

  /* ================================================================ *
   * Leaderboards / counters / connection
   * ================================================================ */

  /**
   * Replace arcade data (landing board, HUD board and report board).
   * Diffed: identical data is a no-op, so repeated state updates are cheap.
   * Accepts the INFINITE shape { tag, score, facesHeld, breaks, updatedAt } and
   * tolerates legacy { best, games } fields.
   */
  setLeaderboard(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const normalized = [];
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const tag = normalizeTag(raw.tag);
      if (!tag) continue;
      normalized.push({
        tag,
        score: Math.max(0, int(raw.score != null ? raw.score : raw.best)),
        facesHeld: Math.max(0, int(raw.facesHeld)),
        breaks: Math.max(0, int(raw.breaks)),
      });
    }
    const sig = normalized.map((e) => `${e.tag}:${e.score}:${e.facesHeld}:${e.breaks}`).join('|');
    if (sig === this._leaderboardSig) return;
    this._leaderboardSig = sig;
    this._leaderboard = normalized;
    this._renderArcadeLists();
  }

  /** Live operator count ("NN OPERATORS ONLINE"). */
  setLiveCount(n) {
    const count = Math.max(0, int(n));
    this._liveCount = count;
    this._setText(this._el.liveCount, `${pad2(count)} OPERATOR${count === 1 ? '' : 'S'} ONLINE`);
  }

  /** Connection badge state. */
  setConnection(status) {
    const next = normalizeConnection(status);
    this._connection = next;
    const badge = this._el.connectionBadge;
    if (!badge) return;
    badge.dataset.status = next;
    const text = badge.querySelector('.conn-text');
    if (text) this._setText(text, CONNECTION_TEXT[next]);
    const label = `Connection: ${CONNECTION_TEXT[next].toLowerCase()}`;
    if (badge.getAttribute('aria-label') !== label) badge.setAttribute('aria-label', label);
    if (badge.title !== CONNECTION_TEXT[next]) badge.title = CONNECTION_TEXT[next];
  }

  /* ================================================================ *
   * Toasts
   * ================================================================ */

  toast(message, kind = 'info') {
    const container = this._el.toastContainer;
    const text = message == null ? '' : String(message).trim();
    if (!container || !text) return;
    const tone = TOAST_KINDS.has(kind) ? kind : 'info';

    const now = Date.now();
    if (this._lastToast.message === text && now - this._lastToast.at < 900) return;
    this._lastToast = { message: text, at: now };

    while (container.children.length >= 3) container.removeChild(container.firstElementChild);

    const item = this.doc.createElement('div');
    item.className = `toast toast--${tone}`;
    item.dataset.id = String(++this._toastSeq);
    item.setAttribute('role', tone === 'bad' ? 'alert' : 'status');
    const glyph = this.doc.createElement('span');
    glyph.className = 'toast-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = TOAST_GLYPH[tone];
    const body = this.doc.createElement('span');
    body.className = 'toast-text';
    body.textContent = text;
    item.append(glyph, body);
    container.appendChild(item);

    const timer = setTimeout(dismiss, TOAST_MS[tone]);
    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(timer);
      if (!item.isConnected) return;
      item.classList.add('is-out');
      setTimeout(() => item.remove(), 320);
    }
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    raf(() => item.classList.add('is-in'));
  }

  /* ================================================================ *
   * Session report overlay
   * ================================================================ */

  /**
   * Show the session report overlay (opens over the HUD or over the landing).
   * @param {object} result { tag, color, score, sessionScore, clicks, breaks,
   *   claims, steals, facesHeld, depth, rank, totalPlayers, shareUrl }
   * @param {{leaderboard?: object[], shareUrl?: string, title?: string}} [options]
   */
  showReport(result, options = {}) {
    const r = result && typeof result === 'object' ? result : {};
    const opts = options && typeof options === 'object' ? options : {};
    this._reportResult = r;
    this._reportOptions = opts;

    const overlay = this._el.reportOverlay;
    if (overlay) {
      overlay.classList.remove('is-hidden');
      overlay.removeAttribute('aria-hidden');
    }
    if (this.doc && this.doc.body) this.doc.body.classList.add('is-report');
    this.closeDrawers();
    if (this._el.hud) this._el.hud.inert = true;
    if (this._el.joinOverlay) this._el.joinOverlay.inert = true;

    const rank = Math.max(1, int(r.rank, 1));
    const total = Math.max(1, int(r.totalPlayers, 1));
    const score = Math.max(0, int(r.score));
    const sessionScore = Math.max(0, int(r.sessionScore, score));
    const tag = normalizeTag(r.tag) || 'PLAYER';
    const color = typeof r.color === 'string' && HEX_RE.test(r.color) ? r.color : PLACEHOLDER_COLORS[0];
    const depth = Math.max(0, int(r.depth != null ? r.depth : r.depthReached));
    const tier = rank === 1 ? 'win' : rank <= 3 ? 'podium' : 'standard';

    if (overlay) {
      overlay.dataset.tier = tier;
      overlay.style.setProperty('--p-color', color);
    }

    this._setText(this._el.reportTitle, opts.title ? String(opts.title) : 'SESSION REPORT');
    this._setText(this._el.reportTag, tag);
    if (this._el.reportTag) this._el.reportTag.style.setProperty('--p-color', color);
    this._renderRank(this._el.reportRank, rank, total);
    this._setText(this._el.reportScore, formatNumber(score));
    this._setText(this._el.reportSession, `+${formatNumber(sessionScore)}`);
    this._renderReportStats({
      sessionScore,
      clicks: Math.max(0, int(r.clicks)),
      breaks: Math.max(0, int(r.breaks)),
      claims: Math.max(0, int(r.claims)),
      steals: Math.max(0, int(r.steals)),
      facesHeld: Math.max(0, int(r.facesHeld)),
      depth,
      ores: Math.max(0, int(r.ores)),
      oreValue: Math.max(0, int(r.oreValue)),
    });
    this._renderBestFind(r.bestFind);
    this._renderReportShare(r, opts);

    if (Array.isArray(opts.leaderboard)) this.setLeaderboard(opts.leaderboard);
    this._setHighlightTag(tag);
    this._renderArcadeLists();

    // Card preview: app.js may also render it; rendering twice is harmless.
    requestAnimationFrame(() => {
      const preview = this._el.reportCardPreview;
      if (!preview || typeof preview.getContext !== 'function') return;
      try {
        renderResultCard(preview, { ...r, tag, color, score, sessionScore, depth, rank, totalPlayers: total });
      } catch (err) {
        console.warn('[icosa] report card preview failed', err);
      }
    });

    const panel = this._el.reportPanel;
    if (panel) panel.scrollTop = 0;
    if (overlay) overlay.scrollTop = 0;
    this._focusReport();
  }

  /** Hide the session report (safe when already hidden). */
  hideReport() {
    const overlay = this._el.reportOverlay;
    if (overlay) {
      overlay.classList.add('is-hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (this.doc && this.doc.body) this.doc.body.classList.remove('is-report');
    if (this._el.hud) this._el.hud.inert = false;
    if (this._el.joinOverlay && !this._el.joinOverlay.classList.contains('is-hidden')) {
      this._el.joinOverlay.inert = false;
    }
    const active = this.doc && this.doc.activeElement;
    if (active && overlay && overlay.contains(active) && typeof active.blur === 'function') active.blur();
    this._reportResult = null;
    this._reportOptions = null;
    if (this._isLandingVisible()) this._focusTagInput();
  }

  /** Reflect the audio mute state on the always-on AUDIO button. */
  setSoundMuted(muted) {
    this._soundMuted = !!muted;
    const btn = this._el.btnSound;
    if (!btn) return;
    btn.classList.toggle('is-muted', this._soundMuted);
    btn.setAttribute('aria-pressed', this._soundMuted ? 'true' : 'false');
    const label = this._soundMuted ? 'Unmute arcade audio' : 'Mute arcade audio';
    btn.setAttribute('aria-label', label);
    btn.title = this._soundMuted ? 'Audio muted — click to unmute' : 'Audio on — click to mute';
    btn.dataset.muted = this._soundMuted ? 'true' : 'false';
  }

  /**
   * Show the latest ore discovery in the HUD ticker.
   * @param {object|string|null} resource catalog entry or resource id
   * @param {number} [points] credits earned (defaults to the catalog value)
   */
  setLastFind(resource, points) {
    const el = this._el.hudFind;
    if (!el) return;
    const info = resolveResource(resource);
    if (!info) {
      this._lastFind = null;
      el.hidden = true;
      return;
    }
    const value = Number.isFinite(Number(points)) && Number(points) > 0 ? Number(points) : Number(info.value) || 0;
    const color = typeof info.color === 'string' && HEX_RE.test(info.color) ? info.color : '#d7ff00';
    this._lastFind = { ...info, value };
    el.hidden = false;
    el.style.setProperty('--res-color', color);
    el.setAttribute('aria-label', `Last find: ${info.name}, plus ${formatNumber(value)} credits`);
    this._setText(this._el.hudFindGlyph, info.glyph || info.name.slice(0, 2));
    this._setText(this._el.hudFindName, info.name || String(info.id || 'ORE').toUpperCase());
    this._setText(this._el.hudFindValue, `+${formatNumber(value)} CR`);
    el.classList.remove('is-new');
    void el.offsetWidth;
    el.classList.add('is-new');
  }

  /**
   * Update the ESCAPE mission objective rows (landing briefing + HUD panel).
   * @param {object} progress { ready, objectives:[{id,name,items:[{resourceId,name,glyph,color,need,have,done}]}] }
   */
  updateMission(progress) {
    this._mission = normalizeMission(progress);
    this._renderMission();
  }

  /** Toggle the mission panel (opens the drawer on compact layouts). */
  showMission(visible = true) {
    const compact = this._isCompactLayout();
    if (compact) this.toggleDrawer('mission', !!visible);
    else if (this.doc && this.doc.body) this.doc.body.classList.toggle('is-mission-hidden', !visible);
  }

  /**
   * Toggle one of the slide-over drawers: 'mission' | 'operators' | 'arcade'.
   * @param {string} name
   * @param {boolean} [force]
   */
  toggleDrawer(name, force) {
    const target = DRAWERS.includes(name) ? name : null;
    const body = this.doc && this.doc.body;
    if (!body || !target) return;
    const open = force === undefined ? this._drawerName !== target : !!force;
    if (open) this._drawerName = target;
    else if (this._drawerName === target) this._drawerName = null;
    body.classList.toggle('is-drawer-open', !!this._drawerName);
    for (const drawer of DRAWERS) body.classList.toggle(`drawer-${drawer}`, this._drawerName === drawer);
    body.dataset.drawer = this._drawerName || '';
    for (const [btn, id] of [[this._el.btnMission, 'mission'], [this._el.btnOperators, 'operators'], [this._el.btnArcade, 'arcade']]) {
      if (btn) btn.setAttribute('aria-expanded', this._drawerName === id ? 'true' : 'false');
    }
    if (this._el.drawerScrim) this._el.drawerScrim.hidden = !this._drawerName;
    if (this._drawerName) {
      const panel = this._el[`${target}Panel`] || (target === 'operators' ? this._el.playersPanel : null);
      if (panel) {
        panel.scrollTop = 0;
        const close = panel.querySelector('[data-drawer-close]');
        if (close) {
          try {
            close.focus({ preventScroll: true });
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  /** Close any open slide-over drawer. */
  closeDrawers() {
    this.toggleDrawer(this._drawerName || 'mission', false);
  }

  /**
   * Show/hide the cinematic cockpit intro. Lead's intro.js can manipulate the
   * DOM directly; these helpers keep body classes and ARIA in sync.
   */
  showIntro(active = true) {
    this._introActive = !!active;
    const body = this.doc && this.doc.body;
    const overlay = this._el.introOverlay;
    if (body) {
      body.classList.toggle('is-intro', this._introActive);
      body.classList.toggle('intro-active', this._introActive);
      body.classList.toggle('is-input-locked', this._introActive);
    }
    if (overlay) {
      overlay.classList.toggle('is-hidden', !this._introActive);
      overlay.setAttribute('aria-hidden', this._introActive ? 'false' : 'true');
    }
    if (this._introActive) {
      this.closeDrawers();
      this.hideReport();
      this.hideEscapeCta();
      this.hideLandingBrief();
      this.setIntroProgress(0);
    }
  }

  /** Set the three intro text lines (phase / main status / sub-status). */
  setIntroPhase(phase, status, sub) {
    // intro.js calls this with a single phase key and writes the copy itself;
    // QA/harness callers pass all three lines explicitly.
    const singleKey = status === undefined && sub === undefined;
    if (!singleKey && phase != null) this._setText(this._el.introPhase, String(phase));
    if (status != null) this._setText(this._el.introStatus, String(status));
    if (sub != null) this._setText(this._el.introSub, String(sub));
    if (this._el.introPhase && phase != null) {
      const value = String(phase).toLowerCase();
      this._el.introPhase.dataset.phase = value.includes('drift') ? 'drift' : value.includes('descent') ? 'descent' : value.includes('brief') ? 'briefing' : 'wormhole';
    }
  }

  /** Input lock hook used by the intro controller (safe no-op beyond a body class). */
  setInputLocked(locked) {
    if (this.doc && this.doc.body) this.doc.body.classList.toggle('is-input-locked', !!locked);
  }

  /** 0..100 intro progress fill. */
  setIntroProgress(value) {
    const pct = clamp(toNum(value, 0), 0, 100);
    if (this._el.introBar) this._el.introBar.style.width = `${pct}%`;
    const bar = this._el.introBar ? this._el.introBar.parentElement : null;
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  /** Current intro visibility (QA hook). */
  get isIntroVisible() {
    return this._introActive;
  }

  _isCompactLayout() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 1024px), (max-height: 720px)').matches;
  }

  /**
   * Update the planet badge (landing + HUD).
   * @param {{planetIndex?:number, planetDepth?:number, planetName?:string}} info
   */
  setPlanet(info) {
    const src = info && typeof info === 'object' ? info : {};
    const index = Math.max(0, int(src.planetIndex, this._planet.planetIndex));
    const depth = Math.max(0, int(src.planetLevels, int(src.planetDepth, Math.min(8, 2 + index))));
    const name = typeof src.planetName === 'string' && src.planetName.trim()
      ? src.planetName.trim().toUpperCase()
      : `ICOSA-${9 + index}`;
    this._planet = { planetIndex: index, planetDepth: depth, planetName: name };
    this._setText(this._el.planetBadgeName, name);
    this._setText(this._el.planetBadgeDepth, `LEVELS ${depth}`);
    const badge = this._el.planetBadge;
    if (badge) {
      badge.dataset.planet = String(index);
      badge.dataset.depth = String(depth);
      badge.title = `${name} // planet ${index} // levels ${depth}`;
      badge.setAttribute('aria-label', `${name}, planet ${index + 1}, levels ${depth}`);
    }
    return this._planet;
  }

  /**
   * Show/hide the ESCAPE burn button when the escape mission is complete.
   * @param {boolean} ready
   * @param {string} [missionName]
   */
  setEscapeReady(ready, missionName) {
    const wasReady = this._escapeReady;
    this._escapeReady = !!ready;
    const name = typeof missionName === 'string' && missionName.trim() ? missionName.trim() : 'ESCAPE';
    for (const btn of [this._el.btnEscape, this._el.btnEscapeCenter]) {
      if (!btn) continue;
      btn.hidden = !this._escapeReady;
      btn.setAttribute('aria-label', `${name} ready — try to fly away and escape`);
      const label = btn.querySelector('.btn-label');
      if (label) label.textContent = btn === this._el.btnEscapeCenter ? 'TRY TO FLY AWAY' : 'ESCAPE // BURN FOR ORBIT';
    }
    if (this._el.missionPanel) this._el.missionPanel.classList.toggle('is-escape-ready', this._escapeReady);
    if (this._el.btnMission) this._el.btnMission.classList.toggle('is-escape-ready', this._escapeReady);
    if (!this._escapeReady) {
      this.hideEscapeCta();
      this._escapeCtaDismissed = false;
    } else if (!this._interludeActive && (!wasReady || !this._escapeCtaDismissed)) {
      // Pop the center CTA as soon as the refit completes (or when re-ready).
      this._escapeCtaDismissed = false;
      this.showEscapeCta(name);
    }
  }

  /** Show the centered "try to fly away" escape call-to-action. */
  showEscapeCta(missionName = 'ESCAPE') {
    if (!this._escapeReady) return;
    const cta = this._el.escapeCta;
    if (!cta) return;
    const title = this._el.escapeCtaTitle;
    const sub = this._el.escapeCtaSub;
    if (title) title.textContent = 'READY TO LEAVE';
    if (sub) sub.textContent = `${String(missionName).toUpperCase()} COMPLETE // TRY TO FLY AWAY AND ESCAPE`;
    cta.hidden = false;
    cta.classList.remove('is-hidden');
    cta.classList.add('is-active');
    cta.setAttribute('aria-hidden', 'false');
    if (this.doc && this.doc.body) this.doc.body.classList.add('is-escape-cta');
    if (this._el.btnEscapeCenter) {
      this._el.btnEscapeCenter.hidden = false;
      try {
        this._el.btnEscapeCenter.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  }

  /** Hide the centered escape CTA (either dismissed or after escape starts). */
  hideEscapeCta() {
    const cta = this._el.escapeCta;
    if (cta) {
      cta.classList.add('is-hidden');
      cta.classList.remove('is-active');
      cta.hidden = true;
      cta.setAttribute('aria-hidden', 'true');
    }
    if (this.doc && this.doc.body) this.doc.body.classList.remove('is-escape-cta');
  }

  dismissEscapeCta() {
    this._escapeCtaDismissed = true;
    this.hideEscapeCta();
  }

  /**
   * Centered mission briefing after landing on a new planet.
   * @param {object} progress missionProgress() result
   * @param {{planetName?:string,planetDepth?:number,planetIndex?:number}} [planet]
   */
  showLandingBrief(progress, planet = {}) {
    const list = this._el.landingBriefList;
    const wrap = this._el.landingBrief;
    if (!wrap || !list || !progress || !Array.isArray(progress.objectives)) return;
    const name = planet && typeof planet.planetName === 'string' && planet.planetName
      ? planet.planetName.toUpperCase()
      : 'NEW PLANET';
    const levels = Math.max(0, int(planet && planet.planetDepth, 2 + int(planet && planet.planetIndex, 0)));
    this._setText(this._el.landingBriefTitle, name);
    this._setText(this._el.landingBriefSub, `LEVELS ${levels} // COLLECT THE REFIT TO LEAVE`);
    list.textContent = '';
    for (const objective of progress.objectives) {
      const li = this.doc.createElement('li');
      li.className = 'landing-brief-objective';
      const head = this.doc.createElement('div');
      head.className = 'landing-brief-objective-head';
      const title = this.doc.createElement('span');
      title.textContent = objective.name;
      const state = this.doc.createElement('span');
      state.className = 'landing-brief-objective-state';
      state.textContent = objective.done ? 'READY' : 'COLLECT';
      if (objective.done) state.classList.add('is-done');
      head.appendChild(title);
      head.appendChild(state);
      li.appendChild(head);
      for (const item of objective.items) {
        const row = this.doc.createElement('div');
        row.className = `landing-brief-row${item.done ? ' is-done' : ''}`;
        row.style.setProperty('--res-color', item.color || '#c9d6e5');
        const glyph = this.doc.createElement('span');
        glyph.className = 'landing-brief-glyph';
        glyph.textContent = item.glyph || '?';
        const itemName = this.doc.createElement('span');
        itemName.className = 'landing-brief-name';
        itemName.textContent = item.name;
        const count = this.doc.createElement('span');
        count.className = 'landing-brief-count';
        count.textContent = `${item.have}/${item.need}`;
        row.appendChild(glyph);
        row.appendChild(itemName);
        row.appendChild(count);
        li.appendChild(row);
      }
      list.appendChild(li);
    }
    wrap.hidden = false;
    wrap.classList.remove('is-hidden');
    wrap.classList.add('is-active');
    wrap.setAttribute('aria-hidden', 'false');
    if (this.doc && this.doc.body) this.doc.body.classList.add('is-landing-brief');
    this.hideEscapeCta();
    this.closeDrawers();
    if (this._el.btnLandingBriefStart) {
      try {
        this._el.btnLandingBriefStart.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  }

  hideLandingBrief() {
    const wrap = this._el.landingBrief;
    if (wrap) {
      wrap.classList.add('is-hidden');
      wrap.classList.remove('is-active');
      wrap.hidden = true;
      wrap.setAttribute('aria-hidden', 'true');
    }
    if (this.doc && this.doc.body) this.doc.body.classList.remove('is-landing-brief');
  }

  /**
   * Show/hide the interplanetary interlude overlay.
   * Lead's interlude.js may manipulate the DOM directly; this keeps body
   * classes, drawers and report state consistent.
   */
  showInterlude(active = true) {
    this._interludeActive = !!active;
    const body = this.doc && this.doc.body;
    const overlay = this._el.interludeOverlay;
    if (body) {
      body.classList.toggle('is-interlude', this._interludeActive);
      body.classList.toggle('interlude-active', this._interludeActive);
      if (this._interludeActive) body.classList.remove('is-shaking');
    }
    if (overlay) {
      overlay.classList.toggle('is-hidden', !this._interludeActive);
      overlay.classList.toggle('is-active', this._interludeActive);
      overlay.setAttribute('aria-hidden', this._interludeActive ? 'false' : 'true');
    }
    if (this._interludeActive) {
      this.closeDrawers();
      this.hideReport();
      this.setInterludeProgress(0);
      if (this._el.btnEscape) this._el.btnEscape.hidden = true;
      this.hideEscapeCta();
      this.hideLandingBrief();
    } else if (this._escapeReady && this._el.btnEscape) {
      this._el.btnEscape.hidden = false;
    }
  }

  /**
   * Set interlude copy/state. Accepts the escape story object shape
   * { title, sub, status, lines, mode, storm, tone } or individual fields.
   */
  setInterlude(info = {}) {
    const src = info && typeof info === 'object' ? info : {};
    if (src.title != null) this._setText(this._el.interludeTitle, String(src.title).toUpperCase());
    if (src.sub != null) this._setText(this._el.interludeSub, String(src.sub).toUpperCase());
    if (src.status != null) this._setText(this._el.interludeStatus, String(src.status).toUpperCase());
    if (Array.isArray(src.lines)) {
      const story = this._el.interludeStory;
      if (story) {
        story.textContent = '';
        for (const line of src.lines) {
          const p = this.doc.createElement('p');
          p.textContent = String(line);
          story.appendChild(p);
        }
      }
    }
    const overlay = this._el.interludeOverlay;
    if (overlay) {
      const mode = typeof src.mode === 'string' ? src.mode : typeof src.tone === 'string' ? src.tone : '';
      for (const cls of [...overlay.classList]) {
        if (cls.startsWith('mode-')) overlay.classList.remove(cls);
      }
      if (mode) overlay.classList.add(`mode-${mode}`);
      overlay.classList.toggle('is-storm', src.storm === true || /storm/i.test(String(src.tone || src.mode || src.title || '')));
      overlay.classList.toggle('is-shaking', src.shaking === true);
      if (this.doc && this.doc.body) this.doc.body.classList.toggle('is-shaking', src.shaking === true);
    }
  }

  /** 0..100 interlude progress fill. */
  setInterludeProgress(value) {
    const pct = clamp(toNum(value, 0), 0, 100);
    if (this._el.interludeBar) this._el.interludeBar.style.width = `${pct}%`;
    const bar = this._el.interludeBar ? this._el.interludeBar.parentElement : null;
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  /**
   * Show/hide the meteor-impact overlay (Lead's event handler auto-hides it).
   * Accepts optional { title, sub } copy.
   */
  showMeteor(active = true, info = {}) {
    this._meteorActive = !!active;
    const src = info && typeof info === 'object' ? info : {};
    if (src.title != null) this._setText(this._el.meteorTitle, String(src.title).toUpperCase());
    if (src.sub != null) this._setText(this._el.meteorSub, String(src.sub).toUpperCase());
    const overlay = this._el.meteorOverlay;
    if (overlay) {
      overlay.classList.toggle('is-hidden', !this._meteorActive);
      overlay.classList.toggle('is-active', this._meteorActive);
      overlay.setAttribute('aria-hidden', this._meteorActive ? 'false' : 'true');
    }
    if (this.doc && this.doc.body) this.doc.body.classList.toggle('is-meteor', this._meteorActive);
    if (this._meteorActive) this.closeDrawers();
  }

  /**
   * Cyberpunk confirmation dialog (replaces window.confirm).
   * @param {{title?:string, message?:string, okLabel?:string, cancelLabel?:string}} [options]
   * @returns {Promise<boolean>}
   */
  confirm(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const overlay = this._el.confirmOverlay;
    if (!overlay) return Promise.resolve(false);
    // Supersede any previous dialog.
    if (this._confirmResolver) {
      const previous = this._confirmResolver;
      this._confirmResolver = null;
      previous(false);
    }
    this._setText(this._el.confirmTitle, opts.title ? String(opts.title).toUpperCase() : 'CONFIRM ACTION');
    this._setText(this._el.confirmMessage, opts.message ? String(opts.message) : '');
    if (this._el.btnConfirmYes) this._el.btnConfirmYes.textContent = String(opts.okLabel || 'CONFIRM').toUpperCase();
    if (this._el.btnConfirmCancel) this._el.btnConfirmCancel.textContent = String(opts.cancelLabel || 'CANCEL').toUpperCase();
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');
    this.closeDrawers();
    this._confirmPreviousFocus = this.doc && this.doc.activeElement ? this.doc.activeElement : null;
    const focusTarget = this._el.btnConfirmCancel || this._el.btnConfirmYes;
    if (focusTarget) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    return new Promise((resolve) => {
      this._confirmResolver = resolve;
    });
  }

  _resolveConfirm(value) {
    const overlay = this._el.confirmOverlay;
    if (overlay) {
      overlay.classList.add('is-hidden');
      overlay.classList.remove('is-active');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.hidden = true;
    }
    const resolver = this._confirmResolver;
    this._confirmResolver = null;
    if (this._confirmPreviousFocus && typeof this._confirmPreviousFocus.focus === 'function') {
      try {
        this._confirmPreviousFocus.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    this._confirmPreviousFocus = null;
    if (resolver) resolver(!!value);
  }

  /** Convenience getters (not part of the frozen contract). */
  get isReportOpen() {
    const overlay = this._el.reportOverlay;
    return !!overlay && !overlay.classList.contains('is-hidden');
  }

  get currentResult() {
    return this._reportResult || null;
  }

  /** Cleanup hook (tests / teardown). */
  destroy() {
    this._destroyed = true;
  }

  /* ================================================================ *
   * Internals — binding
   * ================================================================ */

  _bind() {
    const doc = this.doc;
    if (!doc) return;

    const form = this._el.joinForm;
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        this._submitJoin();
      });
    }
    const input = this._el.tagInput;
    if (input) {
      input.addEventListener('input', () => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const upper = input.value.toUpperCase();
        if (input.value !== upper) {
          input.value = upper;
          try {
            if (doc.activeElement === input && typeof input.setSelectionRange === 'function') {
              input.setSelectionRange(start, end);
            }
          } catch {
            /* ignore */
          }
        }
        if (this._el.joinError && this._el.joinError.textContent) this.showJoinError('');
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this._submitJoin();
        }
      });
    }

    if (this._el.btnJoin) {
      this._el.btnJoin.addEventListener('click', (event) => {
        event.preventDefault();
        this._submitJoin();
      });
    }

    if (this._el.btnSound) {
      this._el.btnSound.addEventListener('click', () => {
        const next = !this._soundMuted;
        this.setSoundMuted(next);
        try {
          this.opts.onToggleSound?.(next);
        } catch (err) {
          console.warn('[icosa] onToggleSound failed', err);
        }
      });
    }

    if (this._el.btnReport) {
      this._el.btnReport.addEventListener('click', () => this._call('onReport'));
    }
    if (this._el.btnEscapeDismiss) {
      this._el.btnEscapeDismiss.addEventListener('click', () => this.dismissEscapeCta());
    }
    if (this._el.btnLandingBriefStart) {
      this._el.btnLandingBriefStart.addEventListener('click', () => this.hideLandingBrief());
    }
    if (this._el.btnDockAbandon && this._el.btnAbandon) {
      this._el.btnDockAbandon.addEventListener('click', () => this._el.btnAbandon.click());
    }
    if (this._el.btnConfirmYes) {
      this._el.btnConfirmYes.addEventListener('click', () => this._resolveConfirm(true));
    }
    if (this._el.btnConfirmCancel) {
      this._el.btnConfirmCancel.addEventListener('click', () => this._resolveConfirm(false));
    }
    for (const el of doc.querySelectorAll('[data-confirm-cancel]')) {
      el.addEventListener('pointerdown', () => this._resolveConfirm(false));
    }
    if (this._el.confirmOverlay) {
      this._el.confirmOverlay.addEventListener('pointerdown', (event) => {
        if (event.target === this._el.confirmOverlay) this._resolveConfirm(false);
      });
    }
    if (this._el.btnMission) {
      this._el.btnMission.addEventListener('click', () => this.toggleDrawer('mission'));
    }
    if (this._el.btnOperators) {
      this._el.btnOperators.addEventListener('click', () => this.toggleDrawer('operators'));
    }
    if (this._el.btnArcade) {
      this._el.btnArcade.addEventListener('click', () => this.toggleDrawer('arcade'));
    }
    for (const btn of doc.querySelectorAll('[data-drawer-close]')) {
      btn.addEventListener('click', () => this.closeDrawers());
    }
    if (this._el.drawerScrim) {
      this._el.drawerScrim.addEventListener('pointerdown', () => this.closeDrawers());
    }
    if (this._el.btnTargetClose) {
      this._el.btnTargetClose.addEventListener('click', () => this.setHoverFace(null));
    }
    if (this._el.btnReportDownload) {
      this._el.btnReportDownload.addEventListener('click', () => this._call('onDownload'));
    }
    if (this._el.btnReportShare) {
      this._el.btnReportShare.addEventListener('click', () => this._call('onShare'));
    }

    const close = () => this._closeReport();
    if (this._el.btnReportClose) this._el.btnReportClose.addEventListener('click', close);
    for (const btn of doc.querySelectorAll('[data-close-report]')) btn.addEventListener('click', close);
    if (this._el.reportOverlay) {
      this._el.reportOverlay.addEventListener('pointerdown', (event) => {
        if (event.target === this._el.reportOverlay || (event.target && event.target.classList && event.target.classList.contains('report-scrim'))) {
          close();
        }
      });
    }

    for (const btn of doc.querySelectorAll('.panel-toggle')) {
      btn.addEventListener('click', () => {
        const panel = btn.closest('.panel');
        if (!panel) return;
        const collapsed = panel.classList.toggle('is-collapsed');
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
        btn.title = collapsed ? 'Expand' : 'Collapse';
      });
    }

    doc.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this._confirmResolver) {
        event.preventDefault();
        this._resolveConfirm(false);
      } else if (this._drawerName) {
        event.preventDefault();
        this.closeDrawers();
      } else if (this.isReportOpen) {
        event.preventDefault();
        this._closeReport();
      } else if (this._isLandingVisible()) {
        this._focusTagInput();
      }
    });
  }

  _call(name, ...args) {
    try {
      this.opts[name]?.(...args);
    } catch (err) {
      console.warn(`[icosa] ${name} failed`, err);
    }
  }

  _submitJoin() {
    if (this._joinBusy) return;
    const input = this._el.tagInput;
    const raw = input ? input.value : '';
    const tag = raw.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 12);
    if (!TAG_RE.test(tag)) {
      this.showJoinError('TAG MUST BE 2–12 CHARS: A–Z 0–9 _ -');
      return;
    }
    if (input && input.value !== tag) input.value = tag;
    this._lastTag = tag;
    this.showJoinError('');
    this.setJoinBusy(true);
    try {
      this.opts.onJoin?.(tag);
    } catch (err) {
      console.warn('[icosa] onJoin failed', err);
      this.setJoinBusy(false);
      this.showJoinError('UPLINK ERROR // TRY AGAIN');
    }
  }

  _closeReport() {
    this._call('onCloseReport');
    this.hideReport();
  }

  _focusTagInput() {
    const input = this._el.tagInput;
    if (!input) return;
    const attempt = () => {
      try {
        if (this._isLandingVisible() && typeof input.focus === 'function') input.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    };
    attempt();
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    raf(attempt);
    setTimeout(attempt, 90);
  }

  _focusReport() {
    const overlay = this._el.reportOverlay;
    if (!overlay) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    raf(() => {
      try {
        if (this.isReportOpen) overlay.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    });
  }

  _isLandingVisible() {
    const overlay = this._el.joinOverlay;
    if (!overlay) return false;
    return !overlay.classList.contains('is-hidden') && !overlay.hasAttribute('aria-hidden');
  }

  /* ================================================================ *
   * Internals — rendering
   * ================================================================ */

  _setText(node, text) {
    if (!node) return;
    const value = String(text);
    if (node.textContent !== value) node.textContent = value;
  }

  _renderWorld(world) {
    if (!world || typeof world !== 'object') return;
    this._world = world;
    const faces = Math.max(0, int(world.faces));
    const maxDepthReached = Math.max(0, int(world.maxDepthReached, int(world.maxDepth, 0)));
    const totalClicks = Math.max(0, int(world.totalClicks));
    const totalBreaks = Math.max(0, int(world.totalBreaks));
    const threshold = Math.max(1, int(world.threshold, this._threshold));
    const maxDepth = Math.max(0, int(world.maxDepth, this._maxDepth));
    this._threshold = threshold;
    this._maxDepth = maxDepth;

    const worldText = `WORLD D${maxDepthReached} · ${formatNumber(faces)} FACES`;
    if (worldText !== this._lastWorldText) {
      this._lastWorldText = worldText;
      this._setText(this._el.hudWorld, worldText);
    }

    this._setText(this._el.worldFaces, formatNumber(faces));
    this._setText(this._el.worldDepth, `D${maxDepthReached}`);
    this._setText(this._el.worldClicks, formatNumber(totalClicks));
    this._setText(this._el.worldBreaks, formatNumber(totalBreaks));
    this._setText(
      this._el.worldRule,
      `BREAK AT ${pad2(threshold)} CLICKS // CONTEST LOCK // DEPTH CAP ${pad2(maxDepth)}`
    );
  }

  _renderPlayers(players, myPlayerId) {
    const list = this._el.playersList;
    if (!list) return null;
    const doc = this.doc;
    const onlineCount = players.filter((p) => p && p.online !== false).length;

    const rows = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p || typeof p !== 'object') continue;
      const id = p.id != null ? String(p.id) : `idx-${i}`;
      rows.push({
        id,
        tag: normalizeTag(p.tag) || 'PLAYER',
        color: typeof p.color === 'string' && HEX_RE.test(p.color) ? p.color : PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length],
        online: p.online !== false,
        score: Math.max(0, int(p.score)),
        facesHeld: Math.max(0, int(p.facesHeld)),
      });
    }

    const sorted = rows
      .slice()
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return a.tag.localeCompare(b.tag);
      })
      .slice(0, MAX_PLAYER_ROWS);

    const orderSig = sorted.map((p) => p.id).join('|');
    if (orderSig !== this._playersOrderSig) {
      this._playersOrderSig = orderSig;
      const existing = this._playerRows;
      const nextRows = new Map();
      const fragment = doc.createDocumentFragment();
      for (const p of sorted) {
        let row = existing.get(p.id);
        if (!row) row = this._createPlayerRow(p.id);
        nextRows.set(p.id, row);
        fragment.appendChild(row.li);
      }
      for (const [id, row] of existing) {
        if (!nextRows.has(id)) row.li.remove();
      }
      list.appendChild(fragment);
      this._playerRows = nextRows;
    }

    let me = null;
    const leaderId = sorted.length ? sorted[0].id : null;
    for (const p of sorted) {
      const row = this._playerRows.get(p.id);
      if (!row) continue;
      this._updatePlayerRow(row, p, p.id === myPlayerId, p.id === leaderId);
      if (myPlayerId != null && p.id === myPlayerId) me = p;
    }

    if (this._el.playersEmpty) {
      const empty = sorted.length === 0;
      if (this._el.playersEmpty.hidden !== !empty) this._el.playersEmpty.hidden = !empty;
    }
    this._setText(this._el.playersCount, `${onlineCount} ONLINE`);
    return me;
  }

  _createPlayerRow(id) {
    const doc = this.doc;
    const li = doc.createElement('li');
    li.className = 'player-row';
    li.dataset.playerId = id;

    const conn = doc.createElement('span');
    conn.className = 'p-conn';
    conn.setAttribute('aria-hidden', 'true');

    const swatch = doc.createElement('span');
    swatch.className = 'p-swatch';
    swatch.setAttribute('aria-hidden', 'true');

    const tagWrap = doc.createElement('span');
    tagWrap.className = 'p-tag';
    const name = doc.createElement('span');
    name.className = 'p-name';
    const you = doc.createElement('span');
    you.className = 'p-you';
    you.textContent = 'YOU';
    tagWrap.append(name, you);

    const faces = doc.createElement('span');
    faces.className = 'p-faces';
    const score = doc.createElement('span');
    score.className = 'p-score';

    li.append(conn, swatch, tagWrap, faces, score);
    return { li, conn, swatch, tagWrap, name, you, faces, score, cache: {} };
  }

  _updatePlayerRow(row, p, isMe, isLeader) {
    if (!row) return;
    const c = row.cache;
    if (c.tag !== p.tag) {
      c.tag = p.tag;
      row.name.textContent = p.tag;
    }
    if (c.color !== p.color) {
      c.color = p.color;
      row.swatch.style.setProperty('--p-color', p.color);
    }
    if (c.score !== p.score) {
      c.score = p.score;
      row.score.textContent = formatNumber(p.score);
    }
    if (c.faces !== p.facesHeld) {
      c.faces = p.facesHeld;
      row.faces.textContent = String(p.facesHeld);
    }
    if (c.you !== isMe) {
      c.you = isMe;
      row.you.hidden = !isMe;
      row.li.classList.toggle('is-me', isMe);
    }
    if (c.leader !== isLeader) {
      c.leader = isLeader;
      row.li.classList.toggle('is-leader', isLeader);
    }
    if (c.online !== p.online) {
      c.online = p.online;
      row.li.classList.toggle('is-offline', !p.online);
      row.conn.dataset.state = p.online ? 'online' : 'offline';
    }
    const label = `${p.tag}, ${formatNumber(p.score)} points, ${p.facesHeld} faces, ${p.online ? 'online' : 'offline'}`;
    if (c.label !== label) {
      c.label = label;
      row.li.setAttribute('aria-label', label);
    }
  }

  _renderMyScore(players, me) {
    let player = null;
    const myId = this._myPlayerId != null ? String(this._myPlayerId) : me && me.id != null ? String(me.id) : null;
    if (myId != null) player = players.find((p) => p && String(p.id) === myId) || null;
    if (!player) player = me || null;
    const score = player ? Math.max(0, int(player.score)) : 0;
    const scoreEl = this._el.hudScore;
    if (scoreEl) {
      const text = formatNumber(score);
      if (scoreEl.textContent !== text) {
        scoreEl.textContent = text;
        if (score > this._lastScore && this._lastScore !== 0) {
          scoreEl.classList.remove('is-bump');
          void scoreEl.offsetWidth;
          scoreEl.classList.add('is-bump');
          setTimeout(() => scoreEl.classList.remove('is-bump'), 280);
        }
      }
    }
    this._lastScore = score;

    this._setText(
      this._el.hudFaces,
      `FACES ${player ? formatNumber(Math.max(0, int(player.facesHeld))) : '0'}`
    );
    this._setText(this._el.hudClicks, player ? formatNumber(Math.max(0, int(player.clicks))) : '0');
    this._setText(this._el.hudBreaks, player ? formatNumber(Math.max(0, int(player.breaks))) : '0');
    if (this._el.hudFaces) {
      this._el.hudFaces.classList.toggle('is-zero', !player || int(player.facesHeld) === 0);
    }
  }

  _renderTarget() {
    const panel = this._el.hudTarget;
    if (!panel) return;
    const hover = this._hoverInfo;
    if (!hover) {
      if (!panel.hidden) panel.hidden = true;
      return;
    }
    if (panel.hidden) panel.hidden = false;

    const label = String(hover.label || '');
    const depth = Math.max(0, int(hover.depth, Math.max(0, label.split('.').length - 1)));
    const threshold = Math.max(1, int(hover.threshold, this._threshold));
    const maxDepth = Math.max(0, int(hover.maxDepth, this._maxDepth));
    const atMaxDepth = depth >= maxDepth;
    const clicks = finite(hover.clicks) ? Math.max(0, int(hover.clicks)) : null;
    const fillPct = clicks == null ? 0 : clamp((clicks / threshold) * 100, 0, 100);

    const owner = this._resolveOwner(hover);
    const isMine = !!owner && this._myPlayerId != null && String(owner.id) === this._myPlayerId;

    this._setText(this._el.targetLabel, label);
    if (this._el.targetLabel) this._el.targetLabel.classList.toggle('is-deep', label.length > 7);
    this._setText(this._el.targetDepth, `D${depth}`);
    if (this._el.targetDepth) this._el.targetDepth.classList.toggle('is-max', atMaxDepth);

    const ownerEl = this._el.targetOwner;
    if (ownerEl) {
      const tag = owner ? normalizeTag(owner.tag) || 'OPERATOR' : 'UNCLAIMED';
      this._setText(ownerEl.querySelector('b'), isMine ? `${tag} // YOU` : tag);
      ownerEl.classList.toggle('is-mine', isMine);
      ownerEl.classList.toggle('is-unclaimed', !owner);
      const swatch = ownerEl.querySelector('.target-swatch');
      if (swatch) swatch.style.setProperty('--p-color', owner ? owner.color || '#00f0ff' : 'transparent');
    }

    const chargeText = clicks == null ? `— / ${pad2(threshold)}` : `${pad2(clicks)} / ${pad2(threshold)}`;
    this._setText(this._el.targetCharge, chargeText);
    if (this._el.targetChargeFill) this._el.targetChargeFill.style.width = `${fillPct.toFixed(1)}%`;
    const bar = this._el.targetChargeBar;
    if (bar) {
      bar.setAttribute('aria-valuemax', String(threshold));
      bar.setAttribute('aria-valuenow', String(clicks == null ? 0 : Math.min(clicks, threshold)));
    }

    // Terrain accent line + lock/submerged status.
    const terrain = resolveTerrain(hover.terrain || hover);
    const terrainEl = this._el.targetTerrain;
    if (terrainEl) {
      if (terrain && terrain.name) {
        terrainEl.hidden = false;
        terrainEl.style.setProperty('--terrain-color', terrain.color || '#2b6b4b');
        this._setText(this._el.targetTerrainName, String(terrain.name).toUpperCase());
        const elevation = terrain.elevation;
        this._setText(
          this._el.targetTerrainElev,
          finite(elevation) ? `ELEV ${elevation >= 0 ? '+' : '−'}${Math.abs(elevation).toFixed(2)}` : 'ELEV —'
        );
        panel.style.setProperty('--terrain-color', terrain.color || '#2b6b4b');
      } else {
        terrainEl.hidden = true;
        panel.style.removeProperty('--terrain-color');
      }
    }

    const submergeable = !!terrain && terrain.mineable === false;
    const statusEl = this._el.targetStatus;
    let statusText = '';
    let statusState = '';
    if (hover.locked === true) {
      statusText = 'LOCKED // CONTEST REQUIRED';
      statusState = 'locked';
    } else if (submergeable) {
      statusText = 'SUBMERGED // NO SURFACE DEPOSITS';
      statusState = 'submerged';
    }
    if (statusEl) {
      statusEl.hidden = !statusText;
      if (statusText) {
        statusEl.dataset.state = statusState;
        this._setText(this._el.targetStatusText, statusText);
      } else {
        statusEl.removeAttribute('data-state');
      }
    }
    panel.classList.toggle('is-locked', statusState === 'locked');
    panel.classList.toggle('is-submerged', statusState === 'submerged');

    let meta;
    if (atMaxDepth) meta = 'MAX DEPTH // NO FURTHER BREAKS';
    else if (clicks != null && clicks >= threshold) meta = 'BREAKS ON THE NEXT CLICK';
    else if (clicks != null) meta = `${Math.max(1, threshold - clicks)} CLICK${threshold - clicks === 1 ? '' : 'S'} TO BREAK`;
    else meta = `${threshold} CLICKS TO BREAK`;
    if (!owner) meta = `CLICK TO CLAIM // ${meta}`;
    this._setText(this._el.targetMeta, meta);

    const charged = !atMaxDepth && clicks != null && threshold > 1 && clicks >= threshold - 1;
    panel.classList.toggle('is-charged', charged);
    panel.classList.toggle('is-max', atMaxDepth);
    panel.classList.toggle('is-mine', isMine);
    panel.dataset.depth = String(depth);
  }

  _resolveOwner(hover) {
    const state = this._state;
    const players = state && Array.isArray(state.players) ? state.players : [];
    if (hover.owner && typeof hover.owner === 'object') {
      const o = hover.owner;
      return { id: o.id != null ? String(o.id) : null, tag: o.tag, color: o.color };
    }
    if (hover.ownerTag) {
      return { id: hover.ownerId != null ? String(hover.ownerId) : null, tag: hover.ownerTag, color: hover.ownerColor };
    }
    let ownerId = hover.ownerId != null ? String(hover.ownerId) : null;
    if (!ownerId && hover.playerId != null) ownerId = String(hover.playerId);
    if (ownerId) {
      const byId = players.find((p) => p && String(p.id) === ownerId);
      if (byId) return byId;
      return { id: ownerId, tag: hover.ownerTag, color: hover.ownerColor };
    }
    const idx = hover.ownerIndex;
    if (Number.isInteger(idx) && idx >= 0 && players[idx]) return players[idx];
    return null;
  }

  _renderRank(node, rank, total) {
    if (!node) return;
    node.textContent = '';
    const hash = this.doc.createElement('span');
    hash.className = 'rank-hash';
    hash.textContent = '#';
    const numEl = this.doc.createElement('span');
    numEl.className = 'rank-num';
    numEl.textContent = String(rank);
    const of = this.doc.createElement('span');
    of.className = 'rank-total';
    of.textContent = `/ ${total}`;
    node.append(hash, numEl, of);
  }

  _renderReportStats(stats) {
    const el = this._el.reportStats;
    if (!el) return;
    const cells = [
      ['CLICKS', stats.clicks, ''],
      ['BREAKS', stats.breaks, 'acid'],
      ['CLAIMS', stats.claims, 'cyan'],
      ['STEALS', stats.steals, 'magenta'],
      ['FACES HELD', stats.facesHeld, ''],
      ['DEPTH REACHED', `D${stats.depth}`, 'violet'],
      ['ORES MINED', stats.ores, 'gold'],
      ['ORE VALUE', stats.oreValue, 'gold'],
    ];
    const fragment = this.doc.createDocumentFragment();
    for (const [label, value, tone] of cells) {
      const item = this.doc.createElement('div');
      item.className = 'report-stat';
      if (tone) item.dataset.tone = tone;
      const l = this.doc.createElement('span');
      l.className = 'stat-label';
      l.textContent = label;
      const v = this.doc.createElement('span');
      v.className = 'stat-value';
      v.textContent = typeof value === 'number' ? formatNumber(value) : String(value);
      item.append(l, v);
      fragment.appendChild(item);
    }
    el.textContent = '';
    el.appendChild(fragment);
  }

  _renderBestFind(bestFind) {
    const box = this._el.reportBestFind;
    if (!box) return;
    const info = resolveResource(bestFind);
    if (!info) {
      box.hidden = true;
      return;
    }
    const value = Number.isFinite(Number(bestFind && bestFind.value)) ? Number(bestFind.value) : Number(info.value) || 0;
    const color = typeof info.color === 'string' && HEX_RE.test(info.color) ? info.color : '#d7ff00';
    box.hidden = false;
    box.style.setProperty('--res-color', color);
    this._setText(this._el.reportBestFindGlyph, info.glyph || info.name.slice(0, 2));
    this._setText(this._el.reportBestFindName, info.name || String(info.id || 'ORE').toUpperCase());
    this._setText(this._el.reportBestFindValue, `+${formatNumber(value)} CR`);
  }

  _renderMarket() {
    const list = this._el.resourceMarket;
    if (!list || this._marketRendered) return;
    this._marketRendered = true;
    const doc = this.doc;
    const fragment = doc.createDocumentFragment();
    for (const resource of RESOURCE_MARKET) {
      const row = doc.createElement('li');
      row.className = 'market-row';
      row.style.setProperty('--res-color', resource.color);
      row.setAttribute('aria-label', `${resource.name} ore, ${formatNumber(resource.value)} credits per unit`);
      const glyph = doc.createElement('span');
      glyph.className = 'market-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = resource.glyph;
      const name = doc.createElement('span');
      name.className = 'market-name';
      name.textContent = resource.name;
      const price = doc.createElement('span');
      price.className = 'market-price';
      price.textContent = formatNumber(resource.value);
      const unit = doc.createElement('small');
      unit.textContent = ' CR';
      price.appendChild(unit);
      row.append(glyph, name, price);
      fragment.appendChild(row);
    }
    list.textContent = '';
    list.appendChild(fragment);
  }

  _renderBiomeLegend() {
    const legend = this._el.biomeLegend;
    if (!legend || this._biomeLegendRendered) return;
    this._biomeLegendRendered = true;
    const ids = ['deep_ocean', 'ocean', 'coast', 'hills', 'mountain', 'ice'];
    const doc = this.doc;
    const fragment = doc.createDocumentFragment();
    for (const id of ids) {
      const biome = BIOMES[id];
      if (!biome) continue;
      const item = doc.createElement('span');
      item.className = 'biome-item';
      item.style.setProperty('--terrain-color', biome.color);
      const dot = doc.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      const name = doc.createElement('span');
      name.textContent = biome.name;
      item.append(dot, name);
      item.setAttribute('aria-label', `${biome.name} biome`);
      fragment.appendChild(item);
    }
    legend.textContent = '';
    legend.appendChild(fragment);
  }

  _renderMission() {
    const mission = this._mission || normalizeMission(DEFAULT_MISSION);
    const objectives = mission.objectives;
    const doneCount = objectives.filter((objective) => objective.done).length;
    const total = Math.max(1, objectives.length);
    const ready = !!mission.ready || doneCount >= total;

    if (this._el.missionStatus) {
      this._setText(this._el.missionStatus, ready ? 'WARP CORE READY' : 'ESCAPE PROTOCOL');
      this._el.missionStatus.classList.toggle('is-ready', ready);
    }
    if (this._el.joinMissionStatus) {
      this._setText(this._el.joinMissionStatus, ready ? 'WARP CORE READY' : `${doneCount} / ${total} SYSTEMS ONLINE`);
      this._el.joinMissionStatus.classList.toggle('is-ready', ready);
    }
    if (this._el.missionBadge) {
      this._el.missionBadge.hidden = false;
      this._setText(this._el.missionBadge, `${doneCount}/${total}`);
      this._el.missionBadge.classList.toggle('is-ready', ready);
    }
    if (this._el.missionPanel) this._el.missionPanel.classList.toggle('is-ready', ready);
    if (this._el.landingMission) this._el.landingMission.classList.toggle('is-ready', ready);

    const doc = this.doc;
    const lists = doc.querySelectorAll('.mission-list');
    for (const list of lists) {
      const fragment = doc.createDocumentFragment();
      for (const objective of objectives) {
        const li = doc.createElement('li');
        li.className = 'mission-objective';
        li.classList.toggle('is-ready', objective.done);
        li.dataset.objective = objective.id;

        const head = doc.createElement('div');
        head.className = 'mission-obj-head';
        const name = doc.createElement('span');
        name.className = 'mission-obj-name';
        name.textContent = objective.name;
        const state = doc.createElement('span');
        state.className = 'mission-obj-state';
        state.textContent = objective.done ? 'READY' : 'OFFLINE';
        head.append(name, state);
        li.appendChild(head);

        const items = doc.createElement('ul');
        items.className = 'mission-items';
        for (const item of objective.items) {
          const row = doc.createElement('li');
          row.className = 'mission-item';
          row.classList.toggle('is-done', item.done);
          row.style.setProperty('--res-color', item.color);
          row.setAttribute('aria-label', `${item.name}: ${item.have} of ${item.need}`);

          const glyph = doc.createElement('span');
          glyph.className = 'mission-glyph';
          glyph.textContent = item.glyph || item.name.slice(0, 2);
          glyph.setAttribute('aria-hidden', 'true');

          const itemName = doc.createElement('span');
          itemName.className = 'mission-item-name';
          itemName.textContent = item.name;

          const count = doc.createElement('span');
          count.className = 'mission-item-count';
          count.textContent = `${item.have}/${item.need}`;

          const bar = doc.createElement('span');
          bar.className = 'mission-item-bar';
          const fill = doc.createElement('i');
          fill.style.width = `${item.percent}%`;
          bar.appendChild(fill);

          row.append(glyph, itemName, count, bar);
          items.appendChild(row);
        }
        li.appendChild(items);
        fragment.appendChild(li);
      }
      list.textContent = '';
      list.appendChild(fragment);
    }
  }

  _renderReportShare(result, options) {
    let shareUrlRaw =
      typeof options.shareUrl === 'string' && options.shareUrl
        ? options.shareUrl
        : typeof result.shareUrl === 'string'
          ? result.shareUrl
          : '';
    // A shared report may arrive without its own URL: the address is the report.
    if (!shareUrlRaw.trim() && typeof window !== 'undefined' && window.location) {
      shareUrlRaw = window.location.href;
    }
    const shareUrl = shareUrlRaw.trim();
    this._shareUrl = shareUrl;

    const anchor = this._el.reportShareUrl;
    if (anchor) {
      if (shareUrl) {
        anchor.href = shareUrl;
        anchor.textContent = shareUrl;
        anchor.title = shareUrl;
        anchor.classList.remove('is-empty');
        anchor.removeAttribute('aria-disabled');
      } else {
        anchor.removeAttribute('href');
        anchor.textContent = 'LINK UNAVAILABLE';
        anchor.classList.add('is-empty');
        anchor.setAttribute('aria-disabled', 'true');
      }
    }
  }

  _setHighlightTag(tag) {
    const next = normalizeTag(tag);
    if (next === this._highlightTag) return;
    this._highlightTag = next;
    this._leaderboardSig = null; // force highlight paint
    if (this._leaderboard.length) this._renderArcadeLists();
  }

  _renderArcadeLists() {
    const doc = this.doc;
    if (!doc) return;
    const lists = doc.querySelectorAll('.arcade-list');
    const entries = this._leaderboard;
    for (const list of lists) {
      const limit = Math.max(1, Math.min(20, int(list.dataset.limit, 10)));
      const fragment = doc.createDocumentFragment();
      if (!entries.length) {
        const empty = doc.createElement('li');
        empty.className = 'arcade-empty';
        empty.textContent = 'NO RECORDS // BE THE FIRST';
        fragment.appendChild(empty);
      } else {
        const top = entries.slice(0, limit);
        for (let i = 0; i < top.length; i++) {
          const entry = top[i];
          const row = doc.createElement('li');
          row.className = 'arcade-row';
          if (i === 0) row.classList.add('rank-1');
          else if (i === 1) row.classList.add('rank-2');
          else if (i === 2) row.classList.add('rank-3');
          if (this._highlightTag && entry.tag === this._highlightTag) row.classList.add('is-me');

          const rank = doc.createElement('span');
          rank.className = 'arcade-rank';
          rank.textContent = pad2(i + 1);

          const tag = doc.createElement('span');
          tag.className = 'arcade-tag';
          tag.textContent = entry.tag;

          const score = doc.createElement('span');
          score.className = 'arcade-score';
          score.textContent = formatNumber(entry.score);

          const faces = doc.createElement('span');
          faces.className = 'arcade-faces';
          faces.textContent = `${formatNumber(entry.facesHeld)}F`;

          row.setAttribute(
            'aria-label',
            `Rank ${i + 1}: ${entry.tag}, score ${formatNumber(entry.score)}, ${entry.facesHeld} faces held, ${entry.breaks} breaks`
          );
          row.append(rank, tag, score, faces);
          fragment.appendChild(row);
        }
      }
      list.textContent = '';
      list.appendChild(fragment);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Module helpers
 * ------------------------------------------------------------------ */

function resolveResource(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const found = resourceById(value);
    return found ? { ...found } : null;
  }
  if (typeof value !== 'object') return null;
  const byId = value.id ? resourceById(value.id) : null;
  const merged = { ...(byId || {}), ...value };
  if (!merged.name && !merged.glyph) return null;
  return merged;
}

function normalizeMission(progress) {
  const source = progress && typeof progress === 'object' && Array.isArray(progress.objectives) ? progress : DEFAULT_MISSION;
  const objectives = source.objectives
    .filter((objective) => objective && typeof objective === 'object')
    .map((objective, index) => {
      const items = (Array.isArray(objective.items) ? objective.items : [])
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const need = Math.max(1, Math.round(Number(item.need) || 1));
          const have = Math.max(0, Math.min(need, Math.round(Number(item.have) || 0)));
          const done = item.done === true || have >= need;
          return {
            resourceId: cleanId(item.resourceId || item.id),
            name: String(item.name || item.id || 'ORE').toUpperCase(),
            glyph: String(item.glyph || String(item.name || '?').slice(0, 2)),
            color: typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#00f0ff',
            need,
            have,
            done,
            percent: Math.round((have / need) * 100),
          };
        });
      return {
        id: String(objective.id || `objective-${index}`),
        name: String(objective.name || 'SYSTEM').toUpperCase(),
        items,
        done: items.length > 0 && items.every((item) => item.done),
      };
    });
  return {
    ready: source.ready === true || (objectives.length > 0 && objectives.every((objective) => objective.done)),
    objectives,
  };
}

function cleanId(value) {
  return String(value == null ? '' : value).trim();
}

function resolveTerrain(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const found = Object.values(BIOMES).find((biome) => biome.id === value || biome.name.toLowerCase() === value.toLowerCase());
    return found ? { name: found.name, color: found.color, mineable: found.mineable, elevation: NaN } : null;
  }
  if (typeof value !== 'object') return null;
  let biome = value.biome && typeof value.biome === 'object' ? value.biome : null;
  if (!biome && typeof value.biome === 'string') biome = Object.values(BIOMES).find((b) => b.id === value.biome) || null;
  if (!biome && value.id) biome = BIOMES[value.id] || null;
  const name = value.name || (biome && biome.name);
  if (!name) return null;
  return {
    name,
    color: value.color || (biome && biome.color) || '#2b6b4b',
    mineable: typeof value.mineable === 'boolean' ? value.mineable : biome ? biome.mineable !== false : true,
    elevation: Number.isFinite(Number(value.elevation)) ? Number(value.elevation) : NaN,
  };
}

function resolveElements(doc) {
  const byId = (id) => doc.getElementById(id);
  return {
    joinOverlay: byId('join-overlay'),
    joinForm: byId('join-form'),
    tagInput: byId('tag-input'),
    btnJoin: byId('btn-join'),
    joinError: byId('join-error'),
    joinArcade: byId('join-arcade'),
    liveCount: byId('live-count'),
    worldStats: byId('world-stats'),
    worldFaces: byId('world-faces'),
    worldDepth: byId('world-depth'),
    worldClicks: byId('world-clicks'),
    worldBreaks: byId('world-breaks'),
    worldRule: byId('world-rule'),
    hud: byId('hud'),
    hudWorld: byId('hud-world'),
    hudScore: byId('hud-score'),
    hudFaces: byId('hud-faces'),
    hudClicks: byId('hud-clicks'),
    hudBreaks: byId('hud-breaks'),
    btnAbandon: byId('btn-abandon'),
    btnDockAbandon: byId('btn-dock-abandon'),
    btnNewPilot: byId('btn-new-pilot'),
    interludePlanet: byId('interlude-planet'),
    confirmOverlay: byId('confirm-overlay'),
    confirmTitle: byId('confirm-title'),
    confirmMessage: byId('confirm-message'),
    btnConfirmYes: byId('btn-confirm-yes'),
    btnConfirmCancel: byId('btn-confirm-cancel'),
    planetBadge: byId('planet-badge'),
    planetBadgeName: byId('planet-badge-name'),
    planetBadgeDepth: byId('planet-badge-depth'),
    btnEscape: byId('btn-escape'),
    escapeCta: byId('escape-cta'),
    escapeCtaTitle: byId('escape-cta-title'),
    escapeCtaSub: byId('escape-cta-sub'),
    btnEscapeCenter: byId('btn-escape-center'),
    btnEscapeDismiss: byId('btn-escape-dismiss'),
    landingBrief: byId('landing-brief'),
    landingBriefTitle: byId('landing-brief-title'),
    landingBriefSub: byId('landing-brief-sub'),
    landingBriefList: byId('landing-brief-list'),
    btnLandingBriefStart: byId('btn-landing-brief-start'),
    interludeOverlay: byId('interlude-overlay'),
    interludeFx: byId('interlude-fx'),
    interludeStatus: byId('interlude-status'),
    interludeTitle: byId('interlude-title'),
    interludeSub: byId('interlude-sub'),
    interludeStory: byId('interlude-story'),
    interludeBar: byId('interlude-bar'),
    btnInterludeContinue: byId('btn-interlude-continue'),
    meteorOverlay: byId('meteor-overlay'),
    meteorFx: byId('meteor-fx'),
    meteorTitle: byId('meteor-title'),
    meteorSub: byId('meteor-sub'),
    introOverlay: byId('intro-overlay'),
    introFx: byId('intro-fx'),
    introPhase: byId('intro-phase'),
    introStatus: byId('intro-status'),
    introSub: byId('intro-sub'),
    introBar: byId('intro-bar'),
    introAlarm: byId('intro-alarm'),
    btnSkipIntro: byId('btn-skip-intro'),
    btnReplayIntro: byId('btn-replay-intro'),
    missionPanel: byId('mission-panel'),
    landingMission: byId('landing-mission'),
    missionStatus: byId('mission-status'),
    joinMissionStatus: byId('join-mission-status'),
    missionBadge: byId('mission-badge'),
    btnMission: byId('btn-mission'),
    btnOperators: byId('btn-operators'),
    btnArcade: byId('btn-arcade'),
    drawerScrim: byId('drawer-scrim'),
    btnTargetClose: byId('btn-target-close'),
    hudFind: byId('hud-find'),
    hudFindGlyph: byId('hud-find-glyph'),
    hudFindName: byId('hud-find-name'),
    hudFindValue: byId('hud-find-value'),
    resourceMarket: byId('resource-market'),
    hudZoom: byId('hud-zoom'),
    hudZoomValue: byId('hud-zoom-value'),
    hudZoomFill: byId('hud-zoom-fill'),
    hudZoomDepth: byId('hud-zoom-depth'),
    playersPanel: byId('players-panel'),
    playersList: byId('players-list'),
    playersCount: byId('players-count'),
    playersEmpty: byId('players-empty'),
    arcadePanel: byId('arcade-panel'),
    hudTarget: byId('hud-target'),
    targetLabel: byId('target-label'),
    targetDepth: byId('target-depth'),
    targetOwner: byId('target-owner'),
    targetChargeBar: byId('target-charge-bar'),
    targetChargeFill: byId('target-charge-fill'),
    targetCharge: byId('target-charge'),
    targetMeta: byId('target-meta'),
    targetTerrain: byId('target-terrain'),
    targetTerrainName: byId('target-terrain-name'),
    targetTerrainElev: byId('target-terrain-elev'),
    targetStatus: byId('target-status'),
    targetStatusText: byId('target-status-text'),
    biomeLegend: byId('biome-legend'),
    hudHint: byId('hud-hint'),
    btnReport: byId('btn-report'),
    btnSound: byId('btn-sound'),
    connectionBadge: byId('connection-badge'),
    toastContainer: byId('toast-container'),
    reportOverlay: byId('report-overlay'),
    reportPanel: doc.querySelector('#report-overlay .report-panel'),
    reportTitle: byId('report-title'),
    reportTag: byId('report-tag'),
    reportRank: byId('report-rank'),
    reportScore: byId('report-score'),
    reportSession: byId('report-session'),
    reportStats: byId('report-stats'),
    reportBestFind: byId('report-best-find'),
    reportBestFindGlyph: byId('report-best-find-glyph'),
    reportBestFindName: byId('report-best-find-name'),
    reportBestFindValue: byId('report-best-find-value'),
    reportArcade: byId('report-arcade'),
    reportShareUrl: byId('report-share-url'),
    reportCardPreview: byId('report-card-preview'),
    btnReportDownload: byId('btn-report-download'),
    btnReportShare: byId('btn-report-share'),
    btnReportClose: byId('btn-report-close'),
  };
}

export { UI };
export default UI;
