# NARIMATO — Observability (Track B0)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) · [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) · [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) · [SEC-01](https://github.com/moldovancsaba/narimato/issues/43) · [PERF-01](https://github.com/moldovancsaba/narimato/issues/44)
<!-- delivery-ssot:end -->

Zero-dependency, aggregation-only observability for the single-node authoritative server plus a
privacy-safe client beacon. **No npm packages, no external services, no PII.**

Measured before considering any sharding (see the load/scale gate in [LOAD_TEST.md](LOAD_TEST.md) and the delivery issues in [ISSUE_MAP.md](docs/ISSUE_MAP.md)).

## Endpoints

### `GET /api/metrics` (also `HEAD`)

`Cache-Control: no-store`. Returns:

```jsonc
{
  "ok": true,
  "metricsVersion": 1,           // additive payload contract (OPS-01)
  "generatedAt": 1760000000000,
  "uptimeMs": 123456,
  "process": { "heapUsedBytes": 0, "heapTotalBytes": 0, "rssBytes": 0, "externalBytes": 0,
               "bootRssBytes": 0 },
  "security": {
    "rateLimited": 0, "bodyTooLarge": 0, "crossOrigin": 0, "sseRefused": 0,
    "traversalBlocked": 0, "authFailures": 0, "sseReplaced": 0, "mode": "enforce"
  },
  "http": {
    "requests": 42, "finished": 41, "inFlight": 1,
    "errors": 0,               // status >= 500
    "clientErrors": 2,         // status 400..499
    "routes": { "/api/state": 10, "/api/events": 3, "static": 20, "static:/": 1 },
    "statuses": { "200": 38, "404": 3 },
    "latencyMs": { "count": 38, "sumMs": 45.6, "avgMs": 1.2, "maxMs": 9,
                   "p50Ms": 1, "p95Ms": 3, "p99Ms": 9, "windowSamples": 2048 }
  },
  "sse": {
    "active": 2, "opened": 9, "closed": 7, "dropped": 0,
    "byPlanet": { "0": { "active": 1, "opened": 5, "closed": 4, "dropped": 0 } }
  },
  "planets": [{
    "index": 0, "name": "MAGRATHEA", "depth": 2,
    "playersOnline": 1, "playersTotal": 4, "robots": 2,
    "posesLive": 3, "robotReplans": 4, "robotMineRejected": 1, "supplyDrops": 1,
    "faces": 20, "clicks": 120, "breaks": 3, "maxDepthReached": 1, "revision": 88
  }],
  "eventLoop": { "enabled": true, "resolutionMs": 20 },
  "eventLoopDelay": { "p50Ms": 0.9, "p95Ms": 2.1, "p99Ms": 4.0, "maxMs": 12.3, "meanMs": 1.1 },
  "telemetry": {
    "reports": 5, "rejected": 0, "lastReportedAt": 1760000000000,
    "aggregates": {
      "webVitals.lcp": { "count": 5, "sum": 6500, "avg": 1300, "min": 900, "max": 2400 }
    }
  }
}
```

- `metricsVersion`, `http.latencyMs.windowSamples` and `process.bootRssBytes` are the
  additive fields consumed by the SLO checker (`process.bootRssBytes` is the RSS baseline for
  the growth rule; `windowSamples` documents the latency ring size).
- `security` is the abuse-counter surface (SEC-01): every rejection increments a named counter
  and never stores an IP, token or header. `security.mode` reports `SECURITY_MODE`
  (`compat` or `enforce`).
- Latency samples live in a bounded 2048-sample ring; percentiles cover recent traffic.
- **SSE connections are counted as connections**, not HTTP latency samples: `/api/events` appears
  in `http.routes`, but its long-lived duration never enters `http.latencyMs` (verified in tests).
- `planets` only ever contains read-only counters for loaded planets. It never includes player
  arrays, tags, tokens, ids, hidden deposits, discovery clicks or any other gameplay secret.
  Surface multiplayer signals: `posesLive` (live transient poses on the planet), `robotReplans`
  (seeded route re-plans), `robotMineRejected` (clicks the contest lock or resolver rejected,
  which emit no beam) and `supplyDrops` (emergency-supply focus drops placed).
- Metrics are not injected into `/api/state` or `/api/world`.

```bash
curl -s http://localhost:4173/api/metrics | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s).http.latencyMs)))'
```

### `POST /api/telemetry` — privacy-safe client beacon

Same-origin only (an `Origin` header that does not match `Host` → `403 CROSS_ORIGIN`). No auth.
Accepts `application/json` or the `text/plain` blob that `navigator.sendBeacon` produces.

Only these **numeric** fields are accepted (anything else — strings, objects, tags, tokens — is
ignored; numbers are clamped):

| Field | Range |
|---|---|
| `webVitals.lcp` | 0..120000 ms |
| `webVitals.cls` | 0..100 |
| `webVitals.inp` | 0..60000 ms |
| `webVitals.ttfb` | 0..60000 ms |
| `hud.longTasks` | 0..1000000 |
| `hud.maxLongTask` | 0..600000 ms |
| `audio.firstWordMs` | 0..120000 ms (cue-relative; see below) |
| `audio.clipFailures` | 0..100000 |
| `audio.resumeCount` | 0..100000 |
| `perf.frameP95Ms` / `perf.frameMaxMs` | 0..60000 ms |
| `perf.fps` | 0..240 |
| `viewport.width` / `viewport.height` | 1..20000 |
| `viewport.dpr` | 0.25..10 |
| `sessionMs` | 0..86400000 |
| `errors.js` / `errors.network` / `errors.unhandled` | 0..1000000 |

Responses: `200 {ok:true, accepted:N}`, `400 INVALID_JSON`, `403 CROSS_ORIGIN`,
`413 PAYLOAD_TOO_LARGE` (body cap **4 KB**), `429 RATE_LIMITED`
(default **30 reports / 60 s per IP**, simple bucket; override with
`startServer({ telemetryRateLimit: { max, windowMs } })` for tests/tuning).

`GET /api/telemetry` returns the current aggregate:
`{ ok:true, telemetry:{ reports, rejected, lastReportedAt, aggregates } }`.

Aggregation holds only counts/sums/min/max/avg per whitelisted path — no client identifiers,
cookies, user agents, tags or tokens are stored.

```bash
curl -s -X POST http://localhost:4173/api/telemetry \
  -H 'content-type: application/json' \
  -d '{"webVitals":{"lcp":1200,"cls":0.03},"audio":{"firstWordMs":280},"sessionMs":42000}'
```

## Client beacon — `public/js/telemetry.js`

Browser module (zero deps, Node-safe import). It auto-installs when imported in a browser and
exposes a controller:

```js
import { telemetry } from './telemetry.js';
// AUD-01: measure from CUE START, not navigation start, and let the watchdog
// classify failures. `firstWordMs` is clamped to [0, 120000] server-side.
const cueStartedAt = performance.now();
telemetry?.markAudioFirstWord(firstWordMs(cueStartedAt, performance.now()));
telemetry?.markAudioClipFailure(); // numeric counter only; never a reason string
telemetry?.markAudioResume();      // one successful interruption resume
```

`audio.firstWordMs` used to be measured from navigation start, which made the `< 300 ms` cached
SLO unverifiable (a healthy page reports thousands of milliseconds). It is now measured from the
sentence's cue start to its first `playing` event and aggregated like every other numeric field.
`audio.clipFailures` counts watchdog/`play()` failures and `audio.resumeCount` counts successful
interruption resumes; all three are numbers only, so no cue id, URL, profile id or token can leak.

- Collects Web Vitals (LCP/CLS/INP/TTFB), long-task counters, viewport, session length and error
  counters locally, using `PerformanceObserver` where available.
- Sends **one** beacon on `pagehide`/`visibilitychange → hidden` and **one** once the first audio
  word starts. Transport: `navigator.sendBeacon` with a `text/plain` blob, falling back to
  `fetch(..., {keepalive:true})`.
- Completely fails-safe: if `sendBeacon`/`fetch` are missing or the network is down it silently
  does nothing. No identifiers, cookies, tags, tokens or timestamps beyond the session duration.
- PERF-01 adds three numeric performance fields (`perf.frameP95Ms`, `perf.frameMaxMs`,
  `perf.fps`). The render loop updates them at most once per second through
  `telemetry.recordPerf()`; they ride the same page-hide beacon and are clamped
  server-side like every other field.
- `buildTelemetryPayload()` / `createTelemetry({win})` are exported for tests and non-DOM hosts.

## Client performance budgets (PERF-01)

`public/js/perf-budget.js` is the pure, Node-importable budget and measurement module.
The renderer feeds it one frame per rAF and applies the quality ladder; the probe
evaluates the same numbers outside the browser.

### Budgets

| Device class | Viewport / dpr | Frame p95 | Frame max | FPS floor | Long tasks / 10 s | Max long task | INP | CLS | LCP | Interaction p95 | JS bundle gzip |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `desktop` | 1440×900 / 2 | 16.7 ms | 40 ms | 55 | 2 | 100 ms | 200 ms | 0.10 | 2500 ms | 100 ms | 180 KiB |
| `mobile-mid` | 390×844 / 3 | 22.0 ms | 60 ms | 45 | 2 | 120 ms | 200 ms | 0.10 | 2500 ms | 100 ms | 180 KiB |
| `mobile-low` | 360×640 / 2 | 33.3 ms | 80 ms | 30 | 2 | 160 ms | 200 ms | 0.10 | 2500 ms | 100 ms | 180 KiB |

The game's first-load JavaScript graph gets the **180 KiB gzip** budget. The
committed GDS island (`public/ui/island.js`) is measured as a lazy island against
M1's **180 KiB** build budget (its CSS is reported separately); any *additional*
lazy island gets **60 KiB gzip**. `bundleKibGzip` is the game JavaScript graph
(entry + static imports); dynamic `import()` is excluded from first load. CSS is
reported separately as `cssKibGzip` and is not part of the 180 KiB JavaScript
budget. Frame-time and bundle budgets
are compared with a documented **2 % measurement tolerance** (a 16.7 ms target
routinely measures 16.8 ms at 60 Hz; gzip output varies by build); the budget
values themselves do not move.

### Frame percentile and quality ladder

Frame time is the rAF delta. Percentiles are the 90th percentile of each 2 s window,
then the 95th percentile across windows, so one 200 ms stall does not dominate p95
but still fails `frameMaxMs`. The ring holds 512 samples; hidden-tab frames are
discarded, the frame that rebuilds the surface mesh is excluded, and a dpr/viewport
change resets the ring.

The quality ladder drops a tier when recent p95 exceeds `1.35 ×` the budget and
climbs when it falls below `0.7 ×`; changes are held for 2 s and pinned by
`?quality=0|1|2`. Tiers reduce **canvas** work only: tier 2 draws the full
tessellation, tier 1 a medium tessellation, tier 0 a coarse tessellation, plus fewer
particles/scanlines/glass FX. GDS DOM, focus, labels and accessibility are untouched.

### Reproducible probe

```bash
PLAYWRIGHT_MODULE=/path/to/playwright npm run perf:probe -- --device=desktop
PLAYWRIGHT_MODULE=/path/to/playwright npm run gate:perf      # desktop, pinned quality 0, 15% baseline gate
npm run perf:baseline                                        # record the pinned desktop baseline
```

`scripts/perf-probe.mjs` starts the real server on an ephemeral port, launches
Chromium through the documented `PLAYWRIGHT_MODULE` path, applies the device
viewport/DPR (mobile classes also get 4× CPU and Fast 3G; desktop stays on the
host CPU/network so its LCP is not a proxy for uncompressed static transfer),
waits 12 s for the adaptive tier to settle (the release gate pins
`quality=0` so a host-contention tier change cannot masquerade as a renderer
regression; adaptive behaviour is probed separately), exercises
pointer/wheel/keyboard input, resets the frame ring while keeping interaction
samples, then measures for 15 s. On macOS it requests the ANGLE/Metal backend; on CI
without a GPU the artifact records `environment.gpuClass = "software"` and the
baseline comparison is skipped unless the environment signature matches.

Run the probe on a **quiet host**: `frameMaxMs` is deliberately strict and a
concurrent build/browser on the same machine can add a GC-scale spike that is not
a product regression. CI runners are isolated; a shared developer box should be
idle for the measurement.

Artifacts: `artifacts/perf/<device>.json` (`observed`, `budget`, `evaluation`,
`regression`, environment, bundle). The committed reference is
`observability/perf-baseline.json`. The gate fails when frame p95 regresses by more
than **15 %** against a comparable baseline, or when any budget misses. The probe
does not invent numbers: every field comes from the measured page, and
`interactionSamples` is part of the artifact so input coverage is auditable.

`--all` runs all three classes; `--cpu=<n>`, `--no-throttle`, `--quality=0|1|2`,
`--seconds=<n>` and `--attempts=<1..5>` exist for calibration. The release gate
(`npm run gate:perf`) runs **three attempts** and keeps the best clean attempt, with
every attempt recorded in the artifact; this absorbs a one-off host/GC spike without
weakening the budget per run. Real-device calibration is still required: emulation
is a regression signal, not a phone.

## SLO ruleset (executable)

Thresholds exist in exactly one machine-readable place: [`observability/slo.json`](observability/slo.json).
`lib/slo.js` evaluates it and [`scripts/check-slo.mjs`](scripts/check-slo.mjs) (`npm run check:slo`) turns it
into a local verdict. The table below is checked against the ruleset by
[`test/slo-contract.test.js`](test/slo-contract.test.js), so documentation cannot drift from enforcement.

| Rule | Signal (path in `/api/metrics`) | Target | Window | Severity | Owner | Runbook |
|---|---|---|---|---|---|---|
| `http-p95` | `http.latencyMs.p95Ms` | ≤ 150 ms | 5 min | warn | ops-on-call | [#http-p95](#http-p95) |
| `loop-p95` | `eventLoopDelay.p95Ms` | ≤ 50 ms | 5 min | page | ops-on-call | [#loop-p95](#loop-p95) |
| `sse-drop` | `sse.dropped` | = 0 | 2 min | page | ops-on-call | [#sse-drop](#sse-drop) |
| `sse-silence` | `sse.active` | > 0 | 3 min | page | ops-on-call | [#sse-drop](#sse-drop) |
| `audio-first-word` | `telemetry.aggregates["audio.firstWordMs"].avg` | ≤ 1000 ms | 15 min | warn | client-perf-on-call | [#audio-first-word](#audio-first-word) |
| `rss-growth` | `process.rssBytes` (rate/min from `bootRssBytes`) | ≤ 6 MiB/min | 30 min | warn | ops-on-call | [#rss-growth](#rss-growth) |

The ruleset also carries a non-live `gate` block (`errors`, `joinP95Ms`,
`clickP95Ms`, `rssGrowthMiB`, `reconnectMs`, `responseBodyMiB`) consumed by the
OPS-02 gate; `check-slo.mjs` ignores it.

Rule semantics:

- **Warm-up.** In-memory metrics reset on restart, so a rule whose `windowMs` has not elapsed since
  boot reports `warming` — never `pass` and never a page. This prevents a restart from paging.
- **Preconditions.** `sse-drop`/`sse-silence` are only active while some planet has
  `playersOnline > 0`; `audio-first-word` waits for at least 20 reports. An inactive rule reports
  `waiting` and is not a failure.
- **Derived rules.** `rss-growth` is `(rssBytes − bootRssBytes) / minutes-since-boot`, clamped at 0
  for a negative rate; it is suppressed until uptime exceeds 30 minutes.
- **Missing path.** If a documented path disappears from the payload the checker reports
  `missing-path` and exits `2` — a payload contract break, not an SLO breach.
- **No identifiers.** The ruleset and checker output contain no token, tag, player id, `resourceId`
  or `resourceFindClick`; the contract test asserts this.

```bash
npm run check:slo                              # BASE_URL, default http://127.0.0.1:4173
BASE_URL=http://127.0.0.1:4410 npm run check:slo
node scripts/check-slo.mjs --only=http-p95 --json
```

Exit codes: `0` healthy, `1` any threshold breach, `2` any missing rule path, `3` server
unreachable. Output is plain terminal text (words, not colour) with one line per rule and a final
`PASS n/n`. The recommended scrape interval is 15 s; metrics are in-memory and reset on restart.
The loop histogram resolution is 20 ms, so `loop-p95` percentiles are quantised in 20 ms buckets.

## Runbook

Each entry states the signal, what it means, the first diagnostic command and the action. Alert
ownership is role-based (`ops-on-call`, `client-perf-on-call`); the board/rota maps roles to people.

### http-p95

**Signal:** `http.latencyMs.p95Ms > 150` for 5 minutes (`http-p95`, severity warn, owner
ops-on-call).

**Diagnose:** `curl -s http://localhost:4173/api/metrics` and compare `http.latencyMs`,
`http.routes`, `planets.length` and `process.rssBytes`. Check whether the load generator or a
single route dominates (`scripts/load-test.mjs`).

**Act:** if a route dominates, confirm it is not unbounded work; if all routes are slow, check host
CPU and event-loop delay (`loop-p95`). Scale vertically or shed load before considering sharding
(`OPS-05` gate). Record the measurement in `LOAD_TEST.md`.

### loop-p95

**Signal:** `eventLoopDelay.p95Ms > 50` for 5 minutes (`loop-p95`, severity page, owner ops-on-call).

**Diagnose:** `/api/metrics` `eventLoopDelay`, `planets` count, `http.inFlight`, `process.rssBytes`.
A growing `inFlight` points at a slow handler; a growing RSS points at retention.

**Act:** identify the hot route from `http.routes` deltas, capture a heap snapshot if RSS is
growing, and restart only after the data directory is backed up (`docs/RECOVERY.md`). If the delay
persists under normal load, open a scale-gate investigation rather than restarting in a loop.

### sse-drop

**Signal:** `sse.dropped > 0` with players online (`sse-drop`, severity page) or
`sse.active === 0` while players are online (`sse-silence`, same runbook, severity page).
Owner ops-on-call.

**Diagnose:** `/api/metrics` `sse.byPlanet.*` per room, `http.routes["/api/events"]`, and the
server logs for backpressure drops.

**Act:** a single room dropping streams indicates a slow consumer — verify client reconnect
(`retry: 1500`); if all rooms drop, check process memory and event-loop delay. Do not increase the
SSE buffer cap without measuring; the 1 MiB backpressure ceiling is deliberate.

### audio-first-word

**Signal:** `telemetry.aggregates["audio.firstWordMs"].avg > 1000` over 15 minutes with at least 20
reports (`audio-first-word`, severity warn, owner client-perf-on-call).

**Diagnose:** `curl -s http://localhost:4173/api/telemetry` for count/min/max/avg; compare
`webVitals.lcp` and `sessionMs`; check the `.m4a` asset cache and `ASSET_BASE_URL` (OPS-04).

**AUD-01 counters:** the same endpoint aggregates `audio.clipFailures` (watchdog/play failures)
and `audio.resumeCount` (interruption resumes). A rising `clipFailures` with a flat
`resumeCount` means clients are degrading to captions (watchdog/`play()` ladder in
[VOICE.md](VOICE.md#playback-resilience-aud-01)); a healthy session keeps `firstWordMs` low and
`clipFailures` at 0. Both counters are numeric-only and clamped, so they never carry a cue id,
URL, profile id or token.

**Act:** if the count is small or one outlier dominates (`max` far above `avg`), no action. If the
average is sustained, verify CDN/asset-base caching and the narration preload path; roll back the
asset-base change if it correlates.

### rss-growth

**Signal:** RSS grows faster than 6 MiB/minute after 30 minutes of uptime (`rss-growth`, severity
warn, owner ops-on-call).

**Diagnose:** compare `process.bootRssBytes` and `process.rssBytes` over two scrapes 15 s apart;
`planets.length` growth is expected on first visits, unbounded growth is not.

**Act:** capture a heap snapshot, check per-planet `playersTotal`/`faces` for runaway expansion,
and verify the metrics/limit maps are evicting. Back up `DATA_DIR` (`docs/RECOVERY.md`) before any
restart.

## Security abuse counters

`/api/metrics` `security` counters make abuse visible without storing IPs (SEC-01):
`rateLimited`, `bodyTooLarge`, `crossOrigin`, `sseRefused`, `traversalBlocked`, `authFailures`,
`sseReplaced`. Suggested alerts: any sustained `rateLimited` spike per minute, any
`crossOrigin > 0` (probing), any `traversalBlocked > 0` (path probing), and `authFailures` above a
few per minute (token guessing). These counters are memory-only and IP-free. See
[ARCHITECTURE.md](ARCHITECTURE.md#security-headers-and-abuse-limits) for defaults and the
`SECURITY_MODE` rollback.

## Configuration

| Option (`startServer`) | Default | Meaning |
|---|---|---|
| `metricsEventLoop` | `true` | enable `monitorEventLoopDelay` histogram |
| `metricsEventLoopResolutionMs` | `20` | histogram resolution |
| `telemetryRateLimit` | `{max:30, windowMs:60000}` | per-IP telemetry bucket |
| `security` (or `SECURITY_MODE`) | `compat` locally, `enforce` when `NODE_ENV=production` | header/origin/limit policy; see [ARCHITECTURE.md](ARCHITECTURE.md#security-headers-and-abuse-limits) |

All metrics are in-memory only; they reset on restart (baseline before B1/B2 scaling work).

## Privacy notes

- Tokens live only in the token→planet registry; metrics/telemetry never read or echo them.
- Player tags/ids are never copied into metrics. Planet aggregates are numeric only.
- Hidden deposits (`resourceId`, `resourceFindClick`, found flags) are never exposed.
- Telemetry is opt-out-by-default only in the sense that it carries nothing identifying; a future
  privacy toggle can simply stop importing `telemetry.js` in `app.js`.
- Tests assert the `/api/metrics` body contains no join token, tag, player id, `resourceId` or
  `resourceFindClick` strings.
