/* eslint-disable @next/next/no-css-tags */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { calculateCardSize } from '../lib/utils/cardSizing';
import { event } from '../lib/analytics/ga';
import { useSwipeGestures } from '../lib/utils/useSwipeGestures';
import { CARD_FIELDS } from '../lib/constants/fields';
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
  const cardRef = useRef(null); // FUNCTIONAL: DOM handle for attaching swipe gestures

  // Stable derived values used within callbacks; memoized to satisfy exhaustive-deps without re-creating values each render
  const playId = useMemo(() => currentPlay?.playId, [currentPlay?.playId]);
  const playCards = useMemo(() => currentPlay?.cards || [], [currentPlay?.cards]);
  const hierarchicalLevel = useMemo(() => currentPlay?.hierarchicalLevel || null, [currentPlay?.hierarchicalLevel]);

  // FUNCTIONAL: Onboarding orchestration state
  // STRATEGIC: Enables organization-wide onboarding segments using existing onboarding engine
  const onboardingQueueRef = useRef([]); // Array of deckTag strings (parent names)
  const onboardingIndexRef = useRef(0);
  const originalIntentRef = useRef(null); // { mode, deckTag }
  const isRunningOnboardingRef = useRef(false);
  const onboardingDoneRef = useRef(new Set()); // FUNCTIONAL: Tracks which deck has already run onboarding in this page session


  // FUNCTIONAL: Admin session flag for gating admin-only UI and logic
  // STRATEGIC: Public pages remain accessible, but admin-only controls require a session
  const [isAdmin, setIsAdmin] = useState(false);

  // FUNCTIONAL: Whether to include hidden decks in selection (admin-only)
  // STRATEGIC: Prevents URL param manipulation from exposing hidden decks to non-admin users
  const [showHidden, setShowHidden] = useState(false);

  // FUNCTIONAL: Detect admin session and clamp includeHidden behavior
  // STRATEGIC: Ensures non-admin users cannot enable hidden decks via URL params
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/login');
        if (!mounted) return;
        const ok = res.ok === true;
        setIsAdmin(ok);
        if (ok) {
          setShowHidden(router.query.includeHidden === 'true');
        } else {
          if (router.query.includeHidden === 'true') {
            const params = new URLSearchParams(router.query);
            params.delete('includeHidden');
            router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
          }
          setShowHidden(false);
        }
      } catch {
        if (!mounted) return;
        setIsAdmin(false);
        setShowHidden(false);
      }
    })();
    return () => { mounted = false; };
  }, [router, router.query.includeHidden]);

  const fetchDecks = useCallback(async () => {
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
      
      const includeHidden = isAdmin && showHidden === true;
      const playableDecks = Object.entries(deckGroups)
        .filter(([tag, grpCards]) => grpCards.length >= 2)
        .filter(([tag]) => {
          const parent = data.cards.find(c => c.name === tag);
          if (!parent) return true;
          return includeHidden ? true : (parent.isPlayable !== false);
        })
        .map(([tag, grpCards]) => ({ tag, cards: grpCards }));
      
      setDecks(playableDecks);
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    }
  }, [org, isAdmin, showHidden]);

  useEffect(() => {
    if (!org) return;
    fetchDecks();
  }, [org, showHidden, isAdmin, fetchDecks]);

  // Check hierarchical status to determine next step after completion
  const checkHierarchicalStatus = useCallback(async () => {
    if (!currentPlay) return;

    const { mode } = router.query;
    if (mode === 'swipe-only' || mode === 'swipe-more') {
      try { event('play_complete', { playId: currentPlay.playId, mode, hierarchical: false }); } catch (e) {}
      router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
      return;
    }

    try {
      const res = await fetch(`/api/play/hierarchical-status?playId=${currentPlay.playId}&organizationId=${org}`);
      if (res.ok) {
        const statusData = await res.json();
        if (statusData.isHierarchical) {
          switch (statusData.action) {
            case 'start_child_session':
              try { event('segment_end', { playId: currentPlay.playId, segment: 'parent', outcome: 'child_session_start' }); } catch (e) {}
              router.push(`/play?org=${org}&deck=child&playId=${statusData.data.childSessionId}`);
              return;
            case 'show_hierarchical_results':
              try { const { mode } = router.query; event('play_complete', { playId: currentPlay.playId, mode, hierarchical: true }); } catch (e) {}
              alert(`Hierarchical ranking complete!\n\nRanked ${statusData.data.totalItems} items in families.`);
              setTimeout(() => { router.push(`/results?playId=${statusData.playId}&org=${org}&deck=${encodeURIComponent(deck)}&hierarchical=true`); }, 1500);
              return;
            case 'initialize_hierarchical':
              try {
                const initRes = await fetch('/api/play/hierarchical-status', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ playId: currentPlay.playId, organizationId: org, action: 'initialize' })
                });
                if (initRes.ok) {
                  setTimeout(() => { checkHierarchicalStatus(); }, 1000);
                } else {
                  router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
                }
              } catch (error) {
                router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
              }
              return;
            case 'show_standard_results':
              try { const { mode } = router.query; event('play_complete', { playId: currentPlay.playId, mode, hierarchical: false }); } catch (e) {}
              router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
              return;
            default:
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking hierarchical status:', error);
    }

    router.push(`/results?playId=${currentPlay.playId}&org=${org}&deck=${encodeURIComponent(deck)}`);
  }, [currentPlay, router, org, deck]);

  // Hierarchical onboarding and session start
  const computeOnboardingQueue = useCallback(async (orgId, selectedDeckTag) => {
    try {
      const res = await fetch(`/api/cards?organizationId=${orgId}`);
      const data = await res.json();
      const all = Array.isArray(data.cards) ? data.cards : [];

      const normalize = (str) => (str || '').toString().replace(/^#/, '').toLowerCase().trim();
      const baseDeck = normalize(selectedDeckTag);
      const stripOnboardingSuffix = (name) => {
        const n = normalize(name);
        if (n.endsWith('_onboarding')) return n.slice(0, -'_onboarding'.length);
        if (n.endsWith('-onboarding')) return n.slice(0, -'-onboarding'.length);
        if (n.endsWith(' onboarding')) return n.slice(0, -' onboarding'.length);
        return n;
      };

      const parents = all.filter(c => !c.parentTag && c.isOnboarding === true);
      const matched = parents.filter(p => stripOnboardingSuffix(p.name) === baseDeck);
      const queue = matched
        .map(p => ({ parent: p, count: all.filter(c => c.parentTag === p.name).length }))
        .filter(x => x.count >= 2)
        .map(x => x.parent.name);
      return queue;
    } catch (e) {
      console.error('Failed to compute onboarding queue:', e);
      return [];
    }
  }, []);

  const startPlay = useCallback(async (options = {}) => {
    try {
      const { playId, mode } = router.query;
      const requestedMode = options.modeOverride || mode;
      const requestedDeck = options.deckOverride || deck;

      if (!playId && requestedDeck !== 'child' && requestedMode !== 'onboarding' && !isRunningOnboardingRef.current && !onboardingDoneRef.current.has(requestedDeck)) {
        const queue = await computeOnboardingQueue(org, requestedDeck);
        if (queue.length > 0) {
          originalIntentRef.current = { mode: requestedMode, deckTag: requestedDeck };
          onboardingQueueRef.current = queue;
          onboardingIndexRef.current = 0;
          isRunningOnboardingRef.current = true;
          try {
            event('onboarding_auto_start', { org, queueLength: queue.length, queuedDeckTags: queue, skippedDeckTag: requestedDeck, startedAt: new Date().toISOString() });
          } catch (e) {}
          const params = new URLSearchParams(router.query);
          params.set('mode', 'onboarding');
          params.set('deck', queue[0]);
          router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
          return;
        }
      }

      if (playId && requestedDeck === 'child') {
        console.log('🌳 Loading child session via hierarchical status:', playId);
        try {
          const statusRes = await fetch(`/api/play/hierarchical-status?playId=${playId}&organizationId=${org}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.isHierarchical && statusData.action === 'continue_child_session' && statusData.data) {
              const childData = statusData.data;
              setCurrentPlay({
                playId: childData.childSessionId || playId,
                deckTag: childData.parentName || 'child-session',
                totalCards: childData.totalCards || childData.cards?.length || 1,
                cards: childData.cards || [],
                currentCardId: childData.currentCardId
              });
              if (childData.cards && childData.currentCardId) {
                const currentCardFound = childData.cards.find(c => c.id === childData.currentCardId);
                setCurrentCard(currentCardFound);
              }
              setVotingContext(null);
              setPlayComplete(false);
              return;
            }
            console.log('🔄 Child session status unclear, checking hierarchical flow');
            await checkHierarchicalStatus();
            return;
          }
        } catch (error) {
          console.error('Error loading child session:', error);
        }
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
        console.error('Failed to load child session, redirecting to home');
        alert('Failed to load child session');
        router.push('/');
        return;
      }

      let apiEndpoint = '/api/play/start';
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
        try {
          const { mode } = router.query;
          event('play_start', { playId: data.playId, org, deck, mode, resumed: data.resumed || false, initial_state: data.votingContext ? 'voting' : (data.currentCardId ? 'swipe' : 'unknown') });
        } catch (e) {}
        setCurrentPlay(data);
        if ((mode === 'vote-only' || mode === 'vote-more') && data.comparison) {
          setVotingContext({ newCard: data.comparison.card1.id, compareWith: data.comparison.card2.id });
          setCurrentCard(null);
        } else if (data.votingContext) {
          setVotingContext(data.votingContext);
          setCurrentCard(null);
        } else if (data.currentCardId) {
          const currentCardFound = data.cards.find(c => c.id === data.currentCardId);
          setCurrentCard(currentCardFound);
          setVotingContext(null);
        } else {
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
  }, [router, deck, org, checkHierarchicalStatus, computeOnboardingQueue]);

  useEffect(() => {
    if (!org || !deck) return;
    startPlay();
  }, [org, deck, startPlay]);

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

  // EFFECT ORDER: Declare callback before effect to avoid TDZ in minified builds
  useEffect(() => {
    fetchOrganizations();
  }, []);





  const handleSwipe = useCallback(async (direction) => {
    if (!playId || !currentCard) return;

    try {
      // Check mode for appropriate API endpoint
      const { mode } = router.query;
      let apiEndpoint = '/api/play/swipe';
if (mode === 'swipe-only' || mode === 'onboarding' || mode === 'swipe-more' || mode === 'rank-only' || mode === 'rank-more') {
        apiEndpoint = `/api/v1/play/${playId}/input`;
      } else if (mode === 'vote-only') {
        // vote-only does not use swipe
        apiEndpoint = null;
      }
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
          mode === 'swipe-only' || mode === 'onboarding' || mode === 'swipe-more' || mode === 'rank-only' || mode === 'rank-more'
            ? { action: 'swipe', payload: { cardId: currentCard.id, direction } }
            : { playId: currentPlay.playId, cardId: currentCard.id, direction }
        )
      });

        if (res.ok) {
          const data = await res.json();
          // FUNCTIONAL: Track swipe gesture for engagement metrics
          // STRATEGIC: Monitors user interaction patterns with cards (production-only)
          try {
            const { mode } = router.query;
event('swipe_action', {
              playId: playId,
              mode,
              cardId: currentCard?.id,
              direction,
              hierarchicalLevel: hierarchicalLevel
            });
          } catch (e) { /* noop */ }
          
          // Rank-More: engine may instruct to return to swiping a new family immediately
          if (data.returnToSwipe && data.nextCardId) {
            // If engine supplies a fresh card list for the new family, use it
const newCards = Array.isArray(data.cards) && data.cards.length > 0 ? data.cards : playCards;
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
          // FUNCTIONAL: Handle onboarding completion and chain next segment or restore original session
          // STRATEGIC: Avoids results redirect during onboarding; resumes intended mode/deck seamlessly
          if (mode === 'onboarding' && isRunningOnboardingRef.current) {
            const queue = onboardingQueueRef.current || [];
            const idx = onboardingIndexRef.current || 0;
            if (idx + 1 < queue.length) {
              onboardingIndexRef.current = idx + 1;
              const nextDeck = queue[onboardingIndexRef.current];
              const params = new URLSearchParams(router.query);
              params.set('deck', nextDeck);
              router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
              return; // Next onboarding segment will start via useEffect/startPlay
            }
            // All onboarding segments complete — restore original intent
            try {
              event('onboarding_complete', {
                org,
                queueLength: queue.length,
                queuedDeckTags: queue,
                completedAt: new Date().toISOString()
              });
            } catch (e) { /* noop */ }
            const orig = originalIntentRef.current || {};
            // FUNCTIONAL: Mark onboarding as done for the restored deck to prevent re-trigger
            // STRATEGIC: Avoid infinite loop when returning to the originally requested deck
            if (orig.deckTag) {
              try { onboardingDoneRef.current.add(orig.deckTag); } catch (e) { /* noop */ }
            }
            isRunningOnboardingRef.current = false;
            const params = new URLSearchParams(router.query);
            if (orig.mode) params.set('mode', orig.mode); else params.delete('mode');
            if (orig.deckTag) params.set('deck', orig.deckTag);
            router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
            return; // startPlay will run with restored intent
          }

          // For rank-only and rank-more, redirect straight to results when session fully completes
          if (mode === 'rank-only') {
router.push(`/results?playId=${playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
              return;
            }
            if (mode === 'rank-more') {
router.push(`/results?playId=${playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
              return;
            }
            // Check hierarchical status to determine next action
            await checkHierarchicalStatus();
            return;
          } else if (data.requiresVoting) {
            setVotingContext(data.votingContext);
          } else if (data.nextCardId) {
            // HIERARCHICAL SWIPEMORE or same-family transition
            let nextCard;
            let updatedCards = playCards;
            
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
              nextCard = playCards.find(c => c.id === data.nextCardId);
            }
            
            // FUNCTIONAL: Track swipe transitions for visual feedback
            // STRATEGIC: Shows user when a new card appears after swipe
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
          alert(error.error);
        }
    } catch (error) {
      console.error('Failed to swipe:', error);
      alert('Failed to swipe card');
    }
  }, [currentCard, router, org, deck, checkHierarchicalStatus, playId, playCards, hierarchicalLevel, currentPlay]);

  // NOTE: All hooks must remain at the top-level of the component (no conditionals)
  // Place gesture hook after handler declaration to avoid TDZ for onSwipe reference
  // Compute allowed directions based on mode (onboarding = right-only)
  const allowedDirections = (router.query.mode === 'onboarding') ? ['right'] : ['left', 'right'];
  useSwipeGestures({ ref: cardRef, enabled: !!currentCard && !votingContext, onSwipe: handleSwipe, allowedDirections });

  const handleVote = useCallback(async (winner) => {
    if (!votingContext) return;

    try {
      const { mode } = router.query;
if (mode === 'vote-only' || mode === 'vote-more' || mode === 'rank-only' || mode === 'rank-more') {
        const loser = winner === votingContext.newCard ? votingContext.compareWith : votingContext.newCard;
const res = await fetch(`/api/v1/play/${playId}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'vote', payload: { winner, loser } })
        });
        if (!res.ok) {
          const error = await res.json();
          alert(error.error || 'Vote failed');
          return;
        }
        // FUNCTIONAL: Track voting behavior for preference analysis
        // STRATEGIC: Captures decision-making patterns in vote-based modes (production-only)
        try {
          const loserId = loser;
            event('vote_cast', {
            playId: playId,
            mode, // vote-only or vote-more
            winner,
            loser: loserId
          });
        } catch (e) { /* noop */ }
const nextRes = await fetch(`/api/v1/play/${playId}/next`);
        if (!nextRes.ok) {
          alert('Failed to get next comparison');
          return;
        }
const nextData = await nextRes.json();
        // If engine instructs to return to swipe for a new family (Rank-More)
        if (nextData.returnToSwipe && nextData.nextCardId) {
          if (Array.isArray(nextData.cards) && nextData.cards.length > 0) {
            setCurrentPlay(prev => ({ ...prev, cards: nextData.cards }));
          }
const pool = (nextData.cards && nextData.cards.length > 0) ? nextData.cards : playCards;
          const nextCard = pool.find(c => c.id === nextData.nextCardId);
          setVotingContext(null);
          setCurrentCard(nextCard || null);
          return;
        }
        if (nextData.completed) {
router.push(`/results?playId=${playId}&org=${org}&deck=${encodeURIComponent(deck)}&mode=${mode}`);
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
const res = await fetch(`/api/v1/play/${playId}/input`, {
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
              playId: playId,
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
const nextCard = playCards.find(c => c.id === data.nextCardId);
            setCurrentCard(nextCard);
            setVotingContext(null);
          } else {
            const { mode } = router.query;
            const modeParam = mode ? `&mode=${mode}` : '';
router.push(`/results?playId=${playId}&org=${org}&deck=${encodeURIComponent(deck)}${modeParam}`);
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
playId: playId,
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
playId: playId,
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
const nextCard = playCards.find(c => c.id === data.nextCardId);
          setCurrentCard(nextCard);
          setVotingContext(null);
        } else {
          // Session completed
          const { mode } = router.query;
          const modeParam = mode ? `&mode=${mode}` : '';
router.push(`/results?playId=${playId}&org=${org}&deck=${encodeURIComponent(deck)}${modeParam}`);
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
}, [votingContext, router, org, deck, previousVotingContext, checkHierarchicalStatus, playId, playCards]);

  // FUNCTIONAL: Handle keyboard controls for game interactions
  // STRATEGIC: Provides accessible game controls and improved UX
  // EFFECT ORDER: Place after handlers (handleVote, handleSwipe) to avoid TDZ in production builds
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
        // SWIPE MODE
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
  }, [currentCard, votingContext, router.query.mode, handleVote, handleSwipe]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  // Organization selection
  if (!org) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ marginBottom: '2rem' }}>
          {/* FUNCTIONAL: Standardize small back navigation button */}
          {/* STRATEGIC: Consistent design across pages */}
          <Link href="/" className="btn btn-light btn-sm">← Back to Home</Link>
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
              <div key={organization[CARD_FIELDS.UUID]} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>{organization.name}</h3>
                <Link href={`/play?org=${organization[CARD_FIELDS.UUID]}`} className="btn btn-warning">
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
        {/* Admin Toggle: Show hidden decks (admin-only) */}
        {isAdmin && (
          <div style={{ margin: '0.5rem 0 1rem 0' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowHidden(checked);
                  const params = new URLSearchParams(router.query);
                  if (checked) params.set('includeHidden', 'true'); else params.delete('includeHidden');
                  router.replace({ pathname: router.pathname, query: Object.fromEntries(params.entries()) }, undefined, { shallow: true });
                }}
              />
              (admin) Show hidden decks
            </label>
          </div>
        )}
        
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
                    <span key={card[CARD_FIELDS.UUID]} style={{ display: 'inline-block', margin: '0.25rem', padding: '0.25rem 0.5rem', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.75rem' }}>
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
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'swipe-only' });
                      } catch (e) { /* noop */ }
                    }}
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
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=onboarding`} 
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'onboarding' });
                      } catch (e) { /* noop */ }
                    }}
                    className="btn" 
                    style={{ 
                      background: '#198754', 
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
                    🎓 Onboarding
                  </Link>
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=vote-only`} 
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'vote-only' });
                      } catch (e) { /* noop */ }
                    }}
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
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'swipe-more' });
                      } catch (e) { /* noop */ }
                    }}
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
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=vote-more`} 
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'vote-more' });
                      } catch (e) { /* noop */ }
                    }}
                    className="btn" 
                    style={{ 
                      background: '#0d6efd', 
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
                    🗳️ Vote More
                  </Link>
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=rank-only`} 
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'rank-only' });
                      } catch (e) { /* noop */ }
                    }}
                    className="btn" 
                    style={{ 
                      background: '#20c997', 
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
                    👆+🗳️ Rank Only
                  </Link>
                  <Link 
                    href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=rank-more`} 
                    onClick={() => {
                      try {
                        event('mode_selected', { org, deckTag: deckInfo.tag, mode: 'rank-more' });
                      } catch (e) { /* noop */ }
                    }}
                    className="btn" 
                    style={{ 
                      background: '#fd7e14', 
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
                    👆+🗳️ Rank More
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
        <p>You&apos;ve finished ranking all the cards in the {deck} deck.</p>
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

    // Defensive guard: if cards are not yet loaded (e.g., after switching families), wait
    if (!cardA || !cardB) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Preparing next comparison...
        </div>
      );
    }

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
              {cardA.imageUrl && <img src={cardA.imageUrl} alt={cardA.title} className="game-card-image" draggable={false} onDragStart={(e) => e.preventDefault()} />}
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
              {cardB.imageUrl && <img src={cardB.imageUrl} alt={cardB.title} className="game-card-image" draggable={false} onDragStart={(e) => e.preventDefault()} />}
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
                <div ref={cardRef} className={`game-card ${currentCard.imageUrl ? 'has-image' : ''} ${
                  swipeTransition === 'new-card' ? 'card-changed' : 
                  swipeTransition === 'new-level' ? 'card-changed' : 'entering'
                }`}>
                  <div className="game-card-title">{currentCard.title}</div>
                  {currentCard.description && <div className="game-card-description">{currentCard.description}</div>}
                  {currentCard.imageUrl && <img src={currentCard.imageUrl} alt={currentCard.title} className="game-card-image" draggable={false} onDragStart={(e) => e.preventDefault()} />}
                </div>
                
                {/* BUTTON ROW */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  width: `${cardConfig.cardSize}px`,
                  gap: '20px'
                }}>
                  {router.query.mode !== 'onboarding' && (
                    <button 
                      className={`game-action-button dislike ${keyboardActive === 'dislike' ? 'pulse' : ''}`}
                      onClick={() => handleSwipe('left')}
                      tabIndex="0"
                      aria-label="Dislike card"
                    >
                      👎
                    </button>
                  )}
                  
                  <button 
                    className={`game-action-button like ${keyboardActive === 'like' ? 'pulse' : ''}`}
                    onClick={() => handleSwipe('right')}
                    tabIndex="0"
                    aria-label={router.query.mode === 'onboarding' ? 'Continue' : 'Like card'}
                  >
                    👍
                  </button>
                </div>
              </>
            ) : (
              // LANDSCAPE LAYOUT: Button, Card, Button horizontally
              <>
                {/* DISLIKE BUTTON (👎) - Left position */}
                {router.query.mode !== 'onboarding' && (
                  <button 
                    className={`game-action-button dislike ${keyboardActive === 'dislike' ? 'pulse' : ''}`}
                    onClick={() => handleSwipe('left')}
                    tabIndex="0"
                    aria-label="Dislike card"
                  >
                    👎
                  </button>
                )}
                
                {/* GAME CARD */}
                <div ref={cardRef} className={`game-card ${currentCard.imageUrl ? 'has-image' : ''} ${
                  swipeTransition === 'new-card' ? 'card-changed' : 'entering'
                }`}>
                  <div className="game-card-title">{currentCard.title}</div>
                  {currentCard.description && <div className="game-card-description">{currentCard.description}</div>}
                  {currentCard.imageUrl && <img src={currentCard.imageUrl} alt={currentCard.title} className="game-card-image" draggable={false} onDragStart={(e) => e.preventDefault()} />}
                </div>
                
                {/* LIKE BUTTON (👍) - Right position */}
                <button 
                  className={`game-action-button like ${keyboardActive === 'like' ? 'pulse' : ''}`}
                  onClick={() => handleSwipe('right')}
                  tabIndex="0"
                  aria-label={router.query.mode === 'onboarding' ? 'Continue' : 'Like card'}
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
