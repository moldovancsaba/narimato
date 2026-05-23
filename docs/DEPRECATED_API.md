# Deprecated API routes (still active in client)

**Status:** Deprecated for new integrations — use `/api/v1/play/*` where possible.

`pages/play.js` still calls some legacy routes for classic and hierarchical flows.

## Routes

| Method | Path | Engine / purpose | Unified replacement |
|--------|------|------------------|---------------------|
| POST | `/api/play/start` | `DecisionTreeEngine` classic | `POST /api/v1/play/start` with `mode` |
| POST | `/api/play/swipe` | Classic swipe | `POST /api/v1/play/{playId}/input` `action: swipe` |
| POST | `/api/play/vote` | Classic vote | `POST /api/v1/play/{playId}/input` `action: vote` |
| GET | `/api/play/current` | Resume classic session | `GET /api/v1/play/{playId}/next` |
| GET | `/api/play/results` | Classic results | `GET /api/v1/play/{playId}/results` |
| GET/POST | `/api/play/hierarchical-status` | Hierarchical expansion | Mode-specific v1 responses |
| POST | `/api/play/expand` | Post-complete expansion | — |
| POST | `/api/play/rankChildren` | Child ranking session | — |
| POST | `/api/play/merge` | Merge child ranking | — |
| DELETE | `/api/play/cleanup` | Delete org plays | Admin/maintenance |

## Deprecated compat

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/v1/play/vote-only/start` | Use unified `POST /api/v1/play/start` with `mode: vote_only` |

## Removed

| Method | Path | Status |
|--------|------|--------|
| * | `/api/system/page-passwords` | Always **410 Gone** |
