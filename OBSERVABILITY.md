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
  "generatedAt": 1760000000000,
  "uptimeMs": 123456,
  "process": { "heapUsedBytes": 0, "heapTotalBytes": 0, "rssBytes": 0, "externalBytes": 0 },
  "http": {
    "requests": 42, "finished": 41, "inFlight": 1,
    "errors": 0,               // status >= 500
    "clientErrors": 2,         // status 400..499
    "routes": { "/api/state": 10, "/api/events": 3, "static": 20, "static:/": 1 },
    "statuses": { "200": 38, "404": 3 },
    "latencyMs": { "count": 38, "sumMs": 45.6, "avgMs": 1.2, "maxMs": 9,
                   "p50Ms": 1, "p95Ms": 3, "p99Ms": 9 }
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
| `audio.firstWordMs` | 0..120000 ms |
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
telemetry?.markAudioFirstWord(performance.now() - startedAt); // beacon once after first audio word
```

- Collects Web Vitals (LCP/CLS/INP/TTFB), long-task counters, viewport, session length and error
  counters locally, using `PerformanceObserver` where available.
- Sends **one** beacon on `pagehide`/`visibilitychange → hidden` and **one** once the first audio
  word starts. Transport: `navigator.sendBeacon` with a `text/plain` blob, falling back to
  `fetch(..., {keepalive:true})`.
- Completely fails-safe: if `sendBeacon`/`fetch` are missing or the network is down it silently
  does nothing. No identifiers, cookies, tags, tokens or timestamps beyond the session duration.
- `buildTelemetryPayload()` / `createTelemetry({win})` are exported for tests and non-DOM hosts.

## SLOs / alert thresholds

| Signal | Target |
|---|---|
| HTTP p95 API latency | **< 150 ms** (`http.latencyMs.p95Ms`) |
| SSE state latency | **< 250 ms** |
| Event-loop delay p95 | **< 50 ms** (`eventLoopDelay.p95Ms`) |
| Dropped SSE clients | no room with sustained drops (`sse.dropped`, `sse.byPlanet.*.dropped`) |
| Audio first word | **< 300 ms cached / < 1 s cold** (`telemetry.aggregates['audio.firstWordMs']`) |

Suggested alerts: p95 latency breach for 5 min, event-loop p95 > 50 ms for 5 min, any planet with
`playersOnline > 0` and `sse.active === 0` during live traffic, RSS growth with zero uptime reset.

## Configuration

| Option (`startServer`) | Default | Meaning |
|---|---|---|
| `metricsEventLoop` | `true` | enable `monitorEventLoopDelay` histogram |
| `metricsEventLoopResolutionMs` | `20` | histogram resolution |
| `telemetryRateLimit` | `{max:30, windowMs:60000}` | per-IP telemetry bucket |

All metrics are in-memory only; they reset on restart (baseline before B1/B2 scaling work).

## Privacy notes

- Tokens live only in the token→planet registry; metrics/telemetry never read or echo them.
- Player tags/ids are never copied into metrics. Planet aggregates are numeric only.
- Hidden deposits (`resourceId`, `resourceFindClick`, found flags) are never exposed.
- Telemetry is opt-out-by-default only in the sense that it carries nothing identifying; a future
  privacy toggle can simply stop importing `telemetry.js` in `app.js`.
- Tests assert the `/api/metrics` body contains no join token, tag, player id, `resourceId` or
  `resourceFindClick` strings.
