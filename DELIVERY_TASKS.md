# NARIMATO — Delivery Task List & Acceptance Contract

**Current version:** `3.41.0`
**Why this file exists:** the same items were repeatedly marked “delivered” while only partially
matching the request. This file defines the remaining work at file level, in dependency order, with
acceptance criteria. A task is **not delivered** until its acceptance test passes in the browser
and (where applicable) in `node --test`.

Related:
- [REQUESTS_24H.md](REQUESTS_24H.md) — request-by-request status
- [ROADMAP.md](ROADMAP.md) — delivery audit and open gaps

---

## P0 — One planet, one scene, camera-only surface change

### D1. Delete the separate surface renderer; add a surface camera to `IcosaRenderer`

**Problem:** `public/js/surface-mode.js` is a second Canvas renderer. It uses the same active cells
but reimplements canvas, projection, colours, markers and HUD. That is why orbit and surface still
look/behave like copies. Copying is explicitly not acceptable.

**How:**
- Add a `SurfaceCamera` implementing the same interface consumed by `IcosaRenderer`
  (`project`, `unprojectView`, `viewAxis`, `width`, `height`, `zoom/distance`).
- Put the camera at a close orbit of the actual planet; keep the **same `World` leaf tree**, same
  renderer draw path, same materials, same labels/markers, same HUD DOM.
- Remove the surface canvas overlay. Surface mode becomes:
  - camera mode change (`orbitCamera` ↔ `surfaceCamera`),
  - control mode change (avatar/WASD),
  - the same HUD/mission/players panels with surface-specific controls only.
- No second terrain generation. No “look-alike” renderer. No duplicated HUD markup.

**Progress:** `SurfaceCamera` (`public/js/shared/surface-camera.js`) and `IcosaRenderer.setSurfaceView()` are now wired into app surface mode. The existing renderer draws the planet; the old terrain canvas no longer draws. Main orbital HUD stays visible. Remaining: remove the derived visual mesh/controller duplication and prove full DOM/geometry parity.

**Files:** `public/js/renderer.js`, `public/js/surface-mode.js` (replace with controller),
`public/js/app.js`, `public/index.html`, CSS.
**Acceptance:**
- one renderer instance draws both views;
- no `#surface-canvas`;
- orbit↔surface changes camera/controls only;
- same cells, owners, markers, labels and HUD data;
- screenshot comparison of the same cell from orbit and surface shows identical colour/material rules.

### D2. 3D character and surface control layer inside the same scene

- The avatar is a low-poly triangle figure in the same renderer/world projection.
- The same HUD DOM stays mounted; only a surface control strip is added.
- Camera never leaves the planetary scene.
**Acceptance:** DOM inspection shows the same mission/players/cargo/HUD nodes before/during/after
surface mode; no recreated panels.

### D3. Authoritative surface positions for every player and robot

**Problem:** human surface poses are broadcast, but robots use client-side visual routes. Their
mining beams are not tied to authoritative clicks.
**How:**
- Server keeps transient `surfacePose` for all active players, including robots.
- Robot surface path is generated server-side (waypoints/turns), not client-side.
- Robot click target is resolved from its surface pose to the active leaf under it; use the robot's
  real token through `WorldCore.click`.
- Broadcast `surface` pose and `surface_mine` events; cell events remain authoritative.
**Progress:** server-side surface pose/route/click mapping and robot `surface` publication landed. Two-client visual/beam acceptance is still pending.

**Acceptance:**
- two humans + robots visible at the same surface positions on all clients;
- a robot's beam is at the cell it actually changed;
- robot path turns/waypoints are independent of every human position;
- tests for pose validation, path generation and cell mapping.

### D4. Supply must bring everyone to the impact, not merely rotate a camera

**Problem:** supply currently broadcasts cells and a visual turn; it does not reliably place every
human at the impact or make surface players able to collect immediately.
**Progress:** surface pilots snap to the impact via `focusLabel`; server already broadcasts the cell list. Every-human orbital relocation test remains.

**How:**
- Server computes the impact cell and broadcasts `supply_focus` with a safe standing position for
  every human in the room.
- Orbital camera focuses the impact; surface players are repositioned to the impact footprint.
- The cells remain mineable immediately for all humans.
- Add an acceptance test with two clients: both receive the cell list, both are at the impact,
  both can mine.
**Acceptance:** automated two-client browser test; no player left behind.

### D5. Robot/resource visibility and collection on surface

- Robot surface paths generate turns and choose mineable cells.
- Their authoritative clicks change triangles; surface animation is driven by those cell/break events.
- No fake resource duplication.
**Acceptance:** walk near a robot; its target cell visibly charges/breaks; only server-authoritative
cells change.

---

### D15. Real 3D humanoid avatars

- Replace the old 2D surface sprite with closed-triangle 3D humanoid meshes projected by the same
  `SurfaceCamera` (head/visor/torso/hips/arms/legs).
- Connect neck/hips, add walking rig, peer animation, mining pose; verify from front/back/side.
- **Acceptance:** no sprite path in surface mode; every figure is a depth-sorted 3D mesh on the
  surface; visible at normal and close camera distance.

### D16. Live world, no cached copy

- Surface visual triangles are rebuilt from the live `leafList` on every authoritative cell, break
  and click; no stale planet copy.
- Add a two-client mutation test: one client mines/breaks, the other client's surface updates
  without reload.
- **Acceptance:** no stale mesh; multiplayer changes appear on all surface clients.

## P1 — Controls, poles, colours

### D6. Reverse cursor movement no longer changes direction

**Problem:** mouse drag can feel like it changes direction at certain orientations; arrow travel can
invert unpredictably at poles/surface transitions.
**How:**
- Mouse: screen-space absolute arcball from pointer-down orientation; no incremental local-axis
  accumulation that can flip.
- Keyboard: world-space tangent heading with parallel transport; fixed inverse relationship to
  mouse drag.
- Explicit `I` toggle must not silently persist an unexpected mode; show current mode in HUD.
**Acceptance:** automated browser drag sequence (including crossing poles) shows consistent screen
direction; unit tests for arcball/tangent transport.

### D7. Pole rotation never disappears

- Renderer culling must use the actual quaternion view axis and a conservative near-plane bound.
- Add regression test at pitch ±π/2 and arbitrary roll: planet/cells remain visible.
- Empty frame must never be the result of a camera-only change.

### D8. Green/red harvest semantics

- **GREEN target = server will accept a click now.**
- **RED target = own-last-click lock or depleted.**
- Only target cell gets green/red; all other cells keep terrain/owner + cyan edges.
- Renderer lock state must use the same `lastClickIndex` as server (fixed in v3.38).
- Automated test: compare target HUD/colour with `/api/action` response for green and red cells.
**Acceptance:** no contradictory colour/response pair.

### D9. Exit to the farthest orbit

- On leaving surface, camera returns to the **maximum outward zoom** (not deepest).
- Add a named constant `ORBIT_FAR_ZOOM`; use it in exit; test `camera.zoom === ORBIT_FAR_ZOOM`.
- HUD returns; surface camera/avatar/HUD gone.

---

## P1 — Events, ships, incidents

### D10. Five-tetra ships and incident rotation

- Incidents currently require exhausting hidden deposits; ensure the event scheduler reaches every
  incident type in normal play and add a deterministic test trigger.
- Intro/transit/relief/alien/solar visuals use the shared five-tetra ship model.
- Every incident has visible ship/sun/effect, story text and audio cue.
**Acceptance:** automated run covering all four incident kinds; each shows its ship/sun/effect and
resets the crust; no unreachable event.

### D11. Surface information parity

- Same panels/data as orbit: mission, cargo, players, score, navigation.
- Surface mode adds only movement controls, target status and lap.
- No recreated or “almost identical” panels.
**Acceptance:** DOM parity test; no duplicate mission/player/cargo nodes.

---

## P2 — Story, accessibility, ops

### D12. Voice cues for new story beats
Relief/incident/Quick Guide/Captain’s Log cues; regenerate audio pack; cache-bust.

### D13. Manual real-device / audio gate
iPhone Safari, Android Chrome, VoiceOver/TalkBack/NVDA, 200% zoom, reduced motion, contrast,
real audio interruption/autoplay.

### D14. CDN / scale gates
External CDN credentials; sharding only on measured need; peer assets only with CDN evidence.

---

## Order of delivery

1. **D1–D3** (single scene + authoritative robots)
2. **D4–D5** (supply focus + robot collection)
3. **D6–D9** (controls, poles, colours, exit)
4. **D10–D11** (events + HUD parity)
5. **D12–D14** (audio/a11y/ops)

## Non-negotiables

- No second planet/renderer/copy of HUD.
- No client-fabricated resources.
- No automatic zoom on click/break.
- No solo own-cell farming.
- No “delivered” claim without the acceptance test above.
