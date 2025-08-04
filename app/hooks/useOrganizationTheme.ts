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
      return;
    }

    // Set organization theme
    document.documentElement.setAttribute('data-theme', 'organization');
    applyThemeProperties(theme);

    // Apply custom CSS if provided
    if (theme.customCSS) {
      applyCustomCSS(theme.customCSS);
    }

    // Cleanup function
    return () => {
      clearCustomProperties();
      removeCustomCSS();
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
 * Utility function to validate theme colors
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
  
  return errors;
}
