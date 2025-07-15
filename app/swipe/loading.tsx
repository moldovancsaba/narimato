export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="space-y-8">
        <div className="text-center space-y-2 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
        </div>

        <div className="w-[min(100vw,500px)] aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>

        <div className="flex justify-center gap-4">
          <div className="w-24 h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-24 h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}
