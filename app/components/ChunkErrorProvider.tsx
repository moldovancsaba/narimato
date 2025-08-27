'use client';

import { useEffect, ReactNode } from 'react';
import { chunkErrorHandler } from '@/app/lib/utils/chunkErrorHandler';

interface ChunkErrorProviderProps {
  children: ReactNode;
}

/**
 * ChunkErrorProvider - Initializes chunk error handling for the entire application
 * 
 * This component ensures that chunk load errors are handled gracefully throughout
 * the application lifecycle, preventing ChunkLoadError from breaking user experience.
 */
export default function ChunkErrorProvider({ children }: ChunkErrorProviderProps) {
  useEffect(() => {
    // Initialize chunk error handling as early as possible
    try {
      chunkErrorHandler.initialize();
      
      // Add additional safeguards for Next.js specific issues
      const handleRouteChangeError = (err: Error) => {
        if (err.message.includes('Loading chunk') || err.message.includes('ChunkLoadError')) {
          console.warn('[ChunkErrorProvider] Route change chunk error handled:', err);
          // Prevent the error from bubbling up
          return false;
        }
      };

      // Add Next.js router error handling if available
      if (typeof window !== 'undefined' && (window as any).next) {
        const router = (window as any).next.router;
        if (router) {
          router.events?.on('routeChangeError', handleRouteChangeError);
          
          // Cleanup on unmount
          return () => {
            router.events?.off('routeChangeError', handleRouteChangeError);
          };
        }
      }

      // Additional error boundary for dynamic imports
      const originalImport = (window as any).__webpack_require__?.bind?.(window);
      if (originalImport) {
        (window as any).__webpack_require__ = function(...args: any[]) {
          try {
            return originalImport.apply(this, args);
          } catch (error: any) {
            if (error.message.includes('Loading chunk')) {
              console.warn('[ChunkErrorProvider] Webpack chunk error handled:', error);
              // Trigger page reload after short delay
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }, 1000);
            }
            throw error;
          }
        };
      }

    } catch (error) {
      console.error('[ChunkErrorProvider] Failed to initialize chunk error handler:', error);
    }
  }, []);

  return <>{children}</>;
}
