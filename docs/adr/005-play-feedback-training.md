# ADR 005: Play feedback → intelligence training

**Status:** Accepted (MVP implemented 2026-05-24)  
**Date:** 2026-05-24  
**Supersedes (deferred items):** [ADR 004](./004-intelligence-product-policy.md) — play→corpus reconciliation, re-vote prompts  
**Implementation plan:** [PLAY_FEEDBACK_TRAINING_PLAN.md](../PLAY_FEEDBACK_TRAINING_PLAN.md)

## Context

Narimato’s dual runtime ([ADR 003](./003-local-ai-dual-runtime.md)) already separates:

- **Vercel webapp** — play sessions, swipes, votes, ELO updates on `Card`, read of `webappProjection`.
- **Local Mac intelligence** — Ollama, `TopicSpec`, generation jobs, operator HiTL, projection rebuild.

Participant behavior is persisted in Atlas during play, but **does not** flow into rules, memories, persona, or generation prompts. `RECONCILE_PLAY_FEEDBACK` is enqueued on completed play (`pages/api/v1/play/[playId]/results.js`) while the handler remains a **stub** and `INTELLIGENCE_PLAY_FEEDBACK_ENABLED` defaults to `0` ([LOCAL_AI_PIPELINE.md](../LOCAL_AI_PIPELINE.md)).

Operator thumbs (`Card.operatorFeedback` + `RECONCILE_FEEDBACK`) cover **editor** judgment, not **participant** preference signals at scale.

## Decision

Introduce a **play feedback training loop** that keeps ADR 003 authority intact:

1. **Webapp** writes **append-only** `PlayFeedbackEvent` documents to Atlas on session completion (idempotent by `playId`). It may **enqueue** `RECONCILE_PLAY_FEEDBACK` jobs; it never runs Ollama or mutates intelligence artifacts in production.

2. **Local sync worker** executes `RECONCILE_PLAY_FEEDBACK` and follow-on jobs: extract signals, update aggregates, distill memories, propose rules, evolve persona, and optionally enqueue existing regen jobs (`REGENERATE_TAG`, `APPEND_CARDS`, `ARCHIVE` via `RECONCILE_FEEDBACK` patterns).

3. **Generation prompts** (`PLAN_TOPIC`, `PLAN_DECK`, `GENERATE_DECK_CARDS`) load compiled context from `IntelligencePersona`, `IntelligenceRule`, and `IntelligenceMemory` via `lib/intelligence/promptContext.js` (planned).

4. **HiTL default** for destructive content changes; auto-apply only when `DeckIntelligenceConfig` allows (same policy as v1 operator feedback).

### Extended architecture

```
┌─────────────────┐   PlayFeedbackEvent    ┌────────────────────────────┐
│ Vercel webapp   │ ─────────────────────► │ MongoDB Atlas              │
│ (play complete) │   + PipelineJob enqueue│ PlayFeedbackEvent        │
└────────┬────────┘                        │ PlayFeedbackAggregate    │
         │ read projection                  │ IntelligenceMemory       │
         ▼                                  │ IntelligenceRule         │
┌─────────────────┐   RECONCILE_* jobs      │ IntelligencePersona      │
│ Mac localhost   │ ◄────────────────────── │ TopicSpec · Card · Snap  │
│ sync + Ollama   │ ──► prompt injection ──►└────────────────────────────┘
└─────────────────┘
```

### Authority matrix (additions)

| Collection / artifact | Webapp (Vercel) | Local workers | Notes |
|----------------------|-----------------|---------------|-------|
| `PlayFeedbackEvent` | Insert on complete (idempotent) | Read | Immutable session export |
| `PlayFeedbackAggregate` | — | Upsert | Rolling deck-level stats |
| `IntelligenceMemory` | — | CRUD + distill | Provenance: `playId`, `jobId` |
| `IntelligenceRule` | — | CRUD | Scoped `org \| deck \| topic` |
| `IntelligencePersona` | — | Versioned upsert | Compiled `systemPreamble` for Ollama |
| `TopicSpec.conversation` | — | Append learnings | Audit trail alongside chat |
| `RECONCILE_PLAY_FEEDBACK` | Enqueue only | Execute | Replaces stub in `jobHandlers.js` |

### Job catalog (v2 additions)

| Type | Purpose | LLM |
|------|---------|-----|
| `RECONCILE_PLAY_FEEDBACK` | Per-session reconcile: extract → propose → persist → fan-out | Yes (structured JSON) |
| `DISTILL_PLAY_MEMORIES` | Batch compress episodic → distilled memories | Yes |
| `TRAIN_PERSONA_FROM_PLAY` | Batch persona update from aggregates | Yes |

Existing regen jobs remain the **execution** layer for `contentActions` emitted by reconcile.

### Forbidden patterns (unchanged from ADR 003)

- Ollama or training logic in `pages/` / Vercel API except enqueue + event insert.
- Synchronous “train on read” in play GET handlers.
- Cross-tenant memory or rule leakage.

### Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `INTELLIGENCE_PLAY_FEEDBACK_ENABLED` | `0` | Master switch for reconcile handler |
| `PLAY_FEEDBACK_MIN_SESSION_CARDS` | `3` | Skip reconcile below this deck participation |
| `PLAY_FEEDBACK_RETENTION_DAYS` | `365` | Event retention for GDPR ops |
| `PLAY_FEEDBACK_RECONCILE_COOLDOWN_H` | `24` | Max one reconcile job per `playId` per window |

See [INTELLIGENCE_ENV.example](../INTELLIGENCE_ENV.example) and [PLAY_FEEDBACK_TRAINING_LLD.md](../PLAY_FEEDBACK_TRAINING_LLD.md) (schemas).

### Privacy & retention

- Events store card UUIDs and ranking order, not participant PII (sessions are password-gated, no account model in v1).
- Retention job (planned) purges `PlayFeedbackEvent` older than `PLAY_FEEDBACK_RETENTION_DAYS`.
- Operators can disable play feedback per deck via `DeckIntelligenceConfig.playFeedbackEnabled` (planned field).

## Consequences

- **Positive:** Closed loop from real participant preference → corpus refinement → better next-generation cards and persona alignment.
- **Positive:** Webapp still runs without local AI when projection/cards exist; training is async on Mac.
- **Negative:** More master/per-org collections and operator review surface.
- **Negative:** Small local models may produce low-quality distillations without HiTL and cooldown guards.
- **Risk:** Over-aggressive auto-regen from noisy play data — mitigated by aggregates thresholds and HiTL.

## Implementation phases

Detailed breakdown: [PLAY_FEEDBACK_TRAINING_PLAN.md](../PLAY_FEEDBACK_TRAINING_PLAN.md).

| Phase | Outcome |
|-------|---------|
| 0 | ADR 005 + LLD + event write on play complete |
| 1 | Signal extraction + `PlayFeedbackAggregate` |
| 2 | Memory / rule / persona models + local API |
| 3 | Real `RECONCILE_PLAY_FEEDBACK` handler |
| 4 | `promptContext` injection into generation |
| 5 | Operator “Play learnings” UI |
| 6 | Play-driven regen + re-vote policy |
| 7 | E2E + retention + rate limits |

**MVP milestone:** Phases 0–3 + memory injection into `GENERATE_DECK_CARDS` (Phase 4 subset).

## References

- [PLAY_FEEDBACK_TRAINING_PLAN.md](../PLAY_FEEDBACK_TRAINING_PLAN.md)
- [PLAY_FEEDBACK_TRAINING_LLD.md](../PLAY_FEEDBACK_TRAINING_LLD.md)
- [NARIMATO_INTELLIGENCE_SSOT.md](../NARIMATO_INTELLIGENCE_SSOT.md)
- `lib/intelligence/playFeedback.js`, `lib/intelligence/jobHandlers.js` (current stub)
