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
                <Link href={`/play?org=${organization.uuid}`} className="btn btn-warning">
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
                <Link href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}`} className="btn btn-warning">
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
          <div className="btn-group">
            <Link href={`/play?org=${org}`} className="btn btn-info">
              Play Another Deck
            </Link>
            <Link href="/" className="btn btn-muted">
              Back to Home
            </Link>
          </div>
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

        <div className="card-row" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-with-info">
            <div className="card card-lg card-interactive">
              <div className="card-title">{cardA.title}</div>
              {cardA.description && <div className="card-description">{cardA.description}</div>}
              {cardA.imageUrl && <img src={cardA.imageUrl} alt={cardA.title} className="card-image" />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => handleVote(cardA.id)}
                className="btn btn-primary"
              >
                ✅ Choose This
              </button>
            </div>
          </div>

          <div className="card-with-info">
            <div className="card card-lg card-interactive">
              <div className="card-title">{cardB.title}</div>
              {cardB.description && <div className="card-description">{cardB.description}</div>}
              {cardB.imageUrl && <img src={cardB.imageUrl} alt={cardB.title} className="card-image" />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => handleVote(cardB.id)}
                className="btn btn-secondary"
              >
                ✅ Choose This
              </button>
            </div>
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
          <div className="card card-xl card-interactive" style={{ marginBottom: '2rem' }}>
            <div className="card-title">{currentCard.title}</div>
            {currentCard.description && <div className="card-description">{currentCard.description}</div>}
            {currentCard.imageUrl && <img src={currentCard.imageUrl} alt={currentCard.title} className="card-image" />}
          </div>

          <div className="btn-group">
            <button 
              onClick={() => handleSwipe('left')}
              className="btn btn-secondary"
            >
              👎 Dislike
            </button>
            <button 
              onClick={() => handleSwipe('right')}
              className="btn btn-primary"
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
