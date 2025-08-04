'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useOrganization } from '@/app/components/OrganizationProvider';
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
import ErrorBoundary from '../components/ErrorBoundary';
import PageLayout from '../components/PageLayout';
import { InlineSpinner } from '../components/Spinner';
import sessionManager from '@/app/lib/utils/sessionManager';

import { Card } from '@/app/lib/types/card';
import { handleApiError, withRetry, backupSessionState } from '@/app/lib/utils/errorHandling';
import { CARD_FIELDS, VOTE_FIELDS, SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
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
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personalRanking, setPersonalRanking] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [shouldRenderContent, setShouldRenderContent] = useState(false);
  const router = useRouter();
  const { currentOrganization } = useOrganization();
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

  // Focus/visibility handler removed to prevent infinite validation loops

  useEffect(() => {
    let isMounted = true; // React Strict Mode guard
    
    async function initPlay() {
      if (typeof window !== 'undefined' && isMounted) {
        console.log('🔄 Initializing play session...');

        try {
          const storedPlayId = localStorage.getItem(SESSION_FIELDS.UUID);

          if (storedPlayId && isMounted) {
            console.log('📝 Found stored play ID, validating session:', storedPlayId);
            
            // CRITICAL: Disable all caching for session validation to prevent stale state
            const validateResponse = await fetch(`/api/v1/session/validate?${SESSION_FIELDS.UUID}=${storedPlayId}&_t=${Date.now()}`, {
              method: 'GET',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Organization-UUID': currentOrganization?.OrganizationUUID || ''
              }
            });
            if (!isMounted) return; // Check if component still mounted
            
            if (!validateResponse.ok) {
              console.warn('❌ Session validation failed, clearing all data and redirecting to home');
              // Clear ALL possible session data
              localStorage.clear();
              sessionStorage.clear();
              router.push('/');
              return;
            }

            const validateData = await validateResponse.json();
            
            if (!isMounted) return; // Check if component still mounted
            
            console.log('✅ Session validation response:', {
              isValid: validateData.isValid,
              status: validateData.status,
              hasSession: !!validateData.session
            });
            
            // If session is invalid, redirect to home
            if (!validateData.isValid) {
              console.log('🧹 Session invalid, clearing all data and redirecting to home');
              // Clear ALL possible session data
              localStorage.clear();
              sessionStorage.clear();
              router.push('/');
              return;
            }
            
            // If session is completed, redirect to results page
            if (validateData.status === 'completed') {
              console.log('🏁 Session completed, redirecting to results page');
              router.push(`/completed?${SESSION_FIELDS.UUID}=${storedPlayId}`);
              return;
            }

            // If we reach here, session is valid and active - but still check for state consistency
            if (!validateData.session || !validateData.session.deck || validateData.session.deck.length === 0) {
              console.warn('❌ Session has no valid deck, clearing and redirecting to home');
              localStorage.clear();
              sessionStorage.clear();
              router.push('/');
              return;
            }

            // Use server data as single source of truth
            const serverDeck = validateData.session.deck;
            const serverSwipes = validateData.session.swipes || [];
            const swipedCardIds = serverSwipes.map((s: any) => s.uuid);
            const currentCardFromServer = serverDeck.find((card: Card) => !swipedCardIds.includes(card.uuid));

            // If no current card available, check if session is completed
            if (!currentCardFromServer) {
              // If session is already marked as completed, redirect to results
              if (validateData.status === 'completed') {
                console.log('🏁 No more cards to swipe and session is completed, redirecting to results');
                router.push(`/completed?${SESSION_FIELDS.UUID}=${storedPlayId}`);
                return;
              } else {
                // Session is active but no cards available - mark as completed and redirect to results
                console.log('🏁 No more cards to swipe, session should be completed - redirecting to results');
                router.push(`/completed?${SESSION_FIELDS.UUID}=${storedPlayId}`);
                return;
              }
            }

            // Only set state if component is still mounted
            if (isMounted) {
              setPlayId(storedPlayId);
              setCards(serverDeck);
              setCurrentCard(currentCardFromServer);
              setIsInitialized(true);
            }
            
            console.log('🎯 Session restored from server state:', {
              playId: storedPlayId,
              totalCards: serverDeck.length,
              swipedCards: swipedCardIds.length,
              currentCard: currentCardFromServer.uuid
            });
            return;
          }

          // No stored play ID found, redirect to home to start a new play
          if (isMounted) {
            console.log('🏠 No stored play ID found, redirecting to home page');
            router.push('/');
          }
          return;
        } catch (error) {
          console.error('💥 Play initialization error:', error);
          // On any error, clear everything and redirect to home
          if (isMounted) {
            localStorage.clear();
            sessionStorage.clear();
            router.push('/');
          }
          return;
        }
      }
    }

    initPlay();
    
    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, [router]); // Run once on mount

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!playId || !currentCard || isLoading) return;

    // Track and manage current state
    sessionManager.updateCurrentCard(currentCard[CARD_FIELDS.UUID]);
    
    setIsLoading(true);
    try {
      // Record swipe with no caching
      sessionManager.updateCurrentCard(currentCard[CARD_FIELDS.UUID]);
      const response = await fetch('/api/v1/swipe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || ''
        },
        body: JSON.stringify({
          [SESSION_FIELDS.UUID]: playId,
          cardUUID: currentCard[CARD_FIELDS.UUID],
          [VOTE_FIELDS.DIRECTION]: direction
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('💥 Swipe failed:', data);
        // On any swipe failure, clear session and redirect to home
        localStorage.clear();
        sessionStorage.clear();
        router.push('/');
        return;
      }

      console.log('✅ Swipe successful:', {
        direction,
        requiresVoting: data.requiresVoting,
        sessionCompleted: data.sessionCompleted,
        nextState: data.nextState
      });

      // Check if play is completed first (highest priority)
      if (data.sessionCompleted) {
        console.log('🏁 Play completed via swipe - redirecting to results');
        localStorage.removeItem('lastState');
        router.push(`/completed?${SESSION_FIELDS.UUID}=${playId}`);
        return;
      }

      // If voting required, navigate immediately before showing next card
      if (direction === 'right' && data.requiresVoting) {
        localStorage.setItem('lastState', JSON.stringify({
          cardUUID: currentCard[CARD_FIELDS.UUID],
          [VOTE_FIELDS.TIMESTAMP]: new Date().toISOString()
        }));
        
        router.push(`/vote?${SESSION_FIELDS.UUID}=${playId}&cardUUID=${currentCard[CARD_FIELDS.UUID]}`);
        return;
      }

      // Update current card - refresh play state with no caching
      const validateResponse = await fetch(`/api/v1/session/validate?${SESSION_FIELDS.UUID}=${playId}&_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || ''
        }
      });
      
      if (validateResponse.ok) {
        const validateData = await validateResponse.json();
        if (validateData.isValid && validateData.session) {
          const swipedCardIds = validateData.session.swipes?.map((s: any) => s.uuid) || [];
          const nextCard = validateData.session.deck?.find((card: Card) => !swipedCardIds.includes(card.uuid));
          setCurrentCard(nextCard || null);
        } else {
          // Session invalid after swipe, clear and redirect
          localStorage.clear();
          sessionStorage.clear();
          router.push('/');
        }
      } else {
        // Validation failed after swipe, clear and redirect
        localStorage.clear();
        sessionStorage.clear();
        router.push('/');
      }
    } catch (error) {
      console.error('💥 Swipe error:', error);
      // On any error, clear session and redirect to home
      localStorage.clear();
      sessionStorage.clear();
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [playId, currentCard, isLoading, router]); // Removed 'cards' dependency to prevent infinite loop

  // Handle error state
  if (error) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="content-card text-center">
            <div className="status-error p-4 mb-4 rounded-lg">
              <h2 className="font-bold mb-2">Session Error</h2>
              <p>{error}</p>
              <p className="text-sm mt-2 text-muted">Returning to home for a fresh start.</p>
            </div>
            <button
              onClick={() => {
                // Clear everything and redirect to home
                localStorage.clear();
                sessionStorage.clear();
                router.push('/');
              }}
              className="btn btn-primary"
            >
              Start New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if all cards are swiped and redirect to results
  useEffect(() => {
    if (cards.length > 0 && !currentCard && playId) {
      console.log('All cards swiped, redirecting to completed page');
      router.push(`/completed?${SESSION_FIELDS.UUID}=${playId}`);
    }
  }, [cards, currentCard, playId, router]);

  // Handle loading state
  // Ensure all hooks render before any conditional returns
  useEffect(() => {
    if (isInitialized) {
      setShouldRenderContent(true);
    }
  }, [isInitialized]);

  if (!shouldRenderContent) {
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
            {currentCard && (
              <SwipeCard
                key={createUniqueKey('swipe-card', currentCard[CARD_FIELDS.UUID], Date.now())}
                uuid={currentCard.uuid}
                type="media"
              content={{
                  mediaUrl: currentCard.body?.imageUrl,
                  cardSize: currentCard.cardSize || '300:400' // Fallback aspect ratio
              }}
                title={currentCard.name}
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
