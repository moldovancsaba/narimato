/**
 * Styling Utility Functions
 * 
 * This file contains utility functions for handling styles consistently
 * across the application.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { tokens } from './tokens';
import { themeConfig } from './config';
import type { ThemeComponents, ThemePatterns, ThemeAnimations } from './config';

/**
 * Combines and merges Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { cssVar } from './css-var'

/**
 * Retrieves a component's theme configuration
 * @param component Component name
 * @returns Component theme configuration
 */
export function getComponentTheme<K extends keyof ThemeComponents>(
  component: K
): ThemeComponents[K] {
  return themeConfig.components[component]
}

/**
 * Retrieves a common style pattern
 * @param pattern Pattern name
 * @returns Style pattern object
 */
export function getPattern<K extends keyof ThemePatterns>(
  pattern: K
): ThemePatterns[K] {
  return themeConfig.patterns[pattern]
}

/**
 * Creates transition style strings
 * @param properties CSS properties to transition
 * @param options Transition options
 * @returns Transition style string
 */
export function createTransition(
  properties: string[],
  options?: {
    duration?: 'fast' | 'normal' | 'slow' | 'slower'
    timing?: 'ease' | 'linear' | 'in' | 'out' | 'in-out'
  }
) {
  const { duration = 'normal', timing = 'in-out' } = options || {}
  
  return properties
    .map(prop => `${prop} var(--duration-${duration}) var(--ease-${timing})`)
    .join(', ')
}

/**
 * Creates a linear gradient style string
 * @param colors Gradient colors
 * @param direction Gradient direction
 * @returns Gradient style string
 */
export function createGradient(
  colors: [string, string],
  direction: 'to right' | 'to bottom' = 'to right'
): string {
  return `linear-gradient(${direction}, ${colors[0]}, ${colors[1]})`
}

/**
 * Gets animation configuration for Framer Motion
 * @param animation Animation name
 * @returns Animation configuration
 */
export function getAnimation<K extends keyof ThemeAnimations>(
  animation: K
): ThemeAnimations[K] {
  return themeConfig.animations[animation]
}

/**
 * Creates a responsive style object based on breakpoints
 * @param styles Styles for different breakpoints
 * @returns Responsive style object
 */
export function createResponsiveStyles<T extends Record<string, unknown>>(
  styles: {
    base: T
    sm?: Partial<T>
    md?: Partial<T>
    lg?: Partial<T>
    xl?: Partial<T>
    '2xl'?: Partial<T>
  }
): Record<string, unknown> {
  const { base, sm, md, lg, xl, '2xl': xxl } = styles
  
  return {
    ...base,
    ...(sm && { [`@media (min-width: ${tokens.breakpoints.sm})`]: sm }),
    ...(md && { [`@media (min-width: ${tokens.breakpoints.md})`]: md }),
    ...(lg && { [`@media (min-width: ${tokens.breakpoints.lg})`]: lg }),
    ...(xl && { [`@media (min-width: ${tokens.breakpoints.xl})`]: xl }),
    ...(xxl && { [`@media (min-width: ${tokens.breakpoints['2xl']})`]: xxl }),
  }
}

/**
 * Creates spacing values based on theme tokens
 * @param spacing Spacing value or object
 * @returns Spacing style string or object
 */
export function createSpacing(
  spacing: number | string | Record<'top' | 'right' | 'bottom' | 'left', number | string>
): string {
  if (typeof spacing === 'number' || typeof spacing === 'string') {
    return `var(--space-${spacing})`
  }

  return `${spacing.top || 0} ${spacing.right || 0} ${spacing.bottom || 0} ${spacing.left || 0}`
}

/**
 * Validates a color against the theme's color palette
 * @param color Color to validate
 * @returns Whether the color exists in the theme
 */
export function isValidThemeColor(color: string): boolean {
  const allColors = Object.values(tokens.colors).reduce<string[]>((acc, colorGroup) => {
    if (typeof colorGroup === 'object') {
      return [...acc, ...Object.values(colorGroup)]
    }
    return acc
  }, [])
  return allColors.includes(color)
}




export default {
  cn,
  getComponentTheme,
  getPattern,
  createTransition,
  createGradient,
  getAnimation,
  createResponsiveStyles,
  createSpacing,
  isValidThemeColor,
};
