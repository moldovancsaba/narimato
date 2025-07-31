'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import PageLayout from './components/PageLayout';

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
    <PageLayout title="几卂尺丨爪卂ㄒㄖ">
      <div className="text-center max-w-lg mx-auto">
        <p className="text-lg sm:text-xl mb-8 sm:mb-10 leading-relaxed text-balance text-gray-300 dark:text-gray-400">
          Create your personal ranking through simple swipes and votes
        </p>

        {/* CTA Button */}
        <button
          onClick={handleStart}
          disabled={isStarting}
          className={`btn btn-lg w-full sm:w-auto sm:min-w-[200px] ${
            isStarting
              ? 'opacity-50 cursor-not-allowed'
              : 'btn-primary'
          }`}
        >
          {isStarting ? (
            <>
              <div className="loading-spinner mr-2"></div>
              Starting...
            </>
          ) : (
            'Start Ranking'
          )}
        </button>

        {/* Privacy Notice */}
        <p className="mt-6 sm:mt-8 text-sm text-balance text-gray-400 dark:text-gray-500">
          No registration required • Your rankings are private
        </p>
      </div>
    </PageLayout>
  );
}
