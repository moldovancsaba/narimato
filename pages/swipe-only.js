import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { haptics } from '../lib/utils/haptics';
import { GESTURE } from '../lib/constants/gestures';

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
  const cardRef = useRef(null);
  const [cardBumpKey, setCardBumpKey] = useState(0); // rerun micro-bump animation by changing key/class toggle

  // FUNCTIONAL: Touch-swipe gesture state (vanilla touch + pointer + mouse)
  // STRATEGIC: Dependency-free swipe handling using centralized thresholds; avoids adding new packages
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const draggingRef = useRef(false);
  const lockedHorizontalRef = useRef(false);
  const swipeInFlightRef = useRef(false);
  const lastDxRef = useRef(0);
  const wheelDxRef = useRef(0);
  const wheelTimerRef = useRef(null);

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
      
      const res = await fetch('/api/v1/play/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org, deckTag: deck, mode: 'swipe_only' })
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
        alert(`Error: ${error.error}`);
        router.push(`/play?org=${org}`);
      }
    } catch (error) {
      console.error('Failed to start SwipeOnly session:', error);
      alert('Failed to start swipe session');
      router.push(`/play?org=${org}`);
    } finally {
      setLoading(false);
    }
  };

  // FUNCTIONAL: Get current card for swiping
  // STRATEGIC: Simple card retrieval for swipe-only interface
  const getCurrentCard = async (playId) => {
    try {
      const res = await fetch(`/api/v1/play/${playId}/next`);
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          setCompleted(true);
          setCurrentCard(null);
        } else {
          setCurrentCard(data.currentCard || data.card || null);
          setProgress(data.progress || null);
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

    // Perceptual feedback on recognition (immediate)
    try { await haptics.light(); } catch (e) { /* noop */ }

    // Trigger a micro-bump on the card for visual confirmation
    try {
      // Toggle class by updating a state-driven key; CSS handles reduced-motion via global rules
      setCardBumpKey((k) => k + 1);
      if (cardRef.current) {
        cardRef.current.classList.remove('micro-bump');
        // Force reflow to restart animation consistently
        void cardRef.current.offsetWidth; // eslint-disable-line no-unused-expressions
        cardRef.current.classList.add('micro-bump');
      }
    } catch (_e) { /* noop */ }

    try {
      const res = await fetch(`/api/v1/play/${session.playId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'swipe',
          payload: {
            cardId: currentCard.id,
            direction
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          setCompleted(true);
          setCurrentCard(null);
          
          // Perceptual success feedback
          try { await haptics.success(); } catch (e) { /* noop */ }

          // Redirect to results after a short delay
          setTimeout(() => {
            router.push(`/swipe-only-results?playId=${session.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
          }, 1500);
        } else {
          // Get next card
          await getCurrentCard(session.playId);

          // Success feedback for accepted swipe (next card loaded)
          try { await haptics.success(); } catch (e) { /* noop */ }
        }
        
        setProgress(data.progress);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to process swipe:', error);
      alert('Failed to process swipe');
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

  // FUNCTIONAL: Attach touch event listeners to enable left/right swipes
  // STRATEGIC: Portable, minimal implementation with velocity and threshold heuristics
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !currentCard) return;

    const getThresholdPx = () => {
      try {
        const w = el.offsetWidth || window.innerWidth || 320;
        return w * (GESTURE?.SWIPE_THRESHOLD_RATIO || 0.2);
      } catch (_e) {
        return 60; // fallback
      }
    };

    const resetTransform = () => {
      try {
        el.style.transition = 'transform 200ms ease-out';
        el.style.transform = 'translateX(0px) rotate(0deg)';
        // Remove transition after it applies to avoid affecting future drags
        setTimeout(() => { if (el) el.style.transition = ''; }, 220);
      } catch (_e) { /* noop */ }
    };

    const onTouchStart = (e) => {
      if (!currentCard || loading || swipeInFlightRef.current) return;
      if (e.touches && e.touches.length > 0) {
        const t = e.touches[0];
        touchStartXRef.current = t.clientX;
        touchStartYRef.current = t.clientY;
        touchStartTimeRef.current = Date.now();
        draggingRef.current = true;
        lockedHorizontalRef.current = false;
        try { haptics.light(); } catch (_e) {}
      }
    };

    const onTouchMove = (e) => {
      if (!draggingRef.current || !currentCard || loading) return;
      if (!e.touches || e.touches.length === 0) return;

      const t = e.touches[0];
      const dx = t.clientX - touchStartXRef.current;
      const dy = t.clientY - touchStartYRef.current;

      // Lock to horizontal when intent is clear; prevent page scroll
      if (!lockedHorizontalRef.current) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          lockedHorizontalRef.current = true;
        }
      }
      if (lockedHorizontalRef.current && e.cancelable) {
        e.preventDefault();
      }

      // Apply visual drag transform (subtle rotate)
      const rot = Math.max(-15, Math.min(15, dx / 20));
      try {
        el.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
        lastDxRef.current = dx;
      } catch (_e) { /* noop */ }
    };

    const onTouchEnd = async (_e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      const dt = Math.max(1, Date.now() - touchStartTimeRef.current);
      const dx = lastDxRef.current || 0;

      const velocity = Math.abs(dx) / dt; // px/ms
      const threshold = getThresholdPx();
      const isSwipe = Math.abs(dx) > threshold || velocity > (GESTURE?.SWIPE_VELOCITY_MIN || 0.3);
      if (!isSwipe) {
        resetTransform();
        return;
      }

      // Determine direction and trigger action
      const direction = dx > 0 ? 'right' : 'left';
      if (swipeInFlightRef.current) return;
      swipeInFlightRef.current = true;

      try {
        await haptics.light();
      } catch (_e) {}

      // Animate card quickly off-screen in swipe direction for feedback
      try {
        const offX = direction === 'right' ? window.innerWidth : -window.innerWidth;
        el.style.transition = 'transform 180ms ease-out';
        el.style.transform = `translateX(${offX}px) rotate(${direction === 'right' ? 20 : -20}deg)`;
      } catch (_e) { /* noop */ }

      try {
        await handleSwipe(direction);
      } finally {
        swipeInFlightRef.current = false;
        // Reset for next card (next card render will overwrite transform)
        setTimeout(() => resetTransform(), 200);
      }
    };

    // Also support pointer and mouse drag for desktop devices
    const onPointerDown = (e) => {
      if (!currentCard || loading || swipeInFlightRef.current) return;
      // Only left button for mouse
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      touchStartXRef.current = e.clientX;
      touchStartYRef.current = e.clientY;
      touchStartTimeRef.current = Date.now();
      draggingRef.current = true;
      lockedHorizontalRef.current = false;
      lastDxRef.current = 0;
      try { haptics.light(); } catch (_e) {}
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    };

    const onPointerMove = (e) => {
      if (!draggingRef.current || !currentCard || loading) return;
      const dx = e.clientX - touchStartXRef.current;
      const dy = e.clientY - touchStartYRef.current;
      if (!lockedHorizontalRef.current) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          lockedHorizontalRef.current = true;
        }
      }
      if (lockedHorizontalRef.current && e.cancelable) e.preventDefault();
      const rot = Math.max(-15, Math.min(15, dx / 20));
      try {
        el.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
        lastDxRef.current = dx;
      } catch (_e) {}
    };

    const onPointerUp = async (_e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';

      const dt = Math.max(1, Date.now() - touchStartTimeRef.current);
      const dx = lastDxRef.current || 0;
      const velocity = Math.abs(dx) / dt;
      const threshold = getThresholdPx();
      const isSwipe = Math.abs(dx) > threshold || velocity > (GESTURE?.SWIPE_VELOCITY_MIN || 0.3);
      if (!isSwipe) { resetTransform(); return; }
      const direction = dx > 0 ? 'right' : 'left';
      if (swipeInFlightRef.current) return;
      swipeInFlightRef.current = true;
      try { await haptics.light(); } catch (_e) {}
      try {
        const offX = direction === 'right' ? window.innerWidth : -window.innerWidth;
        el.style.transition = 'transform 180ms ease-out';
        el.style.transform = `translateX(${offX}px) rotate(${direction === 'right' ? 20 : -20}deg)`;
      } catch (_e) {}
      try {
        await handleSwipe(direction);
      } finally {
        swipeInFlightRef.current = false;
        setTimeout(() => resetTransform(), 200);
      }
    };

    const onTouchCancel = () => {
      draggingRef.current = false;
      lastDxRef.current = 0;
      resetTransform();
    };

    // Trackpad two-finger horizontal swipe (wheel) support (desktop Safari)
    const onWheel = async (e) => {
      // Only handle predominantly horizontal scroll gestures
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      const threshold = getThresholdPx();

      wheelDxRef.current += e.deltaX;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => { wheelDxRef.current = 0; }, 200);

      if (Math.abs(wheelDxRef.current) > threshold && !swipeInFlightRef.current && currentCard && !loading) {
        if (e.cancelable) e.preventDefault();
        const direction = wheelDxRef.current > 0 ? 'right' : 'left';
        wheelDxRef.current = 0;
        swipeInFlightRef.current = true;
        try { await haptics.light(); } catch (_e) {}
        try { await handleSwipe(direction); }
        finally { swipeInFlightRef.current = false; }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchCancel, { passive: false });

    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp, { passive: false });
    el.addEventListener('pointercancel', onTouchCancel, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);

      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onTouchCancel);
      el.removeEventListener('wheel', onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      resetTransform();
    };
  }, [currentCard, loading]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>🎆 Starting Swipe Session...</h2>
        <p>Preparing cards for swiping</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🎉 Swipe Complete!</h1>
        <p>You've finished swiping through all the cards.</p>
        <p>Redirecting to results...</p>
        <div style={{ marginTop: '2rem' }}>
          <Link href={`/swipe-only-results?playId=${session.playId}&org=${org}&deck=${encodeURIComponent(deck)}`}>
            View Results
          </Link>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No cards available</h2>
        <Link href={`/play?org=${org}`}>← Back to deck selection</Link>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Progress Bar */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.9)',
        padding: '0.5rem 1rem',
        borderRadius: '20px',
        fontSize: '0.9rem',
        fontWeight: '500',
        zIndex: 10
      }}>
        👆 Swipe Mode: {progress?.cardsCompleted || 0} / {progress?.totalCards || 0} cards
      </div>

      {/* Card Display */}
      <div
        ref={cardRef}
        className="game-card"
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          marginBottom: '2rem',
          touchAction: 'pan-y'
        }}
      >
        <h2 style={{ color: '#333', marginBottom: '1rem' }}>
          {currentCard.title}
        </h2>
        
        {currentCard.description && (
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            {currentCard.description}
          </p>
        )}
        
        {currentCard.imageUrl && (
          <img 
            src={currentCard.imageUrl} 
            alt={currentCard.title}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '10px',
              marginBottom: '1rem'
            }}
          />
        )}
      </div>

      {/* Swipe Buttons */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        alignItems: 'center'
      }}>
        <button
          onClick={() => handleSwipe('left')}
          onTouchStart={() => { try { haptics.light(); } catch (e) {} }}
          className="game-action-button dislike"
          style={{
            width: '80px',
            height: '80px',
            fontSize: '2.5rem'
          }}
        >
          👎
        </button>

        <div style={{
          color: 'white',
          fontSize: '1.2rem',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          <div>← Dislike | Like →</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Use arrow keys or click
          </div>
        </div>

        <button
          onClick={() => handleSwipe('right')}
          onTouchStart={() => { try { haptics.light(); } catch (e) {} }}
          className="game-action-button like"
          style={{
            width: '80px',
            height: '80px',
            fontSize: '2.5rem'
          }}
        >
          👍
        </button>
      </div>

      {/* Help Text */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontSize: '0.8rem',
        textAlign: 'center',
        opacity: 0.8
      }}>
        Swipe through all cards • Like = include in ranking • Dislike = exclude
      </div>
    </div>
  );
}
