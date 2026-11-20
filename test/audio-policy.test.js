import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIRST_WORD_MAX_MS,
  FAILURES_FOR_CAPTIONS,
  RETRY_LIMIT,
  WATCHDOG_MAX_MS,
  WATCHDOG_MIN_MS,
  audioPolicy,
  classifyPlaybackError,
  firstWordMs,
  isSlowNetwork,
  shouldDegradeToCaptions,
} from '../public/js/shared/audio-policy.js';

/* --------------------------------------------------------------- watchdog */

test('audio policy: watchdog is bounded to 1500..6000 ms and 1.6x known durations', () => {
  for (const estimateMs of [0, 1, 100, 400, 900, 2100, 5000, 60_000]) {
    const policy = audioPolicy({ estimateMs, knownDuration: true });
    assert.ok(policy.watchdogMs >= WATCHDOG_MIN_MS, `low bound for ${estimateMs}`);
    assert.ok(policy.watchdogMs <= WATCHDOG_MAX_MS, `high bound for ${estimateMs}`);
    assert.ok(policy.watchdogMs >= Math.min(WATCHDOG_MAX_MS, Math.ceil(estimateMs * 1.6)), 'never cuts a healthy known clip');
  }
  // Unknown duration gets more headroom (cold metadata round-trip).
  assert.equal(audioPolicy({ estimateMs: 1000, knownDuration: false }).watchdogMs, 2200);
  assert.equal(audioPolicy({ estimateMs: 1000, knownDuration: true }).watchdogMs, 1600);
  // Missing/garbage estimate falls back to the 2100 ms estimate.
  assert.equal(audioPolicy({}).watchdogMs, 4620);
  assert.equal(audioPolicy({ estimateMs: Number.NaN }).watchdogMs, 4620);
});

/* ------------------------------------------------------------ concurrency */

test('audio policy: prefetch concurrency is 3 by default, 2 on slow 2G, 1 on saveData', () => {
  assert.equal(audioPolicy({}).concurrency, 3);
  assert.equal(audioPolicy({ effectiveType: '4g' }).concurrency, 3);
  assert.equal(audioPolicy({ effectiveType: '3g' }).concurrency, 3);
  assert.equal(audioPolicy({ effectiveType: '2g' }).concurrency, 2);
  assert.equal(audioPolicy({ effectiveType: 'slow-2g' }).concurrency, 2);
  assert.equal(audioPolicy({ saveData: true }).concurrency, 1, 'saveData wins over fast type');
  assert.equal(audioPolicy({ saveData: true, effectiveType: '4g' }).concurrency, 1);
  assert.equal(isSlowNetwork({ effectiveType: 'SLOW-2G' }), true);
  assert.equal(isSlowNetwork({}), false);
});

/* -------------------------------------------------------------- escalation */

test('audio policy: two failures force subtitles and a metadata retry once', () => {
  assert.equal(audioPolicy({ failures: 0 }).forceSubtitles, false);
  assert.equal(audioPolicy({ failures: 0 }).retry, 'none');
  assert.equal(audioPolicy({ failures: 1 }).forceSubtitles, false);
  assert.equal(audioPolicy({ failures: 1 }).retry, 'metadata-only');
  assert.equal(audioPolicy({ failures: FAILURES_FOR_CAPTIONS }).forceSubtitles, true);
  assert.equal(audioPolicy({ failures: 99 }).forceSubtitles, true);
  assert.equal(audioPolicy({ failures: -4 }).forceSubtitles, false, 'negative failures sanitize');
  assert.equal(FAILURES_FOR_CAPTIONS, 2);
});

/* ----------------------------------------------------------- classification */

test('audio policy: play() rejections classify into four stable reasons', () => {
  assert.equal(classifyPlaybackError({ name: 'NotAllowedError' }), 'gesture');
  assert.equal(classifyPlaybackError({ name: 'SecurityError' }), 'gesture');
  assert.equal(classifyPlaybackError({ name: 'NotSupportedError' }), 'format');
  assert.equal(classifyPlaybackError({ name: 'AbortError' }), 'superseded');
  assert.equal(classifyPlaybackError({ name: 'EncodingError' }), 'unknown');
  assert.equal(classifyPlaybackError(new Error('boom')), 'unknown');
  assert.equal(classifyPlaybackError(null), 'unknown');
});

/* ------------------------------------------------------------- first word */

test('audio policy: first word is cue-relative and clamped', () => {
  assert.equal(firstWordMs(1000, 1280), 280);
  assert.equal(firstWordMs(1000, 900), 0, 'never negative');
  assert.equal(firstWordMs(0, 10 ** 9), FIRST_WORD_MAX_MS, 'clamped to 120 s');
  assert.equal(firstWordMs(Number.NaN, 10), 0);
  assert.equal(firstWordMs(10, Number.NaN), 0);
});

/* -------------------------------------------------------------- degrading */

test('audio policy: interruption degrades after three attempts or two failures', () => {
  assert.equal(RETRY_LIMIT, 3);
  assert.equal(shouldDegradeToCaptions(0, 0), false);
  assert.equal(shouldDegradeToCaptions(2, 0), false);
  assert.equal(shouldDegradeToCaptions(3, 0), true);
  assert.equal(shouldDegradeToCaptions(0, 2), true);
  assert.equal(shouldDegradeToCaptions(Number.NaN, Number.NaN), false);
});

test('audio policy: returns the documented shape for every input', () => {
  for (const input of [{}, { estimateMs: 1000 }, { knownDuration: true, saveData: true }, null]) {
    const policy = audioPolicy(input);
    assert.deepEqual(Object.keys(policy).sort(), ['concurrency', 'forceSubtitles', 'retry', 'watchdogMs']);
    assert.equal(typeof policy.watchdogMs, 'number');
    assert.ok([1, 2, 3].includes(policy.concurrency));
    assert.equal(typeof policy.forceSubtitles, 'boolean');
    assert.ok(['none', 'metadata-only'].includes(policy.retry));
  }
});
