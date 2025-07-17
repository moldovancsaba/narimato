'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn, getComponentTheme, cssVar } from '@/lib/theme/utils';
import useInteractionAnimations from '@/hooks/useInteractionAnimations';
import { ICard } from '@/models/Card';
import { CardContainer } from './CardContainer';

interface SwipeControllerProps {
  card: ICard;
  onSwipe: (direction: 'left' | 'right') => void;
  likeCount: number;
  totalLikesNeeded?: number;
  className?: string;
}

export default function SwipeController({
  card,
  onSwipe,
  likeCount,
  totalLikesNeeded = 1,
  className,
}: SwipeControllerProps) {
  // Get theme configuration
  const cardTheme = getComponentTheme('card');
  const badgeTheme = getComponentTheme('badge');
  const {
    isDragging,
    swipeConfig,
    handleKeyDown,
  } = useInteractionAnimations({
    onSwipe,
  });

  // Add keyboard event listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onSwipe('left');
      } else if (e.key === 'ArrowRight') {
        onSwipe('right');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onSwipe]);

return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      className={cn(
        // Base styles
        'w-[min(100vw,500px)]',
        cardTheme.base.background,
        cardTheme.base.borderRadius,
        cardTheme.base.transition,
        // Interactive states
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        // Card shadow
        `shadow-[${cssVar('shadow-md')}]`,
        // Custom classes
        className
      )}
      role="button"
      tabIndex={0}
      aria-label={`Card: ${card.title}. Use arrow keys to vote. ${likeCount} out of ${totalLikesNeeded} likes needed.`}
    >
      <CardContainer
        type={card.type}
        content={card.content}
        title={card.title}
        description={card.description}
        imageAlt={card.imageAlt}
        hashtags={card.hashtags}
        createdAt={typeof card.createdAt === 'string' ? card.createdAt : card.createdAt.toISOString()}
        updatedAt={typeof card.updatedAt === 'string' ? card.updatedAt : card.updatedAt.toISOString()}
        extraContent={
<div className={cn(
            // Positioning
            'absolute',
            `top-[${cssVar('space-2')}]`,
            `right-[${cssVar('space-2')}]`,
            // Badge styles
            badgeTheme.base,
            badgeTheme.variants.primary,
            // Additional styling
            `text-[${cssVar('text-sm')}]`
          )}>
            {likeCount}/{totalLikesNeeded} Likes
          </div>
        }
      />
    </motion.div>
  );
}
