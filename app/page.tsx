'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
          NARIMATO
        </h1>
        <p className="text-xl mb-8 text-foreground opacity-80">
          A real-time, card-based web application for dynamic image/text management and ranking
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="#features" 
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Learn More
          </Link>
        </div>

        {/* Features Section */}
        <div id="features" className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4">Image Cards</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Upload and manage images with our intuitive card system. Perfect for visual content organization.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4">Text Cards</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Create and organize text-based cards. Ideal for notes, quotes, or any textual content.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4">Real-time Ranking</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Rank and sort your cards in real-time. Perfect for decision making and content curation.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
