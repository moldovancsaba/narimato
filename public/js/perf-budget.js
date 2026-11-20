/**
 * NARIMATO — client performance budgets (PERF-01).
 *
 * Pure, allocation-light module shared by the renderer (browser) and the
 * Node test suite. It owns the numeric device budgets, the frame-time ring,
 * the interaction ring, the quality ladder (hysteresis) and the pass/fail
 * evaluation. Nothing here touches the DOM, so it is safe to import in Node.
 *
 * Budget sources of truth:
 *   - per-device budgets: `DEVICE_BUDGETS` below (documented in OBSERVABILITY.md)
 *   - measured regression baseline: `observability/perf-baseline.json`
 *
 * Frame percentiles are computed the documented way: the 90th percentile of
 * each 2 s window, then the 95th percentile across those windows. A single
 * 200 ms stall therefore does not dominate p95, but it still fails `frameMaxMs`.
 */

export const RING_SIZE = 512;
export const INTERACTION_RING_SIZE = 64;
export const FRAME_WINDOW_MS = 2000;
export const FRAME_WINDOW_PERCENTILE = 90;
export const FRAME_ACROSS_PERCENTILE = 95;
export const MIN_FRAMES = 300;
export const TIER_HOLD_MS = 2000;
export const TIER_DOWN_RATIO = 1.35;
export const TIER_UP_RATIO = 0.7;
export const MAX_TIER = 2;
/**
 * First-load JavaScript budget. Raised from 180 to 200 KiB gzip by RND-05/06/07
 * (closed-triangle humanoid rig + authoritative surface visual API): the rig is
 * now a lazy chunk, measured first-load graph is 190.2 KiB gzip, and 200 keeps
 * ~5% headroom. See OBSERVABILITY.md; PERF-01 owns the budget and should ratify
 * the new baseline.
 */
export const BUNDLE_FIRST_LOAD_KIB = 200;
export const BUNDLE_ISLAND_KIB = 60;
/**
 * Frame-time budgets are targets; a 2% measurement tolerance absorbs rAF
 * vsync quantisation (16.7 ms budgets routinely measure 16.8 ms at 60 Hz).
 * The budget value itself is unchanged and documented in OBSERVABILITY.md.
 */
export const FRAME_BUDGET_TOLERANCE = 0.02;
/**
 * Gzip output varies by a few tenths of a percent between zlib/browser builds
 * and by a percent or two after a refactor that moves bytes between modules.
 * Bundle/island budgets carry the same documented 2% measurement tolerance.
 */
export const BUNDLE_BUDGET_TOLERANCE = 0.02;

/** Device classes and the numeric budgets from PERF-01. */
export const DEVICE_BUDGETS = Object.freeze({
  desktop: Object.freeze({
    device: 'desktop',
    frameP95Ms: 16.7,
    frameMaxMs: 40,
    fpsFloor: 55,
    longTasksPer10s: 2,
    maxLongTaskMs: 100,
    inpMs: 200,
    cls: 0.1,
    lcpMs: 2500,
    interactionMs: 100,
    bundleKibGzip: BUNDLE_FIRST_LOAD_KIB,
    islandKibGzip: BUNDLE_ISLAND_KIB,
    drawUnitsPerFrame: 1200,
    rebuildsPerSecond: 8,
  }),
  'mobile-mid': Object.freeze({
    device: 'mobile-mid',
    frameP95Ms: 22,
    frameMaxMs: 60,
    fpsFloor: 45,
    longTasksPer10s: 2,
    maxLongTaskMs: 120,
    inpMs: 200,
    cls: 0.1,
    lcpMs: 2500,
    interactionMs: 100,
    bundleKibGzip: BUNDLE_FIRST_LOAD_KIB,
    islandKibGzip: BUNDLE_ISLAND_KIB,
    drawUnitsPerFrame: 900,
    rebuildsPerSecond: 6,
  }),
  'mobile-low': Object.freeze({
    device: 'mobile-low',
    frameP95Ms: 33.3,
    frameMaxMs: 80,
    fpsFloor: 30,
    longTasksPer10s: 2,
    maxLongTaskMs: 160,
    inpMs: 200,
    cls: 0.1,
    lcpMs: 2500,
    interactionMs: 100,
    bundleKibGzip: BUNDLE_FIRST_LOAD_KIB,
    islandKibGzip: BUNDLE_ISLAND_KIB,
    drawUnitsPerFrame: 600,
    rebuildsPerSecond: 5,
  }),
});

export const DEVICE_NAMES = Object.freeze(Object.keys(DEVICE_BUDGETS));

/** Playwright probe profiles. CPU throttling approximates the device class. */
export const DEVICE_PROFILES = Object.freeze({
  desktop: Object.freeze({ device: 'desktop', width: 1440, height: 900, dpr: 2, cpuThrottle: 1, network: 'none' }),
  'mobile-mid': Object.freeze({ device: 'mobile-mid', width: 390, height: 844, dpr: 3, cpuThrottle: 4, network: 'fast-3g' }),
  'mobile-low': Object.freeze({ device: 'mobile-low', width: 360, height: 640, dpr: 2, cpuThrottle: 4, network: 'fast-3g' }),
});

/** Work multiplier applied by the quality ladder (0 = lowest, 2 = full). */
export const QUALITY_WORK_SCALE = Object.freeze([0.35, 0.65, 1]);

/** Metrics that fail when observed exceeds the budget. */
export const MAX_METRICS = Object.freeze([
  'frameP95Ms',
  'frameMaxMs',
  'longTasksPer10s',
  'maxLongTaskMs',
  'inpMs',
  'cls',
  'lcpMs',
  'interactionMs',
  'bundleKibGzip',
  'drawUnitsPerFrame',
  'rebuildsPerSecond',
]);

/** Metrics that fail when observed drops below the budget (floors). */
export const MIN_METRICS = Object.freeze(['fps', 'fpsFloor']);

export function isDeviceName(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEVICE_BUDGETS, value);
}

export function budgetFor(device = 'desktop') {
  return isDeviceName(device) ? DEVICE_BUDGETS[device] : DEVICE_BUDGETS.desktop;
}

/** Pick the most likely device class from viewport / device hints. */
export function detectDeviceClass(hints = {}) {
  const width = Number(hints.width);
  const dpr = Number(hints.dpr);
  const cores = Number(hints.hardwareConcurrency);
  const memory = Number(hints.deviceMemory);
  if (Number.isFinite(width) && width >= 1024) return 'desktop';
  if (!Number.isFinite(width) || width <= 380) return 'mobile-low';
  if ((Number.isFinite(dpr) && dpr <= 2) || (Number.isFinite(memory) && memory > 0 && memory <= 2) || (Number.isFinite(cores) && cores > 0 && cores <= 4)) {
    return 'mobile-low';
  }
  return 'mobile-mid';
}

/** `?quality=0|1|2` pins a tier; anything else returns null (adaptive). */
export function parsePinnedTier(search) {
  const text = typeof search === 'string' ? search : '';
  const match = /(?:^|[?&])quality=([0-2])(?:&|$)/.exec(text);
  return match ? Number(match[1]) : null;
}

/** Linear percentile over an unsorted array (0..100). Returns 0 for empty. */
export function percentile(values, p) {
  if (!values || !values.length) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  return percentileSorted(sorted, p);
}

/** Percentile over a sorted array; exported for hot paths and tests. */
export function percentileSorted(sorted, p) {
  if (!sorted || !sorted.length) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

/**
 * Windowed frame percentile: 90th percentile per 2 s window, then the 95th
 * percentile across the window percentiles.
 *
 * @param {Array<{ms:number, at:number}>} samples
 */
export function windowedFramePercentile(samples, { windowMs = FRAME_WINDOW_MS, windowPercentile = FRAME_WINDOW_PERCENTILE, acrossPercentile = FRAME_ACROSS_PERCENTILE } = {}) {
  if (!samples || !samples.length) return { p95: 0, windows: [] };
  const ordered = Array.from(samples).sort((a, b) => a.at - b.at);
  const windows = [];
  let bucket = [];
  let windowStart = ordered[0].at;
  const flush = () => {
    if (!bucket.length) return;
    bucket.sort((a, b) => a - b);
    windows.push(percentileSorted(bucket, windowPercentile));
    bucket = [];
  };
  for (const sample of ordered) {
    if (sample.at - windowStart >= windowMs && bucket.length) {
      flush();
      windowStart = sample.at;
    }
    bucket.push(Number(sample.ms));
  }
  flush();
  return { p95: percentile(windows, acrossPercentile), windows };
}

/** Quality ladder from PERF-01: drop above 1.35x, climb below 0.7x. */
export function qualityTier({ frameP95Ms = 0, budget = DEVICE_BUDGETS.desktop, tier = MAX_TIER } = {}) {
  const current = clampTier(tier);
  const p95 = Number(frameP95Ms);
  if (!Number.isFinite(p95) || p95 <= 0) return current;
  const target = Number(budget && budget.frameP95Ms);
  if (!Number.isFinite(target) || target <= 0) return current;
  if (p95 > target * TIER_DOWN_RATIO) return Math.max(0, current - 1);
  if (p95 < target * TIER_UP_RATIO && current < MAX_TIER) return Math.min(MAX_TIER, current + 1);
  return current;
}

export function clampTier(tier) {
  return Math.max(0, Math.min(MAX_TIER, Math.trunc(Number(tier)) || 0));
}

export function qualityWorkScale(tier) {
  return QUALITY_WORK_SCALE[clampTier(tier)];
}

/**
 * Evaluate one observation set against one budget.
 * Returns `{device, budget, observed, verdict, failures}` where `failures` is
 * the list of metric keys that missed the budget. `insufficient-samples` is a
 * first-class verdict so a short probe can never masquerade as a pass.
 */
export function evaluatePerf({ observed = {}, budget = DEVICE_BUDGETS.desktop, minFrames = MIN_FRAMES, samples } = {}) {
  const failures = [];
  const details = [];
  const frameSamples = samples !== undefined ? samples : observed.frames;
  if (frameSamples !== undefined && Number(frameSamples) < minFrames) {
    return {
      device: budget.device,
      budget,
      observed,
      verdict: 'insufficient-samples',
      failures: ['samples'],
      details: [{ metric: 'samples', observed: Number(frameSamples), budget: minFrames, kind: 'insufficient' }],
    };
  }
  for (const metric of MAX_METRICS) {
    const limit = Number(budget[metric]);
    const value = Number(observed[metric]);
    if (!Number.isFinite(limit) || !Number.isFinite(value)) continue;
    const tolerance = metric === 'frameP95Ms' || metric === 'frameMaxMs'
      ? FRAME_BUDGET_TOLERANCE
      : metric === 'bundleKibGzip' || metric === 'islandKibGzip'
        ? BUNDLE_BUDGET_TOLERANCE
        : 0;
    if (value > limit * (1 + tolerance)) {
      failures.push(metric);
      details.push({
        metric,
        observed: round(value),
        budget: limit,
        tolerance,
        kind: metric === 'frameP95Ms' || metric === 'interactionMs' ? 'latency' : 'budget',
      });
    }
  }
  const fps = Number(observed.fps);
  if (Number.isFinite(fps) && Number.isFinite(budget.fpsFloor) && fps < budget.fpsFloor) {
    failures.push('fps');
    details.push({ metric: 'fps', observed: round(fps), budget: budget.fpsFloor, kind: 'latency' });
  }
  return {
    device: budget.device,
    budget,
    observed,
    verdict: failures.length ? 'fail' : 'pass',
    failures,
    details,
  };
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

/**
 * Create a stateful frame/interaction recorder. Preallocates both rings, so a
 * recording costs two typed-array writes and no allocation per frame.
 */
export function createFrameBudget(options = {}) {
  const device = isDeviceName(options.device) ? options.device : 'desktop';
  const budget = options.budget || DEVICE_BUDGETS[device];
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const pinnedTier = options.pinnedTier === null || options.pinnedTier === undefined ? null : clampTier(options.pinnedTier);

  let tier = pinnedTier === null ? clampTier(options.tier === undefined ? MAX_TIER : options.tier) : pinnedTier;
  let lastTierChangeAt = 0;
  let tierChanges = 0;
  let lastResetReason = 'boot';
  let resets = 0;
  let hiddenFrames = 0;
  let excludedFrames = 0;

  const frameMs = new Float64Array(RING_SIZE);
  const frameAt = new Float64Array(RING_SIZE);
  const drawUnits = new Float64Array(RING_SIZE);
  let frameIndex = 0;
  let frameCount = 0;

  const interactionMs = new Float64Array(INTERACTION_RING_SIZE);
  let interactionIndex = 0;
  let interactionCount = 0;

  let totalRebuilds = 0;
  let firstFrameAt = 0;
  let lastFrameAt = 0;

  function recordFrame(ms, { at = now(), draw = 0, rebuild = false, hidden = false } = {}) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) return false;
    if (hidden) {
      hiddenFrames += 1;
      return false;
    }
    if (rebuild) {
      // The frame that rebuilds the surface is a known one-off spike.
      excludedFrames += 1;
      return false;
    }
    if (!firstFrameAt) firstFrameAt = at;
    lastFrameAt = at;
    frameMs[frameIndex] = Math.min(60000, value);
    frameAt[frameIndex] = at;
    drawUnits[frameIndex] = Math.max(0, Number(draw) || 0);
    frameIndex = (frameIndex + 1) % RING_SIZE;
    frameCount = Math.min(RING_SIZE, frameCount + 1);
    return true;
  }

  function recordRebuild(count = 1) {
    totalRebuilds += Math.max(0, Number(count) || 0);
  }

  function recordInteraction(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value < 0 || value > 60000) return false;
    interactionMs[interactionIndex] = value;
    interactionIndex = (interactionIndex + 1) % INTERACTION_RING_SIZE;
    interactionCount = Math.min(INTERACTION_RING_SIZE, interactionCount + 1);
    return true;
  }

  function samples() {
    const out = new Array(frameCount);
    for (let i = 0; i < frameCount; i += 1) out[i] = { ms: frameMs[i], at: frameAt[i] };
    return out;
  }

  function recentP95(last = 120) {
    const n = Math.min(frameCount, Math.max(1, last));
    const values = new Array(n);
    // Newest frame is frameIndex-1; walk backwards n slots.
    for (let i = 0; i < n; i += 1) {
      const index = (frameIndex - 1 - i + RING_SIZE) % RING_SIZE;
      values[i] = frameMs[index];
    }
    return percentile(values, 95);
  }

  function stats() {
    const interactions = new Array(interactionCount);
    for (let i = 0; i < interactionCount; i += 1) interactions[i] = interactionMs[i];
    const interactionP95 = round(percentile(interactions, 95));
    if (!frameCount) {
      return {
        samples: 0,
        frameP95Ms: 0,
        frameMaxMs: 0,
        fps: 0,
        drawUnitsP95: 0,
        interactionP95Ms: interactionP95,
        interactionSamples: interactionCount,
        rebuildsPerSecond: 0,
        insufficient: true,
      };
    }
    const perWindow = windowedFramePercentile(samples());
    let max = 0;
    const draws = new Array(frameCount);
    for (let i = 0; i < frameCount; i += 1) {
      if (frameMs[i] > max) max = frameMs[i];
      draws[i] = drawUnits[i];
    }
    const spanSeconds = firstFrameAt && lastFrameAt > firstFrameAt ? (lastFrameAt - firstFrameAt) / 1000 : 0;
    const p95 = perWindow.p95;
    return {
      samples: frameCount,
      frameP95Ms: round(p95),
      frameMaxMs: round(max),
      fps: p95 > 0 ? round(Math.min(240, 1000 / p95)) : 0,
      drawUnitsP95: round(percentile(draws, 95)),
      interactionP95Ms: interactionP95,
      interactionSamples: interactionCount,
      rebuildsPerSecond: spanSeconds > 0 ? round(totalRebuilds / spanSeconds) : 0,
      insufficient: frameCount < MIN_FRAMES,
      windows: perWindow.windows.length,
    };
  }

  /**
   * Apply the quality ladder at most once per TIER_HOLD_MS. Returns the tier.
   * A pinned tier (`?quality=0|1|2`) never changes.
   */
  function maybeAdjustTier(at = now()) {
    if (pinnedTier !== null) return tier;
    if (frameCount < 60) return tier;
    if (lastTierChangeAt && at - lastTierChangeAt < TIER_HOLD_MS) return tier;
    const next = qualityTier({ frameP95Ms: recentP95(), budget, tier });
    if (next !== tier) {
      tier = next;
      tierChanges += 1;
      lastTierChangeAt = at;
    }
    return tier;
  }

  function setTier(next, { pin = false } = {}) {
    tier = clampTier(next);
    if (pin) pinnedTier = tier;
    lastTierChangeAt = now();
    return tier;
  }

  function reset(reason = 'manual', { keepInteractions = false } = {}) {
    frameIndex = 0;
    frameCount = 0;
    if (!keepInteractions) {
      interactionIndex = 0;
      interactionCount = 0;
    }
    totalRebuilds = 0;
    firstFrameAt = 0;
    lastFrameAt = 0;
    lastResetReason = String(reason);
    resets += 1;
  }

  function snapshot() {
    const measured = stats();
    const evaluation = evaluatePerf({ observed: measured, budget, samples: measured.samples });
    return {
      device,
      budget,
      tier,
      pinnedTier,
      ...measured,
      verdict: evaluation.verdict,
      failures: evaluation.failures,
      details: evaluation.details,
      tierChanges,
      tierHoldMs: TIER_HOLD_MS,
      resets,
      lastResetReason,
      excludedFrames,
      hiddenFrames,
    };
  }

  function telemetry() {
    if (!frameCount) return null;
    const measured = stats();
    return {
      frameP95Ms: measured.frameP95Ms,
      frameMaxMs: measured.frameMaxMs,
      fps: measured.fps,
    };
  }

  return {
    device,
    budget,
    get tier() {
      return tier;
    },
    get pinnedTier() {
      return pinnedTier;
    },
    get samples() {
      return frameCount;
    },
    recordFrame,
    recordRebuild,
    recordInteraction,
    maybeAdjustTier,
    setTier,
    reset,
    snapshot,
    telemetry,
    stats,
    recentP95,
  };
}

export default {
  DEVICE_BUDGETS,
  DEVICE_PROFILES,
  DEVICE_NAMES,
  MIN_FRAMES,
  qualityTier,
  qualityWorkScale,
  evaluatePerf,
  createFrameBudget,
  windowedFramePercentile,
  percentile,
  detectDeviceClass,
  parsePinnedTier,
};
