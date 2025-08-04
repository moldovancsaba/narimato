'use client';

import React from 'react';
import { handleApiError, validateSessionIntegrity, recoverSessionState, clearErrorLogs } from '../lib/utils/errorHandling';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  sessionId?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  enableRecovery?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  isRecovering: boolean;
  recoveryAttempted: boolean;
}

/**
 * Enhanced Error Boundary with automatic recovery mechanisms
 * 
 * Features:
 * - Automatic session recovery for recoverable errors
 * - Detailed error logging and context preservation
 * - User-friendly error messages with recovery options
 * - Integration with application error handling system
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      isRecovering: false,
      recoveryAttempted: false
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to trigger error UI render
    return { 
      hasError: true, 
      error,
      isRecovering: false,
      recoveryAttempted: false
    };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Store error details for debugging and recovery
    this.setState({ error, errorInfo });
    
    if (this.props.sessionId) {
      try {
        // Backup current state before attempting recovery
        await this.backupSessionState(this.props.sessionId);
        
        // Attempt recovery from the error
        const recovered = await this.recoverFromError(error);
        
        if (!recovered) {
          // Clear corrupted state and force refresh as last resort
          localStorage.removeItem('sessionId');
          localStorage.removeItem('lastState');
          window.location.reload();
        }
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
        // Continue with normal error boundary behavior
      }
    }
    
    // Handle error through centralized error handling system
    await handleApiError(error, 'React Error Boundary', this.props.sessionId);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Attempt automatic recovery if enabled and session ID is available
    if (this.props.enableRecovery && this.props.sessionId && !this.state.recoveryAttempted) {
      this.attemptRecovery();
    }
  }

  /**
   * Backs up current session state for recovery purposes
   * 
   * @param sessionId - The session ID to backup
   */
  private async backupSessionState(sessionId: string): Promise<void> {
    try {
      // Get current session state from various sources
      const currentState = {
        sessionUUID: sessionId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        localStorage: {
          sessionUUID: localStorage.getItem('sessionUUID'),
          lastState: localStorage.getItem('lastState'),
          sessionData: localStorage.getItem(`session_${sessionId}`)
        }
      };
      
      // Store backup with timestamp
      const backupKey = `backup_${sessionId}_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(currentState));
      
      // Keep only last 5 backups to prevent storage overflow
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(`backup_${sessionId}_`));
      
      if (backupKeys.length > 5) {
        const sortedKeys = backupKeys.sort();
        sortedKeys.slice(0, -5).forEach(key => {
          localStorage.removeItem(key);
        });
      }
      
      console.log(`Session state backed up with key: ${backupKey}`);
    } catch (error) {
      console.error('Failed to backup session state:', error);
    }
  }

  /**
   * Attempts to recover from the specific error that occurred
   * 
   * @param error - The error to recover from
   * @returns Promise<boolean> - true if recovery was successful
   */
  private async recoverFromError(error: Error): Promise<boolean> {
    if (!this.props.sessionId) {
      console.log('No session ID available for recovery');
      return false;
    }

    console.log(`Attempting to recover from error: ${error.message}`);

    try {
      // First, try to validate current session
      const isValidSession = await this.validateCurrentSession();
      
      if (isValidSession) {
        console.log('Current session is valid, clearing error state');
        return true;
      }

      // If session is invalid, attempt recovery using utility function
      const recoverySuccess = await recoverSessionState(this.props.sessionId);
      
      if (recoverySuccess) {
        console.log('Session recovery successful');
        return true;
      }

      console.log('Session recovery failed');
      return false;
      
    } catch (recoveryError) {
      console.error('Error during recovery attempt:', recoveryError);
      return false;
    }
  }

  /**
   * Validates if the current session is still valid
   * 
   * @returns Promise<boolean> - true if session is valid
   */
  private async validateCurrentSession(): Promise<boolean> {
    if (!this.props.sessionId) {
      return false;
    }

    try {
      const response = await fetch(`/api/v1/session/validate?sessionUUID=${this.props.sessionId}`);
      const data = await response.json();
      
      return response.ok && data.isValid;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Attempts automatic error recovery by:
   * - Validating current session state
   * - Recovering session data if possible
   * - Clearing error state if recovery succeeds
   */
  private async attemptRecovery(): Promise<void> {
    if (this.state.isRecovering || this.retryCount >= this.maxRetries) {
      return;
    }

    this.setState({ isRecovering: true, recoveryAttempted: true });
    this.retryCount++;

    try {
      console.log(`Attempting error recovery (attempt ${this.retryCount}/${this.maxRetries})`);
      
      // Try to recover session state if session ID is available
      if (this.props.sessionId) {
        const recoverySuccess = await recoverSessionState(this.props.sessionId);
        
        if (recoverySuccess) {
          console.log('Session recovery successful, clearing error state');
          
          // Small delay to ensure state is properly restored
          setTimeout(() => {
            this.setState({ 
              hasError: false, 
              error: undefined, 
              errorInfo: undefined,
              isRecovering: false 
            });
          }, 1000);
          
          return;
        }
      }
      
      // If session recovery fails, try clearing corrupted data
      console.log('Session recovery failed, clearing potentially corrupted data');
      clearErrorLogs();
      
      // Reset error state to attempt re-render
      setTimeout(() => {
        this.setState({ 
          hasError: false, 
          error: undefined, 
          errorInfo: undefined,
          isRecovering: false 
        });
      }, 500);
      
    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  }

  /**
   * Manual retry handler for user-initiated recovery
   */
  private handleManualRetry = async (): Promise<void> => {
    if (this.retryCount < this.maxRetries) {
      await this.attemptRecovery();
    } else {
      // Force full page reload if max retries exceeded
      window.location.reload();
    }
  };

  /**
   * Resets the error boundary state
   */
  private handleReset = (): void => {
    this.retryCount = 0;
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      isRecovering: false,
      recoveryAttempted: false
    });
  };

  /**
   * Clears all stored data and reloads the page
   */
  private handleClearAndReload = (): void => {
    clearErrorLogs();
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Show recovery in progress state
      if (this.state.isRecovering) {
        return (
          <div className="flex items-center justify-center bg-gray-100" style={{ minHeight: 'calc(100vh - 80px)' }}>
            <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Recovering...</h2>
              <p className="text-gray-600">Attempting to restore your session</p>
            </div>
          </div>
        );
      }

      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Determine error message based on error type
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
      const isSessionError = errorMessage.includes('session') || errorMessage.includes('expired');
      
      return (
        <div className="flex items-center justify-center bg-gray-100 p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md w-full">
            {/* Error Icon */}
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            {/* Error Title */}
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              {isNetworkError ? 'Connection Problem' : isSessionError ? 'Session Issue' : 'Something went wrong'}
            </h2>
            
            {/* Error Message */}
            <p className="text-gray-600 mb-6">
              {isNetworkError 
                ? 'Unable to connect to the server. Please check your internet connection.' 
                : isSessionError 
                ? 'Your session has expired or become invalid. We\'ll try to recover your progress.'
                : 'An unexpected error occurred. We\'re working to fix it.'}
            </p>

            {/* Retry Count Display */}
            {this.retryCount > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                Retry attempts: {this.retryCount}/{this.maxRetries}
              </p>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Retry Button */}
              {this.retryCount < this.maxRetries && (
                <button
                  onClick={this.handleManualRetry}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors font-medium"
                >
                  {this.props.enableRecovery ? 'Try Recovery' : 'Try Again'}
                </button>
              )}
              
              {/* Reset Button */}
              <button
                onClick={this.handleReset}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors font-medium"
              >
                Reset
              </button>
              
              {/* Full Reload Button */}
              <button
                onClick={this.handleClearAndReload}
                className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors font-medium"
              >
                Clear Data & Reload
              </button>
            </div>

            {/* Technical Details (collapsible) */}
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600 font-mono">
                <p><strong>Error:</strong> {this.state.error?.message}</p>
                {this.props.sessionId && (
                  <p><strong>Session:</strong> {this.props.sessionId}</p>
                )}
                <p><strong>Time:</strong> {new Date().toISOString()}</p>
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
