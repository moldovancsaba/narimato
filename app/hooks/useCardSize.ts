'use client';

import { useState, useEffect } from 'react';

const getCardWidth = (width: number) => {
  if (width >= 768) return 320; // sm:max-w-sm
  if (width >= 640) return 288; // max-w-xs
  return 256; // Fallback for smaller screens
};

export const useCardSize = () => {
  const [cardWidth, setCardWidth] = useState(256);

  useEffect(() => {
    const handleResize = () => {
      setCardWidth(getCardWidth(window.innerWidth));
    };

    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return { cardWidth, cardHeight: cardWidth / 0.75 };
};
