#!/usr/bin/env node
/**
 * Generate the prerecorded narration assets from public/js/narrative-data.js.
 * macOS only: uses `say` for TTS and `afconvert` for AAC (m4a).
 * Audio files are committed so the browser never needs TTS.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NARRATION, narrationSegments } from '../public/js/narrative-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio', 'voice');
const TMP = path.join(ROOT, '.voice-tmp');
const VOICE = process.env.NARIMATO_VOICE || 'Samantha';
const RATE = process.env.NARIMATO_VOICE_RATE || '152';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// Rebuild the voice directory from scratch so removed/shortened lines don't
// leave stale clips behind.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let count = 0;
for (const [id, cue] of Object.entries(NARRATION)) {
  const segments = narrationSegments(cue);
  for (let i = 0; i < segments.length; i += 1) {
    const file = `${id}__s${i + 1}`;
    const aiff = path.join(TMP, `${file}.aiff`);
    const m4a = path.join(OUT, `${file}.m4a`);
    execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, segments[i]], { stdio: 'inherit' });
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, m4a], { stdio: 'inherit' });
    count += 1;
    process.stdout.write(`  ${file}.m4a\n`);
  }
}
rmSync(TMP, { recursive: true, force: true });
console.log(`Generated ${count} sentence clips with ${VOICE} at rate ${RATE}.`);
