# GDS adoption — NARIMATO

Status: Complete (Mantine + GDS v2.2.0)  
SSOT: `/Users/Shared/Projects/GENERAL_DESIGN_SYSTEM` (v2.2.0)

> `/Users/Shared/Projects/GENERAL_DESIGN_SYSTEM` is the single source of truth for design, UI, and UX. This file describes only Narimato implementation adapters, migration state, and exceptions.

## Local adapter paths

| Concern | Path |
|---------|------|
| Root provider | `components/NarimatoProviders.js` |
| Theme (extends `@gds/theme`) | `lib/ui/narimatoTheme.js` |
| App shell | `components/NarimatoShell.js` |
| Play game surfaces | `components/play/*` |
| Play layout tokens (Mantine CSS vars only) | `styles/playGame.module.css` |

## Packages

- `@gds/theme`, `@gds/core` — vendored under `packages/` (built from GENERAL_DESIGN_SYSTEM; see `packages/README.md`)
- `@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@mantine/modals`

## Migration state

| Phase | Status |
|-------|--------|
| 0 Freeze legacy CSS for new UI | Done |
| 1 Root platform (Mantine + GDS theme) | Done |
| 2 Core pages (home, orgs, cards, rankings, results) | Done |
| 3 Play surfaces | Done |
| 4 Admin | Done |
| 5 Delete `public/styles/*.css` | Done |

## Exceptions

None. UI uses Mantine 7 + `@gds/theme` / `@gds/core` only. Play layout tokens live in `styles/playGame.module.css` (Mantine CSS variables).

## Validation

```bash
npm run build
npm run dev
node scripts/e2e-v1-play.js
```
