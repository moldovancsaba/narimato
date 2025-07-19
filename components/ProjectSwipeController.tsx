'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface ProjectSwipeControllerProps {
  projectId: string;
}

export default function ProjectSwipeController({ projectId }: ProjectSwipeControllerProps) {
const [currentCard, setCurrentCard] = useState<{
    _id: string;
    type: 'image' | 'text';
    content: string;
    title: string;
    description?: string;
    slug: string;
    hashtags: string[];
    createdAt: string;
    updatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  // Fetch a new card from the project-specific endpoint
  const fetchNextCard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cards/random?projectId=${projectId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch next card');
      }

      const data = await response.json();
      setCurrentCard(data.card);
    } catch (err) {
      setError('Error fetching next card');
      console.error('Error fetching next card:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle swipe/vote action
  const handleVote = async (direction: 'left' | 'right') => {
    if (!currentCard) return;

    try {
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: currentCard._id,
          direction,
          projectId, // Include projectId to maintain project-specific rankings
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record vote');
      }

      // Fetch next card after successful vote
      fetchNextCard();
    } catch (err) {
      setError('Error recording vote');
      console.error('Error recording vote:', err);
    }
  };

  // Initial card fetch
  useEffect(() => {
    fetchNextCard();
  }, [projectId]);

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500">{error}</p>
        <Button 
          onClick={fetchNextCard}
variant="default"
          size="sm"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {loading ? (
        <p className="text-gray-500">Loading next card...</p>
      ) : (
        <>
          {currentCard && <Card {...currentCard} />}
          <div className="mt-4 space-x-2">
            <Button
              variant="destructive"
              size="lg"
              onClick={() => handleVote('left')}
              disabled={!currentCard}
            >
              Reject
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => handleVote('right')}
              disabled={!currentCard}
            >
              Accept
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
