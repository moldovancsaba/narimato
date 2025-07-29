/**
 * Event Agent Consistency Tests
 * 
 * These tests verify that the Event Agent handles all event sequences correctly
 * and maintains consistent state without race conditions or inconsistencies.
 */

import { EventAgent } from '../EventAgent';

describe('EventAgent Consistency', () => {
  let eventAgent: EventAgent;

  beforeEach(() => {
    eventAgent = new EventAgent();
  });

  test('Initial state is INITIALIZING', () => {
    expect(eventAgent.getCurrentState()).toBe('INITIALIZING');
  });

  test('Session start transitions to correct states', () => {
    // Start session
    eventAgent.handleEvent({
      type: 'START_SESSION',
      sessionId: 'test-session',
      deckSize: 10
    });

    // Should still be INITIALIZING until deck is ready
    expect(eventAgent.getCurrentState()).toBe('INITIALIZING');

    // Deck ready should transition to SWIPING
    eventAgent.handleEvent({
      type: 'DECK_READY',
      totalCards: 10
    });

    expect(eventAgent.getCurrentState()).toBe('SWIPING');
  });

  test('Swipe events update context correctly', () => {
    // Initialize session and deck
    eventAgent.handleEvent({ type: 'START_SESSION', sessionId: 'test', deckSize: 10 });
    eventAgent.handleEvent({ type: 'DECK_READY', totalCards: 10 });

    // Left swipe should not require voting
    eventAgent.handleEvent({
      type: 'CARD_SWIPED_LEFT',
      cardId: 'card-1'
    });

    const context = eventAgent.getContext();
    expect(context.swipedCards).toContain('card-1');
    expect(context.remainingCards).toBe(9);
    expect(eventAgent.getCurrentState()).toBe('SWIPING');
  });

  test('Voting flow transitions correctly', () => {
    // Initialize session and deck  
    eventAgent.handleEvent({ type: 'START_SESSION', sessionId: 'test', deckSize: 10 });
    eventAgent.handleEvent({ type: 'DECK_READY', totalCards: 10 });

    // Right swipe requiring voting
    eventAgent.handleEvent({
      type: 'CARD_SWIPED_RIGHT',
      cardId: 'card-1',
      requiresVoting: true
    });

    expect(eventAgent.getCurrentState()).toBe('VOTING');
    expect(eventAgent.getContext().currentVotingCard).toBe('card-1');

    // Complete voting
    eventAgent.handleEvent({
      type: 'VOTE_COMPLETED',
      cardId: 'card-1'
    });

    expect(eventAgent.getCurrentState()).toBe('SWIPING');
    expect(eventAgent.getContext().rankedCards).toContain('card-1');
  });

  test('Deck exhaustion transitions to COMPLETED', () => {
    // Initialize session and deck with 1 card
    eventAgent.handleEvent({ type: 'START_SESSION', sessionId: 'test', deckSize: 1 });
    eventAgent.handleEvent({ type: 'DECK_READY', totalCards: 1 });

    // Swipe the last card
    eventAgent.handleEvent({
      type: 'CARD_SWIPED_LEFT',
      cardId: 'last-card'
    });

    expect(eventAgent.getCurrentState()).toBe('COMPLETED');
  });

  test('Error handling transitions correctly', () => {
    // Initialize session and deck
    eventAgent.handleEvent({ type: 'START_SESSION', sessionId: 'test', deckSize: 10 });
    eventAgent.handleEvent({ type: 'DECK_READY', totalCards: 10 });

    // Trigger error
    eventAgent.handleEvent({
      type: 'ERROR_OCCURRED',
      error: 'Test error'
    });

    expect(eventAgent.getCurrentState()).toBe('ERROR');
    expect(eventAgent.getContext().error).toBe('Test error');

    // Reset should return to INITIALIZING
    eventAgent.handleEvent({ type: 'RESET_SESSION' });
    expect(eventAgent.getCurrentState()).toBe('INITIALIZING');
  });

  test('Invalid state transitions are prevented', () => {
    // Try to complete voting without being in VOTING state
    eventAgent.handleEvent({
      type: 'VOTE_COMPLETED',
      cardId: 'card-1'
    });

    // Should remain in INITIALIZING
    expect(eventAgent.getCurrentState()).toBe('INITIALIZING');
  });

  test('Progress calculation is accurate', () => {
    eventAgent.handleEvent({ type: 'START_SESSION', sessionId: 'test', deckSize: 10 });
    eventAgent.handleEvent({ type: 'DECK_READY', totalCards: 10 });

    let progress = eventAgent.getProgress();
    expect(progress.percentage).toBe(0);

    // Swipe 3 cards
    eventAgent.handleEvent({ type: 'CARD_SWIPED_LEFT', cardId: 'card-1' });
    eventAgent.handleEvent({ type: 'CARD_SWIPED_LEFT', cardId: 'card-2' });
    eventAgent.handleEvent({ type: 'CARD_SWIPED_LEFT', cardId: 'card-3' });

    progress = eventAgent.getProgress();
    expect(progress.completed).toBe(3);
    expect(progress.total).toBe(10);
    expect(progress.percentage).toBe(30);
  });
});

export {};
