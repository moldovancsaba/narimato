# NARIMATO

![Version](https://img.shields.io/badge/version-6.0.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.4.4-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)

NARIMATO is an anonymous, session-based card ranking application built with Next.js, MongoDB, and sophisticated binary search ranking algorithms. Global rankings are powered by ELO rating system for accurate skill-based card comparisons.

**Current Version:** 6.0.0 *(Unified Play API & Dispatcher + GA4 Analytics + Vote-More)*

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
  - **Classic**: Combined swipe-then-vote flow for comprehensive ranking
- **Hashtag Hierarchy System**: Multi-level card organization through parent-child hashtag relationships
- **Dynamic Text Scaling**: Automatic font sizing for optimal readability
- **Modern Typography**: Professional Fira Code SemiBold font for enhanced aesthetics
- **Clean Card Design**: Simplified interface focused on content without title clutter
- **Session Recovery**: Robust error handling and state persistence
- **Dark Mode Support**: Full dark mode for enhanced visual comfort
- **Comprehensive Error Handling**: Graceful degradation and automatic recovery

## 🔥 Latest Features (v5.2.0)

### Enhanced Play Modes Architecture
- **Multiple Play Modes**: Optimized ranking approaches for different user preferences
- **Swipe-Only Mode**: Pure preference-based ranking using like/dislike mechanics
  - Simple first-liked-first-ranked algorithm
  - Clean swipe interface without voting complexity
  - Optimized for quick preference-based sorting
- **Swipe-More Mode**: Enhanced swiping with intelligent decision tree
  - Hierarchical card organization with smart level transitions
  - Combines swiping efficiency with voting precision
  - Optimized multi-level ranking system
- **Classic Mode**: Enhanced version of the original swipe-then-vote flow
  - Maintains existing complex hierarchical ranking system
  - Backward compatible with all existing sessions

### Technical Implementation
- **Pluggable Engines**: `VoteOnlyService`, `SwipeOnlyEngine`, `SwipeMoreEngine` registered under a central dispatcher
- **Unified API**: Single, versioned surface for all plays:
  - `POST /api/v1/play/start` — { organizationId, deckTag, mode: 'swipe_only' | 'vote_only' | 'swipe_more' | 'vote_more' }
  - `POST /api/v1/play/{playId}/input` — { action: 'swipe' | 'vote', payload }
  - `GET /api/v1/play/{playId}/next`
  - `GET /api/v1/play/{playId}/results`
- **Mode Selection UI**: Deck selection with clear mode choices
- **Unified Interface**: Existing responsive game UI adapts to each mode

### Play Modes (Overview)
- Swipe-Only: Pure like/dislike; ranking = order of likes (first liked = rank 1)
- Vote-Only: UNRANKED/RANKED/PERSONAL algorithm with random opponent selection and strict pruning
- Swipe-More: Controller that runs multiple Swipe-Only segments (root family, then children of liked) and aggregates results
- Vote-More: Controller that runs multiple Vote-Only segments per family (root, then children of winners) and aggregates results

### Unified API Quickstart
- Start
  - POST /api/v1/play/start — { organizationId, deckTag, mode: 'swipe_only' | 'vote_only' | 'swipe_more' | 'vote_more' }
- Input
  - Swipe: POST /api/v1/play/{playId}/input — { action: 'swipe', payload: { cardId, direction } }
  - Vote: POST /api/v1/play/{playId}/input — { action: 'vote', payload: { winner, loser } } (vote-only)
  - Swipe-More tie-break: { action: 'vote', payload: { cardA, cardB, winner } }
- Next
  - GET /api/v1/play/{playId}/next
- Results
  - GET /api/v1/play/{playId}/results

For full request/response examples, see docs/API_REFERENCE.md.

## 🔥 Recent Improvements (v4.0.0)

### Major Database Schema Migration & Multi-Tenant Architecture
- **Schema Field Migration**: Successfully migrated from `cardId` to `cardUUID` field naming across the entire codebase
- **Robust Schema Migration**: Implemented automatic MongoDB index migration with old index cleanup and new index creation
- **Multi-Tenant Context Support**: Fixed organization UUID context propagation across all API endpoints
- **Global Rankings Restoration**: Resolved E11000 duplicate key errors that were blocking global ranking calculations
- **Complete Session Flow**: Fixed end-to-end game session flow from swiping to voting to final rankings

### Database and Index Management
- **Automatic Index Migration**: Drops old `cardId_1` indexes and creates new `cardUUID` indexes automatically
- **Collection Rebuilding**: Clears and rebuilds GlobalRanking collection when schema conflicts are detected
- **Error Prevention**: Eliminates duplicate key constraint errors during bulk write operations
- **Data Integrity**: Ensures consistent field naming and indexing across all database operations

### Multi-Tenant Architecture Fixes
- **Organization Context**: Fixed missing organization UUID headers in global ranking API calls
- **Tenant Isolation**: Proper data isolation between different organizations
- **Context Propagation**: Organization context properly flows through React components to API calls
- **Backend Validation**: Server-side validation of organization context for all requests

## 🔥 Previous Improvements (v3.6.3)

### Play-Based Architecture Implementation
- **Session Management Overhaul**: Migrated from deck-based Sessions to Play-based architecture for better state management
- **Hashtag Hierarchy System**: Implemented sophisticated multi-level card organization using parent-child hashtag relationships
- **Dynamic Card Selection**: Cards are now selected dynamically based on user-chosen deck tags instead of static deck structures
- **API Modernization**: Updated all endpoints to use Play model (`/api/v1/play/start`, `/api/v1/play/results`) replacing session-based endpoints
- **Unified Documentation**: Complete alignment of technical specification with current system architecture

### Build and Performance Fixes
- **Global Rankings API Fix**: Resolved issue where completed Play sessions weren't showing in global rankings due to incorrect hashtag filtering
- **Session Completion Bug**: Resolved critical bugs where play sessions remained in 'active' status preventing results retrieval
- **Card Rendering Standardization**: Unified all card displays to use `body.imageUrl` for consistent media rendering
- **Build Stability**: Fixed critical build-breaking syntax errors and verified successful compilation
- **Quality Assurance**: Verified successful build execution and complete system functionality

## 🔥 Previous Improvements (v3.6.1)

### Card Editor Enhancements
- **Enhanced Card Editor**: Complete redesign supporting both new card creation and existing card editing
- **UUID Display**: Prominent display of card UUIDs when editing existing cards
- **Smart Hashtag Editor**: Advanced hashtag management with:
  - Predictive text suggestions based on common hashtags
  - Enter to add, click X to remove functionality
  - Keyboard navigation with arrow keys
  - Duplicate prevention and visual feedback
- **URL-Friendly Slugs**: Editable slug input with automatic formatting for SEO-friendly URLs
- **Dual Card Types**: Support for both text and media cards with type-specific validation
- **Seamless Navigation**: Direct editing from card list page with proper state management

### Technical Improvements
- **Suspense Boundary Fix**: Resolved Next.js useSearchParams SSR issues
- **Schema Optimization**: Fixed Mongoose duplicate index warnings for cleaner builds
- **Form Validation**: Comprehensive validation for card types and required fields
- **Live Preview Integration**: Real-time preview updates with new card fields

### Previous Features (v3.4.0)
- **Sophisticated Swipe Animations**: Real-time drag feedback with smooth spring animations
- **Consolidated Gesture Handling**: Unified swipe detection for desktop and mobile
- **Cross-Platform Support**: Full touch and mouse support with smooth transitions
- **Responsive Design**: Improved experience across all device orientations

## 📚 Documentation

- [API Reference](./docs/API_REFERENCE.md) — Unified Play API (start/input/next/results) with per-mode examples

- **[📋 Roadmap](./ROADMAP.md)** - Development roadmap (forward-looking only)
- **[✅ Task List](./TASKLIST.md)** - Prioritized implementation tasks and status
- **[📦 Release Notes](./RELEASE_NOTES.md)** - Version history and change log
- **[🏗️ Architecture](./ARCHITECTURE.md)** - System architecture and technical overview
- **[🧠 Learnings](./LEARNINGS.md)** - Development insights and lessons learned

## 🚀 Quick Start

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
