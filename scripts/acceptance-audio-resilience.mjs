/**
 * AUD-01 acceptance: playback resilience evidence in a real browser.
 *
 * Scenarios:
 *  1. Autoplay block (Chromium launched with --autoplay-policy=user-gesture-required):
 *     a pending sentence shows the real TAP FOR VOICE button (44 px, described);
 *     activating it unlocks playback and resumes the pending sentence.
 *  2. Clip failure fallback: every audio request is aborted; the watchdog counts
 *     `audio.clipFailures`, narration degrades to captions and the subtitle line
 *     stays readable (no silent dead air).
 *  3. Correct first-word telemetry: `audio.firstWordMs` is measured cue-start →
 *     first `playing`, so it is far smaller than navigation-relative
 *     `performance.now()`; the server aggregates it in `/api/telemetry`.
 *
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-audio-resilience.mjs
 */
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'media', 'evt-01-03-aud-01');

let serverHandle = null;
let dataDir = null;
let base = process.env.BASE_URL || '';
if (!base) {
  const { startServer } = await import('../server.js');
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-aud-'));
  serverHandle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0, saveDebounceMs: 10 },
  });
  base = serverHandle.url;
}
await mkdir(OUT_DIR, { recursive: true });
const report = { ok: false, base, autoplay: null, failure: null, firstWord: null, errors: [] };

// Emulate a strict mobile autoplay policy (iOS Safari / Chrome gesture gate).
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });

async function newPage(browser, { abortAudio = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    try { localStorage.setItem('icosa.guideSeen', '1'); } catch { /* private mode */ }
  });
  if (abortAudio) {
    await context.route('**/*.m4a*', (route) => route.abort('failed'));
  }
  const page = await context.newPage();
  page.on('pageerror', (err) => report.errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load')) report.errors.push(msg.text());
  });
  await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
  await delay(400);
  return { context, page };
}

async function join(page, tag) {
  await page.fill('#tag-input', tag);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
  await delay(700);
  await page.click('#btn-landing-brief-start').catch(() => {});
  await delay(250);
}

try {
  /* 1 ---------------------------------------------------- autoplay gate */
  {
    const { context, page } = await newPage(browser);
    // Join programmatically so the landing screen stops hiding the caption bar,
    // while NOT producing a user gesture (audio must stay locked).
    await page.evaluate(() => window.__ICOSA__.join('AUTO1'));
    await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 10000 });
    await delay(500);
    // Not a single gesture yet: start a cue, expect the actionable control.
    await page.evaluate(() => window.__ICOSA__.narratorPlayCue('tip-meteor'));
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-tap-voice');
      return !!btn && !btn.hidden && !!window.__ICOSA__?.narrator()?.tapVoiceVisible;
    }, null, { timeout: 4000 });
    const before = await page.evaluate(() => {
      const btn = document.getElementById('btn-tap-voice');
      const state = window.__ICOSA__.narrator();
      return {
        visible: !btn.hidden,
        text: btn.textContent.trim(),
        describedby: btn.getAttribute('aria-describedby'),
        minHeight: getComputedStyle(btn).minHeight,
        minWidth: getComputedStyle(btn).minWidth,
        unlocked: state.unlocked,
        speaking: state.speaking,
        subtitle: state.subtitle,
      };
    });
    if (!before.visible) throw new Error('autoplay: TAP FOR VOICE not visible');
    if (before.text !== 'TAP FOR VOICE') throw new Error(`autoplay: label ${before.text}`);
    if (before.describedby !== 'tap-voice-help') throw new Error('autoplay: button not described');
    if (before.minHeight !== '44px' || before.minWidth !== '44px') throw new Error('autoplay: touch target < 44px');
    if (before.unlocked) throw new Error('autoplay: audio unlocked without a gesture');
    await page.screenshot({ path: path.join(OUT_DIR, 'audio-autoplay-tap-for-voice.jpg'), type: 'jpeg', quality: 82 });

    // A real activation of the control (pointerdown captured by narrator is the
    // browser gesture): the pending sentence resumes from its beginning.
    await page.evaluate(() => document.getElementById('btn-tap-voice').click());
    await page.waitForFunction(() => {
      const state = window.__ICOSA__?.narrator();
      return !!state && state.unlocked === true;
    }, null, { timeout: 5000 });
    const after = await page.evaluate(() => {
      const btn = document.getElementById('btn-tap-voice');
      return { hidden: btn.hidden, state: window.__ICOSA__.narrator() };
    });
    if (!after.hidden) throw new Error('autoplay: TAP FOR VOICE still visible after unlock');
    report.autoplay = { before, after: { hidden: after.hidden, unlocked: after.state.unlocked, subtitle: after.state.subtitle } };
    await context.close();
  }

  /* 2 --------------------------------------------------- failure ladder */
  {
    const { context, page } = await newPage(browser, { abortAudio: true });
    await join(page, 'AUDFAIL');
    await page.evaluate(() => window.__ICOSA__.narratorPlayCue('event-relief'));
    await page.waitForFunction(() => {
      const state = window.__ICOSA__?.narrator();
      const telemetry = window.__ICOSA__?.audioTelemetry();
      return !!state && (state.clipFailures >= 1 || telemetry?.audio?.clipFailures >= 1);
    }, null, { timeout: 9000 });
    await delay(1200);
    const state = await page.evaluate(() => ({
      narrator: window.__ICOSA__.narrator(),
      telemetry: window.__ICOSA__.audioTelemetry(),
      subtitleVisible: !document.getElementById('narrative-subtitles').hidden,
      subtitleText: document.getElementById('subtitle-text').textContent,
      speaker: document.getElementById('subtitle-speaker').textContent,
    }));
    if (!(state.telemetry?.audio?.clipFailures >= 1)) throw new Error('failure: clipFailures not counted');
    if (!state.narrator.forcedCaptions && state.narrator.clipFailures < 2) {
      throw new Error(`failure: narration did not degrade to captions (${JSON.stringify(state.narrator)})`);
    }
    if (!state.subtitleVisible || !state.subtitleText.trim()) throw new Error('failure: captions are empty');
    report.failure = state;
    await page.screenshot({ path: path.join(OUT_DIR, 'audio-failure-captions.jpg'), type: 'jpeg', quality: 82 });
    await context.close();
  }

  /* 3 ------------------------------------------------------ first word */
  {
    const { context, page } = await newPage(browser);
    await join(page, 'AUDWORD');
    const cueStart = await page.evaluate(() => {
      const startedAt = performance.now();
      window.__ICOSA__.narratorPlayCue('event-relief');
      return startedAt;
    });
    await page.waitForFunction(() => {
      const audio = window.__ICOSA__?.audioTelemetry()?.audio;
      return !!audio && typeof audio.firstWordMs === 'number';
    }, null, { timeout: 9000 });
    const measurement = await page.evaluate((t0) => ({
      firstWordMs: window.__ICOSA__.audioTelemetry().audio.firstWordMs,
      navigationNowMs: Math.round(performance.now()),
      cueStartMs: Math.round(t0),
      narrator: window.__ICOSA__.narrator(),
    }), cueStart);
    // Cue-relative: a navigation-relative value would be >= cueStartMs.
    if (measurement.firstWordMs > 3000) throw new Error(`firstWordMs ${measurement.firstWordMs} out of SLO`);
    if (measurement.firstWordMs >= measurement.cueStartMs) {
      throw new Error(`firstWordMs ${measurement.firstWordMs} looks navigation-relative (cue started at ${measurement.cueStartMs})`);
    }
    const telemetry = await (await fetch(`${base}/api/telemetry`)).json();
    const aggregate = telemetry.telemetry.aggregates['audio.firstWordMs'];
    if (!aggregate || aggregate.count < 1) throw new Error('server did not aggregate audio.firstWordMs');
    report.firstWord = { ...measurement, serverAggregate: aggregate };
    await context.close();
  }

  if (report.errors.length) throw new Error(`console errors: ${report.errors.join(' | ')}`);
  report.ok = true;
} catch (err) {
  report.error = err?.message || String(err);
  console.error(`[aud-01] ${report.error}`);
} finally {
  await browser.close();
  await writeFile(path.join(OUT_DIR, 'acceptance-audio-resilience.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (serverHandle) await serverHandle.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
console.log(JSON.stringify({
  ok: report.ok,
  error: report.error || null,
  autoplay: report.autoplay && { visible: report.autoplay.before.visible, unlocked: report.autoplay.after.unlocked },
  failure: report.failure && { clipFailures: report.failure.telemetry?.audio?.clipFailures, forcedCaptions: report.failure.narrator?.forcedCaptions },
  firstWord: report.firstWord && { firstWordMs: report.firstWord.firstWordMs, cueStartMs: report.firstWord.cueStartMs, serverCount: report.firstWord.serverAggregate?.count },
}, null, 2));
if (!report.ok) process.exitCode = 1;
