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
| How to develop without detouring / DO NOT DO | [GUARDRAILS.md](GUARDRAILS.md) |
| Renderer/camera technology + forbidden patterns | [RENDERER_TECHNOLOGY.md](RENDERER_TECHNOLOGY.md) |
| Approved camera contract for v2 | [CAMERA_APPROVED.md](CAMERA_APPROVED.md) |
| Revised 25% horizon landing process + feasibility | [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md) |
| Game v2 specification | [GAME_V2.md](GAME_V2.md) |
| Game v2 implementation + retirement plan | [PLAN_GAME_V2.md](PLAN_GAME_V2.md) |
| v2 phase links + rollback (every phase) | [V2_ROLLBACK.md](V2_ROLLBACK.md) |
| Architecture decisions (ADRs) | [adr/README.md](adr/README.md) |
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
9. **Working behaviour is protected.** Continue from the confirmed-working system; never replace
   mouse/camera/planet behaviour, add a second scene or derive new geometry to satisfy a nearby
   request. See [GUARDRAILS.md](GUARDRAILS.md).

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
- `docs/FIXES.md` — cause/fix/verification log of corrective work.
- `docs/GUARDRAILS.md` — development rules, DO NOT DO list, detour detection and protected-behaviour protocol.
- `docs/CAMERA_APPROVED.md` — approved camera contract for the v2 rewrite.
- `docs/GAME_V2.md` / `docs/PLAN_GAME_V2.md` — v2 simple game spec and implementation/retirement plan.
- `docs/` — SSOT governance, issue map, ADRs.

## Repository quality gate (R1–R6)

`npm run release:gate` (`scripts/release-gate.mjs`, REL-01) is the release acceptance
matrix. It runs the version SSOT, test suite and count, docs gate, GDS build/verify,
accessibility gate, browser acceptance, load/chaos smoke, recovery and rollback drills,
and the evidence ledger, then writes a versioned manifest and report under
`artifacts/release/v<version>/`. Exit codes: `0` GREEN, `1` RED, `2` preflight refusal,
`3` missing dependency, `4` documented/executed test-count mismatch, `5` BLOCKED on
external prerequisites. The machine-readable prerequisites live in
`observability/release-prerequisites.json`; the 120-minute soak is a separate release
prerequisite.

`npm run docs:check` (`scripts/check-docs.mjs`) is the deterministic repository gate run in CI:

- **R1** relative links resolve to an existing file with exact path case.
- **R2** link anchors exist in the target markdown document.
- **R3** no local absolute path (`/Users/…`, `file://`) leaks into documentation.
- **R4** issue keys match the canonical pattern and exist in [ISSUE_MAP.md](ISSUE_MAP.md).
- **R5** no unresolved placeholder token (`TODO`, `TBD`, `FIXME`, `PLACEHOLDER`, `<sha>`-style).
- **R6** issue forms, `ISSUE_TEMPLATE/config.yml` and the PR template exist and are non-empty.

Exit codes: `0` clean, `1` findings, `2` internal error. `--json` emits the report contract;
`--root` targets another checkout. The rule set is owned by SSOT-02 and must not be weakened by
editing the checker to fit a broken tree.

The version gate (`node scripts/check-version.mjs`, SSOT-03) validates one app version and one
audio-lineage version across every declared slot, and can fix or bump them. The test-count gate
(`node scripts/test-count.mjs`, QA-01) proves the documented suite size equals the executed suite.

## Release evidence ledger (REL-02)

Every shipped claim in [README.md](../README.md), [RELEASE_NOTES.md](../RELEASE_NOTES.md)
and [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md) is a table row with one status from the
closed vocabulary `LIVE`, `PARTIAL`, `PLANNED`, `NOT_STARTED` and typed evidence
(`commit:`, `test:`, `script:`, `screenshot:`, `smoke:`, `issue:`). `npm run evidence:check`
exits `1` for an invalid status, `2` for unresolved evidence, `3` for a broken link and
`4` for a planned capability described as live; the release gate runs it as a blocking
step. The ledger update is part of the release procedure, and the board's `Delivered` /
`Release Evidence` fields are filled from the manifest, never from a plan. History is
annotated, never deleted.

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
