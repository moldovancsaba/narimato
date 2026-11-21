#!/usr/bin/env node
/**
 * NARIMATO — release evidence ledger checker (REL-02).
 *
 * Parses every claim table (`| Claim | Status | Evidence | Note |`) in the README,
 * current release notes and docs/RELEASE_EVIDENCE.md, then validates the closed
 * status vocabulary, typed evidence references and planned-vs-live tense.
 *
 * Usage:
 *   node scripts/evidence-check.mjs --readme README.md --notes RELEASE_NOTES.md \
 *     --ledger docs/RELEASE_EVIDENCE.md --repo .
 *   node scripts/evidence-check.mjs --json
 *
 * Exit codes: 0 valid · 1 invalid status/row · 2 unresolved evidence
 *             3 broken link · 4 planned capability described as live
 * The highest-severity code is returned when several classes are present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLedger, formatFindings } from '../lib/claim-ledger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = {
    readme: 'README.md',
    notes: 'RELEASE_NOTES.md',
    ledger: 'docs/RELEASE_EVIDENCE.md',
    repo: ROOT,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--readme') {
      options.readme = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--readme=')) options.readme = arg.slice(9);
    else if (arg === '--notes') {
      options.notes = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--notes=')) options.notes = arg.slice(8);
    else if (arg === '--ledger') {
      options.ledger = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--ledger=')) options.ledger = arg.slice(9);
    else if (arg === '--repo') {
      options.repo = path.resolve(argv[index + 1] || '.');
      index += 1;
    } else if (arg.startsWith('--repo=')) options.repo = path.resolve(arg.slice(7));
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`evidence-check — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.log('usage: node scripts/evidence-check.mjs [--readme file] [--notes file] [--ledger file] [--repo dir] [--json]');
    return 0;
  }

  const documents = [];
  for (const file of [options.readme, options.notes, options.ledger]) {
    if (!file) continue;
    const absolute = path.resolve(options.repo, file);
    if (!fs.existsSync(absolute)) {
      console.error(`evidence-check — ${file} does not exist`);
      return 2;
    }
    documents.push({ file, text: fs.readFileSync(absolute, 'utf8') });
  }

  let result;
  try {
    result = checkLedger({ files: documents, root: options.repo, repo: options.repo });
  } catch (error) {
    console.error(`evidence-check INTERNAL ERROR — ${error && error.stack ? error.stack : error}`);
    return 2;
  }

  const report = {
    schemaVersion: 1,
    ok: result.ok,
    exitCode: result.exitCode,
    files: documents.map((document) => document.file),
    summary: result.summary,
    findings: result.findings,
  };
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const line of formatFindings(result.findings).split('\n').filter(Boolean)) console.error(line);
    console.error(
      result.ok
        ? `evidence-check OK — ${result.summary.total} claims, ${result.summary.live} LIVE, evidence coverage ${(result.summary.evidencedCoverage * 100).toFixed(0)}%`
        : `evidence-check FAILED — ${result.findings.length} finding(s); ${result.summary.stale} stale reference(s)`
    );
  }
  return result.exitCode;
}

process.exitCode = main(process.argv.slice(2));
