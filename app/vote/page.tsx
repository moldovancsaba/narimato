'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VoteCard from '../components/VoteCard';
import { RankingEntity } from '@/app/lib/models/RankingEntity';

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
  const [cardA, setCardA] = useState<Card | null>(null);
  const [cardB, setCardB] = useState<Card | null>(null);
  const [ranking, setRanking] = useState<RankingEntity | null>(null);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sessionVersion, setSessionVersion] = useState<number>(0);

  const sessionId = searchParams.get('sessionId');
  const cardId = searchParams.get('cardId');

  useEffect(() => {
    // Load both cards for comparison and get current session version
    async function loadComparison() {
      if (!sessionId || !cardId) {
        router.push('/swipe');
        return;
      }

      try {
        // Get current session version for optimistic locking
        const sessionResponse = await fetch(`/api/v1/session/validate?sessionId=${sessionId}`);
        const sessionData = await sessionResponse.json();
        
        if (sessionResponse.ok && sessionData.isValid) {
          setSessionVersion(sessionData.version);
        }
        
        const response = await fetch(`/api/v1/vote/comparison?sessionId=${sessionId}&cardId=${cardId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load comparison');
        }

        // Initialize ranking with comparison cards
        const newRanking = new RankingEntity();
        newRanking.insertFirstCard(data.cardA);
        setRanking(newRanking);
        
        // Set initial comparison
        setCardA(data.cardA);
        setCardB(data.cardB);
      } catch (error) {
        console.error('Failed to load comparison:', error);
      }
    }

    loadComparison();
  }, [sessionId, cardId, router]);

  const handleSelect = async (winner: 'A' | 'B') => {
    if (isAnimating || !sessionId || !cardA || !cardB) return;

    setSelected(winner);
    setIsAnimating(true);
    // Add transition animation
    document.body.classList.add('animating');

    try {
      const response = await fetch('/api/v1/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          cardA: cardA.uuid,
          cardB: cardB.uuid,
          winner: winner === 'A' ? cardA.uuid : cardB.uuid,
          version: sessionVersion,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record vote');
      }

      // Update session version for next requests (optimistic locking)
      if (data.version) {
        setSessionVersion(data.version);
      }

      // Handle next comparison or completion
      const handleNextComparison = async () => {
        if (data.nextComparison) {
          // Load next comparison
          const nextCardA = data.nextComparison.newCard;
          const nextCardB = data.nextComparison.compareAgainst;

          // Get new comparison cards
          const response = await fetch(`/api/v1/vote/comparison?sessionId=${sessionId}&cardId=${nextCardA.uuid}`);
          const comparisonData = await response.json();
          
          if (response.ok) {
            // Create new ranking with next comparison pair
            const newRanking = new RankingEntity();
            newRanking.insertFirstCard(comparisonData.cardA);
            setRanking(newRanking);
            
            // Set next comparison
            setCardA(comparisonData.cardA);
            setCardB(comparisonData.cardB);
          } else {
            throw new Error(comparisonData.error || 'Failed to load next comparison');
          }
          setSelected(null);
          setIsAnimating(false);
        } else {
          // No more comparisons needed, meaning we've found the card's final position
          // Return to swipe page to continue with new cards
          router.push('/swipe');
        }
      };
      
      // Wait for animation, then handle next comparison
      setTimeout(handleNextComparison, 500); // Match animation duration
    } catch (error) {
      console.error('Failed to handle vote:', error);
      alert('An error occurred while processing your vote. Please try again.');
      setSelected(null);
      setIsAnimating(false);
      // Remove animation class
      document.body.classList.remove('animating');
    }
  };

  // Handle keyboard input
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
  }, [isAnimating]);

  if (!cardA || !cardB) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-16">
      <h1 className="text-2xl font-bold mb-8">Which do you prefer?</h1>
      
      <div className="flex justify-center items-center space-x-4">
        <VoteCard
          {...cardA}
          position="left"
          onSelect={() => handleSelect('A')}
          isSelected={selected === 'A'}
        />
        <VoteCard
          {...cardB}
          position="right"
          onSelect={() => handleSelect('B')}
          isSelected={selected === 'B'}
        />
      </div>

      <div className="mt-8 text-center text-gray-500">
        <p className="text-sm">Use left/right arrow keys or click to choose</p>
      </div>
    </div>
  );
}
