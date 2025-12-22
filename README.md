# NARIMATO

![Version](https://img.shields.io/badge/version-7.1.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)

NARIMATO is an anonymous, session-based card ranking application built with Next.js, MongoDB, and sophisticated binary search ranking algorithms. Global rankings are powered by ELO rating system for accurate skill-based card comparisons.

**Current Version:** 7.1.0 — Swipe/vote interaction improvements (50% swipe threshold with pointer support, safe tap voting); deck global rankings include descendants and exclude deck parent; centered results summary.

## ✨ Key Features

- **Binary Search Ranking**: Efficient O(log n) card positioning algorithm
- **Anonymous Sessions**: No user registration required
- **Real-time State Management**: Optimistic locking with automatic conflict resolution
- **Mobile-First Design**: Responsive interface with touch gesture support
- **Advanced Card Editor**: Comprehensive card creation and editing with live preview
- **Hashtag Management**: Smart hashtag editor with predictive suggestions
- **Play-Based Sessions**: Individual ranking sessions with dynamic card selection
- **Multiple Play Modes**: Choose from distinct ranking approaches:
  - **Vote-Only**: Pure comparison-based ranking through repeated vote pairs (no swiping)
  - **Swipe-Only**: Pure like/dislike interface - rank cards by preference order
  - **Swipe-More**: Enhanced swiping with smart decision tree - optimized ranking
  - **Rank-Only**: Swipe to shortlist, then vote to order the liked set
  - **Rank-More**: Multi-level “family by family” ranking — roots swipe→vote, then randomly ordered families per level, flattened output
- **Hashtag Hierarchy System**: Multi-level card organization through parent-child hashtag relationships
- **Dynamic Text Scaling**: Automatic font sizing for optimal readability
- **Modern Typography**: Professional Fira Code SemiBold font for enhanced aesthetics
- **Clean Card Design**: Simplified interface focused on content without title clutter
- **Session Recovery**: Robust error handling and state persistence
- **Dark Mode Support**: Full dark mode for enhanced visual comfort
- **Comprehensive Error Handling**: Graceful degradation and automatic recovery

## 🚀 Unified API

**All 6 play modes use a single, versioned API:**

```
POST /api/v1/play/start
POST /api/v1/play/{playId}/input
GET  /api/v1/play/{playId}/next
GET  /api/v1/play/{playId}/results
```

**Modes**: vote-only, swipe-only, swipe-more, vote-more, rank-only, rank-more

For complete API documentation with request/response examples, see [docs/API_REFERENCE.md](./docs/API_REFERENCE.md).

## 📚 Documentation

**Last Updated:** 2025-12-22T08:52:52.000Z

### Core Documentation
- **[WARP.md](./WARP.md)** - Single source of truth for AI agents (onboarding, rules, commands)
- **[Architecture](./ARCHITECTURE.md)** - System architecture and technical overview
- **[API Reference](./docs/API_REFERENCE.md)** - Unified Play API documentation

### Project Governance
- **[Roadmap](./ROADMAP.md)** - Development roadmap (forward-looking only)
- **[Task List](./TASKLIST.md)** - Prioritized implementation tasks and status
- **[Release Notes](./RELEASE_NOTES.md)** - Version history and change log
- **[Learnings](./LEARNINGS.md)** - Development insights and lessons learned

For complete documentation index, see [WARP.md](./WARP.md).

## 🚀 Quick Start

Backfill legacy data (optional, one-time):
- To set isPlayable=true on existing cards missing the flag:
  - Run: node scripts/backfill-isPlayable.js

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load fonts. The card components use **Fira Code SemiBold (600)** for enhanced readability and modern aesthetic.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 📈 Analytics (GA4)

- FUNCTIONAL: GA4 is integrated via Next.js `pages/_app.js` using `next/script` and SPA route tracking
- STRATEGIC: Production-only analytics with GDPR-friendly defaults and centralized helpers

Key details:
- Loads only in production (NODE_ENV=production) when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set
- Consent Mode v2 defaults to denied; toggle via `window.NARIMATO_setAnalyticsConsent(true|false)`
- IP anonymization is enabled on all hits
- SPA pageviews tracked on route change; initial pageview is sent after hydration
- Custom events implemented:
  - `play_start`, `swipe_action`, `vote_cast`, `segment_end`, `play_complete`, `results_view`

Environment variable:
- `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-8RCT54Y6E7`

CSP note (if enabled later): allow scripts from `https://www.googletagmanager.com` and `https://www.google-analytics.com`, and connections/images to `https://www.google-analytics.com`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
