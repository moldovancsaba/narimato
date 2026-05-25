import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Loader, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { calculateCardSize } from '../lib/utils/cardSizing';
import { event } from '../lib/analytics/ga';
import { useSurveyGate } from '../lib/hooks/useSurveyGate';
import { PlayVoteSurface } from '../components/play/PlayVoteSurface';
import { PlaySwipeSurface } from '../components/play/PlaySwipeSurface';
import {
  PlayOrgPicker,
  PlayDeckPicker,
  PlayComplete,
} from '../components/play/PlayPicker';
export default function Play() {
  const router = useRouter();
  const { org, deck } = router.query;

  const [organizations, setOrganizations] = useState([]);
  const [decks, setDecks] = useState([]);
  const [projectionMeta, setProjectionMeta] = useState(null);
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

  // Touch/Pointer swipe handling for swipe mode (50% width threshold)
  const lastVoteAt = useRef(0);
  const voteInFlight = useRef(false);
  const swipeTouchStartX = useRef(null);
  const pointerStartX = useRef(null);
  const pointerActiveId = useRef(null);
  const [swipeDrag, setSwipeDrag] = useState({ dx: 0, animating: false });
  const onSwipeTouchStart = (e) => {
    if (!currentCard || !cardConfig) return;
    if (!e.touches || e.touches.length === 0) return;
    swipeTouchStartX.current = e.touches[0].clientX;
    setSwipeDrag({ dx: 0, animating: false });
  };
  const onSwipeTouchMove = (e) => {
    if (swipeTouchStartX.current == null) return;
    if (!e.touches || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - swipeTouchStartX.current;
    setSwipeDrag({ dx, animating: false });
    if (Math.abs(dx) > 2) {
      // Avoid page scroll during deliberate drag
      e.preventDefault();
    }
  };
  const onSwipeTouchEnd = () => {
    if (swipeTouchStartX.current == null) return;
    const dx = swipeDrag.dx || 0;
    swipeTouchStartX.current = null;
    const width = cardConfig?.cardSize || 300;
    const threshold = width * 0.5;
    if (Math.abs(dx) >= threshold) {
      const dir = dx > 0 ? 'right' : 'left';
      // Animate off-screen then record swipe
      const off = (dir === 'right' ? 1 : -1) * (width * 1.2);
      setSwipeDrag({ dx: off, animating: true });
      setTimeout(() => {
        setSwipeDrag({ dx: 0, animating: false });
        handleSwipe(dir);
      }, 180);
    } else {
      // Snap back to center
      setSwipeDrag({ dx: 0, animating: true });
      setTimeout(() => setSwipeDrag({ dx: 0, animating: false }), 180);
    }
  };

  // Pointer fallback (mouse/touch) for swipe mode
  const onSwipePointerDown = (e) => {
    if (!currentCard || !cardConfig) return;
    pointerActiveId.current = e.pointerId;
    pointerStartX.current = e.clientX;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    setSwipeDrag({ dx: 0, animating: false });
  };
  const onSwipePointerMove = (e) => {
    if (pointerActiveId.current == null || e.pointerId !== pointerActiveId.current) return;
    const dx = e.clientX - (pointerStartX.current || 0);
    setSwipeDrag({ dx, animating: false });
    if (Math.abs(dx) > 2) e.preventDefault();
  };
  const onSwipePointerUp = (e) => {
    if (pointerActiveId.current == null || e.pointerId !== pointerActiveId.current) return;
    const dx = swipeDrag.dx || 0;
    pointerActiveId.current = null;
    pointerStartX.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
    const width = cardConfig?.cardSize || 300;
    const threshold = width * 0.5;
    if (Math.abs(dx) >= threshold) {
      const dir = dx > 0 ? 'right' : 'left';
      const off = (dir === 'right' ? 1 : -1) * (width * 1.2);
      setSwipeDrag({ dx: off, animating: true });
      setTimeout(() => {
        setSwipeDrag({ dx: 0, animating: false });
        handleSwipe(dir);
      }, 180);
    } else {
      setSwipeDrag({ dx: 0, animating: true });
      setTimeout(() => setSwipeDrag({ dx: 0, animating: false }), 180);
    }
  };

  // Touch safety for vote mode: only register tap if move < 10px
  const voteTouchA = useRef({ startX: 0, startY: 0, moved: false });
  const voteTouchB = useRef({ startX: 0, startY: 0, moved: false });
  const voteOnTouchStart = (which, e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const ref = which === 'A' ? voteTouchA.current : voteTouchB.current;
    ref.startX = t.clientX;
    ref.startY = t.clientY;
    ref.moved = false;
  };
  const voteOnTouchMove = (which, e) => {
    const ref = which === 'A' ? voteTouchA.current : voteTouchB.current;
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - ref.startX);
    const dy = Math.abs(t.clientY - ref.startY);
    if (dx > 10 || dy > 10) ref.moved = true;
  };
  const voteOnTouchEnd = (which, e, onVote) => {
    const ref = which === 'A' ? voteTouchA.current : voteTouchB.current;
    if (!ref.moved && typeof onVote === 'function') {
      e.preventDefault();
      onVote();
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const [showHidden, setShowHidden] = useState(() => router.query.includeHidden === 'true');

  useSurveyGate(org);

  useEffect(() => {
    if (org) {
      fetchDecks();
    }
  }, [org, showHidden]);

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
        // Prevent vote UI for onboarding
        if (router.query.mode === 'onboarding') return;
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
        // SWIPE MODE: LEFT = Dislike, RIGHT = Like (right-only for onboarding)
        const isOnboarding = router.query.mode === 'onboarding';
        if (event.code === 'ArrowLeft') {
          if (!isOnboarding) {
            event.preventDefault();
            setKeyboardActive('dislike');
            handleSwipe('left');
          }
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
      const params = new URLSearchParams({ organizationId: org });
      if (showHidden) params.set('includeHidden', 'true');
      const res = await fetch(`/api/play/decks?${params.toString()}`);
      const data = await res.json();

      const meta = data.meta || null;
      const useProjectionDecks =
        data.decks?.length > 0 &&
        meta?.source === 'projection' &&
        meta?.freshness?.status !== 'missing';

      if (useProjectionDecks) {
        setDecks(data.decks);
        setProjectionMeta(meta);
        return;
      }

      if (data.decks?.length && !meta?.freshness) {
        setDecks(data.decks);
        setProjectionMeta(meta);
        return;
      }

      const fallback = await fetch(`/api/cards?organizationId=${org}&projection=false`);
      const fallbackData = await fallback.json();
      const deckGroups = {};
      fallbackData.cards?.forEach(card => {
        if (card.parentTag) {
          if (!deckGroups[card.parentTag]) {
            deckGroups[card.parentTag] = [];
          }
          deckGroups[card.parentTag].push(card);
        }
      });
      
      const includeHidden = showHidden === true;
      const playableDecks = Object.entries(deckGroups)
        .filter(([tag, grpCards]) => grpCards.length >= 2)
        .filter(([tag]) => {
          const parent = fallbackData.cards.find(c => c.name === tag);
          if (!parent) return true;
          return includeHidden ? true : (parent.isPlayable !== false);
        })
        .map(([tag, grpCards]) => ({ tag, cards: grpCards }));
      
      setDecks(playableDecks);
      setProjectionMeta(fallbackData.meta || { source: 'fallback', freshness: { status: 'missing' } });
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    }
  };

  const startPlay = async () => {
    try {
      // Check if this is a child session (playId in URL)
      const { playId, mode } = router.query;

      // Auto-run onboarding intro if available for the selected deck (once per page session)
      if (!playId && deck && mode !== 'onboarding' && deck !== 'child') {
        const doneKey = `onb_done_${org}_${deck}`;
        if (typeof window !== 'undefined' && !sessionStorage.getItem(doneKey)) {
          const res = await fetch(`/api/cards?organizationId=${org}`);
          const data = await res.json();
          const all = Array.isArray(data.cards) ? data.cards : [];
          const normalize = (str) => (str || '').toString().replace(/^#/, '').toLowerCase().trim();
          const base = normalize(deck);
          const candidates = new Set([
            `${base}_onboarding`,
            `${base}-onboarding`,
            `${base} onboarding`
          ]);
          // Find parent/root onboarding deck
          const parent =
            // Prefer explicitly flagged onboarding parents that include base token
            all.find(c => !c.parentTag && c.isOnboarding === true && normalize(c.name).includes(base)) ||
            // Fallback to name pattern matching
            all.find(c => !c.parentTag && candidates.has(normalize(c.name)));
          if (parent) {
            const children = all.filter(c => c.parentTag === parent.name);
            if (children.length >= 1) {
              // Store original intent and start onboarding deck
              try {
                sessionStorage.setItem(`onb_orig_${org}_${deck}` , JSON.stringify({ mode, deck }));
              } catch (_) {}
              const params = new URLSearchParams(router.query);
              params.set('mode', 'onboarding');
              params.set('deck', parent.name);
              router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
              return; // defer normal start until onboarding completes
            }
          }
        }
      }
      
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
        notifications.show({ color: 'red', message: 'Failed to load child session' });
        router.push('/');
        return;
      }
      
      // Normal deck start - check for specific modes
      let apiEndpoint = '/api/play/start';
      // Unified dispatcher endpoint
if (mode === 'vote-only' || mode === 'swipe-only' || mode === 'onboarding' || mode === 'swipe-more' || mode === 'vote-more' || mode === 'rank-only' || mode === 'rank-more') {
        apiEndpoint = '/api/v1/play/start';
      }
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          organizationId: org, 
          deckTag: deck, 
mode: mode === 'vote-only' ? 'vote_only' : (mode === 'swipe-only' ? 'swipe_only' : (mode === 'onboarding' ? 'onboarding' : (mode === 'swipe-more' ? 'swipe_more' : (mode === 'vote-more' ? 'vote_more' : (mode === 'rank-only' ? 'rank_only' : (mode === 'rank-more' ? 'rank_more' : undefined))))))
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        // FUNCTIONAL: Track play session start event
        // STRATEGIC: Captures entry point and mode for funnel analysis (production-only)
        try {
          const { mode } = router.query;
          event('play_start', {
            playId: data.playId,
            org,
            deck,
            mode,
            resumed: data.resumed || false,
            initial_state: data.votingContext ? 'voting' : (data.currentCardId ? 'swipe' : 'unknown')
          });
        } catch (e) { /* noop */ }
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
        if ((mode === 'vote-only' || mode === 'vote-more') && data.comparison) {
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
        notifications.show({ color: 'red', message: error.error });
      }
    } catch (error) {
      console.error('Failed to start play:', error);
      notifications.show({ color: 'red', message: 'Failed to start play session' });
    }
  };

  const checkHierarchicalStatus = async () => {
    if (!currentPlay) return;
    
    const { mode } = router.query;
    // Onboarding: after completion, restore original deck/mode
    if (mode === 'onboarding') {
      try {
        const keys = Object.keys(sessionStorage);
        const origKey = keys.find(k => k.startsWith('onb_orig_'));
        if (origKey) {
          const orig = JSON.parse(sessionStorage.getItem(origKey));
          // mark done to prevent re-trigger
          const doneKey = origKey.replace('onb_orig_', 'onb_done_');
          sessionStorage.setItem(doneKey, '1');
          sessionStorage.removeItem(origKey);
          const params = new URLSearchParams(router.query);
          if (orig.mode) params.set('mode', orig.mode); else params.delete('mode');
          if (orig.deck) params.set('deck', orig.deck);
          params.delete('playId');
          router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
          return;
        }
      } catch (_) {}
      // Fallback: return to deck selection
      const params = new URLSearchParams(router.query);
      params.delete('mode');
      params.delete('playId');
      router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
      return;
    }
    
    // Check if we're in a specific mode that needs direct results redirect
    const { mode: mode2 } = router.query;
    if (mode === 'swipe-only' || mode === 'swipe-more') {
      console.log(`🔚 ${mode} session completion - redirecting to results`);
      // FUNCTIONAL: Track play session completion for swipe-only/swipe-more
      // STRATEGIC: Measures completion rates for pure swipe modes (production-only)
      try {
        event('play_complete', { playId: currentPlay.playId, mode, hierarchical: false });
      } catch (e) { /* noop */ }
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
              // FUNCTIONAL: Track hierarchical flow progression
              // STRATEGIC: Monitors multi-level gameplay patterns (production-only)
              try {
                event('segment_end', {
                  playId: currentPlay.playId,
                  segment: 'parent',
                  outcome: 'child_session_start'
                });
              } catch (e) { /* noop */ }
              
              // Direct redirect without alert popup
              router.push(`/play?org=${org}&deck=child&playId=${statusData.data.childSessionId}`);
              return;
              
            case 'show_hierarchical_results':
              // Show hierarchical completion message and redirect to results
              // FUNCTIONAL: Track play session completion (hierarchical)
              // STRATEGIC: Measures hierarchical completion usage (production-only)
              try {
                const { mode } = router.query;
                event('play_complete', { playId: currentPlay.playId, mode, hierarchical: true });
              } catch (e) { /* noop */ }
              notifications.show({
                color: 'green',
                title: 'Hierarchical ranking complete',
                message: `Ranked ${statusData.data.totalItems} items in families.`,
              });
              
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
              // FUNCTIONAL: Track play session completion (standard)
              // STRATEGIC: Measures standard flow completion (production-only)
              try {
                const { mode } = router.query;
                event('play_complete', { playId: currentPlay.playId, mode, hierarchical: false });
              } catch (e) { /* noop */ }
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
      const { mode } = router.query;
      const isOnboarding = mode === 'onboarding';

      // Block left/dislike during onboarding at the client level
      if (isOnboarding && direction === 'left') return;

      // Determine endpoint and body based on mode
      let apiEndpoint = '/api/play/swipe';
      if (
        mode === 'swipe-only' ||
        mode === 'swipe-more' ||
        mode === 'rank-only' ||
        mode === 'rank-more' ||
        mode === 'onboarding'
      ) {
        apiEndpoint = `/api/v1/play/${currentPlay.playId}/input`;
      } else if (mode === 'vote-only') {
        // vote-only does not use swipe
        apiEndpoint = null;
      }

      if (!apiEndpoint) return;

      const body = JSON.stringify(
        apiEndpoint.startsWith('/api/v1')
          ? { action: 'swipe', payload: { cardId: currentCard.id, direction } }
          : { playId: currentPlay.playId, cardId: currentCard.id, direction }
      );

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (res.ok) {
        const data = await res.json();
        // FUNCTIONAL: Track user progression
        // STRATEGIC: For onboarding, we still use swipe semantics to teach the gesture
        try {
          event('swipe_action', {
            playId: currentPlay.playId,
            mode,
            cardId: currentCard?.id,
            direction,
            hierarchicalLevel: currentPlay?.hierarchicalLevel || null
          });
        } catch (e) { /* noop */ }

        // Handle engine responses
        // Rank-More: engine may instruct to return to swiping a new family immediately
        if (data.returnToSwipe && data.nextCardId) {
          // If engine supplies a fresh card list for the new family, use it
          const newCards = Array.isArray(data.cards) && data.cards.length > 0 ? data.cards : currentPlay.cards;
          setCurrentPlay(prev => ({ ...prev, cards: newCards }));
          const nextCard = newCards.find(c => c.id === data.nextCardId) || null;
          setVotingContext(null);
          setPreviousCard(currentCard);
          setSwipeTransition('new-level');
          setTimeout(() => setSwipeTransition(null), 600);
          setCurrentCard(nextCard);
          return;
        }

        if (data.completed) {
          // For rank-only and rank-more, redirect straight to results when session fully completes
          if (mode === 'rank-only') {
            router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
            return;
          }
          if (mode === 'rank-more') {
            router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
            return;
          }
          // Onboarding or standard: determine next action
          await checkHierarchicalStatus();
          return;
        } else if (data.requiresVoting) {
          setVotingContext(data.votingContext);
        } else if (data.nextCardId) {
          // HIERARCHICAL SWIPEMORE or same-family transition
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
          } else if (Array.isArray(data.cards) && data.cards.length > 0) {
            // Rank-More family transition without newLevelCards key
            updatedCards = data.cards;
            setCurrentPlay(prev => ({ ...prev, cards: updatedCards }));
            nextCard = updatedCards.find(c => c.id === data.nextCardId);
          } else {
            // Regular card transition within the same level
            nextCard = currentPlay.cards.find(c => c.id === data.nextCardId);
          }

          // FUNCTIONAL: Track swipe transitions for visual feedback
          // STRATEGIC: Shows user when a new card appears after swipe/next
          if (currentCard && currentCard.id !== data.nextCardId) {
            const transitionType = data.newLevelCards || (Array.isArray(data.cards) && data.cards.length > 0) ? 'new-level' : 'new-card';
            setSwipeTransition(transitionType);

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
        notifications.show({ color: 'red', message: error.error });
      }
    } catch (error) {
      console.error('Failed to swipe:', error);
      notifications.show({ color: 'red', message: 'Failed to swipe card' });
    }
  };

  const handleVote = async (winner) => {
    if (!votingContext) return;
    const now = Date.now();
    if (now - lastVoteAt.current < 100) return;
    lastVoteAt.current = now;
    if (voteInFlight.current) return;
    voteInFlight.current = true;

    try {
      const { mode } = router.query;
if (mode === 'vote-only' || mode === 'vote-more' || mode === 'rank-only' || mode === 'rank-more') {
        const loser = winner === votingContext.newCard ? votingContext.compareWith : votingContext.newCard;
        const res = await fetch(`/api/v1/play/${currentPlay.playId}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'vote', payload: { winner, loser } })
        });
        if (!res.ok) {
          const error = await res.json();
          notifications.show({ color: 'red', message: error.error || 'Vote failed' });
          return;
        }
        // FUNCTIONAL: Track voting behavior for preference analysis
        // STRATEGIC: Captures decision-making patterns in vote-based modes (production-only)
        try {
          const loserId = loser;
          event('vote_cast', {
            playId: currentPlay.playId,
            mode, // vote-only or vote-more
            winner,
            loser: loserId
          });
        } catch (e) { /* noop */ }
        const nextRes = await fetch(`/api/v1/play/${currentPlay.playId}/next`);
        if (!nextRes.ok) {
          notifications.show({ color: 'red', message: 'Failed to get next comparison' });
          return;
        }
const nextData = await nextRes.json();
        // If engine instructs to return to swipe for a new family (Rank-More)
        if (nextData.returnToSwipe && nextData.nextCardId) {
          if (Array.isArray(nextData.cards) && nextData.cards.length > 0) {
            setCurrentPlay(prev => ({ ...prev, cards: nextData.cards }));
          }
          const pool = (nextData.cards && nextData.cards.length > 0) ? nextData.cards : currentPlay.cards;
          const nextCard = pool.find(c => c.id === nextData.nextCardId);
          setVotingContext(null);
          setCurrentCard(nextCard || null);
          return;
        }
        if (nextData.completed) {
          router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
          return;
        }
        // If we're moving to a new family, update available cards to resolve UI details
        if (Array.isArray(nextData.cards) && nextData.cards.length > 0) {
          setCurrentPlay(prev => ({ ...prev, cards: nextData.cards }));
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
          // FUNCTIONAL: Track voting behavior in swipe-more tie-breaks
          // STRATEGIC: Captures hybrid mode decision-making (production-only)
          try {
            event('vote_cast', {
              playId: currentPlay.playId,
              mode: 'swipe-more',
              cardA: votingContext.newCard,
              cardB: votingContext.compareWith,
              winner
            });
          } catch (e) { /* noop */ }
          
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
          notifications.show({ color: 'red', message: error.error });
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
        // FUNCTIONAL: Track voting behavior in classic flow
        // STRATEGIC: Ensures legacy flow analytics coverage (production-only)
        try {
          const { mode } = router.query;
          event('vote_cast', {
            playId: currentPlay.playId,
            mode: mode || 'classic',
            cardA: votingContext.newCard,
            cardB: votingContext.compareWith,
            winner
          });
        } catch (e) { /* noop */ }
        
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
        notifications.show({ color: 'red', message: error.error });
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      notifications.show({ color: 'red', message: 'Failed to vote' });
    } finally {
      voteInFlight.current = false;
    }
  };

  if (loading) {
    return (
      <Center mih="50vh">
        <Loader />
      </Center>
    );
  }

  if (!org) {
    return <PlayOrgPicker organizations={organizations} loading={false} />;
  }

  if (!deck) {
    return (
      <PlayDeckPicker
        org={org}
        decks={decks}
        projectionMeta={projectionMeta}
      />
    );
  }

  if (playComplete) {
    return <PlayComplete org={org} deck={deck} />;
  }

  // VOTE MODE: Dynamic layout with VS separator
  if (votingContext && cardConfig) {
    const cardA = currentPlay.cards.find(c => c.id === votingContext.newCard);
    const cardB = currentPlay.cards.find(c => c.id === votingContext.compareWith);

    // Defensive guard: if cards are not yet loaded (e.g., after switching families), wait
    if (!cardA || !cardB) {
      return (
        <Center mih="100vh">
          <Loader />
        </Center>
      );
    }

    return (
      <PlayVoteSurface
        cardA={cardA}
        cardB={cardB}
        cardConfig={cardConfig}
        keyboardActive={keyboardActive}
        cardTransitions={cardTransitions}
        voteTouchHandlers={{
          onTouchStart: voteOnTouchStart,
          onTouchMove: voteOnTouchMove,
          onTouchEnd: voteOnTouchEnd,
        }}
        onVote={handleVote}
      />
    );
  }

  if (currentCard && cardConfig) {
    const isOnboarding = router.query.mode === 'onboarding';

    return (
      <PlaySwipeSurface
        currentCard={currentCard}
        cardConfig={cardConfig}
        swipeDrag={swipeDrag}
        swipeTransition={swipeTransition}
        isOnboarding={isOnboarding}
        showLevelBadge={router.query.mode === 'swipe-more'}
        hierarchicalLevel={currentPlay?.hierarchicalLevel}
        onSwipeTouchStart={onSwipeTouchStart}
        onSwipeTouchMove={onSwipeTouchMove}
        onSwipeTouchEnd={onSwipeTouchEnd}
        onSwipePointerDown={onSwipePointerDown}
        onSwipePointerMove={onSwipePointerMove}
        onSwipePointerUp={onSwipePointerUp}
        onSwipeLeft={() => handleSwipe('left')}
        onSwipeRight={() => handleSwipe('right')}
        keyboardActive={keyboardActive}
      />
    );
  }

  return (
    <Center mih="50vh">
      <Loader />
    </Center>
  );
}
