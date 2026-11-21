# NARIMATO — CDN / edge activation runbook (OPS-04)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](DEFINITION_OF_DONE.md) · [Issue index](ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) · [OPS-04](https://github.com/moldovancsaba/narimato/issues/41) · [REL-01](https://github.com/moldovancsaba/narimato/issues/45)
<!-- delivery-ssot:end -->

This runbook is the activation decision for moving NARIMATO's immutable assets to an edge cache,
plus the one-command origin rollback. Activation is **not performed by this repository**: it needs a
real CDN account, hostname, DNS record, TLS certificate, origin token and edge configuration. Those
credentials are external and are deliberately absent here. The issue stays open until a real
hostname passes [`scripts/cdn-preflight.mjs`](../scripts/cdn-preflight.mjs) and the activation is
recorded on the issue.

The preflight is fail-closed: with no hostname or origin it exits `3` with
`credentials/hostname missing` and runs no checks. It never returns a silent pass.

## 1. Scope and current wiring

`ASSET_BASE_URL` is the only switch. When it is set, the origin rewrites the
`<meta name="narimato-asset-base">` value in `public/index.html` at serve time; the narrator reads
that value and builds narration URLs from it. When it is empty, the client uses same-origin URLs.

Current consumer and disposition:

| Asset class | Path | Consumes `ASSET_BASE_URL` today | Edge policy |
|---|---|---|---|
| Narration audio | `/audio/voice/**` | Yes, through the narrator meta | Immutable, versioned by `?v=`, range-capable |
| Client JS | `/js/**` | No — stays same-origin | Immutable only after the allowlist work lands |
| Stylesheets | `/css/**` | No — stays same-origin | Immutable only after the allowlist work lands |
| Images/media | `/media/**` | No — stays same-origin | Immutable only after the allowlist work lands |
| HTML | `/index.html` | Never edge-cached | `no-store`, origin only |
| API/SSE | `/api/**` | Never edge-cached | `no-store`, origin only |

Do not describe JS/CSS/media as edge-delivered until the OPS-04 allowlist extension ships and the
preflight is repeated for those classes. This runbook activates the audio path only.

## 2. Prerequisites (external)

Record each item on the OPS-04 issue before activation:

- CDN/edge account and a pull-zone or distribution for the asset hostname.
- A production hostname with an HTTPS certificate and a DNS record whose TTL is known.
- An origin URL that the edge can pull from, with the asset tree published at the same paths.
- Origin authentication/token if the edge requires one; **never commit it**. Store it in the
  deployment secret store, not in this repository, a ledger or a metrics payload.
- CORS allowlist set to the exact game origin (no wildcard, no credentials mode).
- Byte-range support enabled for audio; compression disabled for `.m4a`.
- Cache-key rule includes the path and the `?v=` query string.
- The exact game origin (for example `https://game.narimato.dev`) and the asset base (for example
  `https://edge.narimato.dev/narimato`).

If any item is missing, stop. The preflight exits `3`; the edge is not activated.

## 3. Cache, CORS and range policy

### 3.1 Cache

| Path | Cache-Control | Cache key | Notes |
|---|---|---|---|
| `/audio/voice/**` | `public, max-age=31536000, immutable` | path + `?v=` | Content-derived version; never purge by filename alone. |
| `/audio/voice/manifest.json` | `no-store` | — | Generated contract; must match the deployed clips. |
| `/js/**`, `/css/**` | `public, max-age=31536000, immutable` | path + `?v=` | Only after the allowlist extension. |
| `/media/**` | `public, max-age=31536000, immutable` | path + `?v=` | Only after the allowlist extension. |
| `/index.html` | `no-store` | — | Must pick up release version and asset base. |
| `/api/**`, SSE | `no-store` | — | Authoritative; origin only. |

- The cache key **must** include the `?v=` value. A CDN that ignores the query string fails the
  version contract even if the headers look correct.
- Bump `AUDIO_VERSION` by re-running the voice generator when a sentence changes; never hand-edit
  the version.
- Purge by full URL/version, not by bare filename. A stale immutable object is a release defect.

### 3.2 CORS

The asset origin differs from the game origin, so the edge must send:

```text
Access-Control-Allow-Origin: $GAME_ORIGIN
Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length
Vary: Origin
```

- Exact origin only; `*` is a failure. The preflight rejects a wildcard.
- `Vary: Origin` is required so a cached response for one origin cannot be served to another.
- `GET` and `HEAD` only. No credentials, no `Access-Control-Allow-Credentials`.
- The origin's CSP already allows the exact `ASSET_BASE_URL` origin for `media-src` and
  `connect-src`; a mismatched base breaks playback and prefetch.

### 3.3 Range

- Audio responses: `Accept-Ranges: bytes`.
- A request with `Range: bytes=0-1023` returns `206` and
  `Content-Range: bytes 0-1023/{total}` with at most 1024 bytes.
- A `200` full-body response to a range request is a failure: seeking and metadata reads degrade.
- Do not gzip/brotli `.m4a`; it is already compressed and breaks range accounting.

## 4. Activation procedure

### 4.1 Publish and configure

1. Publish the asset tree to the origin/pull zone, preserving `/audio/voice/<profile>/...` paths.
2. Configure the edge cache key, CORS, `Vary: Origin`, ranges, TLS and the `/api/**` and HTML bypass.
3. Keep `/index.html` and `/api/**` origin-only; do not create an edge rule for them.
4. Do not put the origin token in an asset URL, a query string or a public header.

### 4.2 Preflight

```sh
CDN_BASE="https://edge.narimato.dev/narimato"
GAME_ORIGIN="https://game.narimato.dev"

ASSET_BASE_URL="$CDN_BASE" GAME_ORIGIN="$GAME_ORIGIN" \
  node scripts/cdn-preflight.mjs

node scripts/cdn-preflight.mjs --base "$CDN_BASE" --origin "$GAME_ORIGIN" --json
```

Expected: exit `0` and `cdn-preflight: PASS` with every check green. A missing hostname, a
non-production host, an HTTP URL, an origin mismatch or a missing game origin exits `3`. A DNS,
status, MIME, cache, CORS, range or no-store failure exits `1` and names the check and URL.

The checker validates configuration, DNS and headers only. It does **not** prove a cache-hit ratio,
a real user's first-word latency or that the provider's cache key includes `?v=`; those are the
manual/dashboard checks below. A green preflight is necessary, not sufficient, for activation.

### 4.3 Enable the base at the origin

```sh
ASSET_BASE_URL="$CDN_BASE" DATA_DIR="$DATA_DIR" PORT=4173 node server.js
```

Restart once; the server rewrites the meta tag on each HTML response and adds the exact asset origin
to `media-src`/`connect-src`. Verify the served HTML and CSP:

```sh
curl -sS "$GAME_ORIGIN/" | grep -o 'name="narimato-asset-base" content="[^"]*"'
curl -sSI "$GAME_ORIGIN/" | grep -i '^content-security-policy:'
```

Expected: the meta content equals `$CDN_BASE` (HTML-escaped) and the CSP contains the exact edge
origin, never `*`.

### 4.4 Browser smoke

1. Load the game from the origin, not the edge, with a fresh profile.
2. Confirm the first narration is still gated by **TAP FOR VOICE**; no autoplay before a gesture.
3. Trigger narration and confirm the audio request goes to the edge, returns `200`/`audio/mp4`, and
   has no CORS error in the console.
4. Seek/replay a clip and confirm the range request returns `206`.
5. Block the edge host (devtools request blocking) and confirm on-demand narration falls back; the
   game stays playable and captions do not stall.
6. Reload mid-cue; the TAP FOR VOICE gate and captions must recover.
7. Confirm `/api/*` and the HTML document still come from the origin.

### 4.5 Record the activation

Attach the preflight JSON, the curl transcripts, the browser smoke note and the hit-ratio capture to
the OPS-04 issue. Record the edge hostname, the game origin and the commit SHA; never record a token.
Activation is a decision recorded on the issue, not a claim in this repository.

## 5. Verification curls

```sh
CDN_BASE="https://edge.narimato.dev/narimato"
GAME_ORIGIN="https://game.narimato.dev"
AUDIO_VERSION="$(node -e "import('./public/js/audio-version.js').then(m => process.stdout.write(m.AUDIO_VERSION))")"
AUDIO_URL="$CDN_BASE/audio/voice/george/help-story__s1.m4a?v=$AUDIO_VERSION"

# 1. Status, MIME, immutable cache, CORS, Vary, ranges.
curl -sS -D - -o /dev/null -H "Origin: $GAME_ORIGIN" "$AUDIO_URL"

# 2. Byte range: 206 + Content-Range.
curl -sS -D - -o /dev/null -H "Origin: $GAME_ORIGIN" \
  -H 'Range: bytes=0-1023' "$AUDIO_URL"

# 3. HTML is origin-only and no-store.
curl -sS -D - -o /dev/null "$GAME_ORIGIN/"

# 4. API is origin-only and no-store.
curl -sS -D - -o /dev/null "$GAME_ORIGIN/api/health"

# 5. Cache-key spot check: the two versions must not share a stale object.
#    Inspect Age/X-Cache/ETag in the provider's response for each URL.
curl -sS -D - -o /dev/null -H "Origin: $GAME_ORIGIN" "$AUDIO_URL"
curl -sS -D - -o /dev/null -H "Origin: $GAME_ORIGIN" \
  "$CDN_BASE/audio/voice/george/help-story__s1.m4a?v=preflight-miss"
```

Expected: `200` + `audio/mp4` + `public, max-age=31536000, immutable` + exact
`Access-Control-Allow-Origin` + `Vary: Origin` + `Accept-Ranges: bytes`; the range request is `206`
with the correct `Content-Range`; HTML/API are `no-store`; the cache-key probe does not serve the
same cached object with a stale version.

## 6. Metrics and SLOs

| Signal | Source | Target | Action |
|---|---|---|---|
| Cache hit ratio | CDN provider analytics | ≥ 0.90 after warm-up | Below target for a full window → investigate cache key/rules before keeping edge. |
| Audio first word (cached) | Client telemetry `audio.firstWordMs` | < 300 ms | If p95 breaches, check edge TTFB and cache status. |
| Audio first word (cold) | Client telemetry `audio.firstWordMs` | < 1 s | Check origin pull latency and cold-start coalescing. |
| Origin HTTP latency / errors | `/api/metrics` `http.latencyMs`, `http.errors` | No regression; p95 inside the OPS-01 SLO | Roll back if the origin event loop or error rate regresses. |
| Origin egress / request rate | Provider analytics + origin logs | ↓ audio bytes after warm-up | A flat curve means the switch is not taking effect. |
| Preflight failures | This runbook / CI artifact | 0 | Any failure is a stop; fix or roll back. |

`/api/metrics` currently exposes HTTP, SSE, event-loop, planet and privacy-safe client telemetry.
It does **not** expose an edge `assets` block; do not claim one. The edge hit ratio and cache status
come from the provider. The `/api/metrics` command is:

```sh
curl -s "$GAME_ORIGIN/api/metrics" | node -e \
  'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);console.log(JSON.stringify({http:m.http.latencyMs,errors:m.http.errors,eventLoop:m.eventLoopDelay}))})'
```

Keep the edge only if the hit ratio is at least `0.90` and the audio first-word SLO holds for two
weeks. Otherwise roll back; do not add P2P delivery to compensate.

## 7. Origin rollback

Unsetting `ASSET_BASE_URL` is the rollback. No data migration or client change is required.

```sh
# 1. Stop the origin server, then restart without the asset base.
unset ASSET_BASE_URL
DATA_DIR="$DATA_DIR" PORT=4173 node server.js

# 2. The served HTML must have an empty asset base.
curl -sS "$GAME_ORIGIN/" | grep -o 'name="narimato-asset-base" content="[^"]*"'
# expected: name="narimato-asset-base" content=""

# 3. Audio is same-origin and still 200 with immutable caching.
curl -sSI "$GAME_ORIGIN/audio/voice/george/help-story__s1.m4a?v=$AUDIO_VERSION"

# 4. CSP no longer names the edge origin.
curl -sSI "$GAME_ORIGIN/" | grep -i '^content-security-policy:'
```

Browser smoke after rollback: the first narration request goes to the game origin, the console has
no CORS error, the TAP FOR VOICE gate still works and captions advance if audio is unavailable.

## 8. Edge rollback

If the origin rollback is not enough (DNS/TLS or a poisoned edge cache):

1. Disable the edge distribution or pull-zone switch; keep the DNS record so clients fail over
   rather than resolve nowhere.
2. Purge by full URL/version, not bare filename. Purge the manifest and the affected clip versions.
3. Lower the DNS TTL in advance; do not change it during the incident.
4. Re-run the preflight and the verification curls before re-enabling.
5. Record the rollback on OPS-04 with the reason, timestamps and the next attempt condition.

The origin remains authoritative throughout; a CDN outage degrades to on-demand same-origin audio,
never to silence.

## 9. Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| `PREREQUISITES_MISSING` exit `3` | No hostname/origin or a non-production host | Supply the real host and origin; do not bypass. |
| `CONFIG_INVALID` exit `3` | HTTP base, credentials in URL, query string | Fix the configuration; never weaken the checker. |
| `dns` fails | Missing/wrong DNS record or propagation | Fix DNS; do not activate. |
| `audio-cache` fails | Query string dropped or wrong max-age | Fix the cache key/rule; roll back if live. |
| `cors-allow-origin` fails | Wildcard, wrong origin or missing `Origin` handling | Set the exact origin; add `Vary: Origin`. |
| `accept-ranges` / `range-status` fails | Range disabled or compressed | Enable byte ranges; disable `.m4a` compression. |
| `html-no-store` / `api-no-store` fails | Edge rule caches HTML or API | Remove the rule immediately; roll back. |
| Cache-hit ratio below 0.90 | Cache key/version mismatch | Inspect the key; do not keep the edge. |
| Audio first word regresses | Cold origin, TLS, CORS preflight | Compare cached/cold, check edge TTFB; roll back if unresolved. |

## 10. Limitations

- No CDN credentials, hostname, DNS record, TLS certificate or provider account exists in this
  repository. Activation cannot be performed here and the issue remains open.
- The preflight is read-only and proves headers, DNS and configuration only. It does not prove the
  provider's internal cache key, hit ratio, WAF behaviour or regional latency.
- JS/CSS/media edge delivery is blocked on the OPS-04 allowlist extension; only audio is wired
  today. Do not claim a full-asset edge.
- The edge analytics contract is provider-specific; no vendor token or account id is stored here.

## 11. References

- [EDGE_DEPLOYMENT.md](../EDGE_DEPLOYMENT.md) — asset-delivery contract and supporting rules.
- [OBSERVABILITY.md](../OBSERVABILITY.md) — `/api/metrics`, telemetry and SLOs.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — static routing, CSP and configuration.
- [scripts/cdn-preflight.mjs](../scripts/cdn-preflight.mjs) — fail-closed preflight.
- [test/fixtures/cdn/healthy.json](../test/fixtures/cdn/healthy.json) — healthy header fixture.
- [VOICE.md](../VOICE.md) — narration cache-bust and generation.
