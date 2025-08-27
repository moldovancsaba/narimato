'use client';

import React, { ReactNode, useMemo } from 'react';
import { useTextFit } from '../hooks/useTextFit';

/**
 * Interface defining the structure of card content data.
 * Supports both text-based and media-based content types.
 */
interface CardContent {
  text?: string;    // Text content for text-type cards
  mediaUrl?: string; // URL for media content (images, videos)
  cardSize: string; // Card size in "width:height" format (e.g., "300:400") - MANDATORY
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
  size?: 'small' | 'medium' | 'large' | 'grid'; // Predefined size variants
  children?: ReactNode;            // Optional overlay content (for interactive elements)
  onClick?: () => void;            // Optional click handler
  style?: React.CSSProperties;     // Optional inline styles for animations/transforms
}

/**
 * BaseCard Component - Universal card container with consistent design
 * 
 * This component serves as the foundation for all card displays throughout the application.
 * It maintains consistent:
 * - Dynamic aspect ratio (configurable per card via cardSize property)
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
 * - VoteCard: <BaseCard {...cardProps} className="cursor-pointer hover:scale-95" />
 * - ResultsCard: <BaseCard {...cardProps} size="small" />
 */
const BaseCard = React.memo(function BaseCard({
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
  
  // Size variants with dynamic aspect ratio - memoized to prevent recreation
  const sizeClasses = useMemo(() => ({
    small: 'w-24 h-32 md:w-40 md:h-56',  // Adjusted for better mobile-first scaling
    medium: '', // Let container context determine appropriate constraints
    large: '',  // Let container context determine appropriate constraints
    grid: 'w-full h-full'  // Grid size fills container without aspect ratio constraints
  }), []);

  // Memoize className calculation to prevent unnecessary re-renders
  // Always apply card-container class for consistent styling (border radius, shadows, etc.)
  const containerClassName = useMemo(() => `
    ${sizeClasses[size]}
    card-container
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `, [sizeClasses, size, onClick, className]);

const [width, height] = useMemo(() => {
    if (!content.cardSize) {
      console.error('🚨 CRITICAL: Card missing cardSize property!', {
        type: type,
        hasMediaUrl: !!content.mediaUrl,
        hasText: !!content.text
      });
      return [null, null]; // No aspect ratio constraint
    }
    return content.cardSize.split(':');
  }, [content.cardSize, type, content.mediaUrl, content.text]);

  const cardStyle = useMemo(() => {
    const baseStyle = {...style};
    if (width && height) {
      baseStyle.aspectRatio = `${width} / ${height}`;
    }
    // NO DEFAULT ASPECT RATIO - Every card MUST have cardSize property!
    return baseStyle;
  }, [style, width, height]);

  return (
    <div
      className={containerClassName}
      onClick={onClick}
      style={cardStyle}
    >
      {/* Main card content area */}
      {type === 'media' && content.mediaUrl ? (
        <img
          src={content.mediaUrl}
          alt="Card content"
          className="card-media card-no-select"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            const container = img.closest('.card-container') as HTMLElement;
            if (container && img.naturalWidth && img.naturalHeight) {
              const aspectRatio = img.naturalWidth / img.naturalHeight;
              container.style.aspectRatio = aspectRatio.toString();
            }
          }}
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
});

export default BaseCard;
