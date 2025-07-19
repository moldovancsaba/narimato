'use client';

import React from 'react';

/**
 * Interface for Card component props
 * Defines the structure and types for all possible card configurations
 */
interface CardProps {
  type: 'image' | 'text';
  content: string;
  title: string;
  description?: string;
  slug: string;
  hashtags: string[];
  translationKey?: string;
  imageAlt?: string;
  createdAt: string;
  updatedAt: string;
  onClick?: () => void;
isInteractive?: boolean;
  variant?: 'default' | 'elevated';
  className?: string;
}

/**
 * Card Component
 * A versatile card component that supports both image and text content
 * using the global design system for consistent styling
 */
export function Card({
  type,
  content,
  title,
  description,
  hashtags,
  imageAlt,
  onClick,
  isInteractive,
  variant = 'default',
  className
}: CardProps) {
  return (
    <div 
      onClick={onClick}
      className={`card ${variant === 'elevated' ? 'shadow-md' : ''} ${
        isInteractive ? 'hover:shadow-lg transition-shadow' : ''
      } ${className || ''}`}
    >
      {/* Image Container */}
      {type === 'image' && (
        <div className="relative aspect-square w-full overflow-hidden">
          <img
            src={content}
            alt={imageAlt || title}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      
      {/* Content Container */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-xl font-semibold mb-2">
          {title}
        </h3>
        
        {/* Description */}
        {description && (
          <p className="text-base text-foreground/70 mb-4">
            {description}
          </p>
        )}
        
        {/* Text Content */}
        {type === 'text' && (
          <p className="text-base mb-4">
            {content}
          </p>
        )}
        
        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hashtags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-sm rounded-full bg-foreground/10 text-foreground/70"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
