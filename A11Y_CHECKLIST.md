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
**0 serious/critical violations** in Chromium and WebKit for landing, HUD and Field Manual.

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

- Real-device audio autoplay differs (iOS gesture rules); the `TAP FOR VOICE` hint covers this.
- VoiceOver reading order for the HUD needs a manual tuning pass.
- Report/share overlay on very short screens needs a long-report device check.
