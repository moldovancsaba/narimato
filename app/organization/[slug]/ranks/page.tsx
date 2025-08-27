'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import DeckCard from '@/app/components/DeckCard';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface Deck {
  tag: string;
  cardCount: number;
  displayName: string;
  imageUrl?: string;
  cardSize?: string;
}

export default function OrganizationRanksPage() {
  const router = useRouter();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch cards when organization is loaded
    if (!orgLoading && organization) {
      fetchCards();
    }
  }, [organization, orgLoading]);

  const fetchCards = async () => {
    if (!organization) {
      setError('No organization available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching playable cards for organization: ${organization.OrganizationName}`);
      
      const response = await fetch('/api/v1/cards?type=playable', {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cards: ${response.status} ${response.statusText}`);
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
      console.error('❌ Error fetching cards:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeckSelect = (deckTag: string) => {
    // Remove the # symbol from the tag for URL routing
    const cleanTag = deckTag.startsWith('#') ? deckTag.substring(1) : deckTag;
    router.push(`/organization/${slug}/ranks/${cleanTag}`);
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Rankings">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Rankings">
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

  // Show cards loading
  if (loading) {
    return (
      <PageLayout title="Rankings">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading decks..." />
        </div>
      </PageLayout>
    );
  }

  // Show cards error
  if (error) {
    return (
      <PageLayout title="Rankings">
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Error Loading Decks</h3>
          <p>{error}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Rankings">
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Deck Rankings</h1>
              <p className="text-muted">{organization.OrganizationName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/cards`)}
                className="btn btn-secondary btn-sm"
              >
                🎮 Play Cards
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/card-editor`)}
                className="btn btn-outline btn-sm"
              >
                ✏️ Edit Cards
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">Choose a Deck to View Rankings</h2>
            <p className="text-sm text-muted">
              Rankings for cards in the <strong>{organization.OrganizationName}</strong> organization are calculated using 
              an ELO rating system based on head-to-head comparisons across all user sessions. 
              Select a deck below to view its specific rankings.
            </p>
          </div>
        </div>
      
        {/* Content Area */}
        <div className="flex-1 content-background p-6">
          {decks.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl font-semibold mb-2">No Rankings Yet</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-6">
                    Rankings are generated when people play and vote on cards. Start playing to create the first rankings!
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/organization/${slug}/cards`)}
                  className="btn btn-primary px-6 py-3 text-lg font-medium"
                >
                  🎮 Start Playing to Generate Rankings
                </button>
                <div className="text-sm text-muted">
                  <button
                    onClick={() => router.push(`/organization/${slug}/card-editor`)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Or create more cards first
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="results-grid">
              {decks.map((deck) => (
                <DeckCard
                  key={deck.tag}
                  tag={deck.tag}
                  displayName={deck.displayName}
                  cardCount={deck.cardCount}
                  onClick={() => handleDeckSelect(deck.tag)}
                  showRankingsIcon={true}
                  imageUrl={deck.imageUrl}
                  cardSize={deck.cardSize}
                />
              ))}
            </div>
          )}
          
          <div className="text-center mt-8">
            <div className="text-with-background">
              <p className="text-sm text-muted">
                Rankings are updated in real-time based on all completed sessions
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
