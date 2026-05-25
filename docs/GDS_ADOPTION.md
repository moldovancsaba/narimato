# GDS adoption — Narimato

Narimato is a **standalone product repository**. The [General Design System (GDS)](https://github.com/sovereignsquad/general-design-system) is a **separate repository**. Narimato **uses** GDS as a dependency; the two projects are not merged and do not share a codebase.

| | Narimato | GDS |
|---|----------|-----|
| **Repository** | This repo (`narimato`) | [general-design-system](https://github.com/sovereignsquad/general-design-system) |
| **Role** | Product app (survey / play / operator) | Design rules + shared UI packages |
| **What we ship** | App code + **vendored** `packages/gds-*` | Source docs + `@gds/core` / `@gds/theme` builds |
| **Where rules live** | `docs/GDS_ADOPTION.md` (this file) only | GDS repo (`FOUNDATION.md`, governance, etc.) |

**Pinned GDS version:** 2.4.3 (2026-05-25) — [sovereignsquad/general-design-system](https://github.com/sovereignsquad/general-design-system)

### Last audit (2026-05-24)

| Check | Result |
|-------|--------|
| GDS policy release | **2.4.3** (`AccentPanel`, `resolveAccentPanelStyles`, public/editorial primitives) |
| GDS package builds vs Narimato | **Synced** (`@gds/core` / `@gds/theme` 2.4.3) |
| Narimato CI guard | **Passing** — no raw Mantine shell semantics |
| Adapters | `NarimatoPageHeader`, `NarimatoFormField`, `NarimatoMetricCard`, `NarimatoSemanticButton`, `NarimatoGdsAlert`, `NarimatoAccentPanel`, `NarimatoChoiceChip` |
| Accent surfaces | `lib/ui/gdsSurfaces.js` → GDS `resolveAccentPanelStyles`; prefer `NarimatoAccentPanel` on shells |

When GDS changes again: build in the **GDS repo**, then in Narimato run `npm run gds:sync` and commit updated `packages/gds-*/dist`.

> When UI behavior or tokens conflict, follow **GDS** (upstream). This file records **how Narimato implements** that dependency—local adapters, exceptions, and validation—not GDS policy itself.

## Required statement (Narimato adapter)

> Narimato follows the [General Design System](https://github.com/sovereignsquad/general-design-system) via vendored `@gds/core` and `@gds/theme`. Shell surfaces use GDS primitives and Narimato adapters only—never raw Mantine `Alert`, `Button`, `ThemeIcon color=`, or palette `bg="violet.0"` on product UI.

## How Narimato depends on GDS

1. **Vendored packages** — `packages/gds-core` and `packages/gds-theme` contain **built** artifacts copied from a GDS release (not a git submodule of the whole GDS repo).
2. **npm** — `package.json` references them as `file:./packages/gds-*`.
3. **Local adapters** — Shells, headers, and theme extensions live under `components/` and `lib/ui/` in **this** repo only.
4. **Sync** — When GDS releases new package builds, refresh vendored `dist/` with `npm run gds:sync` (see below). No need to change Narimato app structure unless GDS introduces breaking API changes.

## Updating vendored GDS packages

```bash
# In the GDS repo (separate checkout):
git clone https://github.com/sovereignsquad/general-design-system.git
cd general-design-system && npm run build

# In Narimato (this repo):
export GDS_ROOT=/path/to/general-design-system   # optional; see gds-sync default
npm run gds:sync
npm run build && npm run gds:ci-guard
```

Default sync path is `GDS_SSOT_ROOT` or `/Users/Shared/Projects/GENERAL_DESIGN_SYSTEM` for local convenience only—CI and production use the **committed** copies under `packages/`.

## Pattern contract inventory (Narimato)

| Pattern family | Narimato implementation | Status |
|----------------|----------------------|--------|
| Root provider | `components/NarimatoProviders.js` | Done |
| Theme | `lib/ui/narimatoTheme.js` | Done |
| Public shell | `components/public/PublicShell.js` | Done |
| Operator shell | `components/operator/NarimatoOperatorShell.js` | Done |
| Admin shell | `components/admin/AdminShell.js` | Done |
| Auth shell | `components/NarimatoAuthShell.js` | Done |
| Page header | `components/NarimatoPageHeader.js` → GDS `PageHeader` | Done |
| Form field | `components/NarimatoFormField.js` → GDS `FormField` | Done |
| State block | `components/NarimatoGdsAlert.js` → GDS `StateBlock` | Done |
| Accent panel | `components/NarimatoAccentPanel.js` → GDS `AccentPanel` | Done |
| Semantic CTA | `components/NarimatoSemanticButton.js` → GDS `SemanticButton` | Done |
| Filter / mode chip | `components/NarimatoChoiceChip.js` (neutral `Badge`, no `color=`) | Done |
| Metric card | `components/NarimatoMetricCard.js` → GDS `MetricCard` | Done |
| Empty / status | `EmptyState`, `StatusBadge`, `ConfirmDialog` from `@gds/core` | Done |
| Shell theme toggle | `components/NarimatoThemeToggle.js` | Done |

## Product surfaces

| Surface | URL | Shell |
|---------|-----|-------|
| Public site | narimato.com | `PublicShell` |
| Local setup | `127.0.0.1:10006` | `NarimatoOperatorShell` |
| Admin | `/admin/*` | `AdminShell` / `NarimatoAuthShell` |
| Immersive play | `/play` (in-game), `PlaySwipeSurface`, `PlayVoteSurface` | Documented exception |

## Local adapter paths

| Concern | Path |
|---------|------|
| Root provider | `components/NarimatoProviders.js` |
| Theme | `lib/ui/narimatoTheme.js` (`extendGdsTheme`) |
| Accent tokens | `lib/ui/gdsSurfaces.js` → `resolveAccentPanelStyles` |
| GDS guard | `scripts/ci-gds-guard.js` |
| Public UI | `components/public/*` |
| Operator UI | `components/operator/*` |
| Play pickers | `components/play/PlayPicker.js` (GDS shell; immersive surfaces exempt) |

## Enforcement in this repo

`npm run gds:ci-guard` scans `components/`, `pages/`, and `lib/ui/`:

- `GdsIcons` from `@gds/core`, not `@tabler/icons-react`
- `ConfirmDialog` with `confirmAction` / `cancelAction`
- `StatusBadge` for semantic colors, not `<Badge color=…>`
- `NarimatoGdsAlert` instead of Mantine `<Alert>`
- `NarimatoSemanticButton` or `NarimatoChoiceChip` instead of Mantine `<Button>`
- No `<Button color=…>` or `<ThemeIcon color=…>`
- No raw Mantine palette `bg="violet.0"` on shells — use `NarimatoAccentPanel` or `gdsAccentPanelStyle`
- No deprecated `NarimatoShell` imports

## Approved Narimato-only exceptions

| Surface | Reason |
|---------|--------|
| `components/play/PlaySwipeSurface.js`, `PlayVoteSurface.js` | Full-viewport immersive game UI (exempt from guard) |
| `components/NarimatoSemanticButton.js` | SSR prerender fallback uses Mantine `Button` without `color=` until hydrated |
| `styles/playGame.module.css` | Play layout tokens |
| `notifications.show({ color })` | Mantine notifications API (not shell markup) |
| Admin routes | Not on public nav; still use GDS adapters |

## Validation

```bash
npm run build
npm run build:operator
npm run gds:ci-guard
```
