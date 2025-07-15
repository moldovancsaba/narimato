'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import Image from 'next/image';

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
  onSwipe?: (direction: 'left' | 'right') => void;
  isSwipeable?: boolean;
}

export function Card({
  type,
  content,
  title,
  description,
  hashtags,
  imageAlt,
  createdAt,
  updatedAt,
  onSwipe,
  isSwipeable = false,
  onClick,
}: CardProps & { onClick?: (e: React.MouseEvent) => void }) {
  const controls = useAnimation();
  const [isDragging, setIsDragging] = useState(false);

  const handleSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      if (!isSwipeable || !onSwipe) return;

      const xOffset = direction === 'left' ? -200 : 200;
      await controls.start({
        x: xOffset,
        opacity: 0,
        transition: { duration: 0.3 },
      });
      onSwipe(direction);
      await controls.start({ x: 0, opacity: 1 });
    },
    [isSwipeable, onSwipe, controls]
  );

  useEffect(() => {
    if (!isSwipeable) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handleSwipe('left');
          break;
        case 'ArrowRight':
          handleSwipe('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isSwipeable, handleSwipe]);

  const handleDragEnd = (_: any, { offset: { x }, velocity: { x: vx } }: PanInfo) => {
    setIsDragging(false);
    const direction = x + vx * 100 > 0 ? 'right' : 'left';
    handleSwipe(direction);
  };

  return (
    <div
onClick={(e) => {
        if (!isDragging && onClick) {
          onClick(e);
        }
      }}
    >
      <motion.div
        animate={controls}
        drag={isSwipeable ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        whileHover={isSwipeable ? undefined : {
          scale: 1.02,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          transition: { type: 'tween', duration: 0.2 },
        }}
        whileTap={isSwipeable ? undefined : { scale: 0.98 }}
        className={`relative rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-800 transition-shadow hover:cursor-pointer ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {type === 'image' && (
          <div className="relative h-48 md:h-64">
            <Image
              src={content}
              alt={imageAlt || title}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}

        <div className="p-4">
          <h3 className="text-xl font-semibold mb-2">{title}</h3>
          {description && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">{description}</p>
          )}
          {type === 'text' && (
            <p className="text-gray-800 dark:text-gray-200 mb-4">{content}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Created: {new Date(createdAt).toLocaleDateString()}
            {createdAt !== updatedAt && (
              <> • Updated: {new Date(updatedAt).toLocaleDateString()}</>
            )}
          </div>
        </div>

        {isSwipeable && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/50 to-transparent text-white text-center">
            <p>← Swipe left to skip | Swipe right to like →</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
