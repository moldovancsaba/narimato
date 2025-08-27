'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import BaseCard from './BaseCard';

/**
 * Interface defining the structure of card content data.
 * Supports both text-based and media-based content types.
 */
interface CardContent {
  text?: string;    // Text content for text-type cards
  mediaUrl?: string; // URL for media content (images, videos)
  cardSize: string; // Card size in "width:height" format (e.g., "300:400") - MANDATORY
}

/**
 * Enum-like type defining all possible states for a swipe card.
 * Used to manage UI state and prevent concurrent actions.
 */
type SwipeState = 'idle' | 'swiping' | 'voted' | 'loading' | 'error';

/**
 * Props interface for the SwipeCard component.
 * Defines all properties required for proper card rendering and interaction.
 */
interface SwipeCardProps {
  uuid: string;                                           // Unique identifier for the card
  type: 'text' | 'media';                               // Content type determines rendering approach
  content: CardContent;                                   // The actual content to display
  title?: string;                                        // Optional title overlay
  onSwipe: (direction: 'left' | 'right') => Promise<void>;  // Async callback for swipe actions  
  isLoading?: boolean;                                   // External loading state
  error?: string;                                        // External error message
}

/**
 * SwipeCard Component - Interactive card interface with gesture and keyboard support
 * 
 * This component implements the core swipe interaction following the technical specification v2.0.
 * Key features:
 * - Gesture-based swiping with velocity and distance thresholds
 * - Keyboard navigation support (arrow keys)
 * - State management to prevent concurrent swipes
 * - Comprehensive error handling with visual feedback
 * - Smooth animations using react-spring
 * 
 * Implementation follows strict event ordering:
 * 1. User initiates swipe (gesture or keyboard)
 * 2. Component locks to prevent concurrent actions
 * 3. Visual feedback shows swipe direction
 * 4. Async onSwipe callback processes the action
 * 5. State updates based on success/failure
 * 6. Lock releases after timeout to allow next interaction
 */
const SwipeCard = React.memo(function SwipeCard({ 
  uuid, 
  type, 
  content, 
  title, 
  onSwipe,
  isLoading,
  error 
}: SwipeCardProps) {
  // Internal state management for swipe lifecycle
  // Initial state depends on external loading/error props
  const [swipeState, setSwipeState] = useState<SwipeState>(isLoading ? 'loading' : error ? 'error' : 'idle');
  
  // Track current swipe direction for visual indicators
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  // Prevents concurrent swipe actions during processing
  // Essential for maintaining data consistency and preventing duplicate API calls
  const [swipeLock, setSwipeLock] = useState(false);

  // Track window width for keyboard animation calculations
  const [innerWidth, setInnerWidth] = useState<number>(0);

  // Initialize react-spring animation system for smooth card movements
  // Configuration values optimized for fast, responsive feel:
  // - tension: 500 (very high responsiveness)
  // - friction: 15 (reduced friction for snappier movement)
  const [{ x, y, scale, rot }, api] = useSpring(() => ({
    x: 0,        // Horizontal position (px)
    y: 0,        // Vertical position (px, unused but preserved for future)
    scale: 1,    // Card scale factor (1.0 = normal size)
    rot: 0,      // Rotation angle in degrees
    config: { tension: 500, friction: 15 }
  }));

  /**
   * Gesture handler using @use-gesture/react for sophisticated drag interactions.
   * Implements two-tier trigger system:
   * 1. Velocity threshold: |vx| > 0.3 (fast swipe detection)
   * 2. Distance threshold: |mx| > 50% screen width (deliberate swipe)
   * 
   * This dual approach ensures both quick flicks and deliberate drags are recognized
   * while preventing accidental triggers from minor movements.
   */
// Consolidated swipe handler to prevent concurrent swipes
  const handleSwipeAction = useCallback((direction: 'left' | 'right') => {
    console.log('Swipe action triggered:', { direction, swipeState, swipeLock });
    
    if (swipeState !== 'idle' || swipeLock) {
      console.warn('Concurrent swipe detected during state update');
      return;
    }
    
    setSwipeDirection(direction);
    setSwipeState('swiping');
    setSwipeLock(true);

    onSwipe(direction)
      .then(() => {
        setSwipeState('voted');
        setTimeout(() => setSwipeLock(false), 500);
      })
      .catch((error) => {
        console.error('Swipe error:', error);
        setSwipeState('error');
        api.start({ x: 0, rot: 0, scale: 1, immediate: false });
        setTimeout(() => {
          setSwipeState('idle');
          setSwipeLock(false);
        }, 2000);
      });
  }, [swipeState, swipeLock, onSwipe, api]);

  // Initialize drag gesture handler for visual feedback during swipe
  const bind = useDrag(({ active, movement: [mx], direction: [xDir], velocity: [vx] }) => {
    // Only handle drags when card is in idle state
    if (swipeState !== 'idle' || swipeLock) return;
    
    const trigger = Math.abs(mx) > innerWidth * 0.2; // 20% of screen width
    const isGone = !active && trigger;
    const x = isGone ? (200 + window.innerWidth) * xDir : active ? mx : 0;
    const rot = mx / 100 + (isGone ? xDir * 10 * vx : 0);
    const scale = active ? 1.1 : 1;
    
    api.start({
      x,
      rot,
      scale,
      config: active ? { friction: 15, tension: 1000 } : isGone ? { duration: 150 } : { friction: 12, tension: 700 },
    });

    if (isGone) {
      // Trigger swipe based on direction using consolidated handler (very fast timeout)
      setTimeout(() => {
        if (xDir < 0) handleSwipeAction('left');
        else handleSwipeAction('right');
      }, 50);
    }
  });
  
// Remove useSwipeable to prevent conflicts - useDrag handles all gestures

  /**
   * Keyboard event handler for accessibility and power user support.
   * Provides identical functionality to gesture-based swiping via arrow keys.
   * 
   * Key mappings:
   * - ArrowLeft: Swipe left (reject/discard card)
   * - ArrowRight: Swipe right (accept/like card)
   * 
   * Implementation mirrors gesture handling with same state management,
   * error handling, and visual feedback patterns for consistency.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Early return if card is not in swipeable state or innerWidth not loaded
    // Same validation as gesture handler to maintain consistency
    if (swipeState !== 'idle' || swipeLock || !innerWidth) return;
    
    if (e.key === 'ArrowLeft') {
      // Animate card off-screen to the left with rotation
      api.start({
        x: -innerWidth,  // Move completely off-screen
        rot: -10,        // Slight counter-clockwise rotation
        config: { duration: 300 } // Increased duration for visibility
      });
      
      // Use consolidated swipe handler
      handleSwipeAction('left');
    } else if (e.key === 'ArrowRight') {
      // Animate card off-screen to the right with rotation
      api.start({
        x: innerWidth,   // Move completely off-screen right
        rot: 10,         // Slight clockwise rotation
        config: { duration: 300 } // Increased duration for visibility
      });
      
      // Use consolidated swipe handler
      handleSwipeAction('right');
    }
    // Note: Other keys are ignored to prevent unintended actions
  }, [swipeState, swipeLock, api, innerWidth, handleSwipeAction]);

  /**
   * Initialize and track window width for keyboard animation calculations.
   * This ensures keyboard swipe animations move cards completely off-screen.
   */
  useEffect(() => {
    const updateInnerWidth = () => {
      setInnerWidth(window.innerWidth);
    };
    
    // Set initial width
    updateInnerWidth();
    
    // Track resize events
    window.addEventListener('resize', updateInnerWidth);
    
    return () => window.removeEventListener('resize', updateInnerWidth);
  }, []);

  /**
   * Set up global keyboard event listener with proper cleanup.
   * 
   * Why global listener:
   * - Card should respond to keyboard input even when not focused
   * - Provides consistent behavior across different interaction methods
   * - Essential for accessibility and power user workflows
   * 
   * Cleanup is critical to prevent memory leaks and duplicate listeners
   * when component unmounts or dependencies change.
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup function removes the event listener
    // Essential for preventing memory leaks and duplicate handlers
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <animated.div
      {...bind()}
      style={{
        x,
        y: 0,
        scale, // Use react-spring scale value
        rotateZ: rot,
        touchAction: 'none'
      }}
      className={`
        absolute w-full h-full
        ${swipeState === 'idle' ? 'cursor-grab active:cursor-grabbing' : ''}
        ${swipeState === 'loading' ? 'swipe-loading' : ''}
        ${swipeState === 'error' ? 'swipe-error' : ''}
        ${swipeState === 'voted' ? 'swipe-voted' : ''}
      `}
    >
      {/* Loading overlay */}
      {swipeState === 'loading' && (
        <div className="swipe-overlay swipe-loading-overlay">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
        </div>
      )}
      
      {/* Error overlay */}
      {swipeState === 'error' && (
        <div className="swipe-overlay swipe-error-overlay">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg text-red-600 dark:text-red-300 text-center">
            <p className="font-semibold">Error processing vote</p>
            <p className="text-sm mt-1">Please try again</p>
          </div>
        </div>
      )}
      
      {/* Vote direction indicator */}
      {swipeState === 'swiping' && (
        <div className={`
          swipe-overlay
          ${swipeDirection === 'right' ? 'swipe-direction-right' : 'swipe-direction-left'}
        `}>
          <div className={`
            swipe-direction-text
            ${swipeDirection === 'right' ? 'swipe-direction-text-right' : 'swipe-direction-text-left'}
          `}>
            {swipeDirection === 'right' ? 'YES' : 'NO'}
          </div>
        </div>
      )}
      {/* Use BaseCard for consistent card design */}
      <BaseCard
        uuid={uuid}
        type={type}
        content={content}
        size="grid"
        className="aspect-adjust"
        // Adjust card size based on card content size
      />
    </animated.div>
  );
});

export default SwipeCard;
