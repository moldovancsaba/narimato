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

      // Reset font size to start measurement
      element.style.fontSize = `${maxFontSize}px`;
      element.style.whiteSpace = 'nowrap';

      let fontSize = maxFontSize;
      let fits = false;

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
          // Text fits in one line at this size
          fits = true;
          min = fontSize + 1;
        } else {
          // Text doesn't fit, try smaller size or allow wrapping
          element.style.whiteSpace = 'normal';
          const wrappedWidth = element.scrollWidth;
          const wrappedHeight = element.scrollHeight;

          if (wrappedWidth <= availableWidth && wrappedHeight <= availableHeight) {
            // Text fits with wrapping
            fits = true;
            min = fontSize + 1;
          } else {
            // Text doesn't fit even with wrapping
            max = fontSize - 1;
            fits = false;
          }
        }
      }

      // Apply the final font size
      fontSize = max;
      element.style.fontSize = `${fontSize}px`;
      
      // Determine if we need wrapping
      element.style.whiteSpace = 'nowrap';
      if (element.scrollWidth > availableWidth || element.scrollHeight > availableHeight) {
        element.style.whiteSpace = 'normal';
      }

      // Final verification - if still doesn't fit, reduce size
      let attempts = 0;
      while ((element.scrollWidth > availableWidth || element.scrollHeight > availableHeight) 
             && fontSize > minFontSize && attempts < 10) {
        fontSize = Math.max(fontSize - 2, minFontSize);
        element.style.fontSize = `${fontSize}px`;
        attempts++;
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
