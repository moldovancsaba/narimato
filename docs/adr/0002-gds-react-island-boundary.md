# ADR-0002: GDS-only DOM UI through a dev-time React island boundary

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: UI-01, UI-02, UI-03, UI-04, UI-05, A11Y-01

## Context

All UI/UX/frontend work must use exclusively the Sovereign Squad General Design System
(`@sovereignsquad/gds`, current 6.9.0 line). GDS is a governed React design system built on
Mantine: one `GdsProvider`, one stylesheet, shipped components and tokens, accessibility rules
enforced by its release gates.

The game client is currently React-free: vanilla ES modules, Canvas 2D rendering, a large DOM UI
in `public/js/ui.js`, and no bundler (ADR-0001). GDS cannot be consumed as plain ES modules.

The canvas/WebGL rendering (planet, cells, ships, beams, particles) is **product rendering**, not
a DOM component surface. It cannot be rebuilt with GDS components; it must expose accessible DOM
equivalents and its surrounding chrome must be GDS.

## Decision

- Adopt a **dev-time React island pipeline** (Vite, pinned devDependency) that builds DOM UI
  islands into committed static assets under `public/ui/` (hashed bundle + manifest), served by
  the existing static server.
- Mount exactly one React root that wraps one `GdsProvider`; import
  `@sovereignsquad/gds-theme/styles.css` once at that entry, before app styles.
- Migrate DOM surfaces to GDS in this order: HUD panels → overlays (landing, Field Manual, Guide,
  Report, confirm) → surface HUD → intro/interlude chrome. No new custom component library, no
  second visual system, no direct `@mantine/core` imports outside GDS re-exports.
- Canvas/WebGL remains the renderer; DOM equivalents, live regions and keyboard paths are
  required for anything the canvas communicates.
- Accessibility is a release gate: axe serious/critical = 0, keyboard-only journeys, visible
  focus, 200% zoom, reduced motion, 44 px targets, screen-reader reading order.
- If GDS cannot express a required game pattern, the gap is raised upstream
  (`sovereignsquad/general-design-system`) rather than patched with parallel components.

## Consequences

- The UI gains the portfolio design language, governed accessibility and shared maintenance.
- The repository gains a build step, devDependencies, a committed bundle and a bundle-size
  budget; a broken build blocks release.
- `public/js/ui.js` shrinks to a bridge (state in, GDS island out) while `app.js` keeps ownership
  of game state and input.
- Styling moves from `cyberpunk.css` free-form CSS to GDS tokens/props; existing visual identity
  must be expressed through a governed theme, not ad-hoc overrides.

## Alternatives considered

- **Keep vanilla UI and mirror GDS visuals**: rejected; it is a parallel visual system and cannot
  claim GDS compliance or its accessibility gates.
- **Server-side rendered React**: rejected; the server is a zero-dependency Node process and the
  UI is a long-lived single page.
- **Web Components wrapper around GDS**: rejected; it would fork GDS behaviour and recreate its
  accessibility wiring.
- **GDS after gameplay delivery**: rejected; UI migration after feature delivery would add a
  second rewrite and break the "one HUD, one scene" rule (ADR-0003).

## Links

- [General Design System](https://github.com/sovereignsquad/general-design-system) — components,
  tokens, accessibility floor and adoption rules.
- [ADR-0001](0001-zero-npm-runtime-dependencies.md) — runtime dependency boundary.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — client module ownership.
- Issues: [UI-01](../ISSUE_MAP.md), [UI-02](../ISSUE_MAP.md), [UI-03](../ISSUE_MAP.md),
  [UI-04](../ISSUE_MAP.md), [UI-05](../ISSUE_MAP.md), [A11Y-01](../ISSUE_MAP.md).
