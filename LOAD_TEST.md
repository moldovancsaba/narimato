# NARIMATO — Load / Soak / Chaos (Track B3)

Zero-dependency workload generator: `scripts/load-test.mjs` (`npm run load:test`).

## Local run

```sh
rm -rf /tmp/narimato-load
PORT=4401 HOST=127.0.0.1 DATA_DIR=/tmp/narimato-load BOTS=0 CLICK_COOLDOWN_MS=0 node server.js &
BASE_URL=http://127.0.0.1:4401 CLIENTS=100 CLICKS=5 SSE_CLIENTS=40 \
  DURATION_SECONDS=2 node scripts/load-test.mjs
```

Environment: `BASE_URL`, `CLIENTS`, `CLICKS`, `SSE_CLIENTS`, `DURATION_SECONDS`,
`CLICK_PAUSE_MS`, `TAG_PREFIX`.

## Result — 2026-11-18, single Node process, Apple arm64

| Workload | Result |
|---|---|
| 30 clients / 15 SSE / 5 clicks | HTTP p95 **1 ms**, 0 errors, 1,020 SSE events, 0 dropped |
| 100 clients / 40 SSE / 5 clicks | HTTP p95 **1 ms**, 0 errors, 4,940 SSE events, 0 dropped |
| Event-loop p95 | ~21 ms (monitor resolution is 20 ms; SLO gate <50 ms) |
| Join latency | 0.8–0.9 ms average |
| Click latency | 3.8–10.6 ms average |

The click counter is naturally capped by tutorial cell breaks (a cell breaks after a few
successful clicks and the base label stops being a leaf). HTTP/SSE/loop metrics are the
capacity signals; the generator deliberately exercises the real lock/break path.

## Gate decision

Per the delivery plan, **B2 (authoritative sharding) is not started** while these SLOs are
healthy on one process:

- HTTP p95 < 150 ms
- event-loop p95 < 50 ms
- dropped SSE = 0
- no request errors

Re-run the generator at the expected launch concurrency and on production-like hardware
before revisiting. The current generator is a smoke/soak harness, not a capacity proof;
a sustained 1–2 h soak with real network conditions is still recommended before launch.

## Chaos / rollout checklist

- Kill the process during active SSE: clients reconnect; state is persisted; no lost writes.
- Restart while clicks are in flight: join tokens remain valid; snapshot recovers.
- Network partition: SSE reconnect backoff; `/api/metrics` active/dropped counters.
- Canary: one process with planet rooms; rollback = single process (current topology).
- Do not introduce a gateway/worker split until the gate above is crossed.

## B3 status

Harness + local measurements + decision recorded. Full 1–2 h soak and worker-kill chaos
require a staging deployment and are documented as the next gate, not simulated here.
