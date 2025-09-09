# NARIMATO — Unified Technical Documentation

Current Version: 6.9.0 (Universal perceptual feedback)
Last Updated: 2025-09-08T09:31:56.000Z
Scope: This is the canonical engineering specification for NARIMATO. Other docs (README, ARCHITECTURE, API_REFERENCE, ROADMAP, TASKLIST, RELEASE_NOTES, LEARNINGS) are companion governance and navigation documents and must remain consistent with this file.

Table of Contents
1. Project Overview
2. Technology Stack & Compliance
3. Architecture & Directory Structure
4. Field Name Standardization (CRITICAL)
5. Multi‑Tenant Database Architecture
6. Play Modes & Unified API (Canonical)
7. Cards & Organizations APIs
8. Security, Rate Limiting, Vote Integrity & Caching
9. Organization‑Level Theming
10. Environment Management
11. Versioning & Documentation Protocols
12. Troubleshooting (Known Issues & Fixes)
13. Future Considerations (Salvageable from Legacy)
14. References

---

1. Project Overview
NARIMATO is an anonymous, Play‑based card ranking application. Users interact via swiping and/or voting, producing personal rankings (binary search O(log n) placement) and global rankings (ELO‑based) per organization. The system is multi‑tenant and versioned.

2. Technology Stack & Compliance
- Runtime: Node.js 20+
- Framework: Next.js 15.4.4 (Pages Router)
- Language: JavaScript
- Styling: Custom CSS (public/styles)
- Perceptual Feedback: Native vibration (where supported) + optional Web Audio tick fallback (feature-flagged) + CSS micro-animations (reduced-motion aware)
- Animations: @react-spring/web, @use-gesture/react
- Validation: zod
- Database: MongoDB (Atlas only). Localhost MongoDB is prohibited.
- Tests: PROHIBITED (MVP Factory rule)
- Navigation: Breadcrumbs are prohibited
- Timestamps: ISO 8601 with milliseconds in UTC (YYYY‑MM‑DDTHH:MM:SS.sssZ)

3. Architecture & Directory Structure
- pages/ — Pages Router UI and API routes
  - api/v1/play/start.js, api/v1/play/[playId]/{input,next,results}.js (unified API)
  - api/v1/play/vote-only/* (specialized vote-only; back‑compat only; DEPRECATED)
  - api/cards.js, api/cards/[uuid].js, api/cards/rankings.js
- lib/ — Core application logic
  - constants/fieldNames.js (CRITICAL: field names)
  - services/play/PlayDispatcher.js (central dispatcher)
  - services/SwipeOnlyEngine.js, VoteOnlyService.js, RankMoreEngine.js
  - models/* (Play, RankMorePlay, Card, etc.)
- public/styles — CSS
- scripts — database/init/maintenance scripts
- docs — governance and API reference

4. Field Name Standardization (CRITICAL)
Use centralized constants from lib/constants/fieldNames.js. Do not hardcode field names.
- OrganizationUUID → organizationId
- SessionUUID → uuid
- PlayUUID → uuid
- CardUUID → uuid
- DeckUUID → deckTag
Rationale: Prevents drift (sessionId/cardId/uuid), ensures consistent DB operations and indexes.

5. Multi‑Tenant Database Architecture
- Master DB: Organization metadata
- Per‑Organization DBs: Isolated data per org
- Connections: Managed via buildOrgMongoUri() with strict validation
- Security: MongoDB Atlas only; injection‑safe URIs; no localhost

6. Play Modes & Unified API (Canonical)
Supported modes: swipe_only, vote_only, swipe_more, vote_more, rank_only, rank_more
Canonical endpoints (Pages Router):
- POST /api/v1/play/start
- POST /api/v1/play/{playId}/input
- GET  /api/v1/play/{playId}/next
- GET  /api/v1/play/{playId}/results
Backward compatibility: Specialized vote-only endpoints under /api/v1/play/vote-only/* remain available but are DEPRECATED internally. New development must use the unified endpoints.

Ranking mechanics (personal): Binary search placement with accumulated bounds, O(log n) comparisons. Global rankings: ELO‑based aggregation.

7. Cards & Organizations APIs
- /api/cards — list/create/update (Pages Router)
- /api/cards/[uuid] — individual card management
- /api/cards/rankings — rankings helpers
- /api/v1/admin/organizations — administration
Card content conventions:
- Card.name is a hashtag (e.g., #SPORT). Prefer “hashtags” over “tags”.
- Card.body: imageUrl (optional), textContent (optional), background { type, value, textColor }

8. Security, Rate Limiting, Vote Integrity & Caching
- Rate limiting: 100 requests/minute per IP (see middleware)
- Vote integrity: dual‑layer protection
  - Client: 100ms debounce + UI state lock to prevent rapid clicks
  - Server: deduplicate identical votes within a 2s window
- Organization caching
  - Global in‑memory cache with 5‑minute TTL, concurrent request deduplication, safe invalidation
- Headers & policies
  - HTTPS with HSTS; CSP in production; no sensitive data in client storage

9. Organization‑Level Theming
- Fields on Organization: theme.backgroundCSS, theme.googleFontURL, theme.emojiList, theme.iconList
- Injection: background CSS injected into a dedicated background layer; fonts loaded dynamically
- Security: sanitize and scope CSS to background layer; clean up on changes

10. Environment Management
Required env:
- MONGODB_URI (Atlas)
- ORGANIZATION_DB_URIS (optional JSON map)
Rules:
- Master uses MONGODB_URI; per‑org URIs via buildOrgMongoUri() or ORGANIZATION_DB_URIS
- Validate URIs; enforce Atlas‑only policy

11. Versioning & Documentation Protocols
- Before npm run dev: increment PATCH
- Before commit: increment MINOR (reset PATCH to 0) and update all docs
- Major: on explicit instruction only
- Update these files on changes: README.md, ARCHITECTURE.md, TASKLIST.md, LEARNINGS.md, RELEASE_NOTES.md, ROADMAP.md
- Version must match across UI, package.json, docs

12. Troubleshooting (Known Issues & Fixes)
Double voting (fixed in v4.4.0)
- Cause: rapid clicks + lack of server dedupe
- Fix: 100ms client debounce + 2s server dedupe

“Session results not found” (fixed in v4.4.0)
- Cause: mismatch between backend results shape and frontend expectations
- Fix: transform results (sessionInfo.deckTag; personalRanking mapping)

Organization loading on first visit/incognito (fixed in v4.4.0)
- Cause: hydration conflicts, race conditions
- Fix: 100ms delayed initial fetch, global cache (5m TTL) with dedup

Playable decks threshold
- Rule: require minimum 2 cards to expose playable categories and prevent single‑card sessions

13. Future Considerations (Salvageable from Legacy)
These are not current commitments; they are curated for future work and flagged as DEPRECATED where applicable if they reflect older approaches.
- Admin Panel & Analytics Dashboard
  - Real‑time session stats, ranking trends, funnels, performance metrics; bulk card ops with impact analysis
- Error Response Standards
  - Structured envelope with error codes (1xxx client, 2xxx auth, 3xxx business‑state, 4xxx resource, 5xxx system)
- Offline/PWA Strategy
  - Background sync queues for swipe/vote/session‑complete; cache‑first for assets, network‑first for rankings
- API Versioning Negotiation
  - Version header routing; deprecation timelines and migration guidance
- Monitoring & Alerting
  - Health checks, Prometheus‑style metrics, log aggregation with correlation IDs
- Platform Compatibility Matrix
  - Condensed matrix when guarantees become necessary
- Gesture/Haptics UX
  - Mobile haptics, thresholds, visual animation state mapping
- DB Migration Framework
  - Formal migrations with audit and rollback
- Security & RBAC
  - Admin auth hardening, rate‑limit policies, abuse mitigation playbook

14. References
- README.md — overview and links
- ARCHITECTURE.md — visual flows, expanded patterns and components
- docs/API_REFERENCE.md — canonical API request/response shapes
- ROADMAP.md — forward‑looking only
- TASKLIST.md — live tasks; completed items moved to RELEASE_NOTES.md
- RELEASE_NOTES.md — versioned change log
- LEARNINGS.md — real issues faced and resolved (no placeholders)

Notes on Backward Compatibility
- Specialized vote‑only endpoints under /api/v1/play/vote-only/* are DEPRECATED internally and kept for backward compatibility. Migrate to unified /api/v1/play/* endpoints at the next convenient opportunity.

Policies Reinforced
- No tests (MVP Factory)
- No breadcrumbs
- Atlas‑only MongoDB connections
- Field name constants must be used everywhere (lib/constants/fieldNames.js)
- All timestamps ISO 8601 with milliseconds in UTC
