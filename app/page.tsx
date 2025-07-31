'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import PageLayout from './components/PageLayout';

export default function HomePage() {
  const router = useRouter();
const [isStarting, setIsStarting] = useState(false);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('all');

useEffect(() => {
    const fetchDecks = async () => {
      try {
        const response = await fetch('/api/v1/decks');
        if (!response.ok) throw new Error('Failed to fetch decks');
        const data = await response.json();
        setDecks(data.decks);
      } catch (error) {
        console.error('Error fetching decks:', error);
      }
    };

    fetchDecks();
  }, []);

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
      // Pass selected deck to session start API
      const response = await fetch('/api/v1/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deckTag: selectedDeck }),
      });

      if (!response.ok) throw new Error('Failed to create session');
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
          Create your personal ranking through simple swipes and votes.
          Your preferences contribute to global ELO-based rankings.
        </p>

        {/* Deck Selection */}
        <div className="mb-6">
          <label htmlFor="deck" className="block text-sm font-medium text-gray-700">
            Select a Deck
          </label>
          <select
            id="deck"
            name="deck"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
          >
            {decks.map((deck) => (
              <option key={deck.tag} value={deck.tag}>
                {deck.displayName} ({deck.cardCount} cards)
              </option>
            ))}
          </select>
        </div>
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
