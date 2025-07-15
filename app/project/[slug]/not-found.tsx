import Link from 'next/link';

/**
 * Not Found page
 * Displayed when a project with the given slug doesn't exist
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h2 className="text-2xl font-bold mb-4">Project Not Found</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-center max-w-md">
        The project you're looking for doesn't exist or has been removed.
      </p>
      <Link 
        href="/projects"
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        View All Projects
      </Link>
    </div>
  );
}
