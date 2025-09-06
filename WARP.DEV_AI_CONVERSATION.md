# WARP.DEV_AI_CONVERSATION

- Timestamp: 2025-09-06T14:09:05.000Z
- Author: Agent Mode (AI)

Plan: Implement Google Analytics 4 (GA4) integration across the Next.js Pages Router app with production-only loading, IP anonymization, and Consent Mode v2. Add SPA pageview tracking, instrument gameplay/result events, and update documentation and versioning per project rules.

Decisions:
- Single GA property across all orgs
- Production-only load (NODE_ENV=production)
- IP anonymization enabled on all hits
- Consent Mode v2 defaults to denied; expose `window.NARIMATO_setAnalyticsConsent(granted)` helper
- Custom events: `play_start`, `swipe_action`, `vote_cast`, `segment_end`, `play_complete`, `results_view`

Changes:
- Created `lib/analytics/ga.js` (helpers with production guards, consent helpers)
- Added `pages/_app.js` (loads gtag, initializes Consent Mode, tracks SPA pageviews)
- Instrumented `pages/play.js` and `pages/results.js` with custom events
- Updated package.json versions (5.5.1 → build verification → 5.6.0)
- Updated README.md, ARCHITECTURE.md, TASKLIST.md, ROADMAP.md, LEARNINGS.md, RELEASE_NOTES.md (ISO 8601 timestamps)

CSP Guidance:
- script-src: https://www.googletagmanager.com https://www.google-analytics.com
- connect/img-src: https://www.google-analytics.com

Next steps:
- Add consent UI (cookie banner) wiring to `window.NARIMATO_setAnalyticsConsent`
- Configure Vercel Production env var: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-8RCT54Y6E7`
- Optional: BigQuery export for raw event analysis

