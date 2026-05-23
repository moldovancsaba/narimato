# ADR 001: Vote-only play mode status

**Status:** Accepted  
**Date:** 2026-05-23  
**Deciders:** Product owner  
**Issue:** [#14](https://github.com/moldovancsaba/narimato/issues/14)

## Context

Vote-only is implemented in the unified API (`mode: vote_only` → `VoteOnlyService` via `PlayDispatcher`), exposed in `pages/play.js`, and listed in `README.md`. At the same time, `pages/vote-only.js` returned HTTP 410 with “removed for security and compliance,” and `RELEASE_NOTES.md` contained a contradictory removal notice under v5.4.1.

## Decision

**Option A — Supported.** Vote-only remains a first-class play mode.

The 410 page and removal language were **erroneous leftover text**, not an intentional product or compliance decision.

## Consequences

### In scope (immediate)

- Restore `/vote-only` as an entry route (redirect to `/play?mode=vote-only` or equivalent)
- Retract erroneous removal copy in `RELEASE_NOTES.md`
- Keep `VoteOnlyService`, `PlayDispatcher` `vote_only` engine, and play UI vote-only control
- Keep unified API as canonical; `POST /api/v1/play/vote-only/start` remains deprecated back-compat only

### Out of scope

- Algorithm change (VoteOnlyService vs binary search) — see issue #18
- Removing vote segments from swipe-more / rank-only modes

## Acceptance

- No “removed” messaging for vote-only without an explicit future ADR
- `/vote-only` does not return 410
- README, RELEASE_NOTES, and runtime behavior agree
