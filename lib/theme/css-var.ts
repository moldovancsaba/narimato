/**
 * CSS Variable Helper
 * Creates CSS variable reference strings consistently across the theme system
 */

/**
 * Creates a CSS variable reference string
 * @param name CSS variable name
 * @returns CSS variable reference
 */
export function cssVar(name: string): string {
  return `var(--${name})`
}

export default cssVar;
