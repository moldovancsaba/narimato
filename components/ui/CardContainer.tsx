import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * CardContainer Component - Responsive wrapper for Card components
 * 
 * This component follows the Card UI Rules from narimato.md:
 * - Provides external styling control for cards
 * - Uses adaptive width with min(100vw, 500px)
 * - Handles aspect ratios (3:4 for text, original for images)
 * - Mobile-first, responsive design
 * - Uses global CSS only
 */

interface CardContainerProps {
  /** The Card component to be wrapped */
  children: ReactNode;
  /** Type of card being contained - determines aspect ratio handling */
  cardType: 'image' | 'text';
  /** Optional additional classes for custom styling */
  className?: string;
  /** Whether the card is being shown in voting mode */
  isVoting?: boolean;
  /** Whether the card is being shown in swipe mode */
  isSwipe?: boolean;
  /** Whether the card is part of a list view */
  isList?: boolean;
}

/**
 * CardContainer component that handles the responsive layout and styling
 * of Card components across different view contexts (swipe, vote, list).
 */
export function CardContainer({
  children,
  cardType,
  className,
  isVoting = false,
  isSwipe = false,
  isList = false,
}: CardContainerProps) {
  return (
    <div
      className={cn(
        // Base container styles
        'relative w-[min(100vw,500px)]',
        // Apply fixed aspect ratio for text cards
        cardType === 'text' && 'aspect-[3/4]',
        // Context-specific styles
        isVoting && 'cursor-pointer hover:scale-105 transition-transform',
        isSwipe && 'touch-none select-none',
        isList && 'max-w-full md:max-w-[300px]',
        // Custom classes from parent
        className
      )}
    >
      {children}
    </div>
  );
}
