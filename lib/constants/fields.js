// FUNCTIONAL: Centralized field constant groups for computed property access
// STRATEGIC: Aligns with lint rule expectations and enforces naming consistency without hardcoding strings

// Card-related field keys
const CARD_FIELDS = {
  // DB/entity unique identifier used across Card documents
  UUID: 'uuid',
  // In embedded structures (swipes/votes payloads) we often store 'cardId'
  ID: 'cardId',
};

// Session/Play-related field keys (for nested session references)
const SESSION_FIELDS = {
  // In embedded arrays (e.g., childSessions) we store references as 'sessionId'
  ID: 'sessionId',
};

// Voting/ranking related field keys
const VOTE_FIELDS = {
  PERSONAL_RANKING: 'personalRanking',
};

module.exports = {
  CARD_FIELDS,
  SESSION_FIELDS,
  VOTE_FIELDS,
};
