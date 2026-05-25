# Narimato intelligence SSOT

Hierarchy: **ADR 003/004/005** → this doc → `WEBAPP_READ_MODEL_LLD.md` → `LOCAL_AI_PIPELINE.md` → UI via `docs/GDS_ADOPTION.md`.

**Play feedback training (proposed):** [adr/005-play-feedback-training.md](./adr/005-play-feedback-training.md) · [PLAY_FEEDBACK_TRAINING_PLAN.md](./PLAY_FEEDBACK_TRAINING_PLAN.md) · [PLAY_FEEDBACK_TRAINING_LLD.md](./PLAY_FEEDBACK_TRAINING_LLD.md)

**Program #26 (v1):** P0–P4 delivered on `main` — guardian + launchd (#44), `INTELLIGENCE_CI_GUARDS.md` (#45), `npm run intelligence:e2e` (#46).

## Product

Local Mac intelligence generates Narimato deck/card content. Vercel webapp is play + projection reads only.

## Authority split

- **Local operator console** (127.0.0.1:10006): orgs, cards, topic chat, jobs, HiTL, auto-approve per deck.
- **Webapp**: `/play`, rankings, results; `/local-ai` links to local console.

## Models

**Master:** `PipelineJob`, `TopicSpec`, `GlobalSetting`, `DeckIntelligenceConfig`, `Organization`.  
**Master (ADR 005, planned):** `IntelligenceMemory`, `IntelligenceRule`, `IntelligencePersona`.

**Per-org:** `Card` (with lineage + approval), `IntelligenceSnapshot`, play collections.  
**Per-org (ADR 005, planned):** `PlayFeedbackEvent`, `PlayFeedbackAggregate`.

## Code map

| Area | Path |
|------|------|
| Constants | `lib/intelligence/constants.js` |
| Webapp adapter | `lib/webapp-projection.js` (normalize + freshness) |
| Corpus | `lib/models/Source.js`, `lib/intelligence/sourceService.js` |
| Projection | `lib/intelligence/projectionBuilder.js`, `projectionReader.js` |
| Job registry | `scripts/lib/pipeline-jobs.js` |
| Jobs | `lib/intelligence/jobHandlers.js`, `jobQueue.js` |
| Ollama | `lib/intelligence/ollama.js` |
| Play feedback (stub) | `lib/intelligence/playFeedback.js` |
| Play feedback (planned) | `playFeedbackRecorder.js`, `playFeedbackExtractor.js`, `playFeedbackReconcile.js`, `promptContext.js` |
| Workers | `scripts/sync.js`, `snapshot-worker.js`, `status-server.js`, `guardian.js` |
| Operator API | `scripts/lib/operator-api.js` |

## Reference

[sovereignsquad/checklist](https://github.com/sovereignsquad/checklist) — dual-runtime pattern.
