# NARIMATO — Accessibility / Device Checklist (A4)

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
