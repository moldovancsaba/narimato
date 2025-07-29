'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEventAgent } from '@/app/lib/hooks/useEventAgent';
const SwipeCard = dynamic(
  () => import('../components/SwipeCard').catch((error) => {
    console.warn('[SwipeCard] Dynamic import failed, retrying...', error);
    // Retry the import after a short delay
    return new Promise<typeof import('../components/SwipeCard')>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const module = await import('../components/SwipeCard');
          resolve(module);
        } catch (retryError) {
          console.error('[SwipeCard] Retry failed, forcing page reload...', retryError);
          // Force page reload as last resort
          // Reload handled by client-side only
          window.location.reload();
          reject(retryError);
        }
      }, 1000);
    });
  }),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-md relative aspect-[3/4] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">
        Loading card...
      </div>
    ),
  }
);
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import ErrorBoundary from '../components/ErrorBoundary';

import { Card } from '@/app/lib/types/card';
import { handleApiError, withRetry, backupSessionState } from '@/app/lib/utils/errorHandling';
import { SESSION_FIELDS, CARD_FIELDS, VOTE_FIELDS } from '@/app/lib/constants/fieldNames';
import { createUniqueKey, validateSessionId, validateUUID } from '@/app/lib/utils/fieldValidation';

export default function SwipePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  return (
    <ErrorBoundary 
      sessionId={sessionId || undefined}
      enableRecovery={true}
      onError={(error, errorInfo) => {
        // Custom error handling for swipe page
        console.error('SwipePage error:', error, errorInfo);
        if (sessionId && validateSessionId(sessionId)) {
          handleApiError(error, 'SwipePage component error', sessionId);
        }
      }}
    >
      <SwipeContent onSessionIdChange={setSessionId} />
    </ErrorBoundary>
  );
}

interface SwipeContentProps {
  onSessionIdChange: (sessionId: string | null) => void;
}

function SwipeContent({ onSessionIdChange }: SwipeContentProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckEntity | null>(null);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personalRanking, setPersonalRanking] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const { state, cardSwipedLeft, cardSwipedRight, deckExhausted, errorOccurred, startSession, deckReady } = useEventAgent();

  // Update parent component with session ID changes
  useEffect(() => {
    onSessionIdChange(sessionId);
  }, [sessionId, onSessionIdChange]);

  // Add effect to handle page focus/visibility changes to reload deck state
  useEffect(() => {
    const handleFocus = async () => {
      if (sessionId && typeof window !== 'undefined') {
        try {
          // Force reload deck state when page becomes visible/focused
          const deckResponse = await fetch(`/api/v1/deck?${SESSION_FIELDS.ID}=${sessionId}&_t=${Date.now()}`);
          if (deckResponse.ok) {
            const deckData = await deckResponse.json();
            const refreshedDeck = new DeckEntity(deckData.deck);
            if (deck) {
              refreshedDeck.setVersion(deck.getVersion());
            }
            setDeck(refreshedDeck);
            setCurrentCard(refreshedDeck.getCurrentCard());
          }
        } catch (error) {
          console.warn('Failed to refresh deck state:', error);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [sessionId, deck]);

  useEffect(() => {
    async function initSession() {
      if (typeof window !== 'undefined') {
        // Always reload session state - don't skip if sessionId exists
        console.log('Initializing session...');

        // Initialize or recover session
        try {
          const storedSessionId = localStorage.getItem(SESSION_FIELDS.ID);

          if (storedSessionId) {
            // Always validate and reload to get fresh state
            const validateResponse = await fetch(`/api/v1/session/validate?${SESSION_FIELDS.ID}=${storedSessionId}&_t=${Date.now()}`);
            if (validateResponse.ok) {
              const validateData = await validateResponse.json();
              if (validateData.isValid) {
                setSessionId(storedSessionId);

                // Force fresh deck state
                const deckResponse = await fetch(`/api/v1/deck?${SESSION_FIELDS.ID}=${storedSessionId}&_t=${Date.now()}`);
                if (deckResponse.ok) {
                  const deckData = await deckResponse.json();
                  const newDeck = new DeckEntity(deckData.deck);
                  newDeck.setVersion(validateData[SESSION_FIELDS.VERSION]);
                  
                  // Restore deck state with existing swipes from session
                  if (validateData.session && validateData.session.swipes) {
                    for (const swipe of validateData.session.swipes) {
                      try {
                        newDeck.confirmSwipe(swipe.cardId, swipe.direction);
                      } catch (error) {
                        console.warn('Failed to restore swipe:', swipe, error);
                      }
                    }
                  }
                  
                  setDeck(newDeck);
                  setCurrentCard(newDeck.getCurrentCard());
                  console.log('Session restored with deck state');
                }
                return;
              }
            }
          }

          // Create new session only if no valid existing session
          const response = await fetch('/api/v1/session/start', {
            method: 'POST',
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem(SESSION_FIELDS.ID, data[SESSION_FIELDS.ID]);
            setSessionId(data[SESSION_FIELDS.ID]);

            const newDeck = new DeckEntity(data.deck);
            newDeck.setVersion(data[SESSION_FIELDS.VERSION]);
            setDeck(newDeck);
            setCurrentCard(newDeck.getCurrentCard());
            console.log('New session created');
          }
        } catch (error) {
          console.error('Initialization error:', error);
          setError('Session initialization failed');
          localStorage.removeItem(SESSION_FIELDS.ID);
          localStorage.removeItem('lastState');
        }
      }
    }

    initSession();
  }, []); // Run once on mount

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!sessionId || !currentCard || isLoading) return;
    
    setIsLoading(true);
    try {
      // Record swipe first
      const response = await fetch('/api/v1/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [SESSION_FIELDS.ID]: sessionId,
          [CARD_FIELDS.ID]: currentCard[CARD_FIELDS.UUID],
          [VOTE_FIELDS.DIRECTION]: direction,
          [SESSION_FIELDS.VERSION]: deck?.getVersion()
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record swipe');
      }

      // If voting required, navigate immediately before showing next card
      if (direction === 'right' && data.requiresVoting) {
        localStorage.setItem('lastState', JSON.stringify({
          [CARD_FIELDS.ID]: currentCard[CARD_FIELDS.UUID],
          deckState: deck?.serialize(),
          [SESSION_FIELDS.VERSION]: data[SESSION_FIELDS.VERSION],
          [VOTE_FIELDS.TIMESTAMP]: new Date().toISOString()
        }));
        
        router.push(`/vote?${SESSION_FIELDS.ID}=${sessionId}&${CARD_FIELDS.ID}=${currentCard[CARD_FIELDS.UUID]}`);
        return;
      }

      // Only update deck state if not navigating to vote
      deck?.confirmSwipe(currentCard[CARD_FIELDS.UUID], direction);
      setCurrentCard(deck?.getCurrentCard() || null);
    } catch (error) {
      console.error('Failed to handle swipe:', error);
      setError(error instanceof Error ? error.message : 'Failed to process swipe');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentCard, deck, isLoading, router]);

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <h2 className="font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            localStorage.removeItem(SESSION_FIELDS.ID);
            localStorage.removeItem('lastState');
            window.location.reload();
          }}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Check if deck is exhausted and redirect to results
  useEffect(() => {
    if (deck && deck.isExhausted() && sessionId) {
      console.log('Deck exhausted, redirecting to completed page');
      router.push(`/completed?${SESSION_FIELDS.ID}=${sessionId}`);
    }
  }, [deck, sessionId, router]);

  // Handle loading state
  if (!sessionId || !currentCard) {
    // If we have a deck but no current card, check if exhausted
    if (deck && deck.isExhausted() && sessionId) {
      router.push(`/completed?${SESSION_FIELDS.ID}=${sessionId}`);
      return null;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-16 p-4">
      {/* Progress bar */}
      <div className="w-full max-w-md mb-8 bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${deck ? ((deck.getTotalCount() - deck.getRemainingCount()) / deck.getTotalCount()) * 100 : 0}%`
          }}
        />
      </div>

      {/* Card display */}
      <div className="w-full max-w-md relative aspect-[3/4]">
      {currentCard && deck && (
        <SwipeCard
          key={createUniqueKey('swipe-card', currentCard[CARD_FIELDS.UUID], deck.getCurrentIndex())}
          {...currentCard}
          onSwipe={handleSwipe}
        />
      )}
      </div>
      
      {/* Swipe buttons */}
      <div className="mt-8 flex justify-center items-center space-x-8">
        <button
          onClick={() => handleSwipe('left')}
          disabled={isLoading}
          className={`p-4 rounded-full text-white shadow-lg transition-colors ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {isLoading ? '⏳' : '✕'}
        </button>
        <button
          onClick={() => handleSwipe('right')}
          disabled={isLoading}
          className={`p-4 rounded-full text-white shadow-lg transition-colors ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isLoading ? '⏳' : '✓'}
        </button>
      </div>

      {/* Stats and instructions */}
      <div className="mt-8 text-center text-gray-500">
        <p>Cards remaining: {deck?.getRemainingCount() || 0}</p>
        <p className="mt-2 text-sm">Use arrow keys or swipe to rate cards</p>
      </div>

      {/* Current ranking display */}
      {personalRanking.length > 0 && (
        <div className="mt-8 w-full max-w-md bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-3">Current Ranking</h3>
          <div className="max-h-40 overflow-y-auto">
            {personalRanking.map((cardId, index) => (
              <div 
                key={createUniqueKey('ranking', index, cardId)}
                className="flex items-center py-2 border-b last:border-0"
              >
                <span className="font-bold mr-3">{index + 1}.</span>
                <span className="text-sm text-gray-600">{cardId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
