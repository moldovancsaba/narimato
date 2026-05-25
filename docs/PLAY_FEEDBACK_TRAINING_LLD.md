# Play feedback training — LLD

**Schema version:** 1 (proposed)  
**ADR:** [005-play-feedback-training](./adr/005-play-feedback-training.md)  
**Plan:** [PLAY_FEEDBACK_TRAINING_PLAN.md](./PLAY_FEEDBACK_TRAINING_PLAN.md)  
**Validator (planned):** `lib/intelligence/playFeedbackSchema.js` (Zod)

## Overview

Participant play sessions produce **immutable events** in Atlas. Local workers **reconcile** events into aggregates, **memories**, **rules**, and **persona** versions, then **refine content** via existing pipeline jobs. The webapp never runs training; it only records events and reads materialized projections.

## `PlayFeedbackEvent` (per-org DB)

One document per completed play session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | number | yes | `1` |
| `uuid` | string | yes | Event id |
| `organizationId` | string | yes | Tenant |
| `playId` | string | yes | `Play.uuid` or swipe-only session id |
| `deckRootTag` | string | yes | Normalized `#Deck` |
| `mode` | string | yes | `classic`, `swipe_only`, `vote_only`, … |
| `completedAt` | ISO date | yes | Session end |
| `personalRanking` | string[] | yes | Card UUIDs best-first |
| `swipes` | object[] | no | `{ cardId, direction, timestamp }` |
| `votes` | object[] | no | `{ cardA, cardB, winner, timestamp }` |
| `cardSnapshots` | object[] | yes | `{ uuid, name, title, globalScore, voteCount }` at completion |
| `topicSpecId` | string | no | Resolved link to master `TopicSpec` |
| `reconciledAt` | ISO date | no | Set by worker |
| `reconcileJobId` | string | no | `PipelineJob.uuid` |

**Indexes**

- Unique: `{ organizationId, playId }`
- Query: `{ organizationId, deckRootTag, completedAt }`

**Writer:** webapp `lib/intelligence/playFeedbackRecorder.js` (planned) from play results completion path.

## `PlayFeedbackAggregate` (per-org DB)

Rolling deck-level stats; worker-maintained only.

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | string | Tenant |
| `deckRootTag` | string | Normalized root hashtag |
| `sessionCount` | number | Completed sessions in window |
| `windowStartedAt` | ISO date | Aggregate window start |
| `lastAggregatedAt` | ISO date | Last merge |
| `topCardUuids` | string[] | Frequent top ranks |
| `bottomCardUuids` | string[] | Frequent rejects / low ranks |
| `pairwiseWins` | object | `{ "uuidA:uuidB": { winsA, winsB, n } }` |
| `swipeRates` | object | `{ cardUuid: { left, right } }` |
| `eloDeltaSum` | object | `{ cardUuid: number }` optional |
| `confidence` | number | `0..1` from session count + coverage |

## `IntelligenceMemory` (master DB)

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Id |
| `organizationId` | string | Tenant |
| `deckRootTag` | string | null = org-wide |
| `topicSpecId` | string | optional |
| `kind` | enum | `episodic`, `distilled`, `operator_note` |
| `content` | string | Human-readable insight |
| `weight` | number | Default `1`; decays optional v2 |
| `playIds` | string[] | Provenance |
| `source` | enum | `play`, `operator`, `system` |
| `createdByJobId` | string | Pipeline job |
| `expiresAt` | ISO date | optional TTL |
| `active` | boolean | default `true` |

## `IntelligenceRule` (master DB)

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Id |
| `organizationId` | string | Tenant |
| `scope` | enum | `org`, `deck`, `topic` |
| `deckRootTag` | string | when scope is deck |
| `topicSpecId` | string | when scope is topic |
| `priority` | number | Higher wins ties |
| `ruleType` | enum | `must_include`, `must_avoid`, `style`, `factual`, `safety` |
| `text` | string | Rule body |
| `active` | boolean | |
| `provenance` | object | `{ playIds[], jobId, operatorEmail? }` |

## `IntelligencePersona` (master DB)

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Id |
| `organizationId` | string | Tenant |
| `deckRootTag` | string | null = org default persona |
| `version` | number | Monotonic |
| `tone` | string | e.g. professional, playful |
| `audience` | string | e.g. employees, customers |
| `constraints` | string[] | Hard limits |
| `vocabulary` | string[] | Preferred terms |
| `systemPreamble` | string | Compiled block injected into Ollama |
| `updatedByJobId` | string | Last trainer job |
| `changelog` | string | Short human summary |

## `DeckIntelligenceConfig` extensions (master DB)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `playFeedbackEnabled` | boolean | `true` | Accept play events for deck |
| `autoApplyPlayInsights` | boolean | `false` | Auto-run regen without HiTL |
| `minSessionsBeforeTrain` | number | `5` | Batch persona threshold |
| `maxRegenerationsPerDay` | number | `3` | Safety cap |

## Reconcile handler output (LLM JSON)

`RECONCILE_PLAY_FEEDBACK` expects Ollama `format: json`:

```json
{
  "insights": ["string"],
  "proposedMemories": [
    { "kind": "distilled", "content": "string", "weight": 1 }
  ],
  "proposedRules": [
    { "ruleType": "must_avoid", "text": "string", "priority": 10 }
  ],
  "personaDeltas": {
    "tone": "optional",
    "constraintsAdd": ["string"],
    "changelog": "string"
  },
  "contentActions": [
    { "type": "archive_card", "cardUuid": "uuid", "reason": "string" },
    { "type": "regenerate_tag", "tag": "#Branch", "reason": "string" },
    { "type": "append_cards", "parentTag": "#Deck", "count": 2, "reason": "string" }
  ],
  "topicSpecConversationEntry": "Assistant summary for TopicSpec audit trail"
}
```

**Mapping `contentActions` → jobs**

| Action | Job type |
|--------|----------|
| `archive_card` | inline archive + `markOrgDirty` |
| `regenerate_tag` | `REGENERATE_TAG` |
| `append_cards` | `APPEND_CARDS` |
| (batch weak cards) | `RECONCILE_FEEDBACK` with `archiveDownvoted` |

Always enqueue `REFRESH_PROJECTION` after material card changes.

## Prompt context assembly (planned)

`buildGenerationContext({ organizationId, deckRootTag, topicSpecId })`:

1. Load active `IntelligencePersona` (deck-specific, else org default).
2. Load active `IntelligenceRule` for scope, sort by `priority` desc.
3. Load top N `distilled` memories by `weight`, cap ~2000 chars.
4. Return `{ systemPreamble, rulesBlock, memoriesBlock }` for `ollamaChat` / generate prompts.

## Webapp write path

```
GET /api/v1/play/[playId]/results  (completed)
  → recordPlayFeedbackEvent({ play, results })  // idempotent
  → enqueuePlayFeedbackReconciliation(...)       // if enabled
```

No change to play engines; recorder reads persisted `Play` / engine export only.

## Code map (planned)

| Area | Path |
|------|------|
| Event recorder | `lib/intelligence/playFeedbackRecorder.js` |
| Extractor | `lib/intelligence/playFeedbackExtractor.js` |
| Reconcile | `lib/intelligence/playFeedbackReconcile.js` |
| Prompt context | `lib/intelligence/promptContext.js` |
| Models | `lib/models/PlayFeedbackEvent.js`, … |
| Schema | `lib/intelligence/playFeedbackSchema.js` |
| Handler | `lib/intelligence/jobHandlers.js` (`RECONCILE_PLAY_FEEDBACK`) |
| Operator API | `scripts/lib/operator-api.js` (play learnings routes) |

## Example `PlayFeedbackEvent`

```json
{
  "schemaVersion": 1,
  "uuid": "evt-00000000-0000-4000-8000-000000000099",
  "organizationId": "00000000-0000-4000-8000-000000000001",
  "playId": "play-abc",
  "deckRootTag": "#SampleDeck",
  "mode": "swipe_only",
  "completedAt": "2026-05-24T12:00:00.000Z",
  "personalRanking": ["card-2", "card-3", "card-1"],
  "swipes": [
    { "cardId": "card-1", "direction": "left", "timestamp": "2026-05-24T11:58:00.000Z" },
    { "cardId": "card-2", "direction": "right", "timestamp": "2026-05-24T11:59:00.000Z" }
  ],
  "votes": [],
  "cardSnapshots": [
    { "uuid": "card-2", "name": "#Topic-A", "title": "Topic A", "globalScore": 1520, "voteCount": 12 }
  ]
}
```
