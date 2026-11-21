/**
 * NARIMATO — accessibility surface registry (A11Y-01).
 *
 * One entry per migrated GDS surface the CI gate must prove. The registry is a
 * plain ES module so `scripts/a11y-gate.mjs` and the unit tests can import it
 * with no browser and no dependencies.
 *
 * `setup(page, ctx)` drives the real page to the surface; it must not assert
 * anything. The gate's checkers own assertions and report findings. `dialog`
 * names the governed container the focus-trap check uses; `invoker` is the
 * element focus must return to after Escape.
 */

const join = async (page, tag) => {
  await page.fill('#tag-input', tag);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 20_000 });
  await page.waitForTimeout(700);
  const brief = await page.$('#btn-landing-brief-start');
  if (brief && (await brief.isVisible())) {
    await brief.click();
    await page.waitForTimeout(250);
  }
};

const setupLanding = async () => {};

const setupHud = async (page, ctx) => {
  await join(page, ctx.tag());
};

const setupGuide = async (page, ctx) => {
  await join(page, ctx.tag());
  await page.click('#btn-help');
  await page.waitForSelector('.mantine-Modal-content', { state: 'visible', timeout: 10_000 });
};

const setupManual = async (page, ctx) => {
  await setupGuide(page, ctx);
  await page.click('#btn-guide-manual');
  await page.waitForSelector('#manual-sections', { state: 'visible', timeout: 10_000 });
};

const setupReport = async (page, ctx) => {
  await join(page, ctx.tag());
  await page.click('#gds-btn-report');
  await page.waitForSelector('#report-card-preview', { state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(600);
};

const setupConfirm = async (page, ctx) => {
  await join(page, ctx.tag());
  await page.click('#btn-abandon');
  await page.waitForSelector('#confirm-overlay', { state: 'visible', timeout: 10_000 });
};

const setupSurface = async (page, ctx) => {
  await join(page, ctx.tag());
  await page.evaluate(() => window.__ICOSA__.surface());
  await page.waitForSelector('#surface-controls', { state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(900);
};

const setupCine = async (page) => {
  await page.waitForTimeout(0);
  await page.waitForSelector('#btn-skip-intro', { state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(400);
};

const setupIncident = async (page, ctx) => {
  await join(page, ctx.tag());
  await page.evaluate(() =>
    window.__ICOSA__.incident(
      'solar',
      'SOLAR FLARE',
      'A SOLAR FLARE COOKED THE DAYLIGHT SIDE',
      'The magnetic storm peeled back rock and scattered rare elements.',
    ),
  );
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector('[role="dialog"]');
      const title = document.getElementById('meteor-title');
      return !!dialog && !!title && title.textContent === 'SOLAR FLARE';
    },
    null,
    { timeout: 10_000 },
  );
};

export const SURFACES = Object.freeze([
  {
    id: 'landing',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupLanding,
    dialog: '.mantine-Modal-content',
    invoker: null,
    expectedTabOrder: ['#tag-input', '#btn-join', '#btn-new-pilot'],
    primarySelectors: ['#tag-input', '#btn-join'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
  },
  {
    id: 'hud',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupHud,
    dialog: null,
    invoker: null,
    expectedTabOrder: ['#gds-btn-mission', '#gds-btn-operators', '#gds-btn-arcade', '#gds-btn-dock-abandon', '#gds-btn-report'],
    primarySelectors: ['#gds-btn-mission', '#gds-btn-report', '#btn-abandon'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
  },
  {
    id: 'guide',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupGuide,
    dialog: '.mantine-Modal-content',
    invoker: '#btn-help',
    expectedTabOrder: ['[aria-label="Close dialog"]', '#btn-guide-start', '#btn-guide-manual', '#btn-guide-share', '#btn-guide-close'],
    primarySelectors: ['#btn-guide-start', '#btn-guide-close'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
  },
  {
    id: 'manual',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupManual,
    dialog: '.mantine-Modal-content',
    invoker: '#btn-help',
    expectedTabOrder: [
      '[aria-label="Close dialog"]',
      '#manual-overlay [data-voice-profile="george"]',
      '#manual-overlay [data-voice-profile="daniel"]',
      '#manual-overlay [data-voice-profile="samantha"]',
      '#manual-sections .manual-play',
    ],
    primarySelectors: ['#btn-manual-close', '#manual-sections .manual-play'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
  },
  {
    id: 'report',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupReport,
    dialog: '.mantine-Modal-content',
    invoker: '#gds-btn-report',
    expectedTabOrder: ['[aria-label="Close dialog"]', '#report-share-url', '#btn-report-close', '#btn-report-download', '#btn-report-share'],
    primarySelectors: ['#btn-report-close', '#btn-report-download'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
  },
  {
    id: 'confirm',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupConfirm,
    dialog: '.mantine-Modal-content',
    invoker: '#btn-abandon',
    expectedTabOrder: ['[aria-label="Close dialog"]', '#btn-confirm-cancel', '#btn-confirm-ok'],
    primarySelectors: ['#btn-confirm-cancel', '#btn-confirm-ok'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
  },
  {
    id: 'surface',
    route: '/?intro=0&gds=1',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    setup: setupSurface,
    dialog: null,
    invoker: null,
    expectedTabOrder: [
      '#btn-surface-exit',
      '[data-surface-hold="KeyW"]',
      '[data-surface-hold="KeyA"]',
      '[data-surface-hold="KeyS"]',
      '[data-surface-hold="KeyD"]',
    ],
    primarySelectors: ['#btn-surface-exit', '[data-surface-hold="KeyW"]'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
    // The surface probe deliberately contests a cell; a 409 is an expected
    // interaction outcome the UI handles, not a runtime failure.
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 409 \(Conflict\)/],
  },
  {
    id: 'cine',
    route: '/?gds=1',
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'no-preference',
    setup: setupCine,
    dialog: null,
    invoker: null,
    expectedTabOrder: ['#btn-skip-intro', '#btn-subtitles-cine', '#btn-voice-cine', '#btn-replay-intro-cine', '#steer-up'],
    primarySelectors: ['#btn-skip-intro', '#steer-up'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
    motion: 'cine',
  },
  {
    id: 'incident',
    route: '/?intro=0&gds=1',
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'no-preference',
    setup: setupIncident,
    dialog: '.mantine-Modal-content',
    invoker: '#arena-canvas',
    expectedTabOrder: ['[aria-label="Dismiss incident"]', '#meteor-dismiss'],
    primarySelectors: ['#meteor-dismiss'],
    ownershipRoot: '[data-gds-surface][data-gds-component]',
    motion: 'incident',
  },
]);

export function selectSurfaces(only = '') {
  const ids = String(only || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return [...SURFACES];
  const selected = SURFACES.filter((surface) => ids.includes(surface.id));
  const missing = ids.filter((id) => !SURFACES.some((surface) => surface.id === id));
  if (missing.length) throw new Error(`unknown surface id(s): ${missing.join(', ')}`);
  return selected;
}

export function surfaceById(id) {
  return SURFACES.find((surface) => surface.id === id) || null;
}
