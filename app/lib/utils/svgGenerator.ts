export interface SVGCardConfig {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontUrl?: string;
  width?: number;
  height?: number;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderRadius?: number;
  imageUrl?: string;
}

export const DEFAULT_CARD_CONFIG: SVGCardConfig = {
  text: '',
  backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  textColor: '#ffffff',
  fontSize: 24,
  fontFamily: 'Itim, cursive',
  width: 300,
  height: 400,
  padding: 20,
  textAlign: 'center',
  verticalAlign: 'middle',
  borderRadius: 12,
};

/**
 * Estimates text dimensions for SVG text element
 */
function estimateTextDimensions(text: string, fontSize: number): { width: number; height: number } {
  // Rough estimation based on font metrics
  const avgCharWidth = fontSize * 0.6; // Approximate character width
  const lineHeight = fontSize * 1.2; // Standard line height
  
  const lines = text.split('\n');
  const maxLineLength = Math.max(...lines.map(line => line.length));
  
  return {
    width: maxLineLength * avgCharWidth,
    height: lines.length * lineHeight
  };
}

/**
 * Wraps text to fit within given width
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, break it
        let remainingWord = word;
        while (remainingWord.length > maxCharsPerLine) {
          lines.push(remainingWord.substring(0, maxCharsPerLine));
          remainingWord = remainingWord.substring(maxCharsPerLine);
        }
        currentLine = remainingWord;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Extracts Google Font name from font family string
 */
function extractGoogleFontName(fontFamily: string): string | null {
  // Remove fallbacks and quotes
  const primaryFont = fontFamily.split(',')[0].trim().replace(/["']/g, '');
  
  // Common system fonts that don't need Google Fonts import
  const systemFonts = [
    'Arial', 'Helvetica', 'Times', 'Times New Roman', 'Courier', 'Courier New',
    'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact', 'sans-serif', 'serif', 'monospace',
    'cursive', 'fantasy'
  ];
  
  if (systemFonts.includes(primaryFont)) {
    return null;
  }
  
  return primaryFont;
}

/**
 * Generates SVG string for a card
 */
export function generateCardSVG(config: SVGCardConfig): string {
  const finalConfig = { ...DEFAULT_CARD_CONFIG, ...config };
  const {
    text,
    backgroundColor,
    textColor,
    fontSize,
    fontFamily,
    width,
    height,
    padding,
    textAlign,
    verticalAlign,
    borderRadius,
  } = finalConfig;

  // Use provided fontUrl or extract Google Font name for import
  let fontImport = '';
  if (config.fontUrl) {
    // Use the provided font URL
    fontImport = `@import url('${config.fontUrl}');`;
  } else {
    // Extract Google Font name for import
    const googleFontName = extractGoogleFontName(fontFamily || 'Arial, sans-serif');
    if (googleFontName) {
      // Create Google Fonts import URL
      const fontUrl = `https://fonts.googleapis.com/css2?family=${googleFontName.replace(' ', '+')}:wght@400;700&display=swap`;
      fontImport = `@import url('${fontUrl}');`;
    }
  }

  // Calculate available text area
  const textAreaWidth = (width || 300) - ((padding || 20) * 2);
  const textAreaHeight = (height || 400) - ((padding || 20) * 2);
  
  // Wrap text to fit
  const finalFontSize = fontSize || 24;
  const lines = wrapText(text, textAreaWidth, finalFontSize);
  const lineHeight = finalFontSize * 1.2;
  const totalTextHeight = lines.length * lineHeight;
  
  // Calculate vertical positioning
  let startY: number;
  switch (verticalAlign) {
    case 'top':
      startY = (padding || 20) + (fontSize || 24);
      break;
    case 'bottom':
      startY = (height || 400) - (padding || 20) - totalTextHeight + (fontSize || 24);
      break;
    case 'middle':
    default:
      startY = ((height || 400) - totalTextHeight) / 2 + (fontSize || 24);
      break;
  }
  
  // Calculate horizontal positioning
  let textAnchor: string;
  let x: number;
  switch (textAlign) {
    case 'left':
      textAnchor = 'start';
      x = padding || 20;
      break;
    case 'right':
      textAnchor = 'end';
      x = (width || 300) - (padding || 20);
      break;
    case 'center':
    default:
      textAnchor = 'middle';
      x = (width || 300) / 2;
      break;
  }

  // Create gradient definition or image pattern if needed
  const finalBackgroundColor = backgroundColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const isGradient = finalBackgroundColor.includes('gradient');
  const hasImageUrl = config.imageUrl && config.imageUrl.trim();
  const gradientId = 'cardGradient';
  const imagePatternId = 'cardImagePattern';
  
  let backgroundDef = '';
  let backgroundFill = finalBackgroundColor;
  
  if (hasImageUrl) {
    // Use image as background with optional overlay  
    const finalWidth = width || 300;
    const finalHeight = height || 400;
    backgroundDef = `
    <defs>
      <pattern id="${imagePatternId}" patternUnits="objectBoundingBox" width="1" height="1">
        <image href="${config.imageUrl}" width="${finalWidth}" height="${finalHeight}" preserveAspectRatio="xMidYMid slice" />
      </pattern>
    </defs>`;
    backgroundFill = `url(#${imagePatternId})`;
  } else if (isGradient) {
    // Parse gradient (simplified for common cases)
    const gradientMatch = finalBackgroundColor.match(/linear-gradient\(([^)]+)\)/);
    if (gradientMatch) {
      const gradientContent = gradientMatch[1];
      const parts = gradientContent.split(',').map(s => s.trim());
      
      // Extract direction and colors
      let direction = '135deg';
      let colorStops = parts;
      
      if (parts[0].includes('deg') || parts[0].includes('to ')) {
        direction = parts[0];
        colorStops = parts.slice(1);
      }
      
      // Convert direction to SVG coordinates (simplified)
      let x1 = '0%', y1 = '0%', x2 = '100%', y2 = '100%';
      if (direction.includes('135deg')) {
        x1 = '0%'; y1 = '0%'; x2 = '100%'; y2 = '100%';
      }
      
      const stops = colorStops.map((stop, index) => {
        const colorMatch = stop.match(/(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|[a-zA-Z]+)/);
        const offsetMatch = stop.match(/(\d+)%/);
        
        const color = colorMatch ? colorMatch[1] : '#667eea';
        const offset = offsetMatch ? offsetMatch[1] : (index * 100 / (colorStops.length - 1)).toString();
        
        return `<stop offset="${offset}%" stop-color="${color}" />`;
      }).join('\n        ');
      
      backgroundDef = `
    <defs>
      <linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        ${stops}
      </linearGradient>
    </defs>`;
      backgroundFill = `url(#${gradientId})`;
    }
  }
  
  // Generate text elements (only if text exists)
  const textElements = text && text.trim() ? lines.map((line, index) => {
    const y = startY + (index * lineHeight);
    return `<text x="${x}" y="${y}" font-family="${fontFamily || 'Arial, sans-serif'}" font-size="${fontSize || 24}" fill="${textColor || '#ffffff'}" text-anchor="${textAnchor}">${escapeXml(line)}</text>`;
  }).join('\n    ') : '';

  const finalWidth = width || 300;
  const finalHeight = height || 400;
  const finalBorderRadius = borderRadius || 12;

  return `<svg width="${finalWidth}" height="${finalHeight}" viewBox="0 0 ${finalWidth} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontImport}</style>
  ${backgroundDef}
  <rect width="${finalWidth}" height="${finalHeight}" rx="${finalBorderRadius}" ry="${finalBorderRadius}" fill="${backgroundFill}" />
  <g>
    ${textElements}
  </g>
</svg>`;
}

/**
 * Escapes XML characters in text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts SVG string to data URL
 */
export function svgToDataUrl(svg: string): string {
  const encodedSvg = encodeURIComponent(svg);
  return `data:image/svg+xml,${encodedSvg}`;
}

/**
 * Optimizes font size to fit text in given dimensions
 */
export function optimizeFontSize(text: string, maxWidth: number, maxHeight: number, maxFontSize: number = 96): number {
  let fontSize = maxFontSize;
  const minFontSize = 12;
  
  while (fontSize >= minFontSize) {
    const lines = wrapText(text, maxWidth, fontSize);
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    
    if (totalHeight <= maxHeight) {
      return fontSize;
    }
    
    fontSize--;
  }
  
  return minFontSize;
}
