# Real-device evidence — naming and capture

This directory holds captures and the `EVIDENCE.json` ledger for the A11Y-02 real-device gate.
The procedure and ledger contract are in [docs/DEVICE_GATE.md](../../../docs/DEVICE_GATE.md).

## Layout

```text
media/a11y/device-gate/{SHORT_SHA}/EVIDENCE.json
media/a11y/device-gate/{SHORT_SHA}/{row-id-with-dashes}__{sequence}.jpg
media/a11y/device-gate/{SHORT_SHA}/{row-id-with-dashes}__{sequence}.mp4
media/a11y/device-gate/{SHORT_SHA}/{row-id-with-dashes}__{sequence}.txt
```

- `{SHORT_SHA}` is the first seven characters of the full device-run commit.
- `{row-id-with-dashes}` replaces the `/` in a row id with `-`, for example
  `iphone-safari-zoom-motion`.
- `{sequence}` is `01`, `02`, … in capture order.
- A row may use `.jpg`, `.png`, `.webp`, `.mp4`, `.mov`, `.m4a`, `.txt`, `.log`, `.json` or `.pdf`.
- Keep each row's evidence under 20 MB. Do not commit a raw screen recording with a notification,
  name, token or message; retake it.

## Capture rules

- Use synthetic callsigns `DV01`…`DV12` on a throwaway `DATA_DIR` with `BOTS=0`.
- Crop to the game surface; no desktop chrome, tabs, email or third-party notifications.
- Show the URL and commit in the capture when possible; the ledger carries the full SHA either way.
- One row should be understandable without the others. A caption/screen-reader observation needs the
  spoken/visible text in `notes`, not just a screenshot.

The ledger is not evidence until every row has a verdict, evidence and the two approvals described
in [docs/DEVICE_GATE.md](../../../docs/DEVICE_GATE.md).
