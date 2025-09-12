// FUNCTIONAL: Next.js custom App component with GA4 integration
// STRATEGIC: Central location for analytics initialization, Consent Mode, and SPA route tracking

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { GA_ID, isProd, pageview } from '../lib/analytics/ga';

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // FUNCTIONAL: Track route changes for SPA navigation
    // STRATEGIC: Ensures all client-side navigation is tracked in GA4
    if (!isProd || !GA_ID) return;

    // Track initial pageview
    try {
      pageview(window.location.pathname + window.location.search);
    } catch (e) { /* noop */ }

    // Track subsequent route changes
    const handleRouteChange = (url) => {
      try { pageview(url); } catch (e) { /* noop */ }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    router.events.on('hashChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      router.events.off('hashChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      {/* Only load GA in production with valid ID */}
      {isProd && GA_ID && (
        <>
          {/* FUNCTIONAL: Load GA script ASAP after hydration */}
          {/* STRATEGIC: Ensures gtag is available for early events */}
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />

          {/* FUNCTIONAL: Initialize GA4 with Consent Mode v2 and IP anonymization */}
          {/* STRATEGIC: GDPR-friendly defaults; SPA controls pageviews manually */}
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);} 

                // Consent Mode defaults: deny until user grants
                gtag('consent', 'default', {
                  'analytics_storage': 'denied',
                  'ad_storage': 'denied'
                });

                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  anonymize_ip: true,
                  send_page_view: false
                });

                // Expose consent helper on window for future UI toggle
                window.NARIMATO_setAnalyticsConsent = function(granted) {
                  gtag('consent', 'update', {
                    'analytics_storage': granted ? 'granted' : 'denied'
                  });
                };
              `,
            }}
          />
        </>
      )}

      {/* FUNCTIONAL: Global admin session controls (Logout) */}
      {/* STRATEGIC: Make it easy to end admin sessions and verify SSR gatekeeping */}
      <AdminSessionControls />

      <Component {...pageProps} />
    </>
  );
}

// FUNCTIONAL: Renders a fixed Logout button when an admin session is present
// STRATEGIC: Users can explicitly end sessions and confirm protected routes redirect
function AdminSessionControls() {
  const router = useRouter();
  const [authed, setAuthed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/login');
        if (!mounted) return;
        setAuthed(res.ok);
      } catch {
        if (!mounted) return;
        setAuthed(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
      // After logout, redirect to login page
      router.replace('/admin/login');
    } catch {
      router.replace('/admin/login');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) return null;

  return (
    <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999 }}>
      <button
        onClick={logout}
        disabled={busy}
        className="btn btn-secondary btn-sm"
        title="Logout"
        style={{ cursor: 'pointer' }}
      >
        {busy ? 'Logging out…' : 'Logout'}
      </button>
    </div>
  );
}

