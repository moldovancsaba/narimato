# Local AI pipeline

**Issue:** [#29](https://github.com/moldovancsaba/narimato/issues/29)  
**SSOT:** [NARIMATO_INTELLIGENCE_SSOT.md](./NARIMATO_INTELLIGENCE_SSOT.md)  
**Read contract:** [WEBAPP_READ_MODEL_LLD.md](./WEBAPP_READ_MODEL_LLD.md)  
**Architecture:** [ADR 003](./adr/003-local-ai-dual-runtime.md), [ADR 004](./adr/004-intelligence-product-policy.md)

## Doc hierarchy

1. ADRs (architecture + product policy)  
2. `NARIMATO_INTELLIGENCE_SSOT.md`  
3. This file + `WEBAPP_READ_MODEL_LLD.md`  
4. UI: [GDS_ADOPTION.md](./GDS_ADOPTION.md) (external GDS repo)

## Processes

| Process | Port | Script |
|---------|------|--------|
| sync (foreground jobs) | 10005 | `npm run intelligence:sync` |
| status-server (operator UI) | 10006 | `npm run intelligence:status-server` |
| snapshot-worker | 10007 | `npm run intelligence:snapshot-worker` |
| guardian (supervisor) | — | `npm run intelligence:guardian` |

## Job catalog (v1)

| Type | Purpose |
|------|---------|
| `PLAN_TOPIC` | Topic chat / planning metadata |
| `PLAN_DECK` | Set card count / hierarchy on TopicSpec |
| `APPROVE_TOPIC` | Lock topic for generation |
| `GENERATE_DECK_CARDS` | New deck content from approved topic |
| `REPLACE_DECK` | Archive subtree + regenerate |
| `REPLACE_BRANCH` | Regenerate one branch |
| `APPEND_CARDS` | Add cards; skip existing tags |
| `REGENERATE_TAG` | Archive one tag + replace |
| `REFRESH_PROJECTION` | Rebuild `webappProjection` (no LLM) |
| `RECONCILE_FEEDBACK` | Operator thumbs feedback (stub reconcile) |

Legacy aliases: `INGEST_SOURCE` → topic/corpus writes; `RECONCILE_PLAY_FEEDBACK` → `RECONCILE_FEEDBACK`.

## Env vars

| Variable | Default |
|----------|---------|
| `MONGODB_URI` | required (Atlas) |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `llama3.2:1b` |
| `OLLAMA_SKIP` | `1` for fixture/smoke (no LLM) |
| `INTELLIGENCE_SYNC_PORT` | 10005 |
| `INTELLIGENCE_STATUS_PORT` | 10006 |
| `INTELLIGENCE_SNAPSHOT_PORT` | 10007 |
| `INTELLIGENCE_SNAPSHOT_POLL_MS` | 5000 |

## Projection refresh (no LLM) — [#32](https://github.com/moldovancsaba/narimato/issues/32)

Builds `IntelligenceSnapshot.webappProjection` from approved `Card` rows:

```bash
npm run intelligence:refresh-projection -- --org=<organizationId>
npm run intelligence:smoke-projection   # first active org smoke test
```

Implementation: `lib/intelligence/projectionBuilder.js` → validated by `lib/intelligence/projectionSchema.js`.

## Operator SOP

### Automatic (recommended)

```bash
npm run intelligence:install   # once: LaunchAgent
npm run intelligence:uninstall
```

Logs: `logs/intelligence-guardian.log`

### Manual (development)

```bash
ollama serve
npm run intelligence:guardian
open http://127.0.0.1:10006
```

### Daily use

1. Intelligence starts after login (`com.narimato.intelligence` LaunchAgent) when installed.  
2. Webapp: `npm run dev` or Vercel (play-only).  
3. Operator: http://127.0.0.1:10006 — orgs, cards, topic chat, jobs, HiTL.

## Dirty queue

Card mutations call `markOrgDirty(orgId)` → `snapshot-worker` rebuilds projection → play reads fresh JSON.

## CI

```bash
npm run intelligence:ci-guard
```

Blocks Ollama imports and management mutations in Vercel-facing paths.
