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
  const [playId, setPlayId] = useState<string | null>(null);
  
  return (
    <ErrorBoundary 
      sessionId={playId || undefined} // Keep sessionId prop name for ErrorBoundary compatibility
      enableRecovery={true}
      onError={(error, errorInfo) => {
        // Custom error handling for swipe page
        console.error('SwipePage error:', error, errorInfo);
        if (playId && validateSessionId(playId)) { // validateSessionId works for UUIDs
          handleApiError(error, 'SwipePage component error', playId);
        }
      }}
    >
      <SwipeContent onPlayIdChange={setPlayId} />
    </ErrorBoundary>
  );
}

interface SwipeContentProps {
  onPlayIdChange: (playId: string | null) => void;
}

function SwipeContent({ onPlayIdChange }: SwipeContentProps) {
  const [playId, setPlayId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckEntity | null>(null);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personalRanking, setPersonalRanking] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const { state, cardSwipedLeft, cardSwipedRight, deckExhausted, errorOccurred, startSession, deckReady } = useEventAgent();
  const { cardWidth } = useCardSize();

  // Update parent component with play ID changes
  useEffect(() => {
    onPlayIdChange(playId);
  }, [playId, onPlayIdChange]);

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
      if (playId && typeof window !== 'undefined') {
        try {
          // Force reload deck state when page becomes visible/focused (using sessionId param for backward compatibility)
          const deckResponse = await fetch(`/api/v1/deck?sessionId=${playId}&_t=${Date.now()}`);
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
  }, [playId, deck]);

  useEffect(() => {
    async function initPlay() {
      if (typeof window !== 'undefined') {
        // Always reload play state - don't skip if playId exists
        console.log('Initializing play...');

        // Initialize or recover play
        try {
          const storedPlayId = localStorage.getItem(SESSION_FIELDS.ID);

          if (storedPlayId) {
            // Always validate and reload to get fresh state (using sessionId param for backward compatibility)
            const validateResponse = await fetch(`/api/v1/session/validate?sessionId=${storedPlayId}&_t=${Date.now()}`);
            if (validateResponse.ok) {
              const validateData = await validateResponse.json();
              if (validateData.isValid) {
                // Check if play is completed, if so redirect to results
                if (validateData.status === 'completed') {
                  console.log('Play is completed, redirecting to results page');
                  router.push(`/completed?sessionId=${storedPlayId}`);
                  return;
                }
                
                setPlayId(storedPlayId);

                // Force fresh deck state
                const deckResponse = await fetch(`/api/v1/deck?sessionId=${storedPlayId}&_t=${Date.now()}`);
                if (deckResponse.ok) {
                  const deckData = await deckResponse.json();
                  const newDeck = new DeckEntity(deckData.deck);
                  newDeck.setVersion(validateData[SESSION_FIELDS.VERSION]);
                  
                  // Restore deck state with existing swipes from play
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
                  console.log('Play restored with deck state');
                }
                return;
              } else {
                console.log('Stored play ID is invalid, redirecting to home to start new play');
                localStorage.removeItem(SESSION_FIELDS.ID); // Clean up invalid play ID
                router.push('/');
                return;
              }
            } else {
              console.log('Play validation failed, redirecting to home to start new play');
              localStorage.removeItem(SESSION_FIELDS.ID); // Clean up invalid play ID
              router.push('/');
              return;
            }
          }

          // No stored play ID found, redirect to home to start a new play
          console.log('No stored play ID found, redirecting to home page to start new play');
          router.push('/');
          return;
        } catch (error) {
          console.error('Initialization error:', error);
          setError('Play initialization failed');
          localStorage.removeItem(SESSION_FIELDS.ID);
          localStorage.removeItem('lastState');
        }
      }
    }

    initPlay();
  }, [router]); // Run once on mount

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!playId || !currentCard || isLoading) return;
    
    setIsLoading(true);
    try {
      // Record swipe first
      const response = await fetch('/api/v1/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [SESSION_FIELDS.ID]: playId, // Using SESSION_FIELDS.ID for backward compatibility
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

      // Check if play is completed first (highest priority)
      if (data.sessionCompleted) {
        console.log('Play completed via swipe - redirecting to results');
        // Clear any polling intervals and redirect immediately
        localStorage.removeItem('lastState');
        router.push(`/completed?sessionId=${playId}`); // Using sessionId param for backward compatibility
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
        
        router.push(`/vote?sessionId=${playId}&${CARD_FIELDS.ID}=${currentCard[CARD_FIELDS.UUID]}`); // Using sessionId param for backward compatibility
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
  }, [playId, currentCard, deck, isLoading, router]);

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
    if (deck && deck.isExhausted() && playId) {
      console.log('Deck exhausted, redirecting to completed page');
      router.push(`/completed?sessionId=${playId}`); // Using sessionId param for backward compatibility
    }
  }, [deck, playId, router]);

  // Handle loading state
  if (!playId || !currentCard) {
    // Just return loading state - the useEffect above will handle navigation
    return (
      <div className="flex items-center justify-center bg-background mobile-safe-container">
        <div className="text-center">
          <p className="text-muted text-lg">Loading play...</p>
        </div>
      </div>
    );
  }

    return (
        <div className="w-screen fixed inset-0 overflow-hidden bg-background text-foreground mobile-safe-container">
        <div className="page-grid-container swipe-grid gradient-bg-2layer h-full">
            
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
                onSwipe={async (dir) => {
                  if (dir === 'left') {
                    await handleSwipe('left');
                  } else if (dir === 'right') {
                    await handleSwipe('right');
                  }
                }}
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
