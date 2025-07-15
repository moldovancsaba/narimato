'use client';

import { useState, useEffect } from 'react';
import SwipeController from '@/components/ui/SwipeController';
import { ICard } from '@/models/Card';
import { Paper, Typography, Button, Stack } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function SwipePage() {
  const router = useRouter();
  const [currentCard, setCurrentCard] = useState<ICard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNextCard();
  }, []);

  const fetchNextCard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cards/random');
      const data = await response.json();
      
      if (response.status === 404) {
        setCurrentCard(null);
      } else if (!response.ok) {
        throw new Error('Failed to fetch next card');
      } else {
        setCurrentCard(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record swipe');
      }

      // Fetch next card after successful swipe
      await fetchNextCard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process swipe');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse w-[min(100vw,500px)] aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Paper className="p-6 max-w-md text-center">
          <Typography variant="h6" color="error" gutterBottom>
            Error
          </Typography>
          <Typography paragraph>{error}</Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Paper>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Paper className="p-6 max-w-md text-center">
          <Typography variant="h6" gutterBottom>
            No More Cards to Swipe!
          </Typography>
          <Typography paragraph>
            You've rated all available cards. Time to vote on the best ones!
          </Typography>
          <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={() => router.push('/vote')}>
              Go to Voting
            </Button>
            <Button variant="outlined" onClick={() => router.refresh()}>
              Check Again
            </Button>
          </Stack>
        </Paper>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Typography variant="h6" className="mb-8 text-center">
        Swipe right to like, left to skip
        <br />
        <span className="text-sm text-gray-500">
          (or use arrow keys ← →)
        </span>
      </Typography>

      <SwipeController card={currentCard} onSwipe={handleSwipe} />

      <div className="mt-8 flex gap-4">
        <Button
          variant="outlined"
          onClick={() => handleSwipe('left')}
          className="w-24"
        >
          Skip
        </Button>
        <Button
          variant="contained"
          onClick={() => handleSwipe('right')}
          className="w-24"
        >
          Like
        </Button>
      </div>
    </div>
  );
}
