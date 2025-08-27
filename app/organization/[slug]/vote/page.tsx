'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface Card {
  uuid: string;
  name: string;
  body?: {
    textContent?: string;
    imageUrl?: string;
    background?: {
      value: string;
      textColor?: string;
    };
  };
  cardSize?: string;
  rating?: number;
}

function VotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  
  const deck = searchParams.get('deck');

  useEffect(() => {
    // Only fetch cards when organization is loaded
    if (!orgLoading && organization && deck) {
      fetchCards();
    }
  }, [organization, orgLoading, deck]);

  const fetchCards = async () => {
    if (!organization || !deck) {
      setError('Missing organization or deck parameter');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching cards for deck: ${deck} in organization: ${organization.OrganizationName}`);
      
      const response = await fetch(`/api/v1/cards?parent=${encodeURIComponent(deck)}`, {
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
        setCards(data.cards || []);
        console.log(`✅ Loaded ${data.cards?.length || 0} cards`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching cards:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCardSelect = (card: Card) => {
    if (selectedCards.find(c => c.uuid === card.uuid)) {
      // Deselect card
      setSelectedCards(prev => prev.filter(c => c.uuid !== card.uuid));
    } else if (selectedCards.length < 2) {
      // Select card
      setSelectedCards(prev => [...prev, card]);
    }
  };

  const handleDirectVote = async () => {
    if (selectedCards.length !== 2 || !organization) {
      return;
    }

    setIsVoting(true);
    setError(null);

    try {
      console.log(`🗳️ Direct vote between cards: ${selectedCards[0].name} vs ${selectedCards[1].name}`);
      
      // For now, we'll automatically select the first card as winner
      // In a real implementation, this would show a voting interface
      const response = await fetch('/api/v1/vote/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization.OrganizationUUID
        },
        body: JSON.stringify({
          cardA: selectedCards[0].uuid,
          cardB: selectedCards[1].uuid,
          winner: selectedCards[0].uuid,
          deck: deck
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit vote: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        console.log(`✅ Vote submitted successfully`);
        setSelectedCards([]);
        // Refresh cards to get updated ratings
        await fetchCards();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error submitting vote:', errorMessage);
    } finally {
      setIsVoting(false);
    }
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Vote" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Vote" fullscreen={true}>
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

  // Show missing deck error
  if (!deck) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Vote`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">No Category Selected</h3>
          <p>Please select a category to vote on.</p>
          <div className="mt-4">
            <button 
              onClick={() => router.push(`/organization/${slug}/cards`)}
              className="btn btn-primary"
            >
              🎮 Choose Category
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Show cards loading
  if (loading) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Vote`} fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading cards..." />
        </div>
      </PageLayout>
    );
  }

  // Show cards error
  if (error) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Vote`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Error Loading Cards</h3>
          <p>{error}</p>
          <div className="mt-4">
            <button 
              onClick={() => router.push(`/organization/${slug}/cards`)}
              className="btn btn-secondary"
            >
              ← Back to Categories
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`${organization.OrganizationName} - Vote`} fullscreen={true}>
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{organization.OrganizationName}</h1>
              <p className="text-muted">Direct Voting - {deck}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/cards`)}
                className="btn btn-secondary btn-sm"
              >
                ← Back to Categories
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/ranks/${deck}`)}
                className="btn btn-outline btn-sm"
              >
                🏆 View Rankings
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">Direct Voting</h2>
            <p className="text-sm text-muted">
              Select exactly 2 cards to vote on directly. This creates a head-to-head comparison 
              that contributes to the ELO rankings for <strong>{organization.OrganizationName}</strong>.
            </p>
          </div>
        </div>

        {/* Selection Status */}
        {selectedCards.length > 0 && (
          <div className="content-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-muted">
                  Selected: {selectedCards.length}/2 cards
                </span>
                <div className="flex gap-2 mt-1">
                  {selectedCards.map(card => (
                    <span key={card.uuid} className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                      {card.body?.textContent || card.name.replace('#', '')}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {selectedCards.length === 2 && (
                  <button 
                    onClick={handleDirectVote}
                    disabled={isVoting}
                    className="btn btn-success btn-sm"
                  >
                    {isVoting ? 'Voting...' : '🗳️ Vote'}
                  </button>
                )}
                <button 
                  onClick={() => setSelectedCards([])}
                  className="btn btn-outline btn-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      
        {/* Content Area */}
        <div className="flex-1 content-background p-6">
          {cards.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">🗳️</div>
                <h3 className="text-xl font-semibold mb-2">No Cards Available</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-6">
                    This category doesn't have any cards to vote on yet.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/organization/${slug}/card-editor`)}
                  className="btn btn-primary px-6 py-3 text-lg font-medium"
                >
                  ✏️ Add Cards to This Category
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              
              <div className="text-center">
                <div className="text-with-background">
                  <h3 className="text-lg font-semibold mb-2">Select 2 Cards to Compare</h3>
                  <p className="text-sm text-muted">
                    Click on cards to select them for voting. You need exactly 2 cards to create a comparison.
                  </p>
                </div>
              </div>
              
              <div className="results-grid">
                {cards.map((card) => (
                  <div 
                    key={card.uuid}
                    onClick={() => handleCardSelect(card)}
                    className={`cursor-pointer transform hover:scale-105 transition-all duration-200 ${
                      selectedCards.find(c => c.uuid === card.uuid) 
                        ? 'ring-4 ring-blue-500' 
                        : ''
                    }`}
                  >
                    <div className="content-background p-6 rounded-lg border-2 border-transparent hover:border-blue-500">
                      {card.body?.imageUrl ? (
                        <img 
                          src={card.body.imageUrl} 
                          alt={card.body.textContent || card.name}
                          className="w-full h-40 object-cover rounded-lg mb-4"
                        />
                      ) : (
                        <div 
                          className="w-full h-40 rounded-lg mb-4 flex items-center justify-center text-white text-lg font-bold"
                          style={{ 
                            background: card.body?.background?.value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: card.body?.background?.textColor || '#ffffff'
                          }}
                        >
                          {card.body?.textContent || card.name.replace('#', '')}
                        </div>
                      )}
                      <h3 className="text-lg font-semibold text-center mb-2">
                        {card.body?.textContent || card.name.replace('#', '')}
                      </h3>
                      {card.rating && (
                        <p className="text-sm text-muted text-center">
                          Rating: {Math.round(card.rating)}
                        </p>
                      )}
                      {selectedCards.find(c => c.uuid === card.uuid) && (
                        <div className="text-center mt-2">
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                            ✓ Selected
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-center mt-8">
            <div className="text-with-background">
              <p className="text-sm text-muted">
                Direct votes contribute to the global ELO rankings
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function OrganizationVotePage() {
  return (
    <Suspense fallback={
      <PageLayout title="Vote" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading..." />
        </div>
      </PageLayout>
    }>
      <VotePage />
    </Suspense>
  );
}
