# NARIMATO — Agent Instructions

Before changing renderer, camera, controls or geometry, read
[docs/GUARDRAILS.md](docs/GUARDRAILS.md). Working behaviour is protected: never replace the
mouse/cursor/planet interaction, never add a second scene/renderer/mesh, and never derive extra
geometry or render-only triangles. Continue from the last confirmed-working state.

This repository uses a GitHub Project + issue SSOT. Read these before changing code:

1. [docs/SSOT.md](docs/SSOT.md) — two-source model and non-negotiable rules.
2. [docs/PROJECT_BOARD.md](docs/PROJECT_BOARD.md) — board fields, statuses, readiness, views.
3. [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md) — the only definition of done.
4. [docs/ISSUE_INTAKE.md](docs/ISSUE_INTAKE.md) — how to write/update an issue.
5. [docs/ISSUE_MAP.md](docs/ISSUE_MAP.md) — doc-to-issue mapping and issue index.

## Working rules

- **Issue first.** Every implementation change belongs to an open issue on
  [board 80](https://github.com/users/moldovancsaba/projects/80). If none exists, create one using
  the engineering issue template (GDS #81 format) before writing code.
- **Dependency order.** Work only on an issue whose native blockers are closed and whose board
  `Readiness` is `Ready`. Move it to `In Progress (NOW)` and write the concrete `Next Action`.
- **One issue, one outcome.** Do not bundle unrelated work; do not silently widen scope.
- **UI/UX/frontend uses only the Sovereign Squad General Design System.**
  Install/import `@sovereignsquad/gds`, load `@sovereignsquad/gds-theme/styles.css` once, mount one
  `GdsProvider`, and compose shipped components with tokens/props. Do not import `@mantine/core`
  directly, add a second component library, or hand-roll controls. Accessibility is mandatory:
  keyboard, screen reader, visible focus, AA contrast, semantic HTML, reduced motion, 200% zoom.
- **Canvas/WebGL is product rendering, not a DOM UI exception.** The planet/cells/ships are drawn
  by the renderer; every DOM surface around them is GDS. Visuals that convey information need an
  accessible DOM equivalent.
- **Server authority is absolute.** Never fabricate resources, scores, ownership, locks or cells on
  the client. Hidden deposits never leave the server.
- **Evidence.** Before closing: tests, screenshots/artifacts, metrics, docs paths, rollback note,
  and the `Delivered`/`Release Evidence`/`Documentation`/`Next Action` fields.
- **Docs vs board.** Do not add status checklists or "delivered/pending" tables to repository docs;
  the board owns status. Docs own durable knowledge and link issues.

## Commands

```bash
npm start                # run the authoritative server on :4173
npm test                 # node --test test/*.test.js
npm run docs:check       # markdown links + issue-map/version checks
npm run audit:ui         # Playwright viewport audit (requires PLAYWRIGHT_MODULE)
npm run audit:a11y       # axe accessibility audit (requires PLAYWRIGHT_MODULE + AXE_PATH)
npm run load:test        # load/soak harness
npm run chaos:test       # restart/reconnect chaos test
npm run check:slo        # SLO verdict from /api/metrics (0 healthy, 1 breach, 2 contract, 3 unreachable)
npm run check:scale      # sharding decision record vs observability/slo.json and the measured capture
npm run recovery:test    # backup -> verify -> restore drill on throwaway data
npm run backup:data      # checksummed DATA_DIR archive + manifest (see docs/RECOVERY.md)
npm run device:gate -- --plan --commit=$(git rev-parse HEAD)  # A11Y-02 20-row plan
npm run cdn:preflight    # OPS-04 fail-closed gate; exit 3 until a real CDN host exists
```

## Pull requests

- Reference the issue (`Closes #N` or `Relates to #N` only when not Done).
- Keep the PR to one issue's scope; include test commands/results and screenshots for UI.
- State rollback. Never merge with red CI or missing accessibility/GDS evidence for UI work.

## Do not

- Do not create a second renderer, planet, HUD, or visual system.
- Do not commit secrets, generated credentials or environment-specific values.
- Do not claim a planned capability is live.
- Do not close an issue without [Definition of Done](docs/DEFINITION_OF_DONE.md).
