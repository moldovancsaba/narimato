'use client';

import React from 'react';

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
}

export function Card({
  type,
  content,
  title,
  description,
  hashtags,
  imageAlt,
  onClick
}: CardProps) {
  return (
    <div 
      onClick={onClick}
      className="w-full h-full rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-800"
    >
      {type === 'image' && (
        <div className="w-full aspect-square relative">
          <img
            src={content}
            alt={imageAlt || title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {description}
          </p>
        )}
        {type === 'text' && (
          <p className="text-gray-800 dark:text-gray-200 mb-4">
            {content}
          </p>
        )}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hashtags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
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
