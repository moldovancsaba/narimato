/**
 * A11Y-01 axe checker.
 *
 * Consumes the GDS accessibility test layer's `runGdsAxeScan` so the rules,
 * severity mapping and finding shape stay owned by `@sovereignsquad/gds-a11y`.
 * The page must already carry axe from `addInitScript`; the GDS helper returns a
 * critical `gds-axe-missing` failure instead of a false pass when it does not.
 */
import { runGdsAxeScan } from '@sovereignsquad/gds-a11y';
import { createFinding } from '../../lib/a11y-report.mjs';

export async function runAxe(page, surface) {
  const findings = await runGdsAxeScan(page, {
    route: page.url(),
    severityThreshold: 'serious',
  });
  return findings.map((finding) =>
    createFinding({
      check: 'axe',
      id: finding.id,
      surface: surface.id,
      selector: finding.selector || 'document',
      expected: 'no violations at or above the serious band',
      actual: finding.status,
      severity: finding.severity || 'serious',
      status: finding.status === 'failure' ? 'failure' : 'warning',
      message: finding.message,
      helpUrl: finding.helpUrl,
      suggestedGdsReplacement: finding.suggestedGdsReplacement,
    }),
  );
}
