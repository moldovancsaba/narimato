'use client';

import { useState, useEffect } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { ICard } from '@/models/Card';

interface SwipeControllerProps {
  card: ICard;
  onSwipe: (direction: 'left' | 'right') => void;
}

export default function SwipeController({ card, onSwipe }: SwipeControllerProps) {
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
    >
      {card.type === 'image' ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
          <img
            src={card.content}
            alt={card.imageAlt || card.title}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="text-card">
          <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
          <p className="text-foreground/80">{card.content}</p>
        </div>
      )}
    </motion.div>
  );
}
