import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'purple' | 'white' | 'gray';
  text?: string;
  showText?: boolean;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = 'blue', 
  text = 'Loading...', 
  showText = true,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-16 h-16 border-4'
  };

  const colorClasses = {
    blue: 'border-blue-200 border-t-blue-600 text-blue-600 dark:border-blue-300 dark:border-t-blue-400 dark:text-blue-400',
    purple: 'border-purple-200 border-t-purple-600 text-purple-600 dark:border-purple-300 dark:border-t-purple-400 dark:text-purple-400',
    white: 'border-white/30 border-t-white text-white',
    gray: 'border-gray-200 border-t-gray-600 text-gray-600 dark:border-gray-600 dark:border-t-gray-300 dark:text-gray-300'
  };

  return (
    <div className={`flex items-center justify-center ${showText ? 'space-x-3' : ''} ${className}`}>
      <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin`}></div>
      {showText && (
        <p className={`font-medium ${colorClasses[color].split(' ').filter(c => c.includes('text-')).join(' ')}`}>
          {text}
        </p>
      )}
    </div>
  );
};

// Loading Card Component - for card-like loading states
export const LoadingCard: React.FC<{ width?: string; height?: string; className?: string }> = ({ 
  width = '240px', 
  height = '320px', 
  className = '' 
}) => {
  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center ${className}`}
      style={{ width, height }}
    >
      <Spinner size="lg" color="purple" text="Loading..." />
    </div>
  );
};

// Full Page Loading Component
export const PageLoader: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <div className="flex items-center justify-center bg-background" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="text-center">
        <LoadingCard className="mx-auto mb-4" />
        <p className="text-muted text-lg">{text}</p>
      </div>
    </div>
  );
};

// Inline Spinner for buttons and small areas
export const InlineSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}></div>
  );
};

export default Spinner;

