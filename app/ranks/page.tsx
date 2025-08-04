'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import DeckCard from '@/app/components/DeckCard';

interface Deck {
  tag: string;
  cardCount: number;
  displayName: string;
  imageUrl?: string;
  cardSize?: string;
}

export default function RanksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await fetch('/api/v1/cards?type=playable');
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

    fetchCards();
  }, []);

  const handleDeckSelect = (deckTag: string) => {
    // Remove the # symbol from the tag for URL routing
    const cleanTag = deckTag.startsWith('#') ? deckTag.substring(1) : deckTag;
    router.push(`/ranks/${cleanTag}`);
  };

  if (loading) {
    return (
      <PageLayout title="Global Rankings">
        <div className="flex justify-center items-center">
          <div className="loading-spinner"></div>
          <span className="ml-2 text-lg">Loading Categories...</span>
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
        <div className="text-center p-8">
          <p className="text-muted">No categories available yet. Add some cards to create categories!</p>
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

