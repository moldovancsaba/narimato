/**
 * PERF-01 unit tests: device budgets, frame percentile maths, quality ladder,
 * budget evaluation, ring behaviour and the first-load bundle measurement.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEVICE_BUDGETS,
  DEVICE_NAMES,
  MIN_FRAMES,
  clampTier,
  createFrameBudget,
  detectDeviceClass,
  evaluatePerf,
  parsePinnedTier,
  percentile,
  qualityTier,
  windowedFramePercentile,
} from '../public/js/perf-budget.js';
import { measureBundle } from '../lib/perf-bundle.js';
import { compareToBaseline, environmentSignature, selectBestAttempt } from '../scripts/perf-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('perf budget: three device classes with the documented numeric budgets', () => {
  assert.deepEqual(DEVICE_NAMES, ['desktop', 'mobile-mid', 'mobile-low']);
  assert.equal(DEVICE_BUDGETS.desktop.frameP95Ms, 16.7);
  assert.equal(DEVICE_BUDGETS.desktop.frameMaxMs, 40);
  assert.equal(DEVICE_BUDGETS.desktop.fpsFloor, 55);
  assert.equal(DEVICE_BUDGETS.desktop.maxLongTaskMs, 100);
  assert.equal(DEVICE_BUDGETS['mobile-mid'].frameP95Ms, 22);
  assert.equal(DEVICE_BUDGETS['mobile-mid'].frameMaxMs, 60);
  assert.equal(DEVICE_BUDGETS['mobile-mid'].fpsFloor, 45);
  assert.equal(DEVICE_BUDGETS['mobile-low'].frameP95Ms, 33.3);
  assert.equal(DEVICE_BUDGETS['mobile-low'].frameMaxMs, 80);
  assert.equal(DEVICE_BUDGETS['mobile-low'].fpsFloor, 30);
  for (const budget of Object.values(DEVICE_BUDGETS)) {
    assert.equal(budget.bundleKibGzip, 200);
    assert.equal(budget.islandKibGzip, 60);
    assert.equal(budget.interactionMs, 100);
    assert.equal(budget.longTasksPer10s, 2);
    assert.equal(budget.inpMs, 200);
    assert.equal(budget.cls, 0.1);
    assert.equal(budget.lcpMs, 2500);
    assert.ok(Number.isFinite(budget.drawUnitsPerFrame));
    assert.ok(Number.isFinite(budget.rebuildsPerSecond));
  }
});

test('perf budget: percentile and windowed frame percentile do not let one stall dominate p95', () => {
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(percentile([5, 1, 4, 2, 3], 95), 5);
  const samples = [];
  for (let i = 0; i < 100; i += 1) samples.push({ ms: 10, at: i * 10 });
  samples.push({ ms: 200, at: 1000 });
  const result = windowedFramePercentile(samples);
  assert.equal(result.windows.length, 1);
  assert.equal(result.p95, 10, 'a single 200 ms stall stays in frameMax, not p95');
  const twoWindows = [
    ...Array.from({ length: 100 }, (_, i) => ({ ms: 10, at: i * 10 })),
    ...Array.from({ length: 100 }, (_, i) => ({ ms: 20, at: 2100 + i * 10 })),
  ];
  assert.equal(windowedFramePercentile(twoWindows).p95, 20);
});

test('perf budget: quality ladder drops above 1.35x and climbs below 0.7x', () => {
  const budget = DEVICE_BUDGETS.desktop;
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 1.34, budget, tier: 2 }), 2);
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 1.35, budget, tier: 2 }), 2);
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 1.36, budget, tier: 2 }), 1);
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 1.36, budget, tier: 0 }), 0);
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 0.71, budget, tier: 1 }), 1);
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 0.69, budget, tier: 1 }), 2);
  assert.equal(qualityTier({ frameP95Ms: budget.frameP95Ms * 0.69, budget, tier: 2 }), 2);
  assert.equal(clampTier(-3), 0);
  assert.equal(clampTier(9), 2);
});

test('perf budget: tier changes hold for 2 s in the recorder', () => {
  let clock = 0;
  const recorder = createFrameBudget({ device: 'desktop', now: () => clock });
  for (let i = 0; i < 80; i += 1) recorder.recordFrame(30, { at: clock += 16 });
  assert.equal(recorder.maybeAdjustTier(clock), 1, '80 slow frames drop one tier');
  const held = recorder.maybeAdjustTier(clock + 100);
  assert.equal(held, 1, 'no second change inside the hold window');
  for (let i = 0; i < 80; i += 1) recorder.recordFrame(30, { at: clock += 16 });
  assert.equal(recorder.maybeAdjustTier(clock + 2100), 0);
});

test('perf budget: pinned quality never adapts', () => {
  let clock = 0;
  const recorder = createFrameBudget({ device: 'mobile-low', pinnedTier: 0, now: () => clock });
  for (let i = 0; i < 100; i += 1) recorder.recordFrame(50, { at: clock += 16 });
  assert.equal(recorder.maybeAdjustTier(clock + 5000), 0);
  assert.equal(recorder.pinnedTier, 0);
  assert.equal(parsePinnedTier('?quality=2'), 2);
  assert.equal(parsePinnedTier('?quality=0&x=1'), 0);
  assert.equal(parsePinnedTier('?quality=3'), null);
  assert.equal(parsePinnedTier(''), null);
});

test('perf budget: evaluation fails the documented metrics and floors fps', () => {
  const budget = DEVICE_BUDGETS.desktop;
  const pass = evaluatePerf({
    observed: { frameP95Ms: 16, frameMaxMs: 30, fps: 60, longTasksPer10s: 0, maxLongTaskMs: 40, interactionMs: 20, inpMs: 50, bundleKibGzip: 160, drawUnitsPerFrame: 400, rebuildsPerSecond: 1 },
    budget,
  });
  assert.equal(pass.verdict, 'pass');
  assert.deepEqual(pass.failures, []);
  const fail = evaluatePerf({
    observed: { frameP95Ms: 24, frameMaxMs: 70, fps: 40, longTasksPer10s: 5, maxLongTaskMs: 200, interactionMs: 150, bundleKibGzip: 260, drawUnitsPerFrame: 2000, rebuildsPerSecond: 10 },
    budget,
  });
  assert.equal(fail.verdict, 'fail');
  for (const key of ['frameP95Ms', 'frameMaxMs', 'fps', 'longTasksPer10s', 'maxLongTaskMs', 'interactionMs', 'bundleKibGzip', 'drawUnitsPerFrame', 'rebuildsPerSecond']) {
    assert.ok(fail.failures.includes(key), key);
  }
  const insufficient = evaluatePerf({ observed: { frameP95Ms: 10 }, budget, samples: MIN_FRAMES - 1 });
  assert.equal(insufficient.verdict, 'insufficient-samples');
});

test('perf budget: recorder excludes hidden and rebuild frames and caps the ring', () => {
  const recorder = createFrameBudget({ device: 'desktop', now: () => 0 });
  assert.equal(recorder.recordFrame(16, { at: 1 }), true);
  assert.equal(recorder.recordFrame(16, { at: 2, hidden: true }), false);
  assert.equal(recorder.recordFrame(16, { at: 3, rebuild: true }), false);
  for (let i = 0; i < 600; i += 1) recorder.recordFrame(16.7, { at: 100 + i * 16 });
  assert.equal(recorder.samples, 512);
  assert.equal(recorder.snapshot().hiddenFrames, 1);
  assert.equal(recorder.snapshot().excludedFrames, 1);
  const telemetry = recorder.telemetry();
  assert.ok(telemetry.frameP95Ms > 0 && telemetry.frameMaxMs >= telemetry.frameP95Ms);
  recorder.reset('resize');
  assert.equal(recorder.samples, 0);
  assert.equal(recorder.snapshot().lastResetReason, 'resize');
});

test('perf budget: device class detection and interaction ring', () => {
  assert.equal(detectDeviceClass({ width: 1440, dpr: 2 }), 'desktop');
  assert.equal(detectDeviceClass({ width: 390, dpr: 3, deviceMemory: 4, hardwareConcurrency: 8 }), 'mobile-mid');
  assert.equal(detectDeviceClass({ width: 360, dpr: 2 }), 'mobile-low');
  assert.equal(detectDeviceClass({ width: 390, dpr: 3, deviceMemory: 2 }), 'mobile-low');
  const recorder = createFrameBudget({ device: 'desktop' });
  recorder.recordInteraction(42);
  recorder.recordInteraction(84);
  recorder.recordInteraction(120);
  assert.equal(recorder.snapshot().interactionSamples, 3);
  assert.ok(recorder.snapshot().interactionP95Ms >= 84);
});

test('perf bundle: the committed JavaScript graph is inside the 200 KiB gzip budget', () => {
  const bundle = measureBundle({ root: ROOT });
  assert.ok(bundle.jsKibGzip > 0);
  assert.ok(bundle.cssKibGzip > 0);
  assert.ok(bundle.firstLoadKibGzip >= bundle.jsKibGzip);
  assert.ok(bundle.modules.includes('public/js/perf-budget.js'));
  assert.ok(bundle.bundleKibGzip <= DEVICE_BUDGETS.desktop.bundleKibGzip * 1.02, `bundle ${bundle.bundleKibGzip} KiB exceeded budget`);
  assert.deepEqual(bundle.overBudget, []);
});

test('perf baseline: >15% p95 regression fails and environment mismatch is skipped', () => {
  const environment = {
    browser: 'chromium 159.0.0',
    platform: 'darwin',
    arch: 'arm64',
    gpuClass: 'hardware',
    cpuThrottle: 1,
    network: 'fast-3g',
    viewport: { width: 1440, height: 900 },
    dpr: 2,
  };
  const baseline = { version: 1, devices: { desktop: { environment, observed: { frameP95Ms: 20 } } } };
  const stable = compareToBaseline({ device: 'desktop', observed: { frameP95Ms: 22 }, environment }, baseline);
  assert.equal(stable.comparable, true);
  assert.deepEqual(stable.failures, []);
  const regressed = compareToBaseline({ device: 'desktop', observed: { frameP95Ms: 23.1 }, environment }, baseline);
  assert.equal(regressed.comparable, true);
  assert.equal(regressed.failures[0].metric, 'frameP95Ms');
  const mismatched = compareToBaseline(
    { device: 'desktop', observed: { frameP95Ms: 99 }, environment: { ...environment, gpuClass: 'software' } },
    baseline,
  );
  assert.equal(mismatched.comparable, false);
  assert.equal(mismatched.reason, 'environment-mismatch');
  assert.equal(environmentSignature(environment), environmentSignature({ ...environment, userAgent: 'ignored' }));
});

test('perf probe: best attempt prefers a clean run, then lower p95 and max', () => {
  const passes = { verdict: 'pass', observed: { frameP95Ms: 16.7, frameMaxMs: 40 } };
  const slow = { verdict: 'fail', observed: { frameP95Ms: 16.8, frameMaxMs: 16.8 } };
  const fastest = { verdict: 'pass', observed: { frameP95Ms: 16.7, frameMaxMs: 16.8 } };
  assert.equal(selectBestAttempt([slow, passes]), passes);
  assert.equal(selectBestAttempt([passes, fastest]), fastest);
  assert.equal(selectBestAttempt([slow]), slow);
});
