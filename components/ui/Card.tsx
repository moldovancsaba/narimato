'use client';

import React from 'react';
import { cn, cssVar, getComponentTheme } from '@/lib/theme/utils';

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
  // Get theme configuration for card component
  const cardTheme = getComponentTheme('card');
  const typography = getComponentTheme('typography');

  return (
    <div 
      onClick={onClick}
      className={cn(
        // Base styles
        'w-full h-full overflow-hidden',
        cardTheme.base.background,
        cardTheme.base.borderRadius,
        cardTheme.base.transition,
        // Variant styles
        isInteractive && 'cursor-pointer hover:shadow-md hover:border-primary',
        // Custom classes
        className
      )}
    >
      {type === 'image' && (
        <div className="relative aspect-square w-full">
          <img
            src={content}
            alt={imageAlt || title}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className={cardTheme.base.padding}>
        <h3 className={cn(
          typography.h4,
          `mb-${cssVar('space-2')}`,
          `text-${cssVar('card-foreground')}`
        )}>
          {title}
        </h3>
        {description && (
          <p className={cn(
            typography.p,
            `text-${cssVar('card-foreground')}/70`,
            `mb-${cssVar('space-4')}`
          )}>
            {description}
          </p>
        )}
        {type === 'text' && (
          <p className={cn(
            typography.p,
            `text-${cssVar('card-foreground')}`,
            `mb-${cssVar('space-4')}`
          )}>
            {content}
          </p>
        )}
        {hashtags.length > 0 && (
          <div className={cn(
            'flex flex-wrap',
            `gap-${cssVar('space-2')}`
          )}>
            {hashtags.map(tag => (
              <span
                key={tag}
                className={cn(
                  `px-${cssVar('space-2')} py-${cssVar('space-1')}`,
                  typography.small,
                  `rounded-${cssVar('radius-full')}`,
                  `bg-${cssVar('card-background')}/10`,
                  `text-${cssVar('card-foreground')}/70`
                )}
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
