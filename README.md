# NARIMATO

![CI](https://github.com/moldovancsaba/narimato/actions/workflows/ci.yml/badge.svg)

> **YEAR 2189. A wormhole throws your damaged ship to the far side of the universe.**
> You wake inside the cockpit above **MAGRATHEA**, gravity-locked with empty tanks.
> Mine the crust, rebuild the drive, escape — and find the way home. Every escape throws you
> through a new story onto a new, deeper planet with its own multiplayer battlefield.

**NARIMATO** is a persistent multiplayer browser game on a spherical icosahedron. No installs,
no accounts, no build step and no third-party runtime assets: join with a callsign and start mining.

![Cockpit wormhole intro](media/intro.jpg)

## Play

```bash
npm start          # Node >= 20, zero dependencies
```

Open **http://localhost:4173** (LAN URL is printed on boot).

**Live:** https://treasurer-record-flooring-mounting.trycloudflare.com

### Controls

| Input | Action |
|---|---|
| **WASD / arrow keys / touch pads** | steer the cockpit during the wormhole intro |
| **Click / tap** a triangle | claim, steal or reinforce it and charge it |
| **Drag** | rotate the planet |
| **Wheel / pinch** | zoom from space to street level |
| **Double-click** | focus/drill into a cell |
| **L** | toggle all face ids (debug) |
| **REPORT** | session summary, downloadable PNG + share link |
| **ABANDON** | confirm and return to the main/tag screen |
| **NEW PILOT** (main screen) | clear this browser's saved pilot and start a new mission |
| **ESCAPE // BURN FOR ORBIT** | leave the planet once the refit is complete |

## The loop

1. **Launch cine** — every page load starts in the cockpit: wormhole exit, gravity lock,
   steerable descent, planet reveal. Skippable and replayable; it also acts as the loading screen.
2. **Tag in** — pick a callsign on the main screen. Each callsign is its own persistent identity
   with its own colour, score and planet progress.
3. **Mine** — charge triangles; a triangle individually breaks into four smaller spherical
   children at **4 clicks on the first planet** (8 on later planets). Hidden ore veins are mined on
   the first successful click and marked forever.
4. **Rebuild the drive** — the escape mission asks for specific ores; the HUD tracks every find.
5. **Escape** — when the refit is complete, burn for orbit. A random deep-space event (storm,
   pirates, wormhole tremor…) damages the ship and forces a landing on the **next planet**.
6. **Repeat forever** — planet 1 has **2 levels = 20 + 80 triangles**, planet 2 has **3 levels =
   20 + 80 + 320**, and so on up to the level cap. The first planet is a short tutorial with
   guaranteed refit ore; later planets are larger. Each planet is its own multiplayer scene with
   its own players, robots, leaderboard and grid.

Each planet has finite hidden deposits. When the planet is fully mined out, a **meteor impact**
resets its crust and releases new resources. The game never ends.

## Documentation

- [Gameplay guide](GAMEPLAY.md) — story, mission, planets, controls, tips.
- [Architecture](ARCHITECTURE.md) — stack, modules, protocols, data model, algorithms.
- [Release notes](RELEASE_NOTES.md) — what shipped in this release and migration notes.
- [Planet generation research](PLANET_RESEARCH.md) — low-data procedural surface sources/algorithm.
- [Algorithm notes](ALGORITHM.md) — spherical geometry, labels, picking, zoom math.
- [Protocol/feature specs](SPEC_INFINITE.md) · [resources](SPEC_RESOURCES.md) ·
  [planet surface](SPEC_PLANET.md) · [planet progression](SPEC_PLANETS.md).

## Features at a glance

- **Persistent spherical world** — adaptive four-way geodesic subdivision, stable hierarchical
  labels (`11.4`, `9.2.1.1`), individual per-cell breaking, infinite zoom.
- **Authoritative multiplayer** — Node server, SSE rooms per planet, robots on every planet,
  per-cell contest locks, atomic persistence, graceful restart recovery.
- **Detailed procedural geography** — a high-detail seeded terrain layer (continents, oceans,
  coasts, mountains, polar ice) renders behind the gameplay cells, so you see the planet surface
  through the grid. One 32-bit seed, no textures/heightmaps; resources follow the same geology.
- **10 minerals** — silver → neutronium, hidden deposits, underwater deposits inaccessible.
- **Escape progression** — per-planet levels and scaled refit missions, a centered
  **TRY TO FLY AWAY** call-to-action when the drive is ready, random interplanetary story
  cinematics, screen shake/damage, separate multiplayer scene for every planet.
- **Planetary incidents with consequences** — every catastrophe explains what happened and why new
  resources are now available; the Captain’s Log keeps the story after the overlay disappears.
- **Planetary incidents** — exhausted planets now end with one of four random catastrophes:
  **Meteor Impact**, **Nuclear War**, **Solar Flare** or **Alien Invasion**, each with its own
  full-screen effect, narration and reseeded crust, then fresh resources.
- **Responsive command deck** — deliberately different desktop, tablet, mobile portrait and
  landscape phone layouts; mobile is planet-first with drawers/dock/target sheet.
- **Inertial camera** — drag-spin the planet and release: it coasts longer with an ease-out curve
  and slowly comes to rest; wheel/pinch zoom eases into its target instead of snapping.
- **Narration & subtitles** — slow, deliberate prerecorded voice-over delivered **one sentence at
  a time**, with a short pause between lines, for the story, tips, Field Manual and every
  interplanetary story. **VOICE** and **CC** toggle independently and remember your choice;
  subtitles work even when autoplay blocks the first audio line.
- **Three narrator voices** — open-source **GEORGE** (Kokoro-82M, default), British **DANIEL** or US
  **SAMANTHA**, selectable in the Field Manual. See [VOICE.md](VOICE.md) for the voice pipeline and
  open-source TTS options (Kokoro, Piper).
- **Narration load management** — first sentences are idle-prefetched with limited concurrency,
  the next sentence is warmed while the current one plays, and voice assets are versioned and
  cached immutably, so sentence transitions do not stall on the network.
- **Field Manual** — an in-game guide to the story, mining, contest lock, planets, navigation and
  controls, with a PLAY button on each section.
- **Contextual tips** — one-time narrated hints for first mining, red locked cells, ore discovery,
  escape readiness, new planets and meteor resets.
- **Navigation target** — a gold **NAV** beacon and chip point to the best nearby geological cell
  to mine; tap the chip to fly the camera there or ↻ to cycle targets.
- **Red locked cells** — a cell you just mined turns red until another operator contests it; then
  it clears and you can mine again.
- **Observable by default** — `GET /api/metrics` exposes privacy-safe HTTP/SSE/planet/event-loop
  metrics, and a tiny client beacon reports Web Vitals/audio-start timing. No tokens or tags.
- **Separate mouse and cursor navigation** — mouse drag rotates the planet freely; arrow keys travel
  around it in an upright, naturally eased orbit. Shift speeds up travel, `I` reverses mouse drag.
  Audio resumes after tab interruptions and transient play failures rather than going silent.
- **Limitless trackball rotation** — a quaternion camera replaces the clamped yaw/pitch orbit, so the
  view can roll past both poles and keep going in every direction.
- **Level zoom ladder** — wheel/pinch steps through cell-depth zoom rungs (D0, D1, D2…) with a fast
  cubic-bezier settle. Clicking/fracturing a cell automatically moves the camera to that action level.
- **Quick Guide** — a first-run, shareable one-screen card explains what to mine, how to
  mine, where to dig and how to leave; press **GUIDE** or open `?guide=1`.
- **Gentle early rare budgets** — early planets demand one rare unit, then ramp up with depth.
- **Captain's Log & humanised ship UI** — the panel tells the pilot a short story, names what is
  still missing in plain language, and shows a relief-ship countdown instead of a bare systems list.
- **Emergency supply drop** — if you make no refit progress for two minutes, a relief ship crashes
  onto the planet and scatters the missing ore across nearby triangles; those deposits are mineable
  on the first successful click. Every human on the planet gets the marked cells and the camera
  turns toward the impact, so the salvage race starts together. The beacon repeats every two-minute
  stuck window until the parts are found.
- **Rare refit parts** — every planet now requires at least one rare material (iridium, voidglass,
  myrthil, aetherium, adamantium or neutronium), marked **RARE** in the refit list.
- **Planet major colours** — eight palette identities tint the surface, atmosphere, HUD identity and
  landing briefing, so neighbouring worlds feel like different places.
- **CDN-ready assets** — narration URLs can move to an edge cache with `ASSET_BASE_URL`; audio is
  versioned and immutable.
- **Accessibility + resilience gates** — Chromium/WebKit UI audits, axe-core WCAG checks, 44 px
  touch targets, and a chaos restart test for live SSE/state survival.
- **Mobile-first controls** — labelled 44 px media controls, a visible "tap for voice" hint, and a
  two-column short-landscape landing screen that keeps JACK IN on-screen.
- **Procedural refit missions** — every planet generates its own requirements from its seed. Planet 1
  starts minimal (3 units); each deeper planet grows the refit by 0–3 units and mixes in different
  materials, so no two planets ask for the same cargo.
- **Full cargo inventory** — the HUD shows every collected material, including surplus beyond the
  current refit needs. Everything travels with you to the next planet.
- **Random destinations** — an escape sends you to one of the next **five** planets chosen at random,
  never backwards, each with its own mission and scene.
- **A galaxy of borrowed worlds** — planet names are drawn from a curated cultural catalog
  (*Hitchhiker's Guide*, Star Wars, Marvel, DC, Dune, Doctor Who, Star Trek, Alien, Avatar,
  Foundation, Transformers, classic myth and more) with the source shown in the landing briefing
  and planet tooltip.
- **Random discovery clicks** — each hidden deposit is found on a random successful click (first,
  middle or the break/last click), not always on the very first click.
- **First-planet briefing** — the centered "collect to leave" list now appears on the very first
  planet too, not only after interplanetary landings.
- **Dynamic staffing** — every active planet keeps **3 players online**: 1 human + 2 robots,
  2 humans + 1 robot, or 3+ humans and no robots; replacements spawn immediately.
- **Landing briefing** — touching down on a new planet opens a centered card listing exactly which
  ores are needed to leave, with collected/required counts.
- **Reports & sharing** — 1200×630 session card, shareable URL, all stats persisted.
- **Zero runtime dependencies**, all UI/audio/visuals generated in code.

## Screenshots

| | |
|---|---|
| ![Landing mission briefing](media/landing.jpg) | ![Desktop HUD with escape mission](media/mission.jpg) |
| ![Mobile planet-first HUD](media/mobile.jpg) | ![Mobile mission drawer](media/mobile-mission.jpg) |
| ![Interplanetary story interlude](media/interlude.jpg) | ![Escape-ready refit](media/escape-ready.jpg) |
| ![Narration subtitles in the cockpit intro](media/narration.jpg) | ![NARIMATO Field Manual](media/manual.jpg) |
| ![Nuclear war incident](media/incident-nuclear.jpg) | ![Alien invasion incident](media/incident-alien.jpg) |
| ![Procedural refit and full cargo](media/cargo.jpg) | ![Navigation waypoint on the planet](media/navigation.jpg) |
| ![Captain’s Log and planet colour identity](media/captains-log.jpg) | ![Emergency supply crash](media/supply-drop.jpg) |
| ![Detailed procedural planet geography behind the grid](media/geography.jpg) | ![Navigation waypoint on the planet](media/navigation.jpg) | ![Red locked cell after mining](media/red-locked.jpg) |
| ![Centered TRY TO FLY AWAY escape CTA](media/escape-cta.jpg) | ![New-planet landing briefing](media/landing-brief.jpg) |
| ![Escape CTA on mobile](media/escape-cta-mobile.jpg) | ![Landing briefing on mobile](media/landing-brief-mobile.jpg) |

## Development

```
npm test                 # 66 tests, node:test, no dependencies
npm start                # serve on PORT (default 4173), DATA_DIR (default ./data)
npm run dev              # alias
```

Environment: `PORT`, `HOST`, `DATA_DIR`, `BREAK_CLICKS`, `MAX_DEPTH`, `BOTS`, `DEPOSIT_CHANCE`,
and the bot timing variables. See [ARCHITECTURE.md](ARCHITECTURE.md#configuration).

### Repository layout

```
server.js                 HTTP/SSE server + static files
lib/world-core.js         authoritative planet world, players, mining, persistence
lib/planet-manager.js     multi-planet rooms, routing, escape, meteor, stories
public/index.html         shell + intro/interlude/HUD markup
public/js/app.js          client integration + game loop
public/js/renderer.js     Canvas 2D spherical renderer
public/js/world.js        client adaptive tree
public/js/ui.js           responsive DOM UI controller
public/js/intro.js        cockpit launch cinematic
public/js/interlude.js    interplanetary transit + meteor cinematic
public/js/result-card.js  session report + share card
public/js/shared/         geometry, planets, resources, mission rules
test/                     node:test suites
media/                    screenshots used by docs
```

## Status

Version **3.19.0** · MIT-licensed community project by the NARIMATO crew. The live world is persistent;
server restarts preserve every loaded planet and the token→planet registry.
