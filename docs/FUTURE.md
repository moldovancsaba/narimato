# Planned capabilities (not in v7.2 runtime)

These items appear in older docs or roadmaps but are **not implemented** in the current codebase. Do not document them as shipped until a linked issue merges.

| Capability | Notes |
|------------|--------|
| Organization theming | `backgroundCSS`, Google Fonts URL, emoji/icon lists — no schema or UI |
| Application dark mode | No `data-theme`, Tailwind, or global theme toggle |
| Optimistic locking on Play | No `version` field or 409 concurrency handling |
| `Session` / `GlobalRanking` collections | Session state is on Play + mode models; ELO is on `Card.globalScore` |
| TypeScript / App Router | Pages Router JavaScript only |
| Binary search on unified v1 vote path | `VoteOnlyService` handles v1 vote modes; `BinarySearchEngine` is legacy/orphan |
| `/api/v1/cards` | Cards API is `/api/cards*` |

See [ADR 001](adr/001-vote-only-status.md) and [ADR 002](adr/002-multi-tenant-database.md) for decisions that **are** implemented in v7.2.
