# NARIMATO Task List

**Current Version:** 6.13.0
**Date:** 2025-09-08T09:21:11.000Z
**Last Updated:** 2025-09-11T04:11:36.000Z

## High Priority Tasks

### Security: Next.js Vulnerabilities Remediation (#30, #28, #26)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-10T16:30:00.000Z
- Status: Completed ✅
- Completion Date: 2025-09-11T04:11:36.000Z
- Details: Upgraded Next.js to 15.5.2, hardened next.config.js (images allowlist, SVG disabled, AVIF/WebP, minimumCacheTTL, global security headers), verified build, and deployed to production (v6.13.0). Scanner validation shows 0 vulnerabilities at moderate level.
- Subtasks:
  - Create branch security/next-vulns-2025-09-10
  - Bump PATCH before dev/build (6.12.0 → 6.12.1)
  - Upgrade next and eslint-config-next to latest 15.x
  - Harden next.config.js (images.remotePatterns, disable SVG, formats, TTL, CSP and security headers)
  - Build and manual verification (no tests)
  - Re-run scanner; confirm issues cleared
  - Pre-commit MINOR bump (6.12.1 → 6.13.0) and documentation sync
### Onboarding Play Mode (Right-Only)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-09T16:30:00.000Z
- Status: Completed ✅
- Completion Date: 2025-09-10T08:57:47.000Z
- Details: Right-only swipe onboarding mode integrated and orchestrated before any selected deck when Card.isOnboarding is enabled on parent cards. Reused SwipeOnlyEngine onboarding with client-side queue sequencing and shallow routing. See RELEASE_NOTES.md v6.11.0.
- Subtasks:
  - Register onboarding engine in dispatcher and route SwipeOnlyPlay when isOnboarding
  - Extend start schema to include 'onboarding'
  - Add SwipeOnlyEngine.startOnboardingSession + right-only enforcement
  - Update Play page UI (button + right-only UX)
  - Manual verification across devices

### Play: Cross-Device Swipe Gestures (Unified)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-09T14:30:00.000Z
- Status: In Progress
- Details: Enable touch, pointer/mouse, and two-finger trackpad swipes on Play page using a shared hook reused from Swipe-Only. Respect reduced motion and keep touch-action: pan-y. No new dependencies.
- Subtasks:
  - Extract reusable hook (lib/utils/useSwipeGestures.js)
  - Integrate into pages/play.js (swipe mode only)
  - Refactor pages/swipe-only.js to consume the hook
  - Manual verification on iOS/Android/desktop

### Perceptual Feedback Rollout (Audio Tick Fallback)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-10T12:00:00.000Z
- Status: Not Started
- Details: Roll out the web-safe perceptual feedback system via feature flag with manual verification and rollback plan.
- Subtasks:
  - Staging Enablement — NEXT_PUBLIC_ENABLE_AUDIO_TICK=true (staging); verify devices — Due: 2025-09-08T17:00:00.000Z
  - Production Enablement — set flag in production — Due: 2025-09-09T12:00:00.000Z
  - Post-Deploy Verification — manual checks on iOS/Android/desktop — Due: 2025-09-10T12:00:00.000Z

### API Versioning Negotiation (Header-Based)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-14T18:00:00.000Z
- Status: In Progress
- Details: Framework enabled (v6.6.0); v2 pilot shipped on play/start with header negotiation; read-only endpoints emit deprecation header on v1.
- Next Steps:
  - Extend v2 coverage to: input, next, results
  - Publish deprecation schedule for v1 (6-month window, staged warnings)
  - Add per-version schema docs and request/response examples in API_REFERENCE.md
  - Add version telemetry dashboard to monitor client adoption

### Error Response Standards (Structured Envelope + Taxonomy)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-21T18:00:00.000Z
- Status: Completed ✅
- Completion Date: 2025-09-07T13:21:53.000Z
- Details: Delivered centralized error envelope and taxonomy (1xxx–5xxx), integrated on unified play endpoints, updated docs/API_REFERENCE.md, and added validation details from zod to envelopes.

### Security & RBAC (MVP)
- Owner: AI Agent
- Expected Delivery Date: 2025-10-05T18:00:00.000Z
- Status: Not Started
- Details: Add roles (admin, editor, viewer), token-based admin access, and abuse mitigation; audit CORS and security headers.

### DB Migration Framework
- Owner: AI Agent
- Expected Delivery Date: 2025-10-12T18:00:00.000Z
- Status: Not Started
- Details: Establish formal migrations with version registry, up/down, dry-run, audit logs, and rollback; create operational guide.

### Gesture/Haptics UX Improvements
- Owner: AI Agent
- Expected Delivery Date: 2025-09-28T18:00:00.000Z
- Status: Completed ✅
- Completion Date: 2025-09-08T09:31:56.000Z
- Details: Delivered universal perceptual feedback system:
  - Web Vibration where supported
  - Web Audio tick fallback (feature-flagged; user override via localStorage)
  - Subtle micro-animations (.micro-bump) respecting reduced-motion
  - Integrated in Swipe-Only UI (recognition + success)

### Admin Panel & Analytics Dashboard (MVP)
- Owner: AI Agent
- Expected Delivery Date: 2025-10-19T18:00:00.000Z
- Status: Not Started
- Details: Build overview metrics, funnels/trends, and system health cards; secure behind RBAC; wire to existing analytics/metrics.

### Documentation Unification — Canonical Spec (v6.5.0)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-07T12:10:54.000Z
- Status: Completed ✅
- Completion Date: 2025-09-07T12:10:54.000Z
- Details: Rewrote narimato_unified_documentation_UPDATED.md as the canonical engineering spec; synchronized versions to 6.5.0 across package.json and documentation; resolved API reference contradictions; flagged specialized vote-only endpoints under /api/v1/play/vote-only/* as DEPRECATED (backward compatibility only) with recommendation to migrate to unified endpoints.

### Documentation Sync Automation & Deprecation Cleanup
- Owner: AI Agent
- Expected Delivery Date: 2025-09-15T18:00:00.000Z
- Status: Not Started
- Details: Automate version and timestamp propagation across docs; add lints for legacy/deprecated references (session-based endpoints, non-Atlas URIs, test mentions, breadcrumbs).

### New Play Mode: Rank-More (v6.4.0)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-08T18:00:00.000Z
- Status: Completed ✅
- Completion Date: 2025-09-07T11:34:45.000Z
- Details: Implemented hierarchical multi-level ranking (family-by-family Rank-Only). Random family order per level; branch exclusion for disliked children; flattened output only. Delivered RankMorePlay model, RankMoreEngine orchestrator, dispatcher integration, start mode support, unified input/next/results, deck UI button, and documentation sync.

### New Play Mode: Rank-Only (v6.3.0)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-06T20:57:14.000Z
- Status: Completed ✅
- Completion Date: 2025-09-06T20:57:14.000Z
- Details: Added RankOnlyEngine (swipe-only → vote-only), RankOnlyPlay model, dispatcher integration, start API enum updated, UI deck select button, result label, and swipe→vote transition via requiresVoting.

### Deck Exposure Control — Playable (public) Flag (v6.2.0)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-06T19:17:15.000Z
- Status: Completed ✅
- Completion Date: 2025-09-06T19:17:15.000Z
- Details: Added Card.isPlayable boolean; API accepts/updates isPlayable; Cards editor includes a "Playable (public)" checkbox. Play/Rankings deck lists filter out hidden decks by default; hidden decks remain playable via direct link or includeHidden=true.

### UI Button Size Standardization & Emoji Consistency (v6.1.0)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-06T19:06:57.000Z
- Status: Completed ✅
- Completion Date: 2025-09-06T19:06:57.000Z
- Details: Centralized button sizing using design system classes (.btn, .btn-lg, .btn-sm); standardized small Back to Home buttons; elevated primary CTAs to large; set mid-size defaults for secondary actions; added missing emojis (🎴 on Cards buttons, 🎮 on Play buttons); added .btn-success variant.

### Documentation Synchronization and Version Bump to v6.0.0
- Owner: AI Agent
- Expected Delivery Date: 2025-09-06T18:39:04.000Z
- Status: In Progress
- Details: Synchronize all documentation to reflect Pages Router structure, correct API endpoints, update version numbers and ISO timestamps, and align WARP.md with actual codebase. Prepare for release commit and push.

### Implement Vote-Only Play Mode (Backend, API, UI)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-05
- Status: Completed ✅
- Completion Date: 2025-09-05T17:30:12.000Z
- Details: Implemented UNRANKED/RANKED/PERSONAL algorithm, new versioned API under /api/v1/play/vote-only/*, integrated UI in play page with 🗳️ mode, results page updated for mode=vote-only. Validation via Zod, multi-tenant scoping enforced, anti-dup votes applied.

### Update WARP.md Documentation to v4.4.0
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-08-17
- **Status:** Completed ✅
- **Completion Date:** 2025-08-17T11:00:26.000Z
- **Details:** Successfully updated WARP.md file from v4.1.0 to v4.4.0 state, incorporating all critical architectural improvements and bug fixes. Key updates include: version number synchronization across all references, added new database scripts (init-default-org.js, add-cardsize-to-cards.js, recreate-organization.js, delete-default-org.js), documented v4.4.0 Vote Integrity & Caching System with double voting prevention and organization caching features, expanded API endpoints documentation with new endpoints (/api/v1/cards/[uuid], /api/v1/cards/add, /api/v1/presets/*, /api/v1/upload/imgbb), and added comprehensive troubleshooting sections for issues fixed in v4.4.0 (double voting, session results not found, organization loading issues). Documentation now accurately reflects current codebase state and provides complete guidance for future AI agents working in this repository.

### Enhance Hashtag Hierarchy System
- **Owner:** AI Agent  
- **Expected Delivery Date:** 2025-09-01
- **Status:** Not Started
- **Details:** Implement advanced features for the hashtag hierarchy system including: parent-child relationship validation, circular dependency detection, automatic hierarchy suggestions based on existing cards, enhanced filtering and search capabilities, and improved UI for managing complex hierarchies.

### Optimize Play Session Performance
- **Owner:** John Doe
- **Expected Delivery Date:** 2024-12-31
- **Status:** Not Started
- **Details:** Optimize Play session performance including: faster card selection queries, improved caching for hashtag hierarchies, enhanced session state persistence, and reduced database queries for dynamic card fetching.

### Performance Optimization
- **Owner:** Jane Smith
- **Expected Delivery Date:** 2024-02-15
- **Status:** Not Started
- **Details:** Optimize database queries for large card datasets, implement caching layer with Redis, and client-side state optimization. Requires infrastructure scaling.

### Real-time Analytics Dashboard
- **Owner:** Alex Johnson
- **Expected Delivery Date:** 2024-03-10
- **Status:** Not Started
- **Details:** Develop live session monitoring, global ELO ranking trend analysis and statistics, and user engagement metrics systems. Depends on analytics data collection system.

### Full Security Audit
- **Owner:** Security Team
- **Expected Delivery Date:** 2025-03-15
- **Status:** Not Started
- **Details:** Conduct a comprehensive review of all security protocols including penetration testing. Collaborate with external security consultants for a thorough assessment.

### Accessibility Update Review
- **Owner:** UX Team
- **Expected Delivery Date:** 2025-03-01
- **Status:** Not Started
- **Details:** Review WCAG 2.1 AA compliance for new components and ensure all elements are up to standards. Coordinate with UX team for input.

## Medium Priority Tasks

### Mobile Experience Enhancement
- **Owner:** Emily Davis
- **Expected Delivery Date:** 2024-04-01
- **Status:** Not Started
- **Details:** Implement Progressive Web App (PWA) features, offline capability for interrupted sessions, and improve touch gestures. Dependencies include service worker implementation.

### Card Management System
- **Owner:** Michael Brown
- **Expected Delivery Date:** 2024-05-20
- **Status:** Not Started
- **Details:** Create an admin panel for card CRUD operations, bulk card import/export, and card categorization/tagging system. Requires authentication system.

## Completed Tasks

### Version Negotiation Framework (v6.6.0)
- Owner: AI Agent
- Expected Delivery Date: 2025-09-07T12:57:30.000Z
- Status: Completed ✅
- Completion Date: 2025-09-07T12:57:30.000Z
- Details: Implemented non-breaking API version negotiation middleware (Accept and X-API-Version headers), added X-API-Selected-Version response header, and wrapped unified play endpoints without behavior changes. Updated documentation (API_REFERENCE, unified spec) and synchronized versions.

### Implement Vote-More Mode
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-09-06
- **Status:** Completed ✅
- **Completion Date:** 2025-09-06T14:20:04.000Z
- **Details:** Added vote_more mode orchestrating multiple vote-only family segments. New engine `VoteMoreEngine` with model `VoteMorePlay`, dispatcher integration, unified API support, and UI updates (mode selection + label). Aggregates results across families; compatible with existing results view.

### Implement GA4 Analytics Integration
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-09-06
- **Status:** Completed ✅
- **Completion Date:** 2025-09-06T14:09:05.000Z
- **Details:** Added GA4 with Consent Mode v2, SPA route tracking, and gameplay analytics events (play_start, swipe_action, vote_cast, segment_end, play_complete, results_view). Production-only loading; IP anonymization enabled.

### Fix Organization Routing and Session Management Issues
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-08-14
- **Status:** Completed ✅
- **Completion Date:** 2025-08-14T15:20:00.000Z
- **Details:** Successfully resolved critical routing and session management bugs affecting user experience. Fixed organization slug mapping from API response to prevent navigation to `/organization/undefined`, standardized field naming consistency across play session creation APIs, removed problematic auto-completion logic that was immediately marking sessions as complete, harmonized results saving and retrieval to use consistent field names (sessionUUID), and updated field name constants to match actual model implementations. Manual testing confirmed: organization selection now navigates correctly, play sessions start in active/swiping state rather than completed state, and results retrieval works properly after session completion.

### Organization-Level Centralized Theme Management System
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-10-12
- **Status:** Completed ✅
- **Completion Date:** 2025-10-12T16:45:21.000Z
- **Details:** Successfully implemented a comprehensive organization-level centralized theme management system. Key features include: Extended Organization schema with new theme fields (backgroundCSS, googleFontURL, emojiList, iconList), enhanced useOrganizationTheme hook for dynamic CSS injection and Google Fonts loading, full organization editor UI with live preview and syntax highlighting, animated background support with CSS editor, emoji and icon management with visual previews, and complete live theme preview system integrated in the organization editor. The system provides administrators with powerful tools to maintain consistent visual identity across all organization components while ensuring security and performance optimization.

### Fix Global Rankings API Hashtag Filtering
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-08-03
- **Status:** Completed ✅
- **Completion Date:** 2025-08-03T12:08:33.000Z
- **Details:** Successfully resolved critical issue where global rankings were not displaying for completed Play sessions. Fixed incorrect field mappings in global rankings API: corrected card filtering to use `hashtags` array instead of non-existent `tags` field, implemented proper parent-child hashtag relationship support with `$or` query logic, fixed card data mapping to derive type from `body.imageUrl` and use proper content structure. This resolves the "No rankings available for deck '#skills'" issue.

### Fix Play Session Completion State Bug
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-08-03
- **Status:** Completed ✅
- **Completion Date:** 2025-08-03T11:38:40.000Z
- **Details:** Successfully resolved critical bug where play sessions remained in 'active' status preventing completion. Updated Play model implementation, fixed completion detection logic, resolved all 404 errors on /api/v1/play/results endpoint, and improved session state management. Migrated from Session-based to Play-based architecture for better state consistency.

### Implement Minimum Card Threshold for Playable Cards
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-08-02
- **Status:** Completed ✅
- **Completion Date:** 2025-08-02T23:10:48.000Z
- **Details:** Successfully implemented a minimum card threshold rule to ensure only decks with sufficient cards for meaningful ranking experiences are displayed as playable options. Added DECK_RULES.MIN_CARDS_FOR_PLAYABLE = 2 constant, updated backend filtering logic in cardHierarchy.ts and cards API, added defensive checks in play start API, and enhanced user experience by preventing single-card deck sessions that provide no comparison opportunities. This resolves issues where users could start play sessions with only 1 card, which resulted in poor UX since no meaningful ranking/comparison was possible.

### Fix Deck System Migration to Multi-Card Level System
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-08-02
- **Status:** Completed ✅
- **Completion Date:** 2025-08-02T20:51:30.000Z
- **Details:** Successfully migrated the application from the deprecated deck-based system to the new multi-card level hierarchy system. Resolved 404 errors by updating `/api/v1/decks` calls to `/api/v1/cards?type=playable`, implemented proper data mapping from cards to deck-like UI structures, updated play session logic to use `cardName` instead of `deckTag`, and adapted both home page and rankings page to work with the new card hierarchy. All frontend components now properly display playable cards as categories without requiring the deprecated Deck model.

### Assess Models and Type Definitions
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-07-31
- **Status:** Completed ✅
- **Completion Date:** 2025-07-31T18:53:49.000Z
- **Details:** Successfully completed Step 9 - Comprehensive assessment of models and type definitions for completeness, correctness, and TypeScript coverage. Verified proper TypeScript usage across all models (Card, Session, DeckEntity, GlobalRanking, etc.), cross-cutting consistency between interfaces and schemas, and maximized type coverage. All models follow strict typing with proper interfaces, validation schemas, and field name constants for consistency.

### Fix UI Layout Issues
- **Owner:** Frame It Now Developer
- **Expected Delivery Date:** 2025-07-31
- **Status:** Completed ✅
- **Completion Date:** 2025-07-31T10:16:53.000Z
- **Details:** Hide VS devil button in portrait mode completely, fixed swipe page button overlap, increased button row height, improved grid layout constraints for better mobile UX.

### Fix Webpack Cache Corruption
- **Owner:** Frame It Now Developer
- **Expected Delivery Date:** 2025-07-31
- **Status:** Completed ✅
- **Completion Date:** 2025-07-31T10:16:53.000Z
- **Details:** Resolved webpack cache PackFileCacheStrategy errors, cleared corrupted .next cache, updated documentation and task tracking, enhanced UI components.

### ELO Rating System Manual Verification and Documentation
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-07-31
- **Status:** Completed ✅
- **Completion Date:** 2025-07-31T07:16:11.000Z
- **Details:** Successfully completed Step 5 - Manual verification of ELO ratings display in development environment, version increment per protocol (3.0.0 → 3.1.0), and comprehensive documentation updates across ROADMAP.md, TASKLIST.md, and RELEASE_NOTES.md. ELO ratings confirmed displaying correctly as primary global ranking metric.

### Dark Mode Implementation
- **Owner:** AI Agent
- **Expected Delivery Date:** 2025-07-30
- **Status:** Completed ✅
- **Completion Date:** 2025-07-30T07:15:00.000Z
- **Details:** Successfully implemented comprehensive dark mode support across the application. Features include class-based theme toggling, CSS custom properties for light/dark themes, global dark mode activation, and enhanced readability with WCAG-compliant colors.

---

**Note:** The task list is subject to change based on project needs, priorities, and resource availability. All tasks are to be reviewed and updated regularly in accordance with project progress and stakeholder input.

