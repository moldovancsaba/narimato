'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface SessionResult {
  sessionUUID: string;
  deck: string;
  status: string;
  completedAt: string;
  totalVotes: number;
  deck_displayName?: string;
  topCards?: Array<{
    uuid: string;
    name: string;
    rating: number;
    body?: {
      textContent?: string;
      imageUrl?: string;
    };
  }>;
}

function CompletedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionUUID = searchParams.get('session');

  useEffect(() => {
    // Only fetch session results when organization is loaded
    if (!orgLoading && organization && sessionUUID) {
      fetchSessionResult();
    }
  }, [organization, orgLoading, sessionUUID]);

  const fetchSessionResult = async () => {
    if (!organization || !sessionUUID) {
      setError('Missing organization or session ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching session result: ${sessionUUID} for organization: ${organization.OrganizationName}`);
      
      const response = await fetch(`/api/v1/session/${sessionUUID}/results`, {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch session results: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.sessionUUID) {
        // Transform API response to match component interface
        const sessionResult = {
          sessionUUID: data.sessionUUID,
          deck: data.sessionInfo?.deckTag || 'Unknown',
          status: data.sessionInfo?.status || 'completed',
          completedAt: data.sessionInfo?.completedAt || new Date().toISOString(),
          totalVotes: data.statistics?.totalVotes || 0,
          deck_displayName: data.sessionInfo?.deckTag?.replace('#', '') || 'Unknown Category',
          topCards: data.personalRanking?.slice(0, 3).map(item => ({
            uuid: item.card?.uuid || item.cardId,
            name: item.card?.name || item.card?.title || 'Unknown',
            rating: 1500 + (3 - item.rank) * 100, // Estimate rating based on rank
            body: item.card?.body
          })) || []
        };
        setSessionResult(sessionResult);
        console.log(`✅ Session results loaded: ${sessionResult.totalVotes} votes, ${sessionResult.topCards.length} top cards`);
      } else {
        setError('Invalid response format from results API');
        console.error('❌ Invalid API response structure:', data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching session results:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Session Complete" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Session Complete" fullscreen={true}>
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

  // Show missing session error
  if (!sessionUUID) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Session Complete`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">No Session Found</h3>
          <p>No session ID provided. Unable to show results.</p>
          <div className="mt-4">
            <button 
              onClick={() => router.push(`/organization/${slug}/play`)}
              className="btn btn-primary"
            >
              🎮 Start New Session
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Show session loading
  if (loading) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Session Complete`} fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading results..." />
        </div>
      </PageLayout>
    );
  }

  // Show session error
  if (error) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Session Complete`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Error Loading Results</h3>
          <p>{error}</p>
          <div className="mt-4">
            <button 
              onClick={() => router.push(`/organization/${slug}/play`)}
              className="btn btn-secondary"
            >
              ← Start New Session
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const deckDisplayName = sessionResult?.deck_displayName || sessionResult?.deck || 'Unknown Category';

  return (
    <PageLayout title={`${organization.OrganizationName} - Session Complete`} fullscreen={true}>
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{organization.OrganizationName}</h1>
              <p className="text-muted">Session Complete - {deckDisplayName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/ranks/${sessionResult?.deck}`)}
                className="btn btn-secondary btn-sm"
              >
                🏆 View Full Rankings
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/play`)}
                className="btn btn-primary btn-sm"
              >
                🎮 Play Again
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">🎉 Ranking Session Complete!</h2>
            <p className="text-sm text-muted">
              Thank you for contributing to the rankings for <strong>{organization.OrganizationName}</strong>! 
              Your votes have been recorded and the global ELO rankings have been updated.
            </p>
          </div>
        </div>
      
        {/* Results Content */}
        <div className="flex-1 content-background p-6">
          {sessionResult ? (
            <div className="space-y-6">
              
              {/* Session Summary */}
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-2xl font-bold mb-2">Session Complete!</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-4">
                    You completed <strong>{sessionResult.totalVotes} votes</strong> for the <strong>{deckDisplayName}</strong> category.
                  </p>
                  <p className="text-sm text-muted">
                    Completed: {new Date(sessionResult.completedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {/* Top Cards Preview */}
              {sessionResult.topCards && sessionResult.topCards.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-4 text-center">Top Cards in This Category</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                    {sessionResult.topCards.slice(0, 3).map((card, index) => (
                      <div key={card.uuid} className="content-background p-4 rounded-lg text-center">
                        <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          'bg-orange-600 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        {card.body?.imageUrl && (
                          <img 
                            src={card.body.imageUrl} 
                            alt={card.body.textContent || card.name}
                            className="w-16 h-16 object-cover rounded-lg mx-auto mb-2"
                          />
                        )}
                        <h5 className="font-medium text-sm">
                          {card.body?.textContent || card.name.replace('#', '')}
                        </h5>
                        <p className="text-xs text-muted mt-1">
                          Rating: {Math.round(card.rating)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="text-center space-y-4">
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => router.push(`/organization/${slug}/ranks/${sessionResult.deck}`)}
                    className="btn btn-primary px-6 py-3"
                  >
                    🏆 View Full Rankings
                  </button>
                  <button
                    onClick={() => router.push(`/organization/${slug}/play?deck=${sessionResult.deck}`)}
                    className="btn btn-secondary px-6 py-3"
                  >
                    🎮 Play This Category Again
                  </button>
                </div>
                
                <div className="text-sm text-muted">
                  <button
                    onClick={() => router.push(`/organization/${slug}/cards`)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Choose a different category to play
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-with-background max-w-md mx-auto">
                <p className="text-muted">No session results found.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function OrganizationCompletedPage() {
  return (
    <Suspense fallback={
      <PageLayout title="Session Complete" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading..." />
        </div>
      </PageLayout>
    }>
      <CompletedPage />
    </Suspense>
  );
}
