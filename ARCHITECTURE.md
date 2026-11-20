# NARIMATO — Architecture

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) · [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3) · [QA-01](https://github.com/moldovancsaba/narimato/issues/5) · [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) · [UI-01](https://github.com/moldovancsaba/narimato/issues/7) · [RND-06](https://github.com/moldovancsaba/narimato/issues/19) · [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) · [TST-01](https://github.com/moldovancsaba/narimato/issues/25) · [EVT-01](https://github.com/moldovancsaba/narimato/issues/32) · [STR-01](https://github.com/moldovancsaba/narimato/issues/35) · [STR-02](https://github.com/moldovancsaba/narimato/issues/36) · [OPS-03](https://github.com/moldovancsaba/narimato/issues/40) · [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) · [SEC-01](https://github.com/moldovancsaba/narimato/issues/43) · [PERF-01](https://github.com/moldovancsaba/narimato/issues/44)
<!-- delivery-ssot:end -->

Architecture decisions are recorded as ADRs: [docs/adr/README.md](docs/adr/README.md).

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Client | Vanilla HTML/CSS/ES modules | no framework, no bundler, no runtime npm deps |
| Rendering | Canvas 2D + WebGL | game planet: Canvas 2D; spherical-icosahedron reference viewer: WebGL ray–sphere shader |
| Simulation | Node.js ≥20 | authoritative game server, HTTP + Server-Sent Events |
| Persistence | JSON files + atomic rename | one file per planet, one registry file |
| Tests | `node:test` | <!-- test-count:178 -->178<!-- /test-count --> tests, no test dependencies; ownership map in [docs/TEST_MAP.md](docs/TEST_MAP.md) |
| CI | GitHub Actions | Node 20 and 22, `npm test` |
| Deploy | `node server.js` behind any static/reverse proxy | Cloudflare tunnel used for the live build |

Zero npm dependencies is intentional: the entire game ships as readable source and starts with
`npm start`. Voice-over and screenshot assets are generated locally and committed; there are no
third-party runtime requests.

## Runtime topology

```
Browser
  index.html ── app.js ──┬─ renderer.js  (Canvas 2D game planet)
                         ├─ world.js     (client adaptive tree)
                         ├─ ui.js        (responsive HUD/DOM)
                         ├─ intro.js     (cockpit launch cine)
                         ├─ interlude.js (interplanetary storm/meteor cine)
                         └─ result-card.js
  icosahedron.html ── icosahedron-viewer.js (WebGL ray–sphere reference viewer)
             shared/     geometry.js · planet.js · resources.js · mission.js
                         sphere-interaction.js · orbit-controls.js
                 │
                 │ REST /api/*  +  SSE /api/events?token=…
                 ▼
Node server.js
  ├─ static file server (public/)
  ├─ lib/metrics.js        HTTP/SSE/event-loop/telemetry aggregates (/api/metrics)
  └─ lib/planet-manager.js
        ├─ registry.json        token → planetIndex
        ├─ Planet 0 WorldCore   DATA_DIR/world.json
        ├─ Planet 1 WorldCore   DATA_DIR/planets/p1/world.json
        └─ Planet n WorldCore   on demand · per-planet robots · per-planet SSE rooms
```

Observability: `public/js/telemetry.js` posts a tiny privacy-safe numeric beacon to
`/api/telemetry` (page hide + first spoken word); the server aggregates it and exposes
`/api/metrics` (zero dependencies). See **OBSERVABILITY.md** for fields, SLOs and privacy notes.

## Modules

### Server

- **`server.js`** — HTTP routing, static serving (traversal-safe, MIME, no-store assets), JSON body
  limits, SSE connection handling, heartbeat/backpressure, graceful SIGTERM shutdown. Delegates all
  game routes to the planet manager.
- **`lib/planet-manager.js`** — owns one `WorldCore` per loaded planet, token→planet routing, per-planet
  SSE rooms and state throttling, bots per planet, first-boot migration, escape game-master,
  random story selection, meteor broadcast, planet persistence and registry.
- **`lib/world-core.js`** — single authoritative planet: spherical tree, players/tokens, scoring,
  contest lock, individual breaks, terrain-aware resource deposits, mining, robots, save/load,
  `resetGrid`, `adoptPlayer`, meteor arming/detection, arcade leaderboard.

### Client

- **`app.js`** — orchestrates boot, intro, join/reconnect, camera, input, render loop, actions,
  mission progress, escape transit, meteor reset, reports/shares, abandon/new-pilot.
- **`renderer.js`** — mixed-depth spherical Canvas renderer for the game: projected/slerp-tessellated
  edges, biome underlay + ownership, hidden ore markers, labels-on-interaction, particles, starfield.
- **`icosahedron-viewer.js`** — WebGL reference viewer: a full-screen ray–sphere shader draws the
  front surface only; analytic great-circle icosahedron edge bands; no back faces/edges.
- **`world.js`** — client-side adaptive tree mirror of the server leaves; label parsing, cell
  updates, terrain cache, per-cell lock state.
- **`ui.js`** — all DOM: landing/tag, HUD, mission/planet badge, drawers, target sheet, toasts,
  confirm dialog, report overlay, responsive layout switching.
- **`intro.js`** — launch cinematic state machine: wormhole → drift/gravity lock → descent; camera
  dolly, cockpit fade, steering (WASD/arrows/touch), skip/replay, reduced-motion.
- **`interlude.js`** — escape transit: launch burn → random story event → hull damage/shake →
  emergency landing; also meteor shockwave overlay.
- **`result-card.js`** — 1200×630 PNG card + share text; **`audio.js`** — synthesized WebAudio SFX.
- **`narrator.js` + `narrative-data.js`** — prerecorded narration engine and script. Voice/subtitle
  toggles are independent and persisted. Each cue is split into sentence units and mapped to
  `public/audio/voice/<profile>/<cue>__s<n>.m4a` generated by `scripts/generate-voice.mjs` (Kokoro-82M
  for GEORGE, macOS `say` + `afconvert` at 150–152 wpm for DANIEL/SAMANTHA) and played at 0.94×
  with a **220 ms** pause between sentences. Profiles are selectable and persisted. Dynamic server
  story ids map to prerecorded story clips; the transit hold sums the sentence durations. Subtitles
  show one sentence at a time and work even when voice autoplay is blocked. A small
  limited-concurrency warmup prefetches the first sentence of each cue at idle and warms the next
  sentence during playback. Audio URLs carry the generated content-derived key imported from
  `public/js/audio-version.js` and are served with immutable, long-lived cache headers. Open-source
  replacement options are documented in [VOICE.md](VOICE.md).
- **`story-copy.js`** — the copy SSOT (STR-02): Quick Guide steps, Field Manual sections, mission
  labels, per-kind incident copy, Captain's Log templates and the marked documentation blocks.
  Pure ESM with no DOM/Node access; imported by `ui.js`, `app.js`, `narrative-data.js`, the
  authority (`lib/world-core.js` for incident copy) and `scripts/sync-story-copy.mjs`.
- **`audio-version.js`** — generated by `scripts/generate-voice.mjs`; exports the single
  `AUDIO_VERSION` (`<package version>+<content hash8>`) imported by `narrator.js`.
- **`public/audio/voice/manifest.json`** — generated clip manifest (paths, bytes, sha256, duration,
  text hash, engine/licence) read by the verification gate and tests.
- **`shared/`** — pure modules used by both sides:
  - `geometry.js` — icosahedron, hierarchical labels, child triangles, slerp, camera/picking.
  - `sphere-interaction.js` — pure carrier frame/projection/unprojection/movement math.
  - `orbit-controls.js` — shared game drag/trackball/cursor-key primitives.
  - `planet.js` — seed-driven 3D noise terrain, biomes, geological deposit weights.
  - `resources.js` — 10-ore market, glyphs, colours, weighted rolls.
  - `mission.js` — planet depth/name, per-planet escape requirements, mission progress.

## Story copy contract (STR-02)

`public/js/story-copy.js` is the single source of player-facing prose. Numbers,
material names and planet names are parameters, never literals on a surface.

| Surface | Consumer | Rendering |
|---|---|---|
| Quick Guide card | generated `public/index.html` block + `ui.setGuideThreshold()` | static HTML at load, threshold text updated from live state |
| Field Manual | `ui.showManual(HELP_SECTIONS)` | DOM built from the module |
| Mission labels | `shared/mission.js` category names (asserted equal in tests) | HUD |
| Captain's Log | `app.js` via `captainLog()` | polite text region |
| Incidents | `lib/world-core.js` imports `INCIDENT_COPY` | overlay + Captain's Log |
| `GUIDE.md`, `GAMEPLAY.md` | marked blocks rendered by `scripts/sync-story-copy.mjs` | Markdown |

- **Blocks** are delimited by `<!-- story-copy:start <id> -->` … `<!-- story-copy:end <id> -->`
  in `GUIDE.md`, `GAMEPLAY.md` and `public/index.html`. Markers indented inside a list keep their
  indentation so generated prose stays part of that list item.
- **Ownership:** any change to guide, manual, incident or log wording is a change to
  `story-copy.js`. `scripts/sync-story-copy.mjs` is the only writer of a marked block; hand edits
  are detected by `--check` and must be re-rendered.
- **Change process:** edit the module → `node scripts/sync-story-copy.mjs --write` → run
  `node scripts/sync-story-copy.mjs --check` and `npm test`. Narration text changes additionally
  require `node scripts/generate-voice.mjs` (STR-01) because clips are generated from the script.
- **Grammar:** materials are mass nouns in prose (`2 Uranium`, `3 Silver`, `1 Palladium`);
  `plural()` supplies the countable-noun suffix table for everything else. A threshold is produced
  by `breakClicksFor(planetIndex, base)` (planet one caps at 4, deeper worlds use the configured
  value, default 8), so the guide, the docs and the tips state the same rule.
- **Tests:** `test/story-copy.test.js` proves the plural table, captain-log grammar, threshold
  rendering for planets 1/2/deeper, incident fallback, block cleanliness and a one-character
  drift failure.

## Narration assets and cache-bust (STR-01)

```text
narrative-data.js ─► scripts/generate-voice.mjs ─► public/audio/voice/<profile>/<cue>__s<n>.m4a
                         ├─► public/audio/voice/manifest.json   (clips, sha256, durations, text hashes)
                         └─► public/js/audio-version.js         (AUDIO_VERSION)
narrator.js ── imports AUDIO_VERSION ──► URL + cache key ──► <audio>
server.js ── .m4a immutable, HTML/JS/JSON no-store
```

- The generator is the only writer of the manifest and the version module; both are generated
  artefacts and are never hand-edited. Generation renders a temporary tree, validates every clip
  (non-zero bytes, ≥120 ms) and swaps it into place only after the whole matrix succeeds.
- `AUDIO_VERSION` is `${package.version}+${contentHash8}`, hashed over
  `profile|cueId|segment|textSha`. Same sentences = same key; a changed sentence = new key.
- `npm run voice:verify` re-derives the plan from `narrative-data.js`, checks the manifest, files,
  hashes, durations and version, and exits non-zero on any drift. `test/narration-manifest.test.js`
  proves the completeness identity (`Σ profiles Σ cues |segments(cue)| = manifest.clips.length`)
  and that no cue, sentence or profile reference is missing.
- The complete matrix is 40 cues × 115 sentence units × 3 profiles = 345 clips (~10.8 MB).
- Captions and clips share one sentence source (`narrationSegments()`), so CC cannot drift from
  the spoken audio; the existing `#narrative-subtitles` polite region is the only live region.

## Physics & interaction model

Authoritative rules live in [narimato-physics.md](narimato-physics.md):

- One planet object: the base spherical icosahedron, same 20 triangles at every camera height; no
  per-camera generated mesh or LOD swap.
- Camera = carrier `pos` + parallel-transported `up` on a concentric sphere; always faces centre.
- Cursor keys move the carrier along local Up/Right; wheel changes the carrier radius with fixed
  focal length (dolly, not optical zoom).
- Mouse rotates the **object**, not the camera, via exact surface-point unprojection + shortest-arc
  quaternion.
- WebGL reference viewer renders the front sphere surface only (no hidden back faces/edges).
- Object rotation and camera carrier are separate transforms.
- Full rationale and failure history: [narimato-physics.md](narimato-physics.md).

## Multiplayer model

- Identity is a **callsign token** (2–12 chars). A token maps to exactly one current planet in
  `DATA_DIR/planets/registry.json`.
- Each planet is an isolated **scene/room**: players, robots, leaderboard, grid, resources and SSE
  broadcasts are per-planet. Players on different planets never see each other's clicks or state.
- Every loaded planet runs its own robot staffing: target total online = 3 with humans
  (1 human→2 robots, 2→1, 3+→0; 0 humans→1 ambient robot). Robots spawn immediately when needed,
  leave when displaced, and run the same contest/explore click policy. Multiple robots per planet.
- Contest lock: the owner of a cell cannot charge it again after their own click until someone else
  clicks it. The client learns this from the 5th leaf slot (`lastClickIndex`) and suppresses
  pointless optimistic `+2` pulses; the server remains authoritative.
- Planet escape clones the pilot into the next planet scene: same tag/colour/token/player id and
  carried score, reset current-planet ore run; the previous clone remains an offline ghost on the
  old planet. The old SSE room is closed for that token.

## Data model

### Persisted planet (`world.json`)

```json
{
  "version": 2,
  "planetSeed": 4274951288,
  "terrainVersion": 2,
  "threshold": 8,
  "maxDepth": 2,
  "players": [{
    "id": "p_…", "tag": "PILOT", "color": "#00f0ff", "token": "uuid",
    "score": 1234, "clicks": 0, "breaks": 0, "claims": 0, "steals": 0,
    "ores": 2, "oreValue": 900, "oreCounts": { "silver": 1, "gold": 1 }
  }],
  "tree": [ { "label": "1", "owner": -1, "clicks": 0, "lastClickIndex": -1,
              "resourceId": "gold", "resourceFound": true, "children": null } ]
}
```

- Hidden deposits are **never** sent to clients; the wire leaf exposes only the discovered id.
- Writes use serialized atomic temp-file + rename, debounced per planet, flushed on shutdown.

### Wire leaf

```
[label, ownerIndex, clicks, discoveredResourceId|null, lastClickIndex]
```

### State (per planet, decorated by manager)

`serverTime`, `planetIndex`, `planetDepth`, `planetName`, `resources` (market), `planetSeed`,
`terrainVersion`, `threshold`, `maxDepth`, `maxDepthReached`, `faces`, `totalClicks`,
`totalBreaks`, `createdAt`, `players[]` (public fields incl. `oreCounts`), `arcade[]`.

### Registry

```json
{ "version": 1, "createdAt": 1794939691251, "tokens": { "<token>": 0 } }
```

## Protocols

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | aggregate health, `appVersion` (from `package.json`), loaded planets |
| GET | `/api/state?token=` | planet state (tokenless = planet 0) |
| GET | `/api/world?token=` | state + active leaves |
| GET | `/api/leaderboard?token=` | planet arcade |
| POST | `/api/join` | `{tag, token?}` → token, player, state, leaves, planet info |
| POST | `/api/action` | `{token, type:"click", label}` or `{token, type:"escape"}` |
| GET | `/api/events?token=` | SSE stream for the token's planet room |

SSE frames: `snapshot`, `state`, `cell`, `break`, `resource`, `toast`, `meteor`, plus `:hb`
heartbeats. Broadcasts are per-planet; state throttled ~1/s with immediate urgency on player/join
changes and 1 MiB backpressure protection.

### Escape action

`MISSION_INCOMPLETE` (409, includes progress) unless
`missionProgress(player.oreCounts, missionForPlanet(planetIndex)).ready`. On success:

```json
{ "ok": true, "planetIndex": 1, "planetDepth": 3, "planetName": "TATOOINE",
  "story": {"id":"space-storm","title":"SPACE STORM","tone":"danger","lines":["..."]},
  "token": "...", "player": {"id":"...","tag":"...","color":"#..."},
  "state": {...}, "leaves": [...] }
```

### Exhausted-planet incidents

When the last hidden deposit on a planet is mined, the core picks a random incident
(`meteor`/`nuclear`/`solar`/`alien`), re-seeds the crust, resets the grid to its base leaves
(players/scores/inventories preserved), and the manager broadcasts
`{type:"incident", kind, title, tone, message, description, planetIndex}` followed by a fresh
`snapshot` to that planet room only. The client renders a different full-screen effect per kind and
shows the `description` as a story paragraph plus a persistent Captain’s Log entry.

## Algorithms

- **Icosahedron:** regular icosahedron (12 cartographic points, 30 equal 63.435° edges, 20 congruent
  faces), geodesic midpoints normalized to the sphere.
- **Labels:** base 1–20; children 1–4 in the parent's gnomonic tangent chart, 1 = largest x+y,
  then clockwise, 4 = centre. Stable forever; digits always 1–4.
- **Picking:** ray–sphere intersection + spherical containment (not flat chord triangles).
- **Rendering:** arcs slerp-tessellated, mixed-depth culling/LOD, thin owner edges, and a cached
  high-resolution procedural geography mesh (continents/oceans/mountains/ice) drawn to an offscreen
  globe and composited beneath translucent ownership cells.
- **Planet surface:** one 32-bit seed → domain-warped 3D value-noise fBm (continents), ridged noise
  (mountains), latitude/elevation temperature, moisture noise → 10 biomes; no textures or
  heightmaps. Client and server run the same `terrainAt()`.
- **Deposits:** geological weights per biome; ocean/deep ocean never mineable from the surface.
  Each hidden deposit stores a server-only random `resourceFindClick` (1..breakClicks); mining occurs
  on that successful click at the latest by the break click. The field is persisted but never
  serialized to the client.
- **Depth/progression:** `planetDepth(i) = min(2+i, 8)` is the number of visible levels (first = 2,
  second = 3). The configured break cap is `levels - 1`, so planet 1 is base 20 + one 80-cell child
  generation and planet 2 adds the next 320-cell generation.
- **Mission:** per-planet requirements scale with index; progress derived from persistent
  `oreCounts`; escape validates identically server/client.
- **Camera:** depth-adaptive zoom steps, 0.45/zoom pan alignment, focus animations, intro dolly.

## Responsive UI

Three deliberate layouts, not just scaling:

- **Desktop >1024px:** command deck (mission + operators left, arcade right, world/score top,
  target inspector bottom).
- **Tablet ≤1024 / short-height:** planet-first, compact top strip, slide-over drawers, target sheet.
- **Mobile ≤640 portrait:** full-screen planet; safe-area dock; drawers; tap target sheet; 44–48px
  controls; touch steering pads in the intro.
- **Landscape phone:** vertical side dock/drawers, planet centered.

## Security & limits

- Tags are arcade identities, not authentication. Tokens are random UUIDs; the client stores one
  token per callsign locally.
- Hidden resources are server-only; no secret deposit data is transmitted.
- JSON bodies capped at 16 KiB; static paths sanitized (no traversal/backslash/NUL); no-store HTML
  and JS; no external assets.
- Hard depth ceiling 32; planet level cap 8 (break cap 7); bot counts limited; per-planet saves.
- Server is authoritative for scoring, ownership, locks, mining, escape and meteor.

## Configuration

| Env | Default | Meaning |
|---|---|---|
| `PORT` | 4173 | HTTP port |
| `HOST` | 0.0.0.0 | bind address |
| `DATA_DIR` | `./data` | planet world files + registry |
| `BREAK_CLICKS` | 8 | clicks to break a cell |
| `MAX_DEPTH` | 24 | safety cap (planet manager sets per-planet depth) |
| `BOTS` | 1 | robots per loaded planet |
| `BOT_*_MS` | see defaults | robot lifetime/gap/click timings |
| `DEPOSIT_CHANCE` | unset | optional override of biome deposit chance (mineable only) |

## Testing

The suite currently runs <!-- test-count:178 -->178<!-- /test-count --> tests. Behaviour ownership: [docs/TEST_MAP.md](docs/TEST_MAP.md).

- `test/geometry.test.js` — regular icosahedron, spherical coverage, labels, camera/picking.
- `test/sphere-interaction.test.js` — carrier projection/unprojection, point-follow, infinite local direction.
- Accept live browser checks: `scripts/verify-icosahedron-controls.mjs`,
  `scripts/verify-camera-carrier.mjs`, `scripts/verify-icosahedron-visual.mjs`.
- `test/planet.test.js` — deterministic terrain, poles ice, biome distribution, ocean non-mineable,
  terrain deposit weights, client/server parity.
- `test/mission.test.js` — requirements, per-planet scaling, depth progression, sanitization.
- `test/world-core.test.js` — config, identity/tokens, scoring, breaks, locks, resources, migration,
  robots, persistence, meteor/adopt/reset, arcade.
- `test/server.test.js` — HTTP/SSE, rooms, escape, persistence, static safety.
- `test/observability.test.js` — `/api/metrics` shape/aggregates, SSE counters, privacy (no
  tokens/tags/ids/hidden deposits), telemetry whitelist/clamping, 4 KB body cap, same-origin,
  rate limiting, and the Node-safe client beacon module.
- QA: Playwright viewport suites (desktop/tablet/mobile/landscape), intro/interlude/meteor,
  report/card, abandon/new-pilot.

## Deployment

```bash
npm test
DATA_DIR=/var/lib/narimato PORT=4173 node server.js
```

- Planet 0 lives at `DATA_DIR/world.json`; later planets under `DATA_DIR/planets/pN/`.
- First boot after an older single-world version migrates planet 0: players/scores/ores/tokens are
  preserved, but the grid is reset to the new 2-level planet (20 + 80). Existing worlds whose tree
  is deeper than the configured level cap are also rebuilt on load. Fresh/reset planets guarantee
  enough hidden deposits of each refit ore to make the mission completable.
- Back up `DATA_DIR` before upgrades. Static assets are served no-store by the game server.
- Any reverse proxy/tunnel can front the HTTP port; SSE needs buffering disabled
  (`X-Accel-Buffering: no` is already sent).
