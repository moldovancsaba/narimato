/**
 * STANDARDIZED UUID FIELD NAMES - NO ALIASES ALLOWED
 * 
 * This file defines the uniform field names used throughout the entire codebase.
 * All UUID fields use simple, consistent naming with NO aliases or mappings.
 * 
 * STANDARD NAMES (used everywhere):
 * - SessionUUID: For all session identifiers
 * - PlayUUID: For all play session identifiers  
 * - CardUUID: For all card identifiers
 * - DeckUUID: For all deck identifiers
 * 
 * IMPORTANT: No other variations are allowed. Do not use:
 * - sessionId, session_id, ID, etc.
 * - playId, play_id, playUuid, etc.
 * - cardId, card_id, uuid, etc.
 * - deckId, deck_id, etc.
 */


// Session-specific field names (LEGACY - for compatibility)
export const SESSION_FIELDS = {
  UUID: 'sessionUUID',
  STATUS: 'status',
  STATE: 'state',
  VERSION: 'version',
  DECK: 'deck',
  SWIPES: 'swipes',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  COMPLETED_AT: 'completedAt',
  EXPIRES_AT: 'expiresAt',
  LAST_ACTIVITY: 'lastActivity'
} as const;

// Play session field names (CURRENT STANDARD)
export const PLAY_FIELDS = {
  UUID: 'uuid', // Play model uses 'uuid' not 'playUUID'
  SESSION_UUID: 'sessionUUID',
  STATUS: 'status',
  STATE: 'state',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  COMPLETED_AT: 'completedAt'
} as const;

// Other common field names
export const COMMON_FIELDS = {
  STATUS: 'status',
  STATE: 'state',
  VERSION: 'version',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  COMPLETED_AT: 'completedAt',
  EXPIRES_AT: 'expiresAt',
  LAST_ACTIVITY: 'lastActivity'
} as const;

// Card-specific field names
export const CARD_FIELDS = {
  UUID: 'uuid',
  NAME: 'name', 
  TYPE: 'type',
  CONTENT: 'content',
  TITLE: 'title',
  TAGS: 'tags',
  IS_ACTIVE: 'isActive',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt'
} as const;

// Vote/Ranking field names
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
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
} as const;

// Deck playability rules and thresholds
export const DECK_RULES = {
  // Minimum number of child cards required for a deck to be considered playable
  // This ensures users have a meaningful ranking experience with sufficient content to compare
  // A deck with only 1 card provides no comparison opportunities, while 2+ cards enable proper swiping/ranking
  MIN_CARDS_FOR_PLAYABLE: 2
} as const;


// Type definitions for better type safety
export type CommonFieldKeys = keyof typeof COMMON_FIELDS;
export type SessionFieldKeys = keyof typeof SESSION_FIELDS;
export type PlayFieldKeys = keyof typeof PLAY_FIELDS;
export type CardFieldKeys = keyof typeof CARD_FIELDS;
export type VoteFieldKeys = keyof typeof VOTE_FIELDS;
export type ApiFieldKeys = keyof typeof API_FIELDS;
