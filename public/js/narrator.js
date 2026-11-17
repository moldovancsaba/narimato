/**
 * NARIMATO — prerecorded narration + subtitles.
 *
 * Voice and subtitles are independent, persisted toggles (streaming-player UX).
 * Audio files live in public/audio/voice/*.m4a and are generated from
 * narrative-data.js; no runtime TTS is required. Dynamic story text comes from
 * the server but maps to prerecorded story clips by story id.
 */

import { NARRATION } from './narrative-data.js';

const VOICE_KEY = 'icosa.voice';
const SUBTITLE_KEY = 'icosa.subtitles';

function readBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writeBool(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* private mode */
  }
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createNarrator() {
  const doc = typeof document !== 'undefined' ? document : null;
  const els = {};
  let voiceEnabled = readBool(VOICE_KEY, true);
  let subtitlesEnabled = readBool(SUBTITLE_KEY, true);
  let unlocked = false;
  let pending = null;
  let current = null;
  let currentLines = null;
  let currentSpeaker = 'NARIMATO';
  let hideTimer = 0;
  const lineTimers = [];
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

  function getAudio(id) {
    if (audio.has(id)) return audio.get(id);
    const a = new Audio(`/audio/voice/${id}.m4a`);
    a.preload = 'metadata';
    a.volume = 0.86;
    a.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(a.duration) && a.duration > 0) durations.set(id, Math.round(a.duration * 1000));
    });
    a.addEventListener('error', () => {
      // Missing asset/codec: keep subtitles working rather than failing hard.
      durations.set(id, durations.get(id) || estimate(NARRATION[id] ? NARRATION[id].text : ''));
    });
    audio.set(id, a);
    return a;
  }

  function estimate(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1800, Math.round((words / 2.65 + 0.9) * 1000));
  }

  function clearTimers() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = 0;
    while (lineTimers.length) clearTimeout(lineTimers.pop());
  }

  function showBar(speaker, text) {
    if (!subtitlesEnabled) return;
    const wrap = els['narrative-subtitles'];
    const speakerEl = els['subtitle-speaker'];
    const textEl = els['subtitle-text'];
    if (!wrap || !textEl) return;
    wrap.classList.remove('is-hidden');
    wrap.hidden = false;
    if (speakerEl) speakerEl.textContent = String(speaker || 'NARIMATO').toUpperCase();
    textEl.textContent = String(text || '');
    currentSpeaker = speaker || 'NARIMATO';
  }

  function hideSubtitles() {
    const wrap = els['narrative-subtitles'];
    if (wrap) {
      wrap.classList.add('is-hidden');
      wrap.hidden = true;
    }
    currentLines = null;
  }

  function showSingle(text, durationMs) {
    clearTimers();
    currentLines = null;
    showBar(currentSpeaker, text);
    if (!subtitlesEnabled) return;
    hideTimer = setTimeout(hideSubtitles, Math.max(1200, durationMs + 500));
  }

  function scheduleLines(lines, durationMs) {
    clearTimers();
    if (!subtitlesEnabled) return;
    const list = Array.isArray(lines) && lines.length ? lines : ['NARIMATO'];
    currentLines = list;
    const weights = list.map((line) => Math.max(10, String(line).length));
    const total = weights.reduce((a, b) => a + b, 0);
    showBar(currentSpeaker, list[0]);
    let at = 0;
    for (let i = 0; i < list.length; i += 1) {
      const delay = Math.round((at / total) * durationMs);
      const step = Math.round((weights[i] / total) * durationMs);
      if (i > 0) {
        lineTimers.push(setTimeout(() => showBar(currentSpeaker, list[i]), delay));
      }
      at += weights[i];
      if (i === list.length - 1) {
        lineTimers.push(setTimeout(hideSubtitles, delay + step + 600));
      }
    }
  }

  function stopAudio() {
    if (!current) return;
    const a = audio.get(current);
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    current = null;
  }

  function playAudio(id) {
    const cue = NARRATION[id];
    if (!cue) return false;
    stopAudio();
    const a = getAudio(id);
    current = id;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay was blocked: keep the cue pending until a real gesture.
          unlocked = false;
          pending = id;
        });
      }
      return true;
    } catch {
      pending = id;
      return false;
    }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (pending) {
      const id = pending;
      pending = null;
      if (voiceEnabled) playAudio(id);
    }
  }

  /** Play a fixed narration cue (intro/tip/help) with optional subtitles. */
  function playCue(id, { speaker = 'NARIMATO', interrupt = true } = {}) {
    const cue = NARRATION[id];
    if (!cue) return 0;
    if (interrupt) stopAudio();
    currentSpeaker = speaker;
    const duration = durations.get(id) || estimate(cue.text);
    if (subtitlesEnabled) {
      if (Array.isArray(cue.lines) && cue.lines.length) scheduleLines(cue.lines, duration);
      else showSingle(cue.text, duration);
    }
    if (voiceEnabled) {
      if (!unlocked) {
        pending = id;
      } else {
        playAudio(id);
      }
    }
    return duration;
  }

  /** Play the random interplanetary story. Returns duration (ms). */
  function playStory(story, { speaker = 'SHIP LOG' } = {}) {
    if (!story) return 0;
    const id = `story-${story.id}`;
    const cue = NARRATION[id];
    const lines = Array.isArray(story.lines) && story.lines.length
      ? story.lines
      : cue && Array.isArray(cue.lines) && cue.lines.length
        ? cue.lines
        : [cue ? cue.text : 'An unknown signal washes over the ship.'];
    currentSpeaker = speaker;
    stopAudio();
    const duration = durations.get(id) || estimate((cue && cue.text) || lines.join(' '));
    if (subtitlesEnabled) scheduleLines(lines, duration);
    if (voiceEnabled) {
      if (!unlocked) pending = id;
      else playAudio(id);
    }
    return duration;
  }

  function storyDuration(id) {
    if (id == null) return 0;
    return durations.get(`story-${id}`) || estimate((NARRATION[`story-${id}`] || {}).text || '');
  }

  function setVoiceEnabled(value) {
    voiceEnabled = !!value;
    writeBool(VOICE_KEY, voiceEnabled);
    if (!voiceEnabled) {
      pending = null;
      stopAudio();
    } else {
      unlock();
      if (pending) {
        const id = pending;
        pending = null;
        playAudio(id);
      }
    }
    syncControls();
  }

  function setSubtitlesEnabled(value) {
    subtitlesEnabled = !!value;
    writeBool(SUBTITLE_KEY, subtitlesEnabled);
    if (!subtitlesEnabled) hideSubtitles();
    else if (currentLines) {
      // Re-show the script from its current beginning (subtitles are a transcript).
      scheduleLines(currentLines, 4000);
    }
    syncControls();
  }

  function bind() {
    collect();
    syncControls();
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
    // Warm metadata for story duration and instant playback.
    if (typeof Audio !== 'undefined') {
      for (const id of Object.keys(NARRATION)) {
        if (id.startsWith('story-') || id.startsWith('intro-')) getAudio(id);
      }
    }
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
    get speaking() {
      return !!current;
    },
    playCue,
    playStory,
    storyDuration,
    setVoiceEnabled,
    setSubtitlesEnabled,
    unlock,
    stop() {
      pending = null;
      stopAudio();
      clearTimers();
      hideSubtitles();
    },
    state: () => ({
      voiceEnabled,
      subtitlesEnabled,
      unlocked,
      speaking: !!current,
      subtitle: els['subtitle-text'] ? els['subtitle-text'].textContent : '',
    }),
  };
}
