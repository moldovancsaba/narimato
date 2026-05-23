# API Reference — NARIMATO HTTP API (v7.2.0)

Last Updated: 2026-05-23T00:00:00.000Z

## Overview
All play modes use a single, versioned API surface with a central dispatcher. Modes are differentiated by `mode` at start time and by `action` on input.

Version negotiation
- Preferred: Accept: application/vnd.narimato.vN+json
- Fallback: X-API-Version: N
- Default: v1
- Response header: X-API-Selected-Version: vN
- Deprecation signaling (phased): X-API-Deprecated: true (only when a requested version is deprecated)

Note: the negotiation framework is enabled without changing current behavior; clients may start sending explicit versions now.

Note: Specialized vote-only endpoints under `/api/v1/play/vote-only/*` remain available for backward compatibility alongside the unified endpoints.

New: rank_only — two-segment play (swipe-only then vote-only on liked cards). Start with action="swipe"; when swipe completes, server returns `{ requiresVoting: true, votingContext: { newCard, compareWith } }`, then continue with vote inputs.

New: rank_more — hierarchical multi‑level ranking. Starts like rank_only at roots; for any liked parent with children, the server starts new family segments in random order per level. Responses may include `{ returnToSwipe: true, nextCardId, cards }` to switch back to swiping a new family; results are flattened (parent then ranked descendants).

Base path: `/api/v1/play`

**Multi-tenant:** All play and card routes require a valid `organizationId`. Play sessions are indexed on the master DB (`PlaySessionIndex`) so `playId` routes resolve the correct org database.

**Rate limits (per IP):** `start` 60/min; `input`, `next`, `results` 120/min.

**Deprecated:** [docs/DEPRECATED_API.md](./DEPRECATED_API.md)

## Cards API

Tenant data lives in per-organization databases. All routes require `organizationId`.

### GET /api/cards

Query: `organizationId` (required), `parentTag` (optional deck hashtag)

Response: `{ "cards": [ Card, ... ] }`

### POST /api/cards

Body: `{ organizationId, title, description?, imageUrl?, name?, parentTag?, hashtags?, isPlayable?, isOnboarding? }`

### GET/PUT/DELETE /api/cards/[uuid]

Query: `organizationId` (required), `uuid` (path)

### GET /api/cards/rankings

Query: `organizationId`, `parentTag?` — ELO-sorted rankings for deck descendants.

### GET/POST/PUT/DELETE /api/organizations

Master DB only. POST creates org with `databaseName` = new org `uuid`.

## Start
POST /api/v1/play/start

Body
{
  "organizationId": "<uuid>",
  "deckTag": "<string>",
"mode": "swipe_only" | "vote_only" | "onboarding" | "swipe_more" | "vote_more" | "rank_only" | "rank_more"
}

Response (common fields; some are mode-specific)
{
  "playId": "<uuid>",
  "mode": "...",
  "cards": [ { "id": "<uuid>", "title": "...", "description": "...", "imageUrl": "..." }, ... ],
  "comparison": {                // vote_only only
    "card1": { ... },
    "card2": { ... }
  },
  "currentCardId": "<uuid>",    // swipe_only / swipe_more (family)
  "currentCard": { ... },        // swipe_more may also include currentCard
  "familyLevel": 0,              // swipe_more only
  "familyContext": "root"       // swipe_more only
}

## Input
POST /api/v1/play/{playId}/input

Body variants
- Swipe (swipe_only, swipe_more)
{
  "action": "swipe",
  "payload": { "cardId": "<uuid>", "direction": "left" | "right" }
}

- Vote (vote_only)
{
  "action": "vote",
  "payload": { "winner": "<uuid>", "loser": "<uuid>" }
}

- Vote (swipe_more tie-break)
{
  "action": "vote",
  "payload": { "cardA": "<uuid>", "cardB": "<uuid>", "winner": "<uuid>" }
}

Response (examples)
- Swipe-only (continue)
{
  "success": true,
  "completed": false,
  "nextCardId": "<uuid>",
  "progress": { "cardsRemaining": 3, "cardsCompleted": 2, "totalCards": 5 }
}

- Swipe-only (complete)
{
  "success": true,
  "completed": true
}

- Vote-only (generic acknowledgement)
{
  "success": true
}

- Rank-more (family transition)
{
  "completed": false,
  "returnToSwipe": true,
  "nextCardId": "<uuid>",
  "cards": [ ... ],
  "hierarchicalLevel": 1,
  "familyContext": { "familyTag": "#company", "level": 1, "context": "children-of-#company" }
}

- Swipe-more (family transition)
{
  "completed": false,
  "nextCardId": "<uuid>",
  "currentCard": { ... },
  "cards": [ ... ],
  "hierarchicalLevel": 1,
  "newLevelCards": [ ... ],
  "familyContext": { "familyTag": "#company", "level": 1, "context": "children-of-#company" },
  "progress": { ... }
}

- Swipe-more (requires more voting)
{
  "completed": false,
  "requiresMoreVoting": true,
  "votingContext": { "newCard": "<uuid>", "compareWith": "<uuid>" }
}

## Next
GET /api/v1/play/{playId}/next

Response variants
- Vote-only
{
  "challenger": "<uuid>",
  "opponent": "<uuid>",
  "completed": false
}

- Swipe-only
{
  "playId": "<uuid>",
  "currentCard": { ... },
  "progress": { "cardsRemaining": 3, "cardsCompleted": 2, "totalCards": 5 }
}

- Swipe-more (same shape as swipe-only current card), or { "completed": true }

## Results
GET /api/v1/play/{playId}/results

Response variants
- Vote-only
{
  "playId": "<uuid>",
  "mode": "vote_only",
  "deckTag": "#company",
  "ranking": [ { "rank": 1, "cardId": "<uuid>", "card": { ... } }, ... ],
  "personalRanking": ["<uuid>", "<uuid>", ...],
  "statistics": { "totalCards": 10, "totalComparisons": 23 }
}

- Swipe-only
{
  "playId": "<uuid>",
  "mode": "swipe_only",
  "completed": true,
  "ranking": [ { "rank": 1, "card": { ... }, "swipedAt": "..." }, ... ],
  "statistics": { "totalCards": 10, "likedCards": 6, "rejectedCards": 4, "totalSwipes": 10 },
  "sessionInfo": { "deckTag": "#company", "createdAt": "...", "duration": 120000 }
}

- Rank-more
{
  "playId": "<uuid>",
  "mode": "rank_more",
  "deckTag": "#company",
  "personalRanking": ["<uuid>", "<uuid>", ...],
  "ranking": [ { "rank": 1, "cardId": "<uuid>" }, ... ],
  "statistics": { "totalItems": 8 }
}

- Swipe-more
{
  "playId": "<uuid>",
  "mode": "swipe_more",
  "completed": true,
  "ranking": [ { "card": { ... }, "familyLevel": 0, "familyContext": "root", "familyTag": "#company", "overallRank": 1, "familyRank": 1 }, ... ],
  "statistics": { "totalFamilies": 3, "totalLiked": 12, "totalSwipes": 45, "familyBreakdown": [ ... ] },
  "decisionSequence": [ { "step": 1, "type": "swipe-family", "familyTag": "#company", "level": 0, "context": "root", "timestamp": "..." }, ... ]
}

## Notes
- Rate limiting headers apply to all endpoints.
- All timestamps are ISO 8601 with milliseconds in UTC (YYYY-MM-DDTHH:MM:SS.sssZ).
- The dispatcher resolves playId across Play, SwipeOnlyPlay, and SwipeMorePlay.
- Specialized vote-only endpoints under `/api/v1/play/vote-only/*` remain available for backward compatibility but are DEPRECATED internally. New development should use the unified `/api/v1/play/*` endpoints.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Currently no authentication required. All endpoints are public.

## Error Responses

All endpoints return errors in a standardized envelope:
```json
{
  "error": {
    "code": 1001,
    "message": "Validation failed: deckTag is required",
    "details": [
      { "path": "deckTag", "message": "Required", "code": "invalid" }
    ],
    "timestamp": "2025-09-07T13:21:53.000Z",
    "requestId": "7c3e8f3d-5a64-4e3a-8e62-5f6324fbcf53"
  }
}
```

Taxonomy:
- 1xxx: client errors (validation, malformed requests)
- 2xxx: auth/authorization errors
- 3xxx: business-state errors (invalid transitions)
- 4xxx: resource errors (not found, deleted, inactive)
- 5xxx: system errors (database, external services)

Common HTTP status codes:
- `400`: Bad Request - Invalid input data
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Duplicate resource (e.g., hashtag already exists)
- `500`: Internal Server Error

---


---

## Route inventory (`pages/api/`)

| Method | Path | Status |
|--------|------|--------|
| GET/POST | `/api/cards` | Active |
| GET/PUT/DELETE | `/api/cards/[uuid]` | Active |
| GET | `/api/cards/rankings` | Active |
| GET/POST/PUT/DELETE | `/api/organizations` | Active (master DB) |
| POST | `/api/v1/play/start` | Active |
| POST | `/api/v1/play/[playId]/input` | Active |
| GET | `/api/v1/play/[playId]/next` | Active |
| GET | `/api/v1/play/[playId]/results` | Active |
| POST | `/api/v1/play/vote-only/start` | Deprecated compat |
| POST | `/api/admin/login` | Active (admin) |
| * | `/api/system/page-passwords` | **410 Gone** |
| POST/GET | `/api/play/*` | Deprecated — [DEPRECATED_API.md](./DEPRECATED_API.md) |

## Historical specifications (removed)

Older sections described `/api/v1/cards`, `cardName`/`sessionId` play start, and TypeScript `ICard` shapes. They do not match the v7.2 implementation. See git history before 2026-05-23 if needed.
