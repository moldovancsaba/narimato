import { createTheme } from '@mui/material/styles';
import { Roboto } from 'next/font/google';

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
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#007FFF',
    },
    background: {
      default: 'var(--background)',
      paper: 'var(--card-background)',
    },
    text: {
      primary: 'var(--foreground)',
      secondary: 'var(--card-foreground)',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--card-background)',
          borderColor: 'var(--card-border)',
        },
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
  },
});

export { theme, darkTheme };
