'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/app/components/OrganizationProvider';
import PageLayout from './components/PageLayout';
import DeckCard from './components/DeckCard';

interface PlayableCard {
  uuid: string;
  hashtag: string;
  slug: string;
  title: string;
  description: string;
  cardCount: number;
  isActive: boolean;
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  cardSize?: string;
  styling?: {
    textColor: string;
    backgroundColor: string;
    textAlign: string;
  };
}

export default function HomePage() {
  const router = useRouter();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [isStarting, setIsStarting] = useState(false);
  const [playableCards, setPlayableCards] = useState<PlayableCard[]>([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch cards when organization is loaded and available
    if (!orgLoading && currentOrganization) {
      fetchPlayableCards();
    }
  }, [currentOrganization, orgLoading]);

  const fetchPlayableCards = async () => {
    if (!currentOrganization) {
      setError('No organization selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Starting to fetch playable cards for organization:', currentOrganization.OrganizationName);
      
      const response = await fetch('/api/v1/cards?type=playable', {
        headers: {
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        }
      });
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
          uuid: card.uuid,
          hashtag: card.name, // Full hashtag like #SPORT
          slug: card.name.substring(1).toLowerCase(), // Remove # and lowercase
          title: card.body?.textContent || card.name.substring(1), // Use text content or name without #
          description: card.body?.textContent || `${card.name.substring(1)} category`,
          cardCount: card.childCount || 0,
          isActive: card.isActive,
          publicUrl: null,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          imageUrl: card.body?.imageUrl, // Add image URL
          cardSize: card.cardSize, // Add card size for aspect ratio
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

  const handleStart = async (selectedTag: string) => {
    if (isStarting) return; // Prevent double-clicks
    
    setIsStarting(true);
    setSelectedCard(selectedTag);
    
    try {
      // CRITICAL: Complete session and state cleanup before starting new play
      // This prevents card state mismatches and ensures clean session initialization
      if (typeof window !== 'undefined') {
        const beforeCleanup = {
          sessionId: localStorage.getItem('sessionUUID'),
          browserSessionId: localStorage.getItem('browserSessionId'),
          lastState: localStorage.getItem('lastState'),
          sessionVersion: localStorage.getItem('sessionVersion'),
          deckState: localStorage.getItem('deckState')
        };
        console.log('🧹 LocalStorage state before cleanup:', beforeCleanup);
        
        // Clear ALL session-related localStorage items to ensure fresh start
        // This prevents frontend from using stale card state that doesn't match backend
        localStorage.removeItem('sessionUUID');
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
      
      // Pass selected card to play start API with organization context
      const response = await fetch('/api/v1/play/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || 'default'
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
        localStorage.setItem('sessionUUID', playData.playUuid);
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

  // Show loading while organization context or cards are loading
  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">
          {orgLoading ? 'Loading organization...' : 'Loading cards...'}
        </span>
      </div>
    );
  }

  // Show error if no organization is available
  if (!currentOrganization) {
    return (
      <PageLayout title="几卂尺丨爪卂ㄒㄖ">
        <div className="status-error p-4 mb-4 rounded-lg">
          No organization selected. Please select an organization to continue.
        </div>
      </PageLayout>
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
          <p className="text-sm text-gray-500 mt-1">
            Organization: {currentOrganization.OrganizationName}
          </p>
        </div>
      </div>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">
          {error}
        </div>
      )}

      {playableCards.length === 0 && !error ? (
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="text-6xl mb-4">🎴</div>
            <h3 className="text-xl font-semibold mb-2">No Playable Cards Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              You need at least 2 cards in a category to start ranking. Create some cards to get started!
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/card-editor')}
              className="btn-primary px-6 py-3 text-lg font-medium"
            >
              🎨 Create Your First Cards
            </button>
            <div className="text-sm text-gray-400">
              <button
                onClick={() => router.push('/cards')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Or view existing cards
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="results-grid">
          {playableCards.map((card) => (
            <DeckCard
              key={card.uuid}
              tag={card.hashtag}
              displayName={card.title}
              cardCount={card.cardCount}
              onClick={() => handleStart(card.hashtag)}
              isLoading={isStarting && card.hashtag === selectedCard}
              imageUrl={card.imageUrl}
              cardSize={card.cardSize}
            />
          ))}
        </div>
      )}

      {/* Privacy Notice */}
      <div className="text-center mt-8">
        <p className="text-sm text-balance text-gray-400 dark:text-gray-500">
          No registration required • Your rankings are private
        </p>
      </div>
    </PageLayout>
  );
}
