/**
 * NARIMATO — prerecorded narration + subtitles.
 *
 * Narration is split into sentence-sized clips and played one sentence at a
 * time with a short breath pause between them. Voice and subtitles are
 * independent, persisted toggles (streaming-player UX). Audio files live in
 * public/audio/voice/<profile>/<cue>__s<n>.m4a and are generated from
 * narrative-data.js; no runtime TTS is required. Dynamic story text maps to
 * story clips by id. The cache key is generated from the asset content by
 * scripts/generate-voice.mjs (package version + content hash), never hand-edited.
 */

import { NARRATION, VOICE_PROFILES, narrationSegments } from './narrative-data.js';
import { AUDIO_VERSION } from './audio-version.js';
import { telemetry } from './telemetry.js';
import {
  audioPolicy,
  classifyPlaybackError,
  firstWordMs,
  shouldDegradeToCaptions,
} from './shared/audio-policy.js';

const VOICE_KEY = 'icosa.voice';
const SUBTITLE_KEY = 'icosa.subtitles';
const PROFILE_KEY = 'icosa.voiceProfile';
const DEFAULT_PROFILE = 'george';
const SEGMENT_GAP_MS = 220;
const PLAYBACK_RATE = 0.94; // slower, deliberate delivery

/** Optional edge/CDN base for heavy audio assets. Same-origin by default. */
function assetBase() {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="narimato-asset-base"]');
  const raw = meta && meta.getAttribute('content') ? meta.getAttribute('content').trim() : '';
  return raw ? raw.replace(/\/+$/, '') : '';
}
const FALLBACK_MS = 2100;

function readBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return VOICE_PROFILES.some((profile) => profile.id === raw) ? raw : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function writeProfile(value) {
  try {
    localStorage.setItem(PROFILE_KEY, value);
  } catch {
    /* private mode */
  }
}

function writeBool(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* private mode */
  }
}

export function createNarrator() {
  const doc = typeof document !== 'undefined' ? document : null;
  const els = {};
  let voiceEnabled = readBool(VOICE_KEY, true);
  let subtitlesEnabled = readBool(SUBTITLE_KEY, true);
  let voiceProfile = readProfile();
  let unlocked = false;
  let gestureSeen = false;
  let sequence = null; // { cueId, segments, speaker, index }
  let pending = null; // a sequence waiting for the first user gesture
  let currentAudio = null;
  let currentAudioId = null;
  let gapTimer = 0;
  let hideTimer = 0;
  let lastSegmentText = '';
  let firstWordMarked = false;
  let shownSpeaker = '';
  let shownText = '';
  // AUD-01 playback resilience state.
  let watchdogTimer = 0;
  let clipStartedAt = 0;
  let consecutiveFailures = 0;
  let resumeAttempts = 0;
  let forceSubtitleCueId = null; // captions forced for THIS cue after 2 failures
  let statusAnnounced = false;

  function networkHints() {
    const conn = typeof navigator !== 'undefined' ? navigator.connection || navigator.mozConnection || navigator.webkitConnection : null;
    return {
      saveData: !!(conn && conn.saveData),
      effectiveType: (conn && conn.effectiveType) || '',
    };
  }

  function sentencePolicy(text, cueId, index, profile = voiceProfile) {
    const knownDuration = durations.has(`${profile}:${fileId(cueId, index)}`);
    return audioPolicy({
      estimateMs: estimate(text) + SEGMENT_GAP_MS,
      knownDuration,
      ...networkHints(),
      failures: consecutiveFailures,
    });
  }
  const audio = new Map();
  const durations = new Map();

  function collect() {
    for (const id of ['narrative-subtitles', 'subtitle-speaker', 'subtitle-text', 'btn-voice', 'btn-subtitles', 'btn-tap-voice']) {
      els[id] = doc ? doc.getElementById(id) : null;
    }
  }

  function syncControls() {
    if (els['btn-voice']) {
      els['btn-voice'].classList.toggle('is-on', voiceEnabled);
      els['btn-voice'].setAttribute('aria-pressed', voiceEnabled ? 'true' : 'false');
      els['btn-voice'].title = voiceEnabled ? 'Narration voice: on' : 'Narration voice: off';
    }
    if (els['btn-subtitles']) {
      els['btn-subtitles'].classList.toggle('is-on', subtitlesEnabled);
      els['btn-subtitles'].setAttribute('aria-pressed', subtitlesEnabled ? 'true' : 'false');
      els['btn-subtitles'].title = subtitlesEnabled ? 'Subtitles: on' : 'Subtitles: off';
    }
    syncTapVoice();
  }

  function fileId(cueId, index) {
    return `${cueId}__s${index + 1}`;
  }

  function audioUrl(cueId, index, profile = voiceProfile) {
    return `${assetBase()}/audio/voice/${profile}/${fileId(cueId, index)}.m4a?v=${AUDIO_VERSION}`;
  }

  // AUD-01: bounded, abortable prefetch. Concurrency follows `audioPolicy`
  // (saveData -> 1, slow 2G -> 2, otherwise 3) and every queued request owns an
  // AbortController so a superseded cue never competes with the live one.
  const warmQueue = [];
  const warmed = new Set();
  const warmControllers = new Map(); // url -> AbortController
  let warmActive = 0;

  function pumpWarm() {
    if (typeof fetch !== 'function') return;
    const limit = audioPolicy({ estimateMs: 2100, ...networkHints() }).concurrency;
    while (warmActive < limit && warmQueue.length) {
      const entry = warmQueue.shift();
      if (!entry || warmed.has(entry.url)) continue;
      warmed.add(entry.url);
      warmActive += 1;
      warmControllers.set(entry.url, entry.controller);
      fetch(entry.url, { cache: 'force-cache', signal: entry.controller.signal })
        .catch(() => {})
        .finally(() => {
          warmActive -= 1;
          warmControllers.delete(entry.url);
          pumpWarm();
        });
    }
  }

  function warmAudio(url) {
    if (!url || warmed.has(url) || warmQueue.some((entry) => entry.url === url)) return;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    warmQueue.push({ url, controller });
    pumpWarm();
  }

  /** AUD-01: abort every queued/in-flight prefetch from a superseded cue. */
  function supersedePrefetch() {
    const keep = new Set();
    while (warmQueue.length) {
      const entry = warmQueue.shift();
      if (entry.controller) entry.controller.abort();
    }
    for (const [url, controller] of [...warmControllers.entries()]) {
      if (!keep.has(url)) controller.abort();
    }
    // `warmed` only records cache-warm attempts; aborted ones may be retried.
    warmed.clear();
  }
  function scheduleIdle(fn) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout: 1800 });
    } else {
      setTimeout(fn, 900);
    }
  }

  function getAudio(cueId, index, profile = voiceProfile) {
    const id = fileId(cueId, index);
    const cacheKey = `${profile}:${id}`;
    if (audio.has(cacheKey)) return audio.get(cacheKey);
    const a = new Audio(audioUrl(cueId, index, profile));
    a.preload = 'metadata';
    a.volume = 0.88;
    a.playbackRate = PLAYBACK_RATE;
    try {
      a.preservesPitch = true;
    } catch {
      /* older browser */
    }
    a.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(a.duration) && a.duration > 0) durations.set(id, Math.round(a.duration * 1000));
    });
    a.addEventListener('error', () => {
      if (!durations.has(cacheKey)) durations.set(cacheKey, FALLBACK_MS);
    });
    audio.set(cacheKey, a);
    return a;
  }

  function estimate(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    // 152 wpm generator + breath pause; err on the longer side for holds.
    return Math.max(FALLBACK_MS, Math.round((words / 2.45 + 0.65) * 1000));
  }

  function segmentDuration(cueId, index, text, profile = voiceProfile) {
    const raw = durations.get(`${profile}:${fileId(cueId, index)}`);
    return raw ? Math.round(raw / PLAYBACK_RATE) : estimate(text);
  }

  function totalDuration(cueId, segments, profile = voiceProfile) {
    if (!Array.isArray(segments) || !segments.length) return 0;
    let total = 0;
    for (let i = 0; i < segments.length; i += 1) {
      total += segmentDuration(cueId, i, segments[i], profile);
      if (i > 0) total += SEGMENT_GAP_MS;
    }
    return total;
  }

  function clearWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = 0;
  }

  function clearTimers() {
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = 0;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = 0;
    clearWatchdog();
  }

  function syncTapVoice() {
    const btn = els['btn-tap-voice'];
    if (!btn) return;
    const shouldShow = voiceEnabled && !unlocked && !!(pending || (sequence && !currentAudio));
    btn.hidden = !shouldShow;
    btn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  }

  function showTapVoice() {
    if (els['btn-tap-voice']) els['btn-tap-voice'].hidden = false;
  }

  function showBar(speaker, text) {
    if (!subtitlesEnabled) return;
    const wrap = els['narrative-subtitles'];
    const speakerEl = els['subtitle-speaker'];
    const textEl = els['subtitle-text'];
    if (!wrap || !textEl) return;
    wrap.classList.remove('is-hidden');
    wrap.hidden = false;
    const label = String(speaker || 'NARIMATO').toUpperCase();
    shownSpeaker = label;
    shownText = String(text || '');
    if (speakerEl) speakerEl.textContent = label;
    textEl.textContent = shownText;
    lastSegmentText = shownText;
    syncTapVoice();
  }

  function hideSubtitles() {
    const wrap = els['narrative-subtitles'];
    if (wrap) {
      wrap.classList.add('is-hidden');
      wrap.hidden = true;
    }
    lastSegmentText = '';
  }

  function pauseAudio() {
    if (currentAudio) {
      try {
        // AUD-01: mark our own pause so the interruption listener ignores it.
        currentAudio.__intentionalPause = true;
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    currentAudio = null;
    currentAudioId = null;
    clearWatchdog();
  }

  function stopSequence({ hide = true } = {}) {
    clearTimers();
    pauseAudio();
    sequence = null;
    pending = null;
    syncTapVoice();
    if (hide) hideSubtitles();
  }

  function scheduleAdvance(ms) {
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = setTimeout(() => {
      gapTimer = 0;
      advance();
    }, Math.max(120, ms));
  }

  function finishSequence() {
    sequence = null;
    clearTimers();
    gapTimer = setTimeout(() => {
      gapTimer = 0;
      hideSubtitles();
    }, 650);
  }

  function announcePaused() {
    // One status line through the existing polite subtitle region (no new region).
    if (!subtitlesEnabled) return;
    const wrap = els['narrative-subtitles'];
    const speakerEl = els['subtitle-speaker'];
    if (wrap) {
      wrap.classList.remove('is-hidden');
      wrap.hidden = false;
    }
    if (speakerEl) speakerEl.textContent = 'NARRATION PAUSED // CAPTIONS CONTINUE';
  }

  /**
   * AUD-01: one clip failed, never started or was interrupted. Classify, then
   * either re-arm the gesture gate (autoplay) or advance inside the watchdog
   * budget so narration never stalls silently. Two consecutive failures force
   * captions for THIS cue only.
   */
  function onClipStalled(cueId, index, reason) {
    clearWatchdog();
    if (!sequence || sequence.cueId !== cueId || sequence.index !== index) return;
    if (reason === 'superseded') return;
    if (reason === 'gesture') {
      unlocked = false;
      pending = { ...sequence };
      showTapVoice();
      if (subtitlesEnabled) showBar(sequence.speaker, sequence.segments[index]);
      return;
    }
    consecutiveFailures += 1;
    try {
      telemetry.markAudioClipFailure();
    } catch {
      /* telemetry is best-effort */
    }
    pauseAudio();
    const policy = sentencePolicy(sequence.segments[index], cueId, index, sequence.profile);
    if (policy.forceSubtitles) forceSubtitleCueId = cueId;
    if (!statusAnnounced) {
      statusAnnounced = true;
      announcePaused();
    }
    // Captions continue to the next sentence within the bounded gap.
    scheduleAdvance(SEGMENT_GAP_MS + 400);
  }

  /** AUD-01: attempt one interruption resume; degrade to captions after 3. */
  function recoverInterruption() {
    if (!voiceEnabled || !sequence) return false;
    resumeAttempts += 1;
    if (shouldDegradeToCaptions(resumeAttempts, consecutiveFailures)) {
      forceSubtitleCueId = sequence.cueId;
      if (!statusAnnounced) {
        statusAnnounced = true;
        announcePaused();
      }
      pauseAudio();
      advance();
      return false;
    }
    const a = currentAudio;
    if (!a || !a.paused) {
      if (!a) runCurrent();
      return false;
    }
    try {
      a.__intentionalPause = false;
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => onClipStalled(sequence.cueId, sequence.index, 'unknown'));
      }
      try {
        telemetry.markAudioResume();
      } catch {
        /* best-effort */
      }
      return true;
    } catch {
      return false;
    }
  }

  function runCurrent() {
    if (!sequence) return;
    const { cueId, segments, speaker, profile } = sequence;
    if (sequence.index >= segments.length) {
      finishSequence();
      return;
    }
    const text = segments[sequence.index];
    if (subtitlesEnabled) showBar(speaker, text);
    if (voiceEnabled && !unlocked) {
      pending = { ...sequence };
      showTapVoice();
      return;
    }
    if (voiceEnabled && forceSubtitleCueId !== cueId) {
      pauseAudio();
      const a = getAudio(cueId, sequence.index, profile);
      currentAudio = a;
      currentAudioId = `${profile}:${fileId(cueId, sequence.index)}`;
      const policy = sentencePolicy(text, cueId, sequence.index, profile);
      clipStartedAt = performance.now();
      clearWatchdog();
      watchdogTimer = setTimeout(() => {
        watchdogTimer = 0;
        onClipStalled(cueId, sequence.index, 'timeout');
      }, policy.watchdogMs);
      watchdogTimer.unref?.();
      if (!a.__playbackBound) {
        a.__playbackBound = true;
        a.addEventListener('playing', () => {
          clearWatchdog();
          consecutiveFailures = 0;
          resumeAttempts = 0;
          if (firstWordMarked) return;
          firstWordMarked = true;
          try {
            // AUD-01: cue-relative, NOT navigation-relative.
            telemetry.markAudioFirstWord(firstWordMs(clipStartedAt, performance.now()));
          } catch {
            /* telemetry is best-effort */
          }
        });
        a.addEventListener('error', () => {
          if (a !== currentAudio || !sequence) return;
          onClipStalled(sequence.cueId, sequence.index, 'format');
        });
        a.addEventListener('pause', () => {
          if (a !== currentAudio || a.__intentionalPause || a.ended) return;
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          // iOS call / Bluetooth route change without visibilitychange: recover once.
          setTimeout(() => {
            if (a !== currentAudio || !a.paused) return;
            // AUD-01: one resume, then the retry budget degrades to captions.
            recoverInterruption();
          }, 300);
        });
      }
      try {
        a.__intentionalPause = false;
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => onClipStalled(cueId, sequence.index, classifyPlaybackError(err)));
        }
        // Warm only a segment that exists: warming past the last sentence used
        // to request a missing `__s(N+1)` clip (a 404 on every final segment).
        if (sequence.index + 1 < sequence.segments.length) {
          warmAudio(audioUrl(cueId, sequence.index + 1, profile));
        }
        a.onended = () => {
          clearWatchdog();
          consecutiveFailures = 0;
          currentAudio = null;
          currentAudioId = null;
          if (!sequence) return;
          scheduleAdvance(SEGMENT_GAP_MS);
        };
      } catch {
        onClipStalled(cueId, sequence.index, 'unknown');
      }
      return;
    }
    // No voice, autoplay-blocked recovery, or captions forced for this cue:
    // still advance one sentence at a time so text is never left behind.
    scheduleAdvance(segmentDuration(cueId, sequence.index, text, profile) + SEGMENT_GAP_MS);
  }

  function advance() {
    if (!sequence) return;
    sequence.index += 1;
    runCurrent();
  }

  function unlock() {
    gestureSeen = true;
    if (unlocked) {
      syncTapVoice();
      if (voiceEnabled && sequence && !currentAudio) runCurrent();
      return;
    }
    unlocked = true;
    consecutiveFailures = 0;
    resumeAttempts = 0;
    if (els['btn-tap-voice']) els['btn-tap-voice'].hidden = true;
    if (shownText && subtitlesEnabled) showBar(shownSpeaker, shownText);
    if (pending) {
      sequence = pending;
      pending = null;
      runCurrent();
      return;
    }
    if (sequence && !currentAudio && voiceEnabled) runCurrent();
  }

  function startSequence(cueId, segments, speaker) {
    if (!Array.isArray(segments) || !segments.length) return 0;
    stopSequence();
    // AUD-01: a new cue resets the per-cue failure/caption decision.
    forceSubtitleCueId = null;
    consecutiveFailures = 0;
    resumeAttempts = 0;
    statusAnnounced = false;
    sequence = { cueId, segments: segments.slice(), speaker, profile: voiceProfile, index: 0 };
    if (voiceEnabled && !unlocked) {
      showBar(speaker, sequence.segments[0]);
      pending = { ...sequence };
      return totalDuration(cueId, segments, voiceProfile);
    }
    runCurrent();
    return totalDuration(cueId, segments, voiceProfile);
  }

  /** Play a fixed narration cue (intro/tip/help) sentence by sentence. */
  function playCue(id, { speaker = 'NARIMATO', interrupt = true } = {}) {
    const cue = NARRATION[id];
    if (!cue) return 0;
    const segments = narrationSegments(cue);
    if (!segments.length) return 0;
    if (interrupt) stopSequence({ hide: false });
    // AUD-01: a newer cue supersedes the older cue's queued prefetches.
    supersedePrefetch();
    return startSequence(id, segments, speaker);
  }

  /** Play the random interplanetary story sentence by sentence. Returns total ms. */
  function playStory(story, { speaker = 'SHIP LOG' } = {}) {
    if (!story) return 0;
    const cueId = `story-${story.id}`;
    const cue = NARRATION[cueId];
    const segments = cue
      ? narrationSegments(cue)
      : Array.isArray(story.lines) && story.lines.length
        ? story.lines.map((line) => String(line).trim()).filter(Boolean)
        : ['An unknown signal washes over the ship.'];
    supersedePrefetch();
    for (let i = 0; i < segments.length; i += 1) warmAudio(audioUrl(cueId, i, voiceProfile));
    return startSequence(cueId, segments, speaker);
  }

  function storyDuration(id) {
    if (id == null) return 0;
    const cueId = `story-${id}`;
    const cue = NARRATION[cueId];
    return cue ? totalDuration(cueId, narrationSegments(cue), voiceProfile) : 0;
  }

  function profileBy(id) {
    return VOICE_PROFILES.find((profile) => profile.id === id) || VOICE_PROFILES[0];
  }

  function syncProfileButtons() {
    if (!doc) return;
    for (const btn of doc.querySelectorAll('[data-voice-profile]')) {
      const active = btn.getAttribute('data-voice-profile') === voiceProfile;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function preloadProfile(profile) {
    if (typeof Audio === 'undefined') return;
    // Only the first sentence of each cue is warmed at boot. Later sentences
    // and full story packs are fetched as needed / when the transit starts, so
    // the scene does not compete with ~60 audio requests.
    for (const [id, cue] of Object.entries(NARRATION)) {
      const segments = narrationSegments(cue);
      if (!segments.length) continue;
      warmAudio(audioUrl(id, 0, profile));
    }
  }

  function setVoiceProfile(value) {
    const profile = profileBy(value);
    if (profile.id === voiceProfile) return;
    stopSequence();
    voiceProfile = profile.id;
    writeProfile(voiceProfile);
    syncProfileButtons();
    scheduleIdle(() => preloadProfile(voiceProfile));
  }

  function voiceProfileLabel() {
    const profile = profileBy(voiceProfile);
    return `${profile.label} · ${profile.region}`;
  }

  /** Recover a clip paused by tab visibility or an interrupted audio context. */
  function resume() {
    if (!voiceEnabled || !sequence) {
      syncTapVoice();
      return false;
    }
    if (currentAudio && currentAudio.paused) {
      resumeAttempts += 1;
      if (shouldDegradeToCaptions(resumeAttempts, consecutiveFailures)) {
        // Interruption budget exhausted: force captions for this cue.
        forceSubtitleCueId = sequence.cueId;
        if (!statusAnnounced) {
          statusAnnounced = true;
          announcePaused();
        }
        pauseAudio();
        advance();
        return false;
      }
      try {
        currentAudio.__intentionalPause = false;
        const p = currentAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => onClipStalled(sequence.cueId, sequence.index, 'unknown'));
        }
        try {
          telemetry.markAudioResume();
        } catch {
          /* best-effort */
        }
        return true;
      } catch {
        return false;
      }
    }
    if (!currentAudio && !gapTimer && sequence.index < sequence.segments.length) {
      runCurrent();
      return true;
    }
    return false;
  }

  function setVoiceEnabled(value) {
    voiceEnabled = !!value;
    writeBool(VOICE_KEY, voiceEnabled);
    if (!voiceEnabled) {
      pending = null;
      pauseAudio();
      // Keep the current sentence subtitle visible, but stop further playback.
    } else {
      unlock();
    }
    if (shownText && subtitlesEnabled) showBar(shownSpeaker, shownText);
    syncControls();
  }

  function setSubtitlesEnabled(value) {
    subtitlesEnabled = !!value;
    writeBool(SUBTITLE_KEY, subtitlesEnabled);
    if (!subtitlesEnabled) hideSubtitles();
    else if (sequence && sequence.index < sequence.segments.length) {
      showBar(sequence.speaker, sequence.segments[sequence.index]);
    } else if (lastSegmentText) {
      showBar(sequence ? sequence.speaker : 'NARIMATO', lastSegmentText);
    }
    syncControls();
  }

  function bind() {
    collect();
    syncControls();
    syncProfileButtons();
    if (doc) {
      for (const btn of doc.querySelectorAll('[data-voice-profile]')) {
        btn.addEventListener('click', () => setVoiceProfile(btn.getAttribute('data-voice-profile')));
      }
    }
    if (els['btn-voice']) {
      els['btn-voice'].addEventListener('click', () => setVoiceEnabled(!voiceEnabled));
    }
    if (els['btn-subtitles']) {
      els['btn-subtitles'].addEventListener('click', () => setSubtitlesEnabled(!subtitlesEnabled));
    }
    // AUD-01: the real TAP FOR VOICE control resumes the pending sentence.
    if (els['btn-tap-voice']) {
      els['btn-tap-voice'].addEventListener('click', () => unlock());
    }
    if (typeof window !== 'undefined') {
      const onGesture = () => unlock();
      window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
      window.addEventListener('keydown', onGesture, { capture: true });
    }
    // Warm metadata and first lines after the scene settles, not during boot.
    scheduleIdle(() => preloadProfile(voiceProfile));
  }

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bind, { once: true });
    else bind();
  }

  return {
    get voiceEnabled() {
      return voiceEnabled;
    },
    get subtitlesEnabled() {
      return subtitlesEnabled;
    },
    get unlocked() {
      return unlocked;
    },
    get voiceProfile() {
      return voiceProfile;
    },
    setVoiceProfile,
    get speaking() {
      return !!sequence && !!currentAudio;
    },
    playCue,
    playStory,
    storyDuration,
    setVoiceEnabled,
    setSubtitlesEnabled,
    unlock,
    resume,
    stop() {
      stopSequence();
    },
    state: () => ({
      voiceEnabled,
      subtitlesEnabled,
      profile: voiceProfile,
      profileLabel: voiceProfileLabel(),
      unlocked,
      speaking: !!sequence && !!currentAudio,
      segment: sequence ? sequence.index + 1 : 0,
      totalSegments: sequence ? sequence.segments.length : 0,
      subtitle: els['subtitle-text'] && !els['narrative-subtitles'].hidden ? els['subtitle-text'].textContent : '',
      tapVoiceVisible: !!(els['btn-tap-voice'] && !els['btn-tap-voice'].hidden),
      clipFailures: consecutiveFailures,
      forcedCaptions: !!sequence && forceSubtitleCueId === sequence.cueId,
      watchdogMs: watchdogTimer ? 1 : 0,
      gestureSeen,
    }),
  };
}
