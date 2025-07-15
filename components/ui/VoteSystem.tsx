'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { safeDate } from '@/utils/date';

interface VoteSystemProps {
  cards: {
    id: string;
    content: string;
    title: string;
    description?: string;
    type: 'image' | 'text';
    hashtags: string[];
    imageAlt?: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  }[];
}

export function VoteSystem({ cards }: VoteSystemProps) {
  const [currentPair, setCurrentPair] = useState([0, 1]);
  const [isVoting, setIsVoting] = useState(false);
  const router = useRouter();

  const handleVote = async (winnerIndex: number) => {
    if (isVoting) return;
    setIsVoting(true);
    const winnerId = cards[currentPair[winnerIndex]].id;
    const loserId = cards[currentPair[1 - winnerIndex]].id;

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          winnerId: winnerId,
          loserId: loserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record vote');
      }

      // Move to next pair
      setCurrentPair(([first, second]) => [second, (second + 1) % cards.length]);
      
      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error('Error recording vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  // Safely get the cards for the current pair
  const getCard = (index: number) => {
    if (!cards || !cards[index]) {
      return {
        id: '',
        content: '',
        title: 'No card available',
        description: '',
        type: 'text' as const,
        hashtags: [],
        imageAlt: '',
        slug: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return cards[index];
  };

  const firstCard = getCard(currentPair[0]);
  const secondCard = getCard(currentPair[1]);

  return (
    <div 
      className="flex flex-col items-center w-full"
      role="region"
      aria-label="Card voting system"
    >
      <div 
        className="flex flex-col lg:flex-row w-full justify-center items-center gap-6 lg:gap-12"
        role="group"
        aria-label="Cards to compare"
      >
        <Card
          {...firstCard}
          createdAt={safeDate(firstCard.createdAt)}
          updatedAt={safeDate(firstCard.updatedAt)}
          onClick={() => handleVote(0)}
        />
        <Card
          {...secondCard}
          createdAt={safeDate(secondCard.createdAt)}
          updatedAt={safeDate(secondCard.updatedAt)}
          onClick={() => handleVote(1)}
        />
      </div>
      <div className="mt-6">
        <button
          onClick={() => handleVote(0)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition mr-4"
          disabled={isVoting}
          aria-label={`Vote for ${firstCard.title}`}
          aria-disabled={isVoting}
        >
          Vote Left
        </button>
        <button
          onClick={() => handleVote(1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          disabled={isVoting}
          aria-label={`Vote for ${secondCard.title}`}
          aria-disabled={isVoting}
        >
          Vote Right
        </button>
      </div>
    </div>
  );
}
