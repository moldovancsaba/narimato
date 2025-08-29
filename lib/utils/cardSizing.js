/**
 * NARIMATO - Dynamic Card Sizing Utility
 * 
 * FUNCTIONAL: Calculates optimal card sizes based on viewport dimensions and game mode
 * STRATEGIC: Ensures consistent card sizing across all game interfaces with proper spacing
 * 
 * Specifications:
 * - Landscape Mode: Card max height = 70% screen, max width = 35% screen
 * - Portrait Mode: Card max height = 35% screen, max width = 70% screen  
 * - Minimum gap = 10px between all elements
 * - Emoji circle size = 5% of relevant dimension (height for landscape, width for portrait)
 * - Cards maintain square aspect ratio
 */

const { useState, useEffect } = require('react');

/**
 * FUNCTIONAL: Detects current viewport orientation
 * STRATEGIC: Foundation for responsive layout calculations
 */
function getViewportOrientation() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  return width > height ? 'landscape' : 'portrait';
}

/**
 * FUNCTIONAL: Calculates optimal card dimensions based on game mode and orientation
 * STRATEGIC: Ensures cards are as large as possible while respecting spacing constraints
 * 
 * @param {string} gameMode - 'swipe' or 'vote'
 * @param {string} orientation - 'landscape' or 'portrait' (optional, auto-detected)
 * @returns {Object} Card sizing configuration
 */
function calculateCardSize(gameMode = 'swipe', orientation = null) {
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const actualOrientation = orientation || getViewportOrientation();
  
  const MIN_GAP = 10; // Minimum gap between elements
  
  let cardWidth, cardHeight, emojiSize;
  
  if (actualOrientation === 'landscape') {
    // LANDSCAPE MODE: Card max height = 70% screen, max width = 35% screen
    const maxCardHeight = Math.floor(viewHeight * 0.7);
    const maxCardWidth = Math.floor(viewWidth * 0.35);
    
    // FUNCTIONAL: Choose smaller dimension to maintain square aspect ratio
    // STRATEGIC: Prevents cards from overflowing viewport constraints
    const cardSize = Math.min(maxCardHeight, maxCardWidth);
    
    cardWidth = cardSize;
    cardHeight = cardSize;
    
    // FUNCTIONAL: Emoji circle size = 5% of screen height in landscape
    // STRATEGIC: Scales proportionally with viewport for consistent appearance
    emojiSize = Math.floor(viewHeight * 0.05);
    
  } else {
    // PORTRAIT MODE: Card max height = 35% screen, max width = 70% screen
    const maxCardHeight = Math.floor(viewHeight * 0.35);
    const maxCardWidth = Math.floor(viewWidth * 0.7);
    
    // FUNCTIONAL: Choose smaller dimension to maintain square aspect ratio
    // STRATEGIC: Ensures cards fit within portrait layout constraints
    const cardSize = Math.min(maxCardHeight, maxCardWidth);
    
    cardWidth = cardSize;
    cardHeight = cardSize;
    
    // FUNCTIONAL: Emoji circle size = 5% of screen width in portrait
    // STRATEGIC: Maintains proportional scaling across orientations
    emojiSize = Math.floor(viewWidth * 0.05);
  }
  
  // FUNCTIONAL: Apply minimum size constraints to prevent unusably small cards
  // STRATEGIC: Ensures usability across all device sizes
  const minCardSize = 120; // Minimum card dimension
  const minEmojiSize = 24; // Minimum emoji size
  
  cardWidth = Math.max(cardWidth, minCardSize);
  cardHeight = Math.max(cardHeight, minCardSize);
  emojiSize = Math.max(emojiSize, minEmojiSize);
  
  return {
    // Card dimensions
    cardWidth,
    cardHeight,
    cardSize: cardWidth, // Since cards are square
    
    // Emoji/button dimensions  
    emojiSize,
    buttonSize: emojiSize * 1.5, // Buttons slightly larger than emoji
    
    // Layout configuration
    orientation: actualOrientation,
    gameMode,
    minGap: MIN_GAP,
    
    // Viewport info
    viewWidth,
    viewHeight,
    
    // CSS-ready styles
    cardStyles: {
      width: `${cardWidth}px`,
      height: `${cardHeight}px`,
      minWidth: `${cardWidth}px`,
      minHeight: `${cardHeight}px`
    },
    
    emojiStyles: {
      width: `${emojiSize}px`,
      height: `${emojiSize}px`,
      fontSize: `${emojiSize * 0.6}px`, // Emoji font size
      borderRadius: '50%'
    },
    
    buttonStyles: {
      width: `${emojiSize * 1.5}px`,
      height: `${emojiSize * 1.5}px`,
      borderRadius: '50%',
      fontSize: `${emojiSize * 0.4}px`
    }
  };
}

/**
 * FUNCTIONAL: Creates debounced resize handler to optimize performance
 * STRATEGIC: Prevents excessive recalculations during window resize events
 */
function createResizeHandler(callback, delay = 150) {
  let timeoutId;
  
  return function handleResize() {
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      callback();
    }, delay);
  };
}

/**
 * FUNCTIONAL: Hook for React components to use dynamic card sizing
 * STRATEGIC: Provides reactive card sizing with automatic resize handling
 * 
 * @param {string} gameMode - 'swipe' or 'vote'
 * @param {Function} onSizeChange - Optional callback when size changes
 * @returns {Object} Card sizing configuration
 */
function useCardSizing(gameMode = 'swipe', onSizeChange = null) {
  const [cardConfig, setCardConfig] = useState(null);
  
  // FUNCTIONAL: Initialize card sizing on mount
  // STRATEGIC: Ensures sizing is available immediately after component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initialConfig = calculateCardSize(gameMode);
      setCardConfig(initialConfig);
      
      if (onSizeChange) {
        onSizeChange(initialConfig);
      }
    }
  }, [gameMode]);
  
  // FUNCTIONAL: Handle window resize events with debouncing
  // STRATEGIC: Maintains responsive behavior while preventing performance issues
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = createResizeHandler(() => {
      const newConfig = calculateCardSize(gameMode);
      setCardConfig(newConfig);
      
      if (onSizeChange) {
        onSizeChange(newConfig);
      }
    });
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // FUNCTIONAL: Cleanup event listeners on component unmount
    // STRATEGIC: Prevents memory leaks and ensures proper lifecycle management
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [gameMode, onSizeChange]);
  
  return cardConfig;
}

module.exports = {
  calculateCardSize,
  getViewportOrientation,
  createResizeHandler,
  useCardSizing
};
