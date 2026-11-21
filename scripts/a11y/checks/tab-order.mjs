/**
 * A11Y-01 keyboard-order checker.
 *
 * Two assertions:
 *  1. the GDS layer's `expectGdsTabOrder` (focus each expected control in order);
 *  2. a real forward Tab walk from the first expected control, proving the
 *     browser lands on each next expected stop and does not slip to another
 *     node. This catches a control that is focusable but out of DOM order.
 */
import { expectGdsTabOrder } from '@sovereignsquad/gds-a11y';
import { createFinding } from '../../lib/a11y-report.mjs';

const activeMatches = (page, selector) =>
  page.evaluate((value) => {
    const active = document.activeElement;
    if (!active) return false;
    try {
      return active.matches(value);
    } catch {
      return false;
    }
  }, selector);

const describeActive = (page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return 'body';
    return (
      active.id ||
      active.getAttribute('data-surface-hold') ||
      active.getAttribute('aria-label') ||
      active.textContent?.trim().slice(0, 32) ||
      active.tagName.toLowerCase()
    );
  });

export async function runTabOrder(page, surface, { walkTabs = true } = {}) {
  const expected = surface.expectedTabOrder || [];
  if (!expected.length) return [];
  const findings = [];
  const gds = await expectGdsTabOrder(page, expected, { route: page.url() });
  for (const finding of gds.findings) {
    findings.push(
      createFinding({
        check: 'tab-order',
        id: 'gds-tab-order',
        surface: surface.id,
        selector: finding.selector,
        expected: expected.join(' -> '),
        actual: (gds.actualSelectors || []).join(' -> '),
        severity: 'serious',
        status: 'failure',
        message: finding.message,
      }),
    );
  }

  if (!walkTabs) return findings;

  // Real Tab walk from the first expected stop.
  const first = expected[0];
  const focusedFirst = await page.evaluate((selector) => {
    const target = document.querySelector(selector);
    if (!target || typeof target.focus !== 'function') return false;
    target.focus();
    return document.activeElement === target || !!document.activeElement?.matches?.(selector);
  }, first);
  if (!focusedFirst) {
    findings.push(
      createFinding({
        check: 'tab-order',
        id: 'tab-order-start',
        surface: surface.id,
        selector: first,
        expected: `first tab stop ${first}`,
        actual: await describeActive(page),
        severity: 'serious',
        status: 'failure',
        message: `The first expected tab stop ${first} is missing or not focusable.`,
      }),
    );
    return findings;
  }

  const walked = [first];
  for (let index = 1; index < expected.length; index += 1) {
    await page.keyboard.press('Tab');
    const matches = await activeMatches(page, expected[index]);
    if (!matches) {
      const actual = await describeActive(page);
      walked.push(actual);
      findings.push(
        createFinding({
          check: 'tab-order',
          id: 'tab-order-walk',
          surface: surface.id,
          selector: expected[index],
          expected: `${expected[index - 1]} then Tab -> ${expected[index]}`,
          actual,
          severity: 'serious',
          status: 'failure',
          message: `Tab from ${expected[index - 1]} landed on ${actual}, expected ${expected[index]}.`,
        }),
      );
      break;
    }
    walked.push(expected[index]);
  }
  return findings;
}
