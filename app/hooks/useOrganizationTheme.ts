'use client';

import { useEffect } from 'react';
import { IOrganizationTheme } from '../lib/models/Organization';

export interface ThemeConfig extends IOrganizationTheme {
  _id?: string;
  name?: string;
  slug?: string;
}

/**
 * Custom hook for applying organization-specific themes
 * 
 * This hook manages the dynamic application of CSS custom properties
 * based on organization theme configuration, allowing real-time
 * theme switching without page reloads.
 */
export function useOrganizationTheme(theme: ThemeConfig | null) {
  useEffect(() => {
    if (!theme) {
      // Reset to default theme
      document.documentElement.removeAttribute('data-theme');
      clearCustomProperties();
      removeCustomCSS();
      removeBackgroundCSS();
      removeGoogleFonts();
      return;
    }

    // Set organization theme
    document.documentElement.setAttribute('data-theme', 'organization');
    applyThemeProperties(theme);

    // Apply custom CSS if provided
    if (theme.customCSS) {
      applyCustomCSS(theme.customCSS);
    }

    // Apply background CSS for animated backgrounds
    if (theme.backgroundCSS) {
      applyBackgroundCSS(theme.backgroundCSS);
    }

    // Apply Google Fonts if provided
    if (theme.googleFontURL) {
      applyGoogleFonts(theme.googleFontURL, theme.fontFamily);
    }

    // Cleanup function
    return () => {
      clearCustomProperties();
      removeCustomCSS();
      removeBackgroundCSS();
      removeGoogleFonts();
    };
  }, [theme]);
}

/**
 * Apply theme properties as CSS custom properties
 */
function applyThemeProperties(theme: ThemeConfig) {
  const root = document.documentElement;
  
  // Apply color properties
  root.style.setProperty('--org-primary-color', theme.primaryColor);
  root.style.setProperty('--org-secondary-color', theme.secondaryColor);
  root.style.setProperty('--org-accent-color', theme.accentColor);
  root.style.setProperty('--org-background-color', theme.backgroundColor);
  root.style.setProperty('--org-text-color', theme.textColor);
  
  // Apply typography properties
  root.style.setProperty('--org-font-family', theme.fontFamily);
  root.style.setProperty('--org-font-size', theme.fontSize);
  
  // Apply layout properties
  root.style.setProperty('--org-border-radius', theme.borderRadius);
  root.style.setProperty('--org-spacing', theme.spacing);
}

/**
 * Clear all custom theme properties
 */
function clearCustomProperties() {
  const root = document.documentElement;
  const propertiesToClear = [
    '--org-primary-color',
    '--org-secondary-color', 
    '--org-accent-color',
    '--org-background-color',
    '--org-text-color',
    '--org-font-family',
    '--org-font-size',
    '--org-border-radius',
    '--org-spacing'
  ];
  
  propertiesToClear.forEach(property => {
    root.style.removeProperty(property);
  });
}

/**
 * Apply custom CSS to the document
 */
function applyCustomCSS(customCSS: string) {
  // Remove existing custom CSS
  removeCustomCSS();
  
  // Create and inject new style element
  const styleElement = document.createElement('style');
  styleElement.id = 'organization-custom-css';
  styleElement.textContent = customCSS;
  document.head.appendChild(styleElement);
}

/**
 * Remove custom CSS from the document
 */
function removeCustomCSS() {
  const existingStyle = document.getElementById('organization-custom-css');
  if (existingStyle) {
    existingStyle.remove();
  }
}

/**
 * Apply background CSS for animated backgrounds
 * This handles both global selectors and .background-content specific styles
 */
function applyBackgroundCSS(backgroundCSS: string) {
  // Remove existing background CSS
  removeBackgroundCSS();
  
  // Process the background CSS to handle different types of selectors
  let processedCSS = backgroundCSS;
  
  // Replace global html, body selectors with body to maintain the global background
  processedCSS = processedCSS.replace(/html,\s*body/g, 'body');
  processedCSS = processedCSS.replace(/^html\s*{/gm, 'body {');
  
  // Ensure all .background-content styles have proper z-index and pointer-events
  const finalCSS = `
    ${processedCSS}
    
    /* Ensure background layer is behind everything */
    .background-content {
      z-index: -999 !important;
      pointer-events: none !important;
    }
    
    /* Ensure all animated elements in background stay behind content */
    .background-content *,
    .background-content::before,
    .background-content::after {
      z-index: -999 !important;
      pointer-events: none !important;
    }
  `;
  
  // Create and inject background style element
  const styleElement = document.createElement('style');
  styleElement.id = 'organization-background-css';
  styleElement.textContent = finalCSS;
  document.head.appendChild(styleElement);
}

/**
 * Remove background CSS from the document
 */
function removeBackgroundCSS() {
  const existingStyle = document.getElementById('organization-background-css');
  if (existingStyle) {
    existingStyle.remove();
  }
}

/**
 * Apply Google Fonts by injecting a link element
 * Also updates the font-family CSS variable if a font family is provided
 */
function applyGoogleFonts(googleFontURL: string, fontFamily?: string) {
  // Remove existing Google Fonts link
  removeGoogleFonts();
  
  // Create and inject Google Fonts link
  const linkElement = document.createElement('link');
  linkElement.id = 'organization-google-fonts';
  linkElement.rel = 'stylesheet';
  linkElement.href = googleFontURL;
  linkElement.crossOrigin = 'anonymous';
  document.head.appendChild(linkElement);
  
  // Extract font family name from URL if not provided
  if (!fontFamily) {
    try {
      const url = new URL(googleFontURL);
      const familyParam = url.searchParams.get('family');
      if (familyParam) {
        // Extract font family name (before any colon or plus signs)
        const extractedFamily = familyParam.split(':')[0].replace(/\+/g, ' ');
        // Update the CSS custom property for organization font family
        document.documentElement.style.setProperty('--org-font-family', `'${extractedFamily}', sans-serif`);
      }
    } catch (error) {
      console.warn('Failed to extract font family from Google Fonts URL:', error);
    }
  }
}

/**
 * Remove Google Fonts link from the document
 */
function removeGoogleFonts() {
  const existingLink = document.getElementById('organization-google-fonts');
  if (existingLink) {
    existingLink.remove();
  }
}

/**
 * Utility function to validate theme colors and new fields
 */
export function validateTheme(theme: Partial<ThemeConfig>): string[] {
  const errors: string[] = [];
  
  const colorFields = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'];
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  
  colorFields.forEach(field => {
    const color = theme[field as keyof ThemeConfig] as string;
    if (color && !colorRegex.test(color)) {
      errors.push(`${field} must be a valid hex color`);
    }
  });
  
  const sizeRegex = /^\d+(\.\d+)?(px|rem|em)$/;
  const sizeFields = ['fontSize', 'borderRadius', 'spacing'];
  
  sizeFields.forEach(field => {
    const size = theme[field as keyof ThemeConfig] as string;
    if (size && !sizeRegex.test(size)) {
      errors.push(`${field} must be a valid CSS size value`);
    }
  });
  
  // Validate Google Font URL
  if (theme.googleFontURL && !/^https:\/\/fonts\.googleapis\.com\/css2\?family=/.test(theme.googleFontURL)) {
    errors.push('Google Font URL must be a valid Google Fonts CSS2 URL');
  }
  
  // Validate background CSS (basic check for dangerous patterns)
  if (theme.backgroundCSS) {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /expression\(/i,
      /import\s/i,
      /@import/i
    ];
    if (dangerousPatterns.some(pattern => pattern.test(theme.backgroundCSS || ''))) {
      errors.push('Background CSS contains potentially dangerous content');
    }
  }
  
  return errors;
}
