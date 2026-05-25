export { extendGdsTheme, gdsDarkPublicTheme, gdsFlatSurfaceTheme, gdsTheme, withGdsMotion } from './server.mjs';
import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { MantineThemeOverride } from '@mantine/core';

interface GdsProviderProps {
    children: React.ReactNode;
    locale?: string;
    messages?: Record<string, string>;
    theme?: MantineThemeOverride;
    defaultColorScheme?: 'light' | 'dark' | 'auto';
}
/**
 * GdsProvider is the single required root provider for any application
 * adopting the General Design System. It injects the strict Mantine theme.
 */
declare function GdsProvider({ children, locale, messages, theme, defaultColorScheme, }: GdsProviderProps): react_jsx_runtime.JSX.Element;

/**
 * useGdsTranslation provides a lightweight translation hook.
 * It looks up the translation key in the provider's message dictionary,
 * and falls back to the default semantic English string if not found.
 */
declare function useGdsTranslation(): {
    t: (id: string, defaultMessage: string) => string;
    locale: string;
};

export { GdsProvider, type GdsProviderProps, useGdsTranslation };
