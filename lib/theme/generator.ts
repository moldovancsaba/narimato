/**
 * Theme Generator
 * Converts design tokens into CSS variables and generates theme-related utilities
 */

import { tokens } from './tokens'

type ThemeConfig = {
  prefix?: string
  darkMode?: boolean
}

/**
 * Flattens a nested object structure into CSS variable declarations
 * @param obj The object to flatten
 * @param prefix The CSS variable prefix
 * @returns Object containing CSS variable declarations
 */
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newPrefix = prefix ? `${prefix}-${key}` : key

    if (typeof value === 'object' && value !== null) {
      Object.assign(acc, flattenObject(value, newPrefix))
    } else {
      acc[`--${newPrefix}`] = value
    }

    return acc
  }, {} as Record<string, string>)
}

/**
 * Generates CSS variable declarations from theme tokens
 * @param config Theme configuration options
 * @returns CSS variable declarations as a string
 */
export function generateThemeVariables(config: ThemeConfig = {}): string {
  const { prefix = '', darkMode = true } = config
  const flatTokens = flattenObject(tokens, prefix)

  const lightTheme = Object.entries(flatTokens)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ')

  // Generate dark mode overrides if enabled
  const darkTheme = darkMode ? generateDarkTheme(flatTokens) : ''

  return `
:root {
  ${lightTheme}
}

${darkTheme ? `
@media (prefers-color-scheme: dark) {
  :root {
    ${darkTheme}
  }
}` : ''}
`
}

/**
 * Generates dark mode color overrides
 * @param flatTokens Flattened token object
 * @returns Dark mode CSS variable declarations
 */
function generateDarkTheme(flatTokens: Record<string, string>): string {
  // Define dark mode color mappings
  const darkModeColors = {
    '--primary': tokens.colors.primary[400],
    '--primary-dark': tokens.colors.primary[300],
    '--primary-light': tokens.colors.primary[500],
    '--secondary': tokens.colors.secondary[400],
    '--secondary-dark': tokens.colors.secondary[300],
    '--secondary-light': tokens.colors.secondary[500],
    '--background': tokens.colors.secondary[900],
    '--foreground': tokens.colors.secondary[50],
    '--card-background': tokens.colors.secondary[800],
    '--card-foreground': tokens.colors.secondary[100],
    '--popover-background': tokens.colors.secondary[800],
    '--popover-foreground': tokens.colors.secondary[100],
    '--muted': tokens.colors.secondary[600],
    '--muted-foreground': tokens.colors.secondary[400],
    '--border': tokens.colors.secondary[700],
    '--input': tokens.colors.secondary[700],
  }

  return Object.entries(darkModeColors)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n    ')
}

/**
 * Creates CSS variable reference strings for use in styles
 * @param name The name of the CSS variable
 * @returns CSS variable reference string
 */
export function cssVar(name: string): string {
  return `var(--${name})`
}

/**
 * Generates utility classes for common theme-based styles
 * @returns Utility classes as a string
 */
export function generateUtilityClasses(): string {
  return `
.text-primary { color: var(--primary); }
.bg-primary { background-color: var(--primary); }
.border-primary { border-color: var(--primary); }

.text-secondary { color: var(--secondary); }
.bg-secondary { background-color: var(--secondary); }
.border-secondary { border-color: var(--secondary); }

.text-foreground { color: var(--foreground); }
.bg-background { background-color: var(--background); }

.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow { box-shadow: var(--shadow); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }
.shadow-xl { box-shadow: var(--shadow-xl); }

.rounded-sm { border-radius: var(--radius-sm); }
.rounded { border-radius: var(--radius); }
.rounded-md { border-radius: var(--radius-md); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-xl { border-radius: var(--radius-xl); }
.rounded-full { border-radius: var(--radius-full); }

.duration-fast { transition-duration: var(--duration-fast); }
.duration-normal { transition-duration: var(--duration-normal); }
.duration-slow { transition-duration: var(--duration-slow); }
.duration-slower { transition-duration: var(--duration-slower); }
`
}
