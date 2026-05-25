# Plan: GDS optional improvements (Narimato)

Status: Shipped (2026-05-23)  
Created: 2026-05-23  
Depends on: GDS **2.4.3** packages vendored in Narimato (`packages/gds-*`)

This plan covers **optional** polish items from the [GDS adoption audit](./GDS_ADOPTION.md). None of them block surveys or setup from working today.

**Reminder:** [General Design System](https://github.com/sovereignsquad/general-design-system) is a **separate project**. Narimato only changes its own repo; GDS updates flow in via `npm run gds:sync` when needed.

---

## Goals (what “done” looks like)

| # | Improvement | User-visible outcome |
|---|-------------|-------------------|
| 1 | **Semantic buttons** | Setup and key actions use consistent labels/icons (Save, Delete, Play, etc.) from GDS |
| 2 | **Metric cards** | Dashboard stats look the same if we add more stat screens later |
| 3 | **Light / dark mode** | Visitors and operators can switch theme on shell pages; play screens stay readable |

---

## Non-goals (out of scope for this plan)

- Rewriting the GDS repository inside Narimato  
- Full **immersive play** dark theme (swipe game uses custom CSS — exception stays)  
- Organisation-specific branding / custom colours per tenant  
- Translating the whole product to many languages (locale packs exist in GDS but are optional)  
- Replacing every `<Button>` in the codebase in one pass  

---

## Recommended order

```text
Phase 1 ─ SemanticButton (operator + public, high-traffic)
    ↓
Phase 2 ─ NarimatoMetricCard (small component, dashboard first)
    ↓
Phase 3 ─ Dark mode (shell pages + docs + play readability check)
```

Phase 1 is lowest risk and aligns with GDS `ConfirmDialog` (already semantic). Phase 3 needs the most visual QA.

---

## Phase 1 — SemanticButton adoption

**Effort:** ~0.5–1 day  
**Risk:** Low  

### Why

GDS `SemanticButton` ties each action to `GdsVocabulary` (label + icon + optional feedback). Operator and public flows get consistent wording without inventing new button text per screen.

### Scope (first wave)

| Area | Files | Actions to map |
|------|-------|----------------|
| Operator setup | `OperatorDashboard.js`, `OperatorSurveyPanel.js`, `OperatorOrganizationsPanel.js` | `start` / `play` for “Set up test survey”; `delete` for org delete; `save` where applicable |
| Operator AI (advanced) | `LocalOperatorConsole.js` | `save`, `delete`, `add`, `send` for enqueue / reject / topic chat |
| Public landing | `pages/index.js` | `start` or `confirm` for unlock / submit password |
| Confirm dialogs | Already via `ConfirmDialog` | Keep `confirmAction` / `cancelAction` (`delete`, `cancel`, `confirm`) |

Use only actions that exist in `GdsVocabulary` (e.g. `play`, `start`, `save`, `delete`, `add`, `send`, `confirm`, `cancel`). If no match, keep a plain Mantine `Button` and note a GDS vocabulary gap.

### Implementation steps

1. Add thin wrapper `components/NarimatoSemanticButton.js` (optional) that re-exports `SemanticButton` and documents allowed `action` keys for Narimato — keeps imports consistent.  
2. Replace primary/secondary CTAs in the table above; leave destructive flows on `ConfirmDialog`.  
3. Run `npm run gds:ci-guard` and `npm run build:operator`.  
4. Manual check: delete org, bootstrap survey, landing password submit.

### Acceptance criteria

- [x] No `confirmLabel` / `cancelLabel` on `ConfirmDialog`  
- [x] Primary operator CTAs use `SemanticButton` or documented exception  
- [x] `gds:ci-guard` and `npm run build` pass  

### Rollback

Revert button imports to Mantine `Button`; no data or API impact.

---

## Phase 2 — Shared metric card

**Effort:** ~0.25–0.5 day  
**Risk:** Low  

### Why

`OperatorDashboard` inlines metric UI. GDS expects a **metric card** pattern so a second stats screen does not copy-paste layout.

### Scope

1. Create `components/NarimatoMetricCard.js` — thin Mantine `Paper` + label + value + optional `StatusBadge` (matches GDS metric pattern; not a new design).  
2. Refactor `OperatorDashboard.js` “System details” and any stat tiles to use it.  
3. Document path in `docs/GDS_ADOPTION.md` pattern table (metric card → Done).

### Out of scope for Phase 2

- Play results / rankings (different layout — product-specific adapters stay).  
- Charts or analytics dashboards.

### Acceptance criteria

- [x] One reusable `NarimatoMetricCard` used on Home dashboard  
- [x] Visual parity with current dashboard (no layout regression)  
- [x] Pattern inventory updated in `GDS_ADOPTION.md`  

---

## Phase 3 — Light / dark mode (shell surfaces)

**Effort:** ~1–2 days  
**Risk:** Medium (visual QA on many pages)  

### Why

`ThemeToggle` is already on **local setup** (`NarimatoOperatorShell`). Public shell does not expose it yet. GDS 2.2.x fixed toggle behaviour; Narimato should enable it where shells exist and verify contrast.

### Scope

**In scope**

| Surface | Action |
|---------|--------|
| `PublicShell` | Add `ThemeToggle` in header (dynamic import, `ssr: false`, same as operator) |
| `NarimatoProviders` | Support color scheme: `defaultColorScheme="auto"` + `ColorSchemeScript` in `_document.js` or `_app.js` to avoid flash |
| `AdminShell` / `NarimatoAuthShell` | Add toggle if those shells are still used |
| Legal pages | `/privacy`, `/terms`, `/cookies` — inherit `PublicShell` |
| Operator `:10006` | Already has toggle — verify light/dark on Home, Share survey, Organisations |

**Explicit exceptions (document in `GDS_ADOPTION.md`)**

| Surface | Reason |
|---------|--------|
| Immersive `/play`, active `/swipe-only` | `playGame.module.css` — custom full-screen UI |
| Vote/swipe overlays | Must stay readable; spot-check both schemes |

**Out of scope**

- Forcing dark mode by default for all users  
- Per-organisation themes  
- Updating `docs/FUTURE.md` line “Application dark mode” until Phase 3 acceptance — then change to “Shell pages support light/dark via Mantine; immersive play excepted”

### Implementation steps

1. Add `ColorSchemeScript` with default `light` (or `auto`) in `pages/_document.js`.  
2. Add `ThemeToggle` to `PublicShell` header.  
3. Audit `styles/playGame.module.css` and play components for hard-coded light backgrounds; use Mantine CSS variables or `light-dark()` where cheap.  
4. Checklist pass (below).  
5. Update `docs/FUTURE.md` and approved exceptions in `GDS_ADOPTION.md`.

### QA checklist

- [x] Toggle on public Home, privacy, terms, cookies  
- [x] Toggle on operator Home + Share survey  
- [x] Landing password form readable in dark mode  
- [x] Play picker (`PublicShell`) readable in dark mode  
- [x] In-game swipe (no shell) still usable — no regression  
- [x] No flash of wrong theme on first load (SSR)  

### Acceptance criteria

- [x] Shell pages support user-selected light/dark  
- [x] Exceptions documented for immersive play  
- [x] `FUTURE.md` updated to reflect partial dark mode (not “no toggle”)  

---

## Phase 4 — Optional follow-ups (later backlog)

| Item | When to consider |
|------|------------------|
| `useGdsTranslation` + locale (`hu`, `en`) | Product needs Hungarian/English UI strings from GDS |
| `SemanticButton` on play/results CTAs | After Phase 1 stable |
| Article shell for legal pages | If `PublicShell` feels too “marketing” for long text |
| Visual regression tests | If CI should catch contrast regressions |

---

## Dependencies and sync

| Dependency | Notes |
|------------|--------|
| GDS packages in Narimato | Run `npm run gds:sync` before Phase 1 if GDS repo moved ahead on GitHub |
| GDS repo | Vocabulary / `SemanticButton` changes happen **only in GDS**; Narimato consumes copies |
| No backend changes | UI-only plan |

---

## Validation (every phase)

```bash
npm run gds:ci-guard
npm run build
npm run build:operator
npm run dev          # manual UI check
```

Optional: `node scripts/e2e-v1-play.js` after Phase 3 if play colours changed.

---

## Suggested timeline (solo developer)

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1 — SemanticButton | 0.5–1 d | ~1 d |
| 2 — Metric card | 0.5 d | ~1.5 d |
| 3 — Dark mode + QA | 1–2 d | ~2.5–3.5 d |

Can ship Phase 1 alone as a small PR; Phases 2–3 as follow-up PRs.

---

## Tracking

GitHub: [Project board #33](https://github.com/users/moldovancsaba/projects/33) · Milestone **GDS optional improvements**

| Phase | Issue | Board status |
|-------|-------|----------------|
| Program | [#47](https://github.com/moldovancsaba/narimato/issues/47) (parent) | Roadmap |
| 1 SemanticButton | [#48](https://github.com/moldovancsaba/narimato/issues/48) ↳ sub-issue | Done |
| 2 Metric card | [#49](https://github.com/moldovancsaba/narimato/issues/49) ↳ sub-issue | Done |
| 3 Dark mode | [#50](https://github.com/moldovancsaba/narimato/issues/50) ↳ sub-issue | Done |

Close [#47](https://github.com/moldovancsaba/narimato/issues/47) when sub-issues are closed on GitHub.

---

## Related docs

- [GDS_ADOPTION.md](./GDS_ADOPTION.md) — how Narimato uses GDS  
- [WHAT_IS_NARIMATO.md](./WHAT_IS_NARIMATO.md) — project boundaries  
- [FUTURE.md](./FUTURE.md) — update after Phase 3  
