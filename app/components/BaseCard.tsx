'use client';

import { ReactNode } from 'react';
import { useTextFit } from '../hooks/useTextFit';

/**
 * Interface defining the structure of card content data.
 * Supports both text-based and media-based content types.
 */
interface CardContent {
  text?: string;    // Text content for text-type cards
  mediaUrl?: string; // URL for media content (images, videos)
}

/**
 * Props interface for the BaseCard component.
 * This is the universal card container used across the entire application.
 */
interface BaseCardProps {
  uuid?: string;                    // Unique identifier for the card
  type: 'text' | 'media';         // Content type determines rendering approach
  content: CardContent;            // The actual content to display
  className?: string;              // Additional CSS classes for container
  size?: 'small' | 'medium' | 'large'; // Predefined size variants
  children?: ReactNode;            // Optional overlay content (for interactive elements)
  onClick?: () => void;            // Optional click handler
  style?: React.CSSProperties;     // Optional inline styles for animations/transforms
}

/**
 * BaseCard Component - Universal card container with consistent design
 * 
 * This component serves as the foundation for all card displays throughout the application.
 * It maintains consistent:
 * - Aspect ratio (3:4 - portrait orientation)
 * - Visual design (rounded corners, shadows, typography)
 * - Content layout rules (text centering, media fitting)
 * - Responsive behavior (scales while maintaining proportions)
 * 
 * The component follows the Card Display Rules from the documentation:
 * - Text Cards: Use object-fit: contain - Scale text to fit without cropping
 * - Media Cards: Use object-fit: cover - Fill container completely
 * 
 * Usage Examples:
 * - SwipeCard: <BaseCard {...cardProps} className="absolute cursor-grab" />
 * - VoteCard: <BaseCard {...cardProps} className="cursor-pointer hover:scale-105" />
 * - ResultsCard: <BaseCard {...cardProps} size="small" />
 */
export default function BaseCard({
  type,
  content,
  className = '',
  size = 'medium',
  children,
  onClick,
  style
}: BaseCardProps) {
  
  // Use text fitting hook for automatic scaling of text content
  const textRef = useTextFit(
    content.text || '', 
    size === 'small' ? 40 : size === 'large' ? 160 : 120, // Max font size based on card size
    size === 'small' ? 8 : 16 // Min font size based on card size
  );
  
  // Size variants with consistent aspect ratio (3:4)
  const sizeClasses = {
    small: 'w-24 h-32 md:w-40 md:h-56',  // Adjusted for better mobile-first scaling
    medium: 'w-full max-w-sm sm:max-w-md aspect-[3/4]', // Default size with mobile-first adjustments
    large: 'w-full max-w-md md:max-w-lg aspect-[3/4]'   // Large display with consistent scaling
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        card-container
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      style={style}
    >
      {/* Main card content area */}
      {type === 'media' && content.mediaUrl ? (
        <img
          src={content.mediaUrl}
          alt="Card content"
          className="card-media"
        />
      ) : (
        <div className="card-content">
          {type === 'text' && content.text ? (
            <div ref={textRef} className="card-text">
              {content.text}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-center">
              <p>Content not available</p>
            </div>
          )}
        </div>
      )}
      
      {/* Optional overlay content (for interactive elements, badges, etc.) */}
      {children}
    </div>
  );
}
