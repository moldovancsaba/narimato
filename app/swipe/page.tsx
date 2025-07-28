'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
const SwipeCard = dynamic(() => import('../components/SwipeCard'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md relative aspect-[3/4] bg-gray-100 animate-pulse rounded-lg"></div>
  )
});
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import ErrorBoundary from '../components/ErrorBoundary';

import { Card } from '@/app/lib/types/card';
import { handleApiError, withRetry, backupSessionState } from '@/app/lib/utils/errorHandling';

export default function SwipePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  return (
    <ErrorBoundary 
      sessionId={sessionId || undefined}
      enableRecovery={true}
      onError={(error, errorInfo) => {
        // Custom error handling for swipe page
        console.error('SwipePage error:', error, errorInfo);
        if (sessionId) {
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
  const router = useRouter();

  // Update parent component with session ID changes
  useEffect(() => {
    onSessionIdChange(sessionId);
  }, [sessionId, onSessionIdChange]);

  useEffect(() => {
    // Initialize or recover session
    async function initSession() {
      try {
        // Check for existing session in localStorage
        const savedSessionId = localStorage.getItem('sessionId');
        if (savedSessionId) {
          // Validate existing session
          const validateResponse = await fetch(`/api/v1/session/validate?sessionId=${savedSessionId}`);
          const validateData = await validateResponse.json();
          
          if (validateResponse.ok && validateData.isValid) {
            // Recover existing session
            setSessionId(savedSessionId);
            const [deckResponse, rankingResponse] = await Promise.all([
              fetch(`/api/v1/deck?sessionId=${savedSessionId}`),
              fetch(`/api/v1/ranking?sessionId=${savedSessionId}`)
            ]);
            
            const [deckData, rankingData] = await Promise.all([
              deckResponse.json(),
              rankingResponse.json()
            ]);
            
            if (deckResponse.ok) {
              const newDeck = new DeckEntity(deckData.deck);
              setDeck(newDeck);
              setCurrentCard(newDeck.getCurrentCard());
            }
            
            if (rankingResponse.ok) {
              setPersonalRanking(rankingData.ranking);
            }
            
            return;
          }
        }
        
        // Create new session if no valid session exists
        const response = await fetch('/api/v1/session/start', {
          method: 'POST'
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to start session');
        }

        // Save session ID in localStorage
        localStorage.setItem('sessionId', data.sessionId);
        setSessionId(data.sessionId);
        const newDeck = new DeckEntity(data.deck);
        setDeck(newDeck);
        setCurrentCard(newDeck.getCurrentCard());
      } catch (error) {
        console.error('Failed to initialize session:', error);
        setError('Failed to start or recover session. Please try again.');
        // Recover the last known good state if available
        try {
          const lastState = localStorage.getItem('lastState');
          if (lastState && deck) {
            const { cardId } = JSON.parse(lastState);
            const currentCard = deck.getCurrentCard();
            if (currentCard) {
              setCurrentCard(currentCard);
            }
          }
        } catch (recoveryError) {
          console.error('Failed to recover state:', recoveryError);
          // Clear potentially corrupted state
          localStorage.removeItem('lastState');
        }
      }
    }

    initSession();
  }, []);

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!sessionId || !currentCard || !deck || isLoading) return;

    setIsLoading(true);
    try {
      // Verify we can swipe the current card
      const current = deck.getCurrentCard();
      if (!current) {
        setIsLoading(false);
        return; // Safety check
      }

      // Get current session version
      const validateResponse = await fetch(`/api/v1/session/validate?sessionId=${sessionId}`);
      const validateData = await validateResponse.json();
      
      if (!validateResponse.ok || !validateData.isValid) {
        throw new Error('Session invalid or expired');
      }

      const response = await fetch('/api/v1/swipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          cardId: currentCard.uuid,
          direction,
          version: validateData.version
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record swipe');
      }

      // Record swipe in deck after successful API call
      deck.recordSwipe(direction);

      if (direction === 'right') {
        // Handle voting requirements from response
        if (data.requiresVoting) {
          // Save current state for potential recovery
          localStorage.setItem('lastState', JSON.stringify({
            cardId: current.uuid,
            deckState: deck.serialize()
          }));
          
          // Transition to voting phase
          router.push(`/vote?sessionId=${sessionId}&cardId=${current.uuid}`);
          return;
        }
      }

      // Get next card after swipe
      const nextCard = deck.getCurrentCard();
      setCurrentCard(nextCard);
      
      // Update personal ranking for right swipes
      if (direction === 'right') {
        const rankingResponse = await fetch(`/api/v1/ranking?sessionId=${sessionId}`);
        const rankingData = await rankingResponse.json();
        if (rankingResponse.ok) {
          setPersonalRanking(rankingData.ranking);
        }
      }
      
      // If deck is exhausted, handle completion
      if (deck.isExhausted()) {
        // Show loading indicator while finalizing
        setCurrentCard(null);
        const finalRankingResponse = await fetch(`/api/v1/ranking?sessionId=${sessionId}`);
        const finalRankingData = await finalRankingResponse.json();
        if (finalRankingResponse.ok) {
          setPersonalRanking(finalRankingData.ranking);
        }
        
        // Clean up local storage
        localStorage.removeItem('lastState');
        localStorage.removeItem('sessionId');
        
        // Show completion state
        router.push('/completed');
      }
    } catch (error) {
      console.error('Failed to handle swipe:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to process your request. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentCard, deck, router, isLoading]);

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
            localStorage.removeItem('sessionId');
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

  // Handle loading state
  if (!sessionId || !currentCard) {
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
        {currentCard && (
          <SwipeCard
            key={currentCard.uuid}
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
                key={cardId}
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
