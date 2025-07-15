'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ReactNode } from 'react';

interface CardContainerProps {
  type: 'image' | 'text';
  content: string;
  title: string;
  description?: string;
  imageAlt?: string;
  hashtags?: string[];
  createdAt?: string;
  updatedAt?: string;
  className?: string;
  onClick?: () => void;
  isInteractive?: boolean;
  extraContent?: ReactNode;
  containerClassName?: string;
}

export function CardContainer({
  type,
  content,
  title,
  description,
  imageAlt,
  hashtags = [],
  createdAt,
  updatedAt,
  className = '',
  onClick,
  isInteractive = true,
  extraContent,
  containerClassName = '',
}: CardContainerProps) {
  const Container = isInteractive ? motion.div : 'div';

  return (
    <div 
      className={`w-[min(100vw,500px)] ${containerClassName}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Container
        className={`relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-lg ${className}`}
        {...(isInteractive && {
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 },
          transition: { type: 'spring', stiffness: 400, damping: 17 }
        })}
      >
        {/* Card Content */}
        <div className={`${type === 'text' ? 'aspect-[3/4]' : ''} relative`}
        >
          {type === 'image' ? (
            <div className="relative aspect-auto">
              <Image
                src={content}
                alt={imageAlt || title}
                width={500}
                height={375}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          ) : (
            <div className="p-6 flex flex-col h-full">
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                {title}
              </h3>
              {description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {description}
                </p>
              )}
              <p className="text-gray-800 dark:text-gray-200 flex-grow">
                {content}
              </p>
            </div>
          )}

          {/* Extra content (like voting buttons, stats, etc.) */}
          {extraContent}
        </div>

        {/* Card Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Timestamps */}
          {(createdAt || updatedAt) && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {createdAt && (
                <span>Created: {new Date(createdAt).toLocaleDateString()}</span>
              )}
              {createdAt && updatedAt && createdAt !== updatedAt && (
                <span className="mx-2">•</span>
              )}
              {updatedAt && createdAt !== updatedAt && (
                <span>Updated: {new Date(updatedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
