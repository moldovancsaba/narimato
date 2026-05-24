# ADR 003: Local AI dual-runtime architecture

**Status:** Accepted  
**Date:** 2026-05-23  
**Issue:** [#27](https://github.com/moldovancsaba/narimato/issues/27)

## Context

Narimato serves play on Vercel but card intelligence requires Ollama on a Mac. Checklist-pattern separates write-side intelligence from read-side webapp.

## Decision

Two runtimes share MongoDB Atlas:

| Runtime | Host | Authority |
|---------|------|-----------|
| **Webapp** | Vercel | Read projections; play/rank engines; **no mutations** on Vercel prod |
| **Local intelligence** | Mac localhost | All operator management; job queue; Ollama; projection refresh |

### Mutator rules

- `scripts/sync.js` is the sole **foreground** job executor (port 10005).
- `scripts/snapshot-worker.js` refreshes projections on dirty queue (port 10007).
- `scripts/status-server.js` serves local operator console (port 10006).
- Webapp API routes block POST/PUT/DELETE on Vercel unless `LOCAL_OPERATOR_BYPASS=1`.

### Data placement (master vs org DB)

- **Master DB:** `Organization`, `PipelineJob`, `TopicSpec`, `GlobalSetting`, `DeckIntelligenceConfig`
- **Per-org DB:** `Card`, `IntelligenceSnapshot`, play/ranking collections

## Consequences

- Play engines unchanged; they read materialized approved `Card` documents.
- `/api/play/decks` reads `IntelligenceSnapshot.webappProjection` with bounded fallback.
- Operators use http://127.0.0.1:10006 exclusively for management.
