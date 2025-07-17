/**
 * Theme Configuration
 * 
 * This file provides the core theme configuration, defining all design tokens,
 * component-specific themes, and reusable style patterns.
 */

import { tokens } from './tokens'
import { cssVar } from './css-var'

/**
 * Core theme configuration object that defines all visual aspects of the application
 */
/**
 * Theme Configuration
 * Follows BRAND_BOOK.md and narimato.md specifications
 * 
 * This configuration defines:
 * 1. Core design tokens (colors, typography, spacing)
 * 2. Component-specific themes
 * 3. Reusable style patterns
 * 4. Animation patterns
 */

export const themeConfig = {
  // Design Tokens (imported from tokens.ts)
  tokens,

  // Component-specific theme configurations
  components: {
    // Alert component theme
    alert: {
      base: {
        padding: `${cssVar('space-2')}`,
        borderRadius: cssVar('radius-md'),
      },
      variants: {
        error: {
          background: `${cssVar('error-light')} / 10`,
          color: cssVar('error'),
        },
      },
    },

    // Loading overlay theme
    loading: {
      overlay: {
        background: `${cssVar('foreground')} / 20`,
        zIndex: cssVar('z-modal'),
        flexCenter: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }
      },
    },
  // Badge component theme
  badge: {
    base: {
      padding: `${cssVar('space-1')} ${cssVar('space-2')}`,
      borderRadius: cssVar('radius-full'),
      fontSize: cssVar('text-sm'),
    },
    variants: {
      primary: {
        background: `${cssVar('primary')}/90`,
        color: 'white',
      },
    },
  },

  // Card component theme
  card: {
      base: {
        background: 'var(--card-background)',
        borderRadius: 'var(--border-radius)',
        border: '1px solid var(--card-border)',
        padding: 'var(--space-4)',
        transition: 'all var(--duration-normal) var(--ease-in-out)',
      },
      variants: {
        default: {
          shadow: 'var(--shadow-sm)',
        },
        interactive: {
          cursor: 'pointer',
          '&:hover': {
            border: '1px solid var(--primary)',
            shadow: 'var(--shadow-md)',
          },
        },
        elevated: {
          shadow: 'var(--shadow-md)',
          border: 'none',
        },
      },
    },

    // Button component theme
    button: {
      base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'var(--font-medium)',
        transition: 'all var(--duration-normal) var(--ease-in-out)',
        '&:focus': {
          outline: 'none',
          ring: '2px solid var(--primary)',
          ringOffset: '2px',
        },
        '&:disabled': {
          opacity: '0.5',
          cursor: 'not-allowed',
        },
      },
      sizes: {
        sm: {
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          borderRadius: 'var(--radius-sm)',
        },
        md: {
          padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-base)',
          borderRadius: 'var(--border-radius)',
        },
        lg: {
          padding: 'var(--space-4) var(--space-6)',
          fontSize: 'var(--text-lg)',
          borderRadius: 'var(--radius-lg)',
        },
      },
      variants: {
        primary: {
          background: 'var(--primary)',
          color: 'white',
          '&:hover': {
            opacity: '0.9',
          },
          '&:active': {
            opacity: '1',
          },
        },
        secondary: {
          background: 'var(--secondary)',
          color: 'white',
          '&:hover': {
            opacity: '0.9',
          },
          '&:active': {
            opacity: '1',
          },
        },
        outline: {
          background: 'transparent',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          '&:hover': {
            background: 'var(--primary)',
            color: 'white',
          },
        },
        ghost: {
          background: 'transparent',
          color: 'var(--foreground)',
          '&:hover': {
            background: 'var(--card-background)',
          },
        },
        link: {
          background: 'transparent',
          color: 'var(--primary)',
          padding: '0',
          height: 'auto',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },

    // Input component theme
    input: {
      base: {
        width: '100%',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--space-2) var(--space-3)',
        fontSize: 'var(--text-base)',
        color: 'var(--foreground)',
        transition: 'all var(--duration-normal) var(--ease-in-out)',
        '&:focus': {
          outline: 'none',
          borderColor: 'var(--primary)',
          boxShadow: '0 0 0 2px var(--primary-light)',
        },
        '&:disabled': {
          opacity: '0.5',
          cursor: 'not-allowed',
        },
      },
    },

    // Dialog/Modal component theme
    dialog: {
      overlay: {
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      },
      content: {
        background: 'var(--background)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        padding: 'var(--space-4)',
        maxWidth: 'var(--container-sm)',
        margin: 'var(--space-4)',
        animation: 'var(--animation-scale-in)',
      },
    },

    // Typography components theme
    typography: {
      h1: {
        fontSize: 'var(--text-4xl)',
        lineHeight: 'var(--leading-tight)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--foreground)',
      },
      h2: {
        fontSize: 'var(--text-3xl)',
        lineHeight: 'var(--leading-tight)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--foreground)',
      },
      h3: {
        fontSize: 'var(--text-2xl)',
        lineHeight: 'var(--leading-snug)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--foreground)',
      },
      h4: {
        fontSize: 'var(--text-xl)',
        lineHeight: 'var(--leading-snug)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--foreground)',
      },
      p: {
        fontSize: 'var(--text-base)',
        lineHeight: 'var(--leading-normal)',
        color: 'var(--foreground)',
      },
      small: {
        fontSize: 'var(--text-sm)',
        lineHeight: 'var(--leading-normal)',
        color: 'var(--foreground-muted)',
      },
    },
  },

  // Common style patterns
  patterns: {
    flexCenter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    flexBetween: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    absoluteCenter: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    },
    gridAutoFit: (minWidth: string) => ({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
      gap: 'var(--space-4)',
    }),
  },

  // Animation patterns
  animations: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.2 },
    },
    slideUp: {
      initial: { y: 10, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: -10, opacity: 0 },
      transition: { duration: 0.3 },
    },
    slideDown: {
      initial: { y: -10, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: 10, opacity: 0 },
      transition: { duration: 0.3 },
    },
    scaleIn: {
      initial: { scale: 0.95, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.95, opacity: 0 },
      transition: { duration: 0.2 },
    },
  },
} as const;

// Type exports
export type ThemeConfig = typeof themeConfig;
export type ThemeComponents = typeof themeConfig.components;
export type ThemePatterns = typeof themeConfig.patterns;
export type ThemeAnimations = typeof themeConfig.animations;
