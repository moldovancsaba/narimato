/**
 * NARIMATO — island → game intent bridge (UI-02…UI-05).
 *
 * The island never touches game state. Every interaction is a DOM CustomEvent
 * the page adapter (`public/js/gds-boot.js`) forwards to the frozen `UI`
 * controller. This keeps the island free of `window.__ICOSA__` knowledge and
 * lets the legacy UI keep ownership of every action while it is behind the
 * kill switch.
 */

export const INTENT_EVENT = 'narimato:gds-intent';

/** Dispatch one intent; returns false when there is no browser to receive it. */
export function dispatchIntent(type, detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return false;
  const event = new CustomEvent(INTENT_EVENT, {
    detail: Object.freeze({ type: String(type), ...detail }),
    bubbles: false,
  });
  window.dispatchEvent(event);
  return true;
}

/** Stable ids used by selectors, tests and the DOM contract. */
export const IDS = Object.freeze({
  hud: 'hud',
  score: 'hud-score',
  faces: 'hud-faces',
  clicks: 'hud-clicks',
  breaks: 'hud-breaks',
  world: 'hud-world',
  planet: 'planet-badge',
  nav: 'nav-chip',
  mission: 'mission-panel',
  missionList: 'mission-list',
  missionStatus: 'mission-status',
  missionBadge: 'mission-badge',
  cargoList: 'cargo-list',
  cargoTotal: 'cargo-total',
  players: 'players-panel',
  playersList: 'players-list',
  playersCount: 'players-count',
  arcade: 'arcade-panel',
  target: 'hud-target',
  chargeBar: 'target-charge-bar',
  zoom: 'hud-zoom',
  dock: 'mobile-dock',
  hint: 'hud-hint',
  escape: 'btn-escape',
  escapeCenter: 'btn-escape-center',
  abandon: 'btn-abandon',
  navFocus: 'btn-nav-focus',
  navNext: 'btn-nav-next',
  targetClose: 'btn-target-close',
  landing: 'join-overlay',
  tagInput: 'tag-input',
  tagForm: 'join-form',
  joinButton: 'btn-join',
  joinError: 'join-error',
  liveCount: 'live-count',
  newPilot: 'btn-new-pilot',
  guide: 'guide-overlay',
  guideHow: 'guide-how-copy',
  manual: 'manual-overlay',
  manualSections: 'manual-sections',
  report: 'report-overlay',
  reportCard: 'report-card-preview',
  reportShare: 'report-share-url',
  confirm: 'confirm-overlay',
  toasts: 'toast-container',
  connection: 'connection-badge',
  sound: 'btn-sound',
  subtitles: 'btn-subtitles',
  voice: 'btn-voice',
  help: 'btn-help',
  replay: 'btn-replay-intro',
  captions: 'narrative-subtitles',
  intro: 'intro-overlay',
  interlude: 'interlude-overlay',
  surface: 'surface-controls',
  surfaceTarget: 'surface-target',
  surfaceLap: 'surface-lap',
  surfaceLapValue: 'surface-lap-value',
  surfaceExit: 'btn-surface-exit',
  controlMode: 'control-mode',
  controlModeLabel: 'control-mode-label',
  controlModeDrag: 'btn-drag-mode',
  controlModeAction: 'btn-control-mode',
  controlModeReason: 'control-mode-reason',
  controlModeLive: 'control-mode-live',
});
