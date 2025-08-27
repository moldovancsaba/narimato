'use client';

import { useEffect, useRef, RefObject } from 'react';

/**
 * Custom hook for automatic text scaling using "contain" behavior
 * 
 * This hook implements true text scaling that:
 * - Scales text to the largest possible size that fits entirely within the container
 * - Preserves the container's aspect ratio
 * - Ensures no part of the text is cut off
 * - Works responsively across different screen sizes
 * 
 * @param text - The text content to scale
 * @param maxFontSize - Maximum font size in pixels (default: 120)
 * @param minFontSize - Minimum font size in pixels (default: 16)
 * @returns RefObject to attach to the text element
 */
export function useTextFit(
  text: string, 
  maxFontSize: number = 120, 
  minFontSize: number = 16
): RefObject<HTMLDivElement> {
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fitText = () => {
      const element = textRef.current;
      if (!element || !text.trim()) return;

      const container = element.parentElement;
      if (!container) return;

      // Get container dimensions (accounting for padding)
      const containerRect = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);
      const paddingLeft = parseFloat(containerStyle.paddingLeft);
      const paddingRight = parseFloat(containerStyle.paddingRight);
      const paddingTop = parseFloat(containerStyle.paddingTop);
      const paddingBottom = parseFloat(containerStyle.paddingBottom);

      const availableWidth = containerRect.width - paddingLeft - paddingRight;
      const availableHeight = containerRect.height - paddingTop - paddingBottom;

      if (availableWidth <= 0 || availableHeight <= 0) return;

      // Start with a reasonable font size for binary search
      let fontSize = minFontSize;
      let bestFontSize = minFontSize;

      // Binary search for optimal font size
      let min = minFontSize;
      let max = maxFontSize;

      while (min <= max) {
        fontSize = Math.floor((min + max) / 2);
        element.style.fontSize = `${fontSize}px`;

        // Check if text fits in one line
        element.style.whiteSpace = 'nowrap';

        const singleLineWidth = element.scrollWidth;
        const singleLineHeight = element.scrollHeight;

        if (singleLineWidth <= availableWidth && singleLineHeight <= availableHeight) {
          // Single line fits perfectly - this is ideal
          bestFontSize = fontSize;
          min = fontSize + 1;
        } else {
          // Single line doesn't fit, try with wrapping
          element.style.whiteSpace = 'normal';
          const wrappedWidth = element.scrollWidth;
          const wrappedHeight = element.scrollHeight;

          if (wrappedWidth <= availableWidth && wrappedHeight <= availableHeight) {
            // Wrapped text fits
            bestFontSize = fontSize;
            min = fontSize + 1;
          } else {
            // Even wrapped doesn't fit
            max = fontSize - 1;
          }
        }
      }

      // Apply the best font size found
      element.style.fontSize = `${bestFontSize}px`;

      // Determine if wrapping is necessary
      element.style.whiteSpace = 'nowrap';

      if (element.scrollWidth > availableWidth || element.scrollHeight > availableHeight) {
        element.style.whiteSpace = 'normal';
      }

      // Safety check - if still overflowing, force smaller size
      let safetyAttempts = 0;
      while ((element.scrollWidth > availableWidth || element.scrollHeight > availableHeight) 
             && bestFontSize > minFontSize && safetyAttempts < 5) {
        bestFontSize = Math.max(bestFontSize - 2, minFontSize);
        element.style.fontSize = `${bestFontSize}px`;
        safetyAttempts++;
      }
    };

    // Initial fit
    fitText();

    // Create ResizeObserver for responsive scaling
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(fitText);
    });

    if (textRef.current?.parentElement) {
      resizeObserver.observe(textRef.current.parentElement);
    }

    // Handle window resize as fallback
    const handleResize = () => {
      requestAnimationFrame(fitText);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [text, maxFontSize, minFontSize]);

  return textRef;
}
