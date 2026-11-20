import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NARRATION, VOICE_PROFILES, narrationSegments } from '../public/js/narrative-data.js';
import { AUDIO_VERSION } from '../public/js/audio-version.js';
import { verifyVoice } from '../scripts/verify-voice.mjs';
import {
  AUDIO_VERSION_PATTERN,
  MAX_PAYLOAD_BYTES,
  MIN_CLIP_MS,
  MANIFEST_FILE,
  VOICE_DIR,
  assertGeneratable,
  audioVersionFor,
  buildManifest,
  clipPath,
  contentHash8,
  cueTotals,
  profileEntries,
  requiredClips,
  textSha,
  validateManifest,
} from '../scripts/voice-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_FILE), 'utf8'));
const plan = requiredClips();
const planByKey = new Map(plan.map((clip) => [`${clip.profile}|${clip.cueId}|${clip.segment}`, clip]));

const NEW_CUES = Object.freeze({
  'event-relief': 3,
  'event-incident-meteor': 3,
  'event-incident-nuclear': 3,
  'event-incident-solar': 3,
  'event-incident-alien': 3,
  'guide-what': 3,
  'guide-how': 3,
  'guide-where': 3,
  'guide-leave': 3,
  'log-grounded': 2,
  'log-almost': 1,
  'log-ready': 1,
});

function clipKey(clip) {
  return `${clip.profile}|${clip.cueId}|${clip.segment}`;
}

/* --------------------------------------------------------------- catalogue */

test('narration: 40 cues and 115 sentence units, including the twelve STR-01 cues', () => {
  const totals = cueTotals();
  assert.equal(totals.cues, 40);
  assert.equal(totals.segments, 115);
  assert.equal(Object.keys(NEW_CUES).length, 12);
  for (const [cueId, segments] of Object.entries(NEW_CUES)) {
    assert.ok(NARRATION[cueId], `new cue ${cueId} is missing`);
    assert.equal(narrationSegments(NARRATION[cueId]).length, segments, `${cueId} sentence count`);
  }
  for (const cueId of Object.keys(NARRATION)) {
    assert.match(cueId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `cue id ${cueId} must be lower kebab-case`);
  }
});

test('narration: every profile ships the complete matrix (115 clips each, 345 total)', () => {
  assert.equal(VOICE_PROFILES.length, 3);
  assert.deepEqual(VOICE_PROFILES.map((profile) => profile.id), ['george', 'daniel', 'samantha']);
  assert.equal(plan.length, 345);
  for (const profile of VOICE_PROFILES) {
    const own = plan.filter((clip) => clip.profile === profile.id);
    assert.equal(own.length, 115, `${profile.id} clip count`);
  }
});

/* ----------------------------------------------------------------- manifest */

test('narration: manifest validates against the VoiceManifest contract', () => {
  assert.match(manifest.version, AUDIO_VERSION_PATTERN);
  assert.deepEqual(manifest.totals, { cues: 40, segments: 115, clips: 345 });
  assert.equal(manifest.clips.length, 345);
  for (const clip of manifest.clips) {
    assert.deepEqual(
      Object.keys(clip).sort(),
      ['bytes', 'cueId', 'durationMs', 'file', 'profile', 'segment', 'sha256', 'textSha'].sort()
    );
    assert.equal(clip.file, clipPath(clip.cueId, clip.segment, clip.profile));
    assert.match(clip.file, /^public\/audio\/voice\/(?:george|daniel|samantha)\/.+__s\d+\.m4a$/);
    assert.match(clip.sha256, /^[0-9a-f]{64}$/);
    assert.match(clip.textSha, /^[0-9a-f]{64}$/);
  }
  assert.deepEqual(validateManifest(manifest, { profiles: VOICE_PROFILES, packageVersion: pkg.version }), []);
});

test('narration: profiles record engine, voice, licence and attribution', () => {
  const declared = profileEntries();
  for (const profile of manifest.profiles) {
    const source = declared.find((entry) => entry.id === profile.id);
    assert.ok(source, `unexpected profile ${profile.id}`);
    assert.deepEqual(profile, source);
    assert.ok(profile.license.length > 0);
    assert.ok(profile.attribution.length > 0);
  }
  assert.equal(manifest.profiles.find((profile) => profile.id === 'george').engine, 'kokoro');
  assert.equal(manifest.profiles.find((profile) => profile.id === 'george').voice, 'bm_george');
  assert.match(manifest.profiles.find((profile) => profile.id === 'george').license, /Apache-2\.0/);
});

test('narration: the version is content-derived and is the generated module value', () => {
  const expected = audioVersionFor(pkg.version, plan.map((clip) => ({ ...clip, textSha: textSha(clip.text) })));
  assert.equal(manifest.version, expected);
  assert.equal(AUDIO_VERSION, manifest.version);
  assert.equal(manifest.version, `${pkg.version}+${contentHash8(plan.map((clip) => ({ ...clip, textSha: textSha(clip.text) })))}`);
  assert.match(manifest.version, /^\d+\.\d+\.\d+\+[0-9a-f]{8}$/);
});

/* ------------------------------------------------------- no missing clips */

test('narration: no missing clip references for any cue, sentence or profile', () => {
  const byKey = new Map(manifest.clips.map((clip) => [clipKey(clip), clip]));
  const missing = [];
  for (const clip of plan) {
    if (!byKey.has(clipKey(clip))) missing.push(clipKey(clip));
  }
  assert.deepEqual(missing, []);
  for (const clip of plan) {
    const entry = byKey.get(clipKey(clip));
    const full = path.join(ROOT, entry.file);
    assert.ok(fs.existsSync(full), `missing file ${entry.file}`);
    assert.ok(fs.statSync(full).size > 0, `empty file ${entry.file}`);
    assert.equal(entry.bytes, fs.statSync(full).size, `${entry.file} bytes`);
  }
});

test('narration: no orphan clips on disk', () => {
  const declared = new Set(manifest.clips.map((clip) => clip.file));
  const onDisk = [];
  for (const profile of VOICE_PROFILES) {
    const dir = path.join(ROOT, VOICE_DIR, profile.id);
    assert.ok(fs.existsSync(dir), `missing profile directory ${profile.id}`);
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.m4a'))) {
      onDisk.push(`${VOICE_DIR}/${profile.id}/${file}`);
    }
  }
  assert.equal(onDisk.length, manifest.clips.length);
  for (const file of onDisk) {
    assert.ok(declared.has(file), `orphan clip ${file}`);
  }
  assert.equal(fs.readdirSync(path.join(ROOT, VOICE_DIR)).length, VOICE_PROFILES.length + 1, 'profiles plus manifest.json');
});

test('narration: every clip is usable and the payload stays under budget', () => {
  let payload = 0;
  for (const clip of manifest.clips) {
    assert.ok(clip.durationMs >= MIN_CLIP_MS, `${clip.file} is ${clip.durationMs} ms`);
    assert.ok(clip.bytes > 0);
    payload += clip.bytes;
    assert.equal(planByKey.get(clipKey(clip)).text.length > 0, true);
  }
  assert.ok(payload < MAX_PAYLOAD_BYTES, `payload ${payload} exceeds ${MAX_PAYLOAD_BYTES}`);
  assert.ok(payload < 12 * 1024 * 1024);
});

/* ---------------------------------------------------- captions / subtitles */

test('narration: captions and clips share one sentence source (subtitle-voice sync)', () => {
  for (const [cueId, cue] of Object.entries(NARRATION)) {
    const segments = narrationSegments(cue);
    const clips = manifest.clips.filter((clip) => clip.cueId === cueId);
    assert.equal(clips.length, segments.length * VOICE_PROFILES.length, `${cueId} clips vs caption units`);
    for (const profile of VOICE_PROFILES) {
      for (let index = 0; index < segments.length; index += 1) {
        const entry = clips.find((clip) => clip.profile === profile.id && clip.segment === index + 1);
        assert.ok(entry, `${cueId}__s${index + 1} missing for ${profile.id}`);
        assert.equal(entry.textSha, textSha(segments[index]), `${cueId}__s${index + 1} text drift`);
        assert.equal(entry.textSha, textSha(plan.find((clip) => clipKey(clip) === `${profile.id}|${cueId}|${index + 1}`).text));
      }
    }
  }
});

test('narration: accessibility keeps the polite caption region and adds no new live region', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const caption = html.match(/id="narrative-subtitles"[^>]*/);
  assert.ok(caption, 'the caption region must keep its DOM contract');
  assert.match(caption[0], /role="region"/);
  assert.match(caption[0], /aria-live="polite"/);
  // The generated Quick Guide block is static text only: no live region, no new control.
  const guide = html.slice(html.indexOf('story-copy:start guide-steps'), html.indexOf('story-copy:end guide-steps'));
  assert.ok(!/aria-live|role="status"|role="alert"/.test(guide));
  const narrator = fs.readFileSync(path.join(ROOT, 'public/js/narrator.js'), 'utf8');
  assert.ok(!/aria-live|role="status"|role="alert"/.test(narrator), 'narrator must not add a live region');
});

/* -------------------------------------------------------------- versioning */

test('narration: content hash is stable across runs and changes with a sentence', () => {
  const base = plan.map((clip) => ({ ...clip, textSha: textSha(clip.text) }));
  const first = contentHash8(base);
  const second = contentHash8(base.map((clip) => ({ ...clip })));
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{8}$/);
  const edited = base.map((clip, index) =>
    index === 0 ? { ...clip, textSha: textSha('A completely different sentence.') } : clip
  );
  assert.notEqual(contentHash8(edited), first);
  const version = audioVersionFor('3.57.0', base);
  assert.equal(version, `3.57.0+${first}`);
});

/* ----------------------------------------------------------- safety guards */

test('narration: generation refuses a partial tree when Kokoro is skipped', () => {
  assert.throws(() => assertGeneratable(VOICE_PROFILES, { skipKokoro: true }), /partial tree/);
  assert.deepEqual(assertGeneratable(VOICE_PROFILES, { skipKokoro: false }), { skippedProfiles: [] });
  const sayOnly = [{ ...VOICE_PROFILES[1] }];
  assert.deepEqual(assertGeneratable(sayOnly, { skipKokoro: true }), { skippedProfiles: [] });
});

test('narration: a profile without a licence fails validation', () => {
  assert.throws(() => profileEntries([{ id: 'x', engine: 'say', voice: 'X' }]), /missing license, attribution/);
  assert.throws(() => profileEntries([{ ...VOICE_PROFILES[1], engine: 'cloud' }]), /unsupported engine/);
});

test('narration: validateManifest reports missing, short, stale and orphan clips', () => {
  const dropped = structuredClone(manifest);
  dropped.clips.pop();
  const missing = validateManifest(dropped, { profiles: VOICE_PROFILES, packageVersion: pkg.version });
  assert.ok(missing.some((finding) => finding.code === 'CLIP_MISSING'));
  assert.ok(missing.some((finding) => finding.code === 'TOTALS_MISMATCH'));

  const short = structuredClone(manifest);
  short.clips[0].durationMs = 40;
  assert.ok(validateManifest(short, { profiles: VOICE_PROFILES, packageVersion: pkg.version }).some(
    (finding) => finding.code === 'SHORT_CLIP'
  ));

  const staleText = structuredClone(manifest);
  staleText.clips[0].textSha = '0'.repeat(64);
  assert.ok(validateManifest(staleText, { profiles: VOICE_PROFILES, packageVersion: pkg.version }).some(
    (finding) => finding.code === 'TEXT_SHA_MISMATCH'
  ));

  const orphan = structuredClone(manifest);
  orphan.clips.push({ ...manifest.clips[0], cueId: 'retired-cue' });
  assert.ok(validateManifest(orphan, { profiles: VOICE_PROFILES, packageVersion: pkg.version }).some(
    (finding) => finding.code === 'CLIP_ORPHAN'
  ));

  const badVersion = structuredClone(manifest);
  badVersion.version = '3.57.0';
  assert.ok(validateManifest(badVersion, { profiles: VOICE_PROFILES, packageVersion: pkg.version }).some(
    (finding) => finding.code === 'VERSION_FORMAT'
  ));

  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-voice-empty-'));
  assert.ok(validateManifest(manifest, { profiles: VOICE_PROFILES, packageVersion: pkg.version, root: emptyRoot }).some(
    (finding) => finding.code === 'FILE_MISSING'
  ));
});

test('narration: verifyVoice passes on the committed tree', () => {
  const report = verifyVoice(ROOT);
  assert.deepEqual(report.findings, []);
  assert.equal(report.ok, true);
  assert.equal(report.version, manifest.version);
  assert.equal(report.expectedVersion, manifest.version);
  assert.equal(report.totals.clips, 345);
});

test('narration: the manifest carries no player data or secrets', () => {
  const serialised = JSON.stringify(manifest);
  for (const forbidden of ['"token"', '"tag"', '"playerId"', '"ip"', '"email"']) {
    assert.ok(!serialised.includes(forbidden), `manifest must not contain ${forbidden}`);
  }
  assert.deepEqual(Object.keys(manifest).sort(), ['clips', 'profiles', 'totals', 'version']);
});
