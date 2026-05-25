import { MantineThemeOverride, MantineTheme } from '@mantine/core';

declare const gdsTheme: MantineTheme;
declare const gdsDarkPublicTheme: MantineTheme;
declare const gdsFlatSurfaceTheme: MantineTheme;
declare function extendGdsTheme(overrides?: MantineThemeOverride): MantineTheme;
declare function withGdsMotion(overrides?: MantineThemeOverride): MantineTheme;

export { extendGdsTheme, gdsDarkPublicTheme, gdsFlatSurfaceTheme, gdsTheme, withGdsMotion };
