'use client';

/**
 * Loading state component with skeleton animation
 * Displays placeholder content while project data is being fetched
 */
export default function LoadingState() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      
      {/* Metadata skeleton */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      
      {/* Cards skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-gray-200 dark:bg-gray-700 rounded">
            <div className="h-6 w-1/3 bg-gray-300 dark:bg-gray-600 rounded mb-2" />
            <div className="h-4 w-full bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
