/**
 * A11Y-01 contrast checker.
 *
 * The GDS layer's `runGdsContrastGate` owns the governed-control/transparent
 * check. The text sweep below adds the WCAG 2.1 luminance calculation the GDS
 * helper does not perform (it records the minimum ratio it enforces, and this
 * checker measures actual text pairs): 4.5:1 body text, 3:1 large text.
 * Elements painted over an unresolved gradient are recorded as a review item
 * rather than silently dropped.
 */
import { createFinding } from '../../lib/a11y-report.mjs';

export async function runContrast(page, surface) {
  const findings = [];
  const sweep = await page.evaluate(() => {
    const parse = (value) => {
      const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(String(value || ''));
      if (!match) return null;
      return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
    };
    const over = (top, bottom) => {
      const a = top.a + bottom.a * (1 - top.a);
      if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
        a,
      };
    };
    const linear = (channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color) => 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
    const ratio = (a, b) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0.01 &&
        rect.width > 0 &&
        rect.height > 0 &&
        !element.closest('[aria-hidden="true"]')
      );
    };
    const bodyBase = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    const backgroundFor = (element) => {
      const layers = [];
      let node = element;
      let gradient = false;
      while (node && node instanceof Element) {
        const style = getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage !== 'none') gradient = true;
        const color = parse(style.backgroundColor);
        if (color && color.a > 0) layers.push(color);
        if (color && color.a >= 0.999) break;
        node = node.parentElement;
      }
      let result = bodyBase.a >= 0.999 ? bodyBase : { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) result = over(layer, result);
      return { color: result, gradient };
    };
    const selectorFor = (element) => {
      if (element.id) return `#${element.id}`;
      const className = [...element.classList].find((name) => !name.startsWith('mantine-'));
      if (className) return `${element.tagName.toLowerCase()}.${className}`;
      const parent = element.parentElement;
      return parent && parent.id ? `${parent.id} > ${element.tagName.toLowerCase()}` : element.tagName.toLowerCase();
    };
    const hasText = (element) =>
      [...element.childNodes].some((node) => node.nodeType === 3 && String(node.textContent || '').trim().length > 0);
    const elements = [...document.querySelectorAll('body *')].filter((element) => {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS', 'SVG'].includes(element.tagName)) return false;
      return visible(element) && hasText(element);
    });
    const failures = [];
    let skipped = 0;
    let checked = 0;
    for (const element of elements) {
      const style = getComputedStyle(element);
      if (style.webkitTextFillColor && parse(style.webkitTextFillColor) && parse(style.webkitTextFillColor).a < 0.05) {
        skipped += 1;
        continue;
      }
      const fg = parse(style.color);
      if (!fg || fg.a < 0.05) {
        failures.push({
          selector: selectorFor(element),
          text: String(element.textContent || '').trim().slice(0, 60),
          ratio: 0,
          minimum: 4.5,
          large: false,
          gradient: false,
          transparentText: true,
        });
        continue;
      }
      const background = backgroundFor(element);
      const composedFg = fg.a >= 0.999 ? fg : over(fg, background.color);
      const ratioValue = ratio(composedFg, background.color);
      const size = Number.parseFloat(style.fontSize) || 16;
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const minimum = large ? 3 : 4.5;
      checked += 1;
      if (ratioValue + 0.005 < minimum) {
        failures.push({
          selector: selectorFor(element),
          text: String(element.textContent || '').trim().slice(0, 60),
          ratio: Math.round(ratioValue * 100) / 100,
          minimum,
          large,
          gradient: background.gradient,
        });
      }
    }
    return { failures: failures.slice(0, 25), checked, skipped, total: elements.length };
  });

  for (const failure of sweep.failures) {
    findings.push(
      createFinding({
        check: 'contrast',
        id: 'text-contrast',
        surface: surface.id,
        selector: failure.selector,
        expected: `>= ${failure.minimum}:1 for ${failure.large ? 'large' : 'body'} text`,
        actual: `${failure.ratio}:1`,
        severity: 'serious',
        status: 'failure',
        message: failure.transparentText
          ? `Text "${failure.text}" has a transparent fill and is not perceivable.`
          : `Text "${failure.text}" measures ${failure.ratio}:1 against its background${failure.gradient ? ' (gradient-backed)' : ''}.`,
      }),
    );
  }
  if (sweep.skipped > 0) {
    findings.push(
      createFinding({
        check: 'contrast',
        id: 'contrast-skipped',
        surface: surface.id,
        selector: 'document',
        expected: 'every text node measurable',
        actual: `${sweep.skipped} gradient/clipped-text node(s) not measurable`,
        severity: 'minor',
        status: 'warning',
        message: `${sweep.skipped} text node(s) paint with a gradient or clipped text fill; sampled contrast cannot be computed for them.`,
      }),
    );
  }
  return findings;
}
