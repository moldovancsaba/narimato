#!/usr/bin/env node
/**
 * Generate the prerecorded narration assets from public/js/narrative-data.js.
 * macOS only: uses `say` for TTS and `afconvert` for AAC (m4a).
 * Audio files are committed so the browser never needs TTS.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NARRATION, VOICE_PROFILES, narrationSegments } from '../public/js/narrative-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio', 'voice');
const TMP = path.join(ROOT, '.voice-tmp');


// Rebuild the whole voice tree so removed/shortened lines and retired voices
// don't leave stale clips behind.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let count = 0;
for (const profile of VOICE_PROFILES) {
  const voiceOut = path.join(OUT, profile.id);
  mkdirSync(voiceOut, { recursive: true });
  process.stdout.write(`\n${profile.label} (${profile.region}) ...\n`);
  if (profile.engine === 'kokoro' && process.env.NARIMATO_SKIP_KOKORO === '1') {
    process.stdout.write(`\n${profile.label} skipped (NARIMATO_SKIP_KOKORO=1)\n`);
    continue;
  }
  if (profile.engine === 'kokoro') {
    // Open-source neural voice: render all sentences in one Python process,
    // then encode the WAVs to the same browser-friendly m4a contract.
    const sentences = [];
    for (const [id, cue] of Object.entries(NARRATION)) {
      const segments = narrationSegments(cue);
      for (let i = 0; i < segments.length; i += 1) {
        sentences.push({ file: `${id}__s${i + 1}`, text: segments[i] });
      }
    }
    const manifestPath = path.join(TMP, `${profile.id}.json`);
    writeFileSync(manifestPath, JSON.stringify({ voice: profile.voice, lang: profile.lang, sentences }, null, 2));
    const python = process.env.KOKORO_PYTHON || 'python3';
    execFileSync(python, [path.join(ROOT, 'scripts', 'kokoro-synth.py'), manifestPath, voiceOut], { stdio: 'inherit' });
    for (const sentence of sentences) {
      const wav = path.join(voiceOut, `${sentence.file}.wav`);
      const m4a = path.join(voiceOut, `${sentence.file}.m4a`);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', wav, m4a], { stdio: 'inherit' });
      rmSync(wav, { force: true });
      count += 1;
      process.stdout.write(`  ${profile.id}/${sentence.file}.m4a\n`);
    }
  } else {
    for (const [id, cue] of Object.entries(NARRATION)) {
      const segments = narrationSegments(cue);
      for (let i = 0; i < segments.length; i += 1) {
        const file = `${id}__s${i + 1}`;
        const aiff = path.join(TMP, `${profile.id}-${file}.aiff`);
        const m4a = path.join(voiceOut, `${file}.m4a`);
        execFileSync('say', ['-v', profile.voice, '-r', String(profile.rate), '-o', aiff, segments[i]], { stdio: 'inherit' });
        execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, m4a], { stdio: 'inherit' });
        count += 1;
        process.stdout.write(`  ${profile.id}/${file}.m4a\n`);
      }
    }
  }
}
rmSync(TMP, { recursive: true, force: true });
console.log(`\nGenerated ${count} sentence clips for ${VOICE_PROFILES.length} narrator profiles.`);
