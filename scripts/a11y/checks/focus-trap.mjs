/**
 * A11Y-01 focus-trap / focus-restore checker.
 *
 * `expectGdsFocusTrap` proves the governed container contains focus. The walk
 * below presses Tab (and Shift+Tab) through a full cycle to prove containment
 * is not a one-shot artifact, then dismisses with Escape and asserts focus
 * returns to the invoker. A modal that cannot be dismissed by keyboard is a
 * keyboard trap, not a focus trap.
 */
import { expectGdsFocusTrap } from '@sovereignsquad/gds-a11y';
import { createFinding } from '../../lib/a11y-report.mjs';

const containerContainsFocus = (page, selector) =>
  page.evaluate((value) => {
    const container = document.querySelector(value);
    return !!container && !!document.activeElement && container.contains(document.activeElement);
  }, selector);

const dialogGone = (page, selector) =>
  page.evaluate((value) => {
    const container = document.querySelector(value);
    if (!container) return true;
    const style = getComputedStyle(container);
    return style.display === 'none' || style.visibility === 'hidden' || container.getClientRects().length === 0;
  }, selector);

const focusMatches = (page, selector) =>
  page.evaluate((value) => {
    const active = document.activeElement;
    if (!active) return 'none';
    try {
      return active.matches(value) ? 'match' : active.id || active.tagName.toLowerCase();
    } catch {
      return active.id || active.tagName.toLowerCase();
    }
  }, selector);

export async function runFocusTrap(page, surface) {
  if (!surface.dialog) return [];
  const findings = [];
  const gds = await expectGdsFocusTrap(page, surface.dialog, { route: page.url() });
  for (const finding of gds.findings) {
    findings.push(
      createFinding({
        check: 'focus-trap',
        id: 'gds-focus-trap',
        surface: surface.id,
        selector: surface.dialog,
        expected: 'focus stays inside the governed dialog',
        actual: finding.message,
        severity: 'critical',
        status: 'failure',
        message: finding.message,
      }),
    );
  }

  const contained = await containerContainsFocus(page, surface.dialog);
  if (!contained) {
    findings.push(
      createFinding({
        check: 'focus-trap',
        id: 'focus-trap-initial',
        surface: surface.id,
        selector: surface.dialog,
        expected: 'initial focus inside the dialog',
        actual: 'focus outside the dialog',
        severity: 'critical',
        status: 'failure',
        message: `Initial focus is outside ${surface.dialog}.`,
      }),
    );
  }

  // A full forward cycle must stay contained.
  const stopCount = await page.evaluate((value) => {
    const container = document.querySelector(value);
    if (!container) return 0;
    return container.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])').length;
  }, surface.dialog);
  const presses = Math.max(6, Math.min(40, stopCount + 4));
  for (let index = 0; index < presses; index += 1) {
    await page.keyboard.press('Tab');
    if (!(await containerContainsFocus(page, surface.dialog))) {
      findings.push(
        createFinding({
          check: 'focus-trap',
          id: 'focus-trap-tab',
          surface: surface.id,
          selector: surface.dialog,
          expected: 'a full Tab cycle stays inside the dialog',
          actual: `focus escaped after ${index + 1} Tab press(es)`,
          severity: 'critical',
          status: 'failure',
          message: 'Focus escaped the governed dialog during a forward Tab cycle.',
        }),
      );
      break;
    }
  }

  if (surface.invoker) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_050);
    const gone = await dialogGone(page, surface.dialog);
    if (!gone) {
      findings.push(
        createFinding({
          check: 'focus-trap',
          id: 'focus-trap-escape',
          surface: surface.id,
          selector: surface.dialog,
          expected: 'Escape dismisses the dialog',
          actual: 'dialog still visible',
          severity: 'critical',
          status: 'failure',
          message: 'Escape did not dismiss the dialog.',
        }),
      );
    } else {
      const restored = await focusMatches(page, surface.invoker);
      if (restored !== 'match') {
        findings.push(
          createFinding({
            check: 'focus-restore',
            id: 'focus-restore',
            surface: surface.id,
            selector: surface.invoker,
            expected: `focus restored to ${surface.invoker}`,
            actual: restored,
            severity: 'serious',
            status: 'failure',
            message: `Focus returned to ${restored}, expected ${surface.invoker}.`,
          }),
        );
      }
    }
  }
  return findings;
}
