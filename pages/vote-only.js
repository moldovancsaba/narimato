import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// FUNCTIONAL: Pure VoteOnly game interface - completely independent from existing play system
// STRATEGIC: Tournament-style comparison voting without any swiping complexity

export default function VoteOnly() {
  const router = useRouter();
  const { org, deck } = router.query;

  const [session, setSession] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (org && deck) {
      startVoteSession();
    }
  }, [org, deck]);

  // FUNCTIONAL: Initialize VoteOnly session using dedicated API
  // STRATEGIC: Pure tournament workflow - no hierarchical or swiping state management
  const startVoteSession = async () => {
    try {
      console.log('🎆 Starting VoteOnly session for deck:', deck);
      
      const res = await fetch('/api/vote-only/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org, deckTag: deck })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('✅ VoteOnly session created:', data.playId);
        
        setSession(data);
        setProgress(data.progress);
        
        // Get first comparison
        if (data.currentComparison) {
          setComparison(data.currentComparison);
        } else {
          await getCurrentComparison(data.playId);
        }
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        router.push(`/play?org=${org}`);
      }
    } catch (error) {
      console.error('Failed to start VoteOnly session:', error);
      alert('Failed to start vote session');
      router.push(`/play?org=${org}`);
    } finally {
      setLoading(false);
    }
  };

  // FUNCTIONAL: Get current comparison for voting
  // STRATEGIC: Tournament comparison retrieval for vote-only interface
  const getCurrentComparison = async (playId) => {
    try {
      const res = await fetch(`/api/vote-only/${playId}/comparison`);
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          setCompleted(true);
          setComparison(null);
        } else {
          setComparison(data.comparison);
          setProgress(data.progress);
        }
      } else {
        console.error('Failed to get current comparison');
      }
    } catch (error) {
      console.error('Error getting current comparison:', error);
    }
  };

  // FUNCTIONAL: Process vote action
  // STRATEGIC: Pure tournament voting - submit winner of head-to-head comparison
  const handleVote = async (winner) => {
    if (!session || !comparison) return;

    try {
      const res = await fetch(`/api/vote-only/${session.playId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardA: comparison.cardA.id,
          cardB: comparison.cardB.id,
          winner: winner.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          setCompleted(true);
          setComparison(null);
          
          // Redirect to results after a short delay
          setTimeout(() => {
            router.push(`/vote-only-results?playId=${session.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
          }, 1500);
        } else if (data.nextComparison) {
          setComparison(data.nextComparison);
        } else {
          // Get next comparison
          await getCurrentComparison(session.playId);
        }
        
        setProgress(data.progress);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to process vote:', error);
      alert('Failed to process vote');
    }
  };

  // FUNCTIONAL: Handle keyboard controls
  // STRATEGIC: Accessible vote controls - left arrow = left card, right arrow = right card
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (comparison && !loading) {
        if (event.code === 'ArrowLeft') {
          event.preventDefault();
          handleVote(comparison.cardA);
        } else if (event.code === 'ArrowRight') {
          event.preventDefault();
          handleVote(comparison.cardB);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [comparison, loading]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>🏆 Starting Tournament...</h2>
        <p>Preparing card comparisons</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🎉 Tournament Complete!</h1>
        <p>You've completed all the comparisons.</p>
        <p>Redirecting to results...</p>
        <div style={{ marginTop: '2rem' }}>
          <Link href={`/vote-only-results?playId=${session.playId}&org=${org}&deck=${encodeURIComponent(deck)}`}>
            View Results
          </Link>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No comparisons available</h2>
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
      background: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)'
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
        🗳️ Tournament: {progress?.comparisonsCompleted || 0} / {progress?.comparisonsNeeded || 0} comparisons
      </div>

      {/* VS Header */}
      <div style={{
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        marginBottom: '2rem',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        Which is better?
      </div>

      {/* Comparison Cards */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '900px',
        width: '100%'
      }}>
        {/* Card A */}
        <div
          onClick={() => handleVote(comparison.cardA)}
          style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '350px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            border: '3px solid transparent'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-10px)';
            e.target.style.boxShadow = '0 25px 50px rgba(0,0,0,0.15)';
            e.target.style.borderColor = '#4ecdc4';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)';
            e.target.style.borderColor = 'transparent';
          }}
        >
          <h3 style={{ color: '#333', marginBottom: '1rem' }}>
            {comparison.cardA.title}
          </h3>
          
          {comparison.cardA.description && (
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              {comparison.cardA.description}
            </p>
          )}
          
          {comparison.cardA.imageUrl && (
            <img 
              src={comparison.cardA.imageUrl} 
              alt={comparison.cardA.title}
              style={{
                maxWidth: '100%',
                maxHeight: '150px',
                borderRadius: '10px',
                marginBottom: '1rem'
              }}
            />
          )}

          <div style={{
            background: '#4ecdc4',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            fontSize: '0.9rem',
            fontWeight: '500',
            display: 'inline-block'
          }}>
            Click to choose ←
          </div>
        </div>

        {/* VS Separator */}
        <div style={{
          color: 'white',
          fontSize: '3rem',
          fontWeight: 'bold',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          margin: '0 1rem'
        }}>
          VS
        </div>

        {/* Card B */}
        <div
          onClick={() => handleVote(comparison.cardB)}
          style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '350px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            border: '3px solid transparent'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-10px)';
            e.target.style.boxShadow = '0 25px 50px rgba(0,0,0,0.15)';
            e.target.style.borderColor = '#ff6b6b';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)';
            e.target.style.borderColor = 'transparent';
          }}
        >
          <h3 style={{ color: '#333', marginBottom: '1rem' }}>
            {comparison.cardB.title}
          </h3>
          
          {comparison.cardB.description && (
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              {comparison.cardB.description}
            </p>
          )}
          
          {comparison.cardB.imageUrl && (
            <img 
              src={comparison.cardB.imageUrl} 
              alt={comparison.cardB.title}
              style={{
                maxWidth: '100%',
                maxHeight: '150px',
                borderRadius: '10px',
                marginBottom: '1rem'
              }}
            />
          )}

          <div style={{
            background: '#ff6b6b',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            fontSize: '0.9rem',
            fontWeight: '500',
            display: 'inline-block'
          }}>
            → Click to choose
          </div>
        </div>
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
        Choose the better option • Use arrow keys or click • Tournament ranking
      </div>
    </div>
  );
}
