// Typography Scale System - Updated for consistency
export const typography = {
  // Base Styles
  text: {
    heading: {
      color: 'var(--foreground)',
      fontWeight: '700',
      letterSpacing: '-0.025em',
    },
    body: {
      color: 'var(--foreground)',
      fontWeight: '400',
      letterSpacing: 'normal',
    },
    button: {
      fontWeight: '600',
      letterSpacing: '0.025em',
    },
    input: {
      fontWeight: '400',
      letterSpacing: 'normal',
    },
    error: {
      color: 'var(--error)',
      fontWeight: '500',
      letterSpacing: 'normal',
    },
  },

  // Font families
  fontFamily: {
    sans: [
      'Inter',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif',
    ],
    mono: [
      'JetBrains Mono',
      'Menlo',
      'Monaco',
      'Consolas',
      'Liberation Mono',
      'Courier New',
      'monospace',
    ],
  },

  // Size Scale (rem)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
  },

  // Line Heights
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // Font Weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Letter Spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
}
