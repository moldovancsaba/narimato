# NARIMATO — Issue Map & Delivery Index

**Board:** [NARIMATO delivery SSOT](https://github.com/users/moldovancsaba/projects/80) · **Canonical standard:**
[sovereignsquad/general-design-system#81](https://github.com/sovereignsquad/general-design-system/issues/81)

This is the human-readable index of every delivery issue and every repository document it relates
to. The machine-readable twin is [issues.json](issues.json). Both are generated from the live board
state; do not hand-edit the tables — update the issue, then regenerate and commit.

The board owns delivery state. A document listed below owns durable knowledge for the issues linked
to it; it never restates their status.

## Milestones

| Milestone | Scope | Issues |
|---|---|---|
| M0 — SSOT & repository foundation | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 6 |
| M1 — GDS UI foundation & accessible surfaces | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 7 |
| M2 — Single-scene renderer | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 6 |
| M3 — Authoritative surface multiplayer | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 6 |
| M4 — Controls & camera correctness | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 6 |
| M5 — Events, story & audio | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 6 |
| M6 — Operations, scale & security | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 6 |
| M7 — Performance & release quality | See [PROJECT_BOARD.md](PROJECT_BOARD.md#milestones) | 3 |

## Issue index

| Key | Issue | Milestone | Order | Blocked by | Unlocks |
|---|---|---|---|---|---|
| [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | Governance: Delivery SSOT - board, issue templates, labels, and doc-to-issue map | M0 | 10 | — | [SSOT-02](https://github.com/moldovancsaba/narimato/issues/2), [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3), [SSOT-04](https://github.com/moldovancsaba/narimato/issues/4), [QA-01](https://github.com/moldovancsaba/narimato/issues/5), [DOC-01](https://github.com/moldovancsaba/narimato/issues/6), [UI-01](https://github.com/moldovancsaba/narimato/issues/7) |
| [SSOT-02](https://github.com/moldovancsaba/narimato/issues/2) | CI: Repository quality gate - docs link check, issue-reference lint, and test matrix | M0 | 20 | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3) | Release: Version SSOT - single version source and cache-bust synchronization | M0 | 30 | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [SSOT-04](https://github.com/moldovancsaba/narimato/issues/4) | Docs: Legacy delivery-doc retirement - migrate status backlogs into the issue SSOT | M0 | 15 | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [QA-01](https://github.com/moldovancsaba/narimato/issues/5) | Quality: Test-suite SSOT - dead-code removal, coverage map, and documentation count sync | M0 | 35 | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) | Docs: Architecture ADR and technical-doc maintenance - durable knowledge links to issues | M0 | 40 | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [UI-01](https://github.com/moldovancsaba/narimato/issues/7) | UI: GDS integration foundation - React island build, GdsProvider, and canvas/DOM boundary | M1 | 100 | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) | [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [UI-04](https://github.com/moldovancsaba/narimato/issues/10), [UI-05](https://github.com/moldovancsaba/narimato/issues/11), [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12) |
| [UI-02](https://github.com/moldovancsaba/narimato/issues/8) | UI: HUD migration - GDS mission, cargo, players, score, and target panels | M1 | 110 | [UI-01](https://github.com/moldovancsaba/narimato/issues/7) | [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [RND-03](https://github.com/moldovancsaba/narimato/issues/16) |
| [UI-03](https://github.com/moldovancsaba/narimato/issues/9) | UI: Overlay migration - landing, Field Manual, Guide, Report, and confirm dialogs | M1 | 120 | [UI-01](https://github.com/moldovancsaba/narimato/issues/7) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30) |
| [UI-04](https://github.com/moldovancsaba/narimato/issues/10) | UI: Surface HUD migration - GDS controls, target, lap, and exit surfaces | M1 | 130 | [UI-01](https://github.com/moldovancsaba/narimato/issues/7), [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [CTL-06](https://github.com/moldovancsaba/narimato/issues/31) |
| [UI-05](https://github.com/moldovancsaba/narimato/issues/11) | UI: Intro and interlude chrome migration - accessible cockpit cine controls | M1 | 140 | [UI-01](https://github.com/moldovancsaba/narimato/issues/7) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [EVT-02](https://github.com/moldovancsaba/narimato/issues/33) |
| [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12) | Accessibility: GDS conformance gate - axe, keyboard, focus, contrast, zoom, motion in CI | M1 | 150 | [UI-01](https://github.com/moldovancsaba/narimato/issues/7), [UI-02](https://github.com/moldovancsaba/narimato/issues/8) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) | Accessibility: Real-device gate - iPhone, Android, screen readers, audio, and 200% zoom | M1 | 700 | [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [UI-04](https://github.com/moldovancsaba/narimato/issues/10), [UI-05](https://github.com/moldovancsaba/narimato/issues/11), [CTL-06](https://github.com/moldovancsaba/narimato/issues/31), [AUD-01](https://github.com/moldovancsaba/narimato/issues/37), [STR-01](https://github.com/moldovancsaba/narimato/issues/35), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [RND-01](https://github.com/moldovancsaba/narimato/issues/14) | Renderer: Surface camera contract - shared projection interface for IcosaRenderer | M2 | 200 | — | [RND-02](https://github.com/moldovancsaba/narimato/issues/15) |
| [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | Renderer: Single-scene surface mode - remove the second renderer and switch camera only | M2 | 210 | [RND-01](https://github.com/moldovancsaba/narimato/issues/14) | [UI-04](https://github.com/moldovancsaba/narimato/issues/10), [RND-03](https://github.com/moldovancsaba/narimato/issues/16), [RND-04](https://github.com/moldovancsaba/narimato/issues/17), [RND-05](https://github.com/moldovancsaba/narimato/issues/18), [RND-06](https://github.com/moldovancsaba/narimato/issues/19), [RND-07](https://github.com/moldovancsaba/narimato/issues/24), [CTL-03](https://github.com/moldovancsaba/narimato/issues/28), [CTL-04](https://github.com/moldovancsaba/narimato/issues/29) |
| [RND-03](https://github.com/moldovancsaba/narimato/issues/16) | Renderer: HUD parity - one live DOM tree for orbit and surface | M2 | 220 | [RND-02](https://github.com/moldovancsaba/narimato/issues/15), [UI-02](https://github.com/moldovancsaba/narimato/issues/8) | [RND-06](https://github.com/moldovancsaba/narimato/issues/19) |
| [RND-04](https://github.com/moldovancsaba/narimato/issues/17) | Renderer: Live leaf mesh - rebuild surface geometry from authoritative cells | M2 | 230 | [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | [RND-06](https://github.com/moldovancsaba/narimato/issues/19), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| [RND-05](https://github.com/moldovancsaba/narimato/issues/18) | Renderer: 3D humanoid avatars - closed-triangle rigs with peer walk and mining animation | M2 | 240 | [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | [RND-06](https://github.com/moldovancsaba/narimato/issues/19) |
| [RND-06](https://github.com/moldovancsaba/narimato/issues/19) | Testing: Single-scene acceptance - camera-only proof, pixel parity, and performance | M2 | 250 | [RND-02](https://github.com/moldovancsaba/narimato/issues/15), [RND-03](https://github.com/moldovancsaba/narimato/issues/16), [RND-04](https://github.com/moldovancsaba/narimato/issues/17), [RND-05](https://github.com/moldovancsaba/narimato/issues/18) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) | Server: Surface pose authority - persist and broadcast human and robot poses | M3 | 300 | — | [SRV-02](https://github.com/moldovancsaba/narimato/issues/21), [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [SRV-04](https://github.com/moldovancsaba/narimato/issues/23) |
| [SRV-02](https://github.com/moldovancsaba/narimato/issues/21) | Server: Robot surface routing - server-generated waypoints and turns | M3 | 310 | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) | [SRV-03](https://github.com/moldovancsaba/narimato/issues/22) |
| [SRV-03](https://github.com/moldovancsaba/narimato/issues/22) | Server: Robot cell mapping - authoritative click and surface_mine events | M3 | 320 | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20), [SRV-02](https://github.com/moldovancsaba/narimato/issues/21) | [RND-07](https://github.com/moldovancsaba/narimato/issues/24), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| [SRV-04](https://github.com/moldovancsaba/narimato/issues/23) | Server: Supply focus relocation - place every human at the impact footprint | M3 | 330 | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) | [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| [RND-07](https://github.com/moldovancsaba/narimato/issues/24) | Renderer: Authoritative robot and resource visuals - beams and markers from events | M3 | 340 | [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | — |
| [TST-01](https://github.com/moldovancsaba/narimato/issues/25) | Testing: Two-client surface acceptance - pose, mine, supply, and live mutation | M3 | 350 | [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [SRV-04](https://github.com/moldovancsaba/narimato/issues/23), [RND-04](https://github.com/moldovancsaba/narimato/issues/17) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) | Controls: Orbit input SSOT - absolute drag, inverse travel, and explicit mode toggle | M4 | 400 | — | [CTL-02](https://github.com/moldovancsaba/narimato/issues/27), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30), [CTL-06](https://github.com/moldovancsaba/narimato/issues/31) |
| [CTL-02](https://github.com/moldovancsaba/narimato/issues/27) | Controls: Pole continuity and visibility - no direction flip or empty frame | M4 | 410 | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [CTL-03](https://github.com/moldovancsaba/narimato/issues/28) | Controls: Harvest truth - one canHarvest predicate with green/red and API round-trip | M4 | 420 | [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [CTL-04](https://github.com/moldovancsaba/narimato/issues/29) | Controls: Exit to farthest orbit - ORBIT_FAR_ZOOM and HUD restoration | M4 | 430 | [RND-02](https://github.com/moldovancsaba/narimato/issues/15) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [CTL-05](https://github.com/moldovancsaba/narimato/issues/30) | Controls: Mode indicator and persistence - visible current control mode | M4 | 440 | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26), [UI-03](https://github.com/moldovancsaba/narimato/issues/9) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [CTL-06](https://github.com/moldovancsaba/narimato/issues/31) | Controls: Touch parity - pads, pinch, surface steering, and safe areas | M4 | 450 | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26), [UI-04](https://github.com/moldovancsaba/narimato/issues/10) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |
| [EVT-01](https://github.com/moldovancsaba/narimato/issues/32) | Events: Incident scheduler - deterministic reachability and test trigger | M5 | 500 | — | [EVT-02](https://github.com/moldovancsaba/narimato/issues/33), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) |
| [EVT-02](https://github.com/moldovancsaba/narimato/issues/33) | Events: Five-tetra ship and incident visuals - consistent FX across all kinds | M5 | 510 | [EVT-01](https://github.com/moldovancsaba/narimato/issues/32), [UI-05](https://github.com/moldovancsaba/narimato/issues/11) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) | Accessibility: Incident feedback - announced outcomes, captions, and reduced motion | M5 | 520 | [EVT-01](https://github.com/moldovancsaba/narimato/issues/32) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [STR-01](https://github.com/moldovancsaba/narimato/issues/35) | Story: Voice cue pipeline - new beats, sentence clips, and cache-bust | M5 | 530 | — | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) |
| [STR-02](https://github.com/moldovancsaba/narimato/issues/36) | Story: Content SSOT - Guide, Field Manual, and Captain's Log copy contract | M5 | 540 | — | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) | Audio: Playback resilience - autoplay, interruption, watchdog, and prefetch | M5 | 550 | [STR-01](https://github.com/moldovancsaba/narimato/issues/35) | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |
| [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) | Ops: Observability SSOT - metrics, SLO alerts, and runbook | M6 | 600 | — | [OPS-02](https://github.com/moldovancsaba/narimato/issues/39), [OPS-04](https://github.com/moldovancsaba/narimato/issues/41), [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) |
| [OPS-02](https://github.com/moldovancsaba/narimato/issues/39) | Ops: Load, soak, and chaos gate - measured SLO thresholds in CI | M6 | 610 | [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) | [OPS-05](https://github.com/moldovancsaba/narimato/issues/42), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [OPS-03](https://github.com/moldovancsaba/narimato/issues/40) | Ops: Persistence recovery - backup, restore, and rollback runbook | M6 | 620 | — | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [OPS-04](https://github.com/moldovancsaba/narimato/issues/41) | Ops: Edge/CDN activation - asset base, cache policy, and rollback | M6 | 630 | [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) | Ops: Sharding decision gate - only on measured SLO breach | M6 | 640 | [OPS-02](https://github.com/moldovancsaba/narimato/issues/39) | — |
| [SEC-01](https://github.com/moldovancsaba/narimato/issues/43) | Security: Abuse and header hardening - origin policy, rate limits, and body caps | M6 | 650 | — | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) | Performance: Client budgets - frame timing, long tasks, and telemetry enforcement | M7 | 660 | [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [REL-01](https://github.com/moldovancsaba/narimato/issues/45) | Release: Acceptance gate - version, cache-bust, test matrix, and rollback proof | M7 | 800 | [SSOT-02](https://github.com/moldovancsaba/narimato/issues/2), [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3), [SSOT-04](https://github.com/moldovancsaba/narimato/issues/4), [QA-01](https://github.com/moldovancsaba/narimato/issues/5), [DOC-01](https://github.com/moldovancsaba/narimato/issues/6), [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [RND-06](https://github.com/moldovancsaba/narimato/issues/19), [TST-01](https://github.com/moldovancsaba/narimato/issues/25), [CTL-02](https://github.com/moldovancsaba/narimato/issues/27), [CTL-03](https://github.com/moldovancsaba/narimato/issues/28), [CTL-04](https://github.com/moldovancsaba/narimato/issues/29), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30), [EVT-02](https://github.com/moldovancsaba/narimato/issues/33), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34), [STR-02](https://github.com/moldovancsaba/narimato/issues/36), [OPS-02](https://github.com/moldovancsaba/narimato/issues/39), [OPS-03](https://github.com/moldovancsaba/narimato/issues/40), [OPS-04](https://github.com/moldovancsaba/narimato/issues/41), [SEC-01](https://github.com/moldovancsaba/narimato/issues/43), [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) | [REL-02](https://github.com/moldovancsaba/narimato/issues/46) |
| [REL-02](https://github.com/moldovancsaba/narimato/issues/46) | Docs: Release evidence ledger - shipped claims backed by commits, tests, and smoke | M7 | 810 | [REL-01](https://github.com/moldovancsaba/narimato/issues/45) | — |

## Documents → related issues

| Document | What it owns | Related issues |
|---|---|---|
| [README.md](../README.md) | Product entry point, quick start, feature overview, delivery links. | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1), [SSOT-02](https://github.com/moldovancsaba/narimato/issues/2), [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3), [SSOT-04](https://github.com/moldovancsaba/narimato/issues/4), [UI-01](https://github.com/moldovancsaba/narimato/issues/7), [REL-02](https://github.com/moldovancsaba/narimato/issues/46) |
| [AGENTS.md](../AGENTS.md) | Agent working rules: issue-first, GDS-only UI, evidence, dependency order. | — |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Stack, runtime topology, modules, data model, protocols, deployment. | [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1), [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3), [QA-01](https://github.com/moldovancsaba/narimato/issues/5), [DOC-01](https://github.com/moldovancsaba/narimato/issues/6), [UI-01](https://github.com/moldovancsaba/narimato/issues/7), [RND-06](https://github.com/moldovancsaba/narimato/issues/19), [SRV-01](https://github.com/moldovancsaba/narimato/issues/20), [TST-01](https://github.com/moldovancsaba/narimato/issues/25), [EVT-01](https://github.com/moldovancsaba/narimato/issues/32), [OPS-01](https://github.com/moldovancsaba/narimato/issues/38), [OPS-03](https://github.com/moldovancsaba/narimato/issues/40), [OPS-05](https://github.com/moldovancsaba/narimato/issues/42), [SEC-01](https://github.com/moldovancsaba/narimato/issues/43), [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) |
| [RECOVERY.md](RECOVERY.md) | DATA_DIR backup/verify/restore runbook, RPO/RTO, quarantine, reconciliation, rollback. | [OPS-03](https://github.com/moldovancsaba/narimato/issues/40), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [ALGORITHM.md](../ALGORITHM.md) | Spherical geometry, subdivision, hierarchical labels, picking. | [DOC-01](https://github.com/moldovancsaba/narimato/issues/6), [RND-01](https://github.com/moldovancsaba/narimato/issues/14) |
| [narimato-physics.md](../narimato-physics.md) | Authoritative camera/rendering model and failure history. | [QA-01](https://github.com/moldovancsaba/narimato/issues/5), [DOC-01](https://github.com/moldovancsaba/narimato/issues/6), [RND-01](https://github.com/moldovancsaba/narimato/issues/14), [CTL-01](https://github.com/moldovancsaba/narimato/issues/26), [CTL-02](https://github.com/moldovancsaba/narimato/issues/27) |
| [GAMEPLAY.md](../GAMEPLAY.md) | Player-facing game rules, controls, missions, surface mode, incidents. | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [SRV-02](https://github.com/moldovancsaba/narimato/issues/21), [SRV-04](https://github.com/moldovancsaba/narimato/issues/23), [RND-07](https://github.com/moldovancsaba/narimato/issues/24), [CTL-04](https://github.com/moldovancsaba/narimato/issues/29), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30), [EVT-02](https://github.com/moldovancsaba/narimato/issues/33), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34), [STR-02](https://github.com/moldovancsaba/narimato/issues/36) |
| [GUIDE.md](../GUIDE.md) | Shareable new-pilot quick guide. | [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30), [STR-02](https://github.com/moldovancsaba/narimato/issues/36) |
| [VOICE.md](../VOICE.md) | Narration profiles, generation pipeline, licensing. | [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [STR-01](https://github.com/moldovancsaba/narimato/issues/35), [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) |
| [A11Y_CHECKLIST.md](../A11Y_CHECKLIST.md) | Accessibility/device audit checklist and known risks. | [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [UI-04](https://github.com/moldovancsaba/narimato/issues/10), [UI-05](https://github.com/moldovancsaba/narimato/issues/11), [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [CTL-06](https://github.com/moldovancsaba/narimato/issues/31), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [UX_AUDIT.md](../UX_AUDIT.md) | Elephant–goldfish UX audit evidence and remediation history. | [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |
| [OBSERVABILITY.md](../OBSERVABILITY.md) | Metrics, telemetry, SLOs and privacy contract. | [AUD-01](https://github.com/moldovancsaba/narimato/issues/37), [OPS-01](https://github.com/moldovancsaba/narimato/issues/38), [OPS-05](https://github.com/moldovancsaba/narimato/issues/42), [SEC-01](https://github.com/moldovancsaba/narimato/issues/43), [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) |
| [LOAD_TEST.md](../LOAD_TEST.md) | Load/soak/chaos harness, measurements and scale gate. | [OPS-02](https://github.com/moldovancsaba/narimato/issues/39), [OPS-05](https://github.com/moldovancsaba/narimato/issues/42), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [docs/SHARDING_DECISION.md](SHARDING_DECISION.md) | Scale/sharding decision: measured headroom, numeric triggers, evidence set, migration and rollback. | [OPS-02](https://github.com/moldovancsaba/narimato/issues/39), [OPS-05](https://github.com/moldovancsaba/narimato/issues/42), [REL-01](https://github.com/moldovancsaba/narimato/issues/45) |
| [EDGE_DEPLOYMENT.md](../EDGE_DEPLOYMENT.md) | CDN/edge asset delivery contract and activation checklist. | [OPS-04](https://github.com/moldovancsaba/narimato/issues/41) |
| [PLANET_RESEARCH.md](../PLANET_RESEARCH.md) | Procedural planet surface research and calibration. | [RND-05](https://github.com/moldovancsaba/narimato/issues/18) |
| [RELEASE_NOTES.md](../RELEASE_NOTES.md) | Shipped-release ledger and migration notes. | [QA-01](https://github.com/moldovancsaba/narimato/issues/5), [REL-01](https://github.com/moldovancsaba/narimato/issues/45), [REL-02](https://github.com/moldovancsaba/narimato/issues/46) |
| [SPEC.md](../SPEC.md) | Frozen build spec and interface contract (historical authority). | [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [RND-03](https://github.com/moldovancsaba/narimato/issues/16) |
| [SPEC_INFINITE.md](../SPEC_INFINITE.md) | Frozen infinite-grid server/client protocol contract. | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20), [SRV-03](https://github.com/moldovancsaba/narimato/issues/22) |
| [SPEC_PLANET.md](../SPEC_PLANET.md) | Frozen planet surface/terrain layer contract. | [RND-02](https://github.com/moldovancsaba/narimato/issues/15), [RND-04](https://github.com/moldovancsaba/narimato/issues/17) |
| [SPEC_PLANETS.md](../SPEC_PLANETS.md) | Frozen multi-planet progression contract. | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) |
| [SPEC_RESOURCES.md](../SPEC_RESOURCES.md) | Frozen resource/mining layer contract. | [CTL-03](https://github.com/moldovancsaba/narimato/issues/28) |
| [docs/SSOT.md](SSOT.md) | Delivery SSOT entry point and non-negotiable rules. | [SSOT-02](https://github.com/moldovancsaba/narimato/issues/2), [DOC-01](https://github.com/moldovancsaba/narimato/issues/6), [REL-02](https://github.com/moldovancsaba/narimato/issues/46) |
| [docs/PROJECT_BOARD.md](PROJECT_BOARD.md) | Board fields, statuses, readiness, views, operating routine. | — |
| [docs/DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) | The only definition of done and release gate. | — |
| [docs/ISSUE_INTAKE.md](ISSUE_INTAKE.md) | Issue authoring standard and anti-patterns. | — |
| [docs/TEST_MAP.md](TEST_MAP.md) | Test file to behaviour, module and issue ownership map. | [QA-01](https://github.com/moldovancsaba/narimato/issues/5) |
| [docs/adr/README.md](adr/README.md) | Architecture decision index and conventions. | [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) |
| [docs/adr/TEMPLATE.md](adr/TEMPLATE.md) | ADR authoring template. | — |
| [docs/GDS_INTEGRATION.md](GDS_INTEGRATION.md) | GDS island build pipeline, provider/portal model, flags, budgets, accessibility evidence and rollback. | [UI-01](https://github.com/moldovancsaba/narimato/issues/7), [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [UI-04](https://github.com/moldovancsaba/narimato/issues/10), [UI-05](https://github.com/moldovancsaba/narimato/issues/11), [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12) |

## Legacy backlog mapping (retired by SSOT-04)

The former `DELIVERY_TASKS.md`, `REQUESTS_24H.md` and `ROADMAP.md` backlogs are fully dispositioned
below. Every engineering rule that still applies is durable in a repository document; every
unfinished item maps to an issue key. Delivered behaviour needs no new issue and remains documented
in `ARCHITECTURE.md`, `GAMEPLAY.md` and `RELEASE_NOTES.md`. Dropped rules are listed so they are not
reintroduced.

| Legacy item | Source | Disposition | Destination |
|---|---|---|---|
| D1 | DELIVERY_TASKS.md | issue | [RND-01](https://github.com/moldovancsaba/narimato/issues/14), [RND-02](https://github.com/moldovancsaba/narimato/issues/15) |
| D2 | DELIVERY_TASKS.md | issue | [RND-03](https://github.com/moldovancsaba/narimato/issues/16), [RND-05](https://github.com/moldovancsaba/narimato/issues/18), [UI-04](https://github.com/moldovancsaba/narimato/issues/10) |
| D3 | DELIVERY_TASKS.md | issue | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20), [SRV-02](https://github.com/moldovancsaba/narimato/issues/21), [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| D4 | DELIVERY_TASKS.md | issue | [SRV-04](https://github.com/moldovancsaba/narimato/issues/23), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| D5 | DELIVERY_TASKS.md | issue | [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [RND-07](https://github.com/moldovancsaba/narimato/issues/24) |
| D6 | DELIVERY_TASKS.md | issue | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30) |
| D7 | DELIVERY_TASKS.md | issue | [CTL-02](https://github.com/moldovancsaba/narimato/issues/27) |
| D8 | DELIVERY_TASKS.md | issue | [CTL-03](https://github.com/moldovancsaba/narimato/issues/28) |
| D9 | DELIVERY_TASKS.md | issue | [CTL-04](https://github.com/moldovancsaba/narimato/issues/29) |
| D10 | DELIVERY_TASKS.md | issue | [EVT-01](https://github.com/moldovancsaba/narimato/issues/32), [EVT-02](https://github.com/moldovancsaba/narimato/issues/33), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) |
| D11 | DELIVERY_TASKS.md | issue | [RND-03](https://github.com/moldovancsaba/narimato/issues/16), [UI-04](https://github.com/moldovancsaba/narimato/issues/10) |
| D12 | DELIVERY_TASKS.md | issue | [STR-01](https://github.com/moldovancsaba/narimato/issues/35), [AUD-01](https://github.com/moldovancsaba/narimato/issues/37), [STR-02](https://github.com/moldovancsaba/narimato/issues/36) |
| D13 | DELIVERY_TASKS.md | issue | [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13), [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) |
| D14 | DELIVERY_TASKS.md | issue | [OPS-04](https://github.com/moldovancsaba/narimato/issues/41), [OPS-05](https://github.com/moldovancsaba/narimato/issues/42), [OPS-02](https://github.com/moldovancsaba/narimato/issues/39) |
| D15 | DELIVERY_TASKS.md | issue | [RND-05](https://github.com/moldovancsaba/narimato/issues/18) |
| D16 | DELIVERY_TASKS.md | issue | [RND-04](https://github.com/moldovancsaba/narimato/issues/17), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| req-1 | REQUESTS_24H.md | issue | [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [STR-02](https://github.com/moldovancsaba/narimato/issues/36) |
| req-2 | REQUESTS_24H.md | issue | [SRV-04](https://github.com/moldovancsaba/narimato/issues/23), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| req-3 | REQUESTS_24H.md | durable → GAMEPLAY.md | `GAMEPLAY.md` |
| req-4 | REQUESTS_24H.md | durable → GAMEPLAY.md | `GAMEPLAY.md` |
| req-5 | REQUESTS_24H.md | issue | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) |
| req-6 | REQUESTS_24H.md | issue | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) |
| req-7 | REQUESTS_24H.md | issue | [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) |
| req-8 | REQUESTS_24H.md | issue | [CTL-02](https://github.com/moldovancsaba/narimato/issues/27) |
| req-9 | REQUESTS_24H.md | durable → GAMEPLAY.md | `GAMEPLAY.md` |
| req-10 | REQUESTS_24H.md | issue | [CTL-01](https://github.com/moldovancsaba/narimato/issues/26), [CTL-05](https://github.com/moldovancsaba/narimato/issues/30) |
| req-11 | REQUESTS_24H.md | issue | [EVT-03](https://github.com/moldovancsaba/narimato/issues/34), [STR-02](https://github.com/moldovancsaba/narimato/issues/36) |
| req-12 | REQUESTS_24H.md | issue | [STR-02](https://github.com/moldovancsaba/narimato/issues/36) |
| req-13 | REQUESTS_24H.md | durable → GAMEPLAY.md | `GAMEPLAY.md` |
| req-14 | REQUESTS_24H.md | issue | [SRV-04](https://github.com/moldovancsaba/narimato/issues/23), [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| req-15 | REQUESTS_24H.md | issue | [EVT-02](https://github.com/moldovancsaba/narimato/issues/33) |
| req-16 | REQUESTS_24H.md | issue | [RND-05](https://github.com/moldovancsaba/narimato/issues/18) |
| req-17 | REQUESTS_24H.md | issue | [RND-04](https://github.com/moldovancsaba/narimato/issues/17) |
| req-18 | REQUESTS_24H.md | issue | [RND-02](https://github.com/moldovancsaba/narimato/issues/15) |
| req-19 | REQUESTS_24H.md | issue | [RND-03](https://github.com/moldovancsaba/narimato/issues/16), [UI-02](https://github.com/moldovancsaba/narimato/issues/8) |
| req-20 | REQUESTS_24H.md | issue | [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [UI-04](https://github.com/moldovancsaba/narimato/issues/10) |
| req-21 | REQUESTS_24H.md | issue | [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [RND-07](https://github.com/moldovancsaba/narimato/issues/24) |
| req-22 | REQUESTS_24H.md | issue | [SRV-02](https://github.com/moldovancsaba/narimato/issues/21), [SRV-03](https://github.com/moldovancsaba/narimato/issues/22) |
| req-23 | REQUESTS_24H.md | issue | [RND-04](https://github.com/moldovancsaba/narimato/issues/17) |
| req-24 | REQUESTS_24H.md | issue | [RND-04](https://github.com/moldovancsaba/narimato/issues/17) |
| req-25 | REQUESTS_24H.md | superseded → RND-03 | `RND-03` |
| req-26 | REQUESTS_24H.md | issue | [UI-04](https://github.com/moldovancsaba/narimato/issues/10), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |
| req-27 | REQUESTS_24H.md | durable → GAMEPLAY.md | `GAMEPLAY.md` |
| req-28 | REQUESTS_24H.md | issue | [CTL-02](https://github.com/moldovancsaba/narimato/issues/27) |
| req-29 | REQUESTS_24H.md | issue | [CTL-03](https://github.com/moldovancsaba/narimato/issues/28) |
| req-30 | REQUESTS_24H.md | issue | [CTL-03](https://github.com/moldovancsaba/narimato/issues/28) |
| req-31 | REQUESTS_24H.md | issue | [CTL-04](https://github.com/moldovancsaba/narimato/issues/29) |
| req-32 | REQUESTS_24H.md | issue | [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) |
| req-33 | REQUESTS_24H.md | issue | [SSOT-04](https://github.com/moldovancsaba/narimato/issues/4) |
| req-35 | REQUESTS_24H.md | issue | [TST-01](https://github.com/moldovancsaba/narimato/issues/25) |
| phase-1 | ROADMAP.md | issue | [RND-01](https://github.com/moldovancsaba/narimato/issues/14), [RND-02](https://github.com/moldovancsaba/narimato/issues/15), [RND-03](https://github.com/moldovancsaba/narimato/issues/16), [RND-06](https://github.com/moldovancsaba/narimato/issues/19) |
| phase-2 | ROADMAP.md | issue | [SRV-01](https://github.com/moldovancsaba/narimato/issues/20), [SRV-02](https://github.com/moldovancsaba/narimato/issues/21), [SRV-03](https://github.com/moldovancsaba/narimato/issues/22), [RND-07](https://github.com/moldovancsaba/narimato/issues/24) |
| phase-3 | ROADMAP.md | issue | [CTL-03](https://github.com/moldovancsaba/narimato/issues/28), [RND-07](https://github.com/moldovancsaba/narimato/issues/24) |
| phase-4 | ROADMAP.md | issue | [STR-01](https://github.com/moldovancsaba/narimato/issues/35), [AUD-01](https://github.com/moldovancsaba/narimato/issues/37), [EVT-03](https://github.com/moldovancsaba/narimato/issues/34), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |
| phase-5 | ROADMAP.md | issue | [OPS-01](https://github.com/moldovancsaba/narimato/issues/38), [OPS-02](https://github.com/moldovancsaba/narimato/issues/39), [OPS-03](https://github.com/moldovancsaba/narimato/issues/40), [OPS-04](https://github.com/moldovancsaba/narimato/issues/41), [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) |
| plan-A0 | DELIVERY_PLAN.md | issue | [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [UI-02](https://github.com/moldovancsaba/narimato/issues/8) |
| plan-A1 | DELIVERY_PLAN.md | issue | [UI-02](https://github.com/moldovancsaba/narimato/issues/8) |
| plan-A2 | DELIVERY_PLAN.md | issue | [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [UI-05](https://github.com/moldovancsaba/narimato/issues/11) |
| plan-A3 | DELIVERY_PLAN.md | issue | [UI-02](https://github.com/moldovancsaba/narimato/issues/8), [UI-03](https://github.com/moldovancsaba/narimato/issues/9), [CTL-06](https://github.com/moldovancsaba/narimato/issues/31) |
| plan-A4 | DELIVERY_PLAN.md | issue | [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12), [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) |
| plan-B0 | DELIVERY_PLAN.md | issue | [OPS-01](https://github.com/moldovancsaba/narimato/issues/38), [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) |
| plan-B1 | DELIVERY_PLAN.md | issue | [OPS-04](https://github.com/moldovancsaba/narimato/issues/41) |
| plan-B2 | DELIVERY_PLAN.md | issue | [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) |
| plan-B3 | DELIVERY_PLAN.md | issue | [OPS-02](https://github.com/moldovancsaba/narimato/issues/39) |
| plan-B4 | DELIVERY_PLAN.md | dropped | `EDGE_DEPLOYMENT.md` |
| dropped-solo-farming | Solo own-cell farming (reverted v3.22) | dropped | `own-lock contest rule in ARCHITECTURE.md` |
| dropped-optical-zoom | Optical zoom / scaled projection | dropped | `fixed-focal dolly in narimato-physics.md` |
| dropped-euler-camera | Euler/clamped pitch camera | dropped | `carrier pos+up in narimato-physics.md` |
| dropped-canvas-frontback | Canvas2D front/back rendering | dropped | `WebGL front-surface shader in narimato-physics.md` |
| dropped-cached-planet | Cached planet copy / generated surface mesh | dropped | `live leaf tree rule in ARCHITECTURE.md` |
| dropped-auto-zoom | Automatic zoom on click/break | dropped | `manual-only zoom in GAMEPLAY.md` |
| dropped-p2p-assets | Peer-assisted assets before CDN measurements | dropped | `EDGE_DEPLOYMENT.md gate` |
| dropped-sharding | Shard split before a measured SLO breach | dropped | `LOAD_TEST.md / OPS-05 gate` |

## Issue-health rule

Every issue is mapped to at least one repository document.
A document with no related issue must either justify that it is purely historical (release notes,
frozen specs) or be retired by SSOT-04. GDS #81 standard applies to every issue on the board.

