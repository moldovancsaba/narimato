/**
 * Loading state component for the project page
 * Shows skeleton UI while data is being fetched
 */
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Project Header Skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Project Metadata Skeleton */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between mb-3">
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-5 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
