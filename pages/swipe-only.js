import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

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
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
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
          style={{
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            fontSize: '2.5rem',
            cursor: 'pointer',
            boxShadow: '0 5px 15px rgba(255,107,107,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
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
          style={{
            background: '#4ecdc4',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            fontSize: '2.5rem',
            cursor: 'pointer',
            boxShadow: '0 5px 15px rgba(78,205,196,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
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
