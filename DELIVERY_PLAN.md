# NARIMATO — STORY INTRO & RESPONSIVE DELIVERY PLAN

> **STATUS: DELIVERED.** Intro, escape mission, per-resource inventory and responsive layouts are
> implemented and verified; see README and the screenshots in `media/`.
> **Follow-up applied:** the intro now plays as the launch/loading cine on every page load (skip /
> replay / `?intro=0` available), not only on the first browser session.

## 1. Player-facing narrative

**Premise:** you are a pilot. A wormhole from an accident throws you to the far side of the
universe. The game begins as your ship is spat out of the wormhole: you are inside the cockpit,
planet ICOSA-9 far ahead. You can steer with **WASD / arrow keys** (touch steering on mobile), but
the ship is caught by the planet's gravity — the ship keeps being pulled in no matter what you do.
The camera closes in, the cockpit frame fades away, and the planet fills the screen. The game
becomes the current mining grid. The ship's systems report that **fuel and thrusters are empty**:
you cannot leave orbit, so you must mine the required resources on the planet to rebuild the drive.
The mission HUD shows the required ores and fills in as you mine them.

### Screen flow (state machine)
```
BOOT → WORMHOLE (2.0 s, cockpit frame, alarm, flash, planet far)
     → DRIFT (interactive, up to ~4 s; steering works but gravity dominates; "GRAVITY LOCK")
     → DESCENT (3.0 s; camera/dolly zoom, cockpit frame fades, planet grows to play scale)
     → BRIEFING (planet revealed; mission requirements + pilot callsign entry for new pilots)
     → PLAY (current game; mission objectives persist in HUD)
```
- Skippable at any point (`SKIP INTRO`), replayable from the HUD/landing (`REPLAY INTRO`).
- Returning token pilots can skip fast / go straight to BRIEFING; first-visit flag in localStorage.
- `prefers-reduced-motion`: shorter fades, no shake/flash, auto-drift still readable.
- No external images/audio assets: cockpit is CSS/SVG/Canvas, wormhole and star streaks are Canvas,
  audio is the existing synthesized WebAudio.

## 2. Escape objective

Shared mission config (`public/js/shared/mission.js`), requirements in credits/ore counts:

| Objective | Required |
|---|---|
| FUEL RODS | 3 × URANIUM |
| HULL PLATES | 5 × SILVER + 2 × GOLD |
| WARP CORE | 1 × PALLADIUM |

- Progress is based on the pilot's **persistent mining inventory by resource type** (all-time for
  that callsign), so it survives reloads and matches the story ("you mine until you can escape").
- HUD panel `ESCAPE // SYSTEMS` lists each requirement with icons/colours and counts; completed
  items glow and the header switches to `WARP CORE READY` with a one-time celebration.
- Server adds persistent per-player `oreCounts` (10 counters) and exposes it in state. Client derives
  mission progress; server can also mark `escapeReady` for future features. No gameplay is blocked
  by incomplete objectives — the player can keep playing the arcade.
- Existing players keep their `ores`/`oreValue`; `oreCounts` starts empty for already-past finds
  (future finds count), documented in the briefing.

## 3. Responsive design (the "almost cannot see" fix)

Current problem: desktop HUD panels cover most of a phone screen. Rework into three intentional
layouts driven by CSS breakpoints + small JS layout class:

### Desktop (>1024 px, height >720)
- Keep the full cockpit-of-information: left OPERATORS, top world/score, right ARCADE, bottom target
  inspector, mission card bottom-left. Cinematic intro uses a wide cockpit window.

### Tablet (641–1024 px, or desktop short-height)
- Top compact bar: score + world depth; mission card collapsible right; operators/arcade become
  slide-over drawers; target inspector bottom-center; planet takes ≥65% of viewport.
- Intro cockpit occupies full screen with 16:9 window and large touch/pointer steering pads.

### Mobile (≤640 px, portrait)
- **Planet first:** canvas remains full-screen; HUD becomes overlays at the edges, never a
  three-column panel wall.
- Top strip: score, world depth, connection; small mission progress chip.
- Bottom dock (safe-area aware): large primary actions `MINE/INFO` state, `MISSION`, `OPERATORS`,
  `ARCADE`, `REPORT`; drawers slide up over the planet and can be dismissed.
- Target inspector becomes a **tap-to-inspect bottom sheet** (not a permanent panel), with
  terrain/owner/charge/locked/submerged rows.
- Intro: portrait cockpit, touch drag + left/right thrust pads, skip always visible; text sizes
  ≥12 px, controls ≥44×44 px.
- Landscape phone: two-row compact bar, planet visible center, drawers from the right.
- Reduce particles/DPS on mobile; cap canvas DPR at 1.5; hide non-essential grid decoration.
- Test notches/safe-area insets.

## 4. Work breakdown & owners

| # | Deliverable | Files | Owner | Effort |
|---|---|---|---|---|
| 0 | Decisions locked (this plan), mission config, copy | `mission.js`, copy | Lead | 0.5 h |
| 1 | Intro controller + cockpit DOM/Canvas (wormhole, alarms, fade, skip/replay, input) | `public/js/intro.js`, `index.html`, CSS | ui-dev + Lead | 2.5 h |
| 2 | Intro camera/planet framing, star streaks, reduced-motion | `renderer.js`, `geometry.js` (temp zoom), `app.js` | renderer-dev + Lead | 2 h |
| 3 | Persistent ore inventory + mission state/wire + tests | `lib/world-core.js`, server/tests | server-dev | 2 h |
| 4 | Responsive HUD: mission card, mobile dock/drawers, tablet layout, inspector sheet | `index.html`, `cyberpunk.css`, `ui.js` | ui-dev | 2.5 h |
| 5 | Integration: intro→join→play flow, replay, objective updates, mission tied to resource events | `app.js`, `ui.js` | Lead | 2 h |
| 6 | QA: Playwright viewports, intro timing, no console errors, regression of mining/lock/robots/report | test scripts | Lead | 2 h |
| 7 | Deploy: restart server (inventory change), static reload, public URL verification, screenshots | — | Lead | 0.5 h |

Critical path: 1 → 5 → 6; 2/3/4 run in parallel once 0 is locked.
Estimated delivery: one working cycle (~6–8 agent-hours) after plan approval.

## 5. Acceptance criteria

**Intro**
- On first load, cockpit/wormhole scene with planet far; WASD/arrows and touch steering visibly
  respond but gravity message stays dominant; camera zooms into the planet; cockpit disappears;
  current game is revealed at normal scale.
- "FUEL EMPTY // GRAVITY CAPTURE // MINE TO ESCAPE" briefing appears; mission requirements visible.
- Skip works instantly; replay works; reduced-motion version works; no console errors.
- First visit ≤10 s, returning visit ≤4 s before play.

**Mission**
- Mining a resource updates the correct mission counter immediately (action response + SSE),
  survives reload/server restart, and shows completion state at 100%.
- Ocean/submerged cells contribute nothing (existing rule preserved).

**Responsive**
- Mobile 390×844: planet is visibly the main subject; no HUD panel covers >25% of the canvas
  permanently; all actions reachable in ≤2 taps; intro playable and skippable.
- Tablet 834×1112: planet ≥65% viewport; drawers work.
- Desktop 1440×900: current info density preserved; no regression.
- Landscape phone 844×390: no clipped/overlapping controls; planet visible.
- All breakpoints: no horizontal scroll, tap targets ≥44 px, text readable.

**Regression**
- Identity-per-tag, own-cell lock no `+2` spam, robots, mining/terrain, report/share, persistence,
  multiplayer E2E all still pass. 54/54 backend tests plus new intro/mission tests.

## 6. QA plan

- Playwright matrix: 390×844, 844×390, 834×1112, 1024×768, 1440×900.
- Screenshot review: intro wormhole, drift, descent, briefing, play, mission, mobile drawers.
- Automated: intro state transitions (`window.__ICOSA__.introState`), skip, replay, mission counters
  after mining, reload persistence, no console errors, no element overlap at breakpoints.
- Performance: desktop 60 fps; mobile ≥30 fps with mobile particle/DPR profile.
- Server: oreCounts persistence/migration tests; existing world migration keeps players/leaves.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Intro frustrates returning players | Skip button, one-time flag, auto-short for token holders, replay option |
| Mobile performance hit from cockpit FX | Canvas-light cockpit (CSS frame + few particles), reduced-motion mode, DPR cap |
| More HUD elements worsen mobile clutter | Drawers + bottom sheet, permanent planet-safe zones, element budget per breakpoint |
| Mission too grindy | Requirements configurable; currently common ores (U/S/G/Pd) reachable early |
| Camera conflicts between intro and gameplay | Dedicated intro camera/dolly state, hard reset to gameplay camera after descent |
| Server restart drops players | Existing persistent reconnect/token flow, world migration safe |

## 8. Decisions (recommended defaults — confirm or change)

1. **Login timing:** intro plays first; at BRIEFING the pilot enters/keeps a callsign and jacks in
   (returning token pilots get a one-click resume). This preserves the "you wake up in the cockpit"
   framing.
2. **Escape objectives:** FUEL 3×URANIUM · HULL 5×SILVER+2×GOLD · WARP CORE 1×PALLADIUM, counted
   all-time per callsign. No forced game end when complete; celebrate + keep playing.
3. **Mining counts only future finds** for existing pilots (oreCounts starts at 0) to avoid instant
   completion from historical ores; could instead seed from historical stats if preferred.
4. **Replay intro** available from landing/HUD; first load per browser session.

## 9. Definition of done

- Intro/cockpit/wormhole sequence implemented, integrated with join and the existing game.
- Escape mission HUD + persistent per-resource inventory working.
- Mobile/tablet/desktop layouts deliberately different and verified by screenshots.
- All tests green; production server restarted; public tunnel serves the new build; player world and
  identities preserved; README + screenshots updated.
