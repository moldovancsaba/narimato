/**
 * NARIMATO — narration asset pipeline helpers (STR-01).
 *
 * Pure, dependency-free helpers shared by:
 *   - `scripts/generate-voice.mjs`  (writes the audio tree, manifest and version module)
 *   - `scripts/verify-voice.mjs`    (operator drift check, `npm run voice:verify`)
 *   - `test/narration-manifest.test.js` (proves no clip reference is missing)
 *
 * Zero npm dependencies. Node >= 20.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NARRATION, VOICE_PROFILES, narrationSegments } from '../public/js/narrative-data.js';

/** Audio lineage version format: `<package version>+<content hash8>`. */
export const AUDIO_VERSION_PATTERN = /^\d+\.\d+\.\d+\+[0-9a-f]{8}$/;
/** Every committed clip must be at least this long; shorter reads as a broken encode. */
export const MIN_CLIP_MS = 120;
/** Narration payload budget for the full matrix (STR-01 §16). */
export const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;
/** `public/audio/voice/george/event-relief__s1.m4a` → cue id + segment. */
export const CLIP_FILE_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)__s(\d+)\.m4a$/;
export const VOICE_DIR = 'public/audio/voice';
export const MANIFEST_FILE = `${VOICE_DIR}/manifest.json`;
export const AUDIO_VERSION_FILE = 'public/js/audio-version.js';
export const AUDIO_ENGINES = Object.freeze(['kokoro', 'say']);

/** Every cue with its ordered sentence units. */
export function cueEntries(narration = NARRATION) {
  return Object.entries(narration).map(([cueId, cue]) => ({ cueId, segments: narrationSegments(cue) }));
}

/** Cue/segment totals for the whole script. */
export function cueTotals(narration = NARRATION) {
  const cues = cueEntries(narration);
  return { cues: cues.length, segments: cues.reduce((sum, cue) => sum + cue.segments.length, 0) };
}

/** The authoritative (cue × segment × profile) clip plan. */
export function requiredClips(narration = NARRATION, profiles = VOICE_PROFILES) {
  const clips = [];
  for (const profile of profiles) {
    for (const { cueId, segments } of cueEntries(narration)) {
      segments.forEach((text, index) => {
        clips.push({ cueId, segment: index + 1, profile: profile.id, text });
      });
    }
  }
  return clips;
}

/** Repo-relative path of one clip. */
export function clipPath(cueId, segment, profileId) {
  return `${VOICE_DIR}/${profileId}/${cueId}__s${segment}.m4a`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function textSha(text) {
  return sha256(String(text));
}

/**
 * Content-derived cache key: stable across re-runs and changes whenever any
 * spoken sentence changes (text is the audio source, STR-01 §11).
 */
export function contentHash8(clips) {
  const canonical = clips
    .map((clip) => `${clip.profile}|${clip.cueId}|${clip.segment}|${clip.textSha}`)
    .sort()
    .join('\n');
  return sha256(canonical).slice(0, 8);
}

export function audioVersionFor(packageVersion, clips) {
  return `${packageVersion}+${contentHash8(clips)}`;
}

/**
 * Manifest profile records. Every profile must carry engine, voice, licence and
 * attribution; a profile without a licence string fails generation (§17).
 */
export function profileEntries(profiles = VOICE_PROFILES) {
  return profiles.map((profile) => {
    const missing = ['id', 'engine', 'voice', 'license', 'attribution'].filter(
      (field) => typeof profile[field] !== 'string' || !profile[field].trim()
    );
    if (missing.length) {
      throw new Error(`profile "${profile.id || '?'}" is missing ${missing.join(', ')}`);
    }
    if (!AUDIO_ENGINES.includes(profile.engine)) {
      throw new Error(`profile "${profile.id}" has unsupported engine "${profile.engine}"`);
    }
    return {
      id: profile.id,
      engine: profile.engine,
      voice: profile.voice,
      license: profile.license,
      attribution: profile.attribution,
    };
  });
}

/**
 * Refuse to write a partial tree. `NARIMATO_SKIP_KOKORO=1` on a profile set that
 * contains a Kokoro voice must fail before any asset is touched (§15.3).
 */
export function assertGeneratable(profiles = VOICE_PROFILES, { skipKokoro = false } = {}) {
  profileEntries(profiles);
  if (!skipKokoro) return { skippedProfiles: [] };
  const skipped = profiles.filter((profile) => profile.engine === 'kokoro').map((profile) => profile.id);
  if (skipped.length) {
    throw new Error(
      `NARIMATO_SKIP_KOKORO=1 would ship a partial tree (missing profile(s): ${skipped.join(', ')}); ` +
        'install Kokoro or remove the profile from VOICE_PROFILES deliberately'
    );
  }
  return { skippedProfiles: [] };
}

/** Assemble the committed manifest from already-encoded clip records. */
export function buildManifest({ packageVersion, clips, profiles = VOICE_PROFILES, narration = NARRATION }) {
  const ordered = clips
    .slice()
    .sort((a, b) => a.profile.localeCompare(b.profile) || a.cueId.localeCompare(b.cueId) || a.segment - b.segment);
  const totals = cueTotals(narration);
  return {
    version: audioVersionFor(packageVersion, ordered),
    profiles: profileEntries(profiles),
    clips: ordered,
    totals: { cues: totals.cues, segments: totals.segments, clips: ordered.length },
  };
}

/** The generated version module text (the generator is its only writer). */
export function audioVersionModule(version) {
  return [
    '/**',
    ' * GENERATED by scripts/generate-voice.mjs — do not edit.',
    ' * Narration cache key: package version + content hash of the spoken sentences.',
    ' */',
    `export const AUDIO_VERSION = '${version}';`,
    '',
  ].join('\n');
}

/**
 * Validate a manifest against the narration script and (when `root` is given)
 * the committed audio tree. Returns findings; an empty array means clean.
 */
export function validateManifest(manifest, { narration = NARRATION, profiles = VOICE_PROFILES, packageVersion, root = null } = {}) {
  const findings = [];
  const add = (code, detail) => findings.push({ code, ...detail });
  if (!manifest || typeof manifest !== 'object') {
    add('MANIFEST_MISSING', { message: 'manifest is missing' });
    return findings;
  }
  if (typeof manifest.version !== 'string' || !AUDIO_VERSION_PATTERN.test(manifest.version)) {
    add('VERSION_FORMAT', { value: manifest.version, message: 'version must be <semver>+<8 hex>' });
  }
  if (!Array.isArray(manifest.profiles)) add('PROFILE_MISSING', { message: 'profiles must be an array' });
  if (!Array.isArray(manifest.clips)) add('CLIP_MISSING', { message: 'clips must be an array' });
  if (findings.length) return findings;

  const expectedProfiles = profileEntries(profiles);
  const seenProfiles = new Set(manifest.profiles.map((profile) => profile.id));
  for (const profile of expectedProfiles) {
    if (!seenProfiles.has(profile.id)) add('PROFILE_MISSING', { id: profile.id });
  }
  for (const profile of manifest.profiles) {
    if (!expectedProfiles.some((entry) => entry.id === profile.id)) add('PROFILE_EXTRA', { id: profile.id });
    for (const field of ['engine', 'voice', 'license', 'attribution']) {
      if (typeof profile[field] !== 'string' || !profile[field].trim()) {
        add('PROFILE_NO_LICENSE', { id: profile.id, field });
      }
    }
  }

  const plan = requiredClips(narration, profiles);
  const expectedTextSha = new Map();
  for (const clip of plan) {
    expectedTextSha.set(`${clip.profile}|${clip.cueId}|${clip.segment}`, textSha(clip.text));
  }

  const seenClips = new Set();
  let payloadBytes = 0;
  for (const clip of manifest.clips) {
    const key = `${clip.profile}|${clip.cueId}|${clip.segment}`;
    if (seenClips.has(key)) add('DUPLICATE_CLIP', { key });
    seenClips.add(key);
    const expectedSha = expectedTextSha.get(key);
    if (!expectedSha) {
      add('CLIP_ORPHAN', { key });
      continue;
    }
    if (clip.textSha !== expectedSha) add('TEXT_SHA_MISMATCH', { key });
    if (!CLIP_FILE_PATTERN.test(path.basename(String(clip.file || '')))) {
      add('FILE_INVALID', { key, file: clip.file });
      continue;
    }
    if (!Number.isFinite(clip.bytes) || clip.bytes <= 0) add('BYTES_MISMATCH', { key, bytes: clip.bytes });
    if (!Number.isFinite(clip.durationMs) || clip.durationMs < MIN_CLIP_MS) {
      add('SHORT_CLIP', { key, durationMs: clip.durationMs });
    }
    payloadBytes += Number(clip.bytes) || 0;
    if (root) {
      const full = path.join(root, String(clip.file));
      let data = null;
      try {
        data = fs.readFileSync(full);
      } catch {
        data = null;
      }
      if (!data) {
        add('FILE_MISSING', { key, file: clip.file });
      } else {
        if (data.length !== clip.bytes) add('BYTES_MISMATCH', { key, bytes: data.length, manifest: clip.bytes });
        if (sha256(data) !== clip.sha256) add('SHA_MISMATCH', { key });
      }
    }
  }
  for (const clip of plan) {
    const key = `${clip.profile}|${clip.cueId}|${clip.segment}`;
    if (!seenClips.has(key)) add('CLIP_MISSING', { key });
  }
  const totals = cueTotals(narration);
  if (!manifest.totals || manifest.totals.clips !== manifest.clips.length ||
    manifest.totals.cues !== totals.cues || manifest.totals.segments !== totals.segments) {
    add('TOTALS_MISMATCH', { totals: manifest.totals, expected: { ...totals, clips: manifest.clips.length } });
  }
  if (payloadBytes >= MAX_PAYLOAD_BYTES) add('PAYLOAD_TOO_LARGE', { bytes: payloadBytes });
  const computedVersion = packageVersion ? audioVersionFor(packageVersion, plan.map((clip) => ({
    ...clip, textSha: expectedTextSha.get(`${clip.profile}|${clip.cueId}|${clip.segment}`),
  }))) : null;
  if (computedVersion && manifest.version !== computedVersion) {
    add('VERSION_HASH_MISMATCH', { found: manifest.version, expected: computedVersion });
  }
  return findings;
}
