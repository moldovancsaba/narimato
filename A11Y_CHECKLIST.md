# NARIMATO — Accessibility / Device Checklist (A4)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [UI-03](https://github.com/moldovancsaba/narimato/issues/9) · [UI-04](https://github.com/moldovancsaba/narimato/issues/10) · [UI-05](https://github.com/moldovancsaba/narimato/issues/11) · [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12) · [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) · [CTL-06](https://github.com/moldovancsaba/narimato/issues/31) · [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) · [REL-01](https://github.com/moldovancsaba/narimato/issues/45)
<!-- delivery-ssot:end -->

## Automated (delivered)

`npm run audit:ui` runs the nine-viewport matrix in **Chromium** and can run the same audit in
**WebKit** (Safari engine) with:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_ENGINE=webkit npm run audit:ui
```

Checks:
- score/nav/badge overlap;
- target inspector vs subtitles;
- intro captions vs touch steering;
- mobile labels and 44 px primary touch targets;
- accessible names on visible buttons;
- short-landing form visibility and hidden game chrome;
- console/page errors and horizontal overflow.

Latest result: **clean in Chromium and WebKit**.

axe-core WCAG audit (`npm run audit:a11y`, dev-only dependency): latest result
**0 serious/critical violations** in Chromium and WebKit for landing, HUD, Field Manual and the
incident overlay (desktop 1440×900 and mobile 390×844).

Additional axe-core WCAG A/AA audit:

```sh
npm install --no-save axe-core
PLAYWRIGHT_MODULE=/path/to/playwright AXE_PATH=./node_modules/axe-core/axe.min.js npm run audit:a11y
```

Latest result: **0 serious/critical violations** on landing, HUD and Field Manual in Chromium and
WebKit. Fixed in v3.11.0: resource-market keyboard access, duplicate visible/accessible control
labels, and SFX button naming.

## Keyboard (delivered)

- Escape closes the Field Manual, landing briefing and escape CTA.
- All overlay primary buttons are keyboard reachable; form fields and buttons retain focus styles.
- `prefers-reduced-motion` CSS is present and respected by intro/interlude/renderer.

## Surface mode keyboard and screen-reader path (RND-03)

Surface mode is a camera and control mode on the same HUD tree:

- Orbital nodes (score, mission, cargo, pilots, arcade, navigation, target inspector, hint) stay
  mounted and keep their identity before, during and after surface entry; surface only adds the
  `#surface-controls` group. The parity contract is `public/js/shared/hud-parity.js` and the
  acceptance script is `node scripts/verify-hud-parity.mjs`.
- `#surface-controls` is a `role="group"` named `Surface controls`; every button has an accessible
  name and a 44 px target at mobile widths.
- `#surface-target` is the single `aria-live="polite"` region for target and harvest state; the lap
  bar is a `role="progressbar"` with `aria-valuenow`.
- Entering the surface moves focus to the first movement pad; leaving restores focus to the orbit
  zoom control (or the HUD region where the zoom indicator is hidden on narrow viewports).
- Movement pads are `aria-disabled` during landing and leaving; Escape returns to orbit.
- No surface CSS rule hides the orbital panels, the hint bar or the target inspector.

Automated evidence: `media/hud-parity/report.json` (three-phase HUD snapshot parity, focus
placement/restore, pad sizes, aria snapshot per viewport). axe serious/critical verification of the
surface strip remains owned by UI-04/A11Y-01 because the strip is not yet a GDS island; the current
strip reuses the existing HUD markup and tokens.

## Incident feedback and announcements (EVT-03)

Every planetary incident and the relief drop are announced, captioned, keyboard dismissable and
static under reduced motion. The canvas FX are decorative only; every piece of information they
show is also text in the DOM.

- **Live region inventory:** `#event-announcer` is the **only** added event live region
  (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`, visually hidden). It receives
  exactly one full spoken sentence per event:
  `<TITLE> on <PLANET>. <first description sentence> <outcome>` — for example
  “Solar flare on Magrathea. The local star lashed out and cooked the daylight side. The crust has
  reset, new ore is exposed, and mining is open again.” Spoken text never contains the visual `//`
  separator, which screen readers would read as “slash slash”. Toasts do not duplicate it.
- **Static captions:** `#event-captions` holds sentence-unit `<li>` elements with no `aria-live`,
  so re-reading them never re-triggers speech. The wording comes from the pure builder
  `public/js/shared/incident-announcements.js`, the same module the card uses.
- **Dedupe:** announcements are keyed `kind:planetIndex:revision`; an SSE replay after reconnect
  is spoken once, and the key advances on every fired event.
- **Overlay semantics:** `#meteor-overlay` is a `role="region"` named by `#meteor-title` (the
  server title, so nuclear and solar are not announced as meteor) and described by
  `#meteor-sub` and `#meteor-description`. `Escape` and the 44 px **DISMISS** button close it and
  return focus to `#arena-canvas`; incidents never steal focus or trap it while a player types.
- **Reduced motion:** one static poster frame is painted, the animation loop and `body.is-shaking`
  are not applied, and the overlay dwell is 1200 ms instead of 2600 ms.
- **Design-system dependency:** UI-01 (GDS island foundation, `GdsProvider`, adapter boundary) is on
  `main`; the incident overlay is still a legacy `ui.js` surface whose GDS composition is owned by
  UI-05 (EVT-02's native dependency). Until UI-05 lands, the new controls reuse the existing `.btn`
  atom and GDS-facing tokens; no parallel component library is introduced.
- **Evidence:** `scripts/acceptance-incident-a11y.mjs` records the roles, names, live region,
  captions, Escape/DISMISS behaviour, focus return and reduced-motion state for all four kinds
  (`media/evt-01-03-aud-01/acceptance-incident-a11y.json`); `npm run audit:a11y` includes the
  incident overlay and reports 0 serious/critical violations.

## Controls, touch and mode state (CTL-05, CTL-06)

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

## Manual real-device gate (pending)

Cannot be executed in this headless environment; run before calling A4 fully closed:

- [ ] iPhone Safari (portrait + landscape): intro skip, join, HUD top row, brief scroll, captions.
- [ ] Android Chrome (portrait + landscape): same.
- [ ] Screen reader (VoiceOver/TalkBack/NVDA): planet badge, mission/cargo, target inspector,
      subtitles, manual, escape CTA.
- [ ] 200% zoom: no clipped primary actions; landing/brief/CTA scroll.
- [ ] Reduced motion: no essential information depends on animation.
- [ ] Contrast: muted labels remain readable in daylight/outdoor brightness.

## Known remaining risks

- Real-device audio autoplay differs (iOS gesture rules). The `TAP FOR VOICE` control
  (`#btn-tap-voice`, a real 44 px button described by `#tap-voice-help`) appears when narration is
  gesture-blocked and resumes the pending sentence; browser emulation evidence is in
  `media/evt-01-03-aud-01/acceptance-audio-resilience.json`. A physical iPhone/Android screen
  reader pass is still required by the manual gate above.
- VoiceOver reading order for the HUD needs a manual tuning pass.
- Report/share overlay on very short screens needs a long-report device check.

## Migrated GDS surfaces (UI-02…UI-05)

| Gate | How to verify | Evidence |
|---|---|---|
| HUD keyboard traversal, drawers, inspector | Tab through `#hud`, open each dock drawer, open/close `#hud-target`, confirm focus visible at 200% | `media/gds/migration/hud-*.png`, axe report |
| Charge progressbar | `#target-charge-bar` exposes a labelled `role="progressbar"` with min/max/now plus `03 / 08` text | `test/hud-format.test.js`, browser probe |
| Overlay focus trap and restore | Open Landing, Guide, Manual, Report, Confirm; Tab wraps; Escape/scrim/close restore the invoker | `scripts/verify-ui-migration.mjs`, `test/overlay-contract.test.js` |
| Report PNG | `#report-card-preview` is a deterministic 1200×630 canvas, no network assets | report screenshot, `test/share-text.test.js` |
| Surface strip | `#surface-target` text state, 44 px pads at 390×844 and 844×390, exit confirm restores focus | `media/gds/migration/surface-*.png` |
| Cine chrome | Skip/replay/CC/VOX reachable by Tab; captions announced politely; reduced motion shortens without losing copy | `media/gds/migration/cine-*.png`, `test/cine-chrome.test.js` |
| Focus vs canvas keys | Steering is captured only while the canvas owns the keyboard; focused controls keep Space/Enter/arrows | `test/surface-hud.test.js`, `test/cine-chrome.test.js` |
| axe serious/critical | Landing, HUD, Guide, Report and Surface run clean | `media/gds/migration/axe-report.json` |
