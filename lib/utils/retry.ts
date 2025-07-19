import { createLogger } from '@/lib/logger';

const logger = createLogger('retry-util');

export interface RetryOptions {
  retries?: number;
  backoff?: boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  backoff: true,
  onRetry: () => {}
};

/**
 * Retries an async operation with exponential backoff
 * @param operation The async operation to retry
 * @param options Retry configuration options
 * @returns The result of the operation
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on the last attempt
      if (attempt === opts.retries) {
        throw lastError;
      }

      // Calculate backoff delay
      const delay = opts.backoff
        ? Math.min(100 * Math.pow(2, attempt - 1), 3000) // Max 3 second delay
        : 100;

      logger.warn('Operation failed, retrying...', {
        attempt,
        nextAttemptDelay: delay,
        error: lastError.message
      });

      opts.onRetry(lastError, attempt);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never happen due to the throw in the loop
  throw lastError || new Error('Retry failed');
}
