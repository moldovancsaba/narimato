import { createTheme } from '@mantine/core';
import { gdsTheme } from '@gds/theme';

/**
 * Narimato theme extends @gds/theme (General Design System — external dependency).
 * Product-specific overrides only.
 */
export const narimatoTheme = createTheme({
  ...gdsTheme,
  other: {
    ...(gdsTheme.other || {}),
    appName: 'NARIMATO',
  },
});
