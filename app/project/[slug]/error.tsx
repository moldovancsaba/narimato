'use client';
 
import { useEffect } from 'react';
 
/**
 * Error boundary component
 * Handles and displays runtime errors in the project page
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Project page error:', error);
  }, [error]);
 
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div className="text-red-500 dark:text-red-400 text-xl mb-4">
        Something went wrong!
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-center max-w-md">
        {error.message || 'An unexpected error occurred while loading the project.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
