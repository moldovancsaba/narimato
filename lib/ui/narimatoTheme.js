import { createPublicBrandTheme } from '@doneisbetter/gds-theme/server';

/**
 * Narimato brand theme via the canonical GDS public-brand lane (SSOT: general-design-system).
 */
export const narimatoTheme = createPublicBrandTheme({
  overrides: {
    primaryColor: 'violet',
    other: {
      appName: 'NARIMATO',
    },
  },
});
