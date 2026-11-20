#!/usr/bin/env node
/**
 * Generate the prerecorded narration assets, manifest and audio version module
 * from public/js/narrative-data.js (STR-01).
 *
 * Toolchain:
 *   - GEORGE   → Kokoro-82M via `scripts/kokoro-synth.py` (pip install kokoro soundfile)
 *   - DANIEL   → macOS `say` + `afconvert`
 *   - SAMANTHA → macOS `say` + `afconvert`
 *
 * Generation is a maintainer action, never a build step. The whole tree is
 * rendered into a temporary directory and swapped into place only after every
 * clip encoded, so a failed run never ships a partial tree.
 *
 * Env: KOKORO_PYTHON (default python3), NARIMATO_SKIP_KOKORO=1 (refuses to run:
 * a skipped neural profile would leave a partial tree).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VOICE_PROFILES } from '../public/js/narrative-data.js';
import {
  AUDIO_VERSION_FILE,
  MIN_CLIP_MS,
  MANIFEST_FILE,
  VOICE_DIR,
  assertGeneratable,
  audioVersionModule,
  buildManifest,
  clipPath,
  requiredClips,
  sha256,
  textSha,
} from './voice-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, VOICE_DIR);
const TMP = path.join(ROOT, '.voice-tmp');
const BUILD = path.join(TMP, 'voice');
const NEXT = path.join(ROOT, '.voice-next');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function probeDurationMs(file) {
  try {
    const out = execFileSync('afinfo', [file], { encoding: 'utf8' });
    const match = /estimated duration:\s*([\d.]+)\s*sec/.exec(out);
    if (match) return Math.max(1, Math.round(Number(match[1]) * 1000));
  } catch {
    /* fall through to the bitrate estimate */
  }
  const bytes = fs.statSync(file).size;
  return Math.max(1, Math.round((bytes * 8) / 64000 * 1000));
}

function clipFileName(clip) {
  return `${clip.cueId}__s${clip.segment}`;
}

function renderKokoro(profile, outDir, sentences) {
  const manifestPath = path.join(TMP, `${profile.id}.json`);
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ voice: profile.voice, lang: profile.lang, sentences }, null, 2)
  );
  const python = process.env.KOKORO_PYTHON || 'python3';
  run(python, [path.join(ROOT, 'scripts', 'kokoro-synth.py'), manifestPath, outDir]);
  for (const sentence of sentences) {
    const wav = path.join(outDir, `${sentence.file}.wav`);
    const m4a = path.join(outDir, `${sentence.file}.m4a`);
    if (!fs.existsSync(wav)) throw new Error(`Kokoro did not render ${profile.id}/${sentence.file}.wav`);
    run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', wav, m4a]);
    fs.rmSync(wav, { force: true });
  }
}

function renderSay(profile, outDir, sentences) {
  for (const sentence of sentences) {
    const aiff = path.join(TMP, `${profile.id}-${sentence.file}.aiff`);
    const m4a = path.join(outDir, `${sentence.file}.m4a`);
    run('say', ['-v', profile.voice, '-r', String(profile.rate), '-o', aiff, sentence.text]);
    run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, m4a]);
    fs.rmSync(aiff, { force: true });
  }
}

/** Keep the documented cache-bust examples in step with the generated version. */
function syncDocExamples(version) {
  const updated = [];
  for (const file of ['VOICE.md', 'EDGE_DEPLOYMENT.md']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const before = fs.readFileSync(full, 'utf8');
    const after = before.replace(/(\?v=)(\d+\.\d+\.\d+(?:\+[0-9a-f]{8})?)/g, `$1${version}`);
    if (after !== before) {
      fs.writeFileSync(full, after);
      updated.push(file);
    }
  }
  return updated;
}

function main() {
  const skipKokoro = process.env.NARIMATO_SKIP_KOKORO === '1';
  assertGeneratable(VOICE_PROFILES, { skipKokoro });
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const plan = requiredClips();

  fs.rmSync(TMP, { recursive: true, force: true });
  fs.rmSync(NEXT, { recursive: true, force: true });
  fs.mkdirSync(BUILD, { recursive: true });

  for (const profile of VOICE_PROFILES) {
    const outDir = path.join(BUILD, profile.id);
    fs.mkdirSync(outDir, { recursive: true });
    const sentences = plan
      .filter((clip) => clip.profile === profile.id)
      .map((clip) => ({ file: clipFileName(clip), text: clip.text }));
    process.stdout.write(`\n${profile.label} (${profile.region}) — ${sentences.length} sentence(s) via ${profile.engine} ...\n`);
    if (profile.engine === 'kokoro') renderKokoro(profile, outDir, sentences);
    else renderSay(profile, outDir, sentences);
  }

  const clips = [];
  for (const clip of plan) {
    const full = path.join(BUILD, clip.profile, `${clipFileName(clip)}.m4a`);
    if (!fs.existsSync(full)) throw new Error(`missing encoded clip ${clipPath(clip.cueId, clip.segment, clip.profile)}`);
    const data = fs.readFileSync(full);
    if (!data.length) throw new Error(`zero-byte clip ${clipPath(clip.cueId, clip.segment, clip.profile)}`);
    const durationMs = probeDurationMs(full);
    if (durationMs < MIN_CLIP_MS) {
      throw new Error(
        `clip ${clipPath(clip.cueId, clip.segment, clip.profile)} is ${durationMs} ms (< ${MIN_CLIP_MS} ms); refusing to ship`
      );
    }
    clips.push({
      cueId: clip.cueId,
      segment: clip.segment,
      profile: clip.profile,
      file: clipPath(clip.cueId, clip.segment, clip.profile),
      bytes: data.length,
      sha256: sha256(data),
      durationMs,
      textSha: textSha(clip.text),
    });
  }

  const manifest = buildManifest({ packageVersion: pkg.version, clips });
  const manifestPath = path.join(BUILD, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // Swap only after every encode and every validation passed.
  fs.renameSync(BUILD, NEXT);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.renameSync(NEXT, OUT);
  fs.writeFileSync(path.join(ROOT, AUDIO_VERSION_FILE), audioVersionModule(manifest.version));
  const docs = syncDocExamples(manifest.version);
  fs.rmSync(TMP, { recursive: true, force: true });

  const payload = clips.reduce((sum, clip) => sum + clip.bytes, 0);
  console.log(
    `\nvoice:generate OK — ${VOICE_PROFILES.length} profiles, ${manifest.totals.cues} cues, ` +
      `${manifest.totals.segments} sentences, ${manifest.totals.clips} clips, ` +
      `${(payload / 1024 / 1024).toFixed(1)} MB, version ${manifest.version}`
  );
  console.log(`manifest: ${MANIFEST_FILE}`);
  console.log(`version:  ${AUDIO_VERSION_FILE}`);
  if (docs.length) console.log(`updated doc cache-bust examples: ${docs.join(', ')}`);
}

try {
  main();
} catch (error) {
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.rmSync(NEXT, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
  console.error(`voice:generate FAILED — ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
}
