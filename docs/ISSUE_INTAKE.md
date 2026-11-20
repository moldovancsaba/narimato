# NARIMATO — Issue Intake & Authoring Standard

Every issue on the delivery board is an independently executable, production-grade specification.
The canonical example is [sovereignsquad/general-design-system#81](https://github.com/sovereignsquad/general-design-system/issues/81);
read it before writing an issue.

## When to create an issue

| Situation | Action |
|---|---|
| New user-visible capability | `type:feature` issue before implementation |
| Defect/regression | `type:bug` issue with reproduction and expected behaviour |
| Architecture/contract change | `type:feature`/`type:spike` issue plus ADR link |
| Documentation/SSOT gap | `type:docs` issue |
| CI/test/ops hardening | `type:chore`/`type:test` issue |
| Investigation that produces a decision | `type:spike`, time-boxed, ending in a written decision |

An issue must trace to one of: a repository doc, a recorded request, a production/QA observation, a
failed test, or a board audit finding. Link the source in section 25.

## Title format

```text
[Domain]: [Capability] - [Technical Outcome]
```

Examples: `Renderer: Single-scene surface mode - remove the second renderer`,
`Accessibility: Real-device gate - iPhone, Android, screen readers, audio, and 200% zoom`.

One outcome per title. If the title needs "and" for unrelated capabilities, split it.

## Required body sections

Use the exact section set from GDS #81 (sections 1–23) plus the two project sections:

| Section | Must contain |
|---|---|
| Metadata block + §0 | Board, milestone, execution order, readiness, track, canonical standard, dependencies, unlocks, evidence |
| §1 Executive Summary | Capability, why, expected outcome, technical outcome |
| §2 Business / Product Context | User/operational problem, why now |
| §3 Current State | Real current architecture, files, flows, limitations |
| §4 Problem Statement | Measurable engineering problem |
| §5 Goals | Functional, technical, UX goals |
| §6 Non-Goals | Explicit scope exclusions |
| §7 Mandatory Technical Constraints | Design-system mandate + project constraints |
| §8 Architecture | Ownership, runtime flow, state transitions, storage |
| §9 Data Model / Contracts | Structures and invariants |
| §10 API Contracts | Request/response/event shapes or concrete N/A |
| §11 Algorithm / Processing Logic | Deterministic pseudo-code |
| §12 Mathematical / Ranking Logic | Formulas/scoring or concrete N/A |
| §13 UX / Operator Behaviour | Loading/empty/error/disabled/success, retries, visibility |
| §14 Accessibility Requirements | Concrete checks or concrete preservation statement |
| §15 Edge Cases | At least 5 real failure cases |
| §16 Performance Expectations | Numeric budgets, timeouts |
| §17 Security / Privacy | Auth, rate limits, secrets, PII or N/A |
| §18 Acceptance Criteria | Binary checkboxes by area |
| §19 Testing Requirements | Exact files/commands |
| §20 Documentation Requirements | Exact paths |
| §21 Handover Requirements | What changed, run, config, verify, limitations, rollback |
| §22 Delivery Expectations | Production-ready implementation + evidence |
| §23 Final Rule | GDS mandate is non-negotiable |
| §24 Dependencies & Execution Order | Blocked-by keys, unlocking keys |
| §25 Related Repository Documents | Real paths linked |

Sections that genuinely do not apply stay present and say
`Not applicable: <concrete reason>`. Omitting a heading is a defect.

## Quality rules

- 900–1600 words of specific content; no generic filler.
- Real file paths and real commands only (`npm test`, `node --test test/<file>`,
  `node scripts/<script>`, `npm run docs:check`).
- Contracts in JSON/TS/pseudo-code, not prose adjectives.
- Acceptance criteria are binary and can be checked by a reviewer without asking the author.
- No invented issue numbers, dates, evidence, URLs, assignees or hour estimates.
- UI issues must state the GDS-only rule in §7 and concrete accessibility checks in §14.
- Server issues must state authority, validation, timeout/retry and concurrency behaviour.
- Operational issues must state the signal, threshold, runbook action and rollback.

## Dependencies and sequencing

1. Create the issue with labels and milestone.
2. Add it to the project board; set `Execution Order`, `Roadmap Stage`, `Track`.
3. Add native **blocked-by** links (GitHub issue relationship), not prose-only dependencies.
4. Set `Readiness = Blocked` while any blocker is open; otherwise `Ready`.
5. Set `Status`: `Todo (NEXT)` when Ready, `Backlog (SOONER)` when Blocked, `Roadmap (LATER)` when
   deferred.
6. Update `Readiness`/`Status` for dependants whenever a blocker closes or reopens.

## Updating an issue

- Scope change: edit the issue body and add a comment explaining why; update dependants and locks.
- New evidence: append to `Delivered`/`Release Evidence`, never rewrite history.
- Blocked mid-delivery: keep `In Progress (NOW)` only if active; otherwise return to `Backlog` with
  the blocker recorded.
- Do not close an issue to "clean up" without meeting [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md).

## Anti-patterns (rejected)

- Umbrella issues ("finish the game", "improve UI"), multi-outcome bundles.
- Issues without acceptance criteria or with subjective criteria ("looks good").
- Duplicating status in repo docs; opening an issue that repeats a doc without a concrete outcome.
- Dependencies stated only in prose.
- A UI issue that does not name GDS components/patterns and accessibility criteria.
- Treating a build or a design as delivered.
