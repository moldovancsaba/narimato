import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Play() {
  const router = useRouter();
  const { org, deck } = router.query;

  const [organizations, setOrganizations] = useState([]);
  const [decks, setDecks] = useState([]);
  const [currentPlay, setCurrentPlay] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);
  const [votingContext, setVotingContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playComplete, setPlayComplete] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (org) {
      fetchDecks();
    }
  }, [org]);

  useEffect(() => {
    if (org && deck) {
      startPlay();
    }
  }, [org, deck]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDecks = async () => {
    try {
      const res = await fetch(`/api/cards?organizationId=${org}`);
      const data = await res.json();
      
      // Group into decks
      const deckGroups = {};
      data.cards?.forEach(card => {
        if (card.parentTag) {
          if (!deckGroups[card.parentTag]) {
            deckGroups[card.parentTag] = [];
          }
          deckGroups[card.parentTag].push(card);
        }
      });
      
      const playableDecks = Object.entries(deckGroups)
        .filter(([tag, cards]) => cards.length >= 2)
        .map(([tag, cards]) => ({ tag, cards }));
      
      setDecks(playableDecks);
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    }
  };

  const startPlay = async () => {
    try {
      const res = await fetch('/api/play/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org, deckTag: deck })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentPlay(data);
        setCurrentCard(data.cards.find(c => c.id === data.currentCardId));
        setVotingContext(null);
        setPlayComplete(false);
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to start play:', error);
      alert('Failed to start play session');
    }
  };

  const handleSwipe = async (direction) => {
    if (!currentPlay || !currentCard) return;

    try {
      const res = await fetch('/api/play/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playId: currentPlay.playId,
          cardId: currentCard.id,
          direction
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          // Redirect to results page
          router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
          return;
        } else if (data.requiresVoting) {
          setVotingContext(data.votingContext);
        } else if (data.nextCardId) {
          const nextCard = currentPlay.cards.find(c => c.id === data.nextCardId);
          setCurrentCard(nextCard);
        }
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to swipe:', error);
      alert('Failed to swipe card');
    }
  };

  const handleVote = async (winner) => {
    if (!votingContext) return;

    try {
      const res = await fetch('/api/play/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playId: currentPlay.playId,
          cardA: votingContext.newCard,
          cardB: votingContext.compareWith,
          winner
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          // Redirect to results page
          router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
          return;
        } else if (data.requiresMoreVoting) {
          setVotingContext(data.votingContext);
        } else if (data.returnToSwipe && data.nextCardId) {
          const nextCard = currentPlay.cards.find(c => c.id === data.nextCardId);
          setCurrentCard(nextCard);
          setVotingContext(null);
        } else {
          // Session completed
          router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
          return;
        }
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Failed to vote');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  // Organization selection
  if (!org) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/" style={{ color: '#0070f3' }}>← Back to Home</Link>
        </div>
        
        <h1>Play - Select Organization</h1>
        
        {organizations.length === 0 ? (
          <div>
            <p>No organizations found.</p>
            <Link href="/organizations">Create an organization first</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {organizations.map(organization => (
              <div key={organization.uuid} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>{organization.name}</h3>
                <Link href={`/play?org=${organization.uuid}`} style={{ padding: '0.5rem 1rem', background: '#ffc107', color: 'black', textDecoration: 'none', borderRadius: '4px' }}>
                  Select This Organization
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Deck selection
  if (!deck) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/play" style={{ color: '#0070f3' }}>← Back to Organizations</Link>
        </div>
        
        <h1>Play - Select Deck</h1>
        
        {decks.length === 0 ? (
          <div>
            <p>No playable decks found in this organization.</p>
            <Link href={`/cards?org=${org}`}>Add cards to create decks</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {decks.map(deckInfo => (
              <div key={deckInfo.tag} style={{ padding: '1rem', border: '2px solid #28a745', borderRadius: '4px' }}>
                <h3 style={{ color: '#28a745' }}>{deckInfo.tag} ({deckInfo.cards.length} cards)</h3>
                <div style={{ marginBottom: '1rem' }}>
                  {deckInfo.cards.slice(0, 3).map(card => (
                    <span key={card.uuid} style={{ display: 'inline-block', margin: '0.25rem', padding: '0.25rem 0.5rem', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {card.title}
                    </span>
                  ))}
                  {deckInfo.cards.length > 3 && (
                    <span style={{ padding: '0.25rem 0.5rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.75rem' }}>
                      +{deckInfo.cards.length - 3} more
                    </span>
                  )}
                </div>
                <Link href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}`} style={{ padding: '0.5rem 1rem', background: '#ffc107', color: 'black', textDecoration: 'none', borderRadius: '4px' }}>
                  Play This Deck
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Play completed
  if (playComplete) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h1>🎉 Play Complete!</h1>
        <p>You've finished ranking all the cards in the {deck} deck.</p>
        <div style={{ marginTop: '2rem' }}>
          <Link href={`/play?org=${org}`} style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: '4px', marginRight: '1rem' }}>
            Play Another Deck
          </Link>
          <Link href="/" style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Voting interface
  if (votingContext) {
    const cardA = currentPlay.cards.find(c => c.id === votingContext.newCard);
    const cardB = currentPlay.cards.find(c => c.id === votingContext.compareWith);

    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>🗳️ Vote: Which do you prefer?</h1>
          <p>Choose your preferred option to build your ranking</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <div 
            onClick={() => handleVote(cardA.id)}
            style={{ 
              padding: '2rem', 
              border: '2px solid #0070f3', 
              borderRadius: '8px', 
              textAlign: 'center', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <h3>{cardA.title}</h3>
            {cardA.description && <p style={{ color: '#666' }}>{cardA.description}</p>}
            <button style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Choose This
            </button>
          </div>

          <div 
            onClick={() => handleVote(cardB.id)}
            style={{ 
              padding: '2rem', 
              border: '2px solid #dc3545', 
              borderRadius: '8px', 
              textAlign: 'center', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <h3>{cardB.title}</h3>
            {cardB.description && <p style={{ color: '#666' }}>{cardB.description}</p>}
            <button style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Choose This
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Swiping interface
  if (currentCard) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>🃏 Playing: {deck}</h1>
          <p>Swipe right to like, left to dislike</p>
        </div>

        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ 
            padding: '2rem', 
            border: '2px solid #ddd', 
            borderRadius: '12px', 
            marginBottom: '2rem',
            background: 'white',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h2>{currentCard.title}</h2>
            {currentCard.description && (
              <p style={{ color: '#666', marginBottom: '1rem' }}>{currentCard.description}</p>
            )}
            {currentCard.imageUrl && (
              <img 
                src={currentCard.imageUrl} 
                alt={currentCard.title}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button 
              onClick={() => handleSwipe('left')}
              style={{ 
                padding: '1rem 2rem', 
                background: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: '50px', 
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              👎 Dislike
            </button>
            <button 
              onClick={() => handleSwipe('right')}
              style={{ 
                padding: '1rem 2rem', 
                background: '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '50px', 
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              👍 Like
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Loading play session...</p>
    </div>
  );
}
