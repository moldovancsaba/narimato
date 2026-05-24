# Webapp read-model LLD

**Schema version:** 1  
**Issue:** [#28](https://github.com/moldovancsaba/narimato/issues/28)

## Storage

`IntelligenceSnapshot` (per-org DB), one org-wide document: `{ organizationId, deckRootTag: null, webappProjection }`.

## Projection shape

```json
{
  "schemaVersion": 1,
  "organizationId": "org-uuid",
  "builtAt": "2026-05-23T12:00:00.000Z",
  "freshness": { "status": "fresh", "lastRefreshAt": "..." },
  "cards": [ { "uuid", "name", "title", "description", "imageUrl", "parentTag", "isPlayable", "approvalStatus" } ],
  "decks": [ { "rootTag", "title", "isPlayable", "autoApprove", "cardCount", "cards": [] } ]
}
```

## Consumers

| Route | Behavior |
|-------|----------|
| `GET /api/play/decks` | Primary — projection-first deck picker |
| `GET /api/cards` | Projection by default; `projection=false` for fallback |
| Play engines | Read materialized approved `Card` docs (unchanged) |

## Freshness

- `fresh` — snapshot built within worker cycle
- `missing` — no snapshot; API falls back to live `Card.find`
- `stale` — dirty queue not yet processed (optional UI badge)

## Example deck

Root `#SampleDeck` with ≥2 approved child cards under same `parentTag`.

See `scripts/build-projection.js` to rebuild without LLM.
