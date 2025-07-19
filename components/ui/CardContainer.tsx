'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
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
  id?: string;
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
  id,
}: CardContainerProps) {
  const Container = isInteractive ? motion.div : 'div';

  return (
    <div
      className={`card-grid-item ${containerClassName} ${isInteractive ? 'cursor-pointer' : ''}`}
      data-type={type}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyPress={(e) => e.key === 'Enter' && onClick?.()}
    >
      <Container
        className={`card ${className}`}
        data-variant={isInteractive ? 'interactive' : 'default'}
        {...(isInteractive && {
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 },
          transition: { type: 'spring', stiffness: 400, damping: 17 }
        })}
      >
        {/* Card Content */}
        <div className="card-content" data-type={type}>
          {type === 'image' ? (
            <Image
              src={content}
              alt={imageAlt || title}
              width={500}
              height={375}
              priority
            />
          ) : (
            <>
              <h3 className="text-[var(--text-xl)] font-semibold text-[var(--card-foreground)]">
                {title}
              </h3>
              {description && (
                <p className="text-[var(--text-base)] text-[var(--card-foreground)]/70">
                  {description}
                </p>
              )}
              <p className="text-[var(--text-base)] text-[var(--card-foreground)] flex-grow">
                {content}
              </p>
            </>
          )}

          {/* Edit button */}
          {id && (
            <div className="mt-2">
              <Link
                href={`/cards/${id}/edit`}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Edit Card
              </Link>
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
