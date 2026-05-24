import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Button, Center, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { calculateCardSize } from '../lib/utils/cardSizing';
import { PlaySwipeSurface } from '../components/play/PlaySwipeSurface';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { useSurveyGate } from '../lib/hooks/useSurveyGate';

// FUNCTIONAL: Pure SwipeOnly game interface - completely independent from existing play system
// STRATEGIC: Simple, clean swipe-based ranking without any voting complexity

export default function SwipeOnly() {
  const router = useRouter();
  const { org, deck } = router.query;

  const [session, setSession] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [cardConfig, setCardConfig] = useState(null);

  useSurveyGate(org);

  useEffect(() => {
    if (org && deck) {
      startSwipeSession();
    }
  }, [org, deck]);

  // FUNCTIONAL: Initialize SwipeOnly session using dedicated API
  // STRATEGIC: Pure swipe workflow - no hierarchical or voting state management
  const startSwipeSession = async () => {
    try {
      console.log('🎆 Starting SwipeOnly session for deck:', deck);
      
      const res = await fetch('/api/swipe-only/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org, deckTag: deck })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('✅ SwipeOnly session created:', data.playId);
        
        setSession(data);
        setProgress(data.progress);
        
        // Get first card
        await getCurrentCard(data.playId);
      } else {
        const error = await res.json();
        notifications.show({ color: 'red', message: error.error });
        router.push(`/play?org=${org}`);
      }
    } catch (error) {
      console.error('Failed to start SwipeOnly session:', error);
      notifications.show({ color: 'red', message: 'Failed to start swipe session' });
      router.push(`/play?org=${org}`);
    } finally {
      setLoading(false);
    }
  };

  // FUNCTIONAL: Get current card for swiping
  // STRATEGIC: Simple card retrieval for swipe-only interface
  const getCurrentCard = async (playId) => {
    try {
      const res = await fetch(`/api/swipe-only/${playId}/current`);
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          setCompleted(true);
          setCurrentCard(null);
        } else {
          setCurrentCard(data.currentCard);
          setProgress(data.progress);
        }
      } else {
        console.error('Failed to get current card');
      }
    } catch (error) {
      console.error('Error getting current card:', error);
    }
  };

  // FUNCTIONAL: Process swipe action
  // STRATEGIC: Pure swipe processing - left = dislike, right = like
  const handleSwipe = async (direction) => {
    if (!session || !currentCard) return;

    try {
      const res = await fetch(`/api/swipe-only/${session.playId}/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: currentCard.id,
          direction
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          setCompleted(true);
          setCurrentCard(null);
          
          // Redirect to results after a short delay
          setTimeout(() => {
            router.push(`/swipe-only-results?playId=${session.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
          }, 1500);
        } else {
          // Get next card
          await getCurrentCard(session.playId);
        }
        
        setProgress(data.progress);
      } else {
        const error = await res.json();
        notifications.show({ color: 'red', message: error.error });
      }
    } catch (error) {
      console.error('Failed to process swipe:', error);
      notifications.show({ color: 'red', message: 'Failed to process swipe' });
    }
  };

  // FUNCTIONAL: Handle keyboard controls
  // STRATEGIC: Accessible swipe controls - left arrow = dislike, right arrow = like
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (currentCard && !loading) {
        if (event.code === 'ArrowLeft') {
          event.preventDefault();
          handleSwipe('left');
        } else if (event.code === 'ArrowRight') {
          event.preventDefault();
          handleSwipe('right');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setCardConfig(calculateCardSize(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (loading) {
    return (
      <Center mih="100vh">
        <Stack align="center" gap="sm">
          <Loader />
          <Text>Starting swipe session…</Text>
        </Stack>
      </Center>
    );
  }

  if (completed) {
    return (
      <PublicShell>
        <Stack align="center" gap="md" py="xl">
          <NarimatoPageHeader title="Swipe complete" subtitle="Redirecting to results…" />
          {session ? (
            <Button
              component={Link}
              href={`/swipe-only-results?playId=${session.playId}&org=${org}&deck=${encodeURIComponent(deck)}`}
            >
              View results
            </Button>
          ) : null}
        </Stack>
      </PublicShell>
    );
  }

  if (!currentCard || !cardConfig) {
    return (
      <PublicShell>
        <Stack align="center" gap="md" py="xl">
          <NarimatoPageHeader title="No cards available" />
          <Button component={Link} href={`/play?org=${org}`} variant="light">
            Back to play
          </Button>
        </Stack>
      </PublicShell>
    );
  }

  return (
    <PlaySwipeSurface
      currentCard={currentCard}
      cardConfig={cardConfig}
      swipeDrag={{ dx: 0, animating: false }}
      swipeTransition={null}
      isOnboarding={false}
      showLevelBadge={false}
      hierarchicalLevel={1}
      onSwipeTouchStart={() => {}}
      onSwipeTouchMove={() => {}}
      onSwipeTouchEnd={() => {}}
      onSwipePointerDown={() => {}}
      onSwipePointerMove={() => {}}
      onSwipePointerUp={() => {}}
      onSwipeLeft={() => handleSwipe('left')}
      onSwipeRight={() => handleSwipe('right')}
      keyboardActive={null}
    />
  );
}
