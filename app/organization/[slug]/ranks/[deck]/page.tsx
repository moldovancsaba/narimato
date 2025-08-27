'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface RankedCard {
  uuid: string;
  name: string;
  rank: number;
  rating: number;
  body?: {
    textContent?: string;
    imageUrl?: string;
  };
  cardSize?: string;
  votes?: number;
  winRate?: number;
}

export default function OrganizationDeckRankingsPage({ 
  params 
}: { 
  params: Promise<{ slug: string; deck: string }> 
}) {
  const { slug, deck } = use(params);
  const router = useRouter();
  const { organization, isLoading: orgLoading, error: orgError, slug: urlSlug } = useOrgFromUrl();
  const [rankings, setRankings] = useState<RankedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckDisplayName, setDeckDisplayName] = useState<string>('');

  const deckName = deck;

  useEffect(() => {
    // Only fetch rankings when organization is loaded
    if (!orgLoading && organization) {
      fetchRankings();
    }
  }, [organization, orgLoading, deckName]);

  const fetchRankings = async () => {
    if (!organization) {
      setError('No organization available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching rankings for deck: ${deckName} in organization: ${organization.OrganizationName}`);
      
      // Ensure deck name has hash prefix for API
      const deckParam = deckName.startsWith('#') ? deckName : `#${deckName}`;
      const response = await fetch(`/api/v1/global-rankings?deck=${encodeURIComponent(deckParam)}`, {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch rankings: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        // Transform API response to match component interface
        const transformedRankings = (data.rankings || []).map((item: any) => ({
          uuid: item.card?.uuid || '',
          name: item.card?.content?.text || `Card ${item.rank}`,
          rank: item.rank || 0,
          rating: item.eloRating || 1000,
          body: {
            textContent: item.card?.content?.text,
            imageUrl: item.card?.content?.mediaUrl
          },
          cardSize: item.card?.content?.cardSize,
          votes: item.totalGames || 0,
          winRate: item.winRate || 0
        }));
        
        setRankings(transformedRankings);
        setDeckDisplayName(data.deckTag?.replace('#', '') || deckName);
        console.log(`✅ Loaded ${transformedRankings.length} rankings:`, transformedRankings);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching rankings:', errorMessage);
    } finally {
      setLoading(false);
    }
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

  // Show rankings loading
  if (loading) {
    return (
      <PageLayout title={`${deckDisplayName} Rankings`}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading rankings..." />
        </div>
      </PageLayout>
    );
  }

  // Show rankings error
  if (error) {
    return (
      <PageLayout title="Rankings">
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Error Loading Rankings</h3>
          <p>{error}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`${deckDisplayName} Rankings`}>
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{deckDisplayName} Rankings</h1>
              <p className="text-muted">{organization.OrganizationName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/ranks`)}
                className="btn btn-secondary btn-sm"
              >
                ← Back to Decks
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/play?deck=${deckName.startsWith('#') ? deckName : `#${deckName}`}`)}
                className="btn btn-primary btn-sm"
              >
                🎮 Play This Deck
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">{deckDisplayName} Rankings</h2>
            <p className="text-sm text-muted">
              These rankings are calculated using an ELO rating system based on head-to-head comparisons 
              from all completed sessions in <strong>{organization.OrganizationName}</strong>. 
              Rankings are updated in real-time as users play and vote.
            </p>
          </div>
        </div>
      
        {/* Content Area */}
        <div className="flex-1 content-background p-6">
          {rankings.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl font-semibold mb-2">No Rankings Yet</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-6">
                    This deck hasn't been played yet. Start a session to generate the first rankings!
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/organization/${slug}/play?deck=${deckName.startsWith('#') ? deckName : `#${deckName}`}`)}
                  className="btn btn-primary px-6 py-3 text-lg font-medium"
                >
                  🎮 Start Playing This Deck
                </button>
                <div className="text-sm text-muted">
                  <button
                    onClick={() => router.push(`/organization/${slug}/card-editor`)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Or add more cards to this deck
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {rankings.map((card, index) => (
                <div 
                  key={card.uuid} 
                  className="content-background p-4 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-black' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="text-with-background">
                      <h3 className="font-semibold">
                        {card.body?.textContent || card.name.replace('#', '')}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted mt-1">
                        <span>Rating: {Math.round(card.rating)}</span>
                        {card.votes && <span>Votes: {card.votes}</span>}
                        {card.winRate && <span>Win Rate: {Math.round(card.winRate * 100)}%</span>}
                      </div>
                    </div>
                  </div>
                  
                  {card.body?.imageUrl && (
                    <div className="flex-shrink-0">
                      <img 
                        src={card.body.imageUrl} 
                        alt={card.body.textContent || card.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
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
