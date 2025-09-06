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
      // Check if this is a child session (playId in URL)
      const { playId, mode } = router.query;
      
      if (playId && deck === 'child') {
        // FUNCTIONAL: Load child session using hierarchical status API
        // STRATEGIC: Get complete child session data including all cards from hierarchical flow
        console.log('🌳 Loading child session via hierarchical status:', playId);
        
        try {
          const statusRes = await fetch(`/api/play/hierarchical-status?playId=${playId}&organizationId=${org}`);
          
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            console.log('📊 Child session hierarchical data:', statusData);
            
            if (statusData.isHierarchical && statusData.action === 'continue_child_session' && statusData.data) {
              // Use data from hierarchical status API
              const childData = statusData.data;
              
              setCurrentPlay({
                playId: childData.childSessionId || playId,
                deckTag: childData.parentName || 'child-session',
                totalCards: childData.totalCards || childData.cards?.length || 1,
                cards: childData.cards || [],
                currentCardId: childData.currentCardId
              });
              
              // Set current card
              if (childData.cards && childData.currentCardId) {
                const currentCard = childData.cards.find(c => c.id === childData.currentCardId);
                setCurrentCard(currentCard);
              }
              
              setVotingContext(null);
              setPlayComplete(false);
              return;
            }
            
            // If child session is completed or not found, check status
            console.log('🔄 Child session status unclear, checking hierarchical flow');
            await checkHierarchicalStatus();
            return;
          } else {
            console.error('Failed to get hierarchical status for child session');
          }
        } catch (error) {
          console.error('Error loading child session:', error);
        }
        
        // Fallback: Try loading with current API
        console.log('🔄 Trying fallback child session load...');
        const res = await fetch(`/api/play/current?playId=${playId}`);
        
        if (res.ok) {
          const data = await res.json();
          
          if (data.completed) {
            await checkHierarchicalStatus();
            return;
          }
          
          setCurrentPlay({
            playId: data.playId || playId,
            deckTag: data.deckTag || 'child-session',
            totalCards: data.totalCards || 1,
            cards: data.currentCard ? [data.currentCard] : [],
            currentCardId: data.currentCard?.id
          });
          
          if (data.currentCard) {
            setCurrentCard(data.currentCard);
          }
          
          setVotingContext(null);
          setPlayComplete(false);
          return;
        }
        
        // If all fails, show error
        console.error('Failed to load child session, redirecting to home');
        alert('Failed to load child session');
        router.push('/');
        return;
      }
      
      // Normal deck start - check for specific modes
      let apiEndpoint = '/api/play/start';
      // Unified dispatcher endpoint
      if (mode === 'vote-only' || mode === 'swipe-only' || mode === 'swipe-more') {
        apiEndpoint = '/api/v1/play/start';
      }
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          organizationId: org, 
          deckTag: deck, 
          mode: mode === 'vote-only' ? 'vote_only' : (mode === 'swipe-only' ? 'swipe_only' : (mode === 'swipe-more' ? 'swipe_more' : undefined))
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('🎮 Play session data:', {
          playId: data.playId,
          state: data.state,
          hasVotingContext: !!data.votingContext,
          currentCardId: data.currentCardId,
          resumed: data.resumed
        });
        
        setCurrentPlay(data);
        
        // FUNCTIONAL: Handle both swiping and voting states properly
        // STRATEGIC: Resume exactly where the user left off
        if (mode === 'vote-only' && data.comparison) {
          setVotingContext({ newCard: data.comparison.card1.id, compareWith: data.comparison.card2.id });
          setCurrentCard(null);
        } else if (data.votingContext) {
          // Session is in voting mode - set up voting context
          console.log('🗳️ Resuming in voting mode:', data.votingContext);
          setVotingContext(data.votingContext);
          setCurrentCard(null); // No current card in voting mode
        } else if (data.currentCardId) {
          // Session is in swiping mode - set up current card
          console.log('👆 Resuming in swiping mode, card:', data.currentCardId);
          const currentCard = data.cards.find(c => c.id === data.currentCardId);
          setCurrentCard(currentCard);
          setVotingContext(null);
        } else {
          // No current card and no voting - might be completed
          console.log('⚠️ No current card or voting context');
          setCurrentCard(null);
          setVotingContext(null);
        }
        
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

  const checkHierarchicalStatus = async () => {
    if (!currentPlay) return;
    
    // Check if we're in a specific mode that needs direct results redirect
    const { mode } = router.query;
    if (mode === 'swipe-only' || mode === 'swipe-more') {
      console.log(`🔚 ${mode} session completion - redirecting to results`);
      router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
      return;
    }

    try {
      console.log('🔍 Checking hierarchical status for playId:', currentPlay.playId);
      const res = await fetch(`/api/play/hierarchical-status?playId=${currentPlay.playId}&organizationId=${org}`);
      
      if (res.ok) {
        const statusData = await res.json();
        console.log('📊 Hierarchical status response:', statusData);
        
        if (statusData.isHierarchical) {
          switch (statusData.action) {
            case 'start_child_session':
              // FUNCTIONAL: Smooth transition to child session without blocking popup
              // STRATEGIC: Better UX by avoiding alert interruption
              console.log(`🌳 Parent ranking complete - starting child session: ${statusData.data.childSessionId}`);
              
              // Direct redirect without alert popup
              router.push(`/play?org=${org}&deck=child&playId=${statusData.data.childSessionId}`);
              return;
              
            case 'show_hierarchical_results':
              // Show hierarchical completion message and redirect to results
              alert(`Hierarchical ranking complete!\n\nRanked ${statusData.data.totalItems} items in families.`);
              
              setTimeout(() => {
                router.push(`/results?playId=${statusData.playId}&org=${org}&deck=${encodeURIComponent(deck)}&hierarchical=true`);
              }, 1500);
              return;
              
            case 'initialize_hierarchical':
              // FUNCTIONAL: Handle hierarchical initialization without popup
              // STRATEGIC: Prevent infinite reload loop by handling initialization server-side
              console.log('⚠️ Session needs hierarchical initialization - delegating to server');
              
              try {
                // Call server-side initialization instead of reloading page
                const initRes = await fetch('/api/play/hierarchical-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    playId: currentPlay.playId, 
                    organizationId: org,
                    action: 'initialize'
                  })
                });
                
                if (initRes.ok) {
                  const initData = await initRes.json();
                  console.log('✅ Hierarchical initialization triggered:', initData);
                  
                  // Check status again after initialization
                  setTimeout(() => {
                    checkHierarchicalStatus();
                  }, 1000);
                } else {
                  console.error('Failed to initialize hierarchical session');
                  // Fallback to normal results if initialization fails
                  router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
                }
              } catch (error) {
                console.error('Error initializing hierarchical session:', error);
                // Fallback to normal results on error
                router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
              }
              return;
              
            case 'show_standard_results':
              // Standard completion - no hierarchical processing needed
              console.log('✅ Standard session completion - showing results');
              router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
              return;
              
            default:
              console.log('ℹ️ Unknown hierarchical action:', statusData.action);
          }
        }
      } else {
        console.error('Failed to fetch hierarchical status:', res.statusText);
      }
    } catch (error) {
      console.error('Error checking hierarchical status:', error);
    }
    
    // If no hierarchical action needed, proceed with normal completion
    console.log('🔚 Standard session completion');
    router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
  };

  const handleSwipe = async (direction) => {
    if (!currentPlay || !currentCard) return;

    try {
      // Check mode for appropriate API endpoint
      const { mode } = router.query;
      let apiEndpoint = '/api/play/swipe';
      if (mode === 'swipe-only' || mode === 'swipe-more') {
        apiEndpoint = `/api/v1/play/${currentPlay.playId}/input`;
      } else if (mode === 'vote-only') {
        // vote-only does not use swipe
        apiEndpoint = null;
      }
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'swipe-only' || mode === 'swipe-more'
            ? { action: 'swipe', payload: { cardId: currentCard.id, direction } }
            : { playId: currentPlay.playId, cardId: currentCard.id, direction }
        )
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          // Check hierarchical status to determine next action
          await checkHierarchicalStatus();
          return;
        } else if (data.requiresVoting) {
          setVotingContext(data.votingContext);
        } else if (data.nextCardId) {
          // HIERARCHICAL SWIPEMORE: Handle level transitions
          let nextCard;
          let updatedCards = currentPlay.cards;
          
          if (data.newLevelCards) {
            // SwipeMore transitioned to a new hierarchical level
            console.log('🌳 Transitioning to new hierarchical level:', data.hierarchicalLevel);
            console.log('📋 New level cards:', data.newLevelCards.map(c => c.title));
            
            // Update the cards array with the new level
            updatedCards = data.newLevelCards;
            nextCard = data.newLevelCards.find(c => c.id === data.nextCardId);
            
            // Update currentPlay state with new cards
            setCurrentPlay(prev => ({
              ...prev,
              cards: updatedCards
            }));
          } else {
            // Regular card transition within the same level
            nextCard = currentPlay.cards.find(c => c.id === data.nextCardId);
          }
          
          // FUNCTIONAL: Track swipe transitions for visual feedback
          // STRATEGIC: Shows user when a new card appears after swipe
          if (currentCard && currentCard.id !== data.nextCardId) {
            setSwipeTransition(data.newLevelCards ? 'new-level' : 'new-card');
            
            // Clear transition after animation completes
            setTimeout(() => {
              setSwipeTransition(null);
            }, 600);
          }
          
          setPreviousCard(currentCard);
          setCurrentCard(nextCard);
          
          if (!nextCard) {
            console.error('❌ Next card not found:', data.nextCardId);
            console.error('Available cards:', updatedCards.map(c => ({ id: c.id, title: c.title })));
          }
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
      const { mode } = router.query;
      if (mode === 'vote-only') {
        const loser = winner === votingContext.newCard ? votingContext.compareWith : votingContext.newCard;
        const res = await fetch(`/api/v1/play/${currentPlay.playId}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'vote', payload: { winner, loser } })
        });
        if (!res.ok) {
          const error = await res.json();
          alert(error.error || 'Vote failed');
          return;
        }
        const nextRes = await fetch(`/api/v1/play/${currentPlay.playId}/next`);
        if (!nextRes.ok) {
          alert('Failed to get next comparison');
          return;
        }
        const nextData = await nextRes.json();
        if (nextData.completed) {
          router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=vote-only`);
          return;
        }
        setPreviousVotingContext(votingContext);
        setVotingContext({ newCard: nextData.challenger, compareWith: nextData.opponent });
        return;
      }

      // Classic / swipe-more flow
      if (mode === 'swipe-more') {
        const res = await fetch(`/api/v1/play/${currentPlay.playId}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'vote',
            payload: {
              cardA: votingContext.newCard,
              cardB: votingContext.compareWith,
              winner
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          
          if (data.completed) {
            await checkHierarchicalStatus();
            return;
          } else if (data.requiresMoreVoting) {
            const newContext = data.votingContext;
            if (previousVotingContext) {
              const transitions = {
                left: previousVotingContext.newCard !== newContext.newCard ? 'changed' : 'same',
                right: previousVotingContext.compareWith !== newContext.compareWith ? 'changed' : 'same'
              };
              setCardTransitions(transitions);
              setTimeout(() => setCardTransitions({ left: null, right: null }), 600);
            }
            setPreviousVotingContext(votingContext);
            setVotingContext(newContext);
          } else if (data.returnToSwipe && data.nextCardId) {
            const nextCard = currentPlay.cards.find(c => c.id === data.nextCardId);
            setCurrentCard(nextCard);
            setVotingContext(null);
          } else {
            const { mode } = router.query;
            const modeParam = mode ? `&mode=${mode}` : '';
            router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}${modeParam}`);
            return;
          }
        } else {
          const error = await res.json();
          alert(error.error);
        }
        return;
      }

      // Fallback legacy classic flow (kept for compatibility if mode is not set)
      const apiEndpoint = '/api/play/vote';
      const requestBody = {
        playId: currentPlay.playId,
        cardA: votingContext.newCard,
        cardB: votingContext.compareWith,
        winner
      };
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.completed) {
          // Check hierarchical status to determine next action
          await checkHierarchicalStatus();
          return;
        } else if (mode === 'vote-only' && data.comparison) {
          // Vote-Only mode - set up next comparison from binary search algorithm
          if (previousVotingContext) {
            const transitions = {
              left: previousVotingContext.newCard !== data.comparison.card1.id ? 'changed' : 'same',
              right: previousVotingContext.compareWith !== data.comparison.card2.id ? 'changed' : 'same'
            };
            setCardTransitions(transitions);
            
            setTimeout(() => {
              setCardTransitions({ left: null, right: null });
            }, 600);
          }
          
          setPreviousVotingContext(votingContext);
          setVotingContext({
            newCard: data.comparison.card1.id,
            compareWith: data.comparison.card2.id
          });
        } else if (data.requiresMoreVoting) {
          // Classic mode - use existing logic
          const newContext = data.votingContext;
          if (previousVotingContext) {
            const transitions = {
              left: previousVotingContext.newCard !== newContext.newCard ? 'changed' : 'same',
              right: previousVotingContext.compareWith !== newContext.compareWith ? 'changed' : 'same'
            };
            setCardTransitions(transitions);
            
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
          const { mode } = router.query;
          const modeParam = mode ? `&mode=${mode}` : '';
          router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}${modeParam}`);
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
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=swipe-only`} 
                    className="btn" 
                    style={{ 
                      background: '#ff6b6b', 
                      color: 'white', 
                      textDecoration: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    👆 Swipe Only
                  </Link>
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=vote-only`} 
                    className="btn" 
                    style={{ 
                      background: '#17a2b8', 
                      color: 'white', 
                      textDecoration: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    🗳️ Vote Only
                  </Link>
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=swipe-more`} 
                    className="btn" 
                    style={{ 
                      background: '#845ec2', 
                      color: 'white', 
                      textDecoration: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    🔄 Swipe More
                  </Link>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                  <div><strong>Swipe Only:</strong> Like/dislike each card → ranking by preference</div>
                  <div><strong>Swipe More:</strong> Enhanced swiping with smart decision tree → optimized ranking</div>
                  <div><strong>Vote Only:</strong> Pure comparison voting → tournament-style ranking</div>
                </div>
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
                {/* HIERARCHICAL LEVEL INDICATOR */}
                {router.query.mode === 'swipe-more' && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(132, 94, 194, 0.9)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    zIndex: 10
                  }}>
                    🌳 Level {swipeTransition === 'new-level' ? '↗️' : (currentPlay?.hierarchicalLevel || 1)}
                  </div>
                )}
                
                {/* GAME CARD */}
                <div className={`game-card ${currentCard.imageUrl ? 'has-image' : ''} ${
                  swipeTransition === 'new-card' ? 'card-changed' : 
                  swipeTransition === 'new-level' ? 'card-changed' : 'entering'
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
