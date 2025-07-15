import { createTheme } from '@mui/material/styles';
import { Roboto } from 'next/font/google';

// Function to calculate relative luminance according to WCAG 2.1
const calculateRelativeLuminance = (color: string): number => {
  // Convert hex or RGB to RGB values
  let r, g, b;
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    r = parseInt(hex.substr(0, 2), 16) / 255;
    g = parseInt(hex.substr(2, 2), 16) / 255;
    b = parseInt(hex.substr(4, 2), 16) / 255;
  } else if (color.startsWith('rgb')) {
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;
    [r, g, b] = rgb.map(x => parseInt(x) / 255);
  } else {
    return 0;
  }

  // Calculate luminance using sRGB coefficients
  const toLinear = (value: number) => {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

// Function to calculate contrast ratio according to WCAG 2.1
const getContrastRatio = (foreground: string, background: string): number => {
  const l1 = calculateRelativeLuminance(foreground);
  const l2 = calculateRelativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Function to ensure contrast meets WCAG AA standards (minimum 4.5:1 for normal text)
const ensureAccessibleContrast = (textColor: string, bgColor: string): string => {
  const contrastRatio = getContrastRatio(textColor, bgColor);
  if (contrastRatio >= 4.5) return textColor;

  // If contrast is insufficient, adjust the text color
  const bgLuminance = calculateRelativeLuminance(bgColor);
  let adjustedColor = textColor;
  
  // Start with black or white based on background luminance
  adjustedColor = bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
  
  // If still insufficient, adjust further
  if (getContrastRatio(adjustedColor, bgColor) < 4.5) {
    adjustedColor = bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
  }
  
  return adjustedColor;
};

// Function to calculate text color based on background
const calculateContrastRatio = (background: string): 'light' | 'dark' => {
  const backgroundLuminance = calculateRelativeLuminance(background);
  return backgroundLuminance > 0.5 ? 'dark' : 'light';
};

// Define the Roboto font
const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// Create a theme instance
const theme = createTheme({
  typography: {
    fontFamily: roboto.style.fontFamily,
    // Enhanced typography configuration with automatic contrast
    h1: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    h2: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    h3: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    h4: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    h5: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    h6: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    body1: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
    body2: {
      color: 'var(--accessible-text)',
      '&::after': {
        content: '""',
        display: 'none',
        backgroundColor: 'var(--background-color)',
      },
    },
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#007FFF',
    },
    background: {
      default: 'var(--background-light)',
      paper: 'var(--card-background-light)',
    },
    text: {
      primary: 'var(--foreground-light)',
      secondary: 'var(--card-foreground-light)',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: ({	heme}) => ({
          backgroundColor: theme.palette.mode === 'dark' ? 'var(--card-background-dark)' : 'var(--card-background-light)',
          borderColor: theme.palette.mode === 'dark' ? 'var(--card-border-dark)' : 'var(--card-border-light)',
        }),
      },
    },
  },
});

// Create dark theme instance
const darkTheme = createTheme({
  ...theme,
  palette: {
    ...theme.palette,
    mode: 'dark',
    background: {
      default: 'var(--background-dark)',
      paper: 'var(--card-background-dark)',
    },
    text: {
      primary: 'var(--foreground-dark)',
      secondary: 'var(--card-foreground-dark)',
    },
  },
});

export { theme, darkTheme };
