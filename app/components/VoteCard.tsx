'use client';

import React from 'react';
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
  // Removed all animations and opacity changes for clean appearance

  return (
    <div 
      className="card-container transition-all duration-300 ease-out hover:border-white vote-card-fade"
      key={uuid} // Force re-render when card changes for fade effect
    >
      <BaseCard
        uuid={uuid}
        type={type}
        content={content}
        onClick={onSelect}
        size="grid"  // Use grid size to avoid aspect ratio conflicts
        className=""
      />
    </div>
  );
});

export default VoteCard;
