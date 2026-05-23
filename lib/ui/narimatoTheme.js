import { createTheme } from '@mantine/core';
import { gdsTheme } from '@gds/theme';

/**
 * Narimato theme extends GDS SSOT (GENERAL_DESIGN_SYSTEM).
 * Product-specific overrides only — tokens stay Mantine-native.
 */
export const narimatoTheme = createTheme({
  ...gdsTheme,
  primaryColor: 'brand',
  other: {
    ...(gdsTheme.other || {}),
    appName: 'NARIMATO',
  },
});
