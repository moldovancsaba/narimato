> **Historical document.** The game is now the persistent INFINITE GRID mode described in
> [SPEC_INFINITE.md](SPEC_INFINITE.md). This file documents the original round-based prototype.

# NARIMATO — Build Spec & Interface Contract

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [UI-02](https://github.com/moldovancsaba/narimato/issues/8) · [RND-03](https://github.com/moldovancsaba/narimato/issues/16)
<!-- delivery-ssot:end -->

Neon geodesic arena. A real-time multiplayer territory game played on a **spherical icosahedron**
(12 cartographic points, 20 spherical triangles, 4-way spherical subdivision). Tag in, click
triangles to claim them, steal rival turf, survive automatic grid SURGEs, climb the arcade
leaderboard, download/share your result card.

**Canonical source of truth.** If code and this document disagree, ask the Lead before changing a
public interface. Stay inside your assigned files.

---

## 1. Repo layout & ownership

Project root: `/Users/Shared/Projects/step/icosa-arcade`

| Path | Owner | Purpose |
|---|---|---|
| `package.json`, `README.md` | Lead | scripts, docs |
| `public/js/shared/geometry.js` | Lead | spherical math, meshes, camera, picking |
| `test/geometry.test.js` | Lead | geometry unit tests |
| `public/js/app.js` | Lead | integration: SSE, input, camera, actions, results |
| `public/index.html` | ui-dev | DOM skeleton, all element ids |
| `public/css/cyberpunk.css` | ui-dev | cyberpunk styling, overlays, HUD, responsive |
| `public/js/ui.js` | ui-dev | `UI` class: landing/HUD/results/leaderboard/toasts |
| `public/js/audio.js` | ui-dev | `ArcadeAudio` synthesized WebAudio SFX |
| `public/js/result-card.js` | ui-dev | canvas result card PNG + share text |
| `public/js/renderer.js` | renderer-dev | `IcosaRenderer`: neon canvas sphere, effects |
| `server.js` | server-dev | HTTP + static + SSE + REST + share pages |
| `lib/game-core.js` | server-dev | authoritative game state machine, bots, scoring |
| `lib/arcade-store.js` | server-dev | leaderboard/result persistence (`data/*.json`) |
| `test/game-core.test.js`, `test/server.test.js` | server-dev | unit + HTTP integration tests |
| `data/` | server-dev (generated) | runtime persistence, gitignored |

Node >= 20, **zero npm dependencies** (built-in `http`, `crypto`, `fs`, `node:test`).
ES modules everywhere (`"type": "module"`). No CDN/external assets/fonts — fully offline.

Run: `npm start` → `http://localhost:4173` (env `PORT`). Tests: `npm test` (`node --test`).

---

## 2. Game design (authoritative)

The server is authoritative. Clients send capture intents; server validates and broadcasts state.

### Round lifecycle (defaults, env-overridable)
- **lobby** `LOBBY_MS=12000`: join window; landing overlay + arcade board. Auto-starts a round when
  at least 1 human is connected. Bots fill empty seats at round start.
- **live** `ROUND_MS=75000`: capture phase, grid level by elapsed time:
  - `0s` → **level 0**: 20 faces, base points 100
  - `25s` → **SURGE level 1**: 80 faces, base 40
  - `50s` → **SURGE level 2**: 320 faces, base 16
  - `75s` → round ends.
- **results** `RESULTS_MS=18000`: rankings, arcade board, result card, share link. Then back to lobby.

Phases only advance while `>=1` human is connected. Lobby with zero humans freezes its timer.

### Capture rules
- Click/tap one spherical triangle under the pointer (ray via projected face hit-test).
- Unowned face → claim: `points = round(basePoints[level] * comboMult)`.
- Enemy-owned face → steal: `points = round(basePoints[level] * 1.5 * comboMult)`;
  face ownership transfers, thief `steals++`; victim score unchanged (arcade friendly).
- Own face → `hold`, 0 points, no state change (client shimmer only).
- Combo: a capture within `1800ms` of your previous capture increments `streak` else resets to 1.
  `comboMult = min(5, 1 + Math.floor((streak - 1) / 2) * 0.5)` → x1, x1, x1.5, x1.5, x2 ... x5.
  `bestCombo = max(bestCombo, streak)`. Per-player capture cooldown `COOLDOWN_MS=90`.
- SURGE inheritance: every face at the new level inherits the owner of its parent face
  (`newOwners[i] = oldOwners[Math.floor(i / 4)]`, because subdivision of face `p` emits its
  four children contiguously at indices `4p..4p+3` at every level).
- Bots are real players in-round (ranked in round standings) but **excluded from the all-time
  arcade leaderboard**. Bots fill to `target = humans === 0 ? 0 : min(4, humans + BOT_COUNT)`
  with `BOT_COUNT=2` default (1 human → 2 bots, 2 humans → 2 bots, 3 humans → 1 bot,
  4+ humans → none); `BOT_COUNT=0` disables bots entirely (required for deterministic QA/tests).
  Bots capture every 650–1400ms picking a random face (prefer unowned), same scoring rules.
- Arcade: per normalized `TAG` persist `{tag, best, games, lastScore, updatedAt}`.
  `best = max(best, roundScore)`, `games++` at each round end. Top 20 by best desc.

### Identity
- Tag: trimmed, uppercased, `/^[A-Z0-9_-]{2,12}$/`. One active human per tag (case-insensitive)
  in the current round/lobby; same tag + same token = reconnect; different token = HTTP 409.
- Token: `crypto.randomUUID()`, returned once by join, persisted in `localStorage`.
- Disconnect: mark `connected=false`; player stays for the current round and can reconnect with
  token. Players absent at next round start are dropped. During live, disconnected players keep
  their faces/scores.

---

## 3. Shared geometry API — `public/js/shared/geometry.js` (Lead-owned, frozen)

```js
export const DEG;                              // Math.PI/180
export function normalize(v);                  // unit {x,y,z}
export function midpoint(a, b);                // normalize(a+b): exact great-circle arc midpoint
export function faceCentroid(a, b, c);         // normalize(a+b+c)
export function faceArea(a, b, c);             // spherical excess area (steradians)
export function latLonToVec(lat, lon);         // degrees -> unit vec; north pole = +Y
export function vecToLatLon(v);                // -> {lat, lon} degrees, lon in [-180,180]
export function baseIcosahedron();
  // { vertices: [vec x12], faces: [[i,j,k] x20] } outward-oriented.
  // vertices[0] = North pole (90,0); vertices[1] = South pole (-90,0);
  // ring A (lat +26.565051177): lon 0,72,144,216,288 -> idx 2..6;
  // ring B (lat -26.565051177): lon 36,108,180,252,324 -> idx 7..11.
export function getMesh(level);                // cached 0..3
export function buildMesh(level);
  // level 0..3 -> face counts 20, 80, 320, 1280.
  // { level, faceCount, faces: [{ id, a, b, c, centroid, normal, area,
  //                              path, label, depth, parentId }] }
  // Deterministic order: base face order, then recursive 4-way spherical split in the fixed
  // structural order: (A,AB,CA), (AB,B,BC), (CA,BC,C), (AB,BC,CA), recurse. Face id = array index.
  // Children of parent p occupy ids 4p..4p+3 at the next level.
  // a,b,c,centroid,normal are unit vectors; normal === centroid (outward).
  // path/label are the hierarchical face number: base "1".."20", then dot-joined child digits
  // 1..4 ("11.4", "9.2.1.1"). Level 0 has depth 0, parentId null.
export function childLabelOrder(a, b, c);    // -> [label 1..4 for structural children A,B,C,centre]
export function parseFaceLabel(value);       // "9.2.1" -> { path, label, level } | null
export function resolveFaceLabel(level, value); // label at level -> numeric face id | null
export function faceLabel(level, faceId);    // numeric face id -> label string | null
export class SphereCamera {
  constructor(width, height);                  // also accepts {width,height}
  yaw; pitch; zoom;                            // public mutable fields
  setViewport(width, height);                  // css pixels
  rotate(dxPx, dyPx);                          // drag: yaw += dx*0.006; pitch += dy*0.006, clamp ±1.35
  zoomBy(factor);                              // clamp zoom 0.55..3.2
  reset();
  project(v);                                  // -> { x, y, z, visible }
  // x,y in CSS pixels (canvas top-left origin); z is view-space depth in [-1,1];
  // visible === z > 0 (front hemisphere).
}
export function pickFace(mesh, camera, sx, sy); // front-most visible face id at CSS px, or null
```

Projection contract (renderer/app must match): perspective camera at `distance = 3.2` on +Z looking
at origin; rotate world vector by `Ry(yaw)` then `Rx(pitch)`; base on-screen radius
`R = min(width,height) * 0.40 * zoom`; `scale = R * distance / (distance - p.z)`;
`x = width/2 + p.x * scale`, `y = height/2 - p.y * scale`. No external math libs.

Spherical rendering/picking contract (added after visual review — flat projected chords are a bug):
- `slerp(a,b,t)` samples great-circle arcs; renderer tessellates each face boundary with
  `slerp` at ≤6° steps and draws closed geodesic-arc polygons for fills, outlines, hover and
  capture pulses. Never `lineTo` directly between projected face vertices at level 0/1.
- `pickFace()` casts the camera ray through the screen point, intersects the unit sphere, then
  accepts a face iff the hit lies on the inner side of all three great-circle edge planes
  (`n = a×b, b×c, c×a`; outward-oriented). Do not hit-test planar projected triangles.

Tests must cover: 12/20 base; **regularity — exactly 30 edges, every edge 63.4349488°,
every vertex degree 5, every base face equal area 4π/20** (the belt must triangulate upper-ring
edges to the lower vertex between them and lower-ring edges to the upper vertex between them,
never across the 116.565° diagonal); 20/80/320/1280 meshes; contiguous ids; children inheritance
order (`getMesh(l+1).faces[4*p+k]` lies inside face p); sum of face areas ≈ 4π for levels 0–2
(1e-9); midpoint unit length; lat/lon round-trip incl. poles; N pole projects above center;
pickFace center hits a front face and returns null off-sphere; spherical picking at every face
centroid; geodesic-edge bulge picking; slerp stays on the great circle.

---

## 4. Server HTTP + wire protocol (server-dev implements, Lead consumes)

Default port `4173`, host `0.0.0.0`. All JSON responses `Content-Type: application/json`.
Static files served from `public/` with correct MIME (`.html,.js,.css,.json,.svg,.png,.ico,.txt,.md`),
path-traversal safe, `Cache-Control: no-store` for html/js/css.

### REST

`POST /api/join` — body `{ tag, token? }`
```js
// 200
{ ok:true, token:"uuid", player:{id:"p_ab12", tag:"NEO", color:"#00f0ff", bot:false}, state: State }
// 409 { ok:false, error:"TAG_IN_USE"|"INVALID_TAG"|"SERVER_FULL", message:"..." }
```
Reconnect: valid existing `token` → same player, update tag if needed (tag must stay unique).
Valid during any phase (results-joiners play next round).

`GET /api/events?token=UUID` — **SSE** (`text/event-stream`, `retry: 1500`, heartbeat comment
`:hb` every 15s). First message: `{type:"snapshot", state}`. Invalid/missing token → 401 JSON.

SSE messages (each as one `data: <json>\n\n`):
```js
{ type:"snapshot", state }                       // on connect
{ type:"state", state }                          // ≤10/s, immediately on capture/surge/phase/join/leave
{ type:"hit", hit:{ faceId, level, playerId, playerIndex, tag, color, kind:"claim"|"steal", points, combo, streak, at } }
{ type:"surge", level, at, roundId }
{ type:"phase", phase:"lobby"|"live"|"results", phaseEndsAt, roundNumber, roundId }
{ type:"roundStart", roundId, roundNumber, phaseEndsAt, level:0 }
{ type:"roundEnd", roundId, roundNumber, results:[Result], arcade:[ArcadeEntry] }
{ type:"toast", message, kind:"info"|"good"|"bad"|"warn" }
```

`POST /api/action` — body `{ token, type:"capture", level, faceId }` or `{ token, type:"ping", t }`
```js
// capture 200 { ok:true, kind:"claim"|"steal"|"hold", faceId, level, points, streak, comboMult,
//               score, ownerIndex, stateSeq }
// ping    200 { ok:true, t, serverTime }
// errors 409 { ok:false, error:"NOT_LIVE"|"STALE_LEVEL"|"INVALID_FACE"|"COOLDOWN"|"NOT_JOINED", message }
```

`GET /api/leaderboard` → `{ ok:true, leaderboard:[ArcadeEntry] }` (top 20)
`GET /api/state` → `{ ok:true, state }` (debug/tests)
`GET /api/health` → `{ ok:true, uptimeMs, humans, phase, roundNumber }`
`GET /api/result/:resultId` → `{ ok:true, result }`; JSON download when `?download=1`
(`Content-Disposition: attachment; filename="narimato-<TAG>-<score>.json"`).
`GET /r/:resultId` → standalone cyberpunk HTML share page, 404 page if unknown. Contains:
result stats, arcade rank, OG/twitter meta, links `/` and `/api/result/:id?download=1`,
`Share` (navigator.share/clipboard) and `Download PNG` buttons. Inline `window.__RESULT__`
and `<script type="module">` that imports `/js/result-card.js` and calls
`downloadResultCard(window.__RESULT__)`. Also `<link rel="stylesheet" href="/css/cyberpunk.css">`
so it inherits the theme. `result.shareUrl` = absolute `http://host/r/<id>`.

Unknown `/api/*` → 404 JSON; other → 404 plain text.

### State shape (single source for client/renderer/UI)
```js
{
  seq: 42, serverTime: 1760000000000,
  phase: "lobby"|"live"|"results",
  phaseEndsAt, phaseStartedAt,                 // epoch ms
  roundId: "rg_ab12cd"|null, roundNumber: 3,
  level: 0|1|2, faceCount: 20|80|320,
  nextSurgeAt: epochMs|null, nextSurgeLevel: 1|2|null,
  players: [{                                 // stable order during a round; index = owners value
    id, tag, color, bot, connected, score, combo, streak, bestCombo,
    captures, steals, facesHeld
  }],
  owners: number[],                            // length faceCount; -1 unowned else players index
  arcade: [{ tag, best, games, lastScore, updatedAt }],   // top 20
  resultIds: { [playerId]: resultId } | null   // during results phase, humans only
}
```
Result (roundEnd + API + result card):
```js
{ playerId, tag, color, bot, rank, totalPlayers, score, captures, steals,
  bestCombo, facesHeld, resultId|null, roundId, roundNumber }
```
ArcadeEntry: `{ tag, best, games, lastScore, updatedAt }`.

---

## 5. Client module interfaces (Lead wires these in app.js)

### `renderer.js` — renderer-dev
```js
import { IcosaRenderer } from './renderer.js';
const renderer = new IcosaRenderer(canvas);
renderer.resize();                        // DPR-aware; call on load + resize (uses CSS size)
renderer.setMesh(mesh);                   // geometry buildMesh(level)
renderer.setSnapshot({ owners, players, myPlayerId, level });
  // owners: number[] aligned to mesh faces (-1 or players index); players: State.players
renderer.setHover(faceId | null);
renderer.setLabelsVisible(boolean);        // hierarchical face numbers on/off (keyboard L)
renderer.pulse(faceId, { color, kind:"claim"|"steal"|"hold", text:"+120" });
renderer.flashSurge(level);
renderer.render(camera, timeMs);          // camera: SphereCamera; draw one frame
```
No RAF inside; app owns the loop. Canvas is `#arena-canvas`, fixed full-viewport, behind UI.
Visual brief: cyberpunk hologram sphere; back faces faint; front faces depth-sorted; unclaimed
dark cyan translucent wireframe, owned neon fills, mine brighter, hover white; graticule (lat/lon),
N/S pole labels with cartographic coordinates, halo, starfield/grid + particles, capture pulses and
floating score text, surge flash. Cap DPR at 2. Must run smoothly at 320 faces.

### `ui.js` — ui-dev
```js
import { UI } from './ui.js';
const ui = new UI({
  onJoin(tag), onShare(), onDownload(), onCloseResults(), onToggleSound(muted)
});
ui.showLanding({ leaderboard, liveCount });   // initial overlay, focuses tag input
ui.hideLanding();
ui.showJoinError(message);                    // inline error under tag input
ui.setJoinBusy(busy);
ui.updateHud(state, myPlayerId);              // timer/phase/level/players/score/combo/connection
ui.setLeaderboard(leaderboard);               // arcade panels (landing + in-game)
ui.setLiveCount(n);
ui.setConnection(status);                     // "connected"|"connecting"|"reconnecting"|"offline"
ui.toast(message, kind="info");
ui.showResults(result, { leaderboard, nextRoundAt, shareUrl });
  // result = Result plus { rank, totalPlayers, shareUrl }; buttons call callbacks
ui.hideResults();
ui.setSoundMuted(muted);
```
`ui.updateHud` may be called at ~10Hz; diff internally, never rebuild DOM unnecessarily.
Landing must remain usable after results (players stay). Results overlay auto-hides when phase leaves
results (app calls hideResults).

### `audio.js` — ui-dev
```js
import { ArcadeAudio } from './audio.js';
const audio = new ArcadeAudio();   // muted until unlock() from first user gesture
audio.unlock(); audio.setMuted(bool); audio.isMuted;
audio.join(); audio.claim(streak); audio.steal(); audio.surge(); audio.roundStart();
audio.roundEnd(); audio.result(); audio.error(); audio.tick();
```
Synthesized WebAudio only (no files). Short, punchy, cyber.

### `result-card.js` — ui-dev
```js
import { renderResultCard, downloadResultCard, buildShareText } from './result-card.js';
renderResultCard(canvas, result);        // 1200x630 cyberpunk card
await downloadResultCard(result);        // offscreen 1200x630 -> PNG download
buildShareText(result, shareUrl);        // clipboard/navigator.share text
```
`result` = Result (section 4). Card shows brand, big TAG, SCORE, rank, captures/steals/best combo,
share URL, round id. No external images/fonts; monospace stack.

---

## 6. `index.html` required ids (ui-dev owns markup; Lead/app binds)

Canvas `#arena-canvas`; audio toggle `#btn-sound`; connection `#connection-badge`;
landing overlay `#join-overlay` with `#tag-input`, `#btn-join`, `#join-error`, `#join-arcade`,
`#live-count`; HUD `#hud` with `#hud-timer`, `#hud-phase`, `#hud-level`, `#hud-surge`,
`#hud-round`, `#players-panel`, `#arcade-panel`, `#hud-score`, `#hud-combo`, `#hud-hint`;
players list `#players-list`; arcade lists (`.arcade-list` filled by ui.js); toast `#toast-container`;
results overlay `#results-overlay` with `#results-title`, `#results-rank`, `#results-score`,
`#results-stats`, `#results-arcade`, `#btn-download`, `#btn-share`, `#btn-close-results`,
`#results-next`, `#results-share-url`, `#btn-download-json` (optional), `#results-card-preview`.
UI may add wrapper ids as needed but must not rename the above.

Surface mode adds one control strip to the same HUD tree (RND-03): `#surface-controls`
(`role="group"`, accessible name `Surface controls`) contains `#surface-target`
(`aria-live="polite"`), `#surface-lap` (`role="progressbar"`), four
`[data-surface-hold]` movement buttons with accessible names, and `#btn-surface-exit`.
Every HUD node carries `data-hud-node="<stable-id>"`; `#hud[data-mode]` is `orbit` or
`surface`. No second HUD, no hidden duplicate panel and no `#surface-canvas` exist.

---

## 7. App behavior (Lead, `app.js`)

- Boot: create camera (viewport), renderer, UI, audio, fetch `/api/leaderboard` for landing;
  prefill `?tag=`; `?auto=1` auto-joins with `?tag=` (QA/screenshot hook).
- Join: POST `/api/join` (token from localStorage) → store token, player id; open `EventSource`.
- SSE: apply `snapshot/state`; `hit` → audio + renderer pulse/floating text (only if level current);
  `surge` → flash + toast "GRID SURGE"; `roundEnd` → show results for my player (rank shared from
  results array), keep share URL `/r/<resultId>`; `phase`/`roundStart` transitions; `toast`.
- Input: pointer drag rotates camera (inertia), wheel/pinch zooms, click (movement < 6px) captures
  front-most face via `pickFace`; hover highlight on pointermove; double-click resets camera;
  touch handled via Pointer Events; keyboard arrows/`+`/`-` optional.
- Capture: optimistic visual pulse only after server 200; play claim/steal sound; update score from
  response; on 409 STALE_LEVEL toast and mesh level update happens via state.
- Loop: `requestAnimationFrame` → idle auto-spin in lobby/results after 6s no input, render.
- Results: on `roundEnd`, find my result; call `ui.showResults(resultWithShareUrl, {...})`;
  download → `downloadResultCard`, share → `navigator.share`/clipboard fallback + toast;
  close → hide overlay (play continues next round); auto-hide at phase change.
- Reconnect: EventSource `onerror` → UI reconnecting; `onopen` → UI connected; re-POST join with
  stored token if needed. Show offline toast after 2 failed retries.
- Never throw on missing DOM/optional elements.

---

## 8. Visual identity (all UI)

Name: **NARIMATO** — subtitle `NEON GEODESIC ARENA`.
Palette: void `#05010f`/`#0a0320`, cyan `#00f0ff`, magenta `#ff2bd6`, acid `#d7ff00`,
violet `#8a5cff`, hot `#ff3860`, text `#dff6ff`. Player neon colors:
`#00f0ff #ff2bd6 #d7ff00 #ff7a00 #8a5cff #00ffa8 #ff3860 #4d7cff`.
Typography: monospace stack (`"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace`),
uppercase, letter-spacing; glitch title; clipped panel corners (clip-path); scanlines + noise
overlays; animated neon borders; CRT flicker sparingly; respects `prefers-reduced-motion`.
Controls legend: `DRAG // ROTATE   SCROLL // SCALE   CLICK // CAPTURE`.
Never rely on network assets. Mobile-first responsive, minimum 360px wide.

---

## 9. Definition of done

- `npm test` green (geometry, game-core, server HTTP) and `npm start` serves the game.
- A single browser can join, capture, get score; two browser contexts can see each other and steal.
- Two SURGEs happen on schedule (20→80→320), owners inherit, results + arcade persist across rounds.
- Results overlay: rank/score/stats, arcade, working PNG download, working share link `/r/:id`
  (share page renders + PNG download works).
- Headless Chromium QA: no console errors, landing/live/results screenshots reviewed.
- README: how to run, LAN play, gameplay, architecture, tests.
