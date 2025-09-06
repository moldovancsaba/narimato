// FUNCTIONAL: Google Analytics 4 helper module for centralized tracking
// STRATEGIC: Provides reusable analytics functions with production-only guards and Consent Mode v2 support

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const isProd = process.env.NODE_ENV === 'production';

// Initialize GA with Consent Mode v2 defaults
// Note: We initialize core GA in pages/_app.js via inline Script to ensure gtag is available ASAP.
// This module offers helpers and safety guards for usage throughout the app.

// Track pageviews with IP anonymization
export function pageview(url) {
  // FUNCTIONAL: Tracks SPA page navigation
  // STRATEGIC: Manual pageview tracking ensures accurate SPA analytics
  if (!isProd || !GA_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  
  window.gtag('config', GA_ID, {
    page_path: url,
    anonymize_ip: true,
  });
}

// Track custom events
export function event(name, params = {}) {
  // FUNCTIONAL: Wrapper for custom event tracking
  // STRATEGIC: Centralized event tracking with production guards
  if (!isProd || !GA_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('event', name, params);
}

// Consent management helpers
export function grantAnalyticsConsent() {
  // FUNCTIONAL: Updates consent to granted state
  // STRATEGIC: Enables analytics after user consent
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
  });
}

export function revokeAnalyticsConsent() {
  // FUNCTIONAL: Updates consent to denied state
  // STRATEGIC: Disables analytics when consent withdrawn
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('consent', 'update', {
    analytics_storage: 'denied',
  });
}

// Attach convenience method to window (no-op in SSR)
if (typeof window !== 'undefined') {
  window.NARIMATO_setAnalyticsConsent = function (granted) {
    if (granted) {
      try { grantAnalyticsConsent(); } catch (e) {}
    } else {
      try { revokeAnalyticsConsent(); } catch (e) {}
    }
  };
}

