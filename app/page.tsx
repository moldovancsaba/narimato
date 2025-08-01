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
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Decks API error response:', errorText);
          throw new Error(`Failed to fetch decks: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('Decks API response text:', responseText);
        
        if (!responseText) {
          throw new Error('Empty response from decks API');
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Response text that failed to parse:', responseText);
          throw new Error('Invalid JSON response from decks API');
        }
        
        setDecks(data.decks || []);
      } catch (error) {
        console.error('Error fetching decks:', error);
        setError(`Failed to load decks: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Debug: Log localStorage state before cleanup
      if (typeof window !== 'undefined') {
        const beforeCleanup = {
          sessionId: localStorage.getItem(SESSION_FIELDS.ID),
          browserSessionId: localStorage.getItem('browserSessionId'),
          lastState: localStorage.getItem('lastState'),
          sessionVersion: localStorage.getItem('sessionVersion'),
          deckState: localStorage.getItem('deckState')
        };
        console.log('🧹 LocalStorage state before cleanup:', beforeCleanup);
        
        // Clear session-related localStorage items to ensure fresh start
        localStorage.removeItem(SESSION_FIELDS.ID);
        localStorage.removeItem('lastState');
        localStorage.removeItem('sessionVersion');
        localStorage.removeItem('deckState');
        
        console.log('✅ Cleaned up localStorage for new play');
      }
      
      // Get or create browser session ID for analytics
      let browserSessionId = null;
      if (typeof window !== 'undefined') {
        browserSessionId = localStorage.getItem('browserSessionId');
        if (!browserSessionId) {
          browserSessionId = crypto.randomUUID();
          localStorage.setItem('browserSessionId', browserSessionId);
        }
      }
      
      // Pass selected deck to play start API
      const response = await fetch('/api/v1/play/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          deckTag: selectedTag,
          sessionId: browserSessionId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Play start API error response:', errorText);
        throw new Error(`Failed to create play: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log('Play start API response text:', responseText);
      
      if (!responseText) {
        throw new Error('Empty response from play start API');
      }
      
      let playData;
      try {
        playData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text that failed to parse:', responseText);
        throw new Error('Invalid JSON response from play start API');
      }
      
      if (typeof window !== 'undefined' && playData.playUuid) {
        localStorage.setItem(SESSION_FIELDS.ID, playData.playUuid);
      }
      
      // Navigate to swipe page
      router.push('/swipe');
    } catch (error) {
      console.error('Failed to start play:', error);
      setError(`Failed to start play: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
