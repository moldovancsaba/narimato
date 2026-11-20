/**
 * A11Y-01 200% zoom checker.
 *
 * Doubling browser zoom halves the CSS viewport; the gate emulates that by
 * halving the viewport at the same device scale, then asserts the document does
 * not overflow horizontally and every primary action is either in the viewport
 * or inside a genuinely scrollable ancestor. The viewport is restored before the
 * next check.
 */
import { createFinding } from '../../lib/a11y-report.mjs';

export async function runZoom(page, surface) {
  const findings = [];
  const original = page.viewportSize() || surface.viewport;
  const zoomed = {
    width: Math.max(320, Math.floor(original.width / 2)),
    height: Math.max(240, Math.floor(original.height / 2)),
  };
  try {
    await page.setViewportSize(zoomed);
    await page.waitForTimeout(450);
    const result = await page.evaluate((selectors) => {
      const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const reachable = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, state: 'missing' };
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return { selector, state: 'hidden' };
        const inViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
        let node = element.parentElement;
        while (node && node !== document.documentElement) {
          const style = getComputedStyle(node);
          const scrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
          const scrollX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
          if (scrollY || scrollX) return { selector, state: 'scrollable' };
          node = node.parentElement;
        }
        return { selector, state: inViewport ? 'visible' : 'clipped', rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right } };
      };
      return {
        viewport: [window.innerWidth, window.innerHeight],
        scrollWidth,
        innerWidth: window.innerWidth,
        overflow: scrollWidth > window.innerWidth + 1,
        actions: selectors.map(reachable),
      };
    }, surface.primarySelectors || []);
    if (result.overflow) {
      findings.push(
        createFinding({
          check: 'zoom',
          id: 'zoom-overflow',
          surface: surface.id,
          selector: 'html',
          expected: `scrollWidth <= innerWidth + 1 at 200% (${zoomed.width}x${zoomed.height})`,
          actual: `${result.scrollWidth} > ${result.innerWidth}`,
          severity: 'serious',
          status: 'failure',
          message: `Horizontal overflow at 200% zoom: scrollWidth ${result.scrollWidth} exceeds viewport ${result.innerWidth}.`,
        }),
      );
    }
    for (const action of result.actions) {
      if (action.state === 'missing' || action.state === 'hidden' || action.state === 'clipped') {
        findings.push(
          createFinding({
            check: 'zoom',
            id: 'zoom-clipped',
            surface: surface.id,
            selector: action.selector,
            expected: 'primary action in viewport or a scrollable ancestor at 200% zoom',
            actual: action.state,
            severity: 'serious',
            status: 'failure',
            message: `Primary action ${action.selector} is ${action.state} at 200% zoom.`,
          }),
        );
      }
    }
  } finally {
    await page.setViewportSize({ width: original.width, height: original.height });
    await page.waitForTimeout(250);
  }
  return findings;
}
