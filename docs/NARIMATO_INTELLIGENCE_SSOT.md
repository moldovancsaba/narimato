# Narimato intelligence SSOT

Hierarchy: **ADR 003/004** → this doc → `WEBAPP_READ_MODEL_LLD.md` → `LOCAL_AI_PIPELINE.md` → UI via `docs/GDS_ADOPTION.md`.

**Program #26 (v1):** P0–P4 delivered on `main` — guardian + launchd (#44), `INTELLIGENCE_CI_GUARDS.md` (#45), `npm run intelligence:e2e` (#46).

## Product

Local Mac intelligence generates Narimato deck/card content. Vercel webapp is play + projection reads only.

## Authority split

- **Local operator console** (127.0.0.1:10006): orgs, cards, topic chat, jobs, HiTL, auto-approve per deck.
- **Webapp**: `/play`, rankings, results; `/local-ai` links to local console.

## Models

**Master:** `PipelineJob`, `TopicSpec`, `GlobalSetting`, `DeckIntelligenceConfig`, `Organization`.

**Per-org:** `Card` (with lineage + approval), `IntelligenceSnapshot`, play collections.

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
| Workers | `scripts/sync.js`, `snapshot-worker.js`, `status-server.js`, `guardian.js` |
| Operator API | `scripts/lib/operator-api.js` |

## Reference

[sovereignsquad/checklist](https://github.com/sovereignsquad/checklist) — dual-runtime pattern.
