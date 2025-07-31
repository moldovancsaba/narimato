'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const getCardWidth = (width: number) => {
  if (width >= 768) return 320; // sm:max-w-sm
  if (width >= 640) return 288; // max-w-xs
  return 256; // Fallback for smaller screens
};

export const useCardSize = () => {
  const [cardWidth, setCardWidth] = useState(256);

  // Memoize the resize handler to prevent recreation on every render
  const handleResize = useCallback(() => {
    setCardWidth(getCardWidth(window.innerWidth));
  }, []);

  useEffect(() => {

    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [handleResize]);

  // Memoize the return object to prevent unnecessary re-renders in consumers
  return useMemo(() => ({
    cardWidth,
    cardHeight: cardWidth / 0.75
  }), [cardWidth]);
};
