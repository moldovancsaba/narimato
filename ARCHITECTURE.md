# NARIMATO — Architecture

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Client | Vanilla HTML/CSS/ES modules | no framework, no bundler, no runtime npm deps |
| Rendering | Canvas 2D | geodesic sphere, biomes, ownership, ore markers, particles |
| Simulation | Node.js ≥20 | authoritative game server, HTTP + Server-Sent Events |
| Persistence | JSON files + atomic rename | one file per planet, one registry file |
| Tests | `node:test` | 66 tests, no test dependencies |
| CI | GitHub Actions | Node 20 and 22, `npm test` |
| Deploy | `node server.js` behind any static/reverse proxy | Cloudflare tunnel used for the live build |

Zero npm dependencies is intentional: the entire game ships as readable source and starts with
`npm start`.

## Runtime topology

```
Browser
  index.html ── app.js ──┬─ renderer.js  (Canvas 2D)
                         ├─ world.js     (client adaptive tree)
                         ├─ ui.js        (responsive HUD/DOM)
                         ├─ intro.js     (cockpit launch cine)
                         ├─ interlude.js (interplanetary storm/meteor cine)
                         └─ result-card.js
             shared/     geometry.js · planet.js · resources.js · mission.js
                 │
                 │ REST /api/*  +  SSE /api/events?token=…
                 ▼
Node server.js
  ├─ static file server (public/)
  └─ lib/planet-manager.js
        ├─ registry.json        token → planetIndex
        ├─ Planet 0 WorldCore   DATA_DIR/world.json
        ├─ Planet 1 WorldCore   DATA_DIR/planets/p1/world.json
        └─ Planet n WorldCore   on demand · per-planet robots · per-planet SSE rooms
```

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
- **`renderer.js`** — mixed-depth spherical Canvas renderer: projected/slerp-tessellated edges,
  biome underlay + ownership, hidden ore markers, labels-on-interaction, particles, starfield.
- **`world.js`** — client-side adaptive tree mirror of the server leaves; label parsing, cell
  updates, terrain cache, per-cell lock state.
- **`ui.js`** — all DOM: landing/tag, HUD, mission/planet badge, drawers, target sheet, toasts,
  confirm dialog, report overlay, responsive layout switching.
- **`intro.js`** — launch cinematic state machine: wormhole → drift/gravity lock → descent; camera
  dolly, cockpit fade, steering (WASD/arrows/touch), skip/replay, reduced-motion.
- **`interlude.js`** — escape transit: launch burn → random story event → hull damage/shake →
  emergency landing; also meteor shockwave overlay.
- **`result-card.js`** — 1200×630 PNG card + share text; **`audio.js`** — synthesized WebAudio SFX.
- **`shared/`** — pure modules used by both sides:
  - `geometry.js` — icosahedron, hierarchical labels, child triangles, slerp, camera/picking.
  - `planet.js` — seed-driven 3D noise terrain, biomes, geological deposit weights.
  - `resources.js` — 10-ore market, glyphs, colours, weighted rolls.
  - `mission.js` — planet depth/name, per-planet escape requirements, mission progress.

## Multiplayer model

- Identity is a **callsign token** (2–12 chars). A token maps to exactly one current planet in
  `DATA_DIR/planets/registry.json`.
- Each planet is an isolated **scene/room**: players, robots, leaderboard, grid, resources and SSE
  broadcasts are per-planet. Players on different planets never see each other's clicks or state.
- Every loaded planet runs its own robot operator (creative callsign, random colour, joins/leaves,
  contests human cells and mines).
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
| GET | `/api/health` | aggregate health, loaded planets |
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
{ "ok": true, "planetIndex": 1, "planetDepth": 3, "planetName": "ICOSA-10",
  "story": {"id":"space-storm","title":"SPACE STORM","tone":"danger","lines":["..."]},
  "token": "...", "player": {"id":"...","tag":"...","color":"#..."},
  "state": {...}, "leaves": [...] }
```

### Meteor reset

When the last hidden deposit on a planet is mined, the core re-seeds the crust, resets the grid to
its base leaves (players/scores/inventories preserved), and the manager broadcasts
`{type:"meteor", planetIndex, message}` followed by a fresh `snapshot` to that planet room only.

## Algorithms

- **Icosahedron:** regular icosahedron (12 cartographic points, 30 equal 63.435° edges, 20 congruent
  faces), geodesic midpoints normalized to the sphere.
- **Labels:** base 1–20; children 1–4 in the parent's gnomonic tangent chart, 1 = largest x+y,
  then clockwise, 4 = centre. Stable forever; digits always 1–4.
- **Picking:** ray–sphere intersection + spherical containment (not flat chord triangles).
- **Rendering:** arcs slerp-tessellated, mixed-depth culling/LOD, thin owner edges, biome underlay.
- **Planet surface:** one 32-bit seed → domain-warped 3D value-noise fBm (continents), ridged noise
  (mountains), latitude/elevation temperature, moisture noise → 10 biomes; no textures or
  heightmaps. Client and server run the same `terrainAt()`.
- **Deposits:** geological weights per biome; ocean/deep ocean never mineable from the surface.
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

- `test/geometry.test.js` — regular icosahedron, spherical coverage, labels, camera/picking.
- `test/planet.test.js` — deterministic terrain, poles ice, biome distribution, ocean non-mineable,
  terrain deposit weights, client/server parity.
- `test/mission.test.js` — requirements, per-planet scaling, depth progression, sanitization.
- `test/world-core.test.js` — config, identity/tokens, scoring, breaks, locks, resources, migration,
  robots, persistence, meteor/adopt/reset, arcade.
- `test/server.test.js` — HTTP/SSE, rooms, escape, persistence, static safety.
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
