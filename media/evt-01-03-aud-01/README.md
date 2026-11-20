# EVT-01 / EVT-02 / EVT-03 / AUD-01 — evidence

Generated from the delivery branch with `PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright`
and `AXE_PATH=/tmp/dsh-pw/node_modules/axe-core/axe.min.js` against a local server on an ephemeral
port with a throwaway `DATA_DIR` (`NARIMATO_EVENT_TRIGGER`-equivalent config for the trigger
scripts). All scripts are self-contained unless `BASE_URL` is set.

| Artifact | Proves |
|---|---|
| `acceptance-incident-cycle.json` (+ `scripts/acceptance-incident-cycle.mjs`) | four gated triggers fire meteor → nuclear → solar → alien; overlay title equals the server title; 20 leaves after each reset; exactly one `#event-announcer` write per incident; zero console errors |
| `acceptance-incident-visual.json` + `incident-*.jpg` (+ `scripts/acceptance-incident-visual.mjs`) | per kind at 1280×800 DPR 1 and 390×844 DPR 3: `coverage ≥ 0.03`, `frames ≥ 30`, `ships` signature (1/0/0/2), canvas `cssSize × devicePixelRatio`, nuclear first-frame luminance > 0.6; `prefers-reduced-motion` paints one non-blank poster with no shake and a 1200 ms dwell; one JPEG per kind per viewport plus reduced-motion posters |
| `acceptance-incident-a11y.json` (+ `scripts/acceptance-incident-a11y.mjs`) | `#meteor-overlay` is `role="region"` named by `#meteor-title` and described by `#meteor-sub`/`#meteor-description`; one `#event-announcer` (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`) with the full sentence and no `//`; static captions are not live; Escape and DISMISS close and return focus to `#arena-canvas`; reduced motion has no `body.is-shaking` |
| `acceptance-audio-resilience.json` + `audio-*.jpg` (+ `scripts/acceptance-audio-resilience.mjs`) | strict autoplay policy shows the 44 px `TAP FOR VOICE` control and activating it unlocks/resumes; aborted audio requests increment `audio.clipFailures` and degrade to captions; `audio.firstWordMs` is cue-relative (well below cue-start `performance.now()`) and aggregated by `/api/telemetry` |
| `audit-a11y.txt` | axe-core WCAG A/AA: 0 serious/critical violations on landing, HUD, incident overlay (desktop + mobile) and Field Manual |
| `audit-ui.txt` | nine-viewport UI audit: clean |

Reproduce (each script prints a JSON verdict and exits non-zero on failure):

```bash
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-incident-cycle.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-incident-visual.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-incident-a11y.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/acceptance-audio-resilience.mjs
PLAYWRIGHT_MODULE=/path/to/playwright AXE_PATH=/path/to/axe-core/axe.min.js node scripts/audit-a11y.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/audit-ui.mjs
```
