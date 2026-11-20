# NARIMATO — Project Board Contract

Board: **https://github.com/users/moldovancsaba/projects/80**
Title: `{narimato} - From IDEA to LIVE` · Owner: `moldovancsaba` · Linked repository:
`moldovancsaba/narimato`.

This board is the **only** mutable record of delivery state for NARIMATO. Issues are the executable
specs; repository docs own durable knowledge. See [SSOT.md](SSOT.md).

Canonical issue standard: [sovereignsquad/general-design-system#81](https://github.com/sovereignsquad/general-design-system/issues/81).

## Status workflow

| Status | Meaning | Entry rule | Exit rule |
|---|---|---|---|
| `IDEABANK (SOMEDAY)` | Captured, not committed | Idea recorded with an owner question | Promoted to Roadmap or closed |
| `Roadmap (LATER)` | Committed to a later milestone | Milestone assigned, no near-term execution | Becomes Backlog/Todo when prioritised |
| `Backlog (SOONER)` | Valid work blocked by an open dependency | Native blocked-by link exists and is open | Blockers closed and Readiness recomputed |
| `Todo (NEXT)` | Ready to execute now | All native blockers closed; contract fixtures unambiguous | Claimed by an owner |
| `In Progress (NOW)` | Implementation or required verification active | Owner set, Next Action written | Implementation + evidence complete |
| `Review (ALMOST)` | Implemented, awaiting acceptance | Delivered + Release Evidence fields filled | Acceptance verified by someone other than the author where practical |
| `Done` | Every acceptance criterion and handover gate satisfied | Definition of Done fully met | Reopened only by a new defect issue or regression evidence |
| `Declined (NEVER)` | Removed from product direction | Written decision recorded on the issue | — |

Never mark `Done` while a required test, accessibility/GDS evidence, documentation update,
operational/rollback note, or production smoke check is missing.

## Fields

| Field | Type | Values / meaning |
|---|---|---|
| `Status` | single select | Workflow above |
| `Readiness` | single select | `Ready` (no open blockers), `Blocked` (at least one native blocker open), `Later` (deferred until a measured gate) |
| `Execution Order` | number | Topological planning order (gaps allowed: 10, 20, 100, 110 …) |
| `Roadmap Stage` | single select | `M0 SSOT and foundation`, `M1 GDS UI foundation`, `M2 Single-scene renderer`, `M3 Surface multiplayer`, `M4 Controls and camera`, `M5 Events story audio`, `M6 Operations and security`, `M7 Performance and release` |
| `Track` | single select | Foundation, Quality, UI, Accessibility, Renderer, Multiplayer, Controls, Events, Story, Audio, Ops, Security, Performance, Release |
| `Delivered` | text | Capability + commit SHA, filled on completion |
| `Release Evidence` | text | Test output, artifact path/URL, metrics, screenshot, or docs-only N/A |
| `Documentation` | text | Exact paths updated |
| `Next Action` | text | The single next concrete action while In Progress |

Labels mirror type/area/priority/size; `gds` marks General Design System consumption and
`accessibility` marks an accessibility-critical issue. Labels never replace fields.

## Dependency and readiness rules

- Native **blocked-by** relationships are authoritative. Do not encode dependencies only in prose.
- `Readiness = Ready` **only** when every native blocker is closed and its acceptance evidence was
  reviewed.
- When a blocker closes or reopens, recompute Readiness for every dependent issue and update
  `Status` (Todo ↔ Backlog).
- Independent Ready issues may run concurrently; respect write-scope separation when two issues
  touch the same files.
- Do not start a Blocked issue "to make progress". If the contract is genuinely needed first, the
  blocker issue must be delivered or the dependency must be changed by the board owner.

## Milestones

| Milestone | Scope |
|---|---|
| M0 — SSOT & repository foundation | Board, templates, CI gates, version SSOT, legacy-doc retirement, test-suite truth |
| M1 — GDS UI foundation & accessible surfaces | GDS integration, every DOM surface migrated, a11y CI + real-device gates |
| M2 — Single-scene renderer | SurfaceCamera, one renderer, HUD parity, live leaves, humanoids, acceptance |
| M3 — Authoritative surface multiplayer | Poses, robot routes/clicks, beams, supply relocation, two-client proof |
| M4 — Controls & camera correctness | Drag/travel/poles, harvest truth, farthest-orbit exit, mode visibility, touch |
| M5 — Events, story & audio | Incidents/ships, accessible feedback, narration pipeline, playback resilience, copy SSOT |
| M6 — Operations, scale & security | Observability, load/chaos gate, backup/restore, CDN, sharding decision, hardening |
| M7 — Performance & release quality | Client budgets, release acceptance gate, evidence ledger |

Milestones group scope; they do **not** override dependencies. An issue can be in M5 and only
executable after an M2 dependency closes.

## Views

- **Delivery board** — board grouped by `Status`; default working view.
- **Execution sequence** — table sorted by `Execution Order`.
- **Ready to start** — table filtered to `Readiness = Ready`.
- **Milestone roadmap** — table grouped by `Roadmap Stage`.

## Operating routine

1. **Before starting:** confirm all blockers closed; set `In Progress (NOW)`; write `Next Action`.
2. **While working:** keep the issue body current if a contract changes; never silently widen scope.
3. **On completion:** fill `Delivered`, `Release Evidence`, `Documentation`, `Next Action`; update
   `Status = Review (ALMOST)`; verify acceptance; then `Done` and close the issue.
4. **On dependency close:** re-list blocked issues and flip `Backlog` → `Todo` where all blockers
   are closed.
5. **Weekly audit:** every `In Progress` issue has an owner and fresh Next Action; every `Blocked`
   issue has at least one open native blocker; no issue is `Done` without evidence.

## Board ownership

The board owner is the repository owner (`moldovancsaba`). Field/schema changes and dependency
edits require a `type:docs` issue in M0. Issue closure is owned by the delivering engineer; evidence
review is owned by the reviewer named on the PR.
