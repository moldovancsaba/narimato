#!/usr/bin/env node
/**
 * NARIMATO — recovery drill (OPS-03).
 *
 * Rehearses the documented recovery path end to end against throwaway data:
 * boot a server, create pilots and world state, stop it, run
 * `backup-data.mjs` -> `verify-data.mjs` -> `restore-data.mjs`, boot the
 * restored directory and prove players, tokens and world counters survived.
 *
 * Usage:
 *   node scripts/recovery-test.mjs [--json]
 *
 * Exit codes: 0 drill PASS, 1 drill FAIL, 7 I/O.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');

function runNode(args, { cwd = ROOT, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Boot `node server.js` on an ephemeral port and return its base URL. */
function startServer(dataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: '0',
        HOST: '127.0.0.1',
        DATA_DIR: dataDir,
        BOTS: '0',
        DEPOSIT_CHANCE: '0',
        CLICK_COOLDOWN_MS: '0',
        SAVE_DEBOUNCE_MS: '20',
      },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`server did not start:\n${stdout}\n${stderr}`));
    }, 15_000);
    timer.unref?.();
    const onData = (chunk) => {
      stdout += chunk;
      const match = /url:\s+(http:\/\/[^\s]+)/.exec(stdout);
      if (match) {
        clearTimeout(timer);
        resolve({ child, url: match[1], getLog: () => `${stdout}\n${stderr}` });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) reject(new Error(`server exited early (${code}):\n${stdout}\n${stderr}`));
    });
  });
}

async function stopServer(server) {
  if (!server || !server.child || server.child.exitCode !== null) return;
  const exited = new Promise((resolve) => server.child.once('exit', resolve));
  server.child.kill('SIGTERM');
  await Promise.race([exited, delay(8000)]);
  if (server.child.exitCode === null) server.child.kill('SIGKILL');
}

async function waitHealthy(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return await response.json();
    } catch {
      /* retry */
    }
    await delay(100);
  }
  throw new Error(`server never became healthy at ${url}`);
}

async function postJson(url, pathname, body) {
  const response = await fetch(`${url}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'narimato-drill-'));
  const dataDir = path.join(root, 'data');
  const backupDir = path.join(root, 'backups');
  const restoredDir = path.join(root, 'restored');
  const failures = [];
  let server = null;
  let restoredServer = null;
  try {
    server = await startServer(dataDir);
    await waitHealthy(server.url);
    const pilots = [];
    for (const tag of ['DRILL-1', 'DRILL-2', 'DRILL-3']) {
      const joined = await postJson(server.url, '/api/join', { tag });
      if (joined.status !== 200) throw new Error(`join ${tag} failed: ${joined.status}`);
      pilots.push(joined.json);
      await postJson(server.url, '/api/action', { token: joined.json.token, type: 'click', label: '1' });
    }
    const before = (await (await fetch(`${server.url}/api/state`)).json()).state;
    await stopServer(server);
    server = null;

    const backup = await runNode(['scripts/backup-data.mjs', '--data-dir', dataDir, '--out', backupDir]);
    if (backup.code !== 0) failures.push(`backup exited ${backup.code}: ${backup.stderr.trim()}`);
    const archiveName = (await readdir(backupDir).catch(() => [])).find((name) => name.endsWith('.tar.gz'));
    if (!archiveName) failures.push('backup produced no archive');
    const archive = archiveName ? path.join(backupDir, archiveName) : '';

    if (archive) {
      const verify = await runNode(['scripts/verify-data.mjs', '--archive', archive]);
      if (verify.code !== 0) failures.push(`verify exited ${verify.code}: ${verify.stderr.trim()}`);
      const restore = await runNode(['scripts/restore-data.mjs', '--backup', archive, '--data-dir', restoredDir, '--apply', '--yes', '--port', '0']);
      if (restore.code !== 0) failures.push(`restore exited ${restore.code}: ${restore.stderr.trim()}`);
      else if (!/RESTORED players=\d+ tokens=\d+/.test(restore.stdout)) failures.push('restore did not report RESTORED');
    }

    if (!failures.length) {
      restoredServer = await startServer(restoredDir);
      await waitHealthy(restoredServer.url);
      const after = (await (await fetch(`${restoredServer.url}/api/state`)).json()).state;
      if (after.players.length !== before.players.length) failures.push(`players lost: ${before.players.length} -> ${after.players.length}`);
      if (after.totalClicks !== before.totalClicks) failures.push(`totalClicks lost: ${before.totalClicks} -> ${after.totalClicks}`);
      if (after.faces !== before.faces) failures.push(`faces changed: ${before.faces} -> ${after.faces}`);
      for (const pilot of pilots) {
        const rejoin = await postJson(restoredServer.url, '/api/join', { tag: pilot.player.tag, token: pilot.token });
        if (rejoin.status !== 200 || rejoin.json.player.id !== pilot.player.id) failures.push(`token lost for ${pilot.player.tag}`);
      }
      await stopServer(restoredServer);
      restoredServer = null;
    }

    const report = {
      ok: failures.length === 0,
      drill: failures.length === 0 ? 'PASS' : 'FAIL',
      dataDir,
      archive,
      players: before ? before.players.length : 0,
      totalClicks: before ? before.totalClicks : 0,
      failures,
    };
    if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
    else {
      for (const failure of failures) console.error(`drill failure: ${failure}`);
      console.log(report.ok ? 'drill: PASS — players, tokens and world counters survived backup/verify/restore.' : 'drill: FAIL');
    }
    const code = report.ok ? 0 : 1;
    return code;
  } catch (error) {
    if (!JSON_OUT) console.error(`drill: FAIL — ${error?.message || error}`);
    else console.log(JSON.stringify({ ok: false, drill: 'FAIL', error: String(error?.message || error) }, null, 2));
    return 1;
  } finally {
    await stopServer(server);
    await stopServer(restoredServer);
    await rm(root, { recursive: true, force: true });
  }
}

process.exitCode = await main();
