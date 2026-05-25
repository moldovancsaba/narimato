# Webapp read-model LLD

**Schema version:** 1  
**Issue:** [#28](https://github.com/moldovancsaba/narimato/issues/28)  
**Validator:** `lib/intelligence/projectionSchema.js` (Zod)

## Storage

`IntelligenceSnapshot` (per-org DB), one org-wide document:

```js
{ organizationId, deckRootTag: null, webappProjection, schemaVersion, builtAt, sourceJobId }
```

Per-deck slices (`deckRootTag` set) are reserved for a future version.

## Projection shape (v1)

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | `1` |
| `organizationId` | yes | Org UUID |
| `builtAt` | yes | ISO timestamp |
| `freshness` | yes | See freshness enum |
| `cards` | yes | Normalized approved cards |
| `decks` | yes | Play-ready deck groups (≥2 cards per root) |
| `rankingsSummary` | optional | Top cards by `globalScore` for `/rankings` |

### Freshness enum

| Status | Meaning |
|--------|---------|
| `fresh` | Built within the current worker cycle |
| `aging` | Snapshot older than configured threshold (optional UI) |
| `stale` | Org marked dirty; rebuild pending |
| `missing` | No snapshot — API uses live `Card.find` fallback |
| `unknown` | Normalizer default when field absent |

### Card fields (normalized)

`uuid`, `name`, `title`, `description`, `imageUrl`, `hashtags`, `parentTag`, `isPlayable`, `isActive`, `approvalStatus`, `globalScore`, `hierarchyLevel`, `source`.

### Deck fields

`rootTag`, `title`, `isPlayable`, `autoApprove`, `cardCount`, `cards[]`.

## Consumers

| Surface | Behavior |
|---------|----------|
| `GET /api/play/decks` | Projection-first deck picker |
| `GET /api/cards` | Projection by default; `?projection=false` for live query |
| `/rankings` | `rankingsSummary.topCards` when present; else live sort |
| Play engines | Materialized `Card` docs (unchanged) |

## Example (`#SampleDeck`)

```json
{
  "schemaVersion": 1,
  "organizationId": "00000000-0000-4000-8000-000000000001",
  "builtAt": "2026-05-25T10:00:00.000Z",
  "freshness": { "status": "fresh", "lastRefreshAt": "2026-05-25T10:00:00.000Z" },
  "cards": [
    {
      "uuid": "card-uuid-1",
      "name": "#SampleDeck",
      "title": "Sample deck",
      "parentTag": null,
      "isPlayable": true,
      "approvalStatus": "approved",
      "globalScore": 1500
    },
    {
      "uuid": "card-uuid-2",
      "name": "#Topic-A",
      "title": "Topic A",
      "parentTag": "#SampleDeck",
      "isPlayable": true,
      "approvalStatus": "approved",
      "globalScore": 1520
    },
    {
      "uuid": "card-uuid-3",
      "name": "#Topic-B",
      "title": "Topic B",
      "parentTag": "#SampleDeck",
      "isPlayable": true,
      "approvalStatus": "approved",
      "globalScore": 1480
    }
  ],
  "decks": [
    {
      "rootTag": "#SampleDeck",
      "title": "Sample deck",
      "isPlayable": true,
      "autoApprove": false,
      "cardCount": 2,
      "cards": []
    }
  ],
  "rankingsSummary": {
    "topCards": [
      { "uuid": "card-uuid-2", "name": "#Topic-A", "title": "Topic A", "globalScore": 1520 }
    ],
    "generatedAt": "2026-05-25T10:00:00.000Z"
  }
}
```

## Rebuild (no LLM)

```bash
npm run intelligence:refresh-projection -- --org=<organizationId>
# or
node scripts/build-projection.js <organizationId>
```

See [LOCAL_AI_PIPELINE.md](./LOCAL_AI_PIPELINE.md).
