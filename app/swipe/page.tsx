'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEventAgent } from '@/app/lib/hooks/useEventAgent';
import { useCardSize } from '@/app/hooks/useCardSize';
import { useOrientation } from '@/app/hooks/useOrientation';
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
      <div className="w-full h-full flex items-center justify-center card-container">
        <InlineSpinner className="w-12 h-12 border-4 border-white border-t-transparent" />
      </div>
    ),
  }
);
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import ErrorBoundary from '../components/ErrorBoundary';
import PageLayout from '../components/PageLayout';
import { InlineSpinner } from '../components/Spinner';

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
  const { cardWidth } = useCardSize();

  // Update parent component with session ID changes
  useEffect(() => {
    onSessionIdChange(sessionId);
  }, [sessionId, onSessionIdChange]);

  // Add no-scroll class to body to prevent scrolling
  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

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

      console.log('Swipe response received:', {
        direction,
        requiresVoting: data.requiresVoting,
        sessionCompleted: data.sessionCompleted,
        nextState: data.nextState
      });

      // Check if session is completed first (highest priority)
      if (data.sessionCompleted) {
        console.log('Session completed via swipe - redirecting to results');
        // Clear any polling intervals and redirect immediately
        localStorage.removeItem('lastState');
        router.push(`/completed?${SESSION_FIELDS.ID}=${sessionId}`);
        return;
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

      // Only update deck state if not navigating to vote or results
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
      <div className="page-container">
        <div className="page-content">
          <div className="content-card text-center">
            <div className="status-error p-4 mb-4 rounded-lg">
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
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
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
    // Just return loading state - the useEffect above will handle navigation
    return (
      <div className="flex items-center justify-center bg-background" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="text-center">
          <p className="text-muted text-lg">Loading session...</p>
        </div>
      </div>
    );
  }

    return (
        <div className="w-screen fixed inset-0 overflow-hidden bg-background text-foreground" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="page-grid-container swipe-grid h-full">
            
            {/* Title Area - Row 1 */}
            <div className="swipe-grid-title page-title-grid">
              <h1 className="text-3xl font-bold text-center">Swipe to Vote</h1>
            </div>
            
            {/* Portrait Mode: Card - Row 2 */}
          <div className="swipe-grid-card grid-cell">
            {currentCard && deck && (
              <SwipeCard
                key={createUniqueKey('swipe-card', currentCard[CARD_FIELDS.UUID], deck.getCurrentIndex())}
                {...currentCard}
                onSwipe={handleSwipe}
              />
            )}
          </div>
          
          {/* Landscape Mode: Left Button */}
          <div className="swipe-grid-button-left grid-cell">
            <button
              onClick={() => handleSwipe('left')}
              disabled={isLoading}
              className="swipe-button-circle bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {isLoading ? <InlineSpinner className="w-6 h-6" /> : '😵'}
            </button>
          </div>
          
          {/* Landscape Mode: Right Button */}
          <div className="swipe-grid-button-right grid-cell">
            <button
              onClick={() => handleSwipe('right')}
              disabled={isLoading}
              className="swipe-button-circle bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
            >
              {isLoading ? <InlineSpinner className="w-6 h-6" /> : '😍'}
            </button>
          </div>
          
          {/* Portrait Mode: Buttons - Row 3 */}
          <div className="swipe-grid-buttons grid-cell">
            <button
              onClick={() => handleSwipe('left')}
              disabled={isLoading}
              className="swipe-button-circle bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {isLoading ? <InlineSpinner className="w-6 h-6" /> : '😵'}
            </button>
            <button
              onClick={() => handleSwipe('right')}
              disabled={isLoading}
              className="swipe-button-circle bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
            >
              {isLoading ? <InlineSpinner className="w-6 h-6" /> : '😍'}
            </button>
          </div>
          
          
        </div>
      </div>
  );
}
