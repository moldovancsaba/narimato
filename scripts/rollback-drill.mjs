#!/usr/bin/env node
/**
 * NARIMATO — binary rollback drill (REL-01).
 *
 * Rehearses the documented rollback path without touching the live checkout:
 *
 *   1. resolve the previous SemVer tag and prove it is an ancestor of HEAD;
 *   2. create a detached temporary worktree at that tag;
 *   3. run the previous tag's test suite, version check and recovery drill there
 *      (the "deploy the previous binary" half of the runbook);
 *   4. compare `PERSIST_VERSION`; a newer current schema reports SCHEMA_TOO_NEW
 *      and blocks a direct rollback (the runbook requires a restore first);
 *   5. remove the worktree and write a machine-readable drill report.
 *
 * Usage:
 *   node scripts/rollback-drill.mjs --previous-tag v3.57.0
 *   node scripts/rollback-drill.mjs --report artifacts/release/v3.58.0/rollback-drill.json
 *
 * Exit codes: 0 PASS · 1 FAIL · 2 usage/precondition · 3 missing dependency
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareSemver } from '../lib/release-checks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { previousTag: process.env.RELEASE_PREVIOUS_TAG || null, report: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--previous-tag') {
      options.previousTag = argv[index + 1];
      if (!options.previousTag) throw new Error('--previous-tag requires a tag');
      index += 1;
    } else if (arg.startsWith('--previous-tag=')) options.previousTag = arg.slice(15);
    else if (arg === '--report') {
      options.report = argv[index + 1];
      if (!options.report) throw new Error('--report requires a path');
      index += 1;
    } else if (arg.startsWith('--report=')) options.report = arg.slice(9);
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function git(args, cwd = ROOT) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function node(args, { cwd = ROOT, timeout = 180_000 } = {}) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

function readFile(file) {
  return fs.readFileSync(file, 'utf8');
}

function packageVersion(file) {
  return JSON.parse(readFile(file)).version;
}

function persistVersion(text) {
  const match = /export const PERSIST_VERSION = (\d+)/.exec(String(text || ''));
  return match ? Number(match[1]) : null;
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, text);
  fs.renameSync(temporary, file);
}

function latestPreviousTag(currentVersion) {
  const result = git(['tag', '--sort=-v:refname']);
  if (result.status !== 0) return null;
  return (
    result.stdout
      .split('\n')
      .map((tag) => tag.trim())
      .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
      .find((tag) => compareSemver(tag.slice(1), currentVersion) < 0) || null
  );
}

function finish(report, code, options) {
  const generatedAt = new Date().toISOString();
  report.generatedAt = generatedAt;
  report.finishedAt = generatedAt;
  report.durationMs = Date.now() - report.startedMs;
  report.rtoMinutes = Math.max(0.1, Math.ceil((report.durationMs / 60_000) * 10) / 10);
  delete report.startedMs;
  if (options.report) atomicWrite(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`);
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    for (const check of report.checks) {
      console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.id}${check.detail ? ` — ${check.detail}` : ''}`);
    }
    console.log(
      report.ok
        ? `ROLLBACK DRILL PASS — ${report.previousTag} -> v${report.current.version} · RTO ${report.rtoMinutes} min`
        : `ROLLBACK DRILL FAIL — ${report.failures.join('; ')}`
    );
  }
  process.exitCode = code;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`rollback-drill — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.log('usage: node scripts/rollback-drill.mjs [--previous-tag vX.Y.Z] [--report path] [--json]');
    return 0;
  }

  const report = {
    schemaVersion: 1,
    ok: false,
    drill: 'FAIL',
    previousTag: options.previousTag,
    previousCommit: null,
    current: { version: packageVersion(path.join(ROOT, 'package.json')), persistVersion: null },
    previous: { version: null, persistVersion: null },
    checks: [],
    failures: [],
    rtoMinutes: null,
    startedMs: Date.now(),
  };

  const check = (id, ok, detail = null) => {
    report.checks.push({ id, ok: Boolean(ok), detail });
    if (!ok) report.failures.push(`${id}${detail ? `: ${detail}` : ''}`);
    return ok;
  };

  if (!report.previousTag) report.previousTag = latestPreviousTag(report.current.version);
  if (!report.previousTag) {
    check('previous-tag', false, 'no previous SemVer tag found; pass --previous-tag');
    finish(report, 2, options);
    return 2;
  }

  const tagCommit = git(['rev-parse', '--verify', `${report.previousTag}^{commit}`]);
  if (tagCommit.status !== 0) {
    check('tag-exists', false, `${report.previousTag} is not a local git tag`);
    finish(report, 3, options);
    return 3;
  }
  report.previousCommit = tagCommit.stdout.trim();
  check('tag-exists', true, report.previousCommit.slice(0, 12));

  const ancestor = git(['merge-base', '--is-ancestor', report.previousCommit, 'HEAD']);
  check('tag-is-ancestor', ancestor.status === 0, ancestor.status === 0 ? null : `${report.previousTag} is not an ancestor of HEAD`);

  const previousPackage = git(['show', `${report.previousTag}:package.json`]);
  const previousSchema = git(['show', `${report.previousTag}:lib/world-core.js`]);
  if (previousPackage.status === 0) {
    try {
      report.previous.version = JSON.parse(previousPackage.stdout).version;
    } catch {
      check('previous-manifest', false, 'previous tag package.json is unreadable');
    }
  }
  report.previous.persistVersion = persistVersion(previousSchema.stdout);
  report.current.persistVersion = persistVersion(readFile(path.join(ROOT, 'lib/world-core.js')));
  check('version-order', compareSemver(report.previous.version || '0.0.0', report.current.version) < 0, `${report.previous.version} -> ${report.current.version}`);
  check('schema-not-too-new', report.previous.persistVersion !== null && report.current.persistVersion !== null && report.previous.persistVersion >= report.current.persistVersion, `previous ${report.previous.persistVersion} · current ${report.current.persistVersion}`);

  if (report.failures.length) {
    report.drill = report.failures.some((failure) => failure.startsWith('schema-not-too-new')) ? 'SCHEMA_TOO_NEW' : 'FAIL';
    finish(report, 1, options);
    return 1;
  }

  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-rollback-'));
  let worktreeAdded = false;
  try {
    const added = git(['worktree', 'add', '--detach', worktree, report.previousTag]);
    if (added.status !== 0) {
      check('worktree-create', false, (added.stderr || added.stdout || '').trim());
      finish(report, 1, options);
      return 1;
    }
    worktreeAdded = true;
    check('worktree-create', true, worktree);

    const testFiles = fs
      .readdirSync(path.join(worktree, 'test'))
      .filter((name) => name.endsWith('.test.js'))
      .sort()
      .map((name) => path.join(worktree, 'test', name));
    const suite = node(['--test', ...testFiles], { cwd: worktree, timeout: 180_000 });
    const pass = /^(?:#|\u2139) pass (\d+)$/m.exec(`${suite.stdout}\n${suite.stderr}`);
    check('previous-suite', suite.status === 0 && pass, pass ? `${pass[1]} tests passed` : 'test suite did not report pass');

    const expectedTagVersion = report.previousTag.replace(/^v/, '');
    const previousIndex = readFile(path.join(worktree, 'public/index.html'));
    const previousReadme = readFile(path.join(worktree, 'README.md'));
    const cacheBusts = [...previousIndex.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
    const readmeVersion = /Version \*\*(\d+\.\d+\.\d+)\*\*/.exec(previousReadme)?.[1];
    check(
      'previous-version-slots',
      cacheBusts.length > 0 && cacheBusts.every((found) => found === expectedTagVersion) && readmeVersion === expectedTagVersion,
      `cache-bust ${[...new Set(cacheBusts)].join(',') || 'missing'} · README ${readmeVersion || 'missing'} · tag ${expectedTagVersion}`
    );

    if (fs.existsSync(path.join(worktree, 'scripts/check-version.mjs'))) {
      const version = node(['scripts/check-version.mjs'], { cwd: worktree, timeout: 60_000 });
      check('previous-version-check', version.status === 0, version.status === 0 ? report.previous.version : (version.stderr || '').trim().slice(-300));
    } else {
      check('previous-version-check', true, `scripts/check-version.mjs did not exist at ${report.previousTag}; slots checked directly`);
    }

    if (fs.existsSync(path.join(worktree, 'scripts/recovery-test.mjs'))) {
      const recovery = node(['scripts/recovery-test.mjs'], { cwd: worktree, timeout: 180_000 });
      check('previous-recovery-drill', recovery.status === 0, recovery.status === 0 ? 'backup -> verify -> restore PASS' : (recovery.stderr || '').trim().slice(-300));
    } else {
      check('previous-recovery-drill', true, `scripts/recovery-test.mjs did not exist at ${report.previousTag}; schema compatibility checked instead`);
    }
  } finally {
    if (worktreeAdded) git(['worktree', 'remove', '--force', worktree]);
    fs.rmSync(worktree, { recursive: true, force: true });
  }

  report.drill = report.failures.length ? 'FAIL' : 'PASS';
  report.ok = report.failures.length === 0;
  finish(report, report.ok ? 0 : 1, options);
  return report.ok ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
