// FUNCTIONAL: Centralized minimal design system with solid colors and simple shapes only
// STRATEGIC: Eliminates design complexity and provides consistent styling across all components

export const MinimalDesign = {
  // Solid color palette - no gradients, no fancy colors
  colors: {
    primary: '#000000',      // Black
    secondary: '#ffffff',    // White 
    background: '#ffffff',   // White background
    surface: '#f5f5f5',     // Light gray for cards/surfaces
    border: '#e0e0e0',      // Light gray for borders
    text: '#000000',        // Black text
    textMuted: '#666666',   // Gray text
    error: '#ff0000',       // Red for errors
    success: '#008000',     // Green for success
  },

  // Simple spacing units
  spacing: {
    xs: '4px',
    sm: '8px', 
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  // Basic border radius
  borderRadius: {
    none: '0px',
    small: '4px',
    medium: '8px',
  },

  // Basic font sizes
  fontSize: {
    small: '14px',
    medium: '16px',
    large: '20px',
    xlarge: '24px',
  },

  // Basic shadows
  shadow: {
    none: 'none',
    light: '0 1px 3px rgba(0, 0, 0, 0.12)',
  },

  // Simple button styles
  button: {
    primary: {
      backgroundColor: '#000000',
      color: '#ffffff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
    },
    secondary: {
      backgroundColor: '#ffffff',
      color: '#000000', 
      border: '1px solid #000000',
      padding: '8px 16px',
      borderRadius: '4px',
    },
  },

  // Simple input styles
  input: {
    backgroundColor: '#ffffff',
    color: '#000000',
    border: '1px solid #e0e0e0',
    padding: '8px',
    borderRadius: '4px',
  },

  // Simple card styles
  card: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
  },
} as const;

// CSS utility classes for common patterns
export const MinimalCSS = {
  // Layout utilities
  container: 'max-w-4xl mx-auto p-4',
  centerContent: 'flex items-center justify-center min-h-screen',
  
  // Typography
  heading: 'text-2xl font-bold text-black mb-4',
  subheading: 'text-lg font-semibold text-black mb-2',
  text: 'text-base text-black',
  textMuted: 'text-base text-gray-600',
  
  // Buttons
  buttonPrimary: 'bg-black text-white px-4 py-2 rounded border-none cursor-pointer hover:bg-gray-800',
  buttonSecondary: 'bg-white text-black px-4 py-2 rounded border border-black cursor-pointer hover:bg-gray-100',
  buttonDanger: 'bg-red-600 text-white px-4 py-2 rounded border-none cursor-pointer hover:bg-red-700',
  
  // Inputs
  input: 'w-full px-3 py-2 border border-gray-300 rounded bg-white text-black',
  textarea: 'w-full px-3 py-2 border border-gray-300 rounded bg-white text-black resize-vertical',
  
  // Cards
  card: 'bg-gray-50 border border-gray-300 rounded-lg p-4',
  
  // Lists
  list: 'space-y-2',
  listItem: 'bg-white border border-gray-300 rounded p-3',
  
  // Forms
  form: 'space-y-4',
  formField: 'mb-4',
  label: 'block text-sm font-semibold text-black mb-1',
  
  // Grid
  grid: 'grid gap-4',
  gridCols1: 'grid-cols-1',
  gridCols2: 'grid-cols-1 md:grid-cols-2',
  gridCols3: 'grid-cols-1 md:grid-cols-3',
} as const;
