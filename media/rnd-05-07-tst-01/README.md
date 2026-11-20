# RND-05 / RND-06 / RND-07 / TST-01 — acceptance evidence

This directory is the committed evidence bundle for the M2/M3 surface delivery:
RND-05 (3D humanoid rig), RND-06 (single-scene acceptance), RND-07
(authoritative robot/resource visuals) and TST-01 (two-client surface
acceptance). Every artifact is produced by a real Chromium run through
`PLAYWRIGHT_MODULE`; each acceptance script starts its own server on an
ephemeral port with a throwaway `DATA_DIR`, so no live world is touched.

## How to reproduce

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-single-scene.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-single-scene.mjs --self-test
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/evidence-avatars.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-two-client-surface.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-surface-truth.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-supply-focus.mjs
```

## RND-05 — closed-triangle humanoid rig

`media/rnd-05-07-tst-01/report.json` (`avatar-evidence`) and the images:

- `avatar-front-normal.png`, `avatar-back-normal.png`, `avatar-side-normal.png` —
  the same rig viewed from the front, the back and the side at normal distance.
- `avatar-front-close.png`, `avatar-back-close.png`, `avatar-side-close.png` —
  the close-distance views.
- `avatar-front-detail.png`, `avatar-back-detail.png`, `avatar-side-detail.png` —
  300 px close-ups of the same views at the QA figure scale, for joint/gap
  inspection.
- `avatar-walk.png` — walk pose with alternating limbs.
- `avatar-mining-beam.png`, `avatar-mining-beam-detail.png`,
  `avatar-mining-beam-late.png` — mining tool-arm lift driven by an
  authoritative `surface_mine`-shaped beam, with the discovered-resource pin.

The report records the executed triangle budget `{l0:132, l1:72, l2:2}`,
the drawn triangle count, and the event sources
(`rig`, `self`, `peers: surface frames`, `mining: surface_mine frames`).

## RND-06 — single-scene acceptance

`media/single-scene/report.json` — one-renderer, no-surface-canvas,
camera-only, cell-parity (8 shared cells, max channel delta 0, exact material
strings), hud-identity (P = 1, 0 duplicates), frame-budget (600 frames,
p95 7.4 ms, dropped 0.043, measured as renderer work because the headless
display was vsync-throttled; `frameMode: "work"`, `rafP50Ms` recorded), axe
serious/critical 0 in both views and focus entry/restore.

- `media/single-scene/orbit.png`, `surface.png`, `surface-mobile.png`.

`--self-test` records the three mutation detections in `report.json`
(`selfTest.secondCanvasDetected`, `duplicateHudDetected`,
`cellColourDetected`), proving the suite fails when the single-scene invariant
is broken.

## RND-07 — authoritative robot/resource visuals

- `two-client-report.json` — `beam-authoritative` check: every observed
  `surface_mine` label is changed by a preceding `cell`/`break` frame; the beam
  comes from an online robot (never a human); `rendererDropped` counts beams
  dropped for missing leaves.
- `avatar-mining-beam*.png` — beam, impact ring and resource pin drawn inside the
  single renderer.
- The renderer API and interpolation rules are documented in `ARCHITECTURE.md`
  and `narimato-physics.md`; unit coverage is `test/renderer-surface.test.js`.

## TST-01 — two-client surface acceptance

- `two-client-report.json` (also `media/acceptance/<runId>/`) — peers see each
  other's tag and authoritative leaf; a robot is online and moving; a robot
  `surface_mine` names the cell a `cell`/`break` frame changed; a real supply
  drop relocates both humans into the supply cells and both mine on the first
  click; a break by A appears in B's leaves without a reload (page marker
  unchanged); join/surface controls are named and keyboard reachable; no page
  errors or unexpected HTTP.
- Screenshots: `media/acceptance/<runId>/client-a-surface.png`,
  `client-b-surface.png`, `beam-authoritative.png`, `live-mutation-peer.png`.
- `surface-truth-report.json` — HUD harvest verdict vs the API click and beam
  ordering; `supply-focus-report.json` — a real drop focuses the orbit camera and
  carries one placement per human.

## Known limitations (recorded, not hidden)

- **GDS HUD dependency.** The GDS island foundation (UI-01, PR #55) is on
  `main`; the game HUD migration (UI-02/UI-04) is still pending, so this
  delivery reuses the existing HUD and adds no DOM. The peer roster therefore
  has an accessible label but not yet `aria-live="polite"`; the acceptance
  report records `rosterLiveRegion: null` with the dependency. No non-GDS
  control was added.
- **Carrier framing is flag-only.** Production surface framing stays the shipped
  legacy third-person camera; `?surface-camera=carrier` remains opt-in and is
  not used by the acceptance runs (documented in `narimato-physics.md`).
- **L2 is a silhouette.** Beyond 0.80 rad a figure loses limb detail by design
  (2 triangles); hysteresis prevents flicker at the boundary.
- **Frame budget environment.** Headless Chromium on this machine paces rAF at
  ~10–15 Hz, so the suite measures the same 600 frames as renderer work time
  (recorded as `frameMode: "work"`); a normal display uses the rAF path.
