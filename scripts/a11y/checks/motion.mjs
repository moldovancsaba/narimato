/**
 * A11Y-01 reduced-motion emulation.
 *
 * Playwright's `reducedMotion: 'reduce'` sets the OS media query before the page
 * boots, so the controllers see it on their first read. Two surfaces carry the
 * motion contract: the incident overlay must paint one static poster and never
 * shake, and the cine chrome must report reduced motion without losing copy or
 * dismissibility.
 */
import { setTimeout as delay } from 'node:timers/promises';
import { createFinding } from '../../lib/a11y-report.mjs';

const join = async (page, tag) => {
  await page.fill('#tag-input', tag);
  await page.click('#btn-join');
  await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 20_000 });
  await delay(700);
  const brief = await page.$('#btn-landing-brief-start');
  if (brief && (await brief.isVisible())) {
    await brief.click();
    await delay(250);
  }
};

async function incidentMotion(page, surface) {
  const findings = [];
  const tag = `A11YM${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await join(page, tag);
  await page.evaluate(() =>
    window.__ICOSA__.incident(
      'meteor',
      'METEOR IMPACT',
      'A METEOR SHATTERED THE OLD CRUST',
      'A rogue meteor punched through the surface and cracked open fresh ore veins.',
    ),
  );
  await page.waitForFunction(() => window.__ICOSA__?.incidentFxStats?.().poster === true, null, { timeout: 10_000 });
  await page
    .waitForFunction(
      () => {
        const visible = [...document.querySelectorAll('[role="dialog"]')].find((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[aria-hidden="true"]');
        });
        return !!visible && document.getElementById('meteor-title')?.textContent === 'METEOR IMPACT';
      },
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
  const state = await page.evaluate(() => ({
    stats: window.__ICOSA__.incidentFxStats(),
    shaking: document.body.classList.contains('is-shaking'),
    dialog: (() => {
      const node = [...document.querySelectorAll('[role="dialog"]')].find((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[aria-hidden="true"]');
      });
      const title = document.getElementById('meteor-title');
      return node && title ? { name: title.textContent, labelledby: node.getAttribute('aria-labelledby') } : null;
    })(),
    media: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  const checks = [
    ['motion-media', state.media === true, 'reduced-motion media query is active', String(state.media)],
    ['motion-poster', state.stats.poster === true, 'one static poster frame', String(state.stats.poster)],
    ['motion-not-blank', state.stats.blank === false, 'poster is painted', String(state.stats.blank)],
    ['motion-frame-budget', state.stats.frames === 1, 'loop stopped after one frame', String(state.stats.frames)],
    ['motion-dwell', state.stats.dwellMs === 1200, 'reduced-motion dwell 1200 ms', String(state.stats.dwellMs)],
    ['motion-no-shake', state.shaking === false, 'body.is-shaking never applied', String(state.shaking)],
    ['motion-dialog', !!state.dialog && state.dialog.name === 'METEOR IMPACT', 'incident dialog named by title', state.dialog ? state.dialog.name : 'missing'],
  ];
  for (const [id, ok, expected, actual] of checks) {
    if (!ok) {
      findings.push(
        createFinding({
          check: 'reduced-motion',
          id,
          surface: surface.id,
          selector: id === 'motion-dialog' ? '[role="dialog"]' : 'body',
          expected,
          actual,
          severity: 'serious',
          status: 'failure',
          message: `Reduced motion: ${expected}, got ${actual}.`,
        }),
      );
    }
  }
  await page.keyboard.press('Escape');
  const visibleDialog = `[...document.querySelectorAll('[role="dialog"]')].find((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[aria-hidden="true"]');
  })`;
  await page
    .waitForFunction(`!(${visibleDialog})`, null, { timeout: 5_000 })
    .catch(() => {});
  await delay(1_050);
  const closed = await page.evaluate(
    (source) => !new Function(`return (${source})`)() && document.activeElement?.id === 'arena-canvas',
    visibleDialog,
  );
  if (!closed) {
    findings.push(
      createFinding({
        check: 'reduced-motion',
        id: 'motion-escape',
        surface: surface.id,
        selector: '#arena-canvas',
        expected: 'Escape dismisses the poster and restores focus to the game canvas',
        actual: 'dialog stayed open or focus not on #arena-canvas',
        severity: 'serious',
        status: 'failure',
        message: 'Reduced-motion incident did not dismiss with Escape and restore focus.',
      }),
    );
  }
  return findings;
}

async function cineMotion(page, surface) {
  const findings = [];
  await page.waitForSelector('#btn-skip-intro', { state: 'visible', timeout: 20_000 });
  await delay(600);
  const state = await page.evaluate(() => ({
    media: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    debug: window.__NARIMATO_CINE_DEBUG__?.motion || null,
    region: (() => {
      const node = document.getElementById('gds-intro-cine');
      return node ? node.getAttribute('data-motion') : null;
    })(),
    longAnimations: [...document.querySelectorAll('#gds-intro-cine *')]
      .map((element) => {
        const style = getComputedStyle(element);
        return { name: style.animationName, duration: Number.parseFloat(style.animationDuration) || 0 };
      })
      .filter((entry) => entry.name !== 'none' && entry.duration > 0.1).length,
    copy: document.getElementById('intro-status')?.textContent || '',
    skip: !!document.getElementById('btn-skip-intro'),
  }));
  const checks = [
    ['motion-media', state.media === true, 'reduced-motion media query is active', String(state.media)],
    ['motion-cine-report', state.debug === 'reduced', 'cine reports reduced motion', String(state.debug)],
    ['motion-cine-region', state.region === 'reduced', 'intro region carries data-motion=reduced', String(state.region)],
    ['motion-cine-animations', state.longAnimations === 0, 'no long CSS animation on cine chrome', String(state.longAnimations)],
    ['motion-cine-copy', state.copy.length > 0, 'cine copy is present', String(state.copy.length)],
    ['motion-cine-skip', state.skip === true, 'skip control remains available', String(state.skip)],
  ];
  for (const [id, ok, expected, actual] of checks) {
    if (!ok) {
      findings.push(
        createFinding({
          check: 'reduced-motion',
          id,
          surface: surface.id,
          selector: '#gds-intro-cine',
          expected,
          actual,
          severity: 'serious',
          status: 'failure',
          message: `Reduced motion: ${expected}, got ${actual}.`,
        }),
      );
    }
  }
  return findings;
}

export async function runReducedMotion(browser, surface, { base, axeSource } = {}) {
  const context = await browser.newContext({
    viewport: surface.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  if (axeSource) await context.addInitScript({ content: axeSource });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('icosa.guideSeen', '1');
      localStorage.setItem('icosa.introSeen', '1');
    } catch {
      /* private mode */
    }
  });
  const page = await context.newPage();
  const findings = [];
  try {
    await page.goto(`${base}${surface.route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__NARIMATO_GDS__?.status?.().booted === true, null, { timeout: 20_000 });
    if (surface.id === 'incident') findings.push(...(await incidentMotion(page, surface)));
    if (surface.id === 'cine') findings.push(...(await cineMotion(page, surface)));
  } catch (error) {
    findings.push(
      createFinding({
        check: 'reduced-motion',
        id: 'motion-incomplete',
        surface: surface.id,
        selector: 'document',
        expected: 'reduced-motion check runs',
        actual: error.message,
        severity: 'serious',
        status: 'incomplete',
        message: `Reduced-motion check could not run: ${error.message}`,
      }),
    );
  } finally {
    await context.close();
  }
  return findings;
}
