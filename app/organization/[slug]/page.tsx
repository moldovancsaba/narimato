'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import DeckCard from '@/app/components/DeckCard';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

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

// FUNCTIONAL: Organization-specific dashboard and card deck selector
// STRATEGIC: Central hub for all organization features and activities
export default function OrganizationHomePage() {
  const router = useRouter();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [isStarting, setIsStarting] = useState(false);
  const [playableCards, setPlayableCards] = useState<PlayableCard[]>([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FUNCTIONAL: Fetch organization-specific playable cards
  // STRATEGIC: Load card decks available for ranking within this organization
  useEffect(() => {
    if (!orgLoading && organization) {
      fetchPlayableCards();
    }
  }, [organization, orgLoading]);

  const fetchPlayableCards = async () => {
    if (!organization) {
      setError('No organization selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`🔄 Fetching playable cards for organization: ${organization.OrganizationName}`);
      
      const response = await fetch('/api/v1/cards?type=playable', {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Cards API error response:', errorText);
        throw new Error(`Failed to fetch cards: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Cards data received:', data);
      
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

  // FUNCTIONAL: Handle starting a ranking session
  // STRATEGIC: Create organization-specific play sessions with proper context
  const handleStart = async (selectedTag: string) => {
    if (isStarting) return; // Prevent double-clicks
    
    setIsStarting(true);
    setSelectedCard(selectedTag);
    
    try {
      // FUNCTIONAL: Clear previous session state to ensure clean start
      // STRATEGIC: Prevent card state mismatches between sessions
      if (typeof window !== 'undefined') {
        console.log('🧹 Clearing previous session state...');
        localStorage.removeItem('sessionUUID');
        localStorage.removeItem('lastState');
        localStorage.removeItem('sessionVersion');
        localStorage.removeItem('deckState');
        localStorage.removeItem('lastSyncState');
        
        // Clear any session-specific backups
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('session_')) {
            localStorage.removeItem(key);
          }
        });
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
      
      // Start play session with organization context
      const response = await fetch('/api/v1/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify({ 
          deckTag: selectedTag,
          sessionUUID: browserSessionId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Session start API error response:', errorText);
        let errorMessage = `Failed to create session: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage);
      }
      
      const sessionData = await response.json();
      console.log('✅ Session created:', sessionData);
      
      // Store session UUID for continuation
      if (typeof window !== 'undefined' && sessionData.playUuid) {
        localStorage.setItem('sessionUUID', sessionData.playUuid);
      }
      
      // Navigate to organization-specific swipe page
      router.push(`/organization/${slug}/swipe?session=${sessionData.playUuid || sessionData.sessionId}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      setError(`Failed to start ranking session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsStarting(false);
      setSelectedCard('');
    }
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Loading Organization" fullscreen={false}>
        <div className="flex items-center justify-center page-height">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Organization Not Found" fullscreen={false}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Organization Not Found</h3>
          <p>{orgError || 'The requested organization could not be found or is inactive.'}</p>
          {slug && (
            <p className="text-sm mt-2 opacity-75">
              Slug: <code>{slug}</code>
            </p>
          )}
          <div className="mt-4">
            <button 
              onClick={() => router.push('/')}
              className="btn btn-primary"
            >
              🏢 Choose Organization
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Dashboard" fullscreen={false}>
      <div className="max-w-6xl mx-auto">
        {/* Organization Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {organization.theme?.logo ? (
              <img
                src={organization.theme.logo}
                alt={`${organization.OrganizationName} logo`}
                className="w-16 h-16 rounded-lg mr-4 object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg mr-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                {organization.OrganizationName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{organization.displayName || organization.OrganizationName}</h1>
              <p className="text-gray-500">Dashboard</p>
            </div>
          </div>
          
          <div className="max-w-2xl mx-auto mb-8">
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Create your personal ranking through simple swipes and votes.
              Your preferences contribute to global ELO-based rankings.
            </p>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => router.push(`/organization/${slug}/play`)}
            className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all group"
          >
            <div className="text-4xl mb-3">🎮</div>
            <h3 className="font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">Start Ranking</h3>
            <p className="text-sm text-gray-500">Begin a new ranking session</p>
          </button>

          <button
            onClick={() => router.push(`/organization/${slug}/cards`)}
            className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all group"
          >
            <div className="text-4xl mb-3">🎴</div>
            <h3 className="font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">Manage Cards</h3>
            <p className="text-sm text-gray-500">View and edit your cards</p>
          </button>

          <button
            onClick={() => router.push(`/organization/${slug}/ranks`)}
            className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all group"
          >
            <div className="text-4xl mb-3">🏆</div>
            <h3 className="font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">View Rankings</h3>
            <p className="text-sm text-gray-500">See current rankings</p>
          </button>

          <button
            onClick={() => router.push(`/organization/${slug}/card-editor`)}
            className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all group"
          >
            <div className="text-4xl mb-3">🎨</div>
            <h3 className="font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">Card Editor</h3>
            <p className="text-sm text-gray-500">Create new cards</p>
          </button>
        </div>

        {/* Quick Start Section */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">Quick Start</h2>
          
          {loading && (
            <div className="text-center py-8">
              <LoadingSpinner size="md" message="Loading card decks..." />
            </div>
          )}

          {error && (
            <div className="status-error p-4 mb-4 rounded-lg">
              {error}
            </div>
          )}

          {!loading && playableCards.length === 0 && !error ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎴</div>
              <h3 className="text-xl font-semibold mb-2">No Playable Cards Yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You need at least 2 cards in a category to start ranking. Create some cards to get started!
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/organization/${slug}/card-editor`)}
                  className="btn-primary px-6 py-3 text-lg font-medium"
                >
                  🎨 Create Your First Cards
                </button>
                <div className="text-sm text-gray-400">
                  <button
                    onClick={() => router.push(`/organization/${slug}/cards`)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Or view existing cards
                  </button>
                </div>
              </div>
            </div>
          ) : !loading ? (
            <>
              <p className="text-center mb-6 text-gray-600 dark:text-gray-400">
                Choose a category to start ranking:
              </p>
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
            </>
          ) : null}
        </div>

        {/* Privacy Notice */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No registration required • Your rankings are private
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
