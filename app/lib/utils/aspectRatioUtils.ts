/**
 * Aspect Ratio Utilities for Card Hierarchy Management
 * 
 * This module provides utilities to ensure visual consistency across card decks
 * by managing aspect ratio relationships between parent and child cards.
 */

// Define aspect ratio families for visual consistency
export const ASPECT_FAMILIES = {
  portrait: {
    name: 'Portrait',
    ratios: ['3:4', '300:400', '9:16', '360:480', '375:500'],
    description: 'Taller than wide - good for text content, mobile-first design'
  },
  landscape: {
    name: 'Landscape', 
    ratios: ['4:3', '400:300', '16:9', '480:270', '1920:1080'],
    description: 'Wider than tall - good for media content, desktop displays'
  },
  square: {
    name: 'Square',
    ratios: ['1:1', '300:300', '400:400', '500:500', '1024:1024'],
    description: 'Equal width and height - balanced, social media friendly'
  }
} as const;

export type AspectRatioFamily = keyof typeof ASPECT_FAMILIES;

/**
 * Calculate the numeric aspect ratio from a cardSize string
 * @param cardSize - Format "width:height" (e.g., "300:400")
 * @returns Numeric aspect ratio (width/height)
 */
export function getAspectRatio(cardSize: string): number {
  const [width, height] = cardSize.split(':').map(n => parseInt(n, 10));
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error(`Invalid cardSize format: ${cardSize}`);
  }
  return width / height;
}

/**
 * Determine which aspect ratio family a cardSize belongs to
 * @param cardSize - Format "width:height" (e.g., "300:400")
 * @returns The aspect ratio family ('portrait', 'landscape', 'square')
 */
export function getAspectRatioFamily(cardSize: string): AspectRatioFamily {
  try {
    const ratio = getAspectRatio(cardSize);
    
    // Define thresholds for classification
    const SQUARE_THRESHOLD = 0.1; // Within 10% of 1:1 is considered square
    const PORTRAIT_THRESHOLD = 0.9; // Less than 0.9 is portrait
    const LANDSCAPE_THRESHOLD = 1.1; // Greater than 1.1 is landscape
    
    if (Math.abs(ratio - 1) <= SQUARE_THRESHOLD) {
      return 'square';
    } else if (ratio < PORTRAIT_THRESHOLD) {
      return 'portrait';
    } else if (ratio > LANDSCAPE_THRESHOLD) {
      return 'landscape';
    } else {
      // Edge cases near 1:1 but outside square threshold
      return ratio < 1 ? 'portrait' : 'landscape';
    }
  } catch (error) {
    console.warn(`Failed to determine aspect ratio family for ${cardSize}:`, error);
    return 'portrait'; // Default fallback
  }
}

/**
 * Check if two cardSizes are in the same aspect ratio family
 * @param cardSize1 - First cardSize to compare
 * @param cardSize2 - Second cardSize to compare
 * @returns True if both cards are in the same aspect ratio family
 */
export function areCompatibleAspectRatios(cardSize1: string, cardSize2: string): boolean {
  try {
    const family1 = getAspectRatioFamily(cardSize1);
    const family2 = getAspectRatioFamily(cardSize2);
    return family1 === family2;
  } catch (error) {
    console.warn('Error checking aspect ratio compatibility:', error);
    return false;
  }
}

/**
 * Get suggested cardSize options for a given aspect ratio family
 * @param family - The target aspect ratio family
 * @returns Array of suggested cardSize strings
 */
export function getSuggestedSizes(family: AspectRatioFamily): string[] {
  return ASPECT_FAMILIES[family].ratios;
}

/**
 * Get the most common/recommended cardSize for a family
 * @param family - The target aspect ratio family
 * @returns The recommended cardSize string
 */
export function getRecommendedSize(family: AspectRatioFamily): string {
  // Return the first (most common) size for each family
  return ASPECT_FAMILIES[family].ratios[0];
}

/**
 * Validate aspect ratio compatibility with parent cards
 * @param parentCardSizes - Array of parent card sizes
 * @param childCardSize - The child card size to validate
 * @returns Object with validation results and suggestions
 */
export function validateAspectRatioCompatibility(
  parentCardSizes: string[], 
  childCardSize: string
): {
  isCompatible: boolean;
  conflicts: string[];
  suggestions: string[];
  recommendedSize?: string;
} {
  const childFamily = getAspectRatioFamily(childCardSize);
  const conflicts: string[] = [];
  const suggestions: string[] = [];
  
  for (const parentSize of parentCardSizes) {
    const parentFamily = getAspectRatioFamily(parentSize);
    
    if (parentFamily !== childFamily) {
      conflicts.push(`Parent ${parentSize} (${parentFamily}) conflicts with child ${childCardSize} (${childFamily})`);
      
      // Add suggestions for compatible sizes
      const compatibleSizes = getSuggestedSizes(parentFamily);
      suggestions.push(...compatibleSizes);
    }
  }
  
  // Remove duplicates from suggestions
  const uniqueSuggestions = [...new Set(suggestions)];
  
  return {
    isCompatible: conflicts.length === 0,
    conflicts,
    suggestions: uniqueSuggestions,
    recommendedSize: uniqueSuggestions.length > 0 ? uniqueSuggestions[0] : undefined
  };
}

/**
 * Get aspect ratio family information for display purposes
 * @param family - The aspect ratio family
 * @returns Family information object
 */
export function getFamilyInfo(family: AspectRatioFamily) {
  return ASPECT_FAMILIES[family];
}

/**
 * Get all available aspect ratio families
 * @returns Array of family names
 */
export function getAllFamilies(): AspectRatioFamily[] {
  return Object.keys(ASPECT_FAMILIES) as AspectRatioFamily[];
}

/**
 * Format aspect ratio for display
 * @param cardSize - Format "width:height"
 * @returns Formatted string with ratio and family info
 */
export function formatAspectRatioDisplay(cardSize: string): string {
  try {
    const ratio = getAspectRatio(cardSize);
    const family = getAspectRatioFamily(cardSize);
    const familyInfo = getFamilyInfo(family);
    
    return `${cardSize} (${ratio.toFixed(2)}) - ${familyInfo.name}`;
  } catch (error) {
    return `${cardSize} (Invalid)`;
  }
}

/**
 * Check if a cardSize string is valid
 * @param cardSize - The cardSize to validate
 * @returns True if valid format and positive numbers
 */
export function isValidCardSize(cardSize: string): boolean {
  try {
    if (!/^\d+:\d+$/.test(cardSize)) {
      return false;
    }
    
    const [width, height] = cardSize.split(':').map(n => parseInt(n, 10));
    return width > 0 && height > 0 && width <= 10000 && height <= 10000; // Reasonable limits
  } catch (error) {
    return false;
  }
}
