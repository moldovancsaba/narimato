'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface Deck {
  tag: string;
  cardCount: number;
  displayName: string;
  imageUrl?: string;
  cardSize?: string;
}

function PlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const selectedDeck = searchParams.get('deck');

  useEffect(() => {
    // Only fetch cards when organization is loaded
    if (!orgLoading && organization) {
      if (selectedDeck) {
        // Start playing the selected deck immediately
        startSession(selectedDeck);
      } else {
        // Show deck selection
        fetchDecks();
      }
    }
  }, [organization, orgLoading, selectedDeck]);

  const fetchDecks = async () => {
    if (!organization) {
      setError('No organization available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching playable decks for organization: ${organization.OrganizationName}`);
      
      const response = await fetch('/api/v1/cards?type=playable', {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch decks: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        const mappedDecks = (data.cards || []).map((card: any) => ({
          tag: card.name,
          cardCount: card.childCount || 0,
          displayName: card.body?.textContent || card.name.substring(1),
          imageUrl: card.body?.imageUrl,
          cardSize: card.cardSize,
        }));
        setDecks(mappedDecks);
        console.log(`✅ Loaded ${mappedDecks.length} playable decks`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching decks:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (deckTag: string) => {
    if (!organization) {
      setError('No organization available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🎮 Starting session for deck: ${deckTag}`);
      
      const response = await fetch('/api/v1/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization.OrganizationUUID
        },
        body: JSON.stringify({
          deckTag: deckTag.startsWith('#') ? deckTag : `#${deckTag}`,
          sessionUUID: crypto.randomUUID()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.playUuid || data.sessionId) {
        const sessionId = data.playUuid || data.sessionId;
        console.log(`✅ Session started: ${sessionId}`);
        // Redirect to swipe page with session
        router.push(`/organization/${slug}/swipe?session=${sessionId}`);
      } else {
        setError('Failed to start session: No session ID returned');
        console.error('Session response data:', data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error starting session:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeckSelect = (deckTag: string) => {
    startSession(deckTag);
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Play" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Play" fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Organization Not Found</h3>
          <p>{orgError || 'The requested organization could not be found or is inactive.'}</p>
          {slug && (
            <p className="text-sm mt-2 opacity-75">
              Slug: <code>{slug}</code>
            </p>
          )}
        </div>
      </PageLayout>
    );
  }

  // Show loading
  if (loading) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Play`} fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message={selectedDeck ? "Starting session..." : "Loading decks..."} />
        </div>
      </PageLayout>
    );
  }

  // Show error
  if (error) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Play`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error}</p>
          <div className="mt-4">
            <button 
              onClick={() => router.push(`/organization/${slug}/cards`)}
              className="btn btn-secondary"
            >
              ← Back to Cards
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`${organization.OrganizationName} - Play`} fullscreen={true}>
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{organization.OrganizationName}</h1>
              <p className="text-muted">Choose Category to Play</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/cards`)}
                className="btn btn-secondary btn-sm"
              >
                ← Back to Cards
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/ranks`)}
                className="btn btn-outline btn-sm"
              >
                🏆 View Rankings
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">Select a Category to Start Playing</h2>
            <p className="text-sm text-muted">
              Choose a category below to start a ranking session. You'll compare cards through 
              head-to-head voting, and your choices will contribute to the global rankings 
              for <strong>{organization.OrganizationName}</strong>.
            </p>
          </div>
        </div>
      
        {/* Content Area */}
        <div className="flex-1 content-background p-6">
          {decks.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">🎮</div>
                <h3 className="text-xl font-semibold mb-2">No Categories Available</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-6">
                    Create categories with multiple cards to start playing and ranking!
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/organization/${slug}/card-editor`)}
                  className="btn btn-primary px-6 py-3 text-lg font-medium"
                >
                  ✏️ Create Categories and Cards
                </button>
              </div>
            </div>
          ) : (
            <div className="results-grid">
              {decks.map((deck) => (
                <div 
                  key={deck.tag}
                  onClick={() => handleDeckSelect(deck.tag)}
                  className="cursor-pointer transform hover:scale-105 transition-transform duration-200"
                >
                  <div className="content-background p-6 rounded-lg border-2 border-transparent hover:border-blue-500">
                    <div className="text-center">
                      {deck.imageUrl ? (
                        <img 
                          src={deck.imageUrl} 
                          alt={deck.displayName}
                          className="w-24 h-24 object-cover rounded-lg mx-auto mb-4"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                          {deck.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <h3 className="font-semibold text-lg mb-2">{deck.displayName}</h3>
                      <p className="text-sm text-muted">{deck.cardCount} cards</p>
                      <div className="mt-4">
                        <div className="btn btn-primary w-full">
                          🎮 Play Now
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="text-center mt-8">
            <div className="text-with-background">
              <p className="text-sm text-muted">
                Your votes will contribute to the global ELO rankings
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function OrganizationPlayPage() {
  return (
    <Suspense fallback={
      <PageLayout title="Play" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading..." />
        </div>
      </PageLayout>
    }>
      <PlayPage />
    </Suspense>
  );
}
