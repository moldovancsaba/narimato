'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface SessionCard {
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
}

interface SessionData {
  sessionUUID: string;
  deck: string;
  status: string;
  state: string;
  currentPair?: {
    cardA: SessionCard;
    cardB: SessionCard | null;
  };
  progress?: {
    current: number;
    total: number;
  };
}

function SwipePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false); // FUNCTIONAL: Prevent double-voting
  const [isSwipingCard, setIsSwipingCard] = useState(false); // STRATEGIC: Prevent double-swiping
  
  const sessionUUID = searchParams.get('session');

  useEffect(() => {
    // Only fetch session when organization is loaded
    if (!orgLoading && organization && sessionUUID) {
      fetchSession();
    }
  }, [organization, orgLoading, sessionUUID]);

  const fetchSession = async () => {
    if (!organization || !sessionUUID) {
      setError('Missing organization or session ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching session: ${sessionUUID} for organization: ${organization.OrganizationName}`);
      
      const response = await fetch(`/api/v1/session/${sessionUUID}`, {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setSessionData(data.session);
        console.log(`✅ Session loaded: ${data.session?.status}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching session:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (winnerUUID: string) => {
    // FUNCTIONAL: Prevent duplicate submissions while vote is processing
    // STRATEGIC: Avoid double-voting issues from rapid clicks or component re-renders
    if (isVoting || !organization || !sessionUUID || !sessionData?.currentPair) {
      console.log('🚫 Vote blocked:', { isVoting, organization: !!organization, sessionUUID: !!sessionUUID, currentPair: !!sessionData?.currentPair });
      return;
    }

    // FUNCTIONAL: Add extra protection with timestamp to prevent rapid successive calls
    // STRATEGIC: Even if React state hasn't updated, prevent vote submission within 100ms window
    const now = Date.now();
    const lastVoteTime = window.lastVoteTimestamp || 0;
    if (now - lastVoteTime < 100) {
      console.log('🚫 Vote blocked: Too rapid submission (within 100ms)');
      return;
    }
    window.lastVoteTimestamp = now;

    setIsVoting(true);

    try {
      console.log(`🗳️ Voting for card: ${winnerUUID}`);
      
      const response = await fetch(`/api/v1/session/${sessionUUID}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization.OrganizationUUID
        },
        body: JSON.stringify({
          winner: winnerUUID
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit vote: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.completed) {
        // Session completed, redirect to results
        router.push(`/organization/${slug}/completed?session=${sessionUUID}`);
      } else {
        // Vote processed, refresh session data to get next state (could be more voting or back to swiping)
        await fetchSession();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error submitting vote:', errorMessage);
    } finally {
      // FUNCTIONAL: Always reset voting state to allow next vote
      // STRATEGIC: Ensure UI remains responsive after vote processing
      setIsVoting(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!organization || !sessionUUID || !sessionData?.currentPair?.cardA) {
      return;
    }

    try {
      console.log(`👆 Swiping ${direction} on card: ${sessionData.currentPair.cardA.uuid}`);
      
      const response = await fetch(`/api/v1/swipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization.OrganizationUUID
        },
        body: JSON.stringify({
          sessionUUID: sessionUUID,
          cardUUID: sessionData.currentPair.cardA.uuid,
          direction: direction
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit swipe: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.sessionCompleted) {
        // Session completed, redirect to results
        router.push(`/organization/${slug}/completed?session=${sessionUUID}`);
      } else if (data.requiresVoting) {
        // Need to transition to voting mode, refresh session data
        await fetchSession();
      } else {
        // Continue swiping, refresh session data for next card
        await fetchSession();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error submitting swipe:', errorMessage);
    }
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Swipe" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Swipe" fullscreen={true}>
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
      <PageLayout title={`${organization.OrganizationName} - Swipe`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">No Session Found</h3>
          <p>No active session found. Please start a new ranking session.</p>
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
      <PageLayout title={`${organization.OrganizationName} - Ranking Session`} fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading session..." />
        </div>
      </PageLayout>
    );
  }

  // Show session error
  if (error) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Ranking Session`} fullscreen={true}>
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Session Error</h3>
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

  // Show session complete when session is actually completed
  if (!sessionData || sessionData.status === 'completed') {
    return (
      <PageLayout title={`${organization.OrganizationName} - Ranking Session`} fullscreen={true}>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold mb-2">Session Complete!</h3>
          <div className="text-with-background max-w-md mx-auto">
            <p className="text-muted mb-6">
              You've completed this ranking session. Check out the results!
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/organization/${slug}/completed?session=${sessionUUID}`)}
              className="btn btn-primary px-6 py-3 text-lg font-medium"
            >
              🏆 View Results
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Handle missing currentPair - show loading instead of completion
  if (!sessionData.currentPair || !sessionData.currentPair.cardA) {
    return (
      <PageLayout title={`${organization.OrganizationName} - Ranking Session`} fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading next card..." />
        </div>
      </PageLayout>
    );
  }

  const { cardA, cardB } = sessionData.currentPair;
  const isSwipingMode = sessionData.state === 'swiping' && !cardB;
  const isVotingMode = sessionData.state === 'voting' && cardB;

  return (
    <PageLayout title={`${organization.OrganizationName} - Ranking Session`} fullscreen={true}>
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{organization.OrganizationName}</h1>
              <p className="text-sm text-muted">Ranking Session - {sessionData.deck}</p>
            </div>
            <div className="text-sm text-muted">
              {sessionData.progress && (
                <span>
                  {sessionData.progress.current} / {sessionData.progress.total}
                </span>
              )}
            </div>
          </div>
          
          {sessionData.progress && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(sessionData.progress.current / sessionData.progress.total) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      
        {/* Content Area - Different for Swiping vs Voting */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl">
            
            {isSwipingMode ? (
              /* Single Card Swiping Interface */
              <>
                <div className="text-center mb-8">
                  <div className="text-with-background">
                    <h2 className="text-2xl font-bold mb-2">Do you like this card?</h2>
                    <p className="text-muted">Swipe right to keep it, left to discard it</p>
                  </div>
                </div>
                
                <div className="flex justify-center mb-8">
                  {/* Single Card */}
                  <div className="w-full max-w-md">
                    <div className="content-background p-6 rounded-lg border-2 border-gray-200">
                      {cardA.body?.imageUrl ? (
                        <img 
                          src={cardA.body.imageUrl} 
                          alt={cardA.body.textContent || cardA.name}
                          className="w-full h-64 object-cover rounded-lg mb-4"
                        />
                      ) : (
                        <div 
                          className="w-full h-64 rounded-lg mb-4 flex items-center justify-center text-white text-xl font-bold"
                          style={{ 
                            background: cardA.body?.background?.value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: cardA.body?.background?.textColor || '#ffffff'
                          }}
                        >
                          {cardA.body?.textContent || cardA.name.replace('#', '')}
                        </div>
                      )}
                      
                      <h3 className="text-lg font-semibold text-center mb-4">
                        {cardA.body?.textContent || cardA.name.replace('#', '')}
                      </h3>
                      
                      {/* Swipe Buttons */}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleSwipe('left')}
                          className="btn btn-secondary px-6 py-3 text-lg font-medium"
                        >
                          👎 Discard
                        </button>
                        <button
                          onClick={() => handleSwipe('right')}
                          className="btn btn-primary px-6 py-3 text-lg font-medium"
                        >
                          👍 Keep
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : isVotingMode ? (
              /* Two Card Voting Interface */
              <>
                <div className="text-center mb-8">
                  <div className="text-with-background">
                    <h2 className="text-2xl font-bold mb-2">Which do you prefer?</h2>
                    <p className="text-muted">Tap the card you think is better</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Card A */}
                  <div 
                    onClick={() => !isVoting && handleVote(cardA.uuid)}
                    className={`transform transition-all duration-200 ${
                      isVoting 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'cursor-pointer hover:scale-105 hover:shadow-xl'
                    }`}
                  >
                    <div className="content-background p-6 rounded-lg border-2 border-transparent hover:border-blue-500">
                      {cardA.body?.imageUrl ? (
                        <img 
                          src={cardA.body.imageUrl} 
                          alt={cardA.body.textContent || cardA.name}
                          className="w-full h-64 object-cover rounded-lg mb-4"
                        />
                      ) : (
                        <div 
                          className="w-full h-64 rounded-lg mb-4 flex items-center justify-center text-white text-xl font-bold"
                          style={{ 
                            background: cardA.body?.background?.value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: cardA.body?.background?.textColor || '#ffffff'
                          }}
                        >
                          {cardA.body?.textContent || cardA.name.replace('#', '')}
                        </div>
                      )}
                      
                      <h3 className="text-lg font-semibold text-center">
                        {cardA.body?.textContent || cardA.name.replace('#', '')}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Card B */}
                  <div 
                    onClick={() => !isVoting && handleVote(cardB.uuid)}
                    className={`transform transition-all duration-200 ${
                      isVoting 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'cursor-pointer hover:scale-105 hover:shadow-xl'
                    }`}
                  >
                    <div className="content-background p-6 rounded-lg border-2 border-transparent hover:border-blue-500">
                      {cardB.body?.imageUrl ? (
                        <img 
                          src={cardB.body.imageUrl} 
                          alt={cardB.body.textContent || cardB.name}
                          className="w-full h-64 object-cover rounded-lg mb-4"
                        />
                      ) : (
                        <div 
                          className="w-full h-64 rounded-lg mb-4 flex items-center justify-center text-white text-xl font-bold"
                          style={{ 
                            background: cardB.body?.background?.value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: cardB.body?.background?.textColor || '#ffffff'
                          }}
                        >
                          {cardB.body?.textContent || cardB.name.replace('#', '')}
                        </div>
                      )}
                      
                      <h3 className="text-lg font-semibold text-center">
                        {cardB.body?.textContent || cardB.name.replace('#', '')}
                      </h3>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
            
            <div className="text-center mt-8">
              <div className="text-with-background">
                <p className="text-sm text-muted">
                  Your {isSwipingMode ? 'swipes' : 'votes'} will contribute to the ELO rankings for {organization.OrganizationName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function OrganizationSwipePage() {
  return (
    <Suspense fallback={
      <PageLayout title="Ranking Session" fullscreen={true}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading..." />
        </div>
      </PageLayout>
    }>
      <SwipePage />
    </Suspense>
  );
}
