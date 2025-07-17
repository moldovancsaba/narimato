/**
 * useInteractionAnimations Hook
 * 
 * This hook provides animation controls and handlers for card interactions
 * including swipe and vote animations.
 */

import { useState } from 'react';
import { useAnimation, PanInfo, AnimationControls } from 'framer-motion';
import { SWIPE_ANIMATIONS, VOTE_ANIMATIONS } from '@/lib/theme/animations';

interface UseInteractionAnimationsProps {
  onSwipe?: (direction: 'left' | 'right') => void;
  onVote?: (choice: 'left' | 'right') => void;
}

export function useInteractionAnimations({
  onSwipe,
  onVote,
}: UseInteractionAnimationsProps = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const controls = useAnimation();

  /**
   * Handles swipe animation and callback
   */
  const handleSwipe = async (direction: 'left' | 'right') => {
    const transform = direction === 'left'
      ? SWIPE_ANIMATIONS.TRANSFORMS.LEFT_SWIPE
      : SWIPE_ANIMATIONS.TRANSFORMS.RIGHT_SWIPE;

    await controls.start({
      ...transform,
      transition: {
        duration: SWIPE_ANIMATIONS.DURATIONS.SWIPE,
      },
    });

    onSwipe?.(direction);
  };

  /**
   * Handles vote animation and callback
   */
  const handleVote = async (choice: 'left' | 'right') => {
    const transform = choice === 'left'
      ? VOTE_ANIMATIONS.TRANSFORMS.LOSER
      : VOTE_ANIMATIONS.TRANSFORMS.WINNER;

await controls.start(transform);

    onVote?.(choice);
  };

  /**
   * Handles drag end event for swipe interactions
   */
  const handleDragEnd = async (event: any, info: PanInfo) => {
    const direction = info.offset.x > SWIPE_ANIMATIONS.THRESHOLD
      ? 'right'
      : info.offset.x < -SWIPE_ANIMATIONS.THRESHOLD
        ? 'left'
        : null;

    if (direction) {
      await handleSwipe(direction);
    } else {
      controls.start(SWIPE_ANIMATIONS.TRANSFORMS.RESET);
    }
    
    setIsDragging(false);
  };

  /**
   * Handles keyboard interactions
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDragging) return;
    
    if (e.key === 'ArrowLeft') {
      handleSwipe('left');
    } else if (e.key === 'ArrowRight') {
      handleSwipe('right');
    }
  };

  return {
    // Animation Controls
    controls,
    isDragging,
    
    // Event Handlers
    handleDragEnd,
    handleKeyDown,
    handleSwipe,
    handleVote,
    setIsDragging,
    
    // Animation Configs
    swipeConfig: {
      drag: 'x',
      dragConstraints: { left: 0, right: 0 },
      dragElastic: 1,
      animate: controls,
      onDragStart: () => setIsDragging(true),
      onDragEnd: handleDragEnd,
      whileHover: SWIPE_ANIMATIONS.HOVER,
      whileTap: SWIPE_ANIMATIONS.TAP,
      whileDrag: SWIPE_ANIMATIONS.DRAG,
    },
    
    voteConfig: {
      animate: controls,
      whileHover: VOTE_ANIMATIONS.HOVER,
      whileTap: VOTE_ANIMATIONS.TAP,
    },
  };
}

export default useInteractionAnimations;
