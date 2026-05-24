# Local AI pipeline

**Issue:** [#29](https://github.com/moldovancsaba/narimato/issues/29)

## Processes

| Process | Port | Script |
|---------|------|--------|
| sync (foreground jobs) | 10005 | `npm run intelligence:sync` |
| status-server (operator UI) | 10006 | `npm run intelligence:status-server` |
| snapshot-worker | 10007 | `npm run intelligence:snapshot-worker` |
| guardian (supervisor) | — | `npm run intelligence:guardian` |

## Job catalog

| Type | Purpose |
|------|---------|
| `PLAN_DECK` | Set card count / hierarchy on TopicSpec |
| `GENERATE_DECK_CARDS` | New deck content from approved topic |
| `REPLACE_DECK` | Archive subtree + regenerate |
| `REPLACE_BRANCH` | Regenerate one branch |
| `APPEND_CARDS` | Add cards; skip existing tags |
| `REGENERATE_TAG` | Archive one tag + replace |
| `REFRESH_PROJECTION` | Rebuild webappProjection |
| `RECONCILE_FEEDBACK` | Record operator thumbs (stub reconcile) |

## Env vars

| Variable | Default |
|----------|---------|
| `MONGODB_URI` | required (Atlas) |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `llama3.2` |
| `OLLAMA_SKIP` | `1` for fixture/smoke (no LLM) |
| `INTELLIGENCE_SYNC_PORT` | 10005 |
| `INTELLIGENCE_STATUS_PORT` | 10006 |
| `INTELLIGENCE_SNAPSHOT_PORT` | 10007 |

## Operator SOP

### Automatic (recommended — runs at login)

```bash
npm run intelligence:install   # once: LaunchAgent + auto-restart
npm run intelligence:uninstall # remove LaunchAgent
```

Logs: `logs/intelligence-guardian.log`

### Manual (development)

```bash
ollama serve   # if not already running via your ollama LaunchAgent
npm run intelligence:guardian
open http://127.0.0.1:10006
```

### Daily use

1. Intelligence starts automatically after login (`com.narimato.intelligence` LaunchAgent).
2. Ollama: use your existing ollama LaunchAgent, or `ollama serve`.
3. Webapp: `npm run dev` (or Vercel for play-only).
4. Operator console: http://127.0.0.1:10006

## Dirty queue

Card mutations call `markOrgDirty(orgId)` → snapshot-worker rebuilds projection → play reads fresh JSON.
