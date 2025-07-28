'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function CompletedPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear any session storage data
    sessionStorage.clear();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center"
      >
        <h1 className="text-2xl font-bold mb-4">Ranking Completed!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for completing your card ranking session.
        </p>
        <div className="space-y-4">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Start New Ranking
          </button>
          <button
            onClick={() => router.push('/cards')}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200 transition-colors"
          >
            Manage Cards
          </button>
        </div>
      </motion.div>
    </div>
  );
}
