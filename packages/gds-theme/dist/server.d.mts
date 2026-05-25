import { MantineThemeOverride, MantineTheme } from '@mantine/core';

declare const gdsTheme: MantineTheme;
declare function extendGdsTheme(overrides?: MantineThemeOverride): MantineTheme;
declare function withGdsMotion(overrides?: MantineThemeOverride): MantineTheme;

export { extendGdsTheme, gdsTheme, withGdsMotion };
