# GDS adoption — Narimato

[sovereignsquad/general-design-system](https://github.com/sovereignsquad/general-design-system) is the single source of truth for design, UI, and UX. This file records **Narimato adapter paths, migration state, validation commands, and approved exceptions** only.

| | Narimato | GDS |
|---|----------|-----|
| **Repository** | This repo (`narimato`) | [general-design-system](https://github.com/sovereignsquad/general-design-system) |
| **Runtime packages** | `@doneisbetter/gds-theme`, `@doneisbetter/gds-core`, `@doneisbetter/gds-admin` | Published from GDS SSOT |
| **Consumed version** | **2.6.1** (see `gds-adoption.json`) | npm `@doneisbetter/gds-*@2.6.1` |

> When UI behavior or tokens conflict, **GDS wins**. Narimato does not vend mirror packages under `packages/gds-*` or the legacy `@gds/*` scope.

## Required statement

> Narimato consumes the General Design System via `@doneisbetter/gds-*` packages. Shell surfaces use GDS primitives and Narimato thin adapters only—never raw Mantine `Alert`, `Button`, `ThemeIcon color=`, or palette `bg="violet.0"` on product UI.

## Package install

Install from the public npm registry (pinned in `package.json`):

```bash
npm install @doneisbetter/gds-theme@2.6.1 @doneisbetter/gds-core@2.6.1 @doneisbetter/gds-admin@2.6.1
npm install -D @doneisbetter/gds-eslint-config@2.6.1 @doneisbetter/gds-compliance@2.6.1
```

Do **not** use sibling `file:` links, GitHub release tarball URLs, or clone-and-build install hooks for CI/Vercel.

## Import contract (Pages Router)

| Use | Entrypoint |
|-----|------------|
| Root provider | `@doneisbetter/gds-theme/client` → `GdsProvider` |
| Theme extension | `@doneisbetter/gds-theme/server` → `extendGdsTheme` |
| Interactive primitives | `@doneisbetter/gds-core/client` |
| Structural / re-exports | `@doneisbetter/gds-core/server` |
| Admin surfaces (future) | `@doneisbetter/gds-admin/client` / `server` |

## Pattern contract inventory

| Pattern family | Narimato implementation | Status |
|----------------|-------------------------|--------|
| Root provider | `components/NarimatoProviders.js` → `GdsProvider` | Done |
| Theme | `lib/ui/narimatoTheme.js` | Done |
| Public shell | `components/public/PublicShell.js` | Done |
| Operator shell | `components/operator/NarimatoOperatorShell.js` | Done |
| Admin shell | `components/admin/AdminShell.js` | Done |
| Auth shell | `components/NarimatoAuthShell.js` | Done |
| Page header | `components/NarimatoPageHeader.js` | Done |
| Form field | `components/NarimatoFormField.js` | Done |
| State block | `components/NarimatoGdsAlert.js` | Done |
| Accent panel | `components/NarimatoAccentPanel.js` | Done |
| Semantic CTA | `components/NarimatoSemanticButton.js` | Done |
| Filter chip | `components/NarimatoChoiceChip.js` | Done |
| Metric card | `components/NarimatoMetricCard.js` | Done |
| Empty / status | `EmptyState`, `StatusBadge`, `ConfirmDialog` from `@doneisbetter/gds-core` | Done |

## Approved exceptions

| Surface | Reason |
|---------|--------|
| `components/play/PlaySwipeSurface.js`, `PlayVoteSurface.js` | Immersive game UI |
| `components/NarimatoSemanticButton.js` | SSR prerender fallback |
| `styles/playGame.module.css` | Play layout tokens |
| `notifications.show({ color })` | Mantine notifications API |

Declared in `gds-adoption.json`.

## Validation

```bash
npm run gds:ci-guard      # Narimato-specific shell rules
npm run gds:validate      # manifest schema
npm run gds:compliance    # shared gds-compliance drift checks
npm run lint              # Next.js + @doneisbetter/gds-eslint-config (errors only)
npm run build
```

## SSOT reading order

1. [README](https://github.com/sovereignsquad/general-design-system/blob/main/README.md)
2. [COMPATIBILITY_AND_RELEASES](https://github.com/sovereignsquad/general-design-system/blob/main/COMPATIBILITY_AND_RELEASES.md)
3. [ADOPTION_AND_MIGRATION_PLAYBOOK](https://github.com/sovereignsquad/general-design-system/blob/main/ADOPTION_AND_MIGRATION_PLAYBOOK.md)
4. [COMPLIANCE_TOOLKIT](https://github.com/sovereignsquad/general-design-system/blob/main/COMPLIANCE_TOOLKIT.md)
5. [VERIFIED_CONSUMER_INSTALL_PROOF](https://github.com/sovereignsquad/general-design-system/blob/main/VERIFIED_CONSUMER_INSTALL_PROOF.md)
