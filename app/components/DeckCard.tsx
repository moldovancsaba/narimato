'use client';

import { motion } from 'framer-motion';

interface DeckCardProps {
  tag: string;
  displayName: string;
  cardCount: number;
  onClick: () => void;
  isLoading?: boolean;
}

export default function DeckCard({ 
  tag, 
  displayName, 
  cardCount, 
  onClick, 
  isLoading = false 
}: DeckCardProps) {
  return (
    <motion.div
      layout
      whileHover={{ scale: 0.95 }}
      whileTap={{ scale: 0.9 }}
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      <div className="card-container transition-all duration-200 group-hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7, #c084fc)' }}>
        {/* Main content */}
        <div className="card-content">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
              {displayName}
            </h3>
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
              {cardCount} cards
            </p>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="loading-spinner mr-2"></div>
            <span className="text-white">Starting...</span>
          </div>
        )}

        {/* Hover effect */}
        <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="font-semibold bg-black bg-opacity-50 px-4 py-2 rounded-lg" style={{ color: 'var(--primary)' }}>
            Click to Start
          </div>
        </div>
      </div>
    </motion.div>
  );
}
