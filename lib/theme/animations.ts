/**
 * Animation Configuration
 * 
 * This file contains animation configurations for components
 * that require complex animations or transitions.
 */

import { ANIMATION } from './constants';

/**
 * Card Swipe Animation Configuration
 */
export const SWIPE_ANIMATIONS = {
  // Swipe distance threshold for triggering action
  THRESHOLD: 100,
  
  // Rotation factor for tilt effect during swipe
  ROTATION_FACTOR: 0.1,
  
  // Base animation configuration
  BASE_CONFIG: {
    type: 'spring',
    damping: 20,
    stiffness: 200,
  },
  
  // Duration for various animations
  DURATIONS: {
    SWIPE: 0.5,
    RESET: 0.2,
    SCALE: 0.15,
  },
  
  // Transform values for swipe actions
  TRANSFORMS: {
    LEFT_SWIPE: {
      x: -200,
      opacity: 0,
      rotate: -20,
    },
    RIGHT_SWIPE: {
      x: 200,
      opacity: 0,
      rotate: 20,
    },
    RESET: {
      x: 0,
      opacity: 1,
      rotate: 0,
    },
  },
  
  // Interactive state animations
  HOVER: {
    scale: 1.05,
    transition: {
      duration: ANIMATION.DURATION_FAST,
    },
  },
  TAP: {
    scale: 0.98,
  },
  DRAG: {
    scale: 1.05,
    cursor: 'grabbing',
  },
} as const;

/**
 * Vote Animation Configuration
 */
export const VOTE_ANIMATIONS = {
  // Duration for various vote-related animations
  DURATIONS: {
    VOTE_TRANSITION: 0.3,
    FADE: 0.2,
    SCALE: 0.15,
  },
  
  // Transform values for vote actions
  TRANSFORMS: {
    WINNER: {
      scale: [1, 1.1, 1] as [number, number, number],
      opacity: [1, 0.8, 1] as [number, number, number],
      transition: {
        duration: 0.3,
      },
    },
    LOSER: {
      scale: [1, 0.9, 0] as [number, number, number],
      opacity: [1, 0.6, 0] as [number, number, number],
      transition: {
        duration: 0.3,
      },
    },
  },
  
  // Interactive state animations
  HOVER: {
    scale: 1.02,
    transition: {
      duration: ANIMATION.DURATION_FAST,
    },
  },
  TAP: {
    scale: 0.98,
  },
} as const;

/**
 * Loading Spinner Animation Configuration
 */
export const LOADING_ANIMATIONS = {
  SPINNER: {
    animate: {
      rotate: 360,
    },
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
} as const;

/**
 * Error Message Animation Configuration
 */
export const ERROR_ANIMATIONS = {
  INITIAL: {
    opacity: 0,
    y: -10,
  },
  ANIMATE: {
    opacity: 1,
    y: 0,
  },
  EXIT: {
    opacity: 0,
    y: 10,
  },
  TRANSITION: {
    duration: 0.2,
  },
} as const;

/**
 * Modal Animation Configuration
 */
export const MODAL_ANIMATIONS = {
  OVERLAY: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: ANIMATION.DURATION_NORMAL,
    },
  },
  CONTENT: {
    initial: {
      opacity: 0,
      scale: 0.95,
      y: -20,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    transition: {
      duration: ANIMATION.DURATION_NORMAL,
    },
  },
} as const;

/**
 * Navigation Animation Configuration
 */
export const NAVIGATION_ANIMATIONS = {
  LINK: {
    initial: {
      opacity: 0.7,
    },
    hover: {
      opacity: 1,
      scale: 1.05,
    },
    tap: {
      scale: 0.95,
    },
  },
  ACTIVE: {
    opacity: 1,
    borderBottom: '2px solid var(--primary)',
  },
} as const;

/**
 * Button Animation Configuration
 */
export const BUTTON_ANIMATIONS = {
  BASE: {
    whileHover: {
      scale: 1.02,
      transition: {
        duration: ANIMATION.DURATION_FAST,
      },
    },
    whileTap: {
      scale: 0.98,
    },
  },
  DISABLED: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
} as const;

export default {
  SWIPE_ANIMATIONS,
  VOTE_ANIMATIONS,
  LOADING_ANIMATIONS,
  ERROR_ANIMATIONS,
  MODAL_ANIMATIONS,
  NAVIGATION_ANIMATIONS,
  BUTTON_ANIMATIONS,
} as const;
