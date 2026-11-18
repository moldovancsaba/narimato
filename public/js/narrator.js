/**
 * NARIMATO — prerecorded narration + subtitles.
 *
 * Narration is split into sentence-sized clips and played one sentence at a
 * time with a short breath pause between them. Voice and subtitles are
 * independent, persisted toggles (streaming-player UX). Audio files live in
 * public/audio/voice/<cue>__s<n>.m4a and are generated from narrative-data.js;
 * no runtime TTS is required. Dynamic story text maps to story clips by id.
 */

import { NARRATION, VOICE_PROFILES, narrationSegments } from './narrative-data.js';
import { telemetry } from './telemetry.js';

const VOICE_KEY = 'icosa.voice';
const SUBTITLE_KEY = 'icosa.subtitles';
const PROFILE_KEY = 'icosa.voiceProfile';
const DEFAULT_PROFILE = 'george';
const SEGMENT_GAP_MS = 220;
const PLAYBACK_RATE = 0.94; // slower, deliberate delivery
const AUDIO_VERSION = '3.6.0';
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
  const audio = new Map();
  const durations = new Map();

  function collect() {
    for (const id of ['narrative-subtitles', 'subtitle-speaker', 'subtitle-text', 'btn-voice', 'btn-subtitles']) {
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
  }

  function fileId(cueId, index) {
    return `${cueId}__s${index + 1}`;
  }

  function audioUrl(cueId, index, profile = voiceProfile) {
    return `/audio/voice/${profile}/${fileId(cueId, index)}.m4a?v=${AUDIO_VERSION}`;
  }

  // Limited-concurrency warmup: fetch the first sentence of each cue and the
  // next sentence while one is playing. Keeps first-word latency low without
  // downloading all 85 clips at boot.
  const warmQueue = [];
  const warmed = new Set();
  let warmActive = 0;
  function pumpWarm() {
    if (typeof fetch !== 'function') return;
    while (warmActive < 3 && warmQueue.length) {
      const url = warmQueue.shift();
      if (!url || warmed.has(url)) continue;
      warmed.add(url);
      warmActive += 1;
      fetch(url, { cache: 'force-cache' })
        .catch(() => {})
        .finally(() => {
          warmActive -= 1;
          pumpWarm();
        });
    }
  }
  function warmAudio(url) {
    if (!url || warmed.has(url) || warmQueue.includes(url)) return;
    warmQueue.push(url);
    pumpWarm();
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

  function clearTimers() {
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = 0;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = 0;
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
    if (speakerEl) {
      speakerEl.textContent = voiceEnabled && !unlocked ? `${label} · TAP FOR VOICE` : label;
    }
    textEl.textContent = shownText;
    lastSegmentText = shownText;
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
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    currentAudio = null;
    currentAudioId = null;
  }

  function stopSequence({ hide = true } = {}) {
    clearTimers();
    pauseAudio();
    sequence = null;
    pending = null;
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
      return;
    }
    if (voiceEnabled) {
      pauseAudio();
      const a = getAudio(cueId, sequence.index, profile);
      currentAudio = a;
      currentAudioId = `${profile}:${fileId(cueId, sequence.index)}`;
      if (!firstWordMarked) {
        a.addEventListener('playing', () => {
          if (firstWordMarked) return;
          firstWordMarked = true;
          try {
            telemetry.markAudioFirstWord(Math.max(0, Math.round(performance.now())));
          } catch {
            /* telemetry is best-effort */
          }
        }, { once: true });
      }
      try {
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // Browser refused audio before/without a gesture: wait for unlock.
            unlocked = false;
            pending = { ...sequence };
          });
        }
        warmAudio(audioUrl(cueId, sequence.index + 1, profile));
        a.onended = () => {
          currentAudio = null;
          currentAudioId = null;
          if (!sequence) return;
          scheduleAdvance(SEGMENT_GAP_MS);
        };
      } catch {
        pending = { ...sequence };
        return;
      }
      // If the clip never starts (autoplay block), leave it pending; subtitles
      // remain readable until the next gesture.
      return;
    }
    // No voice: subtitles still advance one sentence at a time.
    scheduleAdvance(segmentDuration(cueId, sequence.index, text, profile) + SEGMENT_GAP_MS);
  }

  function advance() {
    if (!sequence) return;
    sequence.index += 1;
    runCurrent();
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
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
    }),
  };
}
