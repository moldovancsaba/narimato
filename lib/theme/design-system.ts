/**
 * Design System Utility
 * Centralizes design system functionality and provides utilities for consistent styling
 */

import { tokens } from './tokens';

// Type definitions for component variants
type ComponentVariant = 'default' | 'primary' | 'secondary' | 'elevated';

/**
 * Applies design system classes based on variant
 * @param component The component type to get styles for
 * @param variant The variant of the component
 * @returns Class string for the component
 */
export function getDesignSystemClasses(
  component: 'card' | 'button' | 'input' | 'text',
  variant: ComponentVariant = 'default'
): string {
  const baseClasses = {
    card: 'card',
    button: 'btn',
    input: 'input',
    text: 'text'
  };

  const variantClasses = {
    card: {
      default: '',
      elevated: 'shadow-md',
      primary: 'border-primary-500',
      secondary: 'border-secondary-500'
    },
    button: {
      default: 'btn-default',
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      elevated: 'shadow-md'
    },
    input: {
      default: 'input-default',
      primary: 'input-primary',
      secondary: 'input-secondary',
      elevated: 'shadow-sm'
    },
    text: {
      default: 'text-foreground',
      primary: 'text-primary-500',
      secondary: 'text-secondary-500',
      elevated: 'font-semibold'
    }
  };

  return `${baseClasses[component]} ${variantClasses[component][variant]}`;
}

/**
 * Retrieves spacing value from design tokens
 * @param key The spacing key from design tokens
 * @returns The spacing value
 */
export function getSpacing(key: keyof typeof tokens.spacing): string {
  return `var(--spacing-${key})`;
}

/**
 * Retrieves color value from design tokens
 * @param key The color path in dot notation (e.g., 'primary.500')
 * @returns The color value
 */
export function getColor(key: string): string {
  const [palette, shade] = key.split('.');
  return `var(--colors-${palette}-${shade})`;
}

/**
 * Retrieves typography value from design tokens
 * @param key The typography property path
 * @returns The typography value
 */
export function getTypography(key: string): string {
  const [property, value] = key.split('.');
  return `var(--typography-${property}-${value})`;
}

/**
 * Creates transition string from design tokens
 * @param property CSS property to transition
 * @param duration Duration key from tokens
 * @param timing Timing function key from tokens
 * @returns Complete transition string
 */
export function getTransition(
  property: string,
  duration: keyof typeof tokens.transitions.duration = 'normal',
  timing: keyof typeof tokens.transitions.timing = 'ease'
): string {
  return `${property} var(--transitions-duration-${duration}) var(--transitions-timing-${timing})`;
}
