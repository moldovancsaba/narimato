# NARIMATO — Load / Soak / Chaos and the OPS-02 gate

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) · [OPS-02](https://github.com/moldovancsaba/narimato/issues/39) · [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) · [PERF-01](https://github.com/moldovancsaba/narimato/issues/44) · [REL-01](https://github.com/moldovancsaba/narimato/issues/45)
<!-- delivery-ssot:end -->

OPS-02 turns the load/soak/chaos harness into a reproducible gate: four committed
scenarios, one orchestrator, machine-readable artifacts and a scheduled CI job. The
generators keep their env-driven CLIs and add `--report <path>` for the orchestrator.

## One command

```sh
npm run gate:load -- --only=smoke
npm run gate:load -- --only=load
npm run gate:load -- --only=chaos
npm run gate:load -- --only=smoke,load,chaos
npm run gate:load -- --only=soak        # release prerequisite (1–2 h)
```

`node scripts/perf-gate.mjs` starts an ephemeral server per run (`PORT=0`, a fresh
`mkdtemp` `DATA_DIR`, `BOTS=0`, `CLICK_COOLDOWN_MS=0`) with `SECURITY_MODE=enforce`,
runs the generator, samples `/api/metrics` before and after, checks `/api/state` and
`/api/world` stay under 1 MiB, writes artifacts and exits `0` (pass/flaky), `1`
(fail) or `2` (usage/scenario contract). `--dry-run` prints the plan without starting
anything. `--out=<dir>` overrides `artifacts/gate`.

## Fixed scenarios (`observability/load-scenarios.json`)

| Scenario | Generator | Clients | SSE | Clicks | Duration | Repeat | Wall budget |
|---|---|---|---|---|---|---|---|
| `smoke` | `scripts/load-test.mjs` | 30 | 15 | 5 | 10 s | 1 | ≤ 2 min |
| `load` | `scripts/load-test.mjs` | 100 | 40 | 5 | 60 s | 3 | ≤ 10 min |
| `soak` | `scripts/load-test.mjs` | 40 | 20 | 5 | 120 min | 1 | ≤ 130 min |
| `chaos` | `scripts/chaos-test.mjs` | 10 | 5 | restart | SIGTERM + restart | 1 | ≤ 3 min |

Numbers live only in the committed JSON. `--only`, `--out`, `--scenarios` and
`--rules` are the only overrides; there are no ad-hoc `CLIENTS`/`DURATION` flags in CI.

## Thresholds (single source: `observability/slo.json`)

The scenario file stores **rule ids**, and the orchestrator resolves numbers from the
OPS-01 ruleset. No threshold is duplicated in YAML or JavaScript.

| Metric | Scenario reference | Target |
|---|---|---|
| HTTP p95 | `http-p95` | ≤ 150 ms |
| Event-loop p95 | `loop-p95` | ≤ 50 ms |
| Dropped SSE | `sse-drop` | = 0 |
| Request errors | `gate.errors` | = 0 |
| Join p95 | `gate.joinP95Ms` | ≤ 25 ms |
| Click p95 | `gate.clickP95Ms` | ≤ 75 ms |
| RSS growth (soak, end-state) | `gate.rssGrowthMiB` | ≤ 96 MiB |
| Chaos reconnect | `gate.reconnectMs` | ≤ 5000 ms |
| `/api/state`, `/api/world` body | `gate.responseBodyMiB` | ≤ 1 MiB |

The `gate` block in `observability/slo.json` is additive: `check-slo.mjs` keeps
evaluating the six live rules and ignores the derived gate thresholds.

## Verdict and flake policy

- **Correctness needs every run:** any request error, dropped SSE, missing metric,
  lost player/token, RSS budget or response-body budget fails the gate.
- **Latency may use the 2-of-3 rule:** for a 3-run scenario, a latency-only failure
  yields `GATE FLAKY` when at least two runs are clean. Any correctness failure, or
  fewer than two clean runs, is `GATE FAIL`.
- Exit code `0` covers both `GATE PASS` and `GATE FLAKY`; the summary prints the
  exact distinction. A single-run scenario can never be flaky.

The summary is one row per run plus one verdict line, so it can be pasted into
release notes. Artifacts contain counters and percentiles only; the orchestrator
redacts token/tag/player-identity keys before writing.

## Artifacts

```text
artifacts/gate/
  smoke.json       scenario, thresholds, every run (before/after metrics, summary,
                   bodies, failures, generator exit, stderr tail)
  load.json
  soak.json
  chaos.json
  summary.json     machine-readable verdict + one row per run
  summary.md       operator table + failures
```

`artifacts/` is gitignored. CI uploads `artifacts/gate` with 30-day retention.

## CI wiring

`.github/workflows/ci.yml`:

- nightly `perf-gate` job: `smoke,load,chaos` after the test jobs;
- weekly `soak` job: the 1–2 h release prerequisite (`0 2 * * 0`);
- `workflow_dispatch` with `scenario=gate|soak`;
- PRs labelled `perf-gate` run the nightly gate. No other PR pays the load cost.

The soak job has a 180-minute timeout and `node scripts/perf-gate.mjs --only=soak`,
which is the only accepted evidence for the release soak.

## Measured results

Recorded 2026-11-20 on Apple arm64 (single Node process, loopback, Chromium not
involved). These are real gate artifacts, not targets.

| Scenario | Result |
|---|---|
| `smoke` — 30/15/5/10 s | HTTP p95 **1 ms**, loop p95 **22.1 ms**, 0 errors, 0 dropped, join p95 **5.1 ms**, click p95 **8.9 ms**, RSS end-state +5.3 MiB |
| `load` — 100/40/5/60 s, 3 runs | HTTP p95 **1–2 ms**; loop p95 **22.1 / 22.1 / 22.1 ms**; 0 errors, 0 dropped; join p95 **2.7 / 3.1 / 2.4 ms**; click p95 **24.2 / 21.6 / 20.2 ms** |
| `chaos` — 10 pilots / 5 SSE | world, players and tokens survived; all 10 SSE streams reconnected with a first event within **24 ms** max |
| `soak` — 40/20/120 min | **not executed in this delivery**; the committed weekly/`workflow_dispatch` soak is the release prerequisite. |

The event-loop histogram resolution is 20 ms, so loop p95 values are quantised
(21.9–22.1 ms is the idle bucket, not a regression).

## Direct generator usage (diagnostics)

```sh
rm -rf /tmp/narimato-load
PORT=4401 HOST=127.0.0.1 DATA_DIR=/tmp/narimato-load BOTS=0 CLICK_COOLDOWN_MS=0 \
  SECURITY_MODE=enforce LIMIT_JOIN_MAX=500 LIMIT_JOIN_BURST=500 \
  LIMIT_ACTION_IP_MAX=100000 LIMIT_ACTION_IP_BURST=100000 MAX_SSE_PER_IP=200 node server.js &
BASE_URL=http://127.0.0.1:4401 CLIENTS=100 CLICKS=5 SSE_CLIENTS=40 \
  DURATION_SECONDS=60 node scripts/load-test.mjs --report /tmp/load.json
```

`npm run load:test`, `npm run chaos:test`, `npm run check:slo` and
`npm run recovery:test` remain the low-level diagnostics. The gate is the only
command that produces release evidence.

## Gate decision

**No authoritative sharding (B2 / OPS-05) may start before a committed passing
`GATE PASS`/`GATE FLAKY` report from `npm run gate:load`.** `DELIVERY_PLAN.md` was
retired by [ADR-0006](docs/adr/0006-delivery-ssot-github-issues.md), so this section
and the OPS-05 issue own the rule. A single healthy process means sharding stays
off; a measured SLO breach is the trigger to open the sharding decision, never a
schedule date.

Re-run the gate on production-like hardware before revisiting. The gate is a
regression signal, not a capacity proof; a real-network soak remains a release
prerequisite.

## Client frame budget (RND-06)

`scripts/verify-single-scene.mjs` owns the client frame budget; it is not a load
generator, so it runs on the reference viewport with a throwaway world:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-single-scene.mjs
```

- **Viewport:** 1200×800 CSS px, one headless Chromium page, surface view (the
  heavier view: live mesh + cell pass + entity pass). The budget is measured over
  600 frames after the transition, with `requestAnimationFrame` deltas.
- **Reference thresholds:** renderer work `p95 ≤ 16.7 ms` (60 Hz) and dropped
  frames above 33.4 ms `< 5%` of the sample. `media/single-scene/report.json`
  records `p95Ms`, `droppedRatio`, the sampled view and `rafP50Ms`.
- **Headless CI note:** a virtual/occluded display can throttle rAF to ~10 Hz
  regardless of renderer cost (observed as `rafP50Ms ≥ 20`). In that case the
  suite measures the same 600 frames as synchronous renderer work time, records
  `frameMode: "work"`, and keeps the same pass thresholds; pacing is attributed
  to the environment, not to the renderer. A healthy display uses the rAF path
  (`frameMode: "raf"`).
- The number is a local reference measurement, not a device-farm proof; PERF-01
  owns field telemetry and long-task enforcement.

## Chaos / rollout checklist

- `npm run chaos:test` kills the process with live SSE, restarts on the same data
  dir, asserts tokens/routing/world survive and every client gets a first event
  within 5 s, then shuts down cleanly. Latest gate run: **clean, 24 ms max**.
- `npm run recovery:test` rehearses backup → verify → restore on throwaway data;
  runbook: [docs/RECOVERY.md](docs/RECOVERY.md).
- Restart while clicks are in flight: join tokens remain valid; snapshot recovers.
- Network partition: SSE reconnect backoff (`retry: 1500`); `/api/metrics`
  active/dropped counters identify the room.
- Canary: one process with planet rooms; rollback = single process (current topology).
- Do not introduce a gateway/worker split until a gate report is committed.
