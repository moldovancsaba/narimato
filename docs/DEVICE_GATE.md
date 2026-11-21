# NARIMATO — Real-device accessibility gate (A11Y-02)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](DEFINITION_OF_DONE.md) · [Issue index](ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [A11Y-01](https://github.com/moldovancsaba/narimato/issues/12) · [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) · [STR-01](https://github.com/moldovancsaba/narimato/issues/35) · [AUD-01](https://github.com/moldovancsaba/narimato/issues/37) · [CTL-06](https://github.com/moldovancsaba/narimato/issues/31) · [EVT-03](https://github.com/moldovancsaba/narimato/issues/34) · [REL-01](https://github.com/moldovancsaba/narimato/issues/45)
<!-- delivery-ssot:end -->

The headless [A11Y_CHECKLIST.md](../A11Y_CHECKLIST.md) gate is a merge gate. This document defines the
separate **real-device gate**: a fixed 20-row matrix, five screen-reader/keyboard scripts, a
commit-keyed evidence ledger, and a computed sign-off. The executor is
[`scripts/device-gate.mjs`](../scripts/device-gate.mjs); the ledger is a JSON record, not prose.

## 1. Why headless CI cannot sign this gate

Playwright Chromium and WebKit are useful proxies, but they are not the target devices:

- iOS Safari and Android Chrome have different autoplay policies, viewport chrome, notch/inset
  behaviour and text scaling.
- A headless browser has no VoiceOver, TalkBack or NVDA speech output, no keyboard/screen-reader
  interaction model and no real focus ring visibility.
- A call, Bluetooth route change, screen lock or browser reload cannot be injected as a genuine
  platform interruption.
- Daylight contrast, home-indicator gestures and device-specific zoom are physical observations.

CI may run `node scripts/device-gate.mjs --plan --commit=...` and the unit tests. It cannot produce
the evidence files or the two independent approvals. A pipeline that prints "pass" without a
ledger is wrong: the checker exits `3` (`LEDGER_MISSING`) and the release stays blocked.

## 2. Fixed target matrix

| Target id | OS / browser | Viewports | Assistive technology | Screen-reader script |
|---|---|---|---|---|
| `iphone-safari` | iOS 17+, Safari | 390×844, 844×390 | VoiceOver | `SR-IPHONE-VO` |
| `android-chrome` | Android 13+, Chrome | 412×915, 915×412 | TalkBack | `SR-ANDROID-TALKBACK` |
| `ipad-safari` | iPadOS 17+, Safari | 1024×768, 768×1024 | Hardware keyboard only | `SR-IPAD-KEYBOARD` |
| `windows-nvda` | Windows 11, Chrome | 1440×900 | NVDA | `SR-WINDOWS-NVDA` |
| `macos-voiceover` | macOS 14+, Safari | 1440×900 | VoiceOver | `SR-MACOS-VO` |

One unit per target. iOS/iPadOS are pinned to the shipping major; TalkBack is Android 13+ only.
A run on a different OS/browser does not satisfy the row.

## 3. The fixed 20 rows

Four rows per target, in target-major order. `--plan` prints this exact matrix; the checker rejects
unknown, duplicate or missing row ids.

| Row id | Script | Criterion |
|---|---|---|
| `<target>/boot` | `DEV-BOOT` | Intro skip (`?intro=0`), join, HUD top row, short briefing and captions render; no primary action clipped at the target viewports. |
| `<target>/sr` | target screen-reader script | Planet badge, mission, cargo, target inspector, captions, manual, escape CTA and incident dialog are announced in a usable order with no focus trap. |
| `<target>/zoom-motion` | `DEV-ZOOM-MOTION` | 200% zoom keeps every primary action reachable; reduced motion loses no information; muted HUD labels stay legible in direct daylight. |
| `<target>/audio-overlay` | `DEV-AUDIO-OVERLAY` | First narration is gesture-gated, a call/route interruption recovers with captions intact, report overlay and notch/home-indicator insets clear system gestures. |

Each row records its own `device.model`, `device.os`, `device.browser`, `device.assistiveTech`,
`capturedAt`, `evidence[]` and `verdict`. A row is `pass`, `fail` or `blocked`; "partial" is a fail.

## 4. Screen-reader scripts

Run each script on the target device, at both listed viewports for iPhone, Android and iPad. Start
from `/?intro=0&gds=1` with a throwaway `DATA_DIR`, `BOTS=0`, synthetic callsigns `DV01`…`DV12` and
no notifications on screen. Record the observed announcement text or the failure; do not infer.

### 4.1 `SR-IPHONE-VO` — iPhone Safari + VoiceOver

1. Enable VoiceOver in Settings → Accessibility. Set the rotor to Headings and Form Controls.
2. Load `/?intro=0&gds=1`. Swipe right through the landing dialog: title, tag field, JOIN control.
   Every stop must have a name, role and state; the JOIN control must be the last landing stop.
3. Join as `DV01`. Confirm the HUD/join announcement; do not rely on a visual toast.
4. Read the HUD top row in order: score, planet badge, mission, cargo. Each value must be
   announced with its label; no duplicate or skipped stop.
5. Open the Field Manual. Swipe through the first and last manual section; close it and confirm
   focus returns to the invoker (`#btn-help` or its GDS replacement).
6. Open the Quick Guide with `/?guide=1`. Read the four guide cards; confirm the close control and
   that the dialog name includes "Quick Guide".
7. Target inspector: tap a cell, then read the inspector. Confirm planet/depth/resource/target
   values are announced, not only painted on the canvas.
8. Captions: trigger a narration cue. Confirm the caption text changes with the spoken sentence; if
   the cue is silent, confirm the caption still advances.
9. Incident dialog: trigger the deterministic incident path. Confirm the dialog is named by the
   incident title, its description is readable, DISMISS is reachable, and dismissal restores focus
   to the game surface.
10. Escape CTA: find the escape action; confirm label, state and the confirmation path. Activate it
    only on a throwaway world.
11. If VoiceOver focus enters the canvas and traps, record the precise escaping swipe sequence and
    file a `[Device][Surface]` defect. Do not mark the row pass.

Pass only if every step is usable and no focus trap occurs.

### 4.2 `SR-ANDROID-TALKBACK` — Android Chrome + TalkBack

1. Enable TalkBack. Turn on "Speak element IDs" only if needed for diagnosis; turn it off before
   recording.
2. Load `/?intro=0&gds=1`. Swipe through the landing dialog and join as `DV02`.
3. Use swipe-right/left to read the HUD top row. Confirm badge, mission and cargo values; use the
   local context menu for any unlabeled control and record the missing label as a defect.
4. Open the Field Manual and Quick Guide. Read headings, body text, close controls and focus
   restoration.
5. Target inspector: tap a cell, read the inspector, then mine with the accessible control (not a
   raw canvas gesture).
6. Captions: trigger narration; confirm the visible caption text and the spoken announcement do not
   fight each other. A forced-caption cue must remain readable when audio fails.
7. Incident dialog: confirm title, description, DISMISS and focus restoration.
8. Rotate to landscape at 915×412 and repeat the HUD/escape/overlay steps. The dock and pads must
   clear the gesture navigation area.
9. Escape CTA and report overlay: confirm both are reachable without dismissing the wrong layer.

### 4.3 `SR-IPAD-KEYBOARD` — iPad Safari, hardware keyboard only

1. Disable VoiceOver. Connect a hardware keyboard. Enable Full Keyboard Access.
2. Load `/?intro=0&gds=1`. Press Tab from the first stop; every landing control must receive a
   visible focus ring in reading order; Shift+Tab must reverse it.
3. Join as `DV03`. On the HUD, Tab through score, badge, mission, cargo, target inspector, manual,
   guide, report and escape. No stop may be skipped; the focus ring must be visible on all.
4. Open the Quick Guide with the keyboard. Press Escape; focus must return to the invoker. Repeat
   for the Field Manual, report and abandon-confirm dialogs.
5. In surface mode, Tab through the move pads and exit control; confirm focus order and 44×44 px
   targets.
6. At 1024×768 and 768×1024, repeat the modal Escape path and confirm no primary action is clipped.
7. Confirm the canvas is not a keyboard dead end: focus can leave it in both directions.

### 4.4 `SR-WINDOWS-NVDA` — Windows 11 Chrome + NVDA

1. Start NVDA with the default desktop keyboard layout. Load `/?intro=0&gds=1` in Chrome.
2. In browse mode, use `H` and landmark navigation to read the landing title, form and JOIN. Switch
   to focus mode for the form; every field must have a name.
3. Join as `DV04`. Read the HUD with `H`/`Tab`: score, badge, mission, cargo, target inspector. The
   values must be announced, not only shown.
4. Open the Field Manual and Quick Guide. Read headings/body; press Escape and confirm focus returns
   to the invoker. No dialog may be dismissible only by mouse.
5. Target inspector: select a cell with the keyboard, read the inspector, and confirm the target
   value is announced.
6. Captions: trigger narration; confirm the caption text is exposed and updates without stealing
   focus. Confirm the TAP FOR VOICE gate is announced before the first gesture.
7. Incident dialog: confirm the accessible name, description, DISMISS and focus restoration.
8. At 1440×900, check the report overlay and escape CTA in both the default and 200% zoom states.

### 4.5 `SR-MACOS-VO` — macOS Safari + VoiceOver

1. Start VoiceOver (`Cmd+F5`). Use the rotor (`VO+U`) to inspect headings, landmarks and form
   controls on `/?intro=0&gds=1`.
2. Join as `DV05`. Read the HUD top row with `VO+Right`; confirm badge, mission and cargo values.
3. Open the Field Manual and Quick Guide; read a body section, close with Escape, confirm focus
   returns to the invoker.
4. Target inspector: select a cell with the keyboard and read the inspector. Confirm the value is
   exposed to the accessibility tree.
5. Captions: trigger narration; confirm the caption text and live announcements. Interrupt with a
   route change and confirm captions continue.
6. Incident dialog: confirm the title is the dialog name, description is readable, DISMISS works and
   focus returns to `#arena-canvas`.
7. At 1440×900, repeat with Safari page zoom at 200% and with Reduce Motion enabled.

## 5. Device-only checks

### 5.1 200% zoom

- iOS/iPadOS: Settings → Accessibility → Display & Text Size → Larger Text, or Safari's page zoom;
  use the larger of the two and record which was used.
- Android: Chrome → Settings → Accessibility → Text scaling to 200%.
- Windows/macOS: browser zoom to 200% (`Ctrl`/`Cmd` + `+`).
- Pass only if every primary action (JOIN, manual/guide close, escape, report close, incident
  DISMISS, surface exit) is visible or inside a genuinely scrollable ancestor. A clipped primary
  action is a fail with a `[Device][Zoom]` defect.

### 5.2 Reduced motion

Enable the OS reduce-motion setting, reload, and repeat the intro/incident/report paths. The poster
or static equivalent must carry the same information; no shake, loop or transition may be the only
signal. Dismissal and focus restoration must still work.

### 5.3 Autoplay, interruption and recovery

1. Load with sound enabled. Before any tap/keypress, confirm narration is parked and the caption
   bar shows the real TAP FOR VOICE control (44 px, described).
2. Activate the gate; narration starts from the beginning of the pending sentence, not mid-word.
3. Interrupt with an incoming call, a Bluetooth route change or a screen lock. On return, captions
   must continue and narration must resume or degrade to captions within the documented attempts;
   no silent stall.
4. Reload mid-cue with autoplay blocked. Captions must still advance and the TAP FOR VOICE gate
   must reappear.

### 5.4 Daylight contrast and insets

View the muted HUD labels and captions outdoors or at maximum brightness. If contrast is not
legible at a glance, mark the row fail and file the defect against the owning GDS surface. In
landscape, confirm the dock/pads clear the home indicator and the report overlay is not clipped by
the notch or short height.

## 6. Evidence ledger

Default location:

```text
media/a11y/device-gate/{SHORT_SHA}/EVIDENCE.json
```

`{SHORT_SHA}` is the first seven characters of the full commit. Evidence files live in the same
directory and use deterministic names:

```text
media/a11y/device-gate/{SHORT_SHA}/{row-id-with-dashes}__{sequence}.{jpg|png|mp4|txt}
```

Rules:

- One `EVIDENCE.json` per commit; the ledger is the single answer to "is this commit
  device-accessible".
- Every pass/fail row needs at least one evidence file under the same commit directory; a row may
  have several. Each file must be at most 20 MB and the total per row must stay under that budget.
- Captures show only the game surface and synthetic callsigns. No token, tag, notification, email
  or real name. A capture with third-party content is retaken, not redacted.
- A fail row carries an absolute GitHub defect URL and a `[Device][Surface]` title. The defect is
  opened before sign-off; the fail row still blocks.
- A blocked row carries a reason (device unavailable, server unreachable, rate limit) and is never
  converted to pass.
- Each row repeats the target viewports and the documented OS/browser; the checker rejects a missing
  viewport, a wrong orientation set or a device string from another target.
- The ledger cannot be signed by the executor alone: two approvals, one from a reviewer who did not
  execute the run.

The schema is [EVIDENCE.template.json](device-gate/EVIDENCE.template.json). It is a template, not
evidence: `template: true` makes `--check` reject it.

## 7. Executable procedure

### 7.1 Preconditions

```sh
npm ci
npm test
node server.js   # separate shell; uses the committed public/ tree
```

Use a throwaway data directory and no bots. The exact server commands are:

```sh
DATA_DIR="$(mktemp -d)" BOTS=0 PORT=4173 node server.js
```

### 7.2 Plan, template and capture

```sh
COMMIT="$(git rev-parse HEAD)"
SHORT="${COMMIT:0:7}"
mkdir -p "media/a11y/device-gate/${SHORT}"
node scripts/device-gate.mjs --plan --commit="${COMMIT}"
node scripts/device-gate.mjs --template --commit="${COMMIT}" > "media/a11y/device-gate/${SHORT}/EVIDENCE.json"
```

Remove `"template": true` from the copied ledger, fill `runDate`, `gameUrl`, `executor`, both
approvals, and every row. Capture the evidence files named in each row.

### 7.3 Check

```sh
node scripts/device-gate.mjs --check --commit="${COMMIT}"
node scripts/device-gate.mjs --check --commit="${COMMIT}" --json
```

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Pass: 20/20 rows pass, no open blocker, two approvals, fresh evidence, commit match. |
| `1` | Blocked: a missing row, fail, blocked row, missing evidence/defect, stale date, approval problem or commit mismatch. |
| `2` | Usage/internal error (unknown argument, bad clock, unreadable JSON is reported as blocked). |
| `3` | Ledger absent (`LEDGER_MISSING`); the gate is not signed. |

Freshness defaults to 30 days (`--max-age-days` can only tighten or explicitly widen it for an
audit). `--now` exists for deterministic audits; it does not create evidence.

### 7.4 Two-reviewer sign-off

The executor records the run. A second reviewer replays the failing/riskiest rows and signs. Both
approvals are recorded with `name`, `role`, `date` and `executed`; at least one must have
`executed: false`. The checker rejects duplicate names, dates before the run, future dates and a
single approval.

## 8. Computed sign-off

```text
coverage  = rows with a record / 20 = 1
passRate  = pass rows / 20 = 1
openBlock = any fail row or open [Device][Surface] defect = 0
approvals = distinct approvers >= 2 and at least one non-executor
fresh     = runDate and every capturedAt within maxAgeDays and not in the future
provenance= ledger commit == --commit
verdict   = coverage ∧ passRate ∧ ¬openBlock ∧ approvals ∧ fresh ∧ provenance
```

A blocked row, a fail row, a missing evidence path or a stale date makes `verdict` false. There is
no "conditional pass".

## 9. Limits

- One unit per target; this is not a device lab, cloud device farm or soak test.
- iOS/iPadOS are pinned to the shipping major; TalkBack is Android 13+ only.
- Hearing quality, voice naturalness and audio fidelity are out of scope.
- The four screen-reader scripts cover the documented surfaces, not every possible browser
  extension or OS customisation.
- A physical-device run and two approvals are external prerequisites. Without them the issue stays
  open and the release gate stays blocked.

## 10. References

- [A11Y_CHECKLIST.md](../A11Y_CHECKLIST.md) — the headless A11Y-01 gate and suppression policy.
- [VOICE.md](../VOICE.md) — narration profiles and playback resilience.
- [GAMEPLAY.md](../GAMEPLAY.md) — touch matrix and surface controls.
- [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) — the release gate.
- [scripts/device-gate.mjs](../scripts/device-gate.mjs) — plan/template/check implementation.
- [EVIDENCE.template.json](device-gate/EVIDENCE.template.json) — ledger skeleton.
- [media/a11y/device-gate/README.md](../media/a11y/device-gate/README.md) — artefact naming.
