# A11Y-01 — GDS accessibility gate evidence

Generated from the delivery branch with:

```bash
PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright \
AXE_PATH=/tmp/dsh-pw/node_modules/axe-core/axe.min.js \
node scripts/a11y-gate.mjs --engine=both --out=media/a11y --screenshots=media/a11y/screenshots
```

The gate started its own authoritative server on loopback with a temporary `DATA_DIR` and `BOTS=0`.
Nine migrated GDS surfaces were audited in Chromium and WebKit.

| File | Proves |
|---|---|
| `report.json` | combined versioned report (`schemaVersion` `1.0.0`): engine, commit, summary, per-surface findings, suppressions and audit |
| `report-chromium.json` | Chromium: `pass`, 9/9 surfaces, 0 failure / 0 warning / 0 incomplete |
| `report-webkit.json` | WebKit: 9/9 surfaces pass; one explicit `tab-walk-platform` warning because macOS WebKit does not Tab to buttons under its default keyboard policy, so the gate uses the GDS `expectGdsTabOrder` assertion there |
| `screenshots/` | one JPEG per engine × surface while the audited state is open (18 files) |

Each engine report records the seven assertions: axe serious/critical, expected tab order, focus
trap/restore + Escape, WCAG AA contrast, 200% zoom, reduced motion and GDS ownership / 44 px targets.
The incident surface uses the EVT-02 GDS dialog (`#meteor-title` is the accessible name, GDS close and
DISMISS controls, focus restored to `#arena-canvas`).

Reproduce a single engine/surface:

```bash
node scripts/a11y-gate.mjs --engine=chromium --only=incident --out=/tmp/a11y
```
