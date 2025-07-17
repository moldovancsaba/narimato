/**
 * Theme Configuration
 * 
 * This file contains all theme-related constants and utilities,
 * ensuring consistent styling across the application.
 */

export const theme = {
  // Typography
  fonts: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
  fontSizes: {
    xs: 'var(--text-xs)',
    sm: 'var(--text-sm)',
    base: 'var(--text-base)',
    lg: 'var(--text-lg)',
    xl: 'var(--text-xl)',
    '2xl': 'var(--text-2xl)',
    '3xl': 'var(--text-3xl)',
    '4xl': 'var(--text-4xl)',
  },
  lineHeights: {
    none: 'var(--leading-none)',
    tight: 'var(--leading-tight)',
    normal: 'var(--leading-normal)',
    relaxed: 'var(--leading-relaxed)',
    loose: 'var(--leading-loose)',
  },

  // Spacing
  space: {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    6: 'var(--space-6)',
    8: 'var(--space-8)',
    12: 'var(--space-12)',
    16: 'var(--space-16)',
  },

  // Border Radius
  radii: {
    sm: 'var(--radius-sm)',
    default: 'var(--border-radius)',
    lg: 'var(--radius-lg)',
    full: 'var(--radius-full)',
  },

  // Shadows
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  },

  // Colors
  colors: {
    // Base
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    
    // Cards
    cardBg: 'var(--card-background)',
    cardFg: 'var(--card-foreground)',
    cardBorder: 'var(--card-border)',
    
    // Brand
    primary: 'var(--primary)',
    secondary: 'var(--secondary)',
    accent: 'var(--accent)',
    
    // States
    success: 'var(--success)',
    error: 'var(--error)',

    // Gradients
    gradients: {
      primary: {
        from: 'var(--gradient-primary-from)',
        to: 'var(--gradient-primary-to)',
      },
      secondary: {
        from: 'var(--gradient-secondary-from)',
        to: 'var(--gradient-secondary-to)',
      },
      accent: {
        from: 'var(--gradient-accent-from)',
        to: 'var(--gradient-accent-to)',
      },
      success: {
        from: 'var(--gradient-success-from)',
        to: 'var(--gradient-success-to)',
      },
      warning: {
        from: 'var(--gradient-warning-from)',
        to: 'var(--gradient-warning-to)',
      },
      error: {
        from: 'var(--gradient-error-from)',
        to: 'var(--gradient-error-to)',
      },
      subtle: {
        from: 'var(--gradient-subtle-from)',
        to: 'var(--gradient-subtle-to)',
      },
    },
  },

  // Animation
  animation: {
    durations: {
      fast: 'var(--duration-fast)',
      normal: 'var(--duration-normal)',
      slow: 'var(--duration-slow)',
    },
    easings: {
      inOut: 'var(--ease-in-out)',
      out: 'var(--ease-out)',
      in: 'var(--ease-in)',
    },
  },

  // Breakpoints
  breakpoints: {
    sm: 'var(--screen-sm)',
    md: 'var(--screen-md)',
    lg: 'var(--screen-lg)',
    xl: 'var(--screen-xl)',
    '2xl': 'var(--screen-2xl)',
  },

  // Container Widths
  containers: {
    sm: 'var(--container-sm)',
    md: 'var(--container-md)',
    lg: 'var(--container-lg)',
    xl: 'var(--container-xl)',
  },
} as const;

// Type exports for TypeScript support
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeGradients = typeof theme.colors.gradients;
export type ThemeFontSizes = keyof typeof theme.fontSizes;
export type ThemeSpaces = keyof typeof theme.space;
export type ThemeBreakpoints = keyof typeof theme.breakpoints;

/**
 * Helper function to create transition strings
 */
export const createTransition = (
  properties: string[],
  options?: {
    duration?: keyof Theme['animation']['durations'];
    easing?: keyof Theme['animation']['easings'];
  }
) => {
  const duration = options?.duration || 'normal';
  const easing = options?.easing || 'inOut';
  
  return properties
    .map(prop => `${prop} var(--duration-${duration}) var(--ease-${easing})`)
    .join(', ');
};

/**
 * Helper function to create gradient backgrounds
 */
export const createGradient = (
  type: keyof ThemeGradients,
  direction: 'to right' | 'to bottom' = 'to right'
) => {
  const gradient = theme.colors.gradients[type];
  return `linear-gradient(${direction}, ${gradient.from}, ${gradient.to})`;
};

export default theme;
