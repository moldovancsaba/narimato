'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import PageLayout from './components/PageLayout';
import DeckCard from './components/DeckCard';

interface Deck {
  tag: string;
  cardCount: number;
  displayName: string;
}

export default function HomePage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/decks');
        if (!response.ok) throw new Error('Failed to fetch decks');
        const data = await response.json();
        setDecks(data.decks);
      } catch (error) {
        console.error('Error fetching decks:', error);
        setError('Failed to load decks');
      } finally {
        setLoading(false);
      }
    };

    fetchDecks();
  }, []);

  const handleStart = async (selectedTag: string) => {
    if (isStarting) return; // Prevent double-clicks
    
    setIsStarting(true);
    setSelectedDeck(selectedTag);
    
    try {
      // Clear session-related localStorage items to ensure fresh start
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_FIELDS.ID);
        localStorage.removeItem('lastState');
        localStorage.removeItem('sessionVersion');
        localStorage.removeItem('deckState');
      }
      
      // Pass selected deck to session start API
      const response = await fetch('/api/v1/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deckTag: selectedTag }),
      });

      if (!response.ok) throw new Error('Failed to create session');
      
      // Store the session ID so the swipe page can use it
      const sessionData = await response.json();
      if (typeof window !== 'undefined' && sessionData.sessionId) {
        localStorage.setItem(SESSION_FIELDS.ID, sessionData.sessionId);
      }
      
      // Navigate to swipe page
      router.push('/swipe');
    } catch (error) {
      console.error('Failed to start session:', error);
      setError('Failed to start session');
      setIsStarting(false);
      setSelectedDeck('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading decks...</span>
      </div>
    );
  }

  return (
    <PageLayout title="几卂尺丨爪卂ㄒㄖ">
      <div className="mb-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-lg sm:text-xl leading-relaxed text-balance text-gray-300 dark:text-gray-400">
            Create your personal ranking through simple swipes and votes.
            Your preferences contribute to global ELO-based rankings.
          </p>
        </div>
        
        <h2 className="text-xl font-semibold mb-4 text-center">Choose a Deck</h2>
      </div>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="results-grid">
        {decks.map((deck) => (
          <DeckCard
            key={deck.tag}
            tag={deck.tag}
            displayName={deck.displayName}
            cardCount={deck.cardCount}
            onClick={() => handleStart(deck.tag)}
            isLoading={isStarting && deck.tag === selectedDeck}
          />
        ))}
      </div>

      {/* Privacy Notice */}
      <div className="text-center mt-8">
        <p className="text-sm text-balance text-gray-400 dark:text-gray-500">
          No registration required • Your rankings are private
        </p>
      </div>
    </PageLayout>
  );
}
