# NARIMATO — GDS Integration (UI-01)

How NARIMATO consumes the Sovereign Squad General Design System (`@sovereignsquad/gds`, 6.9.0
line) without giving up the zero-dependency server, the Canvas renderer or `npm start`.

**Decision record:** [ADR-0002](adr/0002-gds-react-island-boundary.md) defines the DOM/canvas
boundary; [ADR-0007](adr/0007-gds-island-build-pipeline.md) records the concrete build pipeline
(dev-time Vite bundle, deterministic post-processing, committed assets, budgets).

**Delivery issue:** [UI-01](https://github.com/moldovancsaba/narimato/issues/7). Downstream:
[UI-02](https://github.com/moldovancsaba/narimato/issues/8),
[UI-03](https://github.com/moldovancsaba/narimato/issues/9),
[UI-04](https://github.com/moldovancsaba/narimato/issues/10),
[UI-05](https://github.com/moldovancsaba/narimato/issues/11),
[A11Y-01](https://github.com/moldovancsaba/narimato/issues/12).

## 1. What ships in UI-01

| Piece | Path | Served at runtime |
|---|---|---|
| Island sources (React + GDS) | `ui/src/` | no — dev-time only |
| Vite build config | `ui/vite.config.mjs` | no |
| Build script | `scripts/build-ui.mjs` | no |
| Committed island bundle | `public/ui/island.js` | yes, static |
| Committed island stylesheet (GDS CSS, compiled once) | `public/ui/island.css` | yes, static |
| Committed manifest | `public/ui/manifest.json` | yes, static |
| Flag resolution, frozen-API adapter, page boot | `public/js/gds-adapter.js` | yes, static |
| Page boot entry | `public/js/gds-boot.js` | yes, static |
| Migrated app surface (HUD, overlays, surface strip, cine chrome) | `ui/src/surfaces/AppSurface.jsx`, `HudSurface.jsx`, `OverlaySurface.jsx`, `SurfaceStrip.jsx`, `CineChrome.jsx` | yes, inside `island.js` |
| Proof mode | `?gds=proof` mounts the same app surface with `data-gds-proof-ready` | yes |
| Contract gate | `scripts/verify-gds-build.mjs` (`npm run verify:ui`) | no |
| Browser probe (dev-only) | `scripts/verify-gds-probe.mjs` | no |
| Shared pure helpers used by build, verify and tests | `scripts/lib/gds-assets.mjs` | no |

The game entry (`public/js/app.js`) is unchanged. UI-01 adds one stylesheet link, one mount host and
one boot script to `public/index.html`; nothing else in the page moves.

## 2. Boundary: Canvas vs DOM

| Layer | Owner | Rule |
|---|---|---|
| Planet, cells, ships, beams, particles, starfield | `public/js/renderer.js` (Canvas 2D/WebGL) | product rendering, **not** a DOM component surface; keep drawing |
| DOM chrome around the canvas | GDS island (UI-01 proves the path; UI-02…UI-05 migrate surfaces) | compose shipped GDS components only |
| Game orchestration, input, networking, report images | `public/js/app.js`, `result-card.js`, `audio.js`, `narrator.js` | unchanged by UI-01 |
| Legacy DOM for unmigrated surfaces | `public/js/ui.js` | stays until its surface migrates; the adapter delegates to it |

Canvas visuals that convey information still need an accessible DOM equivalent (live regions, text
panels); UI-01 does not change the canvas.

## 3. Build

```bash
npm ci                     # devDependencies only (Vite, React 19, GDS 6.9.0)
npm run build:ui           # ui/src -> public/ui/{island.js,island.css,manifest.json}
npm run verify:ui          # contract gate: hash, budgets, safety, mount contract
npm test                   # node:test suite (zero dependencies)
npm start                  # node server.js, no node_modules required
```

The build is **dev-time only**: `public/ui/*` is committed, and `node server.js` serves it with
`no-store` and the correct MIME type from the existing static handler. `npm start` keeps working on
a checkout with no `npm ci`.

Pipeline:

```text
ui/src/main.jsx
  → Vite (lib mode, ES2020, JSX automatic, NODE_ENV=production, no hashed filenames)
  → public/ui/island.js + island.css (unminified, deterministic)
  → esbuild minification of the final bundle
  → strip the remote Google Fonts @import from the GDS stylesheet
  → prune Mantine component CSS that the final bundle never references
  → CSS minification
  → version = sha256(sorted assets with the version sentinel)[0..15]
  → embed version in island.js, write manifest.json
```

Why the two post-processing passes:

- Vite's library-mode Rollup output is deterministic but leaves bytes that a second esbuild pass over
  the final bundle removes (about 11% of gzip size). The committed bundle is one file; there is no
  runtime module graph.
- `@sovereignsquad/gds-theme/styles.css` is the mandated single stylesheet and it imports the full
  Mantine component stylesheet. The island uses a handful of components, so the build drops CSS
  rules whose only component class tokens do not appear in the final JS bundle. Rules without
  component class tokens (tokens, resets, `:root`, island layout CSS) are always kept. This is a
  build optimisation over the same mandated stylesheet, not a fork of GDS.
- The Google Fonts `@import` inside the GDS stylesheet would be a third-party runtime request and a
  remote font. It is stripped; text renders in the system font stack. Self-hosted Inter is tracked
  with the theme work, not hidden in the island build.

### Manifest contract

`public/ui/manifest.json`:

```json
{
  "version": "15 hex chars from sha256(sorted assets)",
  "builtAt": "ISO timestamp of the HEAD commit at build time (SOURCE_DATE_EPOCH overrides)",
  "entries": { "js": "island.js", "css": "island.css" },
  "bytes": { "js": 0, "css": 0, "jsGzip": 0, "cssGzip": 0 }
}
```

`version` hashes the two asset contents. Because the version string is embedded in `island.js`, the
hash is computed over a build sentinel (`__GDS_ISLAND_VERSION__`) and the verifier normalises the
committed version back to that sentinel before recomputing; the contract is therefore not
self-referential. `builtAt` is metadata and is not part of the hash.

### Determinism

Two consecutive `npm run build:ui` runs over the same working tree are byte-identical (CI proves it
with `sha256sum`). Determinism holds for a fixed `HEAD`; `builtAt` intentionally changes when the
commit changes. CI compares the committed `island.js`/`island.css` byte-for-byte with a fresh build;
`manifest.json` is compared through `verify:ui` (version, bytes, budgets) because `builtAt` follows
the commit.

### Budgets

| Asset | Measured at delivery | Hard budget | Target |
|---|---|---|---|
| `island.js` gzip | 178.20 KiB | ≤ 180 KiB | ≤ 140 KiB |
| `island.css` gzip | 39.97 KiB | ≤ 40 KiB | — |

The JavaScript hard budget passes with 1.82 KiB headroom after UI-02…UI-05. The 140 KiB target is
**not met**: React 19 plus one `GdsProvider` is about 160 KiB gzip before any component, because the
provider pulls the Mantine theme runtime, notifications, modals and i18n. The four migrated surfaces
add the governed HUD, dialog, form, progress and toast compositions on top. Recorded as a known
limitation; it does not affect the hard budget or the page because the island is loaded after the game
is playable. The CSS hard budget passes with 0.03 KiB headroom — every new surface rule is token-only
and the unused-component pruning keeps the mandated stylesheet inside its budget.

## 4. Provider, root and portals

- Exactly one `GdsProvider` is rendered, in `ui/src/GdsRoot.jsx`.
- Exactly one React root is created, in `ui/src/main.jsx` (`createRoot(document.getElementById('gds-root'))`).
- `bootstrap(cfg)` is idempotent: a second call — two script tags, HMR re-evaluation, or the page
  retry after a failure — returns the existing promise, so `createRoot` never runs twice.
- `mount(surface, host)` renders a named surface. A host other than `#gds-root` is rendered through
  a React portal that stays inside the same provider context, so GDS overlays, focus traps and live
  regions keep the provider's theme, modals and notifications.
- `update(slice)` merges a slice and commits **once per animation frame**, so the legacy 10 Hz
  `updateHud` cadence cannot storm React.

Frozen island API (`public/ui/island.js`):

```js
export const version;
export async function bootstrap(cfg); // { theme, reducedMotion, host }
export function mount(surface, host);
export function update(slice);
export function status();
export function shutdown(); // tests only
```

`window.__NARIMATO_GDS__.status()` returns `{ version, booted, providerCount, rootCount, surface,
mounts, shutdowns, startedAt, error, theme, reducedMotion }`.

## 5. Flags and failure behaviour

Precedence (issue #7 §11):

1. `?gds=0` → legacy UI (island module is not imported).
2. `?gds=1` → GDS island (no surface mounted; the game page is untouched).
3. `?gds=proof` → GDS island plus the proof surface.
4. Otherwise `localStorage['narimato.gds'] === 'off'` → legacy UI.
5. Otherwise → GDS island.

| Failure | Behaviour |
|---|---|
| Island chunk 404 / import rejection | one retry after 1 s, then the legacy UI keeps running and a dismissible `GDS UNAVAILABLE // LEGACY UI` banner appears |
| `bootstrap()` throws | same banner path; the game is never blocked |
| Stale chunk vs manifest | one guarded reload via `sessionStorage['narimato.gds.reload']`, never a loop |
| `localStorage` throws (privacy mode) | wrapped; the GDS default wins |
| `manifest.json` fetch fails | non-fatal; boot continues |
| No `#gds-root` host | boot fails into the banner path; no blank screen |

Kill switches, in order of immediacy: `localStorage['narimato.gds'] = 'off'`, a `?gds=0` link, or
revert the commit that added the stylesheet link and mount host.

## 6. Proof mode (`?gds=proof`)

`?gds=proof` now mounts the migrated app surface with `data-gds-proof-ready` and the real HUD on top;
the former standalone proof component was retired once UI-02…UI-05 shipped the game surfaces. The
contract it proved is still covered by the unit suite (`test/gds-manifest.test.js`), the browser
probe and the migrated-surface axe journeys. The historical proof surface asserted:

- all five required states — loading (`StateBlock`), empty (`EmptyState` + action), error with recovery
  (`StateBlock` + `SemanticButton action="refresh"`), disabled with a visible reason (`SemanticButton`
  + `InlineAlert` + `StatusBadge`), success (`StatusBadge`, `GdsMeter`, `InlineAlert`);
- the shared `ConfirmDialog` for a destructive action, with Escape/cancel paths and focus restored to
  the invoking button;
- polite live-region announcements for state changes and dialog actions;
- provider/root/version/reduced-motion status badges;
- token-only layout: `GdsBox`, `GdsStack`, `GdsInline`, `SectionPanel`, `PageHeader`; no inline style
  objects, no raw hex, no custom control;
- while mounted, the rest of the page is made `inert`, so keyboard and screen-reader order stay
  inside the proof surface; GDS portal hosts are excluded.

## 7. Accessibility evidence

The executable, per-merge gate is A11Y-01: `npm run a11y:gate` audits the nine migrated surfaces in
Chromium and WebKit (axe, tab order, focus trap/restore, contrast, 200% zoom, reduced motion, GDS
ownership, 44 px targets) and writes `artifacts/a11y/report.json`. The UI-01 proof-surface evidence
below is historical; current operator policy, schema and suppression rules live in
[A11Y_CHECKLIST.md](../A11Y_CHECKLIST.md), with delivery artifacts in `media/a11y/`.

- axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa) on `?gds=proof` at 1440x900: **0 violations**, 0
  serious/critical.
- Keyboard journey in `scripts/verify-gds-probe.mjs`: Tab reaches the retry and abandon controls,
  Enter activates, the confirm dialog is modal, Escape closes it and focus returns to the invoker.
- Viewports 1440x900, 1024x768, 390x844 and 792x302: five states, no horizontal overflow, recovery
  action reachable, one provider/root, no console errors.
- 200% zoom: no horizontal overflow; actions remain reachable by scrolling.
- `prefers-reduced-motion: reduce` is detected and reported; the proof surface adds no animation, and
  the GDS stylesheet's reduced-motion rules apply.
- The existing `npm run audit:ui` nine-viewport gate stays clean with the GDS stylesheet loaded.
- Screenshots: `media/gds/proof-desktop.png`, `proof-tablet.png`, `proof-mobile.png`,
  `proof-short.png`.

Known flake in the pre-existing `npm run audit:a11y` script: its manual-mobile step can race the game
guide overlay on the legacy UI. It reproduces on `main` without this change and is out of UI-01
scope; the UI-01 axe evidence is the proof-surface run above.

## 8. Verification commands

```bash
npm test
npm run docs:check
npm run check:version
node scripts/test-count.mjs
npm run build:ui && npm run verify:ui
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/verify-gds-probe.mjs
npm install --no-save axe-core
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright AXE_PATH=./node_modules/axe-core/axe.min.js npm run a11y:gate
```

## 9. Rules for the migration issues (UI-02…UI-05)

- Import only from `@sovereignsquad/gds` (or its `/client` entry). Never import `@mantine/core`,
  `@tabler/*` or a second component library.
- Do not add a second `GdsProvider`, a second `createRoot`, or a second stylesheet link.
- Do not style with inline style objects, raw hex or magic spacing where a GDS token or prop exists.
- Add surfaces in `ui/src/surfaces/` and register them in `ui/src/GdsRoot.jsx`; mount them through
  `mount(surface, host)` from the adapter.
- Keep `app.js` as the orchestrator: the adapter maps frozen `UI` methods to island store slices.
- Re-run `npm run build:ui && npm run verify:ui` after every surface change; budgets are enforced in
  CI and the committed output must stay in sync with `ui/src`.


## 10. Migrated game surfaces (UI-02…UI-05, EVT-02)

### 10.1 HUD (UI-02)

| GDS composition | Required id / hook | Notes |
|---|---|---|
| `SectionPanel` + `StatusBadge` + `Progress` | `mission-panel`, `mission-list`, `data-mission="hud"` | refit objectives, cargo, captain's log, distress timer, `btn-escape` |
| `SectionPanel` + `GdsStack` rows | `players-panel`, `players-list`, `players-count` | deterministic score-desc/tag-asc order, 14-row cap, `+N MORE` |
| `SectionPanel` + ordered list | `arcade-panel` | all-time top ten |
| `GdsStack` + `StatusBadge` + `Progress` | `planet-badge`, `hud-score`, `hud-faces`, `hud-clicks`, `hud-breaks`, `hud-zoom`, `nav-chip` | static text values; only milestones announce politely |
| `SectionPanel` (inspector) + `Progress` | `hud-target`, `target-charge-bar` | `aria-label="Cell <label> charge"`; text `chargeText` keeps `pad2` |
| `GdsInline` dock + `Button` | `mobile-dock`, `btn-mission`, `btn-operators`, `btn-arcade`, `btn-report` | 44 px minimum targets |

`ui.updateHud` still receives the legacy state and writes the legacy nodes behind the kill switch. In
GDS mode `gds-boot.js` calls `ui.enableGds()`, which moves every required id to `data-legacy-id` and
mounts `AppSurface`; the island owns exactly one copy of each id. `ui.js` keeps publishing one
coalesced `{ ui }` slice per change; the adapter/store commits at most once per frame.

Charge progress: Mantine's `Progress` exposes the labelled `role="progressbar"` section with
`aria-valuemin/max/now`; `#target-charge-bar` is the queryable wrapper (`id`) and the visible
`0 / 8` text mirrors the same values.

### 10.2 Overlays (UI-03)

| Surface | GDS composition | Preserved contract |
|---|---|---|
| Landing / tag-in | `Modal` (full-screen) + `FormField` + `Button` + `StatusBadge` | `#join-overlay`, `#tag-input`, `#join-form`, `#btn-join`, `#join-error`, `#live-count`, `#btn-new-pilot`, landing mission/market/arcade hooks |
| Quick Guide | `Modal` + list + buttons | `#guide-overlay`, `#guide-how-copy`, `#btn-guide-start`, `#btn-guide-close` |
| Field Manual | `Modal` + list + voice buttons | `#manual-overlay`, `#manual-sections`, `#btn-manual-close` |
| Report / Share | `Modal` + `SectionPanel` + 1200×630 canvas + buttons | `#report-overlay`, `#report-card-preview`, `#report-share-url`, PNG and `buildShareText` unchanged |
| Confirm | `Modal` + `Button` pair (safe action first) | `#confirm-overlay`, `#confirm-message`, promise `ui.confirm` semantics |
| Toasts | `InlineAlert` + dismiss `Button` in `#toast-container` | 3200/3800/4200 ms by kind, max three, no focus steal |

Focus: each dialog is a Mantine-based GDS `Modal`, which traps Tab and restores the invoker. The
`public/js/shared/overlay-port.js` stack owns Escape ordering and is unit-tested; Escape resolves the
top dialog only. The landing is not dismissible by Escape or scrim (a pilot must join), while Guide,
Manual, Report and Confirm close on Escape/scrim/close control.

### 10.3 Surface strip (UI-04)

`SurfaceStrip.jsx` is additive inside `#hud`: `#surface-controls`, `#surface-target` (a labelled
status region with a text state), `#surface-lap` (progressbar), four `data-surface-hold` buttons
(Run forward / Turn left / Run backward / Turn right, ≥44 px) and `#btn-surface-exit`. No duplicate
mission/players/cargo panels and no `#surface-canvas`. Exit opens the GDS confirm dialog; cancel
keeps running, confirm returns to the orbital camera. The controller still owns pose, harvest, lap
and phase; the island only renders `ui.surface`.

### 10.4 Cine chrome (UI-05)

`CineChrome.jsx` is an additive layer over the existing cockpit FX canvases: `#intro-overlay` and
`#interlude-overlay` stay the legacy visual layers, while the island renders `#intro-bar`,
`#btn-skip-intro`, `#intro-steer`/`#steer-*`, `#btn-replay-intro`, `#interlude-bar`,
`#btn-interlude-continue` and the CC/VOX controls. `public/js/shared/cine-chrome.js` owns progress
clamping, reduced-motion scaling (0.35) and the reset-then-write caption contract. A focused chrome
control keeps its native keys; steering keys are captured only while the canvas owns the keyboard.
The captions region is one `role="region" aria-live="polite"` region (`#narrative-subtitles`).

### 10.5 Incident dialog (EVT-02)

`ui/src/surfaces/IncidentDialog.jsx` replaces the legacy incident overlay markup with a GDS
`Modal` inside the one provider. The incident title is the dialog's accessible name; focus enters the
heading; the GDS Modal close control and the GDS `DISMISS` button dispatch one `incident-dismiss`
intent; Escape, the button and the dwell timer restore focus to `#arena-canvas`. The full-screen
`#incident-fx-layer` (`#meteor-fx` canvas) remains `aria-hidden` product rendering behind the
dialog, sized to `cssSize × devicePixelRatio`. Under reduced motion the controller paints one static
poster frame, stops the loop, keeps the 1200 ms dwell and never applies `body.is-shaking`.

The controller publishes `{ incident }` through `ui.setIncident`, so the island owns presentation
while `interlude.js` keeps FX measurement (`window.__ICOSA__.incidentFxStats()`). Acceptance:
`scripts/acceptance-incident-a11y.mjs`, `acceptance-incident-visual.mjs`,
`acceptance-incident-cycle.mjs`; the A11Y-01 gate covers `incident` in both engines.

### 10.6 Rollback and flags

`?gds=0` or `localStorage['narimato.gds']='off'` keeps the legacy UI; nothing above is imported in
that mode. `?gds=1` forces the island. The old proof evidence is reproducible with
`?gds=proof&intro=0`. The deploy-free rollback is still the flag flip; no data or protocol change.

### 10.7 Verification

```bash
npm test
npm run docs:check
npm run check:version
node scripts/test-count.mjs
npm run build:ui && npm run verify:ui
PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright node scripts/verify-ui-migration.mjs
PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright AXE_PATH=/tmp/dsh-pw/node_modules/axe-core/axe.min.js npm run a11y:gate
```

Evidence: `media/gds/migration/` (landing, HUD, drawers, overlays, surface, cine at desktop/tablet/
mobile portrait+landscape, 200% zoom and reduced motion), `media/gds/migration/axe-report.json`.
