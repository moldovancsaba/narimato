'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import DeckCard from '@/app/components/DeckCard';
import { useOrganization } from '@/app/components/OrganizationProvider';

interface Deck {
  tag: string;
  cardCount: number;
  displayName: string;
  imageUrl?: string;
  cardSize?: string;
}

export default function RanksPage() {
  const router = useRouter();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch cards when organization is loaded and available
    if (!orgLoading && currentOrganization) {
      fetchCards();
    }
  }, [currentOrganization, orgLoading]);

  const fetchCards = async () => {
    if (!currentOrganization) {
      setError('No organization selected');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/cards?type=playable', {
        headers: {
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        }
      });
        if (!response.ok) {
          throw new Error('Failed to fetch cards');
        }
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          const mappedDecks = (data.cards || []).map((card: any) => ({
            tag: card.name,
            cardCount: card.childCount || 0,
            displayName: card.body?.textContent || card.name.substring(1),
            imageUrl: card.body?.imageUrl, // Add image URL
            cardSize: card.cardSize, // Add card size for aspect ratio
          }));
          setDecks(mappedDecks);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeckSelect = (deckTag: string) => {
    // Remove the # symbol from the tag for URL routing
    const cleanTag = deckTag.startsWith('#') ? deckTag.substring(1) : deckTag;
    router.push(`/ranks/${cleanTag}`);
  };

  // Show loading while organization context or cards are loading
  if (orgLoading || loading) {
    return (
      <PageLayout title="Global Rankings">
        <div className="flex justify-center items-center">
          <div className="loading-spinner"></div>
          <span className="ml-2 text-lg">
            {orgLoading ? 'Loading organization...' : 'Loading Categories...'}
          </span>
        </div>
      </PageLayout>
    );
  }

  // Show error if no organization is available
  if (!currentOrganization && !orgLoading) {
    return (
      <PageLayout title="Global Rankings">
        <div className="status-error p-4 mb-4 rounded-lg">
          No organization selected. Please select an organization to view rankings.
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Error">
        <div className="status-error p-4 rounded-lg">{error}</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Global Rankings">
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Choose a Category to View Rankings</h2>
        <p className="text-sm text-muted mb-4">
          Select a category below to view its ELO-based global rankings. Rankings are calculated using 
          skill-based comparisons across all user sessions for cards within that specific category.
        </p>
      </div>
      
      {decks.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold mb-2">No Rankings Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Rankings are generated when people play and vote on cards. Start playing to create the first rankings!
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/')}
              className="btn-primary px-6 py-3 text-lg font-medium"
            >
              🎮 Start Playing to Generate Rankings
            </button>
            <div className="text-sm text-gray-400">
              <button
                onClick={() => router.push('/card-editor')}
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
        <p className="text-sm text-muted">
          Rankings are updated in real-time based on all completed sessions
        </p>
      </div>
    </PageLayout>
  );
}

