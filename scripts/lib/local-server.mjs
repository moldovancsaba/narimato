/**
 * Shared dev-only helper for the CTL acceptance scripts.
 *
 * Starts a throwaway local server (temporary DATA_DIR, bots off by default) and
 * tears it down afterwards, so every acceptance run is isolated from the real
 * world file and from another running game server.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * @param {{port?:number, env?:Record<string,string>}} [options]
 * @returns {Promise<{base:string, dataDir:string, stop:()=>Promise<void>, log:()=>string}>}
 */
export async function startLocalServer({ port = 0, env = {} } = {}) {
  // A random high port keeps parallel acceptance runs (and other agents on the
  // same machine) from attaching to each other's throwaway server.
  const chosen = Number(port) > 0 ? Number(port) : 20000 + Math.floor(Math.random() * 20000);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-ctl-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(chosen),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      BOTS: '0',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk; });
  child.stderr.on('data', (chunk) => { log += chunk; });
  const base = `http://127.0.0.1:${chosen}`;
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        return {
          base,
          dataDir,
          log: () => log,
          stop: async () => {
            if (!child.killed) child.kill('SIGTERM');
            await delay(150);
            if (!child.killed) child.kill('SIGKILL');
            await rm(dataDir, { recursive: true, force: true });
          },
        };
      }
    } catch {
      /* not up yet */
    }
    await delay(150);
  }
  child.kill('SIGKILL');
  await rm(dataDir, { recursive: true, force: true });
  throw new Error(`local server did not start on ${chosen}:\n${log}`);
}

/** Require Playwright from PLAYWRIGHT_MODULE (dev-only, never a runtime dep). */
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  try {
    return require(spec);
  } catch (err) {
    console.error(`[ctl] Playwright not found at "${spec}" (set PLAYWRIGHT_MODULE).`);
    throw err;
  }
}

/**
 * Dismiss the post-join cockpit chrome (landing brief, auto-opened guide,
 * manual, report) until the canvas owns the screen centre again, so pointer
 * gestures in acceptance scripts hit the game and not a modal.
 *
 * The landing brief is scheduled ~300 ms after join, so this waits past that
 * timer and re-checks for late overlays.
 */
export async function dismissGameOverlays(page) {
  const clickVisibleOverlay = () => page.evaluate(() => {
    const isVisible = (el) => !!el && el.getClientRects().length > 0;
    const brief = document.getElementById('btn-landing-brief-start');
    if (isVisible(brief)) { brief.click(); return 'brief'; }
    const guide = document.getElementById('btn-guide-close') || document.getElementById('btn-guide-start');
    const guideOverlay = document.getElementById('guide-overlay');
    if (isVisible(guide) && guideOverlay && !guideOverlay.classList.contains('is-hidden')) { guide.click(); return 'guide'; }
    const manual = document.getElementById('btn-manual-close');
    if (isVisible(manual)) { manual.click(); return 'manual'; }
    const close = document.getElementById('btn-report-close');
    const report = document.getElementById('report-overlay');
    if (isVisible(close) && report && !report.classList.contains('is-hidden')) { close.click(); return 'report'; }
    return null;
  });
  const centreIsCanvas = () => page.evaluate(() => {
    const el = document.elementFromPoint(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));
    return !!el && el.id === 'arena-canvas';
  });
  await delay(700); // past the post-join landing-brief timer
  let clearStreak = 0;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const clicked = await clickVisibleOverlay();
    if (clicked) {
      clearStreak = 0;
      await delay(280);
      continue;
    }
    if (await centreIsCanvas()) {
      clearStreak += 1;
      if (clearStreak >= 2) return true;
    } else {
      clearStreak = 0;
    }
    await delay(180);
  }
  return false;
}

/**
 * Launch headless Chromium. Prefers the full Chromium channel (new headless)
 * because the old `chrome-headless-shell` binary is the one broad cleanup
 * scripts tend to kill; falls back to the default when the channel is missing.
 */
export async function launchChromium(chromium) {
  const args = ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'];
  try {
    return await chromium.launch({ headless: true, channel: 'chromium', args });
  } catch (err) {
    console.warn(`[ctl] chromium channel unavailable (${err && err.message ? err.message.split('\n')[0] : err}); using default headless shell`);
    return chromium.launch({ headless: true, args });
  }
}

/** Write one JSON line and set a non-zero exit code when any check failed. */
export function finish(report) {
  const ok = !report.failures || report.failures.length === 0;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!ok) process.exitCode = 1;
  return ok;
}
