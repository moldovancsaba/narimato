import { createPublicBrandTheme } from '@doneisbetter/gds-theme/server';

/**
 * Narimato brand theme via the canonical GDS public-brand lane (SSOT: general-design-system).
 */
export const narimatoTheme = createPublicBrandTheme({
  editorialSerif: true,
  flatSurfaces: true,
  overrides: {
    primaryColor: 'violet',
    other: {
      appName: 'NARIMATO',
    },
  },
});
