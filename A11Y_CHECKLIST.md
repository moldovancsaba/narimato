# NARIMATO — Accessibility gate and device checklist

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12) · [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) · [EVT-02](https://github.com/moldovancsaba/narimato/issues/33) · [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) · [UI-01](https://github.com/moldovancsaba/narimato/issues/7) · [UI-02](https://github.com/moldovancsaba/narimato/issues/8) · [UI-05](https://github.com/moldovancsaba/narimato/issues/11)
<!-- delivery-ssot:end -->

A11Y-01 installs one deterministic gate on the GDS accessibility test layer
([`@sovereignsquad/gds-a11y`](https://github.com/sovereignsquad/general-design-system/issues/81)).
The gate owns the accessibility claim; this document is the operator guide. Test results
live in CI artifacts, not here.

## 1. What blocks merge

| Gate | Command | CI job |
|---|---|---|
| GDS accessibility gate (Chromium) | `npm run a11y:gate` | `a11y (chromium)` on `ubuntu-latest` |
| GDS accessibility gate (WebKit) | `node scripts/a11y-gate.mjs --engine=webkit` | `a11y (webkit)` on `macos-latest` |
| Legacy viewport audit | `npm run audit:ui` | local / release checks |

Both jobs upload `artifacts/a11y` for 14 days. A missing Playwright, missing axe-core, a browser
that cannot launch, no free gate port, or a surface that cannot be reached exits `2`; it is never a
false green. All findings at or above the serious band, every incomplete check, and every expired
suppression exit `1`.

`npm run release:gate` runs the Chromium gate as a blocking release step and records the report
under `artifacts/release/v<version>/a11y/report.json`. The manual real-device matrix (A11Y-02,
issue #13) is an external release prerequisite: the gate reports `BLOCKED` until that evidence is
linked, and no headless run is presented as a device sign-off.

## 2. Migrated surfaces

The registry is [`public/js/a11y-surfaces.js`](public/js/a11y-surfaces.js); the gate audits every
entry.

| Surface id | Route / state | Viewport | Dialog / focus contract |
|---|---|---|---|
| `landing` | `/?intro=0&gds=1`, tag-in | 1440×900 | full-screen landing dialog; not dismissible before join |
| `hud` | joined, orbit | 1440×900 | no dialog; dock order asserted |
| `guide` | Quick Guide open | 1440×900 | GDS modal, Escape, focus restore to `#btn-help` |
| `manual` | Field Manual open | 1440×900 | GDS modal, Escape, focus restore to `#btn-help` |
| `report` | Session Report open | 1440×900 | GDS modal, Escape, focus restore to `#gds-btn-report` |
| `confirm` | Abandon confirm open | 1440×900 | GDS modal, Escape resolves false, focus restore |
| `surface` | surface mode | 1440×900 | no dialog; move pads order asserted |
| `cine` | cockpit intro | 1280×800 | reduced-motion pass; skip/replay/steer order asserted |
| `incident` | incident dialog open | 1280×800 | GDS dialog named by the incident title; Escape/close restores `#arena-canvas` |

## 3. The seven assertions

1. **axe serious/critical = 0.** `runGdsAxeScan` from the GDS layer runs the WCAG A/AA ruleset at
   the `serious` threshold. Serious and critical violations are failures; lower bands are warnings.
   A page without axe returns the package's critical `gds-axe-missing` failure.
2. **Expected tab order.** `expectGdsTabOrder` asserts each expected stop is focusable in order. On
   Chromium the gate also presses Tab from the first stop and fails if focus lands anywhere else.
3. **Focus trap and restore.** `expectGdsFocusTrap` plus a full forward Tab cycle prove containment;
   Escape must dismiss the dialog, and focus must return to the documented invoker (or
   `#arena-canvas` for a background incident). A dialog that cannot be dismissed fails as a keyboard
   trap.
4. **Contrast.** A WCAG 2.1 luminance sweep measures body text at ≥ 4.5:1 and large text at ≥ 3:1,
   resolving inherited transparent backgrounds. Transparent text fills fail. Gradient-backed text
   that cannot be sampled is reported as a warning, never silently dropped.
5. **200% zoom.** The gate halves the CSS viewport and asserts `scrollWidth ≤ innerWidth + 1` and
   that every primary action is visible or inside a genuinely scrollable ancestor.
6. **Reduced motion.** Playwright emulates `prefers-reduced-motion: reduce`. The incident overlay
   must paint one non-blank poster frame, stop the loop, keep a 1200 ms dwell, never add
   `body.is-shaking`, keep the GDS dialog named and dismissible, and restore focus. The cine chrome
   must report `reduced`, keep its copy and skip control, and run no long CSS animation.
7. **GDS ownership and 44 px targets.** Every visible interactive node on a migrated surface must
   descend from a node carrying both `data-gds-surface` and `data-gds-component`. Every visible
   button is at least 44×44 CSS px. `public/css/cyberpunk.css` may not skin `.gds-*` controls; layout
   lives in the island stylesheet.

## 4. Report contract

The gate writes `artifacts/a11y/report-<engine>.json` and a combined `artifacts/a11y/report.json`.
Delivery evidence is committed under `media/a11y/`.

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO timestamp",
  "commit": "short sha",
  "engine": "chromium|webkit|both",
  "status": "pass|warning|failure|incomplete",
  "summary": { "pass": 0, "warning": 0, "failure": 0, "incomplete": 0, "suppressed": 0, "total": 0 },
  "surfaces": [
    { "id": "incident", "route": "/?intro=0&gds=1", "status": "pass",
      "findings": [
        { "id": "color-contrast", "check": "axe", "surface": "incident",
          "selector": "#meteor-description", "expected": "no violations",
          "actual": "failure", "severity": "serious", "status": "failure",
          "message": "...", "helpUrl": "...", "suggestedGdsReplacement": "..." }
      ] }
  ],
  "findings": [],
  "suppressions": [],
  "suppressionAudit": { "applied": [], "expired": [], "unused": [] }
}
```

`pending` is never a status: a finding is `failure`, `warning`, `incomplete` or `suppressed`.
`incomplete` means the check did not run to completion (surface unreachable, browser error, missing
axe) and fails the job. `warning` is a review signal below the failure threshold.

## 5. Suppression policy

The ledger is [`a11y-suppressions.json`](a11y-suppressions.json). Every entry requires:

| Field | Rule |
|---|---|
| `id` | axe rule id or gate check id |
| `reason` | why the finding is accepted |
| `owner` | a named team or role accountable for removal |
| `expiresAt` | `YYYY-MM-DD`; at most 90 days from today unless the ledger policy widens it |
| `replacementPath` | the concrete GDS fix that removes the waiver |
| `selector` / `route` | optional narrowing |

An expired suppression never hides a finding: the finding stays active, is annotated with the
expiry date, and the gate reports `suppression-expired`. A suppression that matches nothing is a
warning, and becomes a failure with `--strict-suppressions` or once it is expired
(`suppression-expired-unused`). The policy is enforced by
`scripts/lib/a11y-report.mjs` and the suppression tests; it is not a convention.

## 6. Local reproduction

```bash
npm ci
npx playwright install --with-deps chromium webkit
npm run a11y:gate                              # chromium + webkit, artifacts/a11y
node scripts/a11y-gate.mjs --engine=chromium --out=artifacts/a11y --screenshots=media/a11y/screenshots
node scripts/a11y-gate.mjs --engine=webkit --only=incident
```

Without installing Playwright/axe in the repository, point at an existing installation:

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
AXE_PATH=/path/to/node_modules/axe-core/axe.min.js \
node scripts/a11y-gate.mjs --engine=chromium
```

Exit codes: `0` clean or warning-only, `1` findings/incomplete/expired-or-strict-unused
suppressions, `2` infrastructure error.

Negative checks (run before changing the gate):

- Remove `aria-label` from `#btn-guide-close` and run `--only=guide`: the axe scan must exit `1`.
- Make a modal ignore Escape: `focus-trap` must report a failure.
- Set a ledger entry's `expiresAt` in the past: `suppression-expired` must fail the run.

## 7. Engine notes

Chromium runs the real Tab walk. WebKit's default macOS keyboard policy does not Tab to buttons, so
the gate uses the GDS `expectGdsTabOrder` assertion there and records one explicit
`tab-walk-platform` warning; this is an engine limitation, not a skipped surface. Every other
assertion (axe, focus trap/restore, contrast, zoom, reduced motion, ownership, targets) runs in both
engines. WebKit missing system libraries exits `2` instead of a false green.

## 8. GDS-only rule

- Interactive nodes must sit inside a `[data-gds-surface][data-gds-component]` root. The island sets
  those markers on the app shell, each modal root and each dialog body.
- No custom control styling for migrated selectors in `public/css/cyberpunk.css`. The legacy
  stylesheet owns only the mount host and the fallback banner; controls are GDS components styled by
  props, tokens and the island layout stylesheet.
- A new migrated surface adds one registry entry, one ownership root, and its expected tab stops;
  the gate then enforces it on both engines.

## 9. Incident overlay (EVT-02)

The incident overlay is a GDS dialog rendered by
[`ui/src/surfaces/IncidentDialog.jsx`](ui/src/surfaces/IncidentDialog.jsx) inside the single
`GdsProvider`. The incident title is the dialog's accessible name; focus enters the heading; the GDS
Modal close control and the GDS DISMISS button both dispatch `incident-dismiss`; Escape, the button
and the dwell timeout all restore focus to `#arena-canvas`. The FX canvas is an
`aria-hidden` product-rendering layer behind the dialog, sized to device pixels, with a static poster
under reduced motion. The one polite `#event-announcer` and the static `#event-captions` still carry
the spoken and written event outcome.

## 10. Controls, touch and mode state (CTL-05, CTL-06)

- **Control-mode indicator** (`#control-mode`): `role="group"` with visible text
  (`OFFLINE|ORBIT|DESCENT|SURFACE|LEAVING` plus `DRAG: FOLLOW CURSOR|REVERSE`), a real
  `#btn-drag-mode` toggle with `aria-pressed` and `aria-describedby="control-mode-reason"`, and a
  `#btn-control-mode` action with `aria-disabled` during transitions. One polite announcement per
  transition through `#control-mode-live` (`role="status"`, `aria-atomic="true"`); no announcement
  on first render and no focus movement on change. Both buttons are ≥ 44 × 44 px with a 3:1 focus
  ring; the indicator stays visible at 390 × 844 and 792 × 302 without overlapping score/NAV/badge.
- **Pointer router**: capture makes a hold start on a pad survive the finger leaving the pad.
  `pointercancel`, `lostpointercapture`, window `blur`, `visibilitychange=hidden` and
  `orientationchange` all clear every role, so no steering can stick. Pinch is two-pointer only; a
  third finger is ignored until the count returns to two.
- **Touch matrix** (`scripts/acceptance-touch-parity.mjs`, real CDP `Input.dispatchTouchEvent`
  with `hasTouch`): pad hold + slide-off + release, cancel, blur, orientation, pinch in/out, and nine
  viewports for 44 px targets and safe-area clearance. Screenshots:
  `media/ctl/touch-mobile.jpg`, `media/ctl/touch-landscape.jpg`. `npm run audit:ui` additionally
  measures the surface pads, exit button and mode buttons at mobile and landscape touch contexts.
- **Surface harvest chip**: colour is never the only signal — the chip reads
  `GREEN // HARVEST` or `RED // LOCKED|COOLDOWN|STALE` with the same reason the server returns,
  and a maximum-depth cell is still green (depth shown as informational text).
- Reduced motion: the chip ring and zoom/lap transitions are suppressed; the mode label is static
  text and remains accurate.

Automated evidence: `media/ctl/control-mode-*.jpg`, `media/ctl/touch-*.jpg`,
`media/ctl/exit-*.jpg`, `media/ctl/surface-truth-*.jpg`; JSON reports are printed by the
`scripts/acceptance-*.mjs` runs.

Evidence: `media/evt-01-03-aud-01/acceptance-incident-a11y.json`,
`acceptance-incident-visual.json`, `acceptance-incident-cycle.json` and the incident JPEGs. The
gate's `incident` and reduced-motion checks reproduce the same contract on every run.

## 11. Manual real-device gate (A11Y-02)

The real-device gate is executable and separate from the headless A11Y-01 gate. It is owned by
[`scripts/device-gate.mjs`](scripts/device-gate.mjs) and documented in
[docs/DEVICE_GATE.md](docs/DEVICE_GATE.md). The fixed matrix is five targets, four rows each:

- iPhone Safari (390×844, 844×390), Android Chrome (412×915, 915×412), iPad Safari (1024×768,
  768×1024), Windows Chrome + NVDA (1440×900), macOS Safari + VoiceOver (1440×900).
- Rows: boot/join/captions, the target screen-reader or keyboard script, 200% zoom + reduced motion
  + daylight contrast, and autoplay/interruption plus short-screen/inset overlays.
- A run is recorded in `media/a11y/device-gate/{SHORT_SHA}/EVIDENCE.json` with per-row evidence,
  a full commit SHA, a run date and two approvals, at least one from a reviewer who did not execute
  the run. A fail row must link a `[Device][Surface]` defect issue.
- Headless CI cannot sign this gate: it can print the plan and run the checker's unit tests, but it
  cannot produce device evidence, screen-reader speech or the two approvals. An absent ledger exits
  `3`, an incomplete ledger exits `1`, and only a complete ledger exits `0`.

## 12. Operator triage

Every finding prints `surface`, `selector`, `expected` and `actual`. Start with the first failure
line, reproduce with `--only=<surface>`, then fix in GDS components, tokens or island layout only.
Do not add a suppression for a missing GDS primitive, an unnamed control, a broken keyboard path, an
invisible focus trap or an avoidable contrast failure.

## Expected interaction errors

The accessibility gate ignores only explicitly allow-listed interaction outcomes (currently the surface probe's own `409 Conflict` on a contested cell) and records them in the report as `expectedRuntimeErrors`; every other page/console error still fails the gate.
