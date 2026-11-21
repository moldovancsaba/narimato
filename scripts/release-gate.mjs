#!/usr/bin/env node
/**
 * NARIMATO — REL-01 release acceptance gate.
 *
 * One reproducible command runs the full releasability matrix in dependency order
 * and writes a versioned, machine-readable manifest plus a human summary:
 *
 *   artifacts/release/v<version>/release-manifest.json
 *   artifacts/release/v<version>/release-report.md
 *   artifacts/release/v<version>/logs/<gate>.log
 *
 * Gates: version SSOT + cache-bust · test suite + documented count · docs/link
 * gate · GDS build/verify/determinism · a11y gate · two-client ·
 * surface-truth · load/chaos smoke · recovery drill · rollback drill · evidence
 * ledger. The 120-minute soak is a separate release prerequisite and is never
 * faked here.
 *
 * Usage:
 *   npm run release:gate
 *   node scripts/release-gate.mjs --dry-run
 *   node scripts/release-gate.mjs --profile=full --json
 *   PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright npm run release:gate
 *
 * Exit codes: 0 GREEN · 1 RED gate · 2 preflight refusal (dirty tree/tag exists)
 *             3 missing dependency · 4 documented/executed test-count mismatch
 *             5 BLOCKED on external prerequisites (A11Y-02, OPS-04)
 *
 * `--confirm` is accepted for the documented release command; the gate performs no
 * destructive action, and the rollback drill only uses a throwaway worktree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  GATE_ORDER,
  checkVersionTriple,
  compareSemver,
  exitCodeFor,
  extractCountClaims,
  parseTapSummary,
  renderSummary,
  scrubSecrets,
  validateManifest,
  validatePrerequisites,
  verdictFor,
  verifyTestCounts,
  writeArtifacts,
} from '../lib/release-checks.js';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    out: null,
    json: false,
    dryRun: false,
    profile: 'fast',
    previousTag: process.env.RELEASE_PREVIOUS_TAG || null,
    confirm: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--confirm') options.confirm = true;
    else if (arg === '--root') {
      options.root = path.resolve(argv[index + 1] || DEFAULT_ROOT);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else if (arg === '--out') {
      options.out = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--out=')) options.out = arg.slice(6);
    else if (arg === '--profile') {
      options.profile = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--profile=')) options.profile = arg.slice(10);
    else if (arg === '--previous-tag') {
      options.previousTag = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--previous-tag=')) options.previousTag = arg.slice(15);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!['fast', 'full'].includes(options.profile)) throw new Error('--profile must be fast or full');
  return options;
}

function git(args, cwd) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function latestTagBelow(version, root) {
  const result = git(['tag', '--sort=-v:refname'], root);
  if (result.status !== 0) return null;
  return (
    result.stdout
      .split('\n')
      .map((tag) => tag.trim())
      .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
      .find((tag) => compareSemver(tag.slice(1), version) < 0) || null
  );
}

function resolvePlaywright(root) {
  const configured = process.env.PLAYWRIGHT_MODULE || '';
  const candidate = configured || path.join(root, 'node_modules/playwright');
  try {
    require(candidate);
    return { ok: true, module: candidate };
  } catch (error) {
    return { ok: false, candidate, error: error.message };
  }
}

function hashFile(file) {
  try {
    return require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

function makeRunner({ root, outDir, logDir, env }) {
  let sequence = 0;
  return function run(id, name, args, { timeout = 180_000, evidence = null, command = null } = {}) {
    const started = Date.now();
    sequence += 1;
    const display = command || `node ${args.join(' ')}`;
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout,
      maxBuffer: 64 * 1024 * 1024,
    });
    const durationMs = Date.now() - started;
    const stdout = scrubSecrets(result.stdout || '');
    const stderr = scrubSecrets(result.stderr || '');
    const timedOut = result.error && result.error.code === 'ETIMEDOUT';
    const spawnError = result.error && !timedOut ? `spawn failed: ${result.error.message}` : null;
    const status = result.status === 0 && !timedOut && !spawnError ? 'pass' : 'fail';
    const exitCode = timedOut ? null : result.status;
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `${String(sequence).padStart(2, '0')}-${id}.log`);
    fs.writeFileSync(
      logFile,
      `$ ${display}\nexit=${exitCode ?? 'timeout'} durationMs=${durationMs}\n\n${stdout}\n${stderr}\n`
    );
    const detail = evidence === null ? null : evidence(stdout, stderr, exitCode);
    const combined = `${stdout}\n${stderr}`.trim();
    const tail = scrubSecrets(combined.split('\n').slice(-30).join('\n'));
    return {
      id,
      sequence,
      name,
      command: display,
      args,
      status,
      ok: status === 'pass',
      exitCode,
      durationMs,
      timedOut: Boolean(timedOut),
      spawnError,
      detail,
      tail: tail.length > 6000 ? tail.slice(-6000) : tail,
      log: path.relative(root, logFile).split(path.sep).join('/'),
      stdout,
      stderr,
    };
  };
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function writePreflightReport({ root, outDir, version, commit, tag, code, message, json }) {
  const manifest = {
    schemaVersion: 1,
    mode: 'preflight',
    version,
    commit,
    tag,
    generatedAt: new Date().toISOString(),
    durationMs: 0,
    profile: null,
    gates: [],
    testCount: { executed: null, pass: null, fail: null, claimsChecked: 0, mismatches: 0 },
    docs: { files: null, links: null },
    externalPrerequisites: [],
    deferredPrerequisites: [],
    rollback: null,
    verdict: 'RED',
    exitCode: code,
    preflight: { ok: false, message },
    artifacts: {
      dir: relative(root, outDir),
      manifest: relative(root, path.join(outDir, 'release-manifest.json')),
      report: relative(root, path.join(outDir, 'release-report.md')),
      logs: relative(root, path.join(outDir, 'logs')),
    },
  };
  try {
    writeArtifacts({ dir: outDir, manifest });
  } catch {
    /* preflight reports are best effort */
  }
  if (json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  else {
    console.error(`release:gate PREFLIGHT REFUSED — ${message}`);
    console.error(`  report: ${manifest.artifacts.report}`);
  }
  return code;
}

function dryRunPlan({ root, version, tag, outDir, profile, previousTag, prerequisites, json }) {
  const gates = [
    { id: 'prerequisites', name: 'External prerequisites schema', command: 'validate observability/release-prerequisites.json' },
    { id: 'version', name: 'Version SSOT + cache-bust', command: 'node scripts/check-version.mjs + lib/release-checks.js checkVersionTriple' },
    { id: 'tests', name: 'node:test suite', command: 'node --test test/*.test.js' },
    { id: 'test-count', name: 'Documented versus executed test count', command: 'lib/release-checks.js verifyTestCounts' },
    { id: 'docs', name: 'Docs and link gate (R1-R6)', command: 'node scripts/check-docs.mjs --json' },
    { id: 'gds-build', name: 'GDS build, verify and determinism', command: 'node scripts/build-ui.mjs; node scripts/verify-gds-build.mjs; git diff --exit-code public/ui/island.js public/ui/island.css' },
    { id: 'a11y', name: 'GDS accessibility gate (Chromium)', command: `node scripts/a11y-gate.mjs --engine=chromium --out=${relative(root, outDir)}/a11y` },
    { id: 'two-client', name: 'Two-client surface acceptance', command: 'node scripts/acceptance-two-client-surface.mjs' },
    { id: 'surface-truth', name: 'Surface truth acceptance', command: 'node scripts/acceptance-surface-truth.mjs' },
    { id: 'load-chaos', name: 'Load/chaos smoke (fast profile)', command: `node scripts/perf-gate.mjs --only=${profile === 'full' ? 'smoke,load,chaos' : 'smoke,chaos'} --out=${relative(root, outDir)}/load` },
    { id: 'recovery', name: 'Persistence recovery drill', command: 'node scripts/recovery-test.mjs' },
    { id: 'rollback', name: 'Binary rollback drill', command: `node scripts/rollback-drill.mjs --previous-tag ${previousTag || '<previous-tag>'} --report=${relative(root, outDir)}/rollback-drill.json` },
    { id: 'evidence', name: 'Release evidence ledger', command: 'node scripts/evidence-check.mjs --readme README.md --notes RELEASE_NOTES.md --ledger docs/RELEASE_EVIDENCE.md --json' },
  ];
  const plan = {
    schemaVersion: 1,
    mode: 'dry-run',
    version,
    tag,
    commit: git(['rev-parse', 'HEAD'], root).stdout?.trim() || null,
    out: relative(root, outDir),
    profile,
    previousTag,
    gates: gates.map((gate) => gate.id),
    commands: gates,
    externalPrerequisites: prerequisites.external || [],
    deferredPrerequisites: prerequisites.deferred || [],
    soak: 'The 120-minute soak is a separate release prerequisite; the fast gate runs smoke + chaos only.',
  };
  if (json) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else {
    console.log(`release:gate plan — v${version} (${plan.profile})`);
    for (const gate of gates) console.log(`  ${gate.id.padEnd(14)} ${gate.command}`);
    console.log(`artifact: ${plan.out}`);
    console.log(plan.soak);
  }
  return 0;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`release:gate — ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.log('usage: node scripts/release-gate.mjs [--dry-run] [--profile=fast|full] [--json] [--out=dir] [--root=dir] [--previous-tag=vX.Y.Z]');
    return 0;
  }

  const root = options.root;
  let pkg;
  try {
    pkg = readJson(path.join(root, 'package.json'));
  } catch (error) {
    console.error(`release:gate — cannot read package.json in ${root}: ${error.message}`);
    return 2;
  }
  const version = pkg.version;
  const tag = `v${version}`;
  const commit = git(['rev-parse', 'HEAD'], root).stdout?.trim() || 'unknown';
  const previousTag = options.previousTag || latestTagBelow(version, root);
  const outDir = path.resolve(root, options.out || path.join('artifacts', 'release', tag));
  const logDir = path.join(outDir, 'logs');

  const prerequisitesFile = path.join(root, 'observability/release-prerequisites.json');
  let prerequisiteDocument = null;
  let prerequisiteValidation = { ok: false, findings: [{ code: 'PREREQUISITES_MISSING' }], external: [], deferred: [] };
  try {
    prerequisiteDocument = readJson(prerequisitesFile);
    prerequisiteValidation = validatePrerequisites(prerequisiteDocument);
  } catch (error) {
    prerequisiteValidation.findings.push({ code: 'PREREQUISITES_UNREADABLE', detail: error.message });
  }

  if (options.dryRun) {
    const planPrerequisites = prerequisiteDocument || { external: [], deferred: [] };
    return dryRunPlan({ root, version, tag, outDir, profile: options.profile, previousTag, prerequisites: planPrerequisites, json: options.json });
  }

  const preflight = [];
  const preflightFail = (message) => {
    return writePreflightReport({ root, outDir, version, commit, tag, code: 2, message, json: options.json });
  };
  if (!fs.existsSync(path.join(root, 'package.json'))) return preflightFail('package.json is missing');
  if (!git(['rev-parse', '--is-inside-work-tree'], root).stdout?.includes('true')) {
    return preflightFail('not a git worktree; the gate needs commit and tag identity');
  }
  const dirty = git(['status', '--porcelain'], root).stdout || '';
  if (dirty.trim()) {
    return preflightFail(`working tree is dirty; commit or remove these paths first:\n${dirty.trim()}`);
  }
  const tagExists = git(['rev-parse', '--verify', `refs/tags/${tag}`], root).status === 0;
  if (tagExists) return preflightFail(`${tag} already exists; bump package.json before releasing again`);
  if (!previousTag) return preflightFail('no previous SemVer tag found; pass RELEASE_PREVIOUS_TAG');

  const playwright = resolvePlaywright(root);
  if (!playwright.ok) {
    const message = `Playwright is required by the browser gates and was not found at ${playwright.candidate}. Set PLAYWRIGHT_MODULE. ${playwright.error}`;
    return writePreflightReport({ root, outDir, version, commit, tag, code: 3, message, json: options.json });
  }
  const axePath = process.env.AXE_PATH || path.join(root, 'node_modules/axe-core/axe.min.js');
  if (!fs.existsSync(axePath)) {
    return writePreflightReport({
      root,
      outDir,
      version,
      commit,
      tag,
      code: 3,
      message: `axe-core is required by the a11y gate and was not found at ${axePath}. Set AXE_PATH.`,
      json: options.json,
    });
  }
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 20) {
    return writePreflightReport({ root, outDir, version, commit, tag, code: 3, message: `Node ${process.versions.node} is below the supported >=20`, json: options.json });
  }

  const env = { ...process.env, PLAYWRIGHT_MODULE: playwright.module, AXE_PATH: axePath };
  const run = makeRunner({ root, outDir, logDir, env });
  const gates = [];
  let testCounts = null;
  let testCountReport = null;
  let docsReport = null;
  let rollbackReport = null;
  let rollbackFile = null;
  let countMismatch = false;
  let missingDependency = false;
  const startedAt = new Date();
  const startedMs = Date.now();

  const say = options.json ? (...args) => console.error(...args) : (...args) => console.log(...args);
  const push = (gate) => {
    if (!gate.ok) {
      if (gate.id === 'rollback' && gate.missingDependency) missingDependency = true;
      const marker = gate.detail ? ` — ${gate.detail}` : '';
      console.error(`release:gate RED — ${gate.id}${marker}`);
      if (gate.tail) console.error(gate.tail.split('\n').slice(-10).map((line) => `  ${line}`).join('\n'));
    } else {
      say(`ok ${gate.id} (${Math.round(gate.durationMs)} ms)`);
    }
    return gate.ok;
  };

  // 0. External prerequisite schema -------------------------------------------------
  gates.push({
    id: 'prerequisites',
    name: 'External prerequisites schema',
    command: 'validate observability/release-prerequisites.json',
    status: prerequisiteValidation.ok ? 'pass' : 'fail',
    ok: prerequisiteValidation.ok,
    durationMs: 0,
    exitCode: prerequisiteValidation.ok ? 0 : 1,
    evidence: relative(root, prerequisitesFile),
    detail: prerequisiteValidation.ok ? null : prerequisiteValidation.findings.map((finding) => finding.code).join(', '),
    tail: prerequisiteValidation.ok ? '' : JSON.stringify(prerequisiteValidation.findings, null, 2).slice(-2000),
    log: relative(root, prerequisitesFile),
    missingDependency: false,
  });
  push(gates.at(-1));

  // 1. Version SSOT + cache-bust ----------------------------------------------------
  if (!gates.some((gate) => gate.id === 'version')) {
    const versionRun = run('version', 'Version SSOT + cache-bust', ['scripts/check-version.mjs'], {
      timeout: 60_000,
      evidence: (stdout, stderr) => `${stdout}${stderr}`.trim().split('\n').slice(-1)[0],
    });
    const triple = checkVersionTriple({ root, version });
    const failure = [...triple.findings.map((finding) => `${finding.code} ${finding.file || ''}`), ...(versionRun.ok ? [] : ['check-version exit'])];
    const gate = {
      ...versionRun,
      status: versionRun.ok && triple.ok ? 'pass' : 'fail',
      ok: versionRun.ok && triple.ok,
      detail: failure.length ? failure.join('; ') : `app ${version} · 4 slots`,
      tail: failure.length ? `${failure.join('\n')}\n${versionRun.tail}` : versionRun.tail,
    };
    gates.push(gate);
    push(gate);
  }

  // 2. Test suite -------------------------------------------------------------------
  let testGate = null;
  if (!gates.some((gate) => gate.id === 'tests')) {
    const testFiles = fs
      .readdirSync(path.join(root, 'test'))
      .filter((name) => name.endsWith('.test.js'))
      .sort()
      .map((name) => path.join(root, 'test', name));
    const tests = run('tests', 'node:test suite', ['--test', ...testFiles], {
      timeout: 300_000,
      command: 'node --test test/*.test.js',
      evidence: (stdout, stderr) => {
        const counts = parseTapSummary(`${stdout}\n${stderr}`);
        return counts ? `${counts.pass}/${counts.tests} pass, ${counts.fail} fail` : 'no TAP summary';
      },
    });
    testCounts = parseTapSummary(`${tests.stdout}\n${tests.stderr}`);
    const gate = {
      ...tests,
      status: tests.ok && testCounts && testCounts.fail === 0 ? 'pass' : 'fail',
      ok: tests.ok && Boolean(testCounts) && testCounts.fail === 0,
      detail: testCounts ? `${testCounts.pass}/${testCounts.tests} pass, ${testCounts.fail} fail` : 'no TAP summary',
    };
    gates.push(gate);
    testGate = push(gate) ? gate : null;
    if (!gate.ok) {
      // A failing suite makes later gates unreliable; still run the docs/count gate
      // so the report names every independent failure, then stop before browsers.
    }
  }

  // 3. Documented versus executed test count ----------------------------------------
  if (!gates.some((gate) => gate.id === 'test-count')) {
    const claimFiles = ['README.md', 'ARCHITECTURE.md', 'RELEASE_NOTES.md', 'narimato-physics.md'];
    const claims = [];
    for (const file of claimFiles) {
      let text = '';
      try {
        text = fs.readFileSync(path.join(root, file), 'utf8');
      } catch {
        continue;
      }
      claims.push(...extractCountClaims({ file, text, version }));
    }
    testCountReport = verifyTestCounts({ claims, executed: testCounts ? testCounts.tests : null, fail: testCounts ? testCounts.fail : 0 });
    const mismatches = testCountReport.findings.filter((finding) => finding.code === 'COUNT_MISMATCH');
    countMismatch = mismatches.length > 0;
    const detail = testCountReport.ok
      ? `${testCounts.tests} tests · ${claims.length} documented claims agree`
      : testCountReport.findings
          .slice(0, 6)
          .map((finding) => (finding.code === 'COUNT_MISMATCH' ? `${finding.file}:${finding.line} claims ${finding.claimed}, executed ${finding.executed}` : finding.code))
          .join('; ');
    const gate = {
      id: 'test-count',
      sequence: null,
      name: 'Documented versus executed test count',
      command: 'lib/release-checks.js verifyTestCounts',
      args: [],
      status: testCountReport.ok ? 'pass' : 'fail',
      ok: testCountReport.ok,
      durationMs: 0,
      exitCode: testCountReport.ok ? 0 : 4,
      detail,
      tail: testCountReport.findings.length ? JSON.stringify(testCountReport.findings.slice(0, 20), null, 2) : '',
      log: relative(root, path.join(outDir, 'release-manifest.json')),
      missingDependency: false,
    };
    gates.push(gate);
    push(gate);
  }

  // If the suite itself is red, browser/load gates cannot rescue the verdict. Run
  // docs and evidence checks only (cheap, independent) and finish.
  const suiteRed = gates.some((gate) => gate.id === 'tests' && !gate.ok);

  if (!suiteRed) {
    // 4. Docs / links ---------------------------------------------------------------
    const docsRun = run('docs', 'Docs and link gate (R1-R6)', ['scripts/check-docs.mjs', '--json'], {
      timeout: 120_000,
      evidence: (stdout) => {
        try {
          const report = JSON.parse(stdout);
          docsReport = report;
          return `${report.files} files · ${report.links} links · ${report.findings.length} findings`;
        } catch {
          return 'unparseable --json report';
        }
      },
    });
    let docsJson = null;
    try {
      docsJson = JSON.parse(docsRun.stdout);
    } catch {
      docsJson = null;
    }
    const docsGate = {
      ...docsRun,
      status: docsRun.ok && docsJson && docsJson.ok ? 'pass' : 'fail',
      ok: docsRun.ok && Boolean(docsJson) && docsJson.ok === true,
      detail: docsJson ? `${docsJson.files} markdown files · ${docsJson.links} links · ${docsJson.findings.length} findings` : 'docs report missing',
    };
    docsReport = docsJson;
    gates.push(docsGate);
    push(docsGate);

    // 5. GDS build, verify, determinism --------------------------------------------
    const buildRun = run('gds-build', 'GDS build, verify and determinism', ['scripts/build-ui.mjs'], { timeout: 180_000 });
    const island = ['public/ui/island.js', 'public/ui/island.css'];
    const hashesBefore = island.map((file) => hashFile(path.join(root, file)));
    const rebuildRun = run('gds-rebuild', 'GDS deterministic rebuild', ['scripts/build-ui.mjs'], { timeout: 180_000 });
    const hashesAfter = island.map((file) => hashFile(path.join(root, file)));
    const verifyRun = run('gds-verify', 'GDS island contract', ['scripts/verify-gds-build.mjs'], { timeout: 120_000 });
    const diff = git(['diff', '--exit-code', '--', ...island], root);
    const deterministic = hashesBefore.every((hash, index) => hash !== null && hash === hashesAfter[index]);
    const gdsOk = buildRun.ok && rebuildRun.ok && verifyRun.ok && diff.status === 0 && deterministic;
    const gdsGate = {
      id: 'gds-build',
      sequence: buildRun.sequence,
      name: 'GDS build, verify and determinism',
      command: 'node scripts/build-ui.mjs; node scripts/verify-gds-build.mjs; git diff --exit-code public/ui/island.js public/ui/island.css',
      args: [],
      status: gdsOk ? 'pass' : 'fail',
      ok: gdsOk,
      durationMs: buildRun.durationMs + rebuildRun.durationMs + verifyRun.durationMs,
      exitCode: gdsOk ? 0 : 1,
      detail: gdsOk
        ? (() => {
            try {
              return `island v${readJson(path.join(root, 'public/ui/manifest.json')).version} · deterministic · clean diff`;
            } catch {
              return 'deterministic · clean diff';
            }
          })()
        : [buildRun.ok ? null : 'build failed', verifyRun.ok ? null : 'verify failed', diff.status === 0 ? null : 'island assets differ from a fresh build', deterministic ? null : 'two builds are not byte-identical'].filter(Boolean).join('; '),
      tail: [buildRun.tail, rebuildRun.tail, verifyRun.tail, scrubSecrets(diff.stderr || '')].filter(Boolean).join('\n').slice(-6000),
      log: buildRun.log,
      missingDependency: false,
    };
    gates.push(gdsGate);
    push(gdsGate);

    // 6. Accessibility gate ---------------------------------------------------------
    const a11yDir = path.join(outDir, 'a11y');
    const a11yRun = run('a11y', 'GDS accessibility gate (Chromium)', ['scripts/a11y-gate.mjs', '--engine=chromium', `--out=${a11yDir}`], {
      timeout: 900_000,
      evidence: () => relative(root, path.join(a11yDir, 'report.json')),
    });
    let a11yReport = null;
    try {
      a11yReport = readJson(path.join(a11yDir, 'report.json'));
    } catch {
      a11yReport = null;
    }
    const a11yGate = {
      ...a11yRun,
      status: a11yRun.ok && a11yReport && a11yReport.status === 'pass' ? 'pass' : 'fail',
      ok: a11yRun.ok && Boolean(a11yReport) && a11yReport.status === 'pass',
      detail: a11yReport ? `status ${a11yReport.status} · ${a11yReport.summary?.failure ?? '?'} failures · ${a11yReport.summary?.warning ?? '?'} warnings` : 'a11y report missing',
    };
    gates.push(a11yGate);
    push(a11yGate);

    // 7. Two-client acceptance ------------------------------------------------------
    const twoRun = run('two-client', 'Two-client surface acceptance', ['scripts/acceptance-two-client-surface.mjs'], {
      timeout: 300_000,
      evidence: (stdout) => /report:\s*(\S+)/.exec(stdout)?.[1] || 'media/acceptance',
    });
    const twoGate = {
      ...twoRun,
      status: twoRun.ok && /^PASS two-client-surface/m.test(twoRun.stdout) ? 'pass' : 'fail',
      ok: twoRun.ok && /^PASS two-client-surface/m.test(twoRun.stdout),
      detail: /^PASS two-client-surface.*$/m.exec(twoRun.stdout)?.[0] || 'no PASS line',
    };
    gates.push(twoGate);
    push(twoGate);

    // 9. Surface truth acceptance (TST-01 defect fixed in this release) --------------
    const truthRun = run('surface-truth', 'Surface truth acceptance', ['scripts/acceptance-surface-truth.mjs'], {
      timeout: 300_000,
      evidence: (stdout) => /report:\s*(\S+)/.exec(stdout)?.[1] || 'media/acceptance',
    });
    const truthGate = {
      ...truthRun,
      status: truthRun.ok && /^PASS surface-truth/m.test(truthRun.stdout) ? 'pass' : 'fail',
      ok: truthRun.ok && /^PASS surface-truth/m.test(truthRun.stdout),
      detail: /^PASS surface-truth.*$/m.exec(truthRun.stdout)?.[0] || 'no PASS line',
    };
    gates.push(truthGate);
    push(truthGate);

    // 10. Load/chaos smoke (fast profile; soak is separate) -------------------------
    const loadDir = path.join(outDir, 'load');
    const loadScenarios = options.profile === 'full' ? 'smoke,load,chaos' : 'smoke,chaos';
    const loadRun = run('load-chaos', 'Load/chaos smoke (fast profile)', ['scripts/perf-gate.mjs', `--only=${loadScenarios}`, `--out=${loadDir}`], {
      timeout: options.profile === 'full' ? 1_800_000 : 600_000,
      evidence: () => relative(root, path.join(loadDir, 'summary.json')),
    });
    let loadSummary = null;
    try {
      loadSummary = readJson(path.join(loadDir, 'summary.json'));
    } catch {
      loadSummary = null;
    }
    const loadGate = {
      ...loadRun,
      status: loadRun.ok && loadSummary && loadSummary.verdict === 'pass' ? 'pass' : 'fail',
      ok: loadRun.ok && Boolean(loadSummary) && loadSummary.verdict === 'pass',
      detail: loadSummary ? `verdict ${loadSummary.verdict} · ${loadSummary.runs?.length ?? '?'} run(s)` : 'summary.json missing',
    };
    gates.push(loadGate);
    push(loadGate);

    // 11. Recovery drill ------------------------------------------------------------
    const recoveryRun = run('recovery', 'Persistence recovery drill', ['scripts/recovery-test.mjs'], {
      timeout: 300_000,
      evidence: (stdout) => /drill: (PASS|FAIL)/.exec(stdout)?.[0] || 'drill output',
    });
    const recoveryGate = {
      ...recoveryRun,
      status: recoveryRun.ok && /drill: PASS/.test(recoveryRun.stdout) ? 'pass' : 'fail',
      ok: recoveryRun.ok && /drill: PASS/.test(recoveryRun.stdout),
      detail: /drill: (PASS|FAIL)[^\n]*/.exec(recoveryRun.stdout)?.[0] || 'no drill line',
    };
    gates.push(recoveryGate);
    push(recoveryGate);

    // 12. Rollback drill ------------------------------------------------------------
    rollbackFile = path.join(outDir, 'rollback-drill.json');
    const rollbackRun = run('rollback', 'Binary rollback drill', ['scripts/rollback-drill.mjs', `--previous-tag=${previousTag}`, `--report=${rollbackFile}`], {
      timeout: 600_000,
      evidence: () => relative(root, rollbackFile),
    });
    try {
      rollbackReport = readJson(rollbackFile);
    } catch {
      rollbackReport = null;
    }
    const rollbackGate = {
      ...rollbackRun,
      status: rollbackRun.ok && rollbackReport && rollbackReport.ok ? 'pass' : 'fail',
      ok: rollbackRun.ok && Boolean(rollbackReport) && rollbackReport.ok === true,
      missingDependency: rollbackRun.exitCode === 3,
      detail: rollbackReport ? `${rollbackReport.drill} · ${rollbackReport.previousTag} · RTO ${rollbackReport.rtoMinutes} min` : 'rollback report missing',
    };
    gates.push(rollbackGate);
    push(rollbackGate);

    // 13. Evidence ledger -----------------------------------------------------------
    const evidenceRun = run('evidence', 'Release evidence ledger', ['scripts/evidence-check.mjs', '--readme', 'README.md', '--notes', 'RELEASE_NOTES.md', '--ledger', 'docs/RELEASE_EVIDENCE.md', '--json'], {
      timeout: 120_000,
      evidence: (stdout) => {
        try {
          const report = JSON.parse(stdout);
          return `${report.summary?.total ?? '?'} claims · ${report.summary?.live ?? '?'} LIVE`;
        } catch {
          return 'ledger report';
        }
      },
    });
    let evidenceReport = null;
    try {
      evidenceReport = JSON.parse(evidenceRun.stdout);
    } catch {
      evidenceReport = null;
    }
    const evidenceGate = {
      ...evidenceRun,
      status: evidenceRun.ok && evidenceReport && evidenceReport.ok ? 'pass' : 'fail',
      ok: evidenceRun.ok && Boolean(evidenceReport) && evidenceReport.ok === true,
      detail: evidenceReport ? `${evidenceReport.summary?.total ?? '?'} claims · ${evidenceReport.findings?.length ?? '?'} findings · exit ${evidenceRun.exitCode}` : 'ledger report missing',
    };
    gates.push(evidenceGate);
    push(evidenceGate);
  } else {
    // The suite is red: run the ledger check anyway because it is independent and
    // cheap, then produce the RED manifest with all known failures.
    const evidenceRun = run('evidence', 'Release evidence ledger', ['scripts/evidence-check.mjs', '--readme', 'README.md', '--notes', 'RELEASE_NOTES.md', '--ledger', 'docs/RELEASE_EVIDENCE.md', '--json'], {
      timeout: 120_000,
    });
    let evidenceReport = null;
    try {
      evidenceReport = JSON.parse(evidenceRun.stdout);
    } catch {
      evidenceReport = null;
    }
    const evidenceGate = {
      ...evidenceRun,
      status: evidenceRun.ok && evidenceReport && evidenceReport.ok ? 'pass' : 'fail',
      ok: evidenceRun.ok && Boolean(evidenceReport) && evidenceReport.ok === true,
      detail: evidenceReport ? `${evidenceReport.summary?.total ?? '?'} claims · ${evidenceReport.findings?.length ?? '?'} findings` : 'ledger report missing',
    };
    gates.push(evidenceGate);
    push(evidenceGate);
  }

  for (const gate of gates) {
    if (!gate.evidence) gate.evidence = gate.log || 'not applicable';
  }
  const verdict = verdictFor({ gates, prerequisites: prerequisiteValidation });
  const exitCode = exitCodeFor({ verdict, countMismatch, missingDependency });
  const finishedAt = new Date();
  const manifest = {
    schemaVersion: 1,
    mode: 'release',
    version,
    commit,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], root).stdout?.trim() || null,
    tag,
    generatedAt: finishedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedMs,
    profile: options.profile,
    confirmed: options.confirm,
    gates: gates.map(({ stdout, stderr, args, ...gate }) => ({ ...gate, stdout: undefined, stderr: undefined, args: undefined })),
    testCount: {
      executed: testCounts ? testCounts.tests : null,
      pass: testCounts ? testCounts.pass : null,
      fail: testCounts ? testCounts.fail : null,
      durationMs: testCounts ? testCounts.durationMs : null,
      claimsChecked: testCountReport ? testCountReport.claims?.length ?? null : null,
      mismatches: testCountReport ? testCountReport.findings.filter((finding) => finding.code === 'COUNT_MISMATCH').length : null,
      report: testCountReport,
    },
    docs: docsReport ? { files: docsReport.files, links: docsReport.links, findings: docsReport.findings.length } : { files: null, links: null },
    externalPrerequisites: prerequisiteValidation.external || [],
    deferredPrerequisites: prerequisiteValidation.deferred || [],
    prerequisitesSource: relative(root, prerequisitesFile),
    rollback: rollbackReport
      ? {
          previousTag: rollbackReport.previousTag,
          previousCommit: rollbackReport.previousCommit,
          drillOk: rollbackReport.ok,
          rtoMinutes: rollbackReport.rtoMinutes,
          schema: rollbackReport.current?.persistVersion,
          report: relative(root, rollbackFile),
        }
      : null,
    verdict,
    exitCode,
    artifacts: {
      dir: relative(root, outDir),
      manifest: relative(root, path.join(outDir, 'release-manifest.json')),
      report: relative(root, path.join(outDir, 'release-report.md')),
      logs: relative(root, path.join(outDir, 'logs')),
    },
    notes:
      'The 120-minute soak is a separate release prerequisite (weekly CI job or `node scripts/perf-gate.mjs --only=soak`). ' +
      'A11Y-02 (real-device accessibility) and OPS-04 (edge/CDN activation) are external blockers; the gate reports BLOCKED until their evidence is linked.',
  };
  delete manifest.testCount.report;

  const manifestValidation = validateManifest(manifest);
  if (!manifestValidation.ok) {
    manifest.gates.push({
      id: 'manifest',
      name: 'Manifest contract',
      command: 'lib/release-checks.js validateManifest',
      status: 'fail',
      ok: false,
      durationMs: 0,
      exitCode: 1,
      evidence: relative(root, path.join(outDir, 'release-manifest.json')),
      detail: manifestValidation.findings.map((finding) => finding.code).join(', '),
      tail: JSON.stringify(manifestValidation.findings, null, 2),
      log: relative(root, path.join(outDir, 'release-manifest.json')),
    });
    manifest.verdict = 'RED';
    manifest.exitCode = exitCodeFor({ verdict: 'RED', countMismatch, missingDependency });
  }

  const summary = renderSummary(manifest);
  writeArtifacts({ dir: outDir, manifest, markdown: summary });
  if (options.json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  else {
    process.stdout.write(`${summary}\n`);
    process.stdout.write(`\nrelease:gate ${manifest.verdict} — exit ${manifest.exitCode} · ${manifest.artifacts.report}\n`);
  }
  return manifest.exitCode;
}

process.exitCode = main(process.argv.slice(2));
