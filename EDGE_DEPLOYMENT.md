# NARIMATO — Edge / CDN Asset Delivery (Track B1)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [OPS-04](https://github.com/moldovancsaba/narimato/issues/41)
<!-- delivery-ssot:end -->

The authoritative game server stays the origin. Edge delivery applies only to **static,
immutable assets** — narration audio, images and the client bundle. No game state is cached
or served by the edge.

## What is already CDN-safe

- Audio URLs are versioned: `/audio/voice/<profile>/<cue>__s<n>.m4a?v=3.57.0+56190bd8`.
  The query is generated (`<package version>+<content hash8>`) by
  `scripts/generate-voice.mjs`; never hand-edit it. Editing a sentence changes the
  content hash, so a replaced clip always gets a new cache key.
- `.m4a` responses are `Cache-Control: public, max-age=31536000, immutable`.
- `/audio/voice/manifest.json` lists every clip with `sha256`, `bytes` and
  `durationMs`; it is the verification contract for `npm run voice:verify`.
- HTML/JS/CSS use `no-store`; release assets are versioned by `?v=<app version>`.
- Static files are traversal-safe and MIME-typed by the origin.

## Optional asset domain

Point the heavy audio at a CDN/edge hostname without changing the game code:

```sh
ASSET_BASE_URL=https://cdn.example.com/narimato node server.js
```

The origin rewrites the `<meta name="narimato-asset-base">` tag in `index.html` on serve.
The client narrator reads that meta value and builds audio URLs from it. Local development
and tests keep the default empty value (same origin).

### CDN requirements

- **CORS:** if the asset origin differs from the game origin, allow the game origin for
  `GET`/`HEAD` and expose `Content-Range`, because the narrator pre-warms clips with
  `fetch(..., {cache:'force-cache'})`. `<audio>` playback itself does not need CORS, but
  prefetch will fail closed and fall back to on-demand playback.
- **Ranges:** enable byte-range support at the edge for audio (browser metadata/seek).
- **Compression:** do not gzip/brotli `.m4a` (already compressed).
- **Cache key:** include the `?v=` query string; never purge by filename alone.
- **Cold start:** prefetch first sentences remains enabled; the CDN should coalesce concurrent
  requests for the same clip.

## Suggested rules

| Path | Cache | Notes |
|---|---|---|
| `/audio/voice/*` | `public, max-age=31536000, immutable` | `?v=` content-derived version is the cache key |
| `/audio/voice/manifest.json` | `no-store` | generated contract; must match the deployed clips |
| `/js/*`, `/css/*` | `public, max-age=31536000, immutable` | app entry carries `?v=` |
| `/index.html` | `no-store` | must pick up release version + asset base |
| `/api/*` | `no-store` | authoritative; never edge-cache |

## Activation checklist

1. Upload/copy the asset tree to the edge/origin pull zone.
2. Set `ASSET_BASE_URL` and restart the origin server once.
3. `curl -s https://cdn.example.com/narimato/audio/voice/george/help-story__s1.m4a -I`
   → 200, `audio/mp4`, immutable cache.
4. Reload the game, first spoken sentence, and verify no CORS errors in the console.
5. Check `/api/metrics` HTTP/SSE SLOs and client telemetry `audio.firstWordMs`.
6. Roll back by unsetting `ASSET_BASE_URL` (defaults to same-origin).

## Measurement

- Origin `/api/metrics` gives request counts/latency and event-loop pressure.
- CDN analytics gives cache hit ratio and egress. The B4 (peer-assisted assets) gate needs a
  sustained high cache-miss/egress pattern; do not build P2P before that.

## Current state

B1 is **CDN-ready in code** (asset base + immutable origins) but no external CDN credentials
are available in this environment; activation is a deployment step, not a code gate.
