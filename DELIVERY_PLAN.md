# NARIMATO — Delivery Plan: Hybrid Scaling + UX Reliability

**Decision:** keep the **authoritative server** for world state; scale it with room sharding,
observability and edge asset delivery. P2P is reserved for **non-authoritative asset
delivery** only. Do not move resources, hidden ore, contest locks or the leaderboard onto
clients.

This plan is deliberately staged: fix the player-facing blockers first, measure real load,
then shard. No distributed system should be built before the first metrics exist.

---

## Track A — UX reliability (start now)

**Goal:** no unreadable/blocked UI at the supported viewport matrix; first-five-seconds
clarity.

**Status (v3.9.0):** A0–A3 delivered and audit-clean; A4 keyboard/aria and automated
accessible-name checks delivered, real-device pass remains; **B0 observability delivered**.
Next: A4 real-device gate, then B1 edge/CDN assets.

**Delivery addendum (2026-11-18):**
- A4 automated/WebKit + keyboard checks delivered; manual real-device checklist is in
  `A11Y_CHECKLIST.md` (not executable headlessly).
- B1 CDN-ready asset base and edge deployment guide delivered (`EDGE_DEPLOYMENT.md`);
  external CDN activation needs credentials.
- B3 load/soak/chaos harness delivered (`LOAD_TEST.md`); chaos restart is clean.
- A4 axe-core WCAG audit is clean in Chromium and WebKit; manual real devices remain listed in
  `A11Y_CHECKLIST.md`.
- B2 is **not started** because measured single-node SLOs are healthy; B4 is **not started**
  because there is no sustained CDN egress/miss signal to justify peer-assisted assets.

### A0. Audit harness (0.5 day)

- Commit `scripts/audit-ui.mjs` (Playwright) running the nine-viewport matrix.
- Assertions:
  - no unexpected intersections among HUD regions, nav, score, target, dock;
  - overlays' primary actions in viewport or scrollable;
  - no document horizontal overflow;
  - no console errors;
  - subtitles do not intersect target/manual/steer-pad regions.
- Run in CI as a separate non-blocking job first, then block on it.

### A1. Top HUD geometry (1 day)

- Make the status cluster **icon-only** with accessible labels/tooltips, or move secondary
  controls into a settings sheet.
- Relocate `planet-badge` out of the action cluster (brand/identity row) so the centered
  score is never covered.
- Move `nav-chip` below the score (safe top offset) and test at 1024/900/844/792/390.
- Acceptance: score, planet name, nav target all readable; no collisions at every
  viewport in the matrix.

### A2. Overlay layering + short-screen safety (1–1.5 days)

- `.landing-brief` and `.escape-cta`: scrollable full-screen overlays (`overflow-y:auto`,
  start-aligned, bottom padding); primary button reachable by touch/keyboard at 302 px.
- Subtitle safe zones:
  - target inspector visible → raise subtitle bar;
  - manual open → reserve bottom space in manual card;
  - intro active on mobile → place caption clear of steering pads (or move pads).
- Hide/compact duplicated hint bar when subtitle bar is active.
- Acceptance: E2–E6 closed; CTA/brief keyboard reachable.

### A3. Responsive hierarchy + first five seconds (1 day)

- Mobile/landscape top row: score first; planet identity second; actions in an overflow
  sheet. Keep CC/VOX visible (accessibility) but labelled.
- Touch targets ≥44 px for primary controls.
- Make “voice starts on tap” explicit.
- Landing primary action above the fold on short screens.
- Acceptance: goldfish items 1–7 addressed.

### A4. Accessibility pass (0.5–1 day)

- Focus visibility/order for all overlays; Escape closes briefing/escape/manual.
- Screen-reader pass on planet badge, mission/cargo, subtitles, manual.
- Contrast check on muted/disabled text.
- Real iOS Safari + Android Chrome smoke test.

**Track A release:** v3.9.0 “Readable Skies” after A1–A4; UX_AUDIT must be re-run clean.

---

## Track B — Hybrid scaling

### B0. Observability first (1–2 days)

Add a lightweight metrics surface (no npm dependencies):

- HTTP request count/latency p50/p95/p99; active SSE streams per planet;
- events/sec, state bytes/sec, room fan-out; event-loop delay; heap;
- bot ticks/clicks; planet load/unload; reconnect/error counters;
- client Web Vitals + audio startup time + HUD long tasks (beacon).

Dashboards/log queries and alert thresholds:
- p95 API < 150 ms; SSE state latency < 250 ms; event-loop delay p95 < 50 ms;
- no room with > N dropped clients; audio first-word < 300 ms cached, < 1 s cold.

**Gate:** if current single node is below these at expected concurrency, stop after B1;
do not shard prematurely.

### B1. Edge asset delivery (1 day)

- Move narration/audio/images to a CDN/edge cache (assets already immutable + versioned).
- Keep first-sentence warmup; optional range support for audio.
- Measure asset bytes and cache hit ratio.
- P2P asset cache is **not** in this phase.

### B2. Authoritative sharding (3–5 days)

When metrics require it:

- **Stateless gateway**: auth/token → planet index; HTTP + SSE routing; no world state.
- **Planet workers**: each owns a set of planets; one live owner per planet; sticky SSE.
- **Registry/lookup**: token→planet directory shared across gateway/workers; lease-based
  ownership with failover.
- **Persistence**: snapshot + event sequence per planet; restore on worker move; no split
  brain (owner lease).
- **Reconnect**: same token returns to the same planet; clients see no difference.
- Keep bots and click validation inside the worker.

**Acceptance:** load test with N concurrent SSE clients and rooms; zero lost writes; p95
targets met; worker restart resumes world; no duplicate ownership.

### B3. Load test + rollout (1–2 days)

- Node-based load generator (no external dependency) for join/click/SSE/reconnect.
- Soak test 1–2 h; chaos: kill worker, partition network, reconnect storm.
- Canary one worker/planet class; rollback to single node.
- Ops runbook: drain, failover, restore snapshot, incident checklist.

### B4. Optional peer-assisted assets (spike, 2–3 days, only if B1 traffic warrants)

- WebRTC/WebTorrent-style **asset** cache with server fallback.
- Never authoritative; no game state, inventory, hidden deposits or scores over P2P.
- Success criterion: reduced CDN egress without increased first-word latency.
- Kill the project if TURN/relay or churn costs exceed savings.

---

## Explicit non-goals

- P2P-authoritative worlds, resources, hidden ore, contest locks or leaderboard.
- Client-hosted planets without a trusted verifier.
- Blockchain/token economies.
- Full mesh rooms.
- Rewriting the working game loop to prove a distributed idea.

---

## Timeline (small team, one full-stack + one UX)

| Week | Deliverable |
|---|---|
| 1 | A0 audit harness, A1 top HUD hotfix, v3.9.0 start |
| 2 | A2 overlay safety, A3 hierarchy, A4 accessibility; Track A release |
| 3 | B0 metrics + SLOs; B1 CDN/edge assets |
| 4 | B2 sharding prototype + registry/lease |
| 5 | B3 load/soak/chaos + rollout plan |
| 6 (optional) | B4 peer-assisted asset spike |

## Release gates

- UX_AUDIT clean on all nine viewports + real-device smoke.
- CI green; no new console errors; no regressions in 76+ tests.
- Metrics dashboards live; rollback tested.
- A/B or canary for sharding; single-node remains the fallback.

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| Sharding before load warrants it | B0 gate; stop at B1 if below SLOs |
| SSE reconnect storms | token routing, backoff, sticky rooms, load test |
| State split-brain on worker move | lease ownership + snapshot seq, one writer |
| P2P asset complexity | optional spike only, server fallback |
| UX regressions while refactoring | A0 visual assertions in CI |
| Voice/assets cold start | prefetch first sentences, immutable cache, CDN |

## First next actions

1. Approve Track A scope; implement A0 harness + A1 score fix in one PR.
2. Add B0 metrics endpoint/collector (read-only) in parallel.
3. Re-run audit after A1; then A2 overlays.
