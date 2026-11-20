# NARIMATO — INFINITE GRID (v2 spec, supersedes round mode)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [SRV-01](https://github.com/moldovancsaba/narimato/issues/20) · [SRV-03](https://github.com/moldovancsaba/narimato/issues/22)
<!-- delivery-ssot:end -->

Persistent, never-ending, multiplayer sphere. No rounds, no lobby wait, no timer, no end.
Players join and play immediately; the same world keeps every change forever (across visits and
server restarts). Every triangle charges with clicks and **breaks individually** into its four
children at a threshold. Players zoom from the whole sphere down to the deepest face — and back out.

## 1. World model

- Base: the regular spherical icosahedron from `public/js/shared/geometry.js` — 20 faces
  labelled `"1"…"20"`, level/depth 0.
- A face ("cell") is `{ label, depth, a, b, c, centroid, ownerId|null, clicks, children|null }`.
  Active cells ("leaves") are cells with `children === null`.
- **Contest lock (anti-speed-run):** a player who owns a cell cannot click it again while the
  previous click on that cell was also theirs. Another operator must click the cell first. The
  server rejects this with `OWN_CELL_LOCKED` (zero mutation) and persists a per-cell
  `lastClickIndex`; children created by a break inherit the owner and `lastClickIndex = owner`,
  so the breaker cannot immediately charge the fresh children. Steal/contest clicks by other
  players stay unchanged, producing alternating-contest progression.
- **Individual breaking** (only that cell, never all):
  - Every successful click adds `+1` to the clicked leaf's `clicks` and awards points.
  - When `clicks >= BREAK_CLICKS` (default **8**) and `depth < MAX_DEPTH` (default **8**), that
    leaf subdivides into its four children (`childTriangles(a,b,c)` + `childLabelOrder` labels,
    e.g. `9.2` → `9.2.1 … 9.2.4`). Only that cell is replaced; all other cells stay untouched.
  - Children inherit the parent's owner, start at `clicks = 0`, and are active immediately.
    The breaker gets a break bonus.
  - At `MAX_DEPTH` cells never break further; clicks still score. Their label paths have at most
    `MAX_DEPTH+1` parts (base + MAX_DEPTH child digits).
- Numbering is the hierarchical label scheme already implemented: base `1–20`, then `.1–.4` per
  break (child 1 = largest local x+y, 2/3 clockwise, 4 = centre). Labels are stable forever.
- Player-owned state persists: scores, clicks, breaks, claims, steals, held faces, tag, color,
  token. Players are append-only in the array so owner indexes stay stable for clients.
- No bots, no phases, no rounds. The world is always live.
- **Zoom**: camera `zoom` range `0.4 … 16777216`; wheel zooms; double-click on a face smoothly
  centres/focuses it (and zooms deeper); zoom back out to see the whole sphere.

## 1b. Physics & interaction model

Authoritative rules live in [narimato-physics.md](narimato-physics.md):

- **One object**: the 20-face spherical icosahedron; every camera height uses the same triangles.
  No per-camera generated mesh, no adaptive density, no LOD swap.
- **One camera**: carrier `pos` + parallel-transported `up` on a concentric orbit sphere. Cursor
  keys move the carrier locally (`Up` keeps moving up and loops over the pole, no clamp); wheel/pinch
  changes the carrier radius with fixed focal length (dolly).
- **Mouse rotates the object**, not the camera: unproject the grabbed surface point, then rotate by
  the shortest quaternion so that point follows the cursor exactly.
- Object rotation (`objectQ`) and camera carrier are separate.
- Unprojection ray is `normalize(right*X + up*Y - pos*focal)` — into the scene.
- Reference viewer (`icosahedron.html` + `icosahedron-viewer.js`) uses a WebGL ray–sphere shader;
  only the front surface can be shaded, so back faces/edges are impossible.
- Full rationale and failure history: [narimato-physics.md](narimato-physics.md).
- Labels are shown on faces (all visible faces when few, hovered face at any depth) and can be
  toggled.

### Scoring (fixed)
- click unowned → **claim**, +10 points, owner = player, `claims++`, facesHeld changes.
- click owned by other → **steal**, +15 points, owner switches, `steals++`, facesHeld ±1.
- click own → **reinforce**, +2 points (progress still +1).
- break: triggering player +`50 + 10 * depth` points, `breaks++`; owner facesHeld += 3
  (one leaf becomes four, all inherited).
- No combo in infinite mode.

### Config (env)
`PORT` 4173, `HOST` 0.0.0.0, `DATA_DIR` ./data, `BREAK_CLICKS` 8, `MAX_DEPTH` 8,
`CLICK_COOLDOWN_MS` 40, `SAVE_DEBOUNCE_MS` 500.

### Persistence
`data/world.json` atomically stores players + the subdivided tree (nodes only, geometry is
reconstructed from labels + `childTriangles`). Load on boot; save debounced after changes and on
shutdown. Survives restarts. Corrupt/absent file starts a fresh level-0 world.

## 2. Server protocol

### REST
`POST /api/join` `{tag, token?}`
```js
{ ok:true, token, player:{id,tag,color}, state: State, leaves: Leaf[] }
// 409 { ok:false, error:"TAG_IN_USE"|"INVALID_TAG", message }
```
Same token reconnects to the same persistent player. Tag is unique case-insensitively among all
known players; a tokenless visitor with an existing tag gets `TAG_IN_USE`.

`GET /api/events?token=…` SSE, first message:
```js
{ type:"snapshot", state: State, leaves: Leaf[] }
```
then:
```js
{ type:"state", state: State }                     // players/scores/stats, ~1/s + on player changes
{ type:"cell", cell: Leaf, playerId, points, kind:"claim"|"steal"|"reinforce", broke:false }
{ type:"break", label, depth, byPlayerId, points, children: Leaf[] }
{ type:"toast", message, kind }
```
`POST /api/action` `{token, type:"click", label}` → 
```js
{ ok:true, label, cell: Leaf, points, kind, score, broke, children?: Leaf[] }
// 409 NOT_JOINED | COOLDOWN | NOT_A_LEAF | INVALID_LABEL
```
`GET /api/state` → `{ok:true, state: State}` (landing stats, no leaves)
`GET /api/world` → `{ok:true, state, leaves: Leaf[]}` (debug/tests)
`GET /api/leaderboard` → `{ok:true, leaderboard: ArcadeEntry[]}`
`GET /api/health` → `{ok:true, uptimeMs, playersOnline, faces, maxDepthReached, totalClicks}`

### Robot player (always-on single robot)
Config: `BOTS=1`, `BOT_MIN_MS`/`BOT_MAX_MS` lifetime (defaults 60000/180000),
`BOT_GAP_MIN_MS`/`BOT_GAP_MAX_MS` (3000/10000), `BOT_CLICK_MIN_MS`/`BOT_CLICK_MAX_MS`
(800/2800). A robot spawns after a random gap with a fresh random callsign and 24-bit colour,
appears as a normal online player (no bot flag; scores/breaks/faces/arcade persist), clicks on a
random cadence (55% biased toward charged/human-owned cells, 45% random) subject to the same
contest lock, leaves after a random lifetime, and a new robot with a new name replaces it.
Join/leave emits toasts.

Shapes:
```js
Leaf = [label, ownerIndex|-1, clicks]                  // compact; depth = label.split('.').length-1
State = {
  serverTime, threshold, maxDepth, maxDepthReached,
  faces, totalClicks, totalBreaks, createdAt,
  players: [{ id, tag, color, online, score, facesHeld, clicks, breaks, claims, steals }],
  arcade: [{ tag, score, facesHeld, breaks, updatedAt }],   // top 20, score desc
}
```
Owner indexes are stable array indexes into `state.players`.

Static serving as before (public/, traversal-safe, no-store for html/js/css) + 404s.
No `/r/:id` result pages in this mode; sharing is handled client-side via report links.

## 3. Client files

### Lead `public/js/app.js`
- Rebuilds/maintains the client world tree from snapshot leaves using base geometry +
  `childTriangles`; maintains `Map<label, node>`, active leaf list.
- SSE handling (`snapshot`, `state`, `cell`, `break`, `toast`), optimistic click update, cooldown.
- Camera: drag rotate, wheel zoom (0.4–4096), pinch, double-click focus animation (centre a face
  and zoom so it fills a good part of the view; repeat to drill deeper), `L` labels, `R` reset.
- Click: pick with `pickFace({faces: activeLeaves}, camera, x, y)` (labels as ids), POST action,
  update cell; on break animate children and update tree.
- HUD wiring, report (session stats since join: session score/clicks/breaks/claims/steals),
  share link encoded in URL hash/query `report=<base64url(JSON)>`, PNG download.
- Landing stats from `/api/state`; `?tag=`/`?auto=1` QA hooks; `?report=…` opens shared report.

### renderer-dev `public/js/renderer.js`
New API (replacing single-mesh methods):
```js
setPlayers(players, myPlayerId)
setFaces(faces)              // mixed-depth leaves: {label,a,b,c,centroid,depth,ownerIndex,clicks}
updateCell(label, ownerIndex, clicks)
replaceFace(label, children) // children with geometry; build boundaries incrementally
setConfig({ threshold, maxDepth })
setHover(label|null)
setLabelsVisible(boolean)
pulse(label, {color, kind:"claim"|"steal"|"reinforce"|"break", text})
render(camera, timeMs)
resize()
```
- Same neon visual stack; now mixed-depth faces. Boundary cache keyed by label; tessellation step
  by `face.depth` (depth 0 dense arcs, deeper cheaper). Cull off-screen/tiny faces for perf.
- Show labels (all faces when count ≤ 80, otherwise hovered + face-count small), plus hovered cell
  info: id, depth, owner, charge bar `clicks/threshold`; owned faces brighten by charge fraction;
  near-breaking faces pulse. Break visual = shatter flash on the replaced cell / new children.
- Support extreme zoom gracefully; label size stays legible; no fixed-level assumptions.

### ui-dev `public/index.html`, `cyberpunk.css`, `ui.js`, `audio.js`, `result-card.js`
- **No timer/round/surge/lobby countdown.** Landing: INFINITE GRID branding, tag join, world stats
  (faces, max depth, total clicks/breaks), live count, arcade top 10.
- HUD: world depth/faces, your score/faces, online operators, arcade top 10, hovered-cell panel
  (label, depth, owner, charge), zoom/depth indicator, REPORT button, connection, sound.
- Report overlay (`showReport(result,{leaderboard,shareUrl,title})`): session stats, rank, arcade,
  Download PNG, Share link (self-contained URL), close. Shared report opens over landing.
- Controls hint: `CLICK // CLAIM + CHARGE · DBL-CLICK // FOCUS · SCROLL // ZOOM · L // IDS`.
- Result card PNG (1200×630) adapted to infinite stats: tag, total score, session clicks, breaks,
  faces held, depth reached, rank, share URL; `buildShareText`.
- Keep synthesized audio; add `breakShatter()` if useful.
- Responsive 360px+, reduced motion, no external assets.

## 4. Tests / QA (Lead runs final)
- geometry (existing + childTriangles)
- `test/world-core.test.js`: individual break only that cell, children inherit owner, other cells
  untouched; threshold; max depth; scoring/steals/facesHeld; persistence save/load; identity/token;
  join during play; labels match `childTriangles`.
- `test/server.test.js`: HTTP join/action/SSE snapshot/cell/break/state; persistence across restart;
  no rounds/timers; static safety.
- Playwright: two clients join immediately (no lobby wait), click one face 8× → exactly 4 children
  appear and no other face changes; leaderboard; deep zoom + focus; report download/share; reload
  persists; zero console errors.
