# ADR 004: Intelligence product policy

**Status:** Accepted  
**Date:** 2026-05-23  
**Issue:** [#30](https://github.com/moldovancsaba/narimato/issues/30)

## Corpus (v1)

Local operator UI → topic chat with Ollama agent → approved `TopicSpec` on master DB → generation jobs.

## Generation

- Deck structure + leaf cards from approved topic.
- Planning round: card count + hierarchy levels before generation.
- Regeneration modes (separate jobs): `REPLACE_DECK`, `REPLACE_BRANCH`, `APPEND_CARDS`, `REGENERATE_TAG`.

## Cards

- **Hybrid manual CRUD** always allowed via local console.
- AI cards default **pending**; **HiTL approve** unless deck `autoApprove` is on (per root hashtag).
- Supersede via **archive + new UUID** with lineage fields.

## Approval & feedback

- HiTL default; auto-approval toggle **per deck/root hashtag**.
- P4 feedback: operator thumbs-up/down on generated cards.

## Deployment

- Local Mac: `npm run intelligence:guardian` (Ollama `llama3.2` via `OLLAMA_MODEL`).
- No cloud GPU in v1.

## Deferred

Moved to [ADR 005](./005-play-feedback-training.md) (proposed):

- Re-vote prompts when deck cards replaced after user play.
- Swipe/vote/ELO reconciliation into corpus (rules, memories, persona, content refinement).

Implementation plan: [PLAY_FEEDBACK_TRAINING_PLAN.md](../PLAY_FEEDBACK_TRAINING_PLAN.md).
