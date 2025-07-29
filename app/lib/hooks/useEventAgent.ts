/**
 * React Hook for Event Agent Integration
 * 
 * This hook provides a clean interface for React components to interact
 * with the EventAgent state machine.
 */

import { useState, useEffect, useCallback } from 'react';
import { eventAgent, AppState, AppEvent, AppContext } from '../services/EventAgent';

export function useEventAgent() {
  const [state, setState] = useState<AppState>('INITIALIZING'); // Start with default state
  const [context, setContext] = useState<AppContext>({
    sessionId: null,
    currentCardId: null,
    swipedCards: [],
    rankedCards: [],
    totalCards: 0,
    remainingCards: 0,
    currentVotingCard: null,
    error: null
  });

  // Subscribe to state changes when component mounts
  useEffect(() => {
    // Initialize with current state after mounting
    setState(eventAgent.getCurrentState());
    setContext(eventAgent.getContext());
    
    const handleStateChange = (newState: AppState, newContext: AppContext) => {
      setState(newState);
      setContext(newContext);
    };

    eventAgent.subscribe(handleStateChange);

    return () => {
      eventAgent.unsubscribe(handleStateChange);
    };
  }, []);

  // Event dispatch function
  const dispatch = useCallback((event: AppEvent) => {
    eventAgent.handleEvent(event);
  }, []);

  // Convenience functions for common events
  const startSession = useCallback((sessionId: string, deckSize: number) => {
    dispatch({ type: 'START_SESSION', sessionId, deckSize });
  }, [dispatch]);

  const deckReady = useCallback((totalCards: number) => {
    dispatch({ type: 'DECK_READY', totalCards });
  }, [dispatch]);

  const cardSwipedLeft = useCallback((cardId: string) => {
    dispatch({ type: 'CARD_SWIPED_LEFT', cardId });
  }, [dispatch]);

  const cardSwipedRight = useCallback((cardId: string, requiresVoting: boolean) => {
    dispatch({ type: 'CARD_SWIPED_RIGHT', cardId, requiresVoting });
  }, [dispatch]);

  const voteCompleted = useCallback((cardId: string, nextComparison?: { newCard: string; compareAgainst: string }) => {
    dispatch({ type: 'VOTE_COMPLETED', cardId, nextComparison });
  }, [dispatch]);

  const rankingComplete = useCallback((cardId: string) => {
    dispatch({ type: 'RANKING_COMPLETE', cardId });
  }, [dispatch]);

  const deckExhausted = useCallback(() => {
    dispatch({ type: 'DECK_EXHAUSTED' });
  }, [dispatch]);

  const errorOccurred = useCallback((error: string) => {
    dispatch({ type: 'ERROR_OCCURRED', error });
  }, [dispatch]);

  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET_SESSION' });
  }, [dispatch]);

  // Navigation helpers
  const navigationTarget = eventAgent.getNavigationTarget();
  const progress = eventAgent.getProgress();

  // UI state helpers
  const shouldShowSwipeInterface = eventAgent.shouldShowSwipeInterface();
  const shouldShowVotingInterface = eventAgent.shouldShowVotingInterface();
  const shouldShowCompletedInterface = eventAgent.shouldShowCompletedInterface();
  const shouldShowLoadingInterface = eventAgent.shouldShowLoadingInterface();
  const shouldShowErrorInterface = eventAgent.shouldShowErrorInterface();

  return {
    // Current state
    state,
    context,
    
    // Event dispatchers
    dispatch,
    startSession,
    deckReady,
    cardSwipedLeft,
    cardSwipedRight,
    voteCompleted,
    rankingComplete,
    deckExhausted,
    errorOccurred,
    resetSession,
    
    // Navigation
    navigationTarget,
    progress,
    
    // UI helpers
    shouldShowSwipeInterface,
    shouldShowVotingInterface,
    shouldShowCompletedInterface,
    shouldShowLoadingInterface,
    shouldShowErrorInterface,
  };
}
