/**
 * Anonymous Session Management Utility
 * 
 * This module provides functionality for managing anonymous user sessions using localStorage.
 * It implements UUID generation, session storage, and helper functions for session management.
 * All timestamps are stored in ISO 8601 format with milliseconds precision in UTC.
 * 
 * @module anonymousSession
 */

/**
 * Represents an anonymous user session with unique identification and timing information.
 * All timestamps are in ISO 8601 format with milliseconds precision in UTC.
 */
interface AnonymousSession {
  id: string;
  createdAt: string; // ISO 8601 with milliseconds
  lastActive: string;
}

/**
 * Storage key used for the anonymous session in localStorage.
 * Using a namespaced key to avoid potential conflicts with other storage items.
 */
const STORAGE_KEY = 'narimato:anonymous_session';

/**
 * Generates a UUID v4 for unique session identification.
 * Uses crypto.randomUUID() if available, falls back to Math.random() based implementation.
 * 
 * @returns A randomly generated UUID string
 */
function generateUUID(): string {
  // Use crypto.randomUUID() if available (more cryptographically secure)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback to Math.random() based implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a new anonymous session with a unique ID and current timestamp.
 * Both createdAt and lastActive are set to the current time in ISO 8601 format.
 * 
 * @returns A new AnonymousSession object
 * @throws Error if localStorage is not available
 */
export function createAnonymousSession(): AnonymousSession {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  const now = new Date().toISOString(); // Returns ISO 8601 with milliseconds in UTC
  const session: AnonymousSession = {
    id: generateUUID(),
    createdAt: now,
    lastActive: now,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

/**
 * Retrieves the current anonymous session if it exists.
 * 
 * @returns The current AnonymousSession or null if none exists
 * @throws Error if localStorage is not available
 */
export function getCurrentSession(): AnonymousSession | null {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  const sessionData = localStorage.getItem(STORAGE_KEY);
  if (!sessionData) {
    return null;
  }

  try {
    const session = JSON.parse(sessionData);
    // Validate the session object has all required properties
    if (!session.id || !session.createdAt || !session.lastActive) {
      return null;
    }
    return session;
  } catch {
    // If JSON parsing fails, return null and remove the invalid data
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Updates the lastActive timestamp of the current session to the current time.
 * If no session exists, returns null without creating a new one.
 * 
 * @returns The updated AnonymousSession or null if no session exists
 * @throws Error if localStorage is not available
 */
export function updateSessionActivity(): AnonymousSession | null {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  const currentSession = getCurrentSession();
  if (!currentSession) {
    return null;
  }

  const updatedSession: AnonymousSession = {
    ...currentSession,
    lastActive: new Date().toISOString(), // Updates to current time in ISO 8601
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
  return updatedSession;
}

/**
 * Clears the current anonymous session from storage.
 * This is useful for implementing logout functionality or clearing session data.
 * 
 * @throws Error if localStorage is not available
 */
export function clearSession(): void {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Ensures a valid anonymous session exists, creating one if necessary.
 * This is the recommended way to obtain a session as it handles all edge cases.
 * 
 * @returns An AnonymousSession object, either existing or newly created
 * @throws Error if localStorage is not available
 */
export function ensureSession(): AnonymousSession {
  const currentSession = getCurrentSession();
  return currentSession || createAnonymousSession();
}

/**
 * Checks if the provided session object is valid.
 * A valid session must have all required properties and valid timestamp formats.
 * 
 * @param session - The session object to validate
 * @returns boolean indicating if the session is valid
 */
export function isValidSession(session: unknown): session is AnonymousSession {
  if (!session || typeof session !== 'object') {
    return false;
  }

  const { id, createdAt, lastActive } = session as AnonymousSession;

  // Check if all required properties exist
  if (!id || !createdAt || !lastActive) {
    return false;
  }

  // Validate timestamp formats (must be ISO 8601)
  const isValidTimestamp = (timestamp: string): boolean => {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp.includes('.');  // Ensures milliseconds are present
  };

  return (
    typeof id === 'string' &&
    typeof createdAt === 'string' &&
    typeof lastActive === 'string' &&
    isValidTimestamp(createdAt) &&
    isValidTimestamp(lastActive)
  );
}
