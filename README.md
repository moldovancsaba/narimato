# NARIMATO

![Version](https://img.shields.io/badge/version-7.2.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)

NARIMATO is an anonymous, session-based card ranking application. Users swipe and/or vote on cards within organization-scoped decks. Personal rankings come from mode-specific play engines; global rankings use ELO on each card.

**Current Version:** 7.2.0 — Multi-tenant database routing, documentation alignment, vote-only restored, unified API as primary surface.

**Canonical engineering spec:** [narimato_unified_documentation.md](./narimato_unified_documentation.md)

## Key Features

- **Anonymous sessions** — no end-user registration
- **Multi-tenant service** — master DB for organizations; isolated MongoDB database per organization ([ADR 002](./docs/adr/002-multi-tenant-database.md))
- **Seven play modes** — vote-only, swipe-only, swipe-more, vote-more, rank-only, rank-more, plus onboarding
- **Unified Play API** — primary surface at `/api/v1/play/*` (see [docs/API_REFERENCE.md](./docs/API_REFERENCE.md))
- **Cards API** — `/api/cards*` with hashtag hierarchy (`parentTag`, decks)
- **ELO global rankings** — `Card.globalScore` updated from vote outcomes
- **Mobile-first play UI** — swipe threshold, safe-tap voting, touch/pointer gestures

Not in v7.2 (see [docs/FUTURE.md](./docs/FUTURE.md)): full-app dark mode, organization theming UI, optimistic locking.

## Unified Play API

Primary endpoints (all require `organizationId` at start):

```
POST /api/v1/play/start
POST /api/v1/play/{playId}/input
GET  /api/v1/play/{playId}/next
GET  /api/v1/play/{playId}/results
```

Legacy `/api/play/*` routes remain for classic/hierarchical client paths — [docs/DEPRECATED_API.md](./docs/DEPRECATED_API.md).

## Documentation

- **Local intelligence** — [ADR 003](./docs/adr/003-local-ai-dual-runtime.md), [ADR 004](./docs/adr/004-intelligence-product-policy.md), [WEBAPP_READ_MODEL_LLD.md](./docs/WEBAPP_READ_MODEL_LLD.md), [LOCAL_AI_PIPELINE.md](./docs/LOCAL_AI_PIPELINE.md); pages `/local-ai`, `/cards`; `.env.example`
- **[docs/GDS_ADOPTION.md](./docs/GDS_ADOPTION.md)** — GDS adoption (`@doneisbetter/gds-*`, manifest in `gds-adoption.json`)
- **[docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md](./docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md)** — planned GDS polish (semantic buttons, metrics, dark mode)
- **[docs/WHAT_IS_NARIMATO.md](./docs/WHAT_IS_NARIMATO.md)** — what belongs to this project vs other folders (GDS, Amanoba, etc.)
- **[narimato_unified_documentation.md](./narimato_unified_documentation.md)** — canonical spec
- **[WARP.md](./WARP.md)** — AI agent onboarding
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — diagrams (some sections historical; see banner)
- **[docs/API_REFERENCE.md](./docs/API_REFERENCE.md)** — HTTP API
- **[docs/DOC_ALIGNMENT_IMPLEMENTATION_PLAN.md](./docs/DOC_ALIGNMENT_IMPLEMENTATION_PLAN.md)** — alignment program log

## Quick Start

```bash
npm install
# .env.local: MONGODB_URI=mongodb+srv://...
node scripts/init-master-db.js
node scripts/backfill-org-database-name.js  # if upgrading existing master data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional: `ORGANIZATION_DB_URIS` JSON map for per-org connection overrides (see `lib/db.js`).

## Analytics (GA4)

Production-only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. See `pages/_app.js` and `lib/analytics/ga.js`.
