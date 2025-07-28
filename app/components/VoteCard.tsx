'use client';

import { motion } from 'framer-motion';

/**
 * Interface defining the structure of card content data.
 * Mirrors the SwipeCard content structure for consistency.
 */
interface CardContent {
  text?: string;    // Text content for text-type cards
  mediaUrl?: string; // URL for media content (images, videos)
}

/**
 * Props interface for the VoteCard component.
 * Used in the comparison/voting phase where users choose between two cards.
 */
interface VoteCardProps {
  uuid: string;                    // Unique identifier for the card
  type: 'text' | 'media';        // Content type determines rendering approach
  content: CardContent;           // The actual content to display
  title?: string;                 // Optional title overlay
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
 * - Smooth animation states for selection feedback
 * - Position-aware styling (left/right in comparison layout)
 * - Consistent rendering with SwipeCard component
 * - Hover effects for improved user experience
 * 
 * Implementation follows the ranking specification:
 * - Cards are presented side-by-side for comparison
 * - Visual feedback clearly indicates selection state
 * - Same content rendering logic as SwipeCard for consistency
 */
export default function VoteCard({
  type,
  content,
  title,
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
  const variants = {
    initial: {
      scale: 1,      // Normal size
      opacity: 1     // Full opacity
    },
    selected: {
      scale: 1.05,   // Slightly enlarged to show selection
      opacity: 1     // Full opacity for emphasis
    },
    unselected: {
      scale: 0.95,   // Slightly smaller to de-emphasize
      opacity: 0.7   // Reduced opacity to show it's not selected
    }
  };

  return (
    <motion.div
      initial="initial"
      animate={isSelected ? "selected" : isSelected === false ? "unselected" : "initial"}
      variants={variants}
      whileHover={{ scale: 1.02 }}
      onClick={onSelect}
      className={`w-full max-w-md aspect-[3/4] bg-white rounded-xl shadow-xl cursor-pointer
        ${position === 'left' ? 'mr-4' : 'ml-4'}`}
    >
      {type === 'text' && content.text ? (
        <div className="h-full p-6 flex flex-col">
          {title && (
            <h2 className="text-xl font-bold mb-4">{title}</h2>
          )}
          <p className="text-lg flex-grow">{content.text}</p>
        </div>
      ) : type === 'media' && content.mediaUrl ? (
        <div className="h-full relative">
          <img
            src={content.mediaUrl}
            alt={title || 'Card content'}
            className="w-full h-full object-cover rounded-xl"
          />
          {title && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
              <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500">
          <p>Content not available</p>
        </div>
      )}
    </motion.div>
  );
}
