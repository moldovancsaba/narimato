# NARIMATO — Delivery SSOT

**This file is the entry point for delivery work.** NARIMATO uses a two-source model:

| Source | Owns | Must never contain |
|---|---|---|
| [GitHub Project 80 — `{narimato} - From IDEA to LIVE`](https://github.com/users/moldovancsaba/projects/80) | All mutable delivery state: readiness, status, sequencing, evidence, next action | Technical design prose that belongs in repo docs |
| Repository docs (this directory and root) | Durable technical and product knowledge: architecture, contracts, algorithms, operations, accessibility, gameplay | Status checklists, task backlogs, "delivered/pending" tables |

One sentence: **the board says where we are; the docs say how the system works; the issues say what
exactly to build and how it will be proven.**

Canonical issue standard: [sovereignsquad/general-design-system#81](https://github.com/sovereignsquad/general-design-system/issues/81).

## Start here

| Need | Read |
|---|---|
| Board contract, fields, workflow, milestones | [PROJECT_BOARD.md](PROJECT_BOARD.md) |
| Is this issue done? | [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) |
| How to write an issue | [ISSUE_INTAKE.md](ISSUE_INTAKE.md) |
| Which issue covers which doc/backlog item | [ISSUE_MAP.md](ISSUE_MAP.md) |
| Machine-readable issue index | [issues.json](issues.json) |
| Current technical architecture | [../ARCHITECTURE.md](../ARCHITECTURE.md) |
| Spherical physics/camera solution | [../narimato-physics.md](../narimato-physics.md) |
| Observability contract | [../OBSERVABILITY.md](../OBSERVABILITY.md) |
| Accessibility gate | [../A11Y_CHECKLIST.md](../A11Y_CHECKLIST.md) |
| Gameplay rules | [../GAMEPLAY.md](../GAMEPLAY.md) |

## Non-negotiable rules

1. **One issue = one independently executable outcome.** No umbrella tasks, no "improve X", no
   bundled redesigns. An issue that cannot be verified on its own is split.
2. **Every issue follows GDS #81** and contains the full section set (executive summary, context,
   current state, problem, goals, non-goals, constraints, architecture, contracts, APIs,
   algorithm, UX, accessibility, edge cases, performance, security, acceptance, testing,
   documentation, handover, dependencies, related docs).
3. **All UI/UX/frontend work uses only the Sovereign Squad General Design System**
   ([repository](https://github.com/sovereignsquad/general-design-system),
   package `@sovereignsquad/gds`). No parallel component library, no custom CSS controls, no
   second visual system. Accessibility is a release requirement, not a cleanup task.
4. **Server authority is absolute.** Score, ownership, contest locks, mining, escape and incident
   state come from the server. No client-fabricated resources.
5. **No second planet, renderer, HUD or visual system.** Surface mode is a camera/control change on
   the same scene.
6. **Evidence before "Done".** A plan, a branch or a green build is not delivery. Evidence is a
   commit SHA plus a test result, artifact, metric, screenshot or production smoke.
7. **Native GitHub blocked-by links are the dependency authority.** The board's `Readiness` field is
   a planning snapshot, recomputed when a blocker closes or reopens.
8. **Docs link issues; issues link docs.** A doc must not restate board status. When a durable
   decision changes, update the doc and the related issue together.

## How work moves

```
idea / doc gap / defect / request
  -> issue (GDS #81 body, milestone, labels, dependency links, execution order)
  -> board: Status / Readiness / Roadmap Stage / Track
  -> pick lowest Ready Execution Order
  -> In Progress (NOW) + concrete Next Action
  -> implementation + tests + docs + evidence
  -> Review (ALMOST) while acceptance evidence is verified
  -> Done only when DEFINITION_OF_DONE is fully satisfied
```

## Repository document map

Living technical and product documents stay at the repository root; delivery documents live in
`docs/`. The mapping from every document and former backlog item to its issues is maintained in
[ISSUE_MAP.md](ISSUE_MAP.md).

- `ARCHITECTURE.md` — stack, runtime topology, modules, data model, protocols, deployment.
- `ALGORITHM.md` — spherical geometry, subdivision, hierarchical labels, picking.
- `narimato-physics.md` — authoritative camera/rendering model and failure history.
- `SPEC*.md` — frozen interface contracts for delivered features (historical authority).
- `GAMEPLAY.md`, `GUIDE.md`, `VOICE.md` — player-facing rules, quick guide, narration.
- `OBSERVABILITY.md`, `LOAD_TEST.md`, `EDGE_DEPLOYMENT.md` — operations contracts.
- `A11Y_CHECKLIST.md`, `UX_AUDIT.md` — accessibility and UX evidence/gates.
- `RELEASE_NOTES.md` — shipped-release ledger.
- `docs/` — SSOT governance, issue map, ADRs.

## Change policy

- Changing the SSOT rules or board schema requires a `type:docs` issue on the board (M0).
- A new capability starts as an issue before code; if code exists first, the issue must be opened
  and evidence attached before merge.
- Deleting or renaming a doc requires updating [ISSUE_MAP.md](ISSUE_MAP.md) and
  `scripts/check-docs.mjs` in the same change.
- Release process is [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) plus the release gate issue.

## Bootstrap note

The SSOT migration itself (board, labels, milestones, templates, this document set) is tracked by
[SSOT-01 in the issue index](ISSUE_MAP.md) and was applied as the repository bootstrap change. Any
future change to delivery governance follows the normal issue/PR path.
