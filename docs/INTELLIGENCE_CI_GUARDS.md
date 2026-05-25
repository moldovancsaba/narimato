# Intelligence CI guards

**Issue:** [#45](https://github.com/moldovancsaba/narimato/issues/45)  
**Script:** `scripts/ci-intelligence-guard.js`  
**Workflow:** `.github/workflows/intelligence-ci-guard.yml`

## Purpose

Enforce [ADR 003](./adr/003-local-ai-dual-runtime.md): the Vercel webapp must not call Ollama or run foreground intelligence mutations on play/read paths.

## What fails CI

| Area | Forbidden patterns |
|------|-------------------|
| `pages/api/*` | `ollama`, `queueAiInference`, direct `handleJob`, `scripts/sync` imports |
| `pages/*` (except local-ai) | `OLLAMA_HOST`, `guardian`, direct inference calls |
| `lib/services/*` | Ollama, `jobHandlers`, `scripts/lib/core` |
| `lib/services/play/*` | Building projections on read (use `projectionReader` via API only) |

## Allowed webapp intelligence APIs

- `pages/api/intelligence/sources.js` — corpus `Source` writes
- `pages/api/intelligence/jobs/enqueue.js` — queue jobs (workers run on Mac)
- `pages/api/intelligence/status.js` — local status proxy

## Local run

```bash
npm run intelligence:ci-guard
```
