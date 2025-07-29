'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

export default function HomePage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (isStarting) return; // Prevent double-clicks
    
    setIsStarting(true);
    
    // Clear session-related localStorage items to ensure fresh start
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_FIELDS.ID);
      localStorage.removeItem('lastState');
      // Clear any other potential cached session data
      localStorage.removeItem('sessionVersion');
      localStorage.removeItem('deckState');
    }
    
    try {
      // Navigate to swipe page
      router.push('/swipe');
    } catch (error) {
      console.error('Failed to navigate:', error);
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Narimato</h1>
        <p className="text-xl text-gray-600 mb-8">
          Create your personal ranking through simple swipes and votes
        </p>

        <button
          onClick={handleStart}
          disabled={isStarting}
          className={`px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transition-colors ${
            isStarting
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isStarting ? (
            <>
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
              Starting...
            </>
          ) : (
            'Start Ranking'
          )}
        </button>

        <p className="mt-8 text-sm text-gray-500">
          No registration required • Your rankings are private
        </p>
      </div>
    </div>
  );
}
