# NARIMATO — Roadmap & Delivery Audit

**Current version:** `3.41.0`
**Audit window:** 2026-11-18 → 2026-11-19 (last 24 hours)
**Live:** https://treasurer-record-flooring-mounting.trycloudflare.com

This document is the source of truth for what is shipped, what broke, what was
fixed, and what is still deliberately unfinished. It is more important than any
single release note: if the code and this document disagree, fix one of them.

---

## 1. What we use, and why

| Layer | Choice | Why |
|---|---|---|
| Authority | Node server (`server.js`, `PlanetManager`, `WorldCore`) | All cells, locks, resources, scores and planet state stay server-authoritative. Clients never grant ore. |
| Transport | REST actions + SSE room streams | One dependency-free path for state snapshots, cell/break/resource events and transient surface presence. |
| Planet mesh | Procedural icosahedron tree (`public/js/shared/geometry.js`) | Same spherical geometry at every zoom; adaptive child triangles preserve labels, ownership and mining history. |
| Orbital view | Canvas 2D `IcosaRenderer` + quaternion camera | Projected sphere, quaternion free rotation, zoom rungs and full HUD. |
| Surface view | `public/js/surface-mode.js`, separate Canvas overlay | Close camera, third-person runner, footprint harvesting. **Still a separate renderer — see the main open gap.** |
| Surface triangles | Active cells → adaptive `childTriangles` normalised back to sphere | Spherical arc triangles, not flat chords. No generated terrain map. |
| Surface fills | Active cell biome/elevation + owner colour | Same data orbit uses; red/green is not a fill. |
| Harvest affordance | Target cell only: green target = can harvest, red target = locked; compact target pin + HUD | One unambiguous colour rule instead of recolouring the whole surface. |
| Resource pins | Target cell + known relief/supply cells only | Hidden ore must stay hidden; already-mined discovered resources are not mineable and must not clutter the surface. |
| Opponents | Real surface poses for human clients; fixed independent home routes for robots/other online pilots | Opponents never orbit the local player. Authoritative robot clicks still come through server cell events. |
| Ships | Five-tetrahedron shared model (`public/js/shared/tetra-ship.js`) | 5 tetrahedra × 4 triangular faces; intro, transit, relief, alien incidents. |
| Audio / voice | Arcade synth + Kokoro/macOS packs, HTMLAudio with resume watchdog | No external runtime dependency for SFX; versioned immutable voice clips. |
| Tests | `node --test` + Playwright audit + axe | Zero npm runtime dependencies; 97 tests at this version. |

### Definitions

- **Target cell:** the active cell under the avatar's footprint; only this cell gets green/red boundary/pin treatment.
- **Can harvest:** the server would accept a click now from this pilot (not own-last-clicked, not depleted at max depth).
- **Virtual opponent:** a non-surface-synced online robot/player rendered on an independent home route. Their authoritative clicks still update shared cells.

---

## 2. Delivered in the audit window

| Release | Delivered |
|---|---|
| v3.19 | Planet-wide emergency supply broadcast, all humans receive cells, camera turns to impact |
| v3.20 | Solo mining (wrong — reverted), manual-only zoom, stable arcball drag |
| v3.21 | Direct mouse drag; inverse arrow travel; direction fixes |
| v3.22 | **Reverted solo farming**; restored contest lock; robots prioritise locked human cells |
| v3.23 | Five-tetra ship; faceted sun; alien ships; triangular beams/canisters |
| v3.24 | Surface landing, third-person runner, 60s lap, auto-harvest |
| v3.25 | Live-cell-only surface, peer surface presence, performance work |
| v3.26 | Surface mission panel, green/red affordances, ship tractor effects |
| v3.27 | Opaque shell, footprint harvesting, helmet head |
| v3.28 | Adaptive spherical arc triangles (no flat chords) |
| v3.29 | Seamless pole crossing via parallel transport |
| v3.30 | Surface HUD isolation, all-player avatars, fourth-rung landing |
| v3.31 | Terrain/owner palette, edge-only status, all online avatars |
| v3.32 | Independent opponent home routes |
| v3.33 | Center-safe surface HUD, maximum orbit zoom-out on exit |
| v3.34 | Resource/supply pins, cyan edges, remote mining beams |
| v3.35 | Target-only green/red rule, explicit target HUD, roadmap + README/release audit, stale comment cleanup |
| v3.36 | Pin cleanup: no pins for already-mined resources; target + known supply only |
| v3.37 | Overlay hard removal on exit; robot Lissajous paths + faster footprint harvesting; 24h request/status doc |
| v3.38 | Renderer lastClick lock sync; delivery task contract; docs audit |
| in progress | D1 foundation: SurfaceCamera + IcosaRenderer surface-view branch + camera tests |
| v3.39 | Renderer-driven surface with SurfaceCamera; live leaf-derived surface mesh; projected 3D humanoid meshes; HUD reuse; updated request/task lists |
| v3.40 | Authoritative robot surface routes/poses/click-under-pose; robot surface state publication; supply impact snap; named farthest zoom |
| v3.41 | Robots route near human surface pilots; incremental screen-space mouse rotation; pole/direction tests |

### Earlier but still active

- Persistent multiplayer planets, seed-derived missions, rare-material budgets, early-planet
  rare caps, planet palettes, Captain's Log, incident explanations, Quick Guide, solo/contest
  rules, audio recovery, accessibility audits, load/soak/chaos harnesses.

---

## 3. What was ruined (and corrected)

These are real regressions, not polish items. Each one must not recur.

1. **Solo farming (v3.20–v3.21):** I misread “no opponent” and removed the contest lock.
   Corrected in v3.22: lock restored; robots spawn and prioritise the locked cell.
2. **Automatic zoom:** clicks/breaks changed zoom. Corrected: only wheel, pinch, double-click and
   NAV focus zoom.
3. **Mouse/arrow direction:** reverse-drag default and same-direction arrows. Corrected in v3.21:
   mouse drag follows the cursor; arrow travel is inverse, stable upside down.
4. **Fake surface geography:** generated ground sheet and flat chord triangles. Corrected through
   v3.25–v3.31: live active cells, spherical arc subdivision, opaque icosahedral shell.
5. **Different surface palette:** red/green replaced terrain/owner fills. Corrected: terrain/owner
   fills + cyan edges; green/red only on the target cell/pin.
6. **Orbital HUD bleed and clipping:** corrected v3.30/v3.33; surface owns the screen, central NEED
   summary and bottom exit are clamp/safe-area positioned.
7. **Opponents orbiting the player:** corrected v3.32; fixed independent homes.
8. **Pin explosion:** every discovered/mined cell was pinned, making the surface look like a forest.
   Corrected v3.36: only target/supply pins.
8. **Opponents not visibly mining:** corrected v3.34 with independent mining beams; authoritative
   cell updates still arrive through the server.
9. **Deep zoom on surface exit:** corrected v3.33; exit returns to maximum orbit zoom-out (`0.4`).
10. **Pole movement stop/flip:** corrected v3.29/v3.30 with tangent heading + parallel transport.

### Rule: colour semantics

- **Only the target cell** may use green/red as harvest state.
- Other cells keep cyan/white edges + terrain/owner fills.
- **GREEN TARGET = can harvest now.**
- **RED TARGET = locked to this pilot or depleted.**
- Resource pins are separate diamond/pole markers and use resource colours.
- Do not reintroduce full-surface red/green recolouring.

---

## 4. Left behind / main open gaps

See [REQUESTS_24H.md](REQUESTS_24H.md) for the request-by-request delivery table and [DELIVERY_TASKS.md](DELIVERY_TASKS.md) for file-level implementation tasks and acceptance tests.

### P0 — Unify the surface renderer with the orbital renderer

The surface is still a separate Canvas implementation. It consumes the same active cells and
terrain/owner metadata, but it is not literally “camera view changes only” in the same renderer.
This is the biggest remaining gap between the requested experience and the delivered one.

**Next:** add a surface camera mode to the existing orbital renderer so materials, labels, markers,
atmosphere, HUD and cell styling are shared. Keep the same active-cell tree and colour rules.

### P0 — Authoritative robot surface positions and mining

Virtual opponents now move independently and show mining beams, but their routes are visual; the
server does not yet stream a robot’s surface position or map its click to a visible beam.

**Next:** server-side surface pose for robots; map robot clicks to the cell under that pose; emit
`surface` + `surface_mine` events; surface avatars consume the authoritative target.

### P1 — Resource visibility rules

Pins currently show:
- the target cell under the avatar
- known relief/supply cells

Already-mined discovered resources are no longer pinned. Hidden deposits remain intentionally
unexposed. “Show every resource” would require a server secrecy-model change, not fake client data.

### P1 — New-story voice cues

Relief drops, incidents, Quick Guide and Captain's Log story beats are text/subtitles; no dedicated
voice cue yet.

### P1 — Real-device accessibility / audio gate

Automated Chromium/WebKit + axe are clean. Manual gate remains:
iPhone Safari, Android Chrome, VoiceOver/TalkBack/NVDA, 200% zoom, reduced motion, contrast,
real audio-autoplay/interruption behaviour.

### P2 — External CDN activation

`ASSET_BASE_URL`, immutable audio URLs and edge guide exist. No CDN credentials/account provided;
assets still originate from the app server.

### P2 — Scale gates

- B2 authoritative sharding: intentionally not started; current single-node SLOs healthy.
- B4 peer-assisted assets: intentionally not started; needs CDN egress signal.

### P2 — Real-world verification

- multiple humans in surface mode at once
- robot mining visibly aligned with authoritative cell changes
- long-session surface mode memory/CPU
- phone touch/safe-area pass

---

## 5. Next roadmap

### Phase 1 — Shared renderer (P0)

Acceptance:
- orbital/surface use one renderer and one material system;
- switching modes changes camera only;
- cell colours, labels, markers, atmosphere and HUD styling match;
- no duplicate surface Canvas implementation.

### Phase 2 — Authoritative robot surface mining (P0)

Acceptance:
- server tracks robot surface pose;
- robot clicks broadcast a surface mining event;
- surface avatars visibly mine the authoritative cells;
- independent routes remain independent of the local player;
- tests cover pose, event and cell alignment.

### Phase 3 — Resource semantics (P1)

Acceptance:
- pins only for known resources/supply;
- target status HUD always matches server click result;
- documented hidden-resource rules.

### Phase 4 — Story audio/accessibility (P1)

Acceptance:
- voice cues for relief/incident/Quick Guide story beats;
- manual device checklist signed;
- no regression in automated audits.

### Phase 5 — Ops (P2)

- external CDN activation with credentials;
- sharding only when metrics require it;
- peer assets only if CDN data justifies it.

---

## 6. Definition of done for surface mode

- [x] Active planet cells only
- [x] Spherical arc triangles
- [x] Opaque shell hides far side
- [x] Pole crossing seamless
- [x] Fourth zoom rung enters surface
- [x] Orbital HUD hidden; center-safe surface HUD
- [x] 60s lap and independent movement
- [x] Target-only green/red harvest semantics
- [x] Resource/supply pins
- [x] Peers/robots visible and independently routed
- [ ] Same renderer as orbit
- [ ] Authoritative robot surface mining
- [ ] Real-device/manual sign-off
