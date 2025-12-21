# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

NARIMATO is an anonymous, session-based card ranking application built with Next.js 15.5.3, MongoDB, and ELO-powered global rankings. The system uses a Pages Router API with a Play-centric session model and binary-search-based ranking.

**Current Version:** 7.1.0

## Essential Development Commands

### Core
```bash path=null start=null
# Dev (increment PATCH first per repo rules)
npm run dev

# Build & run
npm run build
npm run start

# Lint
npm run lint
```

### Data/maintenance scripts
```bash path=null start=null
# Master + org DB setup
node scripts/init-master-db.js
node scripts/setup-databases.js
node scripts/init-default-org.js

# Org admin utilities
node scripts/recreate-organization.js
node scripts/delete-default-org.js
node scripts/seed-superadmin.js

# Migrations / cleanup
node scripts/migrate-name-to-displayname.js
node scripts/add-cardsize-to-cards.js
node scripts/cleanup-database.js
node scripts/cleanup-obsolete-data.js
node scripts/cleanup-default-orgs.js
```

Notes
- Tests are not used in this project (MVP factory). There is no test runner. Use the debug/diagnostic scripts in repo root (e.g., `node test-hierarchical-api.js`) for targeted checks.

### Environment
```bash path=null start=null
# .env.local
MONGODB_URI=mongodb+srv://...
# optional map for per-org URIs
ORGANIZATION_DB_URIS={}
# optional GA
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## High-level architecture

- Pages Router UI: `pages/` with `_app.js`, `_document.js`, and feature pages (`play.js`, `results.js`, admin screens).
- API (Pages Router): `pages/api/v1/play/*` implements unified Play endpoints:
  - `start.js`, `[playId]/input.js`, `[playId]/next.js`, `[playId]/results.js`
  - Legacy vote-only routes remain under `pages/api/v1/play/vote-only/*`.
- Core domain logic: `lib/`
  - `constants/fieldNames.js` centralizes UUID field names (OrganizationUUID, SessionUUID, PlayUUID, CardUUID, DeckUUID). Do not hardcode field names.
  - `services/` contains engines like `decisionTree/BinarySearchEngine.js` and `VoteOnlyService.js` used by Play endpoints.
  - `models/` defines Mongoose schemas (Session, Play, Card, GlobalRanking, etc.).
  - `middleware/rateLimit.js` provides per-IP rate limiting.
  - `analytics/ga.js` wires GA4 (production-only).
- Scripts: operational maintenance in `scripts/` (init, cleanup, migrations).
- Public assets/CSS: `public/styles` for gameplay and layout styling.

Key patterns
- UUID constants: import from `lib/constants/fieldNames.js` everywhere (no ad-hoc names).
- Multi-tenant DB: master org metadata + per-org DBs derived via `buildOrgMongoUri()` in `lib/db.js`.
- Play modes: swipe-only, vote-only, swipe-more, vote-more, rank-only, rank-more orchestrated via the Play API routes and service engines.
- Vote integrity: client debounce + server dedupe window; see `middleware` and Play input handlers.
- Theming: organization-level theme fields (backgroundCSS, googleFontURL, emoji/icon lists) applied at runtime.

## File index for orientation (selected)
- `lib/constants/fieldNames.js` — UUID field names (single source of truth)
- `lib/db.js` — connection helpers and org URI building
- `lib/services/decisionTree/BinarySearchEngine.js` — binary-search ranking core
- `lib/services/VoteOnlyService.js` — vote-only engine
- `lib/middleware/rateLimit.js` — API rate limiting
- `pages/api/v1/play/start.js` — Play session start
- `pages/api/v1/play/[playId]/input.js` — input events (swipe/vote)
- `pages/api/v1/play/[playId]/next.js` — next prompt
- `pages/api/v1/play/[playId]/results.js` — results payload

## Stack
- Node.js 20+
- Next.js 15.5.3 (Pages Router)
- MongoDB 7.0+ (Atlas)
- JavaScript, zod, styled-jsx; animations via @react-spring/web and @use-gesture/react

## Operational notes
- Versioning protocol is enforced across code and docs; bump PATCH before `npm run dev`, bump MINOR before commits (reset PATCH), and keep docs in sync.
- Rate limit defaults to 100 req/min/IP (see `lib/middleware/rateLimit.js`).
- GA4 loads only in production when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is present.

## Helpful docs in this repo
- README.md — product overview, current version, and feature highlights
- ARCHITECTURE.md — deeper technical architecture, diagrams, and algorithms
- docs/API_REFERENCE.md — Play API request/response examples
- TASKLIST.md, ROADMAP.md, RELEASE_NOTES.md, LEARNINGS.md — project governance
