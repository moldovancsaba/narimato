/**
 * Responsive Design Utilities
 * A collection of hooks and helper functions for handling responsive design
 */

import { useState, useEffect } from 'react';

// Breakpoint definitions (matching Tailwind's default breakpoints)
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// Type for breakpoint keys
export type Breakpoint = keyof typeof breakpoints;

/**
 * Hook to detect current breakpoint
 * Returns the current active breakpoint based on window width
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('sm');

  useEffect(() => {
    // Handler to call on window resize
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width >= breakpoints['2xl']) {
        setBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setBreakpoint('md');
      } else {
        setBreakpoint('sm');
      }
    };

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}

/**
 * Hook to detect if the screen is currently mobile-sized
 * Returns true if the screen width is below the md breakpoint
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoints.md);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

/**
 * Hook to get dimensions of a specific element
 * Useful for responsive calculations based on container size
 */
export function useElementSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * Utility function to get responsive value based on breakpoint
 * Accepts an object with breakpoint keys and returns the appropriate value
 */
export function getResponsiveValue<T>(
  values: Partial<Record<Breakpoint, T>>,
  currentBreakpoint: Breakpoint
): T | undefined {
  const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm'];
  const breakpointIndex = breakpointOrder.indexOf(currentBreakpoint);

  // Find the first defined value starting from the current breakpoint and going down
  for (let i = breakpointIndex; i < breakpointOrder.length; i++) {
    const value = values[breakpointOrder[i]];
    if (value !== undefined) {
      return value;
    }
  }

  // If no value is found, return the smallest defined breakpoint
  for (let i = breakpointOrder.length - 1; i >= 0; i--) {
    const value = values[breakpointOrder[i]];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}
