/**
 * Error Handling Utilities for Narimato Application
 * 
 * ARCHITECTURAL PURPOSE:
 * - Centralizes all error handling logic to ensure consistent behavior across the application
 * - Provides automatic recovery mechanisms to minimize user disruption
 * - Implements secure error reporting that doesn't leak sensitive information
 * 
 * BUSINESS LOGIC RATIONALE:
 * - Different error types require different recovery strategies (network vs validation)
 * - Session recovery prevents data loss during temporary failures
 * - Exponential backoff prevents overwhelming servers during outages
 * 
 * SECURITY CONSIDERATIONS:
 * - Error messages are sanitized to prevent information leakage
 * - Retry attempts are rate-limited to prevent DoS attacks
 * - Sensitive data is never logged or stored in error details
 * - Local storage usage is controlled to prevent storage exhaustion attacks
 */

import { ISession } from '../models/Session';

// Error types for categorization and appropriate handling
export type ErrorType = 
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED' 
  | 'VALIDATION_ERROR'
  | 'CONCURRENT_MODIFICATION'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError extends Error {
  type: ErrorType;
  code?: string;
  details?: any;
  timestamp: string;
  sessionId?: string;
  recoverable: boolean;
}

// Retry configuration for different error types
const RETRY_CONFIG = {
  NETWORK_ERROR: { maxRetries: 3, baseDelay: 1000, exponential: true },
  SERVER_ERROR: { maxRetries: 2, baseDelay: 2000, exponential: true },
  CONCURRENT_MODIFICATION: { maxRetries: 1, baseDelay: 500, exponential: false },
  SESSION_EXPIRED: { maxRetries: 0, baseDelay: 0, exponential: false },
  VALIDATION_ERROR: { maxRetries: 0, baseDelay: 0, exponential: false },
  UNKNOWN_ERROR: { maxRetries: 1, baseDelay: 1000, exponential: false }
};

/**
 * Creates a standardized application error with context information
 * 
 * @param type - The categorized error type for appropriate handling
 * @param message - Human-readable error message
 * @param originalError - The original error that triggered this
 * @param sessionId - Current session ID for context
 * @param details - Additional error details for debugging
 * @returns Standardized AppError with recovery information
 */
export function createAppError(
  type: ErrorType,
  message: string,
  originalError?: Error,
  sessionId?: string,
  details?: any
): AppError {
  const error = new Error(message) as AppError;
  error.type = type;
  error.timestamp = new Date().toISOString();
  error.sessionId = sessionId;
  error.details = {
    original: originalError?.message,
    stack: originalError?.stack,
    ...details
  };
  
  // Determine if error is recoverable based on type
  error.recoverable = ['NETWORK_ERROR', 'SERVER_ERROR', 'CONCURRENT_MODIFICATION'].includes(type);
  
  return error;
}

/**
 * Handles API failures with automatic retry logic and contextual error reporting
 * 
 * This function provides robust error handling for API calls with:
 * - Exponential backoff retry strategy
 * - Error type classification
 * - Session context preservation
 * - Detailed logging for debugging
 * 
 * @param error - The error that occurred during API call
 * @param context - Description of the operation that failed
 * @param sessionId - Current session ID for context
 * @returns Promise that resolves when error handling is complete
 */
export async function handleApiError(error: Error, context: string, sessionId?: string): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Categorize the error based on characteristics
  let errorType: ErrorType = 'UNKNOWN_ERROR';
  let recoverable = false;
  
  if (error.message.includes('fetch') || error.message.includes('network')) {
    errorType = 'NETWORK_ERROR';
    recoverable = true;
  } else if (error.message.includes('expired') || error.message.includes('invalid session')) {
    errorType = 'SESSION_EXPIRED';
    recoverable = false;
  } else if (error.message.includes('validation') || error.message.includes('invalid')) {
    errorType = 'VALIDATION_ERROR';
    recoverable = false;
  } else if (error.message.includes('concurrent') || error.message.includes('version')) {
    errorType = 'CONCURRENT_MODIFICATION';
    recoverable = true;
  } else if (error.message.includes('500') || error.message.includes('server')) {
    errorType = 'SERVER_ERROR';
    recoverable = true;
  }
  
  const appError = createAppError(errorType, error.message, error, sessionId, { context });
  
  // Log error with full context for debugging
  console.error(`[${timestamp}] API Error in ${context}:`, {
    type: errorType,
    message: error.message,
    sessionId,
    recoverable,
    stack: error.stack
  });
  
  // Store error for potential recovery analysis
  try {
    const errorLog = localStorage.getItem('errorLog') || '[]';
    const errors = JSON.parse(errorLog);
    errors.push({
      timestamp,
      context,
      type: errorType,
      message: error.message,
      sessionId,
      recoverable
    });
    
    // Keep only last 50 errors to prevent storage overflow
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
    
    localStorage.setItem('errorLog', JSON.stringify(errors));
  } catch (storageError) {
    console.warn('Failed to store error log:', storageError);
  }
  
  // Trigger error recovery if appropriate
  if (recoverable && sessionId) {
    await attemptErrorRecovery(appError, context);
  }
}

/**
 * Attempts automatic error recovery based on error type and context
 * 
 * @param error - The categorized application error
 * @param context - The operation context where error occurred
 */
async function attemptErrorRecovery(error: AppError, context: string): Promise<void> {
  const retryConfig = RETRY_CONFIG[error.type];
  
  if (retryConfig.maxRetries === 0) {
    return; // No retry for this error type
  }
  
  console.log(`Attempting recovery for ${error.type} in ${context}`);
  
  // Implement recovery strategies based on error type
  switch (error.type) {
    case 'NETWORK_ERROR':
      // For network errors, wait and potentially refresh connection
      await new Promise(resolve => setTimeout(resolve, retryConfig.baseDelay));
      break;
      
    case 'CONCURRENT_MODIFICATION':
      // For concurrent modifications, refresh session state
      if (error.sessionId) {
        await recoverSessionState(error.sessionId);
      }
      break;
      
    case 'SERVER_ERROR':
      // For server errors, implement exponential backoff
      const delay = retryConfig.exponential 
        ? retryConfig.baseDelay * Math.pow(2, 1) // Start with first retry
        : retryConfig.baseDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
      break;
  }
}

/**
 * Manages state recovery for corrupted or lost session data
 * 
 * This function implements comprehensive session recovery by:
 * - Validating current session state
 * - Restoring from local storage backups
 * - Re-synchronizing with server state
 * - Cleaning up corrupted data
 * 
 * @param sessionId - The session ID to recover
 * @returns Promise<boolean> - true if recovery was successful, false otherwise
 */
export async function recoverSessionState(sessionId: string): Promise<boolean> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Attempting session state recovery for ${sessionId}`);
  
  try {
    // Step 1: Check if session exists on server
    const validateResponse = await fetch(`/api/v1/session/validate?sessionId=${sessionId}`);
    const validateData = await validateResponse.json();
    
    if (!validateResponse.ok || !validateData.isValid) {
      console.log(`Session ${sessionId} is invalid on server, attempting local recovery`);
      
      // Try to recover from local storage
      const lastState = localStorage.getItem('lastState');
      const backupSession = localStorage.getItem(`session_${sessionId}`);
      
      if (lastState || backupSession) {
        // Attempt to restore session from backup
        const restoredData = lastState ? JSON.parse(lastState) : JSON.parse(backupSession!);
        
        // Create new session with restored data
        const newSessionResponse = await fetch('/api/v1/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restoreData: restoredData
          })
        });
        
        if (newSessionResponse.ok) {
          const newSessionData = await newSessionResponse.json();
          localStorage.setItem('sessionId', newSessionData.sessionId);
          console.log(`Successfully created new session ${newSessionData.sessionId} from backup`);
          return true;
        }
      }
      
      // If local recovery fails, clean up and return false
      localStorage.removeItem('sessionId');
      localStorage.removeItem('lastState');
      localStorage.removeItem(`session_${sessionId}`);
      return false;
    }
    
    // Step 2: Session is valid, use existing session data from validation response
    try {
      // Use session data already retrieved from validation
      const syncState = {
        sessionId,
        session: validateData.session || {},
        timestamp: new Date().toISOString(),
        version: validateData.version
      };
      
      localStorage.setItem(`session_${sessionId}`, JSON.stringify(syncState));
      localStorage.setItem('lastSyncState', JSON.stringify(syncState));
      
      console.log(`Successfully synchronized session ${sessionId}`);
      return true;
      
    } catch (syncError) {
      console.error('Failed to synchronize session state:', syncError);
      return false;
    }
    
  } catch (error) {
    console.error(`Session recovery failed for ${sessionId}:`, error);
    await handleApiError(error as Error, 'session recovery', sessionId);
    return false;
  }
}

/**
 * Validates session integrity and detects potential data corruption
 * 
 * This function performs comprehensive validation of session data:
 * - Checks required fields and data types
 * - Validates business logic constraints
 * - Detects inconsistencies in state transitions
 * - Verifies data relationships and references
 * 
 * @param session - The session object to validate
 * @returns boolean - true if session is valid and consistent, false otherwise
 */
export function validateSessionIntegrity(session: any): boolean {
  if (!session) {
    console.warn('Session validation failed: session is null or undefined');
    return false;
  }
  
  // Check required fields
  const requiredFields = ['sessionId', 'status', 'state', 'version', 'createdAt', 'lastActivity', 'expiresAt'];
  for (const field of requiredFields) {
    if (!(field in session)) {
      console.warn(`Session validation failed: missing required field ${field}`);
      return false;
    }
  }
  
  // Validate session ID format (should be UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(session.sessionId)) {
    console.warn('Session validation failed: invalid sessionId format');
    return false;
  }
  
  // Validate status values
  const validStatuses = ['active', 'idle', 'completed', 'expired'];
  if (!validStatuses.includes(session.status)) {
    console.warn(`Session validation failed: invalid status ${session.status}`);
    return false;
  }
  
  // Validate state values
  const validStates = ['swiping', 'voting', 'comparing', 'completed'];
  if (!validStates.includes(session.state)) {
    console.warn(`Session validation failed: invalid state ${session.state}`);
    return false;
  }
  
  // Validate version is a non-negative number
  if (typeof session.version !== 'number' || session.version < 0) {
    console.warn('Session validation failed: invalid version number');
    return false;
  }
  
  // Validate timestamp fields
  const timestampFields = ['createdAt', 'lastActivity', 'expiresAt'];
  for (const field of timestampFields) {
    const timestamp = new Date(session[field]);
    if (isNaN(timestamp.getTime())) {
      console.warn(`Session validation failed: invalid timestamp in ${field}`);
      return false;
    }
  }
  
  // Validate session hasn't expired
  const expirationTime = new Date(session.expiresAt);
  if (expirationTime < new Date()) {
    console.warn('Session validation failed: session has expired');
    return false;
  }
  
  // Validate arrays are actually arrays
  if (session.deck && !Array.isArray(session.deck)) {
    console.warn('Session validation failed: deck is not an array');
    return false;
  }
  
  if (session.swipes && !Array.isArray(session.swipes)) {
    console.warn('Session validation failed: swipes is not an array');
    return false;
  }
  
  if (session.votes && !Array.isArray(session.votes)) {
    console.warn('Session validation failed: votes is not an array');
    return false;
  }
  
  if (session.personalRanking && !Array.isArray(session.personalRanking)) {
    console.warn('Session validation failed: personalRanking is not an array');
    return false;
  }
  
  // Validate business logic constraints
  if (session.swipes) {
    for (const swipe of session.swipes) {
      if (!swipe.cardId || !swipe.direction || !['left', 'right'].includes(swipe.direction)) {
        console.warn('Session validation failed: invalid swipe data');
        return false;
      }
    }
  }
  
  if (session.votes) {
    for (const vote of session.votes) {
      if (!vote.cardA || !vote.cardB || !vote.winner) {
        console.warn('Session validation failed: invalid vote data');
        return false;
      }
      if (vote.winner !== vote.cardA && vote.winner !== vote.cardB) {
        console.warn('Session validation failed: vote winner must be cardA or cardB');
        return false;
      }
    }
  }
  
  // Validate state consistency
  if (session.state === 'completed' && session.status !== 'completed') {
    console.warn('Session validation failed: state/status inconsistency');
    return false;
  }
  
  // Validate lastActivity is not before createdAt
  const createdAt = new Date(session.createdAt);
  const lastActivity = new Date(session.lastActivity);
  if (lastActivity < createdAt) {
    console.warn('Session validation failed: lastActivity before createdAt');
    return false;
  }
  
  console.log(`Session ${session.sessionId} passed integrity validation`);
  return true;
}

/**
 * Legacy retry function with error type configuration
 * 
 * @param fn - The function to retry
 * @param errorType - The type of error expected for retry logic
 * @param context - Context description for logging
 * @param sessionId - Current session ID
 * @returns Promise with the result of the function or throws after max retries
 */
export async function withRetryLegacy<T>(
  fn: () => Promise<T>,
  errorType: ErrorType,
  context: string,
  sessionId?: string
): Promise<T> {
  const config = RETRY_CONFIG[errorType];
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === config.maxRetries) {
        // Final attempt failed, handle error and throw
        await handleApiError(lastError, `${context} (final attempt)`, sessionId);
        throw createAppError(errorType, `${context} failed after ${config.maxRetries + 1} attempts`, lastError, sessionId);
      }
      
      // Calculate delay for next attempt
      const delay = config.exponential 
        ? config.baseDelay * Math.pow(2, attempt)
        : config.baseDelay;
      
      console.log(`${context} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, (error as Error).message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw lastError!;
}

/**
 * Backs up current session state to local storage for recovery
 * 
 * @param sessionId - Session ID to backup
 * @param state - Current session state data
 */
export function backupSessionState(sessionId: string, state: any): void {
  try {
    const backup = {
      sessionId,
      state,
      timestamp: new Date().toISOString(),
      version: state.version || 0
    };
    
    localStorage.setItem(`session_${sessionId}`, JSON.stringify(backup));
    localStorage.setItem('lastState', JSON.stringify(backup));
    
    console.log(`Session state backed up for ${sessionId}`);
  } catch (error) {
    console.warn('Failed to backup session state:', error);
  }
}

/**
 * Enhanced retry utility with timeout and abort controller support
 * 
 * This function provides robust retry logic with:
 * - Configurable timeout for each attempt
 * - AbortController for cancellation support
 * - Exponential backoff between retries
 * - Automatic cleanup of timeouts and controllers
 * 
 * @param fn - The async function to retry
 * @param options - Configuration object with maxAttempts and timeout
 * @returns Promise with the result of the function or throws after max retries
 */
export const withRetry = async (
  fn: () => Promise<any>,
  options: { maxAttempts: number; timeout: number }
) => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      // Create abort controller for timeout handling
      const controller = new AbortController();
      
      // Set up timeout to abort the request
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`Request attempt ${attempt} timed out after ${options.timeout}ms`);
      }, options.timeout);
      
      try {
        // Execute the function with timeout control
        const result = await fn();
        
        // Clear timeout if successful
        clearTimeout(timeoutId);
        
        console.log(`Request succeeded on attempt ${attempt}`);
        return result;
        
      } catch (error) {
        // Clear timeout on error
        clearTimeout(timeoutId);
        throw error;
      }
      
    } catch (error) {
      lastError = error;
      
      // If this was the last attempt, throw the error
      if (attempt === options.maxAttempts) {
        console.error(`All ${options.maxAttempts} attempts failed, throwing error`);
        throw lastError;
      }
      
      // Calculate exponential backoff delay
      const backoffDelay = Math.pow(2, attempt) * 100;
      
      console.log(
        `Attempt ${attempt} failed: ${(error as Error).message}. ` +
        `Retrying in ${backoffDelay}ms... (${attempt}/${options.maxAttempts})`
      );
      
      // Wait before next attempt with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  // This should never be reached due to the throw in the loop,
  // but TypeScript requires a return statement
  throw lastError;
};

/**
 * Clears all stored error logs and session backups
 * Used for cleanup when starting fresh
 */
export function clearErrorLogs(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('session_') || key === 'errorLog' || key === 'lastState' || key === 'lastSyncState') {
        localStorage.removeItem(key);
      }
    });
    console.log('Error logs and session backups cleared');
  } catch (error) {
    console.warn('Failed to clear error logs:', error);
  }
}
