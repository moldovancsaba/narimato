'use client';

import { motion } from 'framer-motion';
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
  onClick,
}: CardProps & { onClick?: (e: React.MouseEvent) => void }) {

  return (
    <div
onClick={onClick}
    >
      <motion.div
        whileHover={{
          scale: 1.02,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          transition: { type: 'tween', duration: 0.2 },
        }}
        whileTap={{ scale: 0.98 }}
        className="relative rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-800 transition-shadow hover:cursor-pointer"
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
      </motion.div>
    </div>
  );
}
