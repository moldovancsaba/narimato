/**
 * NARIMATO — audio playback policy (AUD-01).
 *
 * Pure decisions for prerecorded narration: how long a clip may take to start
 * before the watchdog advances, how many prefetches may run at once, when to
 * stop retrying and force captions. No DOM, no timers, no network — the effect
 * layer (`narrator.js`) owns those. Node-importable so every branch is unit
 * tested without a browser.
 *
 * Contract (issue #37):
 *   audioPolicy({estimateMs, knownDuration, saveData, effectiveType, failures})
 *     -> { watchdogMs, concurrency, forceSubtitles, retry }
 */

export const WATCHDOG_MIN_MS = 1500;
export const WATCHDOG_MAX_MS = 6000;
export const RETRY_LIMIT = 3;
export const FAILURES_FOR_CAPTIONS = 2;
export const FIRST_WORD_MIN_MS = 0;
export const FIRST_WORD_MAX_MS = 120_000;

const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/** True for connections that should not fan out prefetches. */
export function isSlowNetwork({ saveData = false, effectiveType = '' } = {}) {
  const type = String(effectiveType || '').toLowerCase();
  return saveData === true || type === 'slow-2g' || type === '2g';
}

/**
 * Decide watchdog, prefetch fan-out and caption fallback for one sentence.
 *
 * @param {{estimateMs?:number, knownDuration?:boolean, saveData?:boolean, effectiveType?:string, failures?:number}} [input]
 * @returns {{watchdogMs:number, concurrency:1|2|3, forceSubtitles:boolean, retry:'none'|'metadata-only'}}
 */
export function audioPolicy(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const estimate = finite(source.estimateMs) ? Math.max(0, source.estimateMs) : 2100;
  const known = source.knownDuration === true;
  const failures = finite(source.failures) ? Math.max(0, Math.trunc(source.failures)) : 0;
  const slow = isSlowNetwork(source);
  // Known duration: 1.6× is enough headroom; estimates get 2.2× because the
  // first clip of a cold sentence may include a metadata round-trip.
  const factor = known ? 1.6 : 2.2;
  return {
    watchdogMs: Math.round(clamp(estimate * factor, WATCHDOG_MIN_MS, WATCHDOG_MAX_MS)),
    concurrency: source.saveData === true ? 1 : slow ? 2 : 3,
    forceSubtitles: failures >= FAILURES_FOR_CAPTIONS,
    retry: failures === 0 ? 'none' : 'metadata-only',
  };
}

/**
 * Map a `play()` rejection to a stable failure reason.
 * `NotAllowedError` re-arms the gesture gate; everything else advances.
 */
export function classifyPlaybackError(error) {
  const name = String((error && (error.name || error.code)) || '').trim();
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'gesture';
  if (name === 'NotSupportedError') return 'format';
  if (name === 'AbortError') return 'superseded';
  return 'unknown';
}

/** Cue-relative first-word measurement, clamped to a plausible range (ms). */
export function firstWordMs(cueStartedAt, nowMs) {
  if (!finite(cueStartedAt) || !finite(nowMs)) return FIRST_WORD_MIN_MS;
  return clamp(Math.round(nowMs - cueStartedAt), FIRST_WORD_MIN_MS, FIRST_WORD_MAX_MS);
}

/** True when the interruption retry budget is exhausted. */
export function shouldDegradeToCaptions(attempts, failures = 0) {
  const tries = finite(attempts) ? Math.max(0, Math.trunc(attempts)) : 0;
  const failed = finite(failures) ? Math.max(0, Math.trunc(failures)) : 0;
  return tries >= RETRY_LIMIT || failed >= FAILURES_FOR_CAPTIONS;
}
