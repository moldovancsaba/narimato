# NARIMATO — Release Notes

## v3.45.0 — “One Truth” (2026-11-18)

### Fixed

- Green/red harvest truth is now a single shared pure function (`canHarvestCell`) used by the surface
  target/HUD and unit-tested against:
  - unowned cells,
  - contested cells,
  - own-last-click locks,
  - depleted max-depth resource cells.
- Renderer `lastClickIndex` remains synced, so orbital lock colour cannot drift from the server.
- **105/105 tests.**

### Still open

- Browser colour-vs-`/api/action` round-trip assertion.
- Single-renderer/controller parity and final humanoid rig.
- Robot beam visual assertion and orbital supply relocation.

### Release artifact

- Source tag: `v3.45.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.45.0
- Archives + `SHA256SUMS` attached.

---

## v3.44.0 — “Two Clients” (2026-11-18)

### Added

- **Two-client surface acceptance harness** (`scripts/acceptance-two-client-surface.mjs`):
  two real browser contexts join, enter the surface and verify peers/robot server poses with no
  page errors.
- Robots now spawn on a visible ring around active human surface pilots instead of directly on top
  of them.
- Incident reachability and deterministic rotation retained.
- **104/104 tests.**

### Still open

- Robot beam-to-authoritative-cell visual assertion.
- Full single-renderer/controller parity and final humanoid rig.
- Supply relocation for every human in the orbital view.
- Colour/server truth test.

### Release artifact

- Source tag: `v3.44.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.44.0
- Archives + `SHA256SUMS` attached.

---

## v3.43.0 — “Incidents Reachable” (2026-11-18)

### Fixed

- Incidents now also fire when the refit mission is complete, even if unrelated hidden deposits
  remain. Previously mission/supply deposits could keep incidents unreachable forever.
- Deterministic incident rotation retained: `meteor → nuclear → solar → alien`.
- Updated meteor test to stop clicking stale labels once the incident resets the crust.
- **104/104 tests.**

### Still open

- Five-tetra ship/effect visual coverage for every incident.
- Two-client robot/supply acceptance.
- Single-renderer/controller parity and final 3D humanoid rig.

### Release artifact

- Source tag: `v3.43.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.43.0
- Archives + `SHA256SUMS` attached.

---

## v3.42.0 — “Event Cycle” (2026-11-18)

### Added

- **Deterministic incident rotation:** `meteor → nuclear → solar → alien` instead of random repeat.
  All four event kinds are unit-tested. The end-of-crust gate remains until the hidden deposit count
  reaches zero.
- Camera direct-direction and pole-direction tests.
- Robot surface routes now start near active human surface pilots, keeping the opponents visible.
- **103/103 tests.**

### Still open

- Incident reachability in ordinary play without exhausting every deposit.
- Two-client robot/supply acceptance.
- Single-renderer/controller parity and final humanoid rig.

### Release artifact

- Source tag: `v3.42.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.42.0
- Archives + `SHA256SUMS` attached.

---

## v3.41.0 — “Stable Hands” (2026-11-18)

### Fixed / changed

- **Mouse drag direction is now stable.** Replaced the absolute trackball (`arcballTo`) with incremental
  screen-space rotation; direction cannot flip when the pointer leaves the virtual ball or the view
  crosses a pole. Added direction + pole tests.
- **Robots now route/spawn near active human surface pilots**, so they are visible and contest the
  same crust instead of walking an unrelated patch. Server-authoritative pose/click remains.
- Supply impact snap and robot surface publication retained.
- Current **102/102 tests**.

### Still open

- Live feel/sign-off for mouse drag and pole view.
- Two-client robot beam/visual acceptance.
- Full single-renderer/controller parity, final humanoid rig, deterministic incidents.

### Release artifact

- Source tag: `v3.41.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.41.0
- Archives + `SHA256SUMS` attached.

---

## v3.40.0 — “Server-Side Riggers” (2026-11-18)

### Added / fixed

- **Authoritative robot surface routes.** Each robot gets a server-generated surface position,
  heading and turn schedule; robots publish their surface pose in player state and via `surface`
  events.
- **Robots mine the cell under their own surface pose.** The server resolves the active leaf at the
  robot surface point and clicks that label using the robot's real token; cell/break events remain
  authoritative.
- **Supply surface focus.** A supply drop now snaps every surface pilot to the impact cell
  (`surface.focusLabel`) so they can mine the marked cells immediately instead of only watching the
  camera turn.
- **Named farthest orbit zoom:** `ORBIT_FAR_ZOOM = 0.4`.
- New test: robot surface pose is unit-length, published to clients, resolves to an active leaf and
  the robot mines that cell. **100/100 tests.**

### Still open

- Two-client visual/beam verification for robots.
- Full single-renderer/HUD controller duplication removal (D1/D2).
- Stable reverse controls/pole visibility, automated colour/server truth test, orbital relocation
  test for supply.

### Release artifact

- Source tag: `v3.40.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.40.0
- Archives + `SHA256SUMS` attached.

---

## v3.39.0 — “Same Renderer, Real Figures” (2026-11-18)

### Changed

- **Surface now renders through the existing `IcosaRenderer` with `SurfaceCamera`.** The old
  separate terrain canvas no longer draws sky/terrain; the main orbital HUD remains mounted and
  visible, with surface target/lap/exit as minimal overlays.
- **Replaced 2D surface sprites with projected low-poly 3D humanoid meshes**: head/visor, torso,
  hips, arms and legs built from closed triangles and depth-sorted through the same surface camera.
- **Removed cached planet wording/behavior:** `surfaceLiveFaces` is rebuilt from the live leaf list
  on every authoritative cell/break/click.
- Updated [REQUESTS_24H.md](REQUESTS_24H.md) with the new 3D-humanoid and no-cache requirements,
  reordered priorities and honest partial/open statuses.

### Still open

- Derived visual mesh/controller duplication removal (D1/D2).
- Final humanoid art/rig/animation and peer verification (D15).
- Multiplayer live-mutation surface test (D16).
- Authoritative robot surface paths/mining, supply relocation, stable controls/poles, deterministic
  incidents.

### Verification

- Browser: renderer surface mode draws live cells; no surface terrain canvas; main HUD visible.
- **99/99 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.39.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.39.0
- Archives + `SHA256SUMS` attached.

---

## v3.38.0 — “Delivery Contract” (2026-11-18)

### Added / fixed

- **Delivery task contract** added: [DELIVERY_TASKS.md](DELIVERY_TASKS.md) defines the remaining work
  file-by-file with acceptance tests, including the single-scene renderer migration, authoritative
  robot surface mining, supply focus for every human, controls/pole regressions, colours and exit
  zoom.
- **Renderer lock-state sync:** `IcosaRenderer.updateCell` now accepts and stores `lastClickIndex`;
  orbital locked-cell rendering can finally match the server's own-cell lock instead of relying on
  stale state.
- Status documents updated: README, ROADMAP, REQUESTS_24H, RELEASE_NOTES.
- No claim that the single-renderer migration is complete; it is the P0 task.

### Verification

- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.38.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.38.0
- Archives + `SHA256SUMS` attached.

---

## v3.37.0 — “Paths & Cleanup” (2026-11-18)

### Fixed

- **Surface overlay is removed from the DOM on exit**, not just hidden. A stale surface frame/canvas
  can no longer linger over the orbital HUD.
- **Virtual robots now follow generated independent Lissajous routes** with turns and radius changes,
  still completely decoupled from the local player's position/heading, plus their own mining beams.
- **Footprint harvesting is much faster** (120 ms queue instead of 900 ms), so cells under the
  avatar change/charge/break sooner as the pilot walks.
- **Explicit 24-hour request/status audit** added: [REQUESTS_24H.md](REQUESTS_24H.md).
- Target-only green/red semantics, target/supply-only pins, surface HUD isolation, 4th-rung entry,
  pole crossing, spherical arcs, opaque shell and maximum orbit zoom-out retained.

### Honest open gaps

- Surface is still a separate renderer; same active cells/terrain/owner data, not yet literally the
  same renderer with camera-only change.
- Robot surface paths/beams are visual; authoritative robot surface pose/mining mapping remains P0.
- Hidden resources remain hidden; only target/known supply pins are shown.
- Manual real-device/a11y, story voice cues, CDN and sharding remain open.

### Verification

- Browser: surface overlay removed after exit; orbital HUD returns at zoom 0.4.
- Browser: robot routes render independently; no console errors.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.37.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.37.0
- Archives + `SHA256SUMS` attached.

---

## v3.36.0 — “Only Mineable Pins” (2026-11-18)

### Fixed

- **Removed the pin forest.** Every discovered/mined resource was pinned across the surface; those
  cells are no longer mineable and should not be marked. Pins now appear only on:
  - the **target cell** under the avatar (green = harvest, red = locked), and
  - **known relief/supply cells**.
- Restored the clear target HUD: `TARGET <label> // GREEN // HARVEST` or `RED // LOCKED`.
- Cell fills use terrain/owner data and cyan edges like orbit; green/red is target-only.
- Surface HUD remains center-safe; exit returns to maximum orbit zoom-out.

### Verification

- Browser surface: no resource-pin forest; target HUD/status visible.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.
- [ROADMAP.md](ROADMAP.md) updated with this regression and open gaps.

### Release artifact

- Source tag: `v3.36.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.36.0
- Archives + `SHA256SUMS` attached.

---

## v3.35.0 — “Truth & Colors” (2026-11-18)

### Fixed / documented

- **Harvest colour semantics are now unambiguous.** Terrain/owner fills and cyan edges stay
  consistent with orbit. Only the **target cell under the avatar** gets green/red treatment:
  - GREEN TARGET = can harvest now
  - RED TARGET = locked or depleted
  - target pin + explicit `TARGET … // GREEN/RED` HUD line
  - resource/supply pins are separate diamond markers, never status colours.
- **Roadmap/audit document** added: [ROADMAP.md](ROADMAP.md) records delivered work, regressions,
  corrections, open gaps and acceptance criteria.
- **README + release notes audited** against the last 24 hours.
- **Code comments corrected** where they no longer described the system (world/bot wording,
  surface colour rules, virtual-opponent reasoning).
- **Earlier fixes retained:** independent opponent routes, remote mining beams, resource/supply
  pins, center-safe surface HUD, maximum orbit zoom-out on exit, fourth-rung landing, pole
  crossing, spherical arcs, opaque shell, terrain/owner fills, footprint harvesting, ship
  effects, five-tetra ship fleet, incidents, Quick Guide, rare budgets, audio recovery.

### Open gaps (documented, not hidden)

- Surface and orbit still use separate Canvas renderers; same data, not yet literally the same
  renderer.
- Robot surface positions/mining are visual presence; authoritative robot clicks still arrive via
  the server cell stream but are not yet mapped to their surface pose.
- Hidden resources are intentionally not shown.
- New-story voice cues, manual real-device accessibility, CDN activation and sharding/peer assets
  remain open.

### Verification

- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.
- Color target HUD/status code comment and rules audited.
- [ROADMAP.md](ROADMAP.md) is the current source of truth.

### Release artifact

- Source tag: `v3.35.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.35.0
- Archives + `SHA256SUMS` attached.

---

## v3.34.0 — “Pins & Riggers” (2026-11-18)

### Added / fixed

- **Standing resource pins.** Discovered resources and known relief-drop cells now render as
  standing diamond pins with resource colour, name and a pole above the cell.
- **Same visual language as orbit:** cell edges are cyan/white; biome/owner fills remain; the
  green/red harvest status is a compact pin, not a full-surface recolour.
- **Remote robots visibly mine:** each independent opponent avatar periodically shows its own
  triangular mining beam and sparks at its own location.
- **Central NEED summary** and bottom RETURN TO ORBIT remain; side HUD clamp-safe.
- **Exit returns to maximum orbit zoom-out (`0.4`)**.
- Independent opponent homes, spherical arcs, opaque shell, pole crossing, fourth-rung entry and
  footprint harvesting retained.

### Verification

- Surface shows resource/supply pins and cyan cell edges.
- Remote mining beams render at independent opponent positions.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.34.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.34.0
- Archives + `SHA256SUMS` attached.

---

## v3.33.0 — “Back to Orbit” (2026-11-18)

### Fixed

- **Surface HUD no longer clips off-screen.** Stats, mission panel and central NEED summary use
  clamp/safe-area positioning; RETURN TO ORBIT moved to the bottom centre (top right on phones).
- **Central NEED line** under the title always shows remaining refit materials even if the side
  panel is clipped.
- **Leaving the surface now returns to maximum orbit zoom-out** (`zoom = 0.4`), not the deepest
  cell zoom. The orbital HUD returns.
- Terrain cell fills brightened to read closer to the orbital view.
- Independent opponent routes, same terrain/owner palette, edge-only green/red, spherical arcs,
  opaque shell, pole crossing, fourth-rung landing and footprint harvesting retained.

### Verification

- Surface HUD fully inside the viewport; central NEED summary and bottom exit visible.
- Exit: surface hidden, orbital HUD visible, zoom 0.4.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.33.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.33.0
- Archives + `SHA256SUMS` attached.

---

## v3.32.0 — “Own Routes” (2026-11-18)

### Fixed

- **Remote opponents no longer follow the local player.** Each virtual pilot/robot gets one fixed
  home position and orbit at surface entry, then moves only relative to that home. Their heading,
  phase and speed are independent of the local player's position and camera.
- Real surface pilots still use their own synced positions; robots/others are rendered on their
  independent routes.
- Same terrain/owner palette, edge-only green/red harvest status, spherical cells, opaque shell,
  pole crossing, fourth-rung landing, HUD isolation, footprint harvesting and ship effects retained.

### Verification

- Opponent position calculation no longer references local `pos` or `headingVec` after home setup.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.32.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.32.0
- Archives + `SHA256SUMS` attached.

---

## v3.31.0 — “Same World” (2026-11-18)

### Fixed

- **Surface cells now use the same terrain/owner palette as orbit.** Fills come from the active
  cell's biome elevation and player ownership, not from a red/green recolour.
- **Green/red is now only the cell-boundary harvest affordance:** green edge = can harvest,
  red edge = locked/empty. Cell geography remains readable.
- Subtle spherical sub-triangle edges show the arc triangulation without replacing the parent cell
  colour.
- **All online pilots/robots render as the same detailed walking avatar** with colour and callsign.
  Real surface positions are used when available; other online players/robots use deterministic
  surface routes.
- **Orbital HUD is fully hidden in surface mode**; no panels or score bleed through.
- Surface entry occurs after the fourth zoom rung.
- Pole movement remains parallel-transported and seamless.
- Opaque shell, green/red edges, mission panel, footprint harvesting, tractor effects and helmet
  retained.

### Verification

- Surface render now uses node terrain + owner colours; boundary status edges remain.
- Browser: HUD hidden; fourth zoom enters surface; robots/pilots walk as avatars.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.31.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.31.0
- Archives + `SHA256SUMS` attached.

---

## v3.30.0 — “Surface Discipline” (2026-11-18)

### Fixed

- **Seamless pole crossing on the surface.** Movement now carries a world-space tangent heading
  and **parallel-transports** it across the sphere instead of rebuilding east/north at each step.
  Turning uses local-normal rotation; crossing a pole no longer stops, flips or snaps the view.
- **Orbital HUD completely hidden in surface mode.** The surface overlay now owns the screen; no
  panels, score, dock, status buttons or orbital HUD can bleed through.
- **Every online pilot/robot walks the surface.** Real surface pilots use synced positions; other
  online pilots/robots are drawn with deterministic surface routes and the same detailed avatar
  system, colour and callsign.
- **Surface entry after the fourth zoom rung** (D0→D3), not at the planet’s max depth.
- Green/red affordances, mission panel, footprint harvesting, ship effects, opaque shell,
  spherical arcs and helmet retained.

### Verification

- Pole-crossing unit tests: 30 steps remain normalized/tangent; repeated turns stay tangent.
- Browser: HUD computed hidden in surface mode; fourth zoom notch enters surface.
- Browser: online robots/pilots render as walking avatars on the surface.
- **97/97 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.30.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.30.0
- Archives + `SHA256SUMS` attached.

---

## v3.28.0 — “Spherical Arcs” (2026-11-18)

### Fixed

- **Surface triangles are now spherical arcs, not flat chords.** Each active cell is adaptively
  subdivided along the actual sphere (large cells more, small cells less) with every child vertex
  normalised back to the sphere.
- **Opaque low-poly planet shell** remains under the cell layer, hiding the far side; the shell uses
  the same icosahedral geometry and no geography sampling.
- Footprint harvesting, green/red affordances, mission panel, helmet head, ship tractor effects and
  peer surface presence retained.
- **Performance:** adaptive subdivision caps visual triangle counts, caches by cell label + level,
  and keeps the base shell static.

### Verification

- Surface close-up renders small spherical arc triangles rather than giant flat planes.
- Far side no longer shows through.
- **95/95 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.28.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.28.0
- Archives + `SHA256SUMS` attached.

---

## v3.27.0 — “Underfoot” (2026-11-18)

### Fixed / changed

- **Opaque planet surface restored under the cell layer.** A low-poly spherical shell now sits
  beneath the live triangles, so gaps no longer reveal the far side of the planet. It uses the same
  icosahedral geometry, with no geography/terrain sampling.
- **Every touched triangle harvests.** The avatar now samples a wider footprint (nine points across
  the feet) and auto-harvests every active green cell under it, with a small queue for cells found
  on the same tick. Locked/red cells are skipped.
- **Head redesigned:** faceted helmet, faceplate, jaw, neck and crest instead of the old flat
  triangle head.
- Surface red/green affordances, **WHAT SHE NEEDS** mission panel, resource tractor beam and
  five-tetra ship effects retained.
- Peer surface pilots remain synced.

### Verification

- Surface mission panel still lists required parts and counts.
- Opaque shell hides the far side; live cells remain the only cell layer.
- Footprint sampling covers multiple active cells; harvest effects fire.
- **95/95 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.27.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.27.0
- Archives + `SHA256SUMS` attached.

---

## v3.26.0 — “Green Means Go” (2026-11-18)

### Added / fixed

- **Surface information restored.** A **WHAT SHE NEEDS** panel lists every remaining refit item,
  owned/required counts, and RARE markers. The planet name and lap target are visible again.
- **Clear surface affordances:**
  - **GREEN triangle** = this pilot can harvest/charge it now.
  - **RED triangle** = locked to this pilot, already depleted at max depth, or otherwise unavailable.
- **Ship harvest effects:** on a resource hit or auto-harvest scan, the surface shows a triangular
  tractor cone from the five-tetra ship, a ship silhouette above, triangular resource particles and
  a floating `+value RESOURCE` label.
- Surface remains live-cell-only: no generative geography, no terrain sampling.
- Peer surface pilots/positions and the 60-second lap remain.

### Verification

- Surface mission panel shows the active refit resources and counts.
- Green/red semantic colours verified in browser.
- Harvest beam/ship effect wired to the authoritative resource event and auto-harvest.
- Surface still renders only triangles.
- **95/95 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.26.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.26.0
- Archives + `SHA256SUMS` attached.

---

## v3.25.0 — “Live Cells” (2026-11-18)

### Changed

- **Surface view uses only the live cell triangles.** Removed generated ground/geography and all
  terrain sampling from the surface renderer. It draws the actual active cells (visually subdivided
  into triangles), so mining colour/charge, breaks and newly exposed children are reflected
  immediately.
- **Smaller planet:** surface radius reduced and camera moved to the crust; normal running speed
  still completes one lap in **60 seconds**.
- **Better humanoid:** larger layered triangle pilot with helmet/visor, chest core, shoulder pads,
  animated arms and legs, and a contact shadow.
- **Other pilots on the surface:** transient `surface` / `surface_leave` presence events are
  broadcast within the planet room. Other human avatars and callsigns appear in the same surface
  view and walk using their transmitted positions. No positions or tokens are persisted.
- **Performance:** live-cell visual triangles are cached by label, terrain sampling is gone, harvest
  checks are throttled, and the orbital renderer is skipped while surface mode is active.
- Touch controls, exit-to-orbit, landing ship and triangle-only aesthetic retained.

### Verification

- Live-cell surface renders; no geography/terrain code remains.
- Two-client surface test: positions and `surface_leave` broadcast to both clients.
- Humanoid/landing/lap/auto-harvest/exit behaviour tested without console errors.
- **95/95 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.25.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.25.0
- Archives + `SHA256SUMS` attached.

---

## v3.24.0 — “Small World” (2026-11-18)

### Added

- **Surface mode.** One more zoom notch past the deepest cell level lands the five-tetrahedron ship.
  The pilot then runs a deliberately tiny planet in third person.
- **60-second lap:** base running speed is `2π / 60` rad/s, so holding forward at normal speed
  circles the world in exactly **60 seconds**. `Shift` sprints; `A/D` turn.
- **Auto-harvest:** entering a triangle calls the normal authoritative click path for the active leaf
  under the player, and keeps charging while the pilot stays inside it.
- **Triangle-only surface:** low-poly triangle ground, triangle mountains/ridge, triangle avatar and
  the same five-tetrahedron ship for landing and departure.
- Enter from the wheel **or** pinch at deepest zoom. Exit with **RETURN TO ORBIT** or Escape.
- Touch pads for mobile; desktop HUD shows lap counter and auto-harvest cell.

### Verification

- Wheel entry: deepest rung → next wheel opens surface landing.
- Landing ship renders; avatar appears only after touchdown.
- Walking updates the lap counter; auto-harvest reports the active cell label.
- Exit returns to orbit at the deepest zoom; no console errors.
- **94/94 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.24.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.24.0
- Archives + `SHA256SUMS` attached.

---

## v3.23.0 — “Triangle Fleet” (2026-11-18)

### Added

- **One five-tetrahedron ship**, shared by every cinematic:
  - arrival in the load-in intro;
  - departure/drift/arrival during interplanetary transit;
  - relief ship in emergency supply drops;
  - alien ships in the alien-invasion incident.
- **Triangular geometry everywhere it matters:** 5 tetrahedra × 4 triangular faces, projected and
  flat-shaded by `public/js/shared/tetra-ship.js`. No textures, no models, no dependencies.
- **Solar flare has a visible faceted triangle sun** with a triangular corona and our ship fleeing
  the storm.
- **Alien invasion has actual spacecraft** above the planet, with triangle-only tractor beams.
- Meteor/nuclear effects remain low-poly; relief canisters and fire columns are triangular.

### Verification

- Five-tetra model test: exactly 5 tetrahedra, 4 vertices each, 20 triangular faces, finite
  projection and engine point.
- Browser: intro ship, solar sun, alien ships, relief ship and incident story descriptions render
  without console errors.
- **94/94 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.23.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.23.0
- Archives + `SHA256SUMS` attached.

---

## v3.22.0 — “Real Opponents” (2026-11-18)

### Corrected — this supersedes v3.20/v3.21 solo behaviour

- **The own-cell contest lock is restored permanently.** You cannot mine the same cell repeatedly.
  After your click, another operator must contest it before you can charge it again.
- **Opponent spawn/priority fixed.** When you are the only human on a planet, the scene staffs two
  robots; a robot now **prioritises the cell locked to you** and contests it, so the lock is always
  breakable. With two humans there is one robot; with three or more humans robots are removed and
  humans contest each other.
- **No solo-farming shortcut.** The v3.20 “lone human can keep charging” behaviour was a
  misinterpretation of the report and is removed. Tests, UI lock state, renderer red-lock and
  documentation are consistent again.
- Manual-only zoom, direct mouse drag and inverse arrow travel from v3.20/v3.21 are retained.

### Verification

- Robot priority test: even with an explore-biased RNG, a robot contests the locked human cell and
  the human can act again.
- Lock is always enforced solo; no infinite same-cell mining.
- **93/93 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.22.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.22.0
- Archives + `SHA256SUMS` attached.

---

## v3.21.0 — “Right Way Round” (2026-11-18)

### Fixed

- **Mouse drag now follows the cursor directly.** Drag left and the planet rotates left, even when
  the globe is upside down. The arcball grab is captured at pointerdown, so direction cannot drift
  mid-drag. Direct drag is the default; `I` still offers an optional reverse.
- **Arrow travel is deliberately inverse.** Press left and the planet rotates right; this is the
  expected “travel around the planet” feel and remains stable after the planet has been rolled
  upside down.
- **No automatic zoom.** Clicking/fracturing never changes zoom; wheel, pinch, double-click and
  explicit NAV focus are the only zoom controls.
- **Solo mining** remains available when no other human is online; contest rules return with an
  opponent.

### Verification

- Projected-cell motion test before flipping: drag left → screen x −208 px; ArrowLeft → screen x
  +346 px.
- Same test after repeated vertical flips: drag left → −158 px; ArrowLeft → +495 px.
- **92/92 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.21.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.21.0
- Archives + `SHA256SUMS` attached.

---

## v3.20.0 — “No Opponent Required” (2026-11-18)

### Fixed / changed

- **Solo mining.** With one online human in the planet room, the own-cell contest lock is disabled:
  you can charge and break repeatedly. When a second human is present, the lock returns. Server,
  renderer and target inspector use the new `humansOnline` state.
- **No automatic zoom.** Clicking or fracturing no longer changes zoom. Zoom happens only through
  mouse wheel, pinch, double-click focus or the explicit NAV focus control.
- **Stable mouse drag.** Mouse rotation now uses an absolute arcball grab captured at pointerdown,
  so the planet follows the cursor consistently for the whole drag; release no longer adds a
  spin that can reverse direction.
- **Manual zoom ladder** and quaternion rotation retained.

### Verification

- Solo browser: repeated clicks break a cell with no opponent; zoom stays at ×1.0.
- **91/91 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.20.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.20.0
- Archives + `SHA256SUMS` attached.

---

## v3.19.0 — “Everyone Digs” (2026-11-18)

### Changed

- **Emergency supply drops are now planet-wide events.** The server already broadcasts to the
  planet room; every human client now treats the drop as a shared race:
  - all pilots receive the same marked cells;
  - any pilot can mine the supplied deposits;
  - every view turns smoothly toward the impact point (`impactLabel`);
  - the crash overlay, markers, Captain’s Log and beacon all appear for everyone.
- Added a server test with two humans in the same planet room: both receive the same supply cells,
  and the pilot who did not call the drop can mine a supplied cell.
- Added a client test that a supply event rotates the camera toward the impact.

### Verification

- **91/91 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.19.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.19.0
- Archives + `SHA256SUMS` attached.

---

## v3.18.0 — “Read This First” (2026-11-18)

### Added / changed

- **Quick Guide for new pilots.** A one-screen card opens on first landing and is always available
  behind **GUIDE** or the shareable URL `?guide=1`. It answers:
  - **What to mine:** the THE WAY HOME panel; RARE markers.
  - **How to mine:** click/tap a triangle; four clicks break it; deeper cells need eight.
  - **Where to dig:** hidden ore, gold NAV beacon, cargo panel, zoom levels.
  - **How to leave:** fill all systems and use TRY TO FLY AWAY.
- **Copy Guide Link** button for sharing the quick guide with a new pilot.
- **Gentler early rare budgets:** planets 0–1 require exactly one rare unit, planet 2 up to two,
  planet 3 up to three; deeper planets keep the full rare challenge. Refit total unit counts and
  category pools are preserved.
- **GUIDE.md** quick reference for sharing outside the game.

### Verification

- First-run guide opens after the landing brief; GUIDE reopens it; manual/share actions work.
- Early rare caps tested across seeds/depths; **90/90 tests**.
- Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.18.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.18.0
- Archives + `SHA256SUMS` attached.

---

## v3.17.0 — “What Happened Here” (2026-11-18)

### Added / changed

- **Incidents now explain themselves.** Every catastrophe sends a short headline plus a full story
  paragraph:
  - **Meteor Impact:** “A rogue meteor punched straight through the surface… cracked open fresh ore
    veins and threw rare material across the crater.”
  - **Nuclear War:** “Atomic fire swept the planet… blast waves split the crust and exposed new
    materials; everything old is ash.”
  - **Solar Flare:** “The local star lashed out… magnetic storm peeled back rock and scattered rare
    elements across the new ground.”
  - **Alien Invasion:** “An alien fleet razed the planet from orbit… beams demolished the old
    surface and scattered new elements and materials across the wreckage.”
- The Captain’s Log keeps the explanation after the incident overlay clears, instead of being
  overwritten by the next routine status refresh.
- Incident SSE event now includes `description`.

### Verification

- Overlay shows title, short message and story paragraph; Captain’s Log retains it.
- **89/89 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.17.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.17.0
- Archives + `SHA256SUMS` attached.

---

## v3.16.0 — “Two Hands” (2026-11-18)

### Changed

- **Mouse and cursor navigation are now separate systems:**
  - **Mouse drag** freely rotates the planet on a quaternion trackball (release inertia retained).
  - **Arrow keys** travel around the planet in a natural upright orbit with eased acceleration;
    `Shift` boosts speed. Keyboard travel no longer shares the mouse trackball math, so it cannot
    tumble/roll the planet unexpectedly.
- Mouse interaction re-syncs the keyboard orbit from the current view direction; the two modes hand
  over cleanly.
- Help text, HUD legend and narration updated; narration cache-busted at `?v=3.16.0`.
- Depth zoom ladder and cubic-bezier steps from v3.15 retained.

### Verification

- Mouse drag: orientation changes freely; keyboard: upright yaw/pitch travel with no roll; both
  produce finite projections/picking.
- **89/89 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.16.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.16.0
- Archives + `SHA256SUMS` attached.

---

## v3.15.0 — “Zoom Levels” (2026-11-18)

### Added / changed

- **Depth-aware zoom ladder.** Wheel and pinch now step between action levels:
  `D0 = ×1`, `D1 = ×2`, `D2 = ×4`, … up to the planet's max depth. Each step uses a fast
  **cubic-bezier(0.16, 1, 0.3, 1)** settle instead of a long exponential drift.
- **Action-level snap.** Clicking a cell moves the camera to that cell's level; when your own break
  creates the next generation, the camera advances to the child level automatically.
- **Pinch** remains continuous while fingers move and settles to the nearest level rung on release.
- **Limitless quaternion trackball** and reverse-drag navigation retained.

### Verification

- Wheel test: D0 → D1 (×2) → stopped at planet max level → D1 → D0; transitions animate and settle.
- **89/89 tests**, Chromium + WebKit UI audits clean, axe clean.

### Release artifact

- Source tag: `v3.15.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.15.0
- Archives + `SHA256SUMS` attached.

---

## v3.14.0 — “Free Rotation” (2026-11-18)

### Changed

- **Limitless camera rotation.** The old yaw/pitch orbit clamped pitch at ±1.35 rad and stopped at
  the poles. It is replaced by a normalized **quaternion trackball**: drag, release inertia and
  arrow steering rotate around the camera's local axes, so the view can roll past both poles and
  continue indefinitely in every direction. Projection, screen-ray picking and renderer culling all
  use the quaternion orientation, so the planet stays correct after rolling.
- **Steady navigation:** smooth arrow steering, Shift boost and `I` drag inversion remain.
- **Relief repeat/audio resilience** from v3.13 are retained.

### Verification

- Geometry tests updated for unbounded pitch, finite projection and picking after rolling through
  the pole; **89/89** full tests.
- Browser check: repeated vertical drags move pitch from 0.27 to -8.48 rad, with surface and cell
  picking still intact; no console errors.

### Release artifact

- Source tag: `v3.14.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.14.0
- Archives + `SHA256SUMS` attached.

---

## v3.13.0 — “Steady Hands” (2026-11-18)

### Fixed / changed

- **Relief drops repeat.** If the refit is still missing parts, another emergency ship can arrive
  after every two-minute stuck window. Server cooldown replaces the old one-per-planet lock; the
  client restarts the countdown after each drop and resets it whenever needed progress is made.
- **Reverse-drag navigation.** Drag now steers the view toward where you want to go instead of
  moving the planet with the cursor. Arrow keys steer continuously and smoothly; hold Shift for a
  faster pan. `I` toggles reverse drag / move-the-world.
- **Audio stays alive.** Audio contexts are resumed after tab visibility changes and interruptions,
  a 15-second watchdog keeps them warm, and a single failed narration clip no longer locks all
  future voice playback. New narration clips are cache-busted (`?v=3.13.0`).
- **Ship story UI / rare parts / planet colours** from v3.12 are retained and polished.

### Verification

- Full `node --test test/` — **89/89 pass**.
- Supply repeat tests cover cooldown, missing placement, first-click mining and event shape.
- UI audit clean in Chromium + WebKit; axe clean in both engines.
- 65-second audio-idle check: context running, narration still unlocked.

### Release artifact

- Source tag: `v3.13.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.13.0
- Archives + `SHA256SUMS` attached.

---

## v3.12.0 — “The Relief Ship” (2026-11-18)

### Added

- **Captain's Log and humanised ship panel.** The refit panel now reads as a story (“We're grounded
  on …”), names missing parts in plain language, and includes a relief-ship countdown.
- **Emergency supply drop.** If no needed refit progress happens for **two minutes**, a relief ship
  crashes onto the planet, scatters the missing ore across nearby triangles and marks them with
  salvage rings. Deposits are mineable on the first successful click; repeatable every two-minute stuck window until the parts are found.
- **Rare parts in every mission.** Every planet now guarantees at least one rare material, marked
  **RARE** in the refit list.
- **Reverse-drag and smooth arrow navigation.** Drag now steers the view toward where you want to
  go rather than moving the planet with the cursor; arrow keys apply continuous eased rotation
  (Shift boosts) and `I` flips the drag mode.
- **Planet major colours.** Eight palettes tint surface, atmosphere, HUD identity and landing
  briefing so worlds feel visibly different.

### Verification

- Full `node --test test/` → **89/89 pass**.
- UI audit clean in Chromium; axe WCAG audit clean; supply crash visual exercised via QA.
- Server tests cover the 120-second gate, missing-resource placement, cooldown, event shape and
  rare-material guarantee.

### Release artifact

- Source tag: `v3.12.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.12.0
- Archives + `SHA256SUMS` attached.

---

## v3.11.0 — “Accessible Edge” (2026-11-18)

### Added / fixed

- **axe-core WCAG A/AA audit** (`npm run audit:a11y`, optional dev-only) clean in Chromium and
  WebKit. Fixed resource-market keyboard access and duplicate visible/accessible control labels.
- **Chaos restart test** (`npm run chaos:test`): live SSE clients are killed with the server,
  restart on the same data dir, and all pilots/tokens/routing survive and reconnect.
- **5-minute soak** clean: 40 clients / 20 SSE, HTTP p95 1 ms, 0 errors, 0 dropped SSE.
- **axe-core WCAG audit** (`npm run audit:a11y`) clean in Chromium and WebKit.
- **WebKit UI audit** support for the nine-viewport harness.

### Verification

- UI audit clean in **Chromium and WebKit**.
- axe-core: **0 serious/critical** violations on landing, HUD and Field Manual.
- Chaos test: 10/10 pilots and all live SSE clients recovered.
- Full `node --test test/` — **84/84 pass**.
- CDN-ready `ASSET_BASE_URL` shipped and verified.

### Release artifact

- Source tag: `v3.11.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.11.0
- Archives + `SHA256SUMS` attached.

---

## v3.10.0 — “Edge & Load” (2026-11-18)

### Added

- **B1 CDN-ready asset delivery:** `ASSET_BASE_URL` rewrites the narration asset base at serve
  time; audio remains versioned and immutable. CORS/range/edge cache rules documented in
  `EDGE_DEPLOYMENT.md`.
- **B3 load/soak/chaos harness:** `npm run load:test` runs join/click/SSE workloads and checks
  HTTP p95, event-loop p95, dropped SSE and errors. See `LOAD_TEST.md`.
- **A4 automated accessibility:** Chromium + WebKit audit engines, accessible-name checks,
  44 px touch targets, short-landing checks, keyboard Escape behavior. Manual device/screen
  reader checklist in `A11Y_CHECKLIST.md`.
- **B2/B4 decision recorded:** sharding is **not started** because single-node SLOs are healthy;
  peer-assisted assets are **not started** because there is no CDN miss/egress signal to justify
  them. This follows the gate in `DELIVERY_PLAN.md`.

### Verification

- Full `node --test test/` — **84/84 pass**.
- UI audit clean in **Chromium and WebKit** across nine viewports.
- 100-client local load smoke: HTTP p95 1 ms, 0 errors, 0 dropped SSE, event-loop p95 ~21 ms
  (monitor floor 20 ms; gate <50 ms).
- `GET /api/metrics` and telemetry verified end-to-end.

### Release artifact

- Source tag: `v3.10.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.10.0
- Archives + `SHA256SUMS` attached.

---

## v3.9.0 — “Observable Skies” (2026-11-18)

### Added

- **Track B0 observability:** `GET /api/metrics` (HTTP latency p50/p95/p99, SSE active/opened/
  closed per planet, per-planet aggregates, event-loop delay, heap/RSS) and privacy-safe
  `POST /api/telemetry` for Web Vitals, HUD long tasks and audio-first-word timing. No tokens,
  tags, player ids or hidden deposits in metrics. See `OBSERVABILITY.md`.
- **A3 mobile controls:** visible short labels (SFX/CC/VOX/MANUAL), 44 px touch targets, top-row
  clutter reduced, in-game chrome hidden on the landing screen.
- **Voice hint:** captions show `TAP FOR VOICE` until the first gesture unlocks autoplay.
- **Short-landscape landing:** two-column layout keeps JACK IN on-screen at 844×390 and 792×302.
- **A4 keyboard/accessibility:** Escape closes manual/brief/CTA; the audit harness now checks
  accessible button names, 44 px targets and short-landing visibility.

### Verification

- `npm run audit:ui` clean across nine viewports (score, target/subtitle, intro/steer, mobile
  labels/targets, landing).
- `/api/metrics` + telemetry verified end-to-end (HTTP/SSE/planet metrics, beacon aggregates).
- Full `node --test test/` → **84/84 pass**.

### Release artifact

- Source tag: `v3.9.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.9.0
- Archives + `SHA256SUMS` attached.

---

## v3.8.1 — “HUD Safety” (2026-11-18)

### Fixed

- **Score no longer covered** by the planet badge/NAV/action row. Planet identity moved into the
  brand block; status actions are icon-only; NAV chip moved below the score. Score overlap is 0 at
  all audited viewports.
- **Landing briefing and escape CTA are viewport-capped and scrollable**, so their primary actions
  are reachable on 792×302 and other short screens.
- **Subtitle safe zones:** target inspector, Field Manual and intro touch steering no longer get
  covered by captions. On very short intro screens the touch pads are hidden in favour of drag.
- Mobile NAV position adjusted below the new identity row.

### Added

- **A0 UI audit harness** (`npm run audit:ui`, Playwright optional via `PLAYWRIGHT_MODULE`):
  nine viewports, score-overlap, target/subtitle, intro/steer, overflow and console assertions.
- `UX_AUDIT.md` and `DELIVERY_PLAN.md` committed with remediation status.

### Verification

- `npm run audit:ui` — all nine viewports clean; 76/76 `node --test` tests.
- Production remains the authoritative v3.8.0 world; this release is client UI only.

### Release artifact

- Source tag: `v3.8.1`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.8.1
- Archives + `SHA256SUMS` attached.

---

## v3.8.0 — “Borrowed Worlds” (2026-11-18)

### Added / changed

- **Cultural planet-name catalog.** Planet names now come from a curated list spanning
  *The Hitchhiker's Guide to the Galaxy* (MAGRATHEA, VOGSPHERE, BETELGEUSE FIVE, DAMOGRAN,
  GOLGAFRINCHAM…), Star Wars (TATOOINE, HOTH, CORUSCANT…), Marvel (ASGARD, XANDAR…), DC
  (KRYPTON, OA, APOKOLIPS…), Dune (ARRAKIS, CALADAN…), Doctor Who, Star Trek, Alien, Avatar,
  Foundation, Transformers, myth and more.
- **Source attribution in-game:** planet badge tooltip/ARIA and the landing briefing show the
  name's source (e.g. `MAGRATHEA // HITCHHIKER'S GUIDE`). Names cycle with a suffix after the
  catalog is exhausted.
- Intro copy, landing defaults and server state now carry the dynamic planet name and source.

### Verification

- 76/76 `node --test` tests; browser check shows MAGRATHEA / HITCHHIKER'S GUIDE on the first
  landing with generated 3-unit requirements.

### Release artifact

- Source tag: `v3.8.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.8.0
- Archives + `SHA256SUMS` attached.

---

## v3.7.0 — “Variable Frontier” (2026-11-18)

### Added / changed

- **Procedural refit missions.** Every planet's requirements are generated from its seed:
  planet 0 is a minimal 3-unit mission (one material in each of Fuel/Hull/Warp), and each deeper
  planet adds a random cumulative **0–3 units**, mixing fuel/hull/warp materials from category pools.
  No fixed 11-unit recipe, no hardcoded per-planet counts. Different seeds produce different
  materials and totals.
- **Full cargo inventory.** A new `CARGO // ALL MATERIALS` panel lists every ore collected, including
  surplus beyond the refit requirements — the player sees gold/etc. even while waiting for another
  material, and everything is carried to the next planet.
- **Random destinations among five future planets.** Escaping now picks `index + 1 … index + 5`
  randomly (never backwards); each destination gets its own generated mission and scene.
- Server re-derives missions from `planetSeed` and guarantees deposits after seed-changing incidents;
  legacy worlds get a one-time mission top-up on load.

### Verification

- 76/76 `node --test` tests: procedural determinism/variation, 0–3 growth, no duplicate resources,
  exactly 5 random destination offsets, seed-derived server missions, carried cargo.
- Browser check: planet 0 shows 3 required units; cargo panel shows surplus materials.

### Release artifact

- Source tag: `v3.7.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.7.0
- Archives + `SHA256SUMS` attached.

---

## v3.6.0 — “Load Management” (2026-11-17)

### Changed

- **Narration startup/transition latency reduced.** Only the first sentence of each cue is
  prefetched at idle (28 requests, max 3 concurrent) instead of eagerly loading the whole
  story/intro metadata set; the next sentence is warmed while the current clip plays. Boot audio
  requests dropped from 65 to 28.
- **Sentence gap reduced** from 340 ms to 220 ms while keeping the slower 0.94× delivery.
- **Voice assets are versioned and cached immutably** (`?v=3.6.0`,
  `Cache-Control: public, max-age=31536000, immutable`), so repeat playback and reloads do not
  re-download clips.
- Audio metadata bug fixed so real clip durations (rather than only estimates) feed story holds.

### Verification

- Playwright load check: 28 audio resources at idle, 45 total; manual story plays sentence-by-
  sentence; no console errors; 74/74 tests.

### Release artifact

- Source tag: `v3.6.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.6.0
- Archives + `SHA256SUMS` attached.

---

## v3.5.0 — “Open Voice” (2026-11-17)

### Added

- **GEORGE** — a new open-source narrator generated locally with **Kokoro-82M**
  (Apache 2.0, voice `bm_george`). It is the new default profile and has a full
  sentence-synced pack (85 clips).
- **Third selectable profile** in Field Manual → NARRATOR: GEORGE · OPEN · UK,
  DANIEL · UK, SAMANTHA · US. Selection persists per browser.
- **VOICE.md** now documents the real Kokoro generation pipeline
  (`scripts/kokoro-synth.py` + `KOKORO_PYTHON`), licensing and the Piper /
  Coqui-XTTS alternatives.
- Audio asset tree is now `public/audio/voice/<profile>/` (255 sentence clips).

### Verification

- Kokoro model installed and rendered locally; George profile loads and plays
  from `/audio/voice/george/...`, default selected, switching works, 74/74 tests.

### Release artifact

- Source tag: `v3.5.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.5.0
- Archives + `SHA256SUMS` attached.

---

## v3.4.0 — “Voice Lab” (2026-11-17)

### Added

- **Two selectable narrator profiles** in Field Manual → **NARRATOR**:
  - **DANIEL** — British male, now the default.
  - **SAMANTHA** — US female.
  The choice persists; both have full sentence-by-sentence packs (170 clips).
- **VOICE.md** documenting the voice pipeline, file naming contract and open-source upgrade path
  (**Kokoro-82M** Apache 2.0, **Piper** GPL engine, license caveats for XTTS/F5/Bark).

### Verification

- Profile switch updates active UI, persists to localStorage and loads the matching
  `/audio/voice/<profile>/...`; story/intro durations are preloaded per profile; 74/74 tests.

### Release artifact

- Source tag: `v3.4.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.4.0
- Archives + `SHA256SUMS` attached.

---

## v3.3.0 — “One Line at a Time” (2026-11-17)

### Changed

- **Narration is slower and sentence-by-sentence.** Every cue is now split into sentence-sized
  prerecorded clips (85 clips total), generated at 152 wpm and played at 0.94× with a 340 ms pause
  between sentences. Subtitles show the same single sentence, so voice and CC stay in sync.
- The interplanetary story hold now sums the actual sentence clips, so the transit stays up long
  enough to hear every line — never a cut-off story.
- Intro, contextual tips and Field Manual sections all use the same one-sentence pacing.

### Verification

- Manual story cue: segment 1/3, then 2/3 after the first clip; subtitles change one sentence at a
  time; voice and CC remain independent; 74/74 `node:test` tests.

### Release artifact

- Source tag: `v3.3.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.3.0
- Archives + `SHA256SUMS` attached.

---

## v3.2.0 — “Catastrophe Protocol” (2026-11-17)

### Added

- **Four random end-of-planet incidents** when the last hidden ore is mined:
  - **METEOR IMPACT** — orange fireball, shockwave, debris.
  - **NUCLEAR WAR** — white flash, layered red/orange shockwaves, rising fire columns.
  - **SOLAR FLARE** — white-gold whiteout, expanding halo and lens-streak rays.
  - **ALIEN INVASION** — green/violet orbital beams, scanning saucer rings and glitch tint.
- Each incident has its own SSE event kind/title/tone, screen shake, narration line and overlay
  colour, then reseeds the crust with fresh resources. Players/scores/inventories survive.
- New `tip-incident` narration cue.

### Verification

- All four effects exercised via QA overlay: correct titles/colour classes, auto-hide, no console
  errors; 74/74 `node:test` tests (incident kind validation added).

### Release artifact

- Source tag: `v3.2.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.2.0
- Archives + `SHA256SUMS` attached.

---

## v3.1.0 — “Voice of the Frontier” (2026-11-17)

### Added

- **Independent Voice + Subtitles toggles**, streaming-player style. Both persist in the browser
  and can be toggled any time. Subtitles are shown immediately even when browser autoplay keeps the
  first audio line waiting for a gesture.
- **Prerecorded narration** (27 generated clips, bundled locally): cockpit intro phases, one-time
  contextual tips, every Field Manual section, and all nine interplanetary escape stories. Dynamic
  server stories map to their prerecorded clip by id; the transit cinematic extends to fit the story.
- **Field Manual** (`?`): story, mining & charge, contest lock/robots, planets & escape, navigation,
  controls and audio, with a per-section **▶ PLAY** button.
- **Contextual tips** for first mining, red locked cells, ore discovery, escape readiness, new
  planets, meteor resets, carried cargo and navigation.
- **Interlude hold** extended so long story narration is not cut off by the landing.

### Verification

- Intro subtitles visible before any gesture; first gesture unlocks pending audio; Voice and CC
  toggle independently and persist; Field Manual opens, sections render and PLAY starts narration;
  no console errors.
- 74/74 `node:test` tests (narration is client-side; server suite unaffected).

### Release artifact

- Source tag: `v3.1.0`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.1.0
- Archives + `SHA256SUMS` attached.

---

## v3.0.8 — “Cargo & Random Veins” (2026-11-17)

### Added / changed

- **Ore inventory carries between planets.** All collected materials (`oreCounts`), total ores and
  ore value now travel with the pilot through escape. Carried ore immediately counts toward the
  next planet's refit — stockpiling and using rare finds across planets is now part of the loop.
  The old planet's ghost clone keeps its own copy.
- **Random deposit discovery.** Each hidden ore vein now has a random discovery click between 1 and
  the planet's break threshold. It can be found on the first successful click, a middle click, or
  the final breaking click — never predictable from the client. Deposits still reveal by the break
  click at the latest; rejected clicks never advance discovery. Server-only, persisted, migrated,
  never leaked on the wire.

### Verification

- 74/74 `node:test` tests, including carried inventory across escape, immediate next-mission
  readiness, random first/middle/last discovery, no-wire leak, persistence/migration.
- Manual: forced discovery on click 3 (clicks 1–2 show no ore), escape carried all 18 ores and
  their value to the next planet and was immediately usable.

### Release artifact

- Source tag: `v3.0.8`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.8
- Archives + `SHA256SUMS` attached.

---

## v3.0.7 — “Locked Red & First Briefing” (2026-11-17)

### Fixed

- **The centered landing briefing now appears on the very first planet too**, immediately after
  joining. Previously it only showed for later planets (planetIndex > 0), so reloading and starting
  a new game on ICOSA-9 showed no center requirements list.
- **Cells you mine now turn clearly red** (tint + red edge) to show they are locked to you and only
  other operators can mine them; the red clears as soon as another player/robot contests the cell.
- Added versioned asset URLs (`?v=3.0.7`) so a reload cannot run a cached old client.

### Verification

- Fresh first-planet join: centered briefing visible with `3×URANIUM / 5×SILVER / 2×GOLD /
  1×PALLADIUM` rows; START MINING dismisses.
- Mining a visible cell shows a red cell + `LOCKED // CONTEST REQUIRED`; a contest from another
  operator clears the red. 69/69 `node:test` tests.

### Release artifact

- Source tag: `v3.0.7`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.7
- Archives + `SHA256SUMS` attached.

---

## v3.0.6 — “Navigation & Full Planets” (2026-11-17)

### Added

- **Navigation target / beacon:** the HUD shows a gold **NAV** chip with the best nearby mining
  target (cell label, biome, geological ore chance). A pulsing gold beacon marks it on the planet;
  press the chip to fly the camera to it, ↻ to cycle targets.
- **Dynamic per-planet staffing:** every active planet keeps at least **3 online players**:
  1 human → 2 robots, 2 humans → 1 robot, 3+ humans → no robots (0 humans → 1 ambient robot).
  New humans displace excess robots; departures are replaced **immediately** (no spawn gap),
  including after an escape re-staffs the old and new planet.
- **More inertial glide:** released drag momentum carries longer and decays more slowly; zoom
  easing is slightly smoother too.

### Verification

- Navigation target desktop/mobile: chip + waypoint, focus and cycle buttons; zero console errors.
- Manual staffing: empty planet → ambient robot; 1 human → 3 online; new humans reduce bots;
  robot/human departures replaced immediately. Server tests cover per-planet independence.
- 69/69 `node:test` tests.

### Release artifact

- Source tag: `v3.0.6`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.6
- Archives + `SHA256SUMS` attached.

---

## v3.0.5 — “The Planet Beneath” (2026-11-17)

### Added

- **Detailed procedural geography behind the grid:** a high-resolution terrain surface now renders
  beneath the gameplay cells — deep/shallow oceans, coastlines, green lowlands, dry ochre basins,
  mountain rock and polar ice, all from the same planet seed with no textures.
- Continuous elevation/climate colour ramp replaces flat per-biome triangle patches; the surface is
  rendered through a smoothed offscreen globe so the low-poly geometry reads as a planet rather
  than flat colour plates.
- Cell fills became mostly transparent (owner tint only), so geography is visible through the
  triangular grid while ownership edges and charge rings stay crisp.
- Desktop uses a 1280-facet geography mesh, mobile a lighter 320-facet mesh for performance.

### Verification

- Desktop/mobile screenshots show oceans, landmasses, mountains and ice behind the cells; zero
  console errors; all previous camera, mining, mission and landing flows intact.
- 67/67 `node:test` tests.

### Release artifact

- Source tag: `v3.0.5`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.5
- Archives + `SHA256SUMS` attached.

---

## v3.0.4 — “Momentum & Landing Briefing” (2026-11-17)

### Added

- **Inertial planet spin:** after dragging and releasing, the sphere keeps rotating with an
  exponential ease-out curve and gradually stops instead of snapping to a halt.
- **Eased zoom:** wheel/pinch zoom now accumulates a target and glides into it over ~0.5–1 s,
  making deep zoom precise; clicking/tapping remains immediate.
- **Centered landing briefing:** every touch-down on a new planet now opens a center card showing
  planet name/levels and **exactly what to collect to leave**, with have/need per ore and
  START MINING dismiss. Works on desktop and mobile; also shown when resuming on a later planet.

### Verification

- Playwright: desktop/mobile landing briefing centered and dismissible (4 required rows on
  ICOSA-10); drag inertia measured continuing after release and decaying to zero; wheel zoom eases
  from 1.0 → 1.117 within 30 ms → 1.410 within 430 ms → settled; zero console errors.
- 67/67 `node:test` tests.

### Release artifact

- Source tag: `v3.0.4`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.4
- Archives + `SHA256SUMS` attached.

---

## v3.0.3 — “The Button in the Middle” (2026-11-17)

### Added

- When the escape refit completes, a large centered **READY TO LEAVE** card now appears with a
  pulsing **TRY TO FLY AWAY** button — impossible to miss on desktop or mobile.
- The card includes a **KEEP MINING** dismiss action and respects intro/interlude/report/drawer
  states; the original mission-panel escape button remains available after dismissal.
- The centered CTA automatically hides when the interlude starts and reappears when the mission
  becomes ready again.

### Verification

- Desktop 1440×900 and mobile 390×844: centered, in-viewport, 64px/58px button, zero console errors;
  pressing it starts the escape interlude and hides the CTA.
- 67/67 `node:test` tests.

### Release artifact

- Source tag: `v3.0.3`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.3
- Archives + `SHA256SUMS` attached.

---

## v3.0.2 — “Tutorial Ore & Meteor Recovery” (2026-11-17)

### Fixed

- Fixed meteor arming after the guaranteed refit deposits are added to a fresh planet: when the
  last hidden deposit is mined the planet now correctly reseeds instead of going barren.
- On boot, a depleted planet (no hidden deposits but prior clicks) is automatically reseeded with
  the correct mission ore, repairing worlds saved before this fix.
- The first planet reset now guarantees exactly the mission-required hidden ore: planet 1 has
  **3 uranium, 5 silver, 2 gold, 1 palladium** on mineable cells, with 20 base leaves and a max
  break depth of 1 (20 + 80 cells).
- The first planet breaks at **4 clicks** and its children cannot break again, so it teaches the
  loop and tops out at the intended second level.

### Verification

- 67/67 `node:test` tests.
- Live first boot checked: `planetLevels 2`, `maxDepth 1`, `threshold 4`, 20 leaves,
  hidden deposits exactly cover the 11 required ores.

### Release artifact

- Source tag: `v3.0.2`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.2
- Archives + `SHA256SUMS` attached.

---

## v3.0.1 — “First Planet: 2 Levels” (2026-11-17)

### Fixed

- **The first planet is now truly 2 levels deep: 20 base triangles + one 80-triangle generation
  (100 cells).** Previously the level count was passed as a break-depth cap, allowing a third
  generation (320 cells) and leaving old deep cells around. `maxDepth` is now `levels - 1`; a child
  on the first planet cannot break again.
- **The live first planet is rebuilt to that 2-level layout on load** if its tree is deeper than the
  cap. Pilots, scores, ores and inventories are preserved; ownership/clicks on the invalid deep
  grid are reset as part of the tutorial-planet rebuild.
- **The tutorial planet breaks at 4 clicks** (later planets stay at 8) so a solo pilot plus the
  always-on robot can learn the claim/contest/break loop quickly.
- **Every fresh/reset planet is guaranteed enough hidden refit ore** for its mission: on planet 1
  the server ensures at least 3 uranium, 5 silver, 2 gold and 1 palladium deposit exist on mineable
  cells before play. This prevents an unlucky planet from being impossible to escape.
- Planet badge now says `LEVELS n` (e.g. `ICOSA-9 · LEVELS 2`), and the landing/HUD copy explains
  the 20+80 layout and the 4-click tutorial threshold.

### Migration

- Restarting with v3.0.1 loads planet 0, detects any cells deeper than its level cap, rebuilds the
  grid to the fresh 2-level tutorial planet (guaranteed mission deposits), and writes it back.
  Players/scores/tokens/ore counts are unchanged. Later boots do not reset it again; planet 0 will
  grow from 20 to at most 100 cells as pilots break it.

### Verification

- 67/67 `node:test` tests, including a new first-planet break-depth test: 20 leaves → 23 after one
  cell breaks, and D1 children do not break again on planet 1; refit-ore guarantee and multi-planet
  escape/meteor tests remain green.
- Manual spare-port check: state `planetLevels 2`, `maxDepth 1`, `threshold 4`, 20 leaves, hidden
  deposits exactly cover the 11 required ores.

### Release artifact

- Source tag: `v3.0.1`
- GitHub release: https://github.com/moldovancsaba/narimato/releases/tag/v3.0.1
- Archives + `SHA256SUMS` attached to the release.

---

## v3.0.0 — “The Way Back” (2026-11-17)

First public release of **NARIMATO**, the infinite planet-escape mining game.

### Highlights

- **Cockpit launch cinematic** — wormhole exit, gravity-lock drift, steerable descent with WASD /
  arrows / touch pads, cockpit-frame failure and planet reveal. Plays on every page load as a
  loading cine; skippable and replayable, with reduced-motion support.
- **Infinite planet progression** — planet 1 is 2 levels deep, planet 2 is 3, increasing to a depth
  cap of 8. Every planet has its own multiplayer scene, robot(s), leaderboard, grid, resources and
  32-bit procedural surface.
- **Escape mission** — rebuild the drive with specific ores. Planet 1 needs 3 Uranium, 5 Silver,
  2 Gold and 1 Palladium; later planets demand scaled refits. Live HUD progress and an
  `ESCAPE // BURN FOR ORBIT` button when ready.
- **Random interplanetary stories** — nine deep-space events (space storm, pirates, wormhole
  tremor, derelict beacon, …), screen shake, hull-damage effects and emergency landing cinematic.
- **Meteor planet resets** — a fully mined-out planet is hit by a meteor; the crust is reseeded
  with new resources while players, scores and inventories survive.
- **Hidden geological resources** — 10 ores placed by biome/elevation; deep ocean is not mineable
  from the surface; discovered deposits are marked forever.
- **Multiplayer rooms per planet** — authoritative Node server, SSE, persistent token→planet
  routing, always-on creative robots per planet.
- **Responsive command deck** — deliberately different desktop, tablet, mobile portrait and
  landscape phone HUDs: planet-first mobile, safe-area dock, drawers, target sheet, touch controls.
- **Give up / start over** — ABANDON with a styled confirmation returns to the main/tag screen;
  NEW PILOT clears the browser's saved identity so a new game tag starts a fresh mission from the
  beginning. The launch intro now always leads to the tag screen (no silent auto-resume).
- **Full docs** — README, GAMEPLAY, ARCHITECTURE, research notes, specs, release notes, CI.

### Added

- `lib/planet-manager.js`: multi-planet runtime, registry, rooms, escape, meteor, random stories.
- `WorldCore`: per-planet depth, `adoptPlayer`, `resetGrid`, hidden-deposit count, meteor arming,
  persistent per-resource `oreCounts`, terrain-aware deposits.
- Shared `mission.js` planet depths/names and scaled per-planet missions.
- Shared `planet.js` 10-biome procedural surface and geological deposit weights.
- Client `intro.js`, `interlude.js`, dynamic mission/planet HUD, escape/abandon/new-pilot flows.
- Reports include ores, ore value and richest find; share card and URL carry the stats.
- CI workflow for Node 20/22.

### Changed

- **Planet 1 (ICOSA-9) is now depth 2**, not the old deep free-for-all grid. Existing pilots are
  migrated with scores, inventories and tokens preserved; the *grid* is reset to the new depth-2
  planet on first boot of this release.
- Launch intro plays every load; after it the **tag/main screen is always shown** so a pilot can
  keep their identity or enter a new tag.
- Resource deposits are now geological (biome-weighted) rather than uniform; `DEPOSIT_CHANCE` is an
  explicit test/debug override for mineable biomes only.
- `#btn-report` lives in the responsive dock; desktop shows REPORT there.
- Player colours are spaced to avoid visually similar identities; per-tag tokens create separate
  identities.

### Fixed

- Clicking your own locked triangle no longer spams optimistic `+2` feedback: the client uses the
  authoritative `lastClickIndex` leaf slot and shows one `CELL LOCKED` message.
- A new tag with an existing login token no longer hijacks/renames the old identity.
- Ocean cells no longer hide surface deposits; underwater resources are non-mineable.
- Robot callsigns are creative and varied (`VOID_SAINT`, `MAGMA_MONK`, `0X7F3A`, `DRILLBEAST`, …),
  never truncated/duplicated.
- SSE replay storms, camera/zoom alignment, mobile HUD occlusion, and stale service frames fixed.

### Migration / upgrade

1. Back up `DATA_DIR`.
2. Deploy code and restart the server. Planet 0 loads `DATA_DIR/world.json`; a registry is created
   at `DATA_DIR/planets/registry.json`; planets 1+ are created on demand under
   `DATA_DIR/planets/p<N>/`.
3. First boot of v3.0.0 resets planet 0's **grid** to a fresh depth-2 world. Player records
   (tag/colour/token/score/ores/oreCounts) are preserved. Later restarts never reset it again.
4. Share/report URLs and the public HTTP/SSE routes are unchanged; tokens keep working.
5. Static assets are served no-store; reload the browser to get the NARIMATO build.

### Verification

- **66/66** `node:test` tests across geometry, planet generation, mission/planet scaling, world
  core, multi-planet manager, escape, meteor, rooms and HTTP/SSE persistence.
- Playwright QA: desktop/tablet/mobile/landscape layouts, intro phases and skip/replay, mission
  progress, escape-ready → interplanetary interlude → planet 2 depth 3, abandon confirm → main,
  new-pilot identity clear → fresh mission, meteor overlay, report/card, zero console errors.
- E2E escape against the real multi-planet server: mission complete → ICOSA-10 depth 3, identity
  and score carried, ore run reset, mission 0/18, old planet remains for other players.

### Known limitations

- Planet depth is capped at 8 for performance; the number of planets is infinite.
- Scores per planet can become very large over a long run; leaderboard is per scene.
- Escaped pilots remain as offline ghosts on their previous planet (their old territories remain).
- Robot AI is intentionally simple (contests charged cells + random exploration).
- No account system: callsign tokens are local to a browser; clearing browser data loses access to
  that pilot (a new tag starts a new mission).

### Release artifact

- Source tag: `v3.0.0`
- GitHub: https://github.com/moldovancsaba/narimato
- Build: static `public/` + Node server (`npm start`); checksums and archives attached to the
  GitHub release.

---

## Earlier milestones (pre-release development)

- v1: infinite spherical grid, hierarchical labels, 4-way individual breaking, zoom/picking.
- v2: persistent multiplayer, robots, contest lock, identity per tag, procedural planet biomes,
  hidden geological resources, cooking/refit mission, responsive HUD, story intro.
- v3.0.0: NARIMATO launch — multi-planet progression, escape/interlude/meteor, abandon/new pilot,
  complete docs and release.
