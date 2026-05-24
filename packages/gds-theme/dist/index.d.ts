import * as _mantine_core from '@mantine/core';
import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

declare const gdsTheme: {
    focusRing?: "auto" | "always" | "never" | undefined;
    scale?: number | undefined;
    fontSmoothing?: boolean | undefined;
    white?: string | undefined;
    black?: string | undefined;
    colors?: {
        [x: string & {}]: _mantine_core.MantineColorsTuple | undefined;
        violet?: _mantine_core.MantineColorsTuple | undefined;
        dark?: _mantine_core.MantineColorsTuple | undefined;
        gray?: _mantine_core.MantineColorsTuple | undefined;
        red?: _mantine_core.MantineColorsTuple | undefined;
        pink?: _mantine_core.MantineColorsTuple | undefined;
        grape?: _mantine_core.MantineColorsTuple | undefined;
        indigo?: _mantine_core.MantineColorsTuple | undefined;
        blue?: _mantine_core.MantineColorsTuple | undefined;
        cyan?: _mantine_core.MantineColorsTuple | undefined;
        green?: _mantine_core.MantineColorsTuple | undefined;
        lime?: _mantine_core.MantineColorsTuple | undefined;
        yellow?: _mantine_core.MantineColorsTuple | undefined;
        orange?: _mantine_core.MantineColorsTuple | undefined;
        teal?: _mantine_core.MantineColorsTuple | undefined;
    } | undefined;
    primaryShade?: _mantine_core.MantineColorShade | {
        light?: _mantine_core.MantineColorShade | undefined;
        dark?: _mantine_core.MantineColorShade | undefined;
    } | undefined;
    primaryColor?: string | undefined;
    variantColorResolver?: _mantine_core.VariantColorsResolver | undefined;
    autoContrast?: boolean | undefined;
    luminanceThreshold?: number | undefined;
    fontFamily?: string | undefined;
    fontFamilyMonospace?: string | undefined;
    headings?: {
        fontFamily?: string | undefined;
        fontWeight?: string | undefined;
        textWrap?: "wrap" | "nowrap" | "balance" | "pretty" | "stable" | undefined;
        sizes?: {
            h1?: {
                fontSize?: string | undefined;
                fontWeight?: string | undefined;
                lineHeight?: string | undefined;
            } | undefined;
            h2?: {
                fontSize?: string | undefined;
                fontWeight?: string | undefined;
                lineHeight?: string | undefined;
            } | undefined;
            h3?: {
                fontSize?: string | undefined;
                fontWeight?: string | undefined;
                lineHeight?: string | undefined;
            } | undefined;
            h4?: {
                fontSize?: string | undefined;
                fontWeight?: string | undefined;
                lineHeight?: string | undefined;
            } | undefined;
            h5?: {
                fontSize?: string | undefined;
                fontWeight?: string | undefined;
                lineHeight?: string | undefined;
            } | undefined;
            h6?: {
                fontSize?: string | undefined;
                fontWeight?: string | undefined;
                lineHeight?: string | undefined;
            } | undefined;
        } | undefined;
    } | undefined;
    radius?: {
        [x: string & {}]: string | undefined;
        md?: string | undefined;
        xs?: string | undefined;
        sm?: string | undefined;
        lg?: string | undefined;
        xl?: string | undefined;
    } | undefined;
    defaultRadius?: _mantine_core.MantineRadius | undefined;
    spacing?: {
        [x: number]: string | undefined;
        [x: string & {}]: string | undefined;
        md?: string | undefined;
        xs?: string | undefined;
        sm?: string | undefined;
        lg?: string | undefined;
        xl?: string | undefined;
    } | undefined;
    fontSizes?: {
        [x: string & {}]: string | undefined;
        md?: string | undefined;
        xs?: string | undefined;
        sm?: string | undefined;
        lg?: string | undefined;
        xl?: string | undefined;
    } | undefined;
    lineHeights?: {
        [x: string & {}]: string | undefined;
        md?: string | undefined;
        xs?: string | undefined;
        sm?: string | undefined;
        lg?: string | undefined;
        xl?: string | undefined;
    } | undefined;
    breakpoints?: {
        [x: string & {}]: string | undefined;
        md?: string | undefined;
        xs?: string | undefined;
        sm?: string | undefined;
        lg?: string | undefined;
        xl?: string | undefined;
    } | undefined;
    shadows?: {
        [x: string & {}]: string | undefined;
        md?: string | undefined;
        xs?: string | undefined;
        sm?: string | undefined;
        lg?: string | undefined;
        xl?: string | undefined;
    } | undefined;
    respectReducedMotion?: boolean | undefined;
    cursorType?: "default" | "pointer" | undefined;
    defaultGradient?: {
        from?: string | undefined;
        to?: string | undefined;
        deg?: number | undefined;
    } | undefined;
    activeClassName?: string | undefined;
    focusClassName?: string | undefined;
    components?: {
        [x: string]: {
            classNames?: any;
            styles?: any;
            vars?: any;
            defaultProps?: any;
        } | undefined;
    } | undefined;
    other?: {
        [x: string]: any;
    } | undefined;
};

interface GdsProviderProps {
    children: React.ReactNode;
    locale?: string;
    messages?: Record<string, string>;
}
/**
 * GdsProvider is the single required root provider for any application
 * adopting the General Design System. It injects the strict Mantine theme.
 */
declare function GdsProvider({ children, locale, messages }: GdsProviderProps): react_jsx_runtime.JSX.Element;

/**
 * useGdsTranslation provides a lightweight translation hook.
 * It looks up the translation key in the provider's message dictionary,
 * and falls back to the default semantic English string if not found.
 */
declare function useGdsTranslation(): {
    t: (id: string, defaultMessage: string) => string;
    locale: string;
};

export { GdsProvider, type GdsProviderProps, gdsTheme, useGdsTranslation };
