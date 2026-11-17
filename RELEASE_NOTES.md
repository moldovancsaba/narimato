# NARIMATO — Release Notes

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
