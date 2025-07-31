'use client';

import { useState, useEffect, useCallback } from 'react';

export function useOrientation() {
  const [orientation, setOrientation] = useState('portrait');

  // Memoize getOrientation function to prevent recreation
  const getOrientation = useCallback(() => {
    return window.matchMedia("(orientation: portrait)").matches ? 'portrait' : 'landscape';
  }, []);

  // Memoize handleResize to prevent unnecessary event listener updates
  const handleResize = useCallback(() => {
    setOrientation(getOrientation());
  }, [getOrientation]);

  useEffect(() => {

    if (typeof window !== 'undefined') {
      setOrientation(getOrientation());
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [handleResize, getOrientation]);

  return orientation;
}

