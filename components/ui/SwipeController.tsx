'use client';

import { useState, useEffect } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { ICard } from '@/models/Card';
import { CardContainer } from './CardContainer';

interface SwipeControllerProps {
  card: ICard;
  onSwipe: (direction: 'left' | 'right') => void;
  likeCount: number;
  totalLikesNeeded?: number;
}

export default function SwipeController({
  card,
  onSwipe,
  likeCount,
  totalLikesNeeded = 1,
}: SwipeControllerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handleSwipe('left');
      } else if (e.key === 'ArrowRight') {
        handleSwipe('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSwipe = async (direction: 'left' | 'right') => {
    const distance = direction === 'left' ? -200 : 200;
    await controls.start({
      x: distance,
      opacity: 0,
      transition: { duration: 0.5 },
    });
    onSwipe(direction);
  };

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const threshold = 100;
    const direction = info.offset.x > threshold ? 'right' : info.offset.x < -threshold ? 'left' : null;

    if (direction) {
      await handleSwipe(direction);
    } else {
      controls.start({ x: 0, opacity: 1 });
    }
    setIsDragging(false);
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      animate={controls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      className={`card-container ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      role="button"
      tabIndex={0}
      aria-label={`Card: ${card.title}. Use arrow keys to vote. ${likeCount} out of ${totalLikesNeeded} likes needed.`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          handleSwipe('left');
        } else if (e.key === 'ArrowRight') {
          handleSwipe('right');
        }
      }}
    >
      <CardContainer
        type={card.type}
        content={card.content}
        title={card.title}
        description={card.description}
        imageAlt={card.imageAlt}
        hashtags={card.hashtags}
        createdAt={typeof card.createdAt === 'string' ? card.createdAt : card.createdAt.toISOString()}
        updatedAt={typeof card.updatedAt === 'string' ? card.updatedAt : card.updatedAt.toISOString()}
        extraContent={
          <div className="absolute top-2 right-2 bg-primary/90 text-white px-3 py-1 rounded-full text-sm">
            {likeCount}/{totalLikesNeeded} Likes
          </div>
        }
      />
    </motion.div>
  );
}
