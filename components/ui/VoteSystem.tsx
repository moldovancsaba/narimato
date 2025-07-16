'use client';

import React, { useState } from 'react';
import { CardContainer } from './CardContainer';
import { useRouter } from 'next/navigation';
import { safeDate } from '@/utils/date';
import { LoadingSpinner } from './LoadingSpinner';

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
  const [error, setError] = useState('');
  const router = useRouter();

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isVoting) return;
      if (e.key === 'ArrowLeft') handleVote(0);
      if (e.key === 'ArrowRight') handleVote(1);
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVoting]);

  const handleVote = async (winnerIndex: number) => {
    if (isVoting) {
      console.log('Vote already in progress, ignoring click');
      return;
    }
    
    const winner = cards[currentPair[winnerIndex]];
    const loser = cards[currentPair[1 - winnerIndex]];
    
    if (!winner?.id || !loser?.id) {
      console.error('Invalid card data:', { winner, loser });
      setError('Invalid card data. Please try refreshing the page.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setIsVoting(true);
    console.log('Starting vote process...');
    console.log('Selected cards:', { winner: winner.id, loser: loser.id });
    if (!winner || !loser) {
      console.error('Invalid card pair for voting');
      setIsVoting(false);
      return;
    }
    try {
      console.log('Sending vote request...');
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId: winner.id, loserId: loser.id }),
      });
      console.log('Vote response:', await response.clone().json());
      if (!response.ok) throw new Error('Failed to record vote');
      setCurrentPair(([first, second]) => [second, (second + 1) % cards.length]);
      router.refresh();
    } catch (error) {
      console.error('Error recording vote:', error);
      setError('Failed to record vote. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsVoting(false);
    }
  };

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
    <div className="flex flex-col items-center w-full space-y-4" role="region" aria-label="Card voting system">
      {error && (
        <div className="text-red-500 dark:text-red-400 text-center p-2 rounded bg-red-50 dark:bg-red-900/20">
          {error}
        </div>
      )}
      {isVoting && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50">
          <LoadingSpinner size="lg" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg" />
        </div>
      )}
      <div className="flex flex-col lg:flex-row w-full justify-center items-center gap-6 lg:gap-12" role="group" aria-label="Cards to compare">
        <CardContainer
          type={firstCard.type}
          content={firstCard.content}
          title={firstCard.title}
          description={firstCard.description}
          imageAlt={firstCard.imageAlt}
          hashtags={firstCard.hashtags}
          createdAt={safeDate(firstCard.createdAt)}
          updatedAt={safeDate(firstCard.updatedAt)}
          onClick={() => handleVote(0)}
          containerClassName="cursor-pointer hover:scale-105 transform transition-transform duration-200 ease-in-out"
          isInteractive
        />
        <CardContainer
          type={secondCard.type}
          content={secondCard.content}
          title={secondCard.title}
          description={secondCard.description}
          imageAlt={secondCard.imageAlt}
          hashtags={secondCard.hashtags}
          createdAt={safeDate(secondCard.createdAt)}
          updatedAt={safeDate(secondCard.updatedAt)}
          onClick={() => handleVote(1)}
          containerClassName="cursor-pointer"
          isInteractive
        />
      </div>
    </div>
  );
}
