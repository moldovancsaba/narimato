'use client';

import { motion } from 'framer-motion';

interface DeckCardProps {
  tag: string;
  displayName: string;
  cardCount: number;
  onClick: () => void;
  isLoading?: boolean;
  showRankingsIcon?: boolean;
  imageUrl?: string;
  cardSize?: string;
}

export default function DeckCard({ 
  tag, 
  displayName, 
  cardCount, 
  onClick, 
  isLoading = false,
  showRankingsIcon = false,
  imageUrl,
  cardSize
}: DeckCardProps) {
  return (
    <motion.div
      layout
      whileHover={{ scale: 0.95 }}
      whileTap={{ scale: 0.9 }}
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      <div 
        className="card-container transition-all duration-200 group-hover:shadow-lg deck-card-gradient"
        style={cardSize ? {
          aspectRatio: cardSize.replace(':', ' / ')
        } : {}}
      >
        {/* Deck Tag at Top */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-3">
          <div className="deck-tag-badge">
            {tag.startsWith('#') ? tag : `#${tag}`}
          </div>
        </div>

        {/* Card Image Background */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={`${tag} category`}
            className="card-media card-no-select"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              const container = img.closest('.card-container') as HTMLElement;
              if (container && img.naturalWidth && img.naturalHeight) {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                container.style.aspectRatio = aspectRatio.toString();
              }
            }}
          />
        )}

        {/* Main content overlay */}
        <div className="card-content">
          <div className="text-center">
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
              {cardCount} cards
            </p>
          </div>
        </div>

        {/* Loading state - positioned at bottom */}
        {isLoading && (
          <div className="card-overlay-bottom card-overlay-loading rounded-b-lg">
            <div className="loading-spinner mr-2"></div>
            <span className="text-white">Starting...</span>
          </div>
        )}

        {/* Hover effect - positioned at bottom */}
        <div className="card-overlay-bottom card-overlay-deck-hover rounded-b-lg">
          <div className="font-semibold bg-black bg-opacity-50 px-4 py-2 rounded-lg flex items-center gap-2" style={{ color: 'var(--primary)' }}>
            {showRankingsIcon && (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {showRankingsIcon ? 'View Rankings' : 'Click to Start'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
