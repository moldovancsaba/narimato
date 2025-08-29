import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { calculateCardSize } from '../lib/utils/cardSizing';

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
  const [cardConfig, setCardConfig] = useState(null);
  const [keyboardActive, setKeyboardActive] = useState(null);
  const [previousVotingContext, setPreviousVotingContext] = useState(null);
  const [cardTransitions, setCardTransitions] = useState({ left: null, right: null });
  const [previousCard, setPreviousCard] = useState(null);
  const [swipeTransition, setSwipeTransition] = useState(null);

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

  // FUNCTIONAL: Initialize card sizing and setup resize handlers
  // STRATEGIC: Ensures responsive game interface across all devices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateCardSize = () => {
        const gameMode = votingContext ? 'vote' : 'swipe';
        const config = calculateCardSize(gameMode);
        setCardConfig(config);
      };

      updateCardSize();
      
      const handleResize = () => {
        setTimeout(updateCardSize, 100); // Debounce resize
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      };
    }
  }, [votingContext]);

  // FUNCTIONAL: Handle keyboard controls for game interactions
  // STRATEGIC: Provides accessible game controls and improved UX
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ignore if user is typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      if (votingContext) {
        // VOTE MODE: LEFT = Card 1, RIGHT = Card 2
        if (event.code === 'ArrowLeft') {
          event.preventDefault();
          setKeyboardActive('left');
          handleVote(votingContext.newCard);
        } else if (event.code === 'ArrowRight') {
          event.preventDefault();
          setKeyboardActive('right');
          handleVote(votingContext.compareWith);
        }
      } else if (currentCard) {
        // SWIPE MODE: LEFT = Dislike, RIGHT = Like
        if (event.code === 'ArrowLeft') {
          event.preventDefault();
          setKeyboardActive('dislike');
          handleSwipe('left');
        } else if (event.code === 'ArrowRight') {
          event.preventDefault();
          setKeyboardActive('like');
          handleSwipe('right');
        }
      }
    };

    const handleKeyUp = () => {
      setKeyboardActive(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentCard, votingContext]);

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
          
          // FUNCTIONAL: Track swipe transitions for visual feedback
          // STRATEGIC: Shows user when a new card appears after swipe
          if (currentCard && currentCard.id !== data.nextCardId) {
            setSwipeTransition('new-card');
            
            // Clear transition after animation completes
            setTimeout(() => {
              setSwipeTransition(null);
            }, 600);
          }
          
          setPreviousCard(currentCard);
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
          // FUNCTIONAL: Track card transitions for visual feedback
          // STRATEGIC: Provides user with clear indication of which card changed
          const newContext = data.votingContext;
          if (previousVotingContext) {
            const transitions = {
              left: previousVotingContext.newCard !== newContext.newCard ? 'changed' : 'same',
              right: previousVotingContext.compareWith !== newContext.compareWith ? 'changed' : 'same'
            };
            setCardTransitions(transitions);
            
            // Clear transitions after animation completes
            setTimeout(() => {
              setCardTransitions({ left: null, right: null });
            }, 600);
          }
          
          setPreviousVotingContext(votingContext);
          setVotingContext(newContext);
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

  // VOTE MODE: Dynamic layout with VS separator
  if (votingContext && cardConfig) {
    const cardA = currentPlay.cards.find(c => c.id === votingContext.newCard);
    const cardB = currentPlay.cards.find(c => c.id === votingContext.compareWith);

    // FUNCTIONAL: Apply dynamic sizing via CSS custom properties
    // STRATEGIC: Ensures consistent sizing across orientations and screen sizes
    const gameStyle = {
      '--card-size': `${cardConfig.cardSize}px`,
      '--button-size': `${cardConfig.buttonSize}px`,
      '--emoji-size': `${cardConfig.emojiSize}px`,
      '--emoji-font-size': `${cardConfig.emojiSize * 0.6}px`
    };

    return (
      <>
        <link rel="stylesheet" href="/styles/game.css" />
        <div className="game-container" style={gameStyle}>
          <div className={`game-layout game-mode-vote ${cardConfig.orientation}`}>
            {/* CARD A */}
            <div 
              className={`game-card ${cardA.imageUrl ? 'has-image' : ''} ${keyboardActive === 'left' ? 'keyboard-active' : ''} ${
                cardTransitions.left === 'changed' ? 'card-changed' : 
                cardTransitions.left === 'same' ? 'card-same' : 'entering'
              }`}
              onClick={() => handleVote(cardA.id)}
              tabIndex="0"
              onKeyDown={(e) => e.key === 'Enter' && handleVote(cardA.id)}
            >
              <div className="game-card-title">{cardA.title}</div>
              {cardA.description && <div className="game-card-description">{cardA.description}</div>}
              {cardA.imageUrl && <img src={cardA.imageUrl} alt={cardA.title} className="game-card-image" />}
            </div>
            
            {/* VS SEPARATOR */}
            <div className="game-vs-separator">
              😈
            </div>
            
            {/* CARD B */}
            <div 
              className={`game-card ${cardB.imageUrl ? 'has-image' : ''} ${keyboardActive === 'right' ? 'keyboard-active' : ''} ${
                cardTransitions.right === 'changed' ? 'card-changed' : 
                cardTransitions.right === 'same' ? 'card-same' : 'entering'
              }`}
              onClick={() => handleVote(cardB.id)}
              tabIndex="0"
              onKeyDown={(e) => e.key === 'Enter' && handleVote(cardB.id)}
            >
              <div className="game-card-title">{cardB.title}</div>
              {cardB.description && <div className="game-card-description">{cardB.description}</div>}
              {cardB.imageUrl && <img src={cardB.imageUrl} alt={cardB.title} className="game-card-image" />}
            </div>
          </div>
        </div>
      </>
    );
  }

  // SWIPE MODE: Dynamic layout with action buttons
  if (currentCard && cardConfig) {
    // FUNCTIONAL: Apply dynamic sizing via CSS custom properties
    // STRATEGIC: Ensures consistent sizing across orientations and screen sizes
    const gameStyle = {
      '--card-size': `${cardConfig.cardSize}px`,
      '--button-size': `${cardConfig.buttonSize}px`,
      '--emoji-size': `${cardConfig.emojiSize}px`
    };

    return (
      <>
        <link rel="stylesheet" href="/styles/game.css" />
        <div className="game-container" style={gameStyle}>
          <div className={`game-layout game-mode-swipe ${cardConfig.orientation}`}>
            {cardConfig.orientation === 'portrait' ? (
              // PORTRAIT LAYOUT: Card on top, buttons below in row
              <>
                {/* GAME CARD */}
                <div className={`game-card ${currentCard.imageUrl ? 'has-image' : ''} ${
                  swipeTransition === 'new-card' ? 'card-changed' : 'entering'
                }`}>
                  <div className="game-card-title">{currentCard.title}</div>
                  {currentCard.description && <div className="game-card-description">{currentCard.description}</div>}
                  {currentCard.imageUrl && <img src={currentCard.imageUrl} alt={currentCard.title} className="game-card-image" />}
                </div>
                
                {/* BUTTON ROW */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  width: `${cardConfig.cardSize}px`,
                  gap: '20px'
                }}>
                  {/* DISLIKE BUTTON (👎) - Left half */}
                  <button 
                    className={`game-action-button dislike ${keyboardActive === 'dislike' ? 'pulse' : ''}`}
                    onClick={() => handleSwipe('left')}
                    tabIndex="0"
                    aria-label="Dislike card"
                  >
                    👎
                  </button>
                  
                  {/* LIKE BUTTON (👍) - Right half */}
                  <button 
                    className={`game-action-button like ${keyboardActive === 'like' ? 'pulse' : ''}`}
                    onClick={() => handleSwipe('right')}
                    tabIndex="0"
                    aria-label="Like card"
                  >
                    👍
                  </button>
                </div>
              </>
            ) : (
              // LANDSCAPE LAYOUT: Button, Card, Button horizontally
              <>
                {/* DISLIKE BUTTON (👎) - Left position */}
                <button 
                  className={`game-action-button dislike ${keyboardActive === 'dislike' ? 'pulse' : ''}`}
                  onClick={() => handleSwipe('left')}
                  tabIndex="0"
                  aria-label="Dislike card"
                >
                  👎
                </button>
                
                {/* GAME CARD */}
                <div className={`game-card ${currentCard.imageUrl ? 'has-image' : ''} ${
                  swipeTransition === 'new-card' ? 'card-changed' : 'entering'
                }`}>
                  <div className="game-card-title">{currentCard.title}</div>
                  {currentCard.description && <div className="game-card-description">{currentCard.description}</div>}
                  {currentCard.imageUrl && <img src={currentCard.imageUrl} alt={currentCard.title} className="game-card-image" />}
                </div>
                
                {/* LIKE BUTTON (👍) - Right position */}
                <button 
                  className={`game-action-button like ${keyboardActive === 'like' ? 'pulse' : ''}`}
                  onClick={() => handleSwipe('right')}
                  tabIndex="0"
                  aria-label="Like card"
                >
                  👍
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Loading play session...</p>
    </div>
  );
}
