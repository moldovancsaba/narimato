#!/usr/bin/env node
/**
 * NARIMATO — narration asset verification gate (STR-01).
 *
 * Prints the committed matrix and exits non-zero when the manifest, the version
 * module, the narration script and the audio tree disagree. Safe to run in CI
 * (no TTS, no network, no macOS tools).
 *
 * Usage: node scripts/verify-voice.mjs [--json] [--root <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VOICE_PROFILES } from '../public/js/narrative-data.js';
import {
  AUDIO_VERSION_FILE,
  MANIFEST_FILE,
  VOICE_DIR,
  audioVersionFor,
  cueTotals,
  requiredClips,
  textSha,
  validateManifest,
} from './voice-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(root, file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function readAudioVersion(root) {
  const full = path.join(root, AUDIO_VERSION_FILE);
  if (!fs.existsSync(full)) return null;
  const match = /export const AUDIO_VERSION = '([^']+)'/.exec(fs.readFileSync(full, 'utf8'));
  return match ? match[1] : null;
}

/** Run the verification against a repository root. Returns the report contract. */
export function verifyVoice(root = ROOT) {
  const pkg = readJson(root, 'package.json');
  const manifest = readJson(root, MANIFEST_FILE);
  const audioVersion = readAudioVersion(root);
  const findings = validateManifest(manifest, {
    narration: undefined,
    profiles: VOICE_PROFILES,
    packageVersion: pkg ? pkg.version : undefined,
    root,
  });
  if (audioVersion === null) {
    findings.push({ code: 'AUDIO_VERSION_MISSING', message: `${AUDIO_VERSION_FILE} is missing or unreadable` });
  } else if (manifest && manifest.version && audioVersion !== manifest.version) {
    findings.push({ code: 'AUDIO_VERSION_MISMATCH', found: audioVersion, expected: manifest.version });
  }
  const totals = cueTotals();
  const plan = requiredClips();
  const expectedVersion = pkg ? audioVersionFor(pkg.version, plan.map((clip) => ({ ...clip, textSha: textSha(clip.text) }))) : null;
  return {
    ok: findings.length === 0,
    version: manifest ? manifest.version : null,
    expectedVersion,
    profiles: VOICE_PROFILES.map((profile) => ({ id: profile.id, engine: profile.engine, voice: profile.voice })),
    totals: { ...totals, clips: plan.length, payloadBytes: manifest && Array.isArray(manifest.clips) ? manifest.clips.reduce((sum, clip) => sum + (Number(clip.bytes) || 0), 0) : 0 },
    findings,
  };
}

function parseArgs(argv) {
  const options = { json: false, root: ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--root') {
      options.root = path.resolve(argv[index + 1] || ROOT);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`voice:verify — ${error.message}`);
    return 2;
  }
  try {
    const report = verifyVoice(options.root);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report.ok ? 0 : 1;
    }
    for (const finding of report.findings) {
      const detail = finding.key || finding.file || finding.id || finding.message || '';
      console.error(`${finding.code}${detail ? ` — ${detail}` : ''}`);
    }
    if (report.ok) {
      const mb = (report.totals.payloadBytes / 1024 / 1024).toFixed(1);
      console.error(
        `voice:verify OK — ${report.profiles.length} profiles, ${report.totals.cues} cues, ` +
          `${report.totals.segments} sentences, ${report.totals.clips} clips, ${mb} MB, version ${report.version}`
      );
    } else {
      console.error(`voice:verify FAILED — ${report.findings.length} finding(s)`);
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(`voice:verify INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

export { MANIFEST_FILE, VOICE_DIR };
