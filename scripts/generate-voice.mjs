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
import { NARRATION } from '../public/js/narrative-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio', 'voice');
const TMP = path.join(ROOT, '.voice-tmp');
const VOICE = process.env.NARIMATO_VOICE || 'Samantha';
const RATE = process.env.NARIMATO_VOICE_RATE || '175';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let count = 0;
for (const [id, cue] of Object.entries(NARRATION)) {
  const aiff = path.join(TMP, `${id}.aiff`);
  const m4a = path.join(OUT, `${id}.m4a`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, cue.text], { stdio: 'inherit' });
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, m4a], { stdio: 'inherit' });
  count += 1;
  process.stdout.write(`  ${id}.m4a\n`);
}
rmSync(TMP, { recursive: true, force: true });
console.log(`Generated ${count} narration clips with ${VOICE} at rate ${RATE}.`);
