/**
 * Centralized field name constants to ensure consistent variable naming across the codebase
 * This prevents typos and makes refactoring easier by having a single source of truth
 */

// Session-related field names
export const SESSION_FIELDS = {
  ID: 'sessionId',
  STATE: 'sessionState',
  VERSION: 'version',
  LAST_SYNC: 'lastSyncTimestamp',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt'
} as const;

// Card-related field names
export const CARD_FIELDS = {
  ID: 'cardId',
  UUID: 'uuid',
  TYPE: 'type',
  CONTENT: 'content',
  TITLE: 'title',
  TAGS: 'tags',
  IS_ACTIVE: 'isActive',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt'
} as const;

// Deck-related field names
export const DECK_FIELDS = {
  ID: 'deckId',
  NAME: 'name',
  CARDS: 'cards',
  CURRENT_INDEX: 'currentIndex',
  SWIPE_COUNT: 'swipeCount',
  VERSION: 'version',
  STATE: 'state',
  LAST_SYNC: 'lastSyncTimestamp'
} as const;

// Vote/Ranking-related field names
export const VOTE_FIELDS = {
  CARD_A: 'cardA',
  CARD_B: 'cardB',
  WINNER: 'winner',
  TIMESTAMP: 'timestamp',
  DIRECTION: 'direction',
  PERSONAL_RANKING: 'personalRanking'
} as const;

// API Response field names
export const API_FIELDS = {
  SUCCESS: 'success',
  ERROR: 'error',
  MESSAGE: 'message',
  DATA: 'data',
  STATUS: 'status'
} as const;

// Common validation patterns
export const VALIDATION_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  SESSION_ID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
} as const;

// Type definitions for better type safety
export type SessionFieldKeys = keyof typeof SESSION_FIELDS;
export type CardFieldKeys = keyof typeof CARD_FIELDS;
export type DeckFieldKeys = keyof typeof DECK_FIELDS;
export type VoteFieldKeys = keyof typeof VOTE_FIELDS;
export type ApiFieldKeys = keyof typeof API_FIELDS;
