'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullscreen?: boolean;
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const LoadingSpinner = React.memo(function LoadingSpinner({ 
  size = 'md', 
  message, 
  fullscreen = false,
  className = ''
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`flex items-center justify-center space-x-3 ${className}`}>
      <motion.div 
        className={`${sizes[size]} border-2 border-primary/20 border-t-primary rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {message && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted text-sm font-medium"
        >
          {message}
        </motion.div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-surface border border-border rounded-lg p-8 shadow-lg"
        >
          {spinner}
        </motion.div>
      </div>
    );
  }

  return spinner;
});

export default LoadingSpinner;
