'use client';

import { useState, useEffect } from 'react';

export function useOrientation() {
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const getOrientation = () => {
      return window.matchMedia("(orientation: portrait)").matches ? 'portrait' : 'landscape';
    };

    const handleResize = () => {
      setOrientation(getOrientation());
    };

    if (typeof window !== 'undefined') {
      setOrientation(getOrientation());
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return orientation;
}

