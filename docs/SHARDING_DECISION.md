# NARIMATO — Sharding decision record (OPS-05)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](DEFINITION_OF_DONE.md) · [Issue index](ISSUE_MAP.md).
> This document owns the durable scale decision; it does not track delivery status.
>
> **Related delivery issues:** [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) · [OPS-02](https://github.com/moldovancsaba/narimato/issues/39) · [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) · [REL-01](https://github.com/moldovancsaba/narimato/issues/45)
<!-- delivery-ssot:end -->

This is the decision gate for NARIMATO's scale topology, not a sharding implementation. It records
the measured headroom, the numeric triggers that would reopen the question, the evidence required
before any split, and the migration and rollback shape. The current topology stays as it is.

## Decision

| Field | Value |
|---|---|
| Decision | **NOT NOW** — keep the single authoritative Node process |
| Gate verdict for the measured capture | **HOLD** |
| Evidence capture | `observability/scale-capture-ops02.json` |
| Threshold source | `observability/slo.json` (the only numeric threshold source) |
| Decision input | `observability/scale-profile.json` |
| Evidence commit | `32e7f5b` (OPS-02 measurement, 2026-11-20; non-production laptop run) |
| Owner | `platform-ops` (role; mapped by the on-call rota) |
| Review date | 2027-02-21 |

<!-- scale-decision:start -->
```json
{
  "decision": "NOT NOW",
  "verdict": "HOLD",
  "capture": "observability/scale-capture-ops02.json",
  "profile": "observability/scale-profile.json",
  "owner": "platform-ops",
  "reviewDate": "2027-02-21",
  "evidenceCommit": "32e7f5b"
}
```
<!-- scale-decision:end -->

The JSON block above is the machine-checkable twin of this record. `npm run check:scale` compares it
with the gate result, the ruleset, the profile and the measured capture; the test suite runs the same
check. Editing a number here without changing its source fails the check.

## Current topology

One `node server.js` process serves every planet room over HTTP and Server-Sent Events. The process
owns the static file server, `lib/metrics.js` and `lib/planet-manager.js`; the manager owns the
`registry.json` token-to-planet map and one `WorldCore` per planet, each with its own JSON world file.
SSE rooms are per planet and live in the same event loop. There is no gateway, no worker process, no
cross-room bus and no shared database. The full topology and module map are in
[ARCHITECTURE.md](../ARCHITECTURE.md#runtime-topology).

That shape is deliberately simple. It also means a room split adds a gateway, sticky routing,
token-to-worker resolution, a room-ownership map, cross-room broadcast and partial-failure handling.
Those are permanent operational costs, so they are justified only by measured headroom loss, not by a
schedule date.

## Measured headroom

The measured evidence is the OPS-02 gate run recorded in [LOAD_TEST.md](../LOAD_TEST.md#measured-results)
and PR #57. It ran on 2026-11-20 on an Apple arm64 laptop (M-series), Node v26.13.0, loopback, with a
single server process. It is **non-production** evidence: it cannot authorise a split.

| Scenario | Clients / SSE | Duration | Result |
|---|---|---|---|
| `smoke` | 30 / 15 | 10 s | HTTP p95 1 ms, loop p95 22.1 ms, 0 errors, 0 dropped |
| `load` (3 runs) | 100 / 40 | 60 s each | HTTP p95 1–2 ms, loop p95 22.1 ms, 0 errors, 0 dropped; worst join p95 3.08 ms, worst click p95 24.2 ms |
| `chaos` | 10 pilots / 5 SSE | SIGTERM + restart | world, players and tokens survived; 10/10 SSE streams reconnected, 24 ms max first event |
| `soak` | 40 / 20 | 120 min | not executed; the weekly soak job is the release prerequisite |

The capture records the worst value from the three `load` runs for each metric: HTTP p95 2 ms, loop
p95 22.135 ms, dropped SSE 0, request errors 0, RSS growth 13.48 MiB. The per-run values remain in
its `runs` array so the aggregation is auditable. The event-loop histogram resolution is 20 ms, so
loop p95 values are quantised (about 22.1 ms is the idle bucket, not a regression).

| Metric | Measured | SLO | Headroom |
|---|---|---|---|
| HTTP p95 | 2 ms | 150 ms | 98.7 % |
| Event-loop p95 | 22.135 ms | 50 ms | 55.7 % |
| RSS growth | 13.48 MiB | 96 MiB | 86.0 % |
| Dropped SSE | 0 | 0 | — |
| Request errors | 0 | 0 | — |

Read this honestly: HTTP latency has enormous headroom, but the event loop already uses about 44 % of
its SLO at 100 clients / 40 SSE on one laptop. The next section turns that into a trigger; it does not
turn a one-minute laptop run into a capacity proof.

## Trigger thresholds

The thresholds below are rendered from `observability/slo.json`; the watch line is the profile's
`triggerRatio` (0.6) applied to the SLO. A hard line is breached **above** the threshold; the watch
line is reached **at or above** it. SLO equality is healthy.

| Trigger | Rule id (source of truth) | Hard line | Watch line (60 %) |
|---|---|---|---|
| HTTP p95 | `http-p95` | 150 ms | 90 ms |
| Event-loop p95 | `loop-p95` | 50 ms | 30 ms |
| Dropped SSE | `sse-drop` | 0 | 0 |
| Request errors (5xx) | `gate.errors` | 0 | 0 |
| RSS growth over a 120-minute soak | `gate.rssGrowthMiB` | 96 MiB | 57.6 MiB |

The gate verdicts are:

- **HOLD** — every measured metric is below the watch line. Keep the single process.
- **WATCH** — a metric is at or above the watch line for a sustained capture, but no hard line is
  breached. Collect more evidence; do not start a split.
- **SPLIT** — a hard line is breached and the evidence set below is satisfied. This authorises a
  sharding design, not an automatic deployment.
- **MORE_EVIDENCE** — a required field is missing, the capture is stale, counters restarted, the
  window is too short, the capture is non-production, or a second independent capture is missing. The
  gate fails closed: it can never print `SPLIT` from one short or synthetic capture.

Run the gate on the current checkout with the explicit review commit; a capture whose commit is not
that commit is stale and returns `MORE_EVIDENCE`:

```bash
node scripts/scale-gate.mjs \
  --capture observability/scale-capture-ops02.json \
  --profile observability/scale-profile.json \
  --commit "$(git rev-parse --short HEAD)"
```

Without `--commit` the gate evaluates the capture as recorded, which is the mode used to reproduce
this record. `npm run check:scale` checks the record, not a live server.

## Required evidence before any split

No SPLIT verdict is actionable until all of the following are recorded against the release topology
and the same commit:

| ID | Evidence | Pass condition |
|---|---|---|
| E1 | 120-minute soak from the OPS-02 gate (`npm run gate:load -- --only=soak`, weekly job) | `GATE PASS` or a documented latency-only `GATE FLAKY` with 2 clean runs; 0 errors and 0 dropped SSE |
| E2 | Two independent production-like captures at the launch concurrency (200 clients / 80 SSE), each at least 15 minutes | Both captures independently return a hard-line breach; the gate reports `SPLIT` |
| E3 | Counter-reset check | Capture `uptimeMs` covers the whole capture window; no restart occurred mid-run |
| E4 | Cache and egress accounting for the capture window | Origin egress bytes per client-hour, edge cache hit ratio and compression are recorded; if they cannot be measured the result is `MORE_EVIDENCE`, not a pass |
| E5 | Chaos / reconnect evidence | Tokens, players and rooms survive a restart; every SSE stream reconnects inside the gate reconnect budget |
| E6 | Room ownership and planet skew | A token-to-room ownership map exists and the hottest room's share is recorded; if one hot room dominates the breach, room sharding is not the fix |
| E7 | Migration and rollback rehearsal | The gateway switch, drain and single-process restore were rehearsed on staging with the same data files |
| E8 | Owner sign-off | `platform-ops` records approval against this review date |

The launch concurrency is a planning input, not a measurement: 200 clients / 80 SSE is twice the
measured 100 / 40. The two-capture rule exists because one capture can be a host spike, a reconnect
storm or a saturated generator. A production-like capture on a quiet host is still not a phone-farm
proof; the record distinguishes what was measured from what was projected.

## Capacity model

The model is deliberately simple and is used only to decide what to measure next:

```text
headroomHttp = 1 - httpP95Ms / 150
headroomLoop = 1 - loopP95Ms / 50
projectedP95(c) = p95 * (c / measuredClients) ^ k, k in {1, 2}
```

At the measured 100 / 40 numbers, an HTTP p95 projection to 200 clients is 4 ms (k = 1) to 8 ms
(k = 2), still far below 150 ms. The event-loop projection is about 44 ms (k = 1) or 88 ms (k = 2)
against a 50 ms SLO. The k = 1 case crosses the 30 ms watch line (88.5 % of SLO); the k = 2 case
crosses the hard line. The 200 / 80 launch capture in E2 therefore decides the question; the model
does not.

RSS is bounded by the soak gate (96 MiB growth over 120 minutes) rather than projected from a
one-minute run. The 13.48 MiB load-run growth is context, not a leak proof.

## Migration outline

Only a `SPLIT` verdict with E1–E8 opens this work. The options are:

| Option | Shape | Cost | Use when |
|---|---|---|---|
| A — single process | Current topology | One process, one event loop, one JSON data dir | The measured gate is HOLD or WATCH |
| B — gateway + room sharding | Stateless gateway routes a room group to a worker; sticky SSE; token-to-worker registry | Gateway, drain, health, partial-failure handling | One room or a room group saturates the loop while other rooms are healthy |
| C — gateway + bus | B plus a cross-room event bus | Adds pub/sub delivery guarantees and replay rules | Global incidents or cross-room broadcast dominate the loop |
| D — persistence split | Shared database or partitioned store behind B/C | Schema, migration, consistency and rollback surface | JSON file size or write contention is the measured bottleneck |

The initial migration, if ever triggered, is B and only B:

1. **Freeze the evidence.** Store both E2 captures, the E1 soak artifact and the E4 accounting on the
   design issue; re-run the gate on the design commit.
2. **Add the gateway as a pass-through.** No protocol change, no new client route; health checks,
   request limits and SSE passthrough first.
3. **Build the room-ownership map.** Planet index to worker group, with the token-to-worker lookup
   served from the existing registry semantics; keep one owner per room.
4. **Move one room group.** Start the same `server.js` with the room assignment; keep JSON files
   per planet and the atomic write path unchanged.
5. **Canary one room.** Compare per-worker `/api/metrics`, reconnect behaviour and token routing
   against the single process; roll back on the first correctness failure.
6. **Add a bus or persistence split only if the post-split measurement still breaches.** Options C
   and D are separate decisions with their own evidence; they are not implied by B.
7. **Aggregate observability.** The existing SLOs are per process; define the aggregate and per-worker
   views before claiming the split fixed anything.

No gateway, worker, bus, sticky route, database or room assignment is implemented by this record.

## Rollback plan

The rollback is a topology switch, not a data migration, because the single process remains the
default and per-planet JSON files do not change shape:

- Keep the current `node server.js` path deployable and the single-process configuration as the
  default until the split has passed a full release gate.
- Route traffic back through the single process at the reverse proxy / tunnel; stop admitting new SSE
  streams to the gateway first, then drain existing streams within the documented reconnect budget.
- Do not delete worker data directories or rewrite `registry.json` during rollback; the single
  process reads the same per-planet files.
- Restore the previous process and verify: tokens resolve to the expected planet, `/api/state` and
  `/api/world` are intact, every client reconnects, and the SLO checker is green.
- Re-run the OPS-02 chaos test and the `npm run check:slo` contract after the switch.
- Record the actual rollback duration from the E7 rehearsal; this record does not claim a duration it
  has not measured.

Rollback rehearsal is an entry condition (E7), not a post-incident improvisation.

## Not now

The decision is **not now** for three measured reasons:

1. The measured OPS-02 gate run is `HOLD`: HTTP p95 2 ms against 150 ms and no dropped SSE or request
errors.
2. The event loop has 55.7 % headroom at 100 / 40, and the 200 / 80 projection is the next thing to
   measure, not a reason to build a gateway.
3. The only soak evidence is absent: the 120-minute soak is a release prerequisite and has not been
   executed. No split can be justified while the long-window behaviour is unmeasured.

Premature sharding would add a gateway, routing state and partial-failure modes to a system that is
currently within SLO. Waiting is bounded: this record is reviewed on **2027-02-21** by
**`platform-ops`**, and earlier if any of these happens:

- the gate returns `SPLIT` from the required two-capture evidence set;
- the release soak or a production incident shows a sustained hard-line breach;
- the launch forecast exceeds twice the measured concurrency for a sustained window;
- REL-01 requires a topology answer that the current evidence cannot give.

At review, either re-affirm `NOT NOW` with a new capture, or open the B design with E1–E8 complete.
The review date and owner are fields in `observability/scale-profile.json`; the checker fails if this
record and the profile disagree.

## How to check

```bash
npm test                         # includes test/sharding-decision.test.js
npm run check:scale              # decision record vs slo.json, profile and capture
npm run gate:load -- --only=smoke,load,chaos
node scripts/scale-gate.mjs --capture observability/scale-capture-ops02.json --profile observability/scale-profile.json
```

The gate is read-only: it reads a capture file, the profile and `observability/slo.json`, prints one
verdict and exits `0` HOLD, `1` WATCH, `2` SPLIT, `3` MORE_EVIDENCE. It never starts a server, writes
metrics or changes a room.

Related durable documents: [LOAD_TEST.md](../LOAD_TEST.md#gate-decision) owns the harness and the
measurement table; [OBSERVABILITY.md](../OBSERVABILITY.md#slo-ruleset-executable) owns the ruleset and
metric fields; [ARCHITECTURE.md](../ARCHITECTURE.md#runtime-topology) owns the topology.
