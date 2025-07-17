/**
 * Styling Constants
 * 
 * This file contains all the styling constants used throughout the application.
 * Any hard-coded values should be replaced with references to these constants.
 */

export const COLORS = {
  // Brand Colors
  PRIMARY: 'var(--primary)',
  SECONDARY: 'var(--secondary)',
  ACCENT: 'var(--accent)',
  
  // System Colors
  SUCCESS: 'var(--success)',
  ERROR: 'var(--error)',
  
  // Background Colors
  BACKGROUND: 'var(--background)',
  FOREGROUND: 'var(--foreground)',
  
  // Card Colors
  CARD_BG: 'var(--card-background)',
  CARD_FG: 'var(--card-foreground)',
  CARD_BORDER: 'var(--card-border)',
} as const;

export const TYPOGRAPHY = {
  // Font Families
  FONT_SANS: 'var(--font-sans)',
  FONT_MONO: 'var(--font-mono)',
  
  // Font Sizes
  TEXT_XS: 'var(--text-xs)',
  TEXT_SM: 'var(--text-sm)',
  TEXT_BASE: 'var(--text-base)',
  TEXT_LG: 'var(--text-lg)',
  TEXT_XL: 'var(--text-xl)',
  TEXT_2XL: 'var(--text-2xl)',
  TEXT_3XL: 'var(--text-3xl)',
  TEXT_4XL: 'var(--text-4xl)',
  
  // Line Heights
  LEADING_NONE: 'var(--leading-none)',
  LEADING_TIGHT: 'var(--leading-tight)',
  LEADING_NORMAL: 'var(--leading-normal)',
  LEADING_RELAXED: 'var(--leading-relaxed)',
  LEADING_LOOSE: 'var(--leading-loose)',
} as const;

export const SPACING = {
  // Space Scale
  SPACE_1: 'var(--space-1)',
  SPACE_2: 'var(--space-2)',
  SPACE_3: 'var(--space-3)',
  SPACE_4: 'var(--space-4)',
  SPACE_6: 'var(--space-6)',
  SPACE_8: 'var(--space-8)',
  SPACE_12: 'var(--space-12)',
  SPACE_16: 'var(--space-16)',
} as const;

export const BORDERS = {
  // Border Radius
  RADIUS_SM: 'var(--radius-sm)',
  RADIUS_DEFAULT: 'var(--border-radius)',
  RADIUS_LG: 'var(--radius-lg)',
  RADIUS_FULL: 'var(--radius-full)',
} as const;

export const SHADOWS = {
  // Box Shadows
  SHADOW_SM: 'var(--shadow-sm)',
  SHADOW_MD: 'var(--shadow-md)',
  SHADOW_LG: 'var(--shadow-lg)',
} as const;

export const ANIMATION = {
  // Durations
  DURATION_FAST: 'var(--duration-fast)',
  DURATION_NORMAL: 'var(--duration-normal)',
  DURATION_SLOW: 'var(--duration-slow)',
  
  // Easings
  EASE_IN_OUT: 'var(--ease-in-out)',
  EASE_OUT: 'var(--ease-out)',
  EASE_IN: 'var(--ease-in)',
} as const;

export const BREAKPOINTS = {
  // Screen Sizes
  SCREEN_SM: 'var(--screen-sm)',
  SCREEN_MD: 'var(--screen-md)',
  SCREEN_LG: 'var(--screen-lg)',
  SCREEN_XL: 'var(--screen-xl)',
  SCREEN_2XL: 'var(--screen-2xl)',
} as const;

export const CONTAINERS = {
  // Container Widths
  CONTAINER_SM: 'var(--container-sm)',
  CONTAINER_MD: 'var(--container-md)',
  CONTAINER_LG: 'var(--container-lg)',
  CONTAINER_XL: 'var(--container-xl)',
} as const;

export const GRADIENTS = {
  // Primary Background Gradient
  BG_GRADIENT_FROM: 'var(--bg-gradient-from)',
  BG_GRADIENT_MIDDLE: 'var(--bg-gradient-middle)',
  BG_GRADIENT_TO: 'var(--bg-gradient-to)',
  
  // Alternative Gradients
  GRADIENT_PRIMARY_FROM: 'var(--gradient-primary-from)',
  GRADIENT_PRIMARY_TO: 'var(--gradient-primary-to)',
  GRADIENT_SECONDARY_FROM: 'var(--gradient-secondary-from)',
  GRADIENT_SECONDARY_TO: 'var(--gradient-secondary-to)',
  GRADIENT_ACCENT_FROM: 'var(--gradient-accent-from)',
  GRADIENT_ACCENT_TO: 'var(--gradient-accent-to)',
  GRADIENT_SUCCESS_FROM: 'var(--gradient-success-from)',
  GRADIENT_SUCCESS_TO: 'var(--gradient-success-to)',
  GRADIENT_WARNING_FROM: 'var(--gradient-warning-from)',
  GRADIENT_WARNING_TO: 'var(--gradient-warning-to)',
  GRADIENT_ERROR_FROM: 'var(--gradient-error-from)',
  GRADIENT_ERROR_TO: 'var(--gradient-error-to)',
  GRADIENT_SUBTLE_FROM: 'var(--gradient-subtle-from)',
  GRADIENT_SUBTLE_TO: 'var(--gradient-subtle-to)',
} as const;

// Component-specific constants
export const COMPONENT_STYLES = {
  // Card Component
  CARD: {
    DEFAULT_PADDING: SPACING.SPACE_4,
    DEFAULT_RADIUS: BORDERS.RADIUS_DEFAULT,
    DEFAULT_SHADOW: SHADOWS.SHADOW_MD,
    TEXT_ASPECT_RATIO: '3/4',
  },
  
  // Button Component
  BUTTON: {
    DEFAULT_PADDING: `${SPACING.SPACE_2} ${SPACING.SPACE_4}`,
    DEFAULT_RADIUS: BORDERS.RADIUS_DEFAULT,
    DEFAULT_FONT_SIZE: TYPOGRAPHY.TEXT_SM,
    DEFAULT_FONT_WEIGHT: 'semibold',
    DEFAULT_TRANSITION: 'var(--duration-normal)',
  },
  
  // Input Component
  INPUT: {
    DEFAULT_PADDING: `${SPACING.SPACE_2} ${SPACING.SPACE_3}`,
    DEFAULT_RADIUS: BORDERS.RADIUS_DEFAULT,
    DEFAULT_FONT_SIZE: TYPOGRAPHY.TEXT_SM,
    DEFAULT_HEIGHT: '2.5rem',
  },
  
  // Navigation Component
  NAVIGATION: {
    DEFAULT_HEIGHT: '4rem',
    MOBILE_HEIGHT: '3.5rem',
    DEFAULT_PADDING: SPACING.SPACE_4,
    DEFAULT_SHADOW: SHADOWS.SHADOW_SM,
  },
  
  // Form Component
  FORM: {
    LABEL_MARGIN: SPACING.SPACE_1,
    ERROR_MARGIN: SPACING.SPACE_1,
    GROUP_SPACING: SPACING.SPACE_4,
  },
  
  // Modal Component
  MODAL: {
    DEFAULT_PADDING: SPACING.SPACE_6,
    DEFAULT_RADIUS: BORDERS.RADIUS_LG,
    DEFAULT_SHADOW: SHADOWS.SHADOW_LG,
    BACKDROP_COLOR: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Swipe Component
  SWIPE: {
    CARD_WIDTH: 'min(100vw, 500px)',
    SWIPE_THRESHOLD: 100,
    ROTATION_FACTOR: 0.1,
    TRANSITION_DURATION: ANIMATION.DURATION_NORMAL,
  },
} as const;

export default {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDERS,
  SHADOWS,
  ANIMATION,
  BREAKPOINTS,
  CONTAINERS,
  GRADIENTS,
  COMPONENT_STYLES,
} as const;
