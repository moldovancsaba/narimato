'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn, getComponentTheme, cssVar } from '@/lib/theme/utils';
import useInteractionAnimations from '@/hooks/useInteractionAnimations';
import { ICard } from '@/models/Card';
import { CardContainer } from './CardContainer';

interface SwipeControllerProps {
  cards: Array<{
    id: string;
    title: string;
    content: string;
    type: 'text' | 'image';
    order: number;
  }>;
  onSwipe: (cardId: string, direction: 'left' | 'right') => void;
  projectSlug: string;
  className?: string;
}

export function SwipeController({
  cards,
  onSwipe,
  projectSlug,
  className,
}: SwipeControllerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentCard = cards[currentIndex];
  // Get theme configuration
  const cardTheme = getComponentTheme('card');
  const badgeTheme = getComponentTheme('badge');
const handleSwipe = (direction: 'left' | 'right') => {
    if (!currentCard) return;
    
    onSwipe(currentCard.id, direction);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Add keyboard event listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!currentCard) return;
      
      if (e.key === 'ArrowLeft') {
        onSwipe(currentCard.id, 'left');
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowRight') {
        onSwipe(currentCard.id, 'right');
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentCard, currentIndex, cards.length, onSwipe]);

if (!currentCard) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <p className="text-lg text-gray-500 dark:text-gray-400">
          No more cards to show
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[min(100vw,500px)] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">{currentCard.title}</h2>
        {currentCard.type === 'image' ? (
          <img
            src={currentCard.content}
            alt={currentCard.title}
            className="w-full h-auto object-contain rounded"
          />
        ) : (
          <p className="text-gray-600 dark:text-gray-300">{currentCard.content}</p>
        )}
      </div>
      <div className="mt-4 space-x-2">
        <button
          onClick={() => handleSwipe('left')}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => handleSwipe('right')}
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
