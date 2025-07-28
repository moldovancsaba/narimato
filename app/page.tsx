'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/swipe');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold mb-4">Welcome to Narimato</h1>
        <p className="text-xl text-gray-600 mb-8">
          Create your personal ranking through simple swipes and votes
        </p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStart}
          className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg
            shadow-lg hover:bg-blue-700 transition-colors"
        >
          Start Ranking
        </motion.button>

        <p className="mt-8 text-sm text-gray-500">
          No registration required • Your rankings are private
        </p>
      </motion.div>
    </div>
  );
}
