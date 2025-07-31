'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import BaseCard from './BaseCard';

/**
 * Interface defining the structure of card content data.
 * Supports both text-based and media-based content types.
 */
interface CardContent {
  text?: string;    // Text content for text-type cards
  mediaUrl?: string; // URL for media content (images, videos)
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
  // Configuration values optimized for responsive feel:
  // - tension: 300 (high responsiveness)
  // - friction: 20 (smooth but not sluggish)
  const [{ x, y, scale, rot }, api] = useSpring(() => ({
    x: 0,        // Horizontal position (px)
    y: 0,        // Vertical position (px, unused but preserved for future)
    scale: 1,    // Card scale factor (1.0 = normal size)
    rot: 0,      // Rotation angle in degrees
    config: { tension: 300, friction: 20 }
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
// Initialize swipeable handlers for smoother gestures
const handlers = useSwipeable({
  onSwipedLeft: () => {
    if (swipeState === 'idle' && !swipeLock) {
      setSwipeDirection('left');
      setSwipeState('swiping');
      setSwipeLock(true);

      onSwipe('left')
        .then(() => {
          setSwipeState('voted');
          setTimeout(() => setSwipeLock(false), 500);
        })
        .catch(() => {
          setSwipeState('error');
          api.start({ x: 0, rot: 0, scale: 1, immediate: false });
          setTimeout(() => {
            setSwipeState('idle');
            setSwipeLock(false);
          }, 2000);
        });
    }
  },
  onSwipedRight: () => {
    if (swipeState === 'idle' && !swipeLock) {
      setSwipeDirection('right');
      setSwipeState('swiping');
      setSwipeLock(true);

      onSwipe('right')
        .then(() => {
          setSwipeState('voted');
          setTimeout(() => setSwipeLock(false), 500);
        })
        .catch(() => {
          setSwipeState('error');
          api.start({ x: 0, rot: 0, scale: 1, immediate: false });
          setTimeout(() => {
            setSwipeState('idle');
            setSwipeLock(false);
          }, 2000);
        });
    }
  },
  preventScrollOnSwipe: true,
  trackMouse: true
});

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
      // Mirror the gesture flow: set direction, update state, acquire lock
      setSwipeDirection('left');
      setSwipeState('swiping');
      setSwipeLock(true);
      
      // Animate card off-screen to the left with rotation
      // Duration: 300ms for quick but visible movement
      // Rotation: -10deg for natural card-flip effect
      api.start({
        x: -innerWidth,  // Move completely off-screen
        rot: -10,               // Slight counter-clockwise rotation
        config: { duration: 300 }
      });
      
      // Process the swipe with identical error handling as gesture
      onSwipe('left')
        .then(() => {
          setSwipeState('voted');
          // Same timing as gesture handler for consistency
          setTimeout(() => setSwipeLock(false), 500);
        })
        .catch(() => {
          setSwipeState('error');
          // Reset card position with smooth animation
          api.start({
            x: 0,
            rot: 0,
            scale: 1,
            immediate: false  // Smooth return for better UX
          });
          // Extended error visibility timeout
          setTimeout(() => {
            setSwipeState('idle');
            setSwipeLock(false);
          }, 2000);
        });
    } else if (e.key === 'ArrowRight') {
      // Identical logic to left swipe but with opposite direction
      setSwipeDirection('right');
      setSwipeState('swiping');
      setSwipeLock(true);
      
      // Animate card off-screen to the right with rotation
      api.start({
        x: innerWidth,   // Move completely off-screen right
        rot: 10,                // Slight clockwise rotation
        config: { duration: 300 }
      });
      
      // Process right swipe with same error handling pattern
      onSwipe('right')
        .then(() => {
          setSwipeState('voted');
          setTimeout(() => setSwipeLock(false), 500);
        })
        .catch(() => {
          setSwipeState('error');
          api.start({
            x: 0,
            rot: 0,
            scale: 1,
            immediate: false
          });
          setTimeout(() => {
            setSwipeState('idle');
            setSwipeLock(false);
          }, 2000);
        });
    }
    // Note: Other keys are ignored to prevent unintended actions
  }, [swipeState, swipeLock, api, onSwipe, innerWidth]);

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
      {...handlers}
      style={{
        x,
        y: 0,
        scale, // Use react-spring scale value
        rotateZ: rot,
        touchAction: 'none'
      }}
      className={`
        absolute card-container
        ${swipeState === 'idle' ? 'cursor-grab active:cursor-grabbing' : ''}
        ${swipeState === 'loading' ? 'opacity-50' : ''}
        ${swipeState === 'error' ? 'border-2 border-red-500' : ''}
        ${swipeState === 'voted' ? 'opacity-0 transition-opacity duration-300' : ''}
      `}
    >
      {/* Loading overlay */}
      {swipeState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 dark:bg-black/40 rounded-xl z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
        </div>
      )}
      
      {/* Error overlay */}
      {swipeState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 rounded-xl z-10">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg text-red-600 dark:text-red-300 text-center">
            <p className="font-semibold">Error processing vote</p>
            <p className="text-sm mt-1">Please try again</p>
          </div>
        </div>
      )}
      
      {/* Vote direction indicator */}
      {swipeState === 'swiping' && (
        <div className={`
          absolute inset-0 flex items-center justify-center rounded-xl z-10
          ${swipeDirection === 'right' ? 'bg-green-500/20' : 'bg-red-500/20'}
        `}>
          <div className={`
            text-4xl font-bold transform transition-transform
            ${swipeDirection === 'right' ? 'text-green-600 rotate-[-30deg]' : 'text-red-600 rotate-[30deg]'}
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
      />
    </animated.div>
  );
});

export default SwipeCard;
