'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import BaseCard from './BaseCard';

/**
 * Interface defining the structure of card content data.
 * Mirrors the SwipeCard content structure for consistency.
 */
interface CardContent {
  text?: string;    // Text content for text-type cards
  mediaUrl?: string; // URL for media content (images, videos)
};

/**
 * Props interface for the VoteCard component.
 * Used in the comparison/voting phase where users choose between two cards.
 */
interface VoteCardProps {
  uuid: string;                    // Unique identifier for the card
  type: 'text' | 'media';        // Content type determines rendering approach
  content: CardContent;           // The actual content to display
  position: 'left' | 'right';    // Card position in comparison layout
  onSelect: () => void;           // Callback when card is selected in comparison
  isSelected?: boolean;           // Current selection state for visual feedback
}

/**
 * VoteCard Component - Interactive card for comparison/voting phase
 * 
 * This component renders cards during the binary search ranking process
 * where users compare the new card against existing ranked cards.
 * 
 * Key features:
 * - Uses universal BaseCard component for consistent design
 * - Smooth animation states for selection feedback
 * - Position-aware styling (left/right in comparison layout)
 * - Hover effects for improved user experience
 * 
 * Implementation follows the ranking specification:
 * - Cards are presented side-by-side for comparison
 * - Visual feedback clearly indicates selection state
 * - Same content rendering logic as SwipeCard for consistency
 */
const VoteCard = React.memo(function VoteCard({
  uuid,
  type,
  content,
  position,
  onSelect,
  isSelected
}: VoteCardProps) {
  /**
   * Animation variants for Framer Motion state transitions.
   * 
   * States:
   * - initial: Default state when no selection has been made
   * - selected: Visual emphasis when this card is chosen
   * - unselected: Subdued appearance when other card is chosen
   * 
   * Scale and opacity changes provide clear visual hierarchy
   * without being distracting during the comparison process.
   */
  // Memoize constants and variants to prevent unnecessary re-creations
  const scaleValues = useMemo(() => ({
    SCALE_INITIAL: 1,
    SCALE_SELECTED: 0.95,
    SCALE_UNSELECTED: 0.9,
    SCALE_HOVER: 0.95
  }), []);

  const variants = useMemo(() => ({
    initial: {
      scale: scaleValues.SCALE_INITIAL,
      opacity: 1
    },
    selected: {
      scale: scaleValues.SCALE_SELECTED,
      opacity: 1
    },
    unselected: {
      scale: scaleValues.SCALE_UNSELECTED,
      opacity: 0.7
    }
  }), [scaleValues]);

  return (
    <motion.div
      initial="initial"
      animate={isSelected ? "selected" : isSelected === false ? "unselected" : "initial"}
      variants={variants}
      whileHover={{ scale: scaleValues.SCALE_HOVER }} // Use global scale constant for hover
      whileTap={{ scale: 0.9 }} // Scale down when tapped/clicked
      className="card-container"
    >
      <BaseCard
        uuid={uuid}
        type={type}
        content={content}
        onClick={onSelect}
        size="grid"  // Use grid size to avoid aspect ratio conflicts
        className="hover:shadow-xl transition-shadow duration-200"
      />
    </motion.div>
  );
});

export default VoteCard;
