# ADR-0006: Delivery SSOT in GitHub Project issues; docs own durable knowledge

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: SSOT-01, SSOT-02, SSOT-03, SSOT-04, DOC-01, REL-01

## Context

Delivery state was spread across `DELIVERY_TASKS.md`, `REQUESTS_24H.md`, `ROADMAP.md`,
`DELIVERY_PLAN.md`, README "Status" and release notes. The same capability carried conflicting
verdicts (for example the 3D humanoid was recorded as delivered in one document and open in
another), test counts drifted (66 / 97 / 116 / 117), and no executable dependency order existed.

A canonical production-grade issue standard exists:
[sovereignsquad/general-design-system#81](https://github.com/sovereignsquad/general-design-system/issues/81).

## Decision

- The GitHub Project
  [`{narimato} - From IDEA to LIVE`](https://github.com/users/moldovancsaba/projects/80) is the
  **only mutable delivery record**: status, readiness, sequencing, evidence and next action.
- Every unit of work is an independently executable issue in the GDS #81 format: architecture,
  runtime flow, contracts, APIs, pseudo-code, UX states, accessibility, observability,
  retries/timeouts, rollback, testing, documentation, dependencies, execution order and edge
  cases. No umbrella tasks.
- Repository documents own durable technical/product knowledge and link their related issues;
  they never mirror status checklists.
- Native GitHub blocked-by links are the dependency authority; `Readiness` is a recomputed
  snapshot. `Execution Order` is topological, not a date promise.
- Completion requires the Definition of Done plus evidence (commit, tests, artifacts, smoke,
  rollback) recorded on the issue and the board.
- Repository gates (`docs:check`, `check:version`, test count) are automated so documentation and
  versions cannot silently drift from the delivered tree.

## Consequences

- Reviewers and agents have one place to answer "where are we?".
- Planning docs are retired; their remaining scope is dispositioned in the issue map.
- Issue hygiene becomes part of delivery: an issue without evidence cannot be closed.
- Repository docs need link maintenance, enforced by CI; a docs-only change still runs gates.
- The board schema and issue template are governed by M0 issues, not ad-hoc edits.

## Alternatives considered

- **Keep Markdown status documents**: rejected; they duplicate and contradict each other.
- **External tracker (Jira/Linear)**: rejected; adds a tool and an integration with no measured
  benefit for a single-maintainer repository.
- **Issue-per-file or issue-per-commit**: rejected; too granular to plan readiness and too noisy
  to review.
- **Board-only without repo docs**: rejected; architecture, algorithms, operations and gameplay
  need durable, reviewable prose that is versioned with the code.

## Links

- [docs/SSOT.md](../SSOT.md) — two-source model and non-negotiable rules.
- [docs/PROJECT_BOARD.md](../PROJECT_BOARD.md) — fields, statuses, readiness and views.
- [docs/DEFINITION_OF_DONE.md](../DEFINITION_OF_DONE.md) — the only definition of done.
- [docs/ISSUE_MAP.md](../ISSUE_MAP.md) — issue index and doc mapping.
- Issues: [SSOT-01](../ISSUE_MAP.md), [SSOT-02](../ISSUE_MAP.md), [SSOT-03](../ISSUE_MAP.md),
  [SSOT-04](../ISSUE_MAP.md), [DOC-01](../ISSUE_MAP.md), [REL-01](../ISSUE_MAP.md).
