# ADR 003: Local AI dual-runtime architecture

**Status:** Accepted  
**Date:** 2026-05-23  
**Issue:** [#27](https://github.com/moldovancsaba/narimato/issues/27)

## Context

Narimato serves play on Vercel but card intelligence requires Ollama on a Mac. The checklist-pattern separates write-side intelligence from read-side webapp consumption via MongoDB projections.

## Decision

Two runtimes share **MongoDB Atlas** ([ADR 002](./002-multi-tenant-database.md)):

```
┌─────────────────┐     read JSON      ┌──────────────────┐
│ Vercel webapp   │ ◄───────────────── │ IntelligenceSnapshot │
│ (play/rankings) │                    │ webappProjection     │
└────────┬────────┘                    └────────▲─────────┘
         │ writes play only                       │
         │                                          │ refresh
         ▼                                          │
┌─────────────────┐     enqueue jobs     ┌────────┴─────────┐
│ Mac localhost   │ ───────────────────► │ MongoDB Atlas    │
│ sync / snapshot │ ◄─────────────────── │ master + org DBs │
│ status-server   │     read/write       └──────────────────┘
└─────────────────┘
```

| Runtime | Host | May write |
|---------|------|-----------|
| **Webapp** | Vercel | Play sessions, rankings reads; **no** card intelligence mutations in production |
| **Local intelligence** | Mac `127.0.0.1` | Orgs, cards, jobs, topics, projections, Ollama output |

### Authority matrix

| Collection / artifact | Webapp (Vercel) | Local workers | Notes |
|----------------------|-----------------|---------------|-------|
| `Card` | Read (fallback) | Create/update/archive | Materialized approved cards |
| `IntelligenceSnapshot` | Read | Upsert `webappProjection` | Org-wide doc `deckRootTag: null` |
| `PipelineJob` | — | Enqueue + execute | `scripts/sync.js` only foreground executor |
| `TopicSpec` | — | CRUD via operator API | Master DB |
| `DeckIntelligenceConfig` | — | CRUD | Per-deck auto-approve |
| Play / ranking models | Read/write during play | — | Engines unchanged |

### Forbidden webapp patterns (production)

- Calling Ollama or any LLM from API routes or `getServerSideProps`
- Enriching cards on GET (compute-on-read)
- Running `sync.js` or snapshot refresh inside Vercel handlers
- POST/PUT/DELETE management APIs on Vercel unless `LOCAL_OPERATOR_BYPASS=1` (dev only)

### Processes (local Mac)

| Process | Port | Script |
|---------|------|--------|
| Foreground job worker | 10005 | `npm run intelligence:sync` |
| Operator console API + UI | 10006 | `npm run intelligence:status-server` |
| Projection refresh | 10007 | `npm run intelligence:snapshot-worker` |
| Supervisor | — | `npm run intelligence:guardian` |

### Schema tooling

**Mongoose** remains the Narimato default (existing `lib/models/*`). Prisma is out of scope unless a future ADR migrates tooling.

## Consequences

- Play engines read materialized approved `Card` documents; behavior unchanged.
- `/api/play/decks` and `/api/cards` read `webappProjection` first with bounded fallback ([WEBAPP_READ_MODEL_LLD.md](../WEBAPP_READ_MODEL_LLD.md)).
- Operators manage content at http://127.0.0.1:10006 only ([LOCAL_AI_PIPELINE.md](../LOCAL_AI_PIPELINE.md)).
- CI guard `npm run intelligence:ci-guard` blocks Ollama imports in `pages/` and `lib/services/`.

## References

- [NARIMATO_INTELLIGENCE_SSOT.md](../NARIMATO_INTELLIGENCE_SSOT.md)
- [sovereignsquad/checklist](https://github.com/sovereignsquad/checklist) — authority split pattern
