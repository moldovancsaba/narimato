/**
 * A11Y-01 GDS-ownership and target-size checks.
 *
 * Ownership: every visible interactive node on a migrated surface must descend
 * from a node carrying both `data-gds-surface` and `data-gds-component`. GDS
 * 6.9.0 does not emit those markers itself, so the island sets them on each GDS
 * surface/dialog root; a hand-rolled control outside that subtree fails.
 *
 * Custom control styling: `public/css/cyberpunk.css` is the legacy stylesheet.
 * It may only host the mount host and the fallback banner; any `.gds-*` control
 * rule there means the surface is being skinned outside GDS.
 *
 * Targets: visible buttons on the active surface are >= 44 x 44 CSS px.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createFinding } from '../../lib/a11y-report.mjs';

const OWNERSHIP_ALLOWED = [/^#gds-root/, /^\.gds-fallback/];

export async function runOwnership(page, surface, { root } = {}) {
  const findings = [];
  const report = await page.evaluate(() => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const selectorFor = (element) => {
      if (element.id) return `#${element.id}`;
      const className = [...element.classList].find((name) => !name.startsWith('mantine-'));
      return `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
    };
    const interactive = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')].filter(
      (element) => isVisible(element) && !element.closest('[aria-hidden="true"]'),
    );
    const outside = [];
    for (const element of interactive) {
      if (!element.closest('[data-gds-surface][data-gds-component]')) outside.push(selectorFor(element));
    }
    const buttons = [...document.querySelectorAll('button, [role="button"]')].filter(
      (element) => isVisible(element) && !element.closest('[aria-hidden="true"]'),
    );
    const small = [];
    for (const element of buttons) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 43.5 || rect.height < 43.5) {
        small.push({ selector: selectorFor(element), width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    }
    const roots = document.querySelectorAll('[data-gds-surface][data-gds-component]').length;
    return { outside: [...new Set(outside)].slice(0, 20), small: small.slice(0, 20), roots, interactive: interactive.length };
  });
  if (report.roots === 0) {
    findings.push(
      createFinding({
        check: 'gds-ownership',
        id: 'gds-surface-missing',
        surface: surface.id,
        selector: '[data-gds-surface][data-gds-component]',
        expected: 'at least one governed surface root',
        actual: 'none',
        severity: 'critical',
        status: 'failure',
        message: 'No node carries both data-gds-surface and data-gds-component.',
      }),
    );
  }
  for (const selector of report.outside) {
    findings.push(
      createFinding({
        check: 'gds-ownership',
        id: 'gds-unowned-control',
        surface: surface.id,
        selector,
        expected: 'interactive node inside [data-gds-surface][data-gds-component]',
        actual: 'outside the governed subtree',
        severity: 'critical',
        status: 'failure',
        message: `Interactive node ${selector} is outside the GDS surface subtree.`,
      }),
    );
  }
  for (const small of report.small) {
    findings.push(
      createFinding({
        check: 'target-size',
        id: 'target-size',
        surface: surface.id,
        selector: small.selector,
        expected: '>= 44 x 44 CSS px',
        actual: `${small.width} x ${small.height}`,
        severity: 'serious',
        status: 'failure',
        message: `Control ${small.selector} is ${small.width}x${small.height}, below the 44 px target floor.`,
      }),
    );
  }

  if (root) {
    const cssPath = path.join(root, 'public/css/cyberpunk.css');
    if (fs.existsSync(cssPath)) {
      const source = fs.readFileSync(cssPath, 'utf8');
      const offenders = [];
      for (const rawLine of source.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('@')) continue;
        const selector = line.includes('{') ? line.slice(0, line.indexOf('{')).trim() : '';
        if (!selector) continue;
        if (!/\.gds-|\[data-gds-|#meteor-title|\.meteor-(content|dismiss|title|sub|description)/.test(selector)) continue;
        if (OWNERSHIP_ALLOWED.some((allowed) => allowed.test(selector))) continue;
        offenders.push(selector.slice(0, 120));
      }
      for (const selector of [...new Set(offenders)].slice(0, 10)) {
        findings.push(
          createFinding({
            check: 'gds-styles',
            id: 'custom-control-css',
            surface: surface.id,
            selector,
            expected: 'control styling owned by the GDS island stylesheet',
            actual: `custom rule in public/css/cyberpunk.css: ${selector}`,
            severity: 'serious',
            status: 'failure',
            message: `Legacy stylesheet skins a migrated selector (${selector}); remove it or move layout only into island.css.`,
          }),
        );
      }
    }
  }
  return findings;
}
