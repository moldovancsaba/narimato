'use client';

import React, { useState } from 'react';
import { CardContainer } from './CardContainer';
import { cn, cssVar } from '@/lib/theme/utils';
import { useRouter } from 'next/navigation';
import { safeDate } from '@/utils/date';
import { LoadingSpinner } from './loading-spinner';

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
  projectId?: string;
}

export function VoteSystem({ cards, projectId }: VoteSystemProps) {
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
        body: JSON.stringify({
          winnerId: winner.id,
          loserId: loser.id,
          projectId
        }),
      });
      console.log('Vote response:', await response.clone().json());
      if (!response.ok) throw new Error('Failed to record vote');
      setCurrentPair(([first, second]) => [second, (second + 1) % cards.length]);
      router.refresh();
    } catch (error) {
      console.error('Error recording vote:', error);
      const errorMessage = error instanceof Error && error.message === 'Failed to record vote'
        ? 'Failed to record vote. Please try again.'
        : projectId
          ? `Failed to record project vote for ${projectId}. Please try again.`
          : 'Failed to record vote. Please try again.';
      setError(errorMessage);
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
    <div 
      className={cn(
        'flex flex-col items-center w-full',
        `space-y-[${cssVar('space-4')}]`
      )}
      role="region"
      aria-label="Card voting system"
    >
      {error && (
<div
          className={cn(
            `text-[${cssVar('error')}]`,
            'text-center',
            `p-[${cssVar('space-2')}]`,
            `rounded-[${cssVar('radius-md')}]`,
            `bg-[${cssVar('error-light')}]/10`
          )}
        >
          {error}
        </div>
      )}
{isVoting && (
<div
    className={cn(
      'fixed inset-0',
      `bg-[${cssVar('foreground')}]/20`,
      'flex items-center justify-center',
      `z-[${cssVar('z-modal')}]`
    )}
  >
<div
      className={cn(
        `bg-[${cssVar('background')}]`,
        `p-[${cssVar('space-6')}]`,
        `rounded-[${cssVar('radius-lg')}]`,
        `shadow-[${cssVar('shadow-lg')}]`
      )}
    >
      <LoadingSpinner size="lg" />
    </div>
  </div>
)}
<div
        className={cn(
          'flex flex-col lg:flex-row w-full',
          'justify-center items-center',
          `gap-[${cssVar('space-6')}] lg:gap-[${cssVar('space-12')}]`
        )}
        role="group"
        aria-label="Cards to compare"
      >
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
containerClassName={cn(
            'cursor-pointer',
            'transform transition-transform',
            `duration-[${cssVar('duration-normal')}]`,
            'hover:scale-105'
          )}
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
containerClassName={cn(
            'cursor-pointer',
            'transform transition-transform',
            `duration-[${cssVar('duration-normal')}]`,
            'hover:scale-105'
          )}
          isInteractive
        />
      </div>
    </div>
  );
}
