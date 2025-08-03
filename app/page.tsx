'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import PageLayout from './components/PageLayout';
import DeckCard from './components/DeckCard';

interface PlayableCard {
  _id: string;
  hashtag: string;
  slug: string;
  title: string;
  description: string;
  cardCount: number;
  isActive: boolean;
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
  styling?: {
    textColor: string;
    backgroundColor: string;
    textAlign: string;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [playableCards, setPlayableCards] = useState<PlayableCard[]>([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayableCards = async () => {
      try {
        setLoading(true);
        console.log('🔄 Starting to fetch playable cards...');
        
        const response = await fetch('/api/v1/cards?type=playable');
        console.log('📡 API response received:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Cards API error response:', errorText);
          throw new Error(`Failed to fetch cards: ${response.status} ${response.statusText}`);
        }
        
        const responseText = await response.text();
        console.log('📄 Raw response text length:', responseText.length);
        console.log('📄 First 200 chars:', responseText.substring(0, 200));
        
        if (!responseText) {
          throw new Error('Empty response from cards API');
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
          console.log('✅ JSON parse successful, data:', data);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.error('❌ Response text that failed to parse:', responseText);
          console.error('❌ Response text type:', typeof responseText);
          console.error('❌ Response text char codes:', responseText.split('').slice(0, 20).map(c => c.charCodeAt(0)));
          throw new Error(`Invalid JSON response from cards API: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        }
        
        // Map cards to playable card structure
        const mappedCards = (data.cards || []).map((card: any) => ({
          _id: card.uuid,
          hashtag: card.name, // Full hashtag like #SPORT
          slug: card.name.substring(1).toLowerCase(), // Remove # and lowercase
          title: card.body?.textContent || card.name.substring(1), // Use text content or name without #
          description: card.body?.textContent || `${card.name.substring(1)} category`,
          cardCount: card.childCount || 0,
          isActive: card.isActive,
          publicUrl: null,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          styling: card.body?.background ? {
            textColor: card.body.background.textColor || '#ffffff',
            backgroundColor: card.body.background.value || '#667eea',
            textAlign: 'center'
          } : undefined
        }));
        
        setPlayableCards(mappedCards);
      } catch (error) {
        console.error('Error fetching cards:', error);
        setError(`Failed to load cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayableCards();
  }, []);

  const handleStart = async (selectedTag: string) => {
    if (isStarting) return; // Prevent double-clicks
    
    setIsStarting(true);
    setSelectedCard(selectedTag);
    
    try {
      // CRITICAL: Complete session and state cleanup before starting new play
      // This prevents card state mismatches and ensures clean session initialization
      if (typeof window !== 'undefined') {
        const beforeCleanup = {
          sessionId: localStorage.getItem(SESSION_FIELDS.ID),
          browserSessionId: localStorage.getItem('browserSessionId'),
          lastState: localStorage.getItem('lastState'),
          sessionVersion: localStorage.getItem('sessionVersion'),
          deckState: localStorage.getItem('deckState')
        };
        console.log('🧹 LocalStorage state before cleanup:', beforeCleanup);
        
        // Clear ALL session-related localStorage items to ensure fresh start
        // This prevents frontend from using stale card state that doesn't match backend
        localStorage.removeItem(SESSION_FIELDS.ID);
        localStorage.removeItem('lastState');
        localStorage.removeItem('sessionVersion');
        localStorage.removeItem('deckState');
        localStorage.removeItem('lastSyncState');
        
        // Clear any session-specific backups that might cause conflicts
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('session_')) {
            localStorage.removeItem(key);
          }
        });
        
        console.log('✅ Complete localStorage cleanup for new play - preventing card state conflicts');
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
      
      // Pass selected card to play start API
      const response = await fetch('/api/v1/play/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cardName: selectedTag,
          sessionId: browserSessionId
        }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to create play: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error('Play start API error response:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      const playData = await response.json();
      console.log('Play start API response:', playData);
      
      if (typeof window !== 'undefined' && playData.playUuid) {
        localStorage.setItem(SESSION_FIELDS.ID, playData.playUuid);
      }
      
      // Navigate to swipe page
      router.push('/swipe');
    } catch (error) {
      console.error('Failed to start play:', error);
      setError(`Failed to start play: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsStarting(false);
      setSelectedCard('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading cards...</span>
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
        
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">Choose a Category</h2>
        </div>
      </div>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="results-grid">
        {playableCards.map((card) => (
          <DeckCard
            key={card._id}
            tag={card.hashtag}
            displayName={card.title}
            cardCount={card.cardCount}
            onClick={() => handleStart(card.hashtag)}
            isLoading={isStarting && card.hashtag === selectedCard}
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
