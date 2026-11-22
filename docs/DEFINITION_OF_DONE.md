# NARIMATO — Definition of Done

An issue is **Done** only when all applicable gates below pass. This document is the single
definition used by the board; [PROJECT_BOARD.md](PROJECT_BOARD.md) defines the workflow and
[ISSUE_INTAKE.md](ISSUE_INTAKE.md) defines how the issue is written.

## Universal gates (every issue)

- [ ] Every acceptance criterion in the issue is satisfied and demonstrably checked.
- [ ] `npm test` is green locally and in CI; new/changed behaviour has focused tests.
- [ ] The change is committed and pushed; the PR/commit references the issue.
- [ ] No unrelated scope, no drive-by refactor, no silent behaviour change.
- [ ] User-visible changes are verified visually (before/after screenshots) and protected behaviour is
      proven unchanged; see [GUARDRAILS.md](GUARDRAILS.md).
- [ ] Documentation is updated where knowledge changed; the issue lists exact paths.
- [ ] The issue body's `Delivered`, `Release Evidence`, `Documentation`, `Next` fields are filled.
- [ ] Known limitations and rollback/recovery are recorded when the change has operational risk.
- [ ] Board `Status = Done` and the issue is closed; dependent issues' Readiness is recomputed.

## Behaviour-protection gate (renderer, camera, controls, geometry, visual style)

- [ ] A baseline (commit + screenshots) of the working behaviour exists and is referenced.
- [ ] The change is the smallest path; no second renderer/canvas/scene/mesh and no render-only facets.
- [ ] Mouse point-follow, pole crossing and wheel/pinch are exercised; camera orientation is not
      overwritten per frame.
- [ ] Triangle/face count equals the active leaf count; the surface is opaque (no see-through).
- [ ] [FIXES.md](FIXES.md) updated for corrective work.

## UI / frontend gate (any DOM UI change)

- [ ] All UI is composed exclusively from the Sovereign Squad General Design System
  (`@sovereignsquad/gds`), stylesheet loaded once, one `GdsProvider`, no parallel component
  library, no custom CSS controls, no raw hex/px styling where a token exists.
- [ ] Every interactive state is designed: loading, empty, error, disabled, success.
- [ ] Screenshots or recordings at desktop, tablet, mobile portrait and mobile landscape.
- [ ] Canvas/WebGL visuals have an accessible DOM equivalent for anything that conveys information.
- [ ] GDS compliance check passes (adoption/compliance tooling where available).

## Accessibility gate

- [ ] Keyboard-only journey completes every task in the issue; focus is visible and trapped in
  overlays; Escape/close paths work.
- [ ] Screen-reader names/roles/state are correct; dynamic updates use appropriate live regions.
- [ ] axe serious/critical violations = 0 on the touched routes; contrast AA.
- [ ] 200% zoom and short viewports do not clip primary actions.
- [ ] `prefers-reduced-motion` is respected; no essential information is motion-only.
- [ ] Touch targets ≥ 44 px where applicable; no keyboard/pointer-only dead ends.
- [ ] Real-device evidence is attached when the issue is on the real-device gate path.

## Server / protocol gate

- [ ] Server remains authoritative; no client-fabricated resources, ownership, score or locks.
- [ ] Contracts validated: request/response/event shapes, error codes, ordering, idempotency.
- [ ] Timeouts, retries, backpressure and disconnect/reconnect paths are defined and tested.
- [ ] Concurrency/race cases have deterministic tests; partial failures are recoverable.
- [ ] Privacy: no tokens, tags, hidden deposits or PII in logs/metrics/telemetry payloads.
- [ ] Persistence changes use the atomic write path and survive restart; rollback documented.

## Operational gate

- [ ] Observability exists for the new behaviour: metrics/logs/events and the exact signal to watch.
- [ ] Failure modes map to a runbook action; alert thresholds are documented where relevant.
- [ ] Performance budgets are respected; no unbounded memory/CPU growth.
- [ ] Deploy/rollback procedure is written and (where runtime) rehearsed.
- [ ] No secret, credential or environment-specific value is committed.

## Documentation gate

- [ ] Durable knowledge updated in the owning document — not a status checklist in a doc.
- [ ] [ISSUE_MAP.md](ISSUE_MAP.md) mapping updated if a doc or issue key changed.
- [ ] `npm run docs:check` passes (links, issue references, version strings where checked).
- [ ] Release notes/evidence ledger updated only with verifiable claims.

## Release gate (M7 / REL-01)

- [ ] `npm run release:gate` was run on the delivery commit and its manifest is attached to the PR.
- [ ] The gate verdict is truthful: `GREEN` only when every code gate passed and no external
      prerequisite is open; otherwise `BLOCKED` or `RED`, with the blocking IDs named.
- [ ] `npm run evidence:check` passes; every `LIVE` claim in `README.md`, `RELEASE_NOTES.md` and
      [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md) has a resolvable reference.
- [ ] Version SSOT consistent across `package.json`, cache-bust query strings, README and docs.
- [ ] Full test matrix green (Node 20 and 22).
- [ ] Browser acceptance suite green; screenshots attached.
- [ ] Accessibility CI gate green; real-device gate signed.
- [ ] Load/soak/chaos gate green on the release topology; SLOs recorded.
- [ ] Docs link/issue check green; no orphan or deleted target.
- [ ] Release evidence table (commit, tests, artifacts, smoke) complete in
      [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md).
- [ ] Rollback drill executed and recorded (revert version + assets + data plan).

## Not Done

- A merged implementation with no acceptance evidence.
- A plan, estimate, or design document.
- A build that passes CI but was not exercised in the browser/device.
- "Partially working" with caveats not written on the issue.
- A capability described as live when it is gated on external credentials or unverified devices.

## Definition of Done for the board itself

The SSOT is healthy when: every open issue has a milestone, labels, a native dependency state and an
`Execution Order`; `Ready` issues have zero open blockers; `Done` issues have evidence fields; no
document mirrors mutable status; the issue map resolves 100%; and `npm run docs:check` is green.
