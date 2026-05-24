# GDS adoption — Narimato

Narimato is a **standalone product repository**. The [General Design System (GDS)](https://github.com/moldovancsaba/general-design-system) is a **separate repository**. Narimato **uses** GDS as a dependency; the two projects are not merged and do not share a codebase.

| | Narimato | GDS |
|---|----------|-----|
| **Repository** | This repo (`narimato`) | [general-design-system](https://github.com/moldovancsaba/general-design-system) |
| **Role** | Product app (survey / play / operator) | Design rules + shared UI packages |
| **What we ship** | App code + **vendored** `packages/gds-*` | Source docs + `@gds/core` / `@gds/theme` builds |
| **Where rules live** | `docs/GDS_ADOPTION.md` (this file) only | GDS repo (`FOUNDATION.md`, governance, etc.) |

**Pinned GDS version:** 2.3.0 (2026-05-24)

### Last audit (2026-05-24)

Checked [general-design-system](https://github.com/moldovancsaba/general-design-system) on GitHub against Narimato’s vendored `packages/gds-*`.

| Check | Result |
|-------|--------|
| GDS policy release | **2.3.0** (shared primitives: `MetricCard`, `FormField`, shells, data patterns) |
| GDS package builds vs Narimato | **Synced** via `npm run gds:sync` |
| Narimato CI guard | **Passing** |
| Breaking API gaps | **None found** — `ConfirmDialog` already uses `confirmAction` |
| New primitives adopted | `MetricCard` via `NarimatoMetricCard`; `FormField` via `NarimatoFormField` on all shell/operator/admin forms |

**Optional polish (2026-05-23):** SemanticButton, metric card, and shell light/dark mode shipped — see [GDS_OPTIONAL_IMPROVEMENTS_PLAN.md](./GDS_OPTIONAL_IMPROVEMENTS_PLAN.md). Immersive `/play` remains a documented exception (no shell toggle).

When GDS changes again: build in the **GDS repo**, then in Narimato run `npm run gds:sync` and commit updated `packages/gds-*/dist`.

> When UI behavior or tokens conflict, follow **GDS** (upstream). This file records **how Narimato implements** that dependency—local adapters, exceptions, and validation—not GDS policy itself.

## Required statement (Narimato adapter)

> Narimato follows the [General Design System](https://github.com/moldovancsaba/general-design-system) via vendored `@gds/core` and `@gds/theme`. This repository documents Narimato-specific adapters, migration state, validation commands, and approved exceptions only.

## How Narimato depends on GDS

1. **Vendored packages** — `packages/gds-core` and `packages/gds-theme` contain **built** artifacts copied from a GDS release (not a git submodule of the whole GDS repo).
2. **npm** — `package.json` references them as `file:./packages/gds-*`.
3. **Local adapters** — Shells, headers, and theme extensions live under `components/` and `lib/ui/` in **this** repo only.
4. **Sync** — When GDS releases new package builds, refresh vendored `dist/` with `npm run gds:sync` (see below). No need to change Narimato app structure unless GDS introduces breaking API changes.

GDS may mention Narimato in its own portfolio docs; that is maintained **in the GDS repository**, not here.

## Updating vendored GDS packages

On your machine, clone/build GDS separately, then copy into Narimato:

```bash
# In the GDS repo (separate checkout):
git clone https://github.com/moldovancsaba/general-design-system.git
cd general-design-system && npm run build

# In Narimato (this repo):
export GDS_ROOT=/path/to/general-design-system   # optional; see gds-sync default
npm run gds:sync
npm run build && npm run gds:ci-guard
```

Default sync path is `GDS_SSOT_ROOT` or `/Users/Shared/Projects/GENERAL_DESIGN_SYSTEM` for local convenience only—CI and production use the **committed** copies under `packages/`.

## Pattern contract inventory (Narimato)

Narimato’s mapping to GDS pattern families (see GDS `PATTERN_SERVICE_MODEL.md` for definitions):

| Pattern family | Narimato implementation | Status |
|----------------|----------------------|--------|
| Root provider | `components/NarimatoProviders.js` | Done |
| Theme | `lib/ui/narimatoTheme.js` | Done |
| Public shell | `components/public/PublicShell.js` | Done |
| Operator shell | `components/operator/NarimatoOperatorShell.js` | Done |
| Admin shell | `components/admin/AdminShell.js` | Done |
| Auth shell | `components/NarimatoAuthShell.js` | Done |
| Page header | `components/NarimatoPageHeader.js` | Done |
| Form field | `components/NarimatoFormField.js` | Done |
| Article / legal | `PublicShell` on legal routes | Partial |
| State block | `EmptyState`, `StatusBadge`, `ConfirmDialog` from `@gds/core` | Done |
| Metric card | `components/NarimatoMetricCard.js` → GDS `MetricCard` → `OperatorDashboard.js` | Done |
| Form field | `components/NarimatoFormField.js` (GDS FormField pattern) → operator, public, admin forms | Done |
| Semantic CTA | `components/NarimatoSemanticButton.js` → operator + landing | Done |
| Shell theme toggle | `components/NarimatoThemeToggle.js` → public/operator/admin/auth shells | Done |
| Data toolbar / table | — | N/A |

## Product surfaces

| Surface | URL | Shell |
|---------|-----|-------|
| Public site | narimato.com | `PublicShell` |
| Local setup | `127.0.0.1:10006` | `NarimatoOperatorShell` |
| Admin | `/admin/*` | `AdminShell` / `NarimatoAuthShell` |
| Immersive play | `/play`, `/swipe-only` | None (exception) |

## Local adapter paths

| Concern | Path |
|---------|------|
| Root provider | `components/NarimatoProviders.js` |
| Theme | `lib/ui/narimatoTheme.js` |
| Public UI | `components/public/*` |
| Operator UI | `components/operator/*` |
| Survey access | `lib/system/surveyAccess.js`, `lib/hooks/useSurveyGate.js` |
| Play | `components/play/*`, `styles/playGame.module.css` |

## Enforcement in this repo

`npm run gds:ci-guard` checks Narimato code only:

- Use `GdsIcons` from `@gds/core`, not `@tabler/icons-react`
- Use `ConfirmDialog` with `confirmAction` / `cancelAction`
- Use `StatusBadge` for semantic colors, not `<Badge color=…>`
- Do not import removed `NarimatoShell`

## Approved Narimato-only exceptions

| Surface | Reason |
|---------|--------|
| Immersive play | Full-viewport game UI; no `ThemeToggle` (custom CSS) |
| `playGame.module.css` | Play layout tokens |
| Admin routes | Not on public nav |
| LocalOperatorConsole utility actions | Reload / refresh projection keep plain `Button` (no GDS action key) |

## Validation

```bash
npm run build
npm run build:operator
npm run gds:ci-guard
```
