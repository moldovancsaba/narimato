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
    <div className="min-h-screen flex flex-col items-center justify-center mobile-safe-area">
      <div className="mobile-container text-center">
        {/* Hero Section */}
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-balance">
            Welcome to Narimato
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 sm:mb-10 leading-relaxed text-balance">
            Create your personal ranking through simple swipes and votes
          </p>

          {/* CTA Button */}
          <button
            onClick={handleStart}
            disabled={isStarting}
            className={`btn btn-lg w-full sm:w-auto sm:min-w-[200px] ${
              isStarting
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'btn-primary'
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

          {/* Privacy Notice */}
          <p className="mt-6 sm:mt-8 text-sm text-gray-500 text-balance">
            No registration required • Your rankings are private
          </p>
        </div>
      </div>
    </div>
  );
}
