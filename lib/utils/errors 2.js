// FUNCTIONAL: Centralized error envelope builder
// STRATEGIC: Enforces uniform error responses and taxonomy for easier
// observability, client handling, and documentation accuracy
import { v4 as uuidv4 } from 'uuid';

// Error codes taxonomy (1xxx client, 2xxx auth, 3xxx business-state,
// 4xxx resource, 5xxx system). Extend as needed.
export const ERROR_CODES = {
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 2001,
  FORBIDDEN: 2003,
  BUSINESS_CONFLICT: 3009,
  NOT_FOUND: 4004,
  SYSTEM_FAILURE: 5000,
};

export function buildErrorEnvelope({ code, message, details, requestId }) {
  const ts = new Date().toISOString();
  return {
    error: {
      code,
      message,
      details: details || null,
      timestamp: ts,
      requestId: requestId || uuidv4(),
    },
  };
}
