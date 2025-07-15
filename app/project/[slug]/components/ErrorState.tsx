'use client';

interface ErrorStateProps {
  error: Error;
  reset: () => void;
}

/**
 * Error state component for displaying errors
 * Provides error details and retry functionality
 */
export default function ErrorState({ error, reset }: ErrorStateProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-400 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Error Loading Project
          </h3>
        </div>
        <p className="text-red-600 dark:text-red-400 mb-4">
          {error.message || 'An unexpected error occurred while loading the project.'}
        </p>
        <button
          onClick={reset}
          className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
