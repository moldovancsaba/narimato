# NARIMATO — Architecture

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [SSOT-01](https://github.com/moldovancsaba/narimato/issues/1) · [SSOT-03](https://github.com/moldovancsaba/narimato/issues/3) · [QA-01](https://github.com/moldovancsaba/narimato/issues/5) · [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) · [UI-01](https://github.com/moldovancsaba/narimato/issues/7) · [RND-01](https://github.com/moldovancsaba/narimato/issues/14) · [RND-02](https://github.com/moldovancsaba/narimato/issues/15) · [RND-03](https://github.com/moldovancsaba/narimato/issues/16) · [RND-04](https://github.com/moldovancsaba/narimato/issues/17) · [RND-06](https://github.com/moldovancsaba/narimato/issues/19) · [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) · [TST-01](https://github.com/moldovancsaba/narimato/issues/25) · [EVT-01](https://github.com/moldovancsaba/narimato/issues/32) · [STR-01](https://github.com/moldovancsaba/narimato/issues/35) · [STR-02](https://github.com/moldovancsaba/narimato/issues/36) · [OPS-03](https://github.com/moldovancsaba/narimato/issues/40) · [OPS-05](https://github.com/moldovancsaba/narimato/issues/42) · [SEC-01](https://github.com/moldovancsaba/narimato/issues/43) · [PERF-01](https://github.com/moldovancsaba/narimato/issues/44)
<!-- delivery-ssot:end -->

Architecture decisions are recorded as ADRs: [docs/adr/README.md](docs/adr/README.md).

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Client | Vanilla HTML/CSS/ES modules + committed GDS island bundle | no runtime npm deps; a dev-time Vite/React build compiles `ui/src/` into `public/ui/` |
| Rendering | Canvas 2D + WebGL | game planet: Canvas 2D; spherical-icosahedron reference viewer: WebGL ray–sphere shader |
| Simulation | Node.js ≥20 | authoritative game server, HTTP + Server-Sent Events |
| Persistence | JSON files + atomic rename | one file per planet, one registry file |
| Tests | `node:test` | <!-- test-count:351 -->351<!-- /test-count --> tests, no test dependencies; ownership map in [docs/TEST_MAP.md](docs/TEST_MAP.md) |
| CI | GitHub Actions | Node 20 and 22, `npm test`; Node 22 GDS island build, contract gate and determinism proof |
| Deploy | `node server.js` behind any static/reverse proxy | Cloudflare tunnel used for the live build |

Zero npm dependencies is intentional: the entire game ships as readable source and starts with
`npm start`. Voice-over and screenshot assets are generated locally and committed; there are no
third-party runtime requests.

## Runtime topology

```
Browser
  index.html ── app.js ──┬─ renderer.js          (one Canvas 2D game planet + surface entities)
                         ├─ world.js             (client adaptive tree)
                         ├─ ui.js                (responsive HUD/DOM, one tree for both views)
                         ├─ surface-controller.js (pose + harvest + surface entities; no canvas)
                         ├─ intro.js             (cockpit launch cine)
                         ├─ interlude.js         (interplanetary storm/meteor cine)
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

Recovery tooling: `scripts/backup-data.mjs` · `scripts/verify-data.mjs` · `scripts/restore-data.mjs`
(shared logic in `lib/data-integrity.js`; runbook [docs/RECOVERY.md](docs/RECOVERY.md)).
SLO tooling: `observability/slo.json` · `lib/slo.js` · `scripts/check-slo.mjs`.

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

- **`app.js`** — orchestrates boot, intro, join/reconnect, camera, input, the single render loop,
  actions, mission progress, escape transit, meteor reset, reports/shares, abandon/new-pilot. It owns
  the `orbit`/`surface` view state: entering stores the orbital camera and switches camera + input;
  exiting restores it exactly.
- **`renderer.js`** — mixed-depth spherical Canvas renderer for the game: projected/slerp-tessellated
  edges, biome underlay + ownership, hidden ore markers, labels-on-interaction, particles, starfield.
  It is the single renderer for both views: `setSurfaceMode({ active, entities, phase, progress })`
  turns on the surface entity pass (avatars, pins, beams, harvest FX, landing ship) on the same
  `#arena-canvas`.
- **`surface-controller.js`** — surface mode as a control mode: pilot pose, movement, harvest
  targeting, peer resolution and the `SurfaceEntity[]` list consumed by the renderer. It owns no
  canvas, no RAF loop and no projection.
- **`icosahedron-viewer.js`** — WebGL reference viewer: a full-screen ray–sphere shader draws the
  front surface only; analytic great-circle icosahedron edge bands; no back faces/edges.
- **`world.js`** — client-side adaptive tree mirror of the server leaves; label parsing, cell
  updates, terrain cache, per-cell lock state, and the monotonic `revision` that gates surface
  geometry rebuilds (RND-04).
- **`ui.js`** — all DOM: landing/tag, HUD, mission/planet badge, drawers, target sheet, toasts,
  confirm dialog, report overlay, responsive layout switching. It is the only HUD writer: orbit
  nodes stay mounted across view changes, and surface mode only toggles `#hud[data-mode]` plus the
  `#surface-controls` strip (target, lap, movement pads, exit).
- **GDS island** — the approved DOM UI path (UI-01). `ui/src/` is React + `@sovereignsquad/gds`;
  `npm run build:ui` compiles it into the committed `public/ui/{island.js,island.css,manifest.json}`
  served by the static handler. `public/js/gds-adapter.js` resolves `?gds=0|1|proof` /
  `localStorage['narimato.gds']` and maps the frozen `UI` API onto island slices;
  `public/js/gds-boot.js` boots one `GdsProvider`/React root and falls back to the legacy UI with a
  dismissible banner on failure. Details: [docs/GDS_INTEGRATION.md](docs/GDS_INTEGRATION.md).
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
  - `geometry.js` — icosahedron, hierarchical labels, child triangles, slerp, `SphereCamera`, picking.
  - `camera-contract.js` — the `CameraView` interface every renderer camera implements:
    `project`, `unprojectView`, `viewAxis`, `unprojectScreen`, `setViewport`, units and invariants.
  - `surface-camera.js` — `SurfaceCamera` on the same contract: legacy close-frame and carrier
    framing (dolly 1.08…1.72, bounded tilt, screen inverse) selected by `?surface-camera`.
  - `live-surface-mesh.js` — `LiveSurfaceMesh` / `LiveSurfaceStore`: the surface triangle buffer
    derived from the live leaf list, revision-gated, budget-clamped and hash-deterministic.
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
- One camera interface: `public/js/shared/camera-contract.js` declares the members `IcosaRenderer`
  reads (`project`, `viewAxis`, `distance`, `zoom`, `width`, `height`, `focalPx`, `nearPlane`,
  `unprojectView`, `unprojectScreen`, `setViewport`); `z = dot(point, viewAxis())` for every camera.
- Surface framing is a camera mode, not a second projection: `SurfaceCamera` reuses the same
  contract and the same planet geometry.
- Mouse rotates the **object**, not the camera, via exact surface-point unprojection + shortest-arc
  quaternion.
- WebGL reference viewer renders the front sphere surface only (no hidden back faces/edges).
- Object rotation and camera carrier are separate transforms.
- Full rationale and failure history: [narimato-physics.md](narimato-physics.md).

## Single-scene surface mode

There is one planet, one renderer, one canvas and one HUD. Surface mode is a camera and control
mode change, not a second scene:

```
enterSurfaceMode():
  savedOrbit = saveOrbit(camera)            // {yaw, pitch, zoom, distance}
  controller.start({planetName, seed, depth})
  view = "surface"
  renderer.setSurfaceMode({active: true, entities: []})

frame():
  if view == "surface":
    controller.update(dt)
    surfaceCamera.setPose(controller.pose())
    renderer.setSurfaceMode({active: true, entities: controller.entities(),
                             phase, progress, effects})
    renderer.render(surfaceCamera, t)
  else:
    renderer.setSurfaceMode({active: false})
    renderer.render(camera, t)

exitSurfaceMode():
  controller.stop(); renderer.setSurfaceMode({active: false})
  restoreOrbit(camera, savedOrbit); view = "orbit"
```

- `#arena-canvas` is the only planet canvas; `#surface-canvas` and the overlay RAF loop were deleted.
- Entities reference cells by label (`cellLabel`), never by copied `a`/`b`/`c` geometry.
- Surface entities: `kind` is `self`, `peer`, `pin` or `beam`; one `byLabel` map serves both views.
- `window.__ICOSA__.surfaceMode()` returns `{ active, phase, entities, canvasCount }`.
- Surface geometry is live: `renderer.setLiveSurface({ leaves, revision, seed })` rebuilds at most
  once per frame when `World.revision` (or the planet seed/theme) changes. No seed-keyed globe and
  no `setPlanetSurface()` remain; `renderer.surfaceMeshStats()` reports revision, triangles,
  buckets, hash, rebuild time and no-op skips.
- `window.__ICOSA__.renderer` is the same instance before, during and after surface entry.
- Rollback `?surface-renderer=overlay` is recognised but fails closed to the single-scene renderer
  (the overlay module was removed); a full rollback is `git revert` of the RND-02 commit.

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
- **Surface poses are transient and server-owned (SRV-01).** Every online player — human or
  robot — has at most one `SurfacePose` in `WorldCore._poses`. The old server-only
  `player.surfacePose` and the separate robot `player.surface` record are gone: humans and robots
  publish one shape through one revision stream (`poseRev`). A pose is accepted at most once per
  `POSE_MIN_INTERVAL_MS` (60 ms), coalesced to one `surface` frame per player per
  `POSE_FRAME_INTERVAL_MS` (100 ms, ≤ 10 Hz), and expires after `POSE_TTL_MS` (5 s) of silence.
  Validation rejects non-finite, zero-length and out-of-range positions, points outside every
  active leaf and unknown states without mutating state. `surface_leave` fires exactly once with a
  closed `reason`: `leave`, `disconnect`, `expire`, `escape`, `reset` or `robot`.
- **Robot routes are seeded, bounded and human-independent (SRV-02).** Each spawn builds a
  `RobotRoute` from `hash32(planetSeed, planetIndex, spawnSerial)` — 1–4 active-leaf waypoints with
  interior standing points, total arc ≤ `ROUTE_MAX_ARC` (2.4 rad) — and advances an
  `idle → turn → walk → mine` state machine at one fixed step per 100 ms pump tick. Route
  computation reads no human pose, so humans joining or leaving cannot change a route, and a route
  digest repeats from the same planet seed and spawn serial.
- **Robot mining resolves the pose cell through one resolver (SRV-03).** `WorldCore.resolveLeaf()`
  is the single containment resolver used by pose validation, robot mining and supply placement.
  A robot mines only the leaf its authoritative pose stands on, clicks with its own token through
  `WorldCore.click()`, and emits `surface_mine` only for an awarded click. A target elsewhere becomes
  a `travel` intent, and the `cell`/`break` frames precede the beam in the same drained batch.
- **Emergency supply relocation is server-side (SRV-04).** A drop computes one deterministic,
  collision-safe `SupplyFocus` placement per online human (golden-angle spiral inside the supply
  cells, minimum separation 0.06 rad, capped at 24), writes those poses into `_poses`, and exposes
  the focus with a 120 s TTL through `snapshot.focus`, the join response and the additive
  `supply_focus` frame. The legacy `supply` frame still marks cells for older clients.
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

`state.players[]` carries an optional `surface` object for every live pose (humans and robots
share it). It is transient: absent for offline players and removed when the pose expires or leaves.

### Surface pose (transient, `WorldCore._poses`)

```ts
type SurfacePose = {
  playerId: string; tag: string; color: string;
  leaf: string;                         // active leaf holding the position
  pos: Vec3;                            // unit position
  local: { x: number; y: number };      // gnomonic chart coordinates around the leaf centroid
  heading: Vec3;                        // unit tangent; heading · pos = 0
  bearingRad: number;                   // [0, 2π) in the leaf chart
  state: "idle" | "walk" | "turn" | "mine";
  moving: boolean; updatedAt: number; rev: number;
};
```

`rev` strictly increases per planet and restarts at 0 with the process; equal or lower revisions are
never produced. Poses are room-scoped, never persisted and never carry tokens.

### Robot route (transient, seeded)

```ts
type RobotRoute = {
  playerId: string; seed: number; serial: number;
  waypoints: { leaf: string; pos: Vec3; arriveAt: number }[];  // 1..4
  index: number; state: "idle" | "walk" | "turn" | "mine";
  stateSince: number; stateUntil: number; replans: number;
  intent: { kind: "travel" | "mine"; leaf: string | null };
};
```

Re-plan triggers are `complete`, `ttl` (30 s), `stale_leaf` (the waypoint label retired) and
`blocked` (the contest lock rejected the click); each increments `replans` and advances the seed by
one. `routeDigest()` is the determinism evidence (planet seed + spawn serial + plan + progress).

### Supply focus (advisory, 120 s TTL)

```ts
type SupplyFocus = {
  planetIndex: number; impactLabel: string; impactPos: Vec3 | null;
  cells: { label: string; resourceId: string }[];
  resources: Resource[];
  placements: { playerId: string; leaf: string; pos: Vec3; local: {x,y}; heading: Vec3; bearingRad: number }[];
  rev: number; expiresAt: number; message: string;
};
```

The placement order is deterministically derived from the online human order, so two servers agree
for the same planet seed and revision. Placements are capped at 24, never persist, and expire by
timestamp check (no timers). Retired cells are filtered and affected humans fall back to a
surviving supply cell. The focus arrives as `snapshot.focus`, on the join response and in the
`supply_focus` frame.

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
| POST | `/api/action` | `{token, type}`: `click`, `escape`, `supply`, `surface`, `surface_leave` (robots never call HTTP) |
| GET | `/api/events?token=` | SSE stream for the token's planet room |

SSE frames: `snapshot` (with `focus`), `state`, `cell`, `break`, `resource`, `surface`,
`surface_leave`, `surface_mine`, `supply`, `supply_focus`, `toast`, `incident`, plus `:hb`
heartbeats. Broadcasts are per-planet; state throttled ~1/s with immediate urgency on player/join
changes and 1 MiB backpressure protection. Surface frames are coalesced to ≤ 10 Hz per player and
are flushed by the 100 ms pump, never directly from a request handler.

### Surface and mining contracts

```jsonc
// POST /api/action {type:"surface"}
{ "token": "uuid", "type": "surface", "pos": {"x":0.5773,"y":0.5773,"z":0.5773},
  "heading": {"x":-0.7071,"y":0.7071,"z":0}, "state": "walk", "moving": true }
// 200
{ "ok": true, "planetIndex": 0, "playerId": "p_9f3c1a", "rev": 41, "leaf": "9.2.3",
  "updatedAt": 1760000000123, "pos": {...}, "heading": {...}, "bearingRad": 0.7,
  "state": "walk", "moving": true }
// 409 NOT_JOINED | INVALID_POSE | INVALID_STATE | POSE_RATE_LIMIT  (no mutation)
```

`heading` accepts either a number (legacy bearing) or a tangent vector; a zero-length vector falls
back to the leaf east basis. `surface_leave` clears the pose with `reason:"leave"`. The `surface`
frame carries the same pose shape as `state.players[].surface`; `surface_leave` carries
`playerId` and the closed `reason`.

`surface_mine` is additive and ordered: `type`, `playerId`, `tag`, `color`, `label` (the leaf that
changed), `pos` (pose at click time), `resourceId | null`, `points`, `kind`, `broke`, `rev`. The
`cell`/`break` frame for that label always precedes it in the same drained batch.

`supply_focus` is additive: `type`, `impactLabel`, `impactPos`, `cells`, `resources`,
`placements`, `rev`, `expiresAt`, `message`. The legacy `supply` frame is unchanged, so older
clients keep marking cells.

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

## Security headers and abuse limits

Server authority: tags are arcade identities, not authentication; tokens are random UUIDs and the
client stores one per callsign locally. Hidden resources are server-only. Hard depth ceiling 32;
planet level cap 8 (break cap 7); bot counts limited; per-planet saves. The server is authoritative
for scoring, ownership, locks, mining, escape, meteor, surface poses, robot routes, robot click
targets and supply placements — clients may describe where they think they are, never who they are
or which cell they own.

`SECURITY_MODE=compat|enforce` controls the browser-facing policy (`lib/security.js`,
`lib/rate-limit.js`). The default is `enforce` when `NODE_ENV=production` and `compat` otherwise, so
local development and the test suite reproduce the pre-hardening surface until hardening is
requested. `compat` sends no security headers and keeps origin checks off for join/action/SSE (the
telemetry same-origin check stays on in both modes); limits stay off except the telemetry bucket.
Static path safety (dotfiles, traversal, symlink containment) is **unconditional** because serving
`.env` or a symlink escape is a vulnerability, not a tunable.

Request pipeline: `headerPolicy → originPolicy → limiter → bodyCap → route`. Rejections are
`403 CROSS_ORIGIN` (before body parsing), `429 RATE_LIMITED` with `Retry-After`/`retryAfterMs`, and
`413 PAYLOAD_TOO_LARGE`; SSE refusals are `429` with `Retry-After: 30`.

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self'`; `style-src 'self'`; `img-src 'self' data: blob:`; `font-src 'self'`; `media-src`/`connect-src` `'self'` plus the exact `ASSET_BASE_URL` origin; `worker-src`/`manifest-src 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'none'`; `form-action 'self'` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — **HTTPS only** (`req.socket.encrypted`, or `X-Forwarded-Proto: https` when `TRUST_PROXY=1`) |

| Limit | Default | Scope |
|---|---|---|
| join | 10 / 60 s, burst 10 | per IP |
| action | `ceil(1000 / CLICK_COOLDOWN_MS) * 2` (50/s at 40 ms) | per token |
| action (address) | 4× the per-token ceiling (200/s at 40 ms) | per IP |
| telemetry | 30 / 60 s | per IP |
| failed token attempts | 30 / 60 s (SSE `401`s) | per IP |
| SSE streams | 4 per IP, 2000 global; one stream per token replaces the previous | per IP / process |

Surface pose frames are client-pushed through the same `action` route at roughly 10 Hz, so they
consume the per-token and per-IP action buckets; the defaults leave headroom (10 Hz vs the derived
50/s token and 200/s address ceilings) and every limit is env-tunable for shared-address (NAT)
deployments: `LIMIT_<JOIN|ACTION|ACTION_IP|TELEMETRY|AUTH>_{MAX,WINDOW_MS,BURST}`.
SSE admission counts one stream per tab, so the per-IP cap bounds tabs per address.

Origin allowlisting is exact scheme+host (`ALLOWED_ORIGINS` or the request `Host`), never a suffix
match or `*`. Missing `Origin` is allowed only for safe methods and telemetry; writes need a match
in enforce mode. `X-Forwarded-For`/`-Proto` are ignored unless `TRUST_PROXY=1`. No IP, token or
header is logged; abuse is counted in `/api/metrics` `security` (`rateLimited`, `bodyTooLarge`,
`crossOrigin`, `sseRefused`, `traversalBlocked`, `authFailures`, `sseReplaced`).

Rollback: set `SECURITY_MODE=compat` and restart (no data/schema change), or `git revert` the
delivery commit. `SECURITY_HEADERS=off` disables the header set while leaving limits on.

## Persistence recovery

`DATA_DIR` holds the only copy of players, callsigns and the token→planet registry. The recovery
path is documented and executable in [docs/RECOVERY.md](docs/RECOVERY.md):

- `scripts/backup-data.mjs` — deterministic checksummed `.tar.gz` + manifest beside it (0700
  directory, 0600 files).
- `scripts/verify-data.mjs` — read-only integrity verdict (exit `0/3/4/5/7`).
- `scripts/restore-data.mjs` — staged extract → digest verify → registry/world reconcile → two-rename
  swap; the previous directory is retained as `DATA_DIR.pre-restore-<UTC stamp>`.
- `scripts/recovery-test.mjs` (`npm run recovery:test`) — rehearses the drill on throwaway data.

A corrupt `world.json` is quarantined to `world.json.corrupt-<UTC stamp>` and startup is refused
unless `ALLOW_EMPTY_WORLD=1`; a newer `PERSIST_VERSION` is never downgraded. RPO ≤ 5.5 min (save
debounce 0.5 min + 5 min backup interval), RTO ≤ 15 min; retention is 7 daily + 24 hourly.

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
| `ALLOW_EMPTY_WORLD` | `0` | boot a fresh world after a corrupt world file was quarantined (OPS-03) |
| `SECURITY_MODE` | `compat` (`enforce` when `NODE_ENV=production`) | `compat`/`enforce` browser policy (SEC-01) |
| `ALLOWED_ORIGINS` | unset (self-host match) | comma-separated exact origins allowed for writes |
| `MAX_SSE_PER_IP` | 4 | per-address SSE stream cap (enforce) |
| `MAX_SSE_GLOBAL` | 2000 | process-wide SSE stream cap (enforce) |
| `TRUST_PROXY` | `0` | honour `X-Forwarded-For`/`-Proto` from a trusted proxy |
| `LIMIT_<RULE>_MAX` / `_WINDOW_MS` / `_BURST` | per-rule defaults above | tune `JOIN`, `ACTION`, `ACTION_IP`, `TELEMETRY`, `AUTH` buckets without a code change |
| `SECURITY_HEADERS` | unset | `off` disables the header set while leaving limits on |
| `BACKUP_DIR` | `DATA_DIR-backups` | backup output directory for the operator scripts |

## Testing

The suite currently runs <!-- test-count:351 -->351<!-- /test-count --> tests. Behaviour ownership: [docs/TEST_MAP.md](docs/TEST_MAP.md).

```bash
npm test                 # node:test suite (351 tests)
npm run check:slo        # evaluate observability/slo.json against /api/metrics (0/1/2/3)
npm run recovery:test    # backup -> verify -> restore drill on throwaway data
npm run docs:check       # R1-R6 repository SSOT gate
npm run check:version    # version SSOT gate
node scripts/test-count.mjs  # documented count == executed count
```

- `test/geometry.test.js` — regular icosahedron, spherical coverage, labels, camera/picking.
- `test/sphere-interaction.test.js` — carrier projection/unprojection, point-follow, infinite local direction.
- Accept live browser checks: `scripts/verify-icosahedron-controls.mjs`,
  `scripts/verify-camera-carrier.mjs`, `scripts/verify-icosahedron-visual.mjs`.
- `test/camera-contract.test.js`, `test/surface-camera.test.js`, `test/surface-render.test.js` — the
  shared camera contract, carrier surface framing, and the single-scene view state machine.
- `test/hud-parity.test.js` — one mounted HUD tree, stable `data-hud-node` ids and surface-only additions.
- `test/live-mesh.test.js` — world revision monotonicity, level formula, budget clamp, determinism hash,
  break delta and the no-op fast path.
- `test/planet.test.js` — deterministic terrain, poles ice, biome distribution, ocean non-mineable,
  terrain deposit weights, client/server parity.
- `test/mission.test.js` — requirements, per-planet scaling, depth progression, sanitization.
- `test/world-core.test.js` — config, identity/tokens, scoring, breaks, locks, resources, migration,
  robots, persistence, meteor/adopt/reset, arcade; plus surface pose validation/rate/TTL/rev,
  seeded robot routes and replan triggers, resolver-driven robot mining, and supply placements.
- `test/server.test.js` — HTTP/SSE, rooms, escape, persistence, static safety; plus surface
  pose/leave frames, rate-limit and TTL rejection paths, SSE disconnect and room isolation,
  robot frame progression, `surface_mine` ordering and supply focus convergence.
- `test/gds-manifest.test.js` — committed island manifest, content-hash version, gzip budgets, GDS-only
  source rules, mount contract and MIME/`no-store` serving of `public/ui/*`.
- `test/gds-adapter.test.js` — flag precedence, frozen `UI` API mapping, safe degradation, one-retry boot,
  fallback banner and guarded stale-chunk reload.
- `test/observability.test.js` — `/api/metrics` shape/aggregates, SSE counters, privacy (no
  tokens/tags/ids/hidden deposits), telemetry whitelist/clamping, 4 KB body cap, same-origin,
  rate limiting, and the Node-safe client beacon module.
- `test/slo-contract.test.js` — executable SLO contract: ruleset schema, path resolution, warm-up,
  growth maths, checker exit codes `0/1/2/3`, docs-vs-rules drift, privacy of rules/output.
- `test/rate-limit.test.js` — pure token bucket: refill, burst, `retryAfter`, clock injection,
  key isolation, eviction bound.
- `test/security.test.js` — header matrix, exact-origin policy, join/action/telemetry limits, body
  caps, static dotfile/symlink denial, SSE admission/replacement/global cap, token guessing, IP-free
  counters, compat rollback.
- `test/data-integrity.test.js` — manifest/tar determinism and safety, reconciliation, retention,
  exit codes, staging extraction.
- `test/recovery.test.js` — real backup → verify → restore drill, corruption quarantine,
  `ALLOW_EMPTY_WORLD`, registry reconciliation, failed-restore safety.
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
- Back up `DATA_DIR` before upgrades with `node scripts/backup-data.mjs --data-dir <dir> --out <backupDir>`
  and verify it with `node scripts/verify-data.mjs --archive <file>` (see [docs/RECOVERY.md](docs/RECOVERY.md)).
  Static assets are served no-store by the game server, including the committed GDS island under
  `public/ui/`; `npm run build:ui` is only required after editing `ui/src/`.
- Any reverse proxy/tunnel can front the HTTP port; SSE needs buffering disabled
  (`X-Accel-Buffering: no` is already sent).
