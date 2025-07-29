/**
 * Chunk Error Handler - Prevents ChunkLoadError from breaking user experience
 * 
 * This utility provides robust error handling for Next.js chunk loading failures
 * by implementing automatic retry mechanisms and graceful fallbacks.
 */

interface ChunkRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableConsoleLogging?: boolean;
}

class ChunkErrorHandler {
  private static instance: ChunkErrorHandler;
  private maxRetries: number;
  private retryDelay: number;
  private enableConsoleLogging: boolean;
  private retryAttempts: Map<string, number> = new Map();

  private constructor(options: ChunkRetryOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.enableConsoleLogging = options.enableConsoleLogging ?? true;
  }

  public static getInstance(options?: ChunkRetryOptions): ChunkErrorHandler {
    if (!ChunkErrorHandler.instance) {
      ChunkErrorHandler.instance = new ChunkErrorHandler(options);
    }
    return ChunkErrorHandler.instance;
  }

  /**
   * Initialize chunk error handling for the application
   */
  public initialize(): void {
    this.setupGlobalErrorHandlers();
    this.setupWindowErrorHandler();
    this.setupUnhandledRejectionHandler();
  }

  /**
   * Setup global error handlers for chunk loading failures
   */
  private setupGlobalErrorHandlers(): void {
    // Handle chunk loading errors globally
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          
          // If chunk request fails, retry with exponential backoff
          if (!response.ok && this.isChunkRequest(args[0])) {
            return this.retryChunkRequest(originalFetch, ...args);
          }
          
          return response;
        } catch (error) {
          if (this.isChunkRequest(args[0])) {
            return this.retryChunkRequest(originalFetch, ...args);
          }
          throw error;
        }
      };
    }
  }

  /**
   * Setup window error handler for unhandled chunk errors
   */
  private setupWindowErrorHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        if (this.isChunkLoadError(event.error) || this.isChunkLoadError(event.message)) {
          event.preventDefault();
          this.handleChunkError(event.error || new Error(event.message));
        }
      });
    }
  }

  /**
   * Setup unhandled promise rejection handler
   */
  private setupUnhandledRejectionHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        if (this.isChunkLoadError(event.reason)) {
          event.preventDefault();
          this.handleChunkError(event.reason);
        }
      });
    }
  }

  /**
   * Check if the request is for a JavaScript chunk
   */
  private isChunkRequest(url: string | Request | URL): boolean {
    let urlString: string;
    if (typeof url === 'string') {
      urlString = url;
    } else if (url instanceof URL) {
      urlString = url.href;
    } else {
      urlString = url.url;
    }
    
    return (
      urlString.includes('/_next/static/chunks/') ||
      urlString.includes('.js') ||
      urlString.includes('/_next/')
    );
  }

  /**
   * Check if error is related to chunk loading
   */
  private isChunkLoadError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const errorStack = error.stack || '';
    
    return (
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('Loading CSS chunk') ||
      errorMessage.includes('Failed to import') ||
      errorStack.includes('chunk') ||
      error.name === 'ChunkLoadError'
    );
  }

  /**
   * Retry chunk request with exponential backoff
   */
  private async retryChunkRequest(
    originalFetch: typeof fetch,
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    let url: string;
    if (typeof args[0] === 'string') {
      url = args[0];
    } else if (args[0] instanceof URL) {
      url = args[0].href;
    } else {
      url = args[0].url;
    }
    
    const currentAttempts = this.retryAttempts.get(url) || 0;

    if (currentAttempts >= this.maxRetries) {
      this.logError(`Max retries exceeded for chunk: ${url}`);
      // Force page reload as last resort
      this.forcePageReload();
      throw new Error(`Failed to load chunk after ${this.maxRetries} attempts: ${url}`);
    }

    // Wait with exponential backoff
    const delay = this.retryDelay * Math.pow(2, currentAttempts);
    await this.sleep(delay);

    this.retryAttempts.set(url, currentAttempts + 1);
    this.logInfo(`Retrying chunk load (attempt ${currentAttempts + 1}/${this.maxRetries}): ${url}`);

    try {
      const response = await originalFetch(...args);
      
      if (response.ok) {
        // Reset retry count on success
        this.retryAttempts.delete(url);
        return response;
      }
      
      // If still failing, try again
      return this.retryChunkRequest(originalFetch, ...args);
    } catch (error) {
      return this.retryChunkRequest(originalFetch, ...args);
    }
  }

  /**
   * Handle chunk errors gracefully
   */
  private handleChunkError(error: Error): void {
    this.logError('Chunk load error detected:', error);

    // Try to reload the page after a short delay
    setTimeout(() => {
      this.forcePageReload();
    }, 2000);
  }

  /**
   * Force page reload as last resort
   */
  private forcePageReload(): void {
    if (typeof window !== 'undefined') {
      this.logInfo('Forcing page reload due to chunk error...');
      
      // Clear any cached chunks
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('next-static') || name.includes('webpack')) {
              caches.delete(name);
            }
          });
        });
      }

      // Force hard reload
      window.location.reload();
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utilities
   */
  private logInfo(message: string, ...args: any[]): void {
    if (this.enableConsoleLogging) {
      console.info(`[ChunkErrorHandler] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    if (this.enableConsoleLogging) {
      console.error(`[ChunkErrorHandler] ${message}`, ...args);
    }
  }

  /**
   * Reset retry attempts (useful for testing or manual intervention)
   */
  public resetRetryAttempts(): void {
    this.retryAttempts.clear();
  }

  /**
   * Get current retry statistics
   */
  public getRetryStats(): { [url: string]: number } {
    const stats: { [url: string]: number } = {};
    this.retryAttempts.forEach((attempts, url) => {
      stats[url] = attempts;
    });
    return stats;
  }
}

// Export singleton instance
export const chunkErrorHandler = ChunkErrorHandler.getInstance({
  maxRetries: 3,
  retryDelay: 1000,
  enableConsoleLogging: process.env.NODE_ENV === 'development'
});

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  chunkErrorHandler.initialize();
}

export default ChunkErrorHandler;
