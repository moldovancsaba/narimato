'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VoteCard from '../components/VoteCard';
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import { SESSION_FIELDS, CARD_FIELDS, VOTE_FIELDS } from '@/app/lib/constants/fieldNames';

interface Card {
  uuid: string;
  type: 'text' | 'media';
  content: {
    text?: string;
    mediaUrl?: string;
  };
  title?: string;
}

export default function VotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-xl">Loading...</div>
        </div>
      }
    >
      <VoteContent />
    </Suspense>
  );
}

function VoteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Essential state only - simplified from complex session management
  const [cardA, setCardA] = useState<Card | null>(null);
  const [cardB, setCardB] = useState<Card | null>(null);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState<number>(0);

  const sessionId = searchParams.get(SESSION_FIELDS.ID);
  const cardId = searchParams.get(CARD_FIELDS.ID);

  // Add no-scroll class to body to prevent scrolling
  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  // Load comparison data on mount - simplified without complex session validation
  useEffect(() => {
    async function loadComparison() {
      if (!sessionId || !cardId) {
        router.push('/swipe');
        return;
      }

      try {
        // Get session version first
        const sessionResponse = await fetch(`/api/v1/session/validate?${SESSION_FIELDS.ID}=${sessionId}&_t=${Date.now()}`);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.isValid) {
            setSessionVersion(sessionData[SESSION_FIELDS.VERSION]);
          }
        }
        
        const response = await fetch(`/api/v1/vote/comparison?${SESSION_FIELDS.ID}=${sessionId}&${CARD_FIELDS.ID}=${cardId}&_t=${Date.now()}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load comparison');
        }
        
        // Check if position is already determined
        if (data.positionDetermined) {
          console.log('Card position already determined, returning to swipe');
          router.push('/swipe');
          return;
        }
        
        setCardA(data[VOTE_FIELDS.CARD_A]);
        setCardB(data[VOTE_FIELDS.CARD_B]);
      } catch (error) {
        setError('Failed to load voting interface');
      }
    }

    loadComparison();
  }, [sessionId, cardId, router]);

  // Enhanced handleSelect function for voting with next comparison handling
  const handleSelect = async (winner: 'A' | 'B') => {
    console.log('handleSelect called:', { winner, isAnimating, sessionId: !!sessionId, cardA: !!cardA, cardB: !!cardB });
    
    if (isAnimating || !sessionId || !cardA || !cardB) {
      console.log('handleSelect blocked by conditions:', { isAnimating, sessionId: !!sessionId, cardA: !!cardA, cardB: !!cardB });
      return;
    }

    setSelected(winner);
    setIsAnimating(true);

    try {
      const response = await fetch('/api/v1/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [SESSION_FIELDS.ID]: sessionId,
          [VOTE_FIELDS.CARD_A]: cardA[CARD_FIELDS.UUID],
          [VOTE_FIELDS.CARD_B]: cardB[CARD_FIELDS.UUID],
          [VOTE_FIELDS.WINNER]: winner === 'A' ? cardA[CARD_FIELDS.UUID] : cardB[CARD_FIELDS.UUID],
          [VOTE_FIELDS.TIMESTAMP]: new Date().toISOString(),
          [SESSION_FIELDS.VERSION]: sessionVersion
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record vote');
      }

      // Update session version from response
      setSessionVersion(data.version);

      // Check if there's a next comparison needed
      if (data.nextComparison) {
        // Stay on vote page but load the next comparison
        const newCardA = data.nextComparison.newCard;
        const newCardB = data.nextComparison.compareAgainst;
        
        // Find the card objects for the next comparison
        const nextComparisonResponse = await fetch(`/api/v1/vote/comparison?${SESSION_FIELDS.ID}=${sessionId}&${CARD_FIELDS.ID}=${newCardA}&_t=${Date.now()}`);
        const nextComparisonData = await nextComparisonResponse.json();
        
        if (nextComparisonResponse.ok) {
          // Check if position is already determined
          if (nextComparisonData.positionDetermined) {
            console.log('Next card position already determined, returning to swipe');
            router.push('/swipe');
            return;
          }
          
          setCardA(nextComparisonData[VOTE_FIELDS.CARD_A]);
          setCardB(nextComparisonData[VOTE_FIELDS.CARD_B]);
          setSelected(null); // Reset selection for next comparison
        } else {
          throw new Error('Failed to load next comparison');
        }
      } else {
        // No more comparisons, check if deck is exhausted and redirect accordingly
        const deckResponse = await fetch(`/api/v1/deck?${SESSION_FIELDS.ID}=${sessionId}&_t=${Date.now()}`);
        if (deckResponse.ok) {
          const deckData = await deckResponse.json();
          const deck = new DeckEntity(deckData.deck);
          
          // If deck is exhausted, go to results page
          if (deck.isExhausted()) {
            console.log('Voting complete and deck exhausted, redirecting to completed page');
            router.push(`/completed?${SESSION_FIELDS.ID}=${sessionId}`);
          } else {
            // Still have cards to swipe, return to swipe page
            router.push('/swipe');
          }
        } else {
          // Fallback to swipe page if deck check fails
          router.push('/swipe');
        }
      }
    } catch (error) {
      console.error('Vote error:', error);
      setError('Failed to record your vote');
      setSelected(null);
    } finally {
      setIsAnimating(false);
    }
  };

  // Handle keyboard input for better UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;

      if (e.key === 'ArrowLeft') {
        handleSelect('A');
      } else if (e.key === 'ArrowRight') {
        handleSelect('B');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnimating, handleSelect]);

  // Render UI or error state
  if (!cardA || !cardB) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center mobile-safe-area">
        <div className="mobile-container text-center">
          <div className="content-card p-6 sm:p-8 max-w-md mx-auto">
            <div className="text-danger text-xl mb-4">Error</div>
            <p className="text-muted mb-4">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                router.push('/swipe');
              }}
              className="btn btn-primary w-full sm:w-auto"
            >
              Return to Swipe
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-background text-foreground p-4" style={{ paddingBottom: '80px' }}>
        {/* Header */}
        <div className="text-center mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-center">Vote to Rank</h1>
        </div>
        
        {/* Card Comparison */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-8 w-full max-w-4xl mx-auto">
          <div className="w-full max-w-xs sm:max-w-sm">
            <VoteCard
              {...cardA}
              position="left"
              onSelect={() => handleSelect('A')}
              isSelected={selected === 'A'}
            />
          </div>
          
          {/* VS Indicator */}
          <div className="vs-indicator">
            VS
          </div>
          
          <div className="w-full max-w-xs sm:max-w-sm">
            <VoteCard
              {...cardB}
              position="right"
              onSelect={() => handleSelect('B')}
              isSelected={selected === 'B'}
            />
          </div>
        </div>
        
        {/* Instructions */}
        <div className="text-center mt-6 sm:mt-8 pb-8">
          <p className="text-sm text-muted">
            <span className="hidden sm:inline">Use left/right arrow keys or </span>
            Tap to choose
          </p>
        </div>
      </div>
  );
}
